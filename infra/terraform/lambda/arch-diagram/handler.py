# Team1 인프라 구조도 — 요청마다 AWS를 실시간 조회해서 HTML을 그려 반환한다.
# 캐시/스케줄 없음: 새로고침 = 그 순간의 실제 AWS 상태.
#
# 조회 범위: AWS 리소스 API로 알 수 있는 것(서브넷/EKS 노드 수/RDS/Redis/S3/ALB
# 라우팅/Route53/ACM/CloudFront/ECR/Secrets/IAM Role/CloudWatch)은 전부 실시간.
#
# EKS 클러스터 내부(파드 수, HPA replica, 노드 CPU/메모리)는 이 Lambda가 EKS API
# 서버에 직접 접근하지 않는 대신, amazon-cloudwatch-observability 애드온이 이미
# CloudWatch Container Insights(namespace=ContainerInsights)로 퍼블리시하는
# kube-state-metrics 계열 지표(replicas_desired/status_replicas_available,
# node_cpu_utilization 등)를 읽어서 반영한다 — K8s RBAC 없이도 실시간이 됨.

import html
import json
import traceback
from datetime import datetime, timedelta, timezone

import boto3

REGION = "ap-northeast-2"
VPC_NAME = "team1-vpc"
DOMAIN = "jhyang.click"

ec2 = boto3.client("ec2", region_name=REGION)
eks = boto3.client("eks", region_name=REGION)
asg_client = boto3.client("autoscaling", region_name=REGION)
rds = boto3.client("rds", region_name=REGION)
ec_client = boto3.client("elasticache", region_name=REGION)
s3 = boto3.client("s3", region_name=REGION)
elbv2 = boto3.client("elbv2", region_name=REGION)
route53 = boto3.client("route53")
acm = boto3.client("acm", region_name=REGION)
cloudfront = boto3.client("cloudfront")
ecr = boto3.client("ecr", region_name=REGION)
sm = boto3.client("secretsmanager", region_name=REGION)
iam = boto3.client("iam")
cw = boto3.client("cloudwatch", region_name=REGION)


def esc(s):
    return html.escape("" if s is None else str(s), quote=True)


def tag_name(tags, fallback=""):
    for t in tags or []:
        if t.get("Key") == "Name":
            return t.get("Value")
    return fallback


# ---------------------------------------------------------------- fetchers --

def get_vpc():
    r = ec2.describe_vpcs(Filters=[{"Name": "tag:Name", "Values": [VPC_NAME]}])
    return r["Vpcs"][0] if r["Vpcs"] else None


def get_subnets(vpc_id):
    r = ec2.describe_subnets(Filters=[{"Name": "vpc-id", "Values": [vpc_id]}])
    out = []
    for s in r["Subnets"]:
        name = tag_name(s.get("Tags"), s["SubnetId"])
        tier = "data" if "data" in name else ("public" if "public" in name else "private")
        out.append({"id": s["SubnetId"], "name": name, "cidr": s["CidrBlock"],
                     "az": s["AvailabilityZone"], "tier": tier})
    return out


def get_nats(vpc_id):
    r = ec2.describe_nat_gateways(Filter=[
        {"Name": "vpc-id", "Values": [vpc_id]},
        {"Name": "state", "Values": ["available"]},
    ])
    return [{"id": n["NatGatewayId"], "name": tag_name(n.get("Tags"), n["NatGatewayId"]),
              "subnet": n["SubnetId"]} for n in r["NatGateways"]]


def get_igw(vpc_id):
    r = ec2.describe_internet_gateways(Filters=[{"Name": "attachment.vpc-id", "Values": [vpc_id]}])
    if not r["InternetGateways"]:
        return None
    g = r["InternetGateways"][0]
    return {"id": g["InternetGatewayId"], "name": tag_name(g.get("Tags"), g["InternetGatewayId"])}


def get_eks_and_nodes():
    clusters = eks.list_clusters()["clusters"]
    name = next((c for c in clusters if c.startswith("team1")), None)
    if not name:
        return None
    c = eks.describe_cluster(name=name)["cluster"]
    nodes = []  # [{"id":..., "az":...}]
    node_type = None
    nodegroup_names = eks.list_nodegroups(clusterName=name)["nodegroups"]
    min_size = max_size = desired = 0
    for ngname in nodegroup_names:
        ng = eks.describe_nodegroup(clusterName=name, nodegroupName=ngname)["nodegroup"]
        min_size += ng["scalingConfig"]["minSize"]
        max_size += ng["scalingConfig"]["maxSize"]
        desired += ng["scalingConfig"]["desiredSize"]
        if ng.get("instanceTypes"):
            node_type = ng["instanceTypes"][0]
        asg_names = [a["name"] for a in ng.get("resources", {}).get("autoScalingGroups", [])]
        for asg_name in asg_names:
            try:
                g = asg_client.describe_auto_scaling_groups(AutoScalingGroupNames=[asg_name])["AutoScalingGroups"][0]
                for inst in g["Instances"]:
                    nodes.append({"id": inst["InstanceId"], "az": inst["AvailabilityZone"]})
            except Exception:
                pass
    return {
        "name": name, "version": c["version"], "status": c["status"],
        "endpoint_public": c["resourcesVpcConfig"]["endpointPublicAccess"],
        "endpoint_private": c["resourcesVpcConfig"]["endpointPrivateAccess"],
        "node_type": node_type or "?", "min": min_size, "max": max_size, "desired": desired,
        "nodes": nodes,
    }


# ------------------------------------------------ container insights (live) --
# amazon-cloudwatch-observability 애드온이 채우는 CloudWatch 지표를 읽어서
# EKS 클러스터 내부(노드 CPU/메모리, 파드 replica 상태)를 실시간으로 반영한다.

def discover_node_dims(instance_ids):
    """InstanceId -> node_cpu_utilization의 전체 Dimension 목록(NodeName 포함)."""
    out = {}
    for iid in instance_ids:
        try:
            r = cw.list_metrics(
                Namespace="ContainerInsights", MetricName="node_cpu_utilization",
                Dimensions=[{"Name": "InstanceId", "Value": iid}],
            )
            if r["Metrics"]:
                out[iid] = r["Metrics"][0]["Dimensions"]
        except Exception:
            pass
    return out


def get_live_metrics(cluster_name, node_ids, workloads):
    """workloads: [(namespace, name), ...]. 하나의 get_metric_data 호출로 배치 조회."""
    queries = []

    def add(qid, metric, dims):
        queries.append({
            "Id": qid,
            "MetricStat": {
                "Metric": {"Namespace": "ContainerInsights", "MetricName": metric, "Dimensions": dims},
                "Period": 300, "Stat": "Average",
            },
            "ReturnData": True,
        })

    cluster_dims = [{"Name": "ClusterName", "Value": cluster_name}]
    add("cluster_nodes", "cluster_node_count", cluster_dims)
    add("cluster_pods", "cluster_number_of_running_pods", cluster_dims)
    add("cluster_cpu", "node_cpu_utilization", cluster_dims)
    add("cluster_mem", "node_memory_utilization", cluster_dims)
    add("cluster_ready", "node_status_condition_ready", cluster_dims)

    node_dims_map = discover_node_dims(node_ids)
    id_by_query = {}
    for i, iid in enumerate(node_ids):
        dims = node_dims_map.get(iid)
        if not dims:
            continue
        add("node_cpu_{}".format(i), "node_cpu_utilization", dims)
        add("node_mem_{}".format(i), "node_memory_utilization", dims)
        add("node_ready_{}".format(i), "node_status_condition_ready", dims)
        id_by_query[i] = iid

    for i, (ns, wname) in enumerate(workloads):
        dims = [{"Name": "ClusterName", "Value": cluster_name},
                 {"Name": "Namespace", "Value": ns}, {"Name": "PodName", "Value": wname}]
        add("wl_desired_{}".format(i), "replicas_desired", dims)
        add("wl_ready_{}".format(i), "status_replicas_available", dims)

    values = {}
    if queries:
        end = datetime.now(timezone.utc)
        start = end - timedelta(minutes=15)
        for i in range(0, len(queries), 100):
            r = cw.get_metric_data(MetricDataQueries=queries[i:i + 100], StartTime=start, EndTime=end)
            for mr in r["MetricDataResults"]:
                vals = mr.get("Values", [])
                values[mr["Id"]] = vals[0] if vals else None

    node_live = {}
    for i, iid in id_by_query.items():
        node_live[iid] = {
            "cpu": values.get("node_cpu_{}".format(i)),
            "mem": values.get("node_mem_{}".format(i)),
            "ready": values.get("node_ready_{}".format(i)),
        }
    workload_live = {}
    for i, (ns, wname) in enumerate(workloads):
        workload_live[(ns, wname)] = {
            "desired": values.get("wl_desired_{}".format(i)),
            "ready": values.get("wl_ready_{}".format(i)),
        }
    cluster_live = {
        "nodes": values.get("cluster_nodes"), "pods": values.get("cluster_pods"),
        "cpu": values.get("cluster_cpu"), "mem": values.get("cluster_mem"), "ready": values.get("cluster_ready"),
    }
    return cluster_live, node_live, workload_live


def get_rds():
    r = rds.describe_db_instances()
    out = []
    for d in r["DBInstances"]:
        if d["DBInstanceIdentifier"].startswith("team1"):
            out.append({
                "id": d["DBInstanceIdentifier"], "class": d["DBInstanceClass"],
                "engine": "{} {}".format(d["Engine"], d["EngineVersion"]),
                "az": d.get("AvailabilityZone"), "multi_az": d["MultiAZ"],
                "public": d["PubliclyAccessible"], "status": d["DBInstanceStatus"],
            })
    return out


def get_elasticache():
    r = ec_client.describe_cache_clusters(ShowCacheNodeInfo=False)
    groups = {}
    for c in r["CacheClusters"]:
        rg = c.get("ReplicationGroupId", "") or c["CacheClusterId"]
        if not rg.startswith("team1"):
            continue
        groups.setdefault(rg, []).append({
            "id": c["CacheClusterId"], "az": c["PreferredAvailabilityZone"],
            "type": c["CacheNodeType"], "engine": "redis {}".format(c["EngineVersion"]),
            "status": c["CacheClusterStatus"],
        })
    return groups


def get_s3_buckets():
    r = s3.list_buckets()
    return sorted(b["Name"] for b in r["Buckets"] if b["Name"].startswith("team1"))


def get_albs(vpc_id):
    r = elbv2.describe_load_balancers()
    out = []
    for lb in r["LoadBalancers"]:
        if lb.get("VpcId") != vpc_id:
            continue
        rules = []
        try:
            listeners = elbv2.describe_listeners(LoadBalancerArn=lb["LoadBalancerArn"])["Listeners"]
            for li in listeners:
                for rule in elbv2.describe_rules(ListenerArn=li["ListenerArn"])["Rules"]:
                    hosts = []
                    for cond in rule.get("Conditions", []):
                        if cond.get("Field") == "host-header":
                            hosts += cond.get("HostHeaderConfig", {}).get("Values", [])
                    if not hosts:
                        continue
                    tg_name, tg_port = None, None
                    for act in rule.get("Actions", []):
                        if act.get("Type") == "forward" and act.get("TargetGroupArn"):
                            try:
                                tg = elbv2.describe_target_groups(
                                    TargetGroupArns=[act["TargetGroupArn"]])["TargetGroups"][0]
                                tg_name, tg_port = tg["TargetGroupName"], tg["Port"]
                            except Exception:
                                pass
                    for host in hosts:
                        rules.append({"host": host, "target": tg_name or "-", "port": tg_port})
        except Exception:
            pass
        out.append({"name": lb["LoadBalancerName"], "scheme": lb["Scheme"], "type": lb["Type"], "rules": rules})
    return out


def get_route53():
    zones = route53.list_hosted_zones_by_name(DNSName=DOMAIN)["HostedZones"]
    zone = next((z for z in zones if z["Name"] == DOMAIN + "."), None)
    if not zone:
        return None, []
    zone_id = zone["Id"].split("/")[-1]
    records = route53.list_resource_record_sets(HostedZoneId=zone_id)["ResourceRecordSets"]
    out = []
    for rec in records:
        if rec["Type"] in ("NS", "SOA", "TXT", "CAA"):
            continue
        if rec["Name"].startswith("_"):
            continue
        if rec["Name"].rstrip(".") == "www." + DOMAIN:
            continue  # 개인 사이트, team1 인프라 아님
        target = None
        if "AliasTarget" in rec:
            target = rec["AliasTarget"]["DNSName"].rstrip(".")
        elif rec.get("ResourceRecords"):
            target = rec["ResourceRecords"][0]["Value"]
        out.append({"name": rec["Name"].rstrip("."), "type": rec["Type"], "target": target})
    return zone_id, out


def get_cloudfront():
    r = cloudfront.list_distributions()
    items = (r.get("DistributionList") or {}).get("Items") or []
    out = []
    for d in items:
        aliases = d.get("Aliases", {}).get("Items", []) or []
        if not any(a.endswith(DOMAIN) for a in aliases):
            continue
        origins = d.get("Origins", {}).get("Items", [])
        origin = origins[0]["DomainName"] if origins else None
        out.append({"id": d["Id"], "domain": d["DomainName"], "aliases": aliases, "origin": origin})
    return out


def get_ecr():
    r = ecr.describe_repositories()
    out = []
    for repo in r["repositories"]:
        if not repo["repositoryName"].startswith("team1"):
            continue
        tag = "-"
        try:
            images = ecr.describe_images(
                repositoryName=repo["repositoryName"],
                filter={"tagStatus": "TAGGED"},
            )["imageDetails"]
            images = [i for i in images if i.get("imagePushedAt") and i.get("imageTags")]
            images.sort(key=lambda x: x["imagePushedAt"], reverse=True)
            if images:
                tag = images[0]["imageTags"][0]
        except Exception:
            pass
        out.append({"name": repo["repositoryName"], "tag": tag})
    return sorted(out, key=lambda x: x["name"])


def get_secrets():
    r = sm.list_secrets(Filters=[{"Key": "name", "Values": ["team1/"]}])
    return sorted(s["Name"] for s in r["SecretList"])


def get_irsa_roles():
    out = []
    paginator = iam.get_paginator("list_roles")
    for page in paginator.paginate(PathPrefix="/"):
        for role in page["Roles"]:
            if role["RoleName"].startswith("team1") and "irsa" in role["RoleName"].lower():
                out.append(role["RoleName"])
    return sorted(out)


def get_role_access(role_name):
    """OIDC subject(k8s serviceaccount) + attached-policy resource ARNs, from IAM alone."""
    subs, targets = [], []
    try:
        doc = iam.get_role(RoleName=role_name)["Role"]["AssumeRolePolicyDocument"]
        for stmt in doc.get("Statement", []):
            for _op, kv in stmt.get("Condition", {}).items():
                for k, v in kv.items():
                    if k.endswith(":sub"):
                        subs.append(v if isinstance(v, str) else ", ".join(v))
    except Exception:
        pass
    try:
        for p in iam.list_attached_role_policies(RoleName=role_name)["AttachedPolicies"]:
            try:
                pol = iam.get_policy(PolicyArn=p["PolicyArn"])["Policy"]
                ver = iam.get_policy_version(
                    PolicyArn=p["PolicyArn"], VersionId=pol["DefaultVersionId"])["PolicyVersion"]
                for stmt in ver["Document"].get("Statement", []):
                    res = stmt.get("Resource")
                    if isinstance(res, str):
                        targets.append(res)
                    elif isinstance(res, list):
                        targets.extend(res)
            except Exception:
                continue
    except Exception:
        pass
    return subs, targets


def get_dashboards():
    r = cw.list_dashboards()
    return sorted(d["DashboardName"] for d in r["DashboardEntries"] if d["DashboardName"].startswith("team1"))


def get_acm_domains():
    r = acm.list_certificates(CertificateStatuses=["ISSUED"])
    return sorted({c["DomainName"] for c in r["CertificateSummaryList"] if DOMAIN in c["DomainName"]})


def short_arn(arn):
    if not arn:
        return arn
    tail = arn.split(":")[-1]
    return tail.split("/")[-1] if "/" in tail else tail.split(":")[-1]


# --------------------------------------------------------------- collector --

def collect():
    ctx = {"errors": []}

    def try_(key, fn, default):
        try:
            ctx[key] = fn()
        except Exception as e:
            ctx["errors"].append("{}: {}".format(key, e))
            ctx[key] = default

    vpc = None
    try_("vpc", get_vpc, None)
    vpc = ctx["vpc"]
    vpc_id = vpc["VpcId"] if vpc else None

    try_("subnets", (lambda: get_subnets(vpc_id)) if vpc_id else (lambda: []), [])
    try_("nats", (lambda: get_nats(vpc_id)) if vpc_id else (lambda: []), [])
    try_("igw", (lambda: get_igw(vpc_id)) if vpc_id else (lambda: None), None)
    try_("eks", get_eks_and_nodes, None)
    try_("rds", get_rds, [])
    try_("elasticache", get_elasticache, {})
    try_("s3_buckets", get_s3_buckets, [])
    try_("albs", (lambda: get_albs(vpc_id)) if vpc_id else (lambda: []), [])
    try_("route53", get_route53, (None, []))
    try_("cloudfront", get_cloudfront, [])
    try_("ecr", get_ecr, [])
    try_("secrets", get_secrets, [])
    try_("irsa_roles", get_irsa_roles, [])
    try_("dashboards", get_dashboards, [])
    try_("acm_domains", get_acm_domains, [])

    ctx["role_access"] = {}
    for role in ctx["irsa_roles"]:
        try:
            ctx["role_access"][role] = get_role_access(role)
        except Exception as e:
            ctx["errors"].append("role_access[{}]: {}".format(role, e))
            ctx["role_access"][role] = ([], [])

    ctx["cluster_live"], ctx["node_live"], ctx["workload_live"] = {}, {}, {}
    eksinfo = ctx.get("eks")
    if eksinfo:
        try:
            node_ids = [n["id"] for n in eksinfo.get("nodes", [])]
            workloads = [("default", "team1-backend"), ("default", "team1-monitor"),
                         ("monitoring", "kube-prometheus-stack-grafana")]
            ctx["cluster_live"], ctx["node_live"], ctx["workload_live"] = get_live_metrics(
                eksinfo["name"], node_ids, workloads)
        except Exception as e:
            ctx["errors"].append("live_metrics: {}".format(e))

    return ctx


# ------------------------------------------------------------------ render --

CSS = """
:root{
  --page-a:#EEF0F4; --page-b:#E3E6ED; --paper:#FFFFFF;
  --ink:#1A1D24; --ink-soft:#565B66; --ink-faint:#8A8FA0;
  --accent:#4A3FA0; --line:#E4E6ED; --line-mid:#C9CCD6; --line-az:#C7C2E2;
  --line-strong:#23262E; --rule:#ECEDF2;
  --compute:#B8631E; --database:#3557C4; --network:#4A3FA0; --storage:#5A7A2E;
  --security:#A82F45; --management:#9C1868;
  --network-bg:#F2F0FB; --compute-bg:#FBF2E6; --database-bg:#EEF1FC;
  --sans:"Segoe UI",system-ui,-apple-system,"Inter","Pretendard",Arial,sans-serif;
  --mono:"Cascadia Code",Consolas,"SF Mono",ui-monospace,"Liberation Mono",monospace;
}
*{box-sizing:border-box;}
html,body{margin:0;color:var(--ink);font-family:var(--sans);}
body{padding:32px 18px 40px;background:
  radial-gradient(1200px 480px at 12% -10%, #F4F2FC 0%, transparent 60%),
  linear-gradient(180deg, var(--page-a), var(--page-b));}
.page{max-width:1600px;margin:0 auto;}
.titlebar{display:flex;justify-content:space-between;align-items:flex-end;gap:24px;margin-bottom:16px;padding-bottom:12px;border-bottom:1px solid var(--line-mid);flex-wrap:wrap;}
.kicker{width:26px;height:3px;background:var(--accent);border-radius:2px;margin-bottom:8px;}
.titlebar h1{margin:0;font-size:25px;font-weight:800;letter-spacing:-.015em;}
.titlebar .path{font-family:var(--mono);font-size:12px;color:var(--ink-faint);margin-top:6px;}
.live{display:inline-flex;align-items:center;gap:6px;font-family:var(--mono);font-size:11px;color:var(--ink-soft);}
.live i{width:7px;height:7px;border-radius:50%;background:#2E9E5B;display:inline-block;}
.sheet-scroll{overflow-x:auto;padding:6px 6px 14px;margin:-6px;}
.sheet{min-width:1600px;background:var(--paper);border:1px solid var(--line);border-radius:14px;padding:26px 26px 22px;box-shadow:0 1px 2px rgba(30,25,60,.04),0 20px 40px -24px rgba(30,25,60,.18);}
h2.sect{font-size:12.5px;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:var(--ink-faint);margin:0 0 10px;display:flex;align-items:center;gap:8px;}
h2.sect::before{content:"";width:12px;height:2px;background:var(--accent);border-radius:2px;}
.frame{position:relative;padding:20px 15px 15px;border-radius:11px;}
.frame>.tag{position:absolute;top:-10px;left:15px;background:var(--paper);padding:0 8px;font-size:11.5px;font-weight:700;white-space:nowrap;}
.frame>.tag small{font-weight:400;color:var(--ink-faint);margin-left:7px;font-family:var(--mono);font-size:11px;}
.f-vpc{border:1.5px solid var(--accent);background:linear-gradient(180deg,#FCFBFF,#FFFFFF 140px);}
.f-vpc>.tag{color:var(--accent);}
.f-az{border:1.3px dashed var(--line-az);border-radius:10px;flex:1;display:flex;flex-direction:column;gap:9px;padding-top:19px;}
.f-az>.tag{font-size:11px;color:var(--ink-soft);font-weight:700;}
.f-subnet{border:1px solid var(--line-mid);border-radius:8px;padding:9px 11px;}
.f-subnet.t-net{background:var(--network-bg);border-color:#DCD6F2;}
.f-subnet.t-compute{background:var(--compute-bg);border-color:#EFDBBB;display:flex;flex-direction:column;gap:7px;}
.f-subnet.t-data{background:var(--database-bg);border-color:#D3DBF5;display:flex;flex-direction:column;gap:7px;}
.subnet-name{font-size:11px;font-weight:700;}
.box{background:var(--paper);border:1px solid var(--line);border-radius:7px;padding:9px 13px;box-shadow:0 1px 1.5px rgba(30,25,60,.035);}
.box .hd{font-size:13px;font-weight:700;margin-bottom:3px;display:flex;align-items:center;flex-wrap:wrap;gap:0;}
.box .hd .sub{font-weight:400;color:var(--ink-faint);font-size:11.5px;}
.kind{display:inline-block;font-family:var(--mono);font-size:10px;font-weight:700;letter-spacing:.03em;color:var(--ink-soft);background:#F1F2F6;border:1px solid var(--line-mid);border-radius:4px;padding:2px 6px;margin-right:6px;text-transform:uppercase;line-height:1.4;}
.kind.k-compute{color:var(--compute);border-color:#E9CFA9;background:#FCF3E7;}
.kind.k-db{color:var(--database);border-color:#C9D4F3;background:#F0F3FD;}
.kind.k-k8s{color:#3A5A9C;border-color:#CBD8F0;background:#EEF2FB;}
.box .id{font-family:var(--mono);font-size:11px;color:var(--ink-faint);}
.box .line1{font-size:11.5px;color:var(--ink-soft);margin-top:4px;line-height:1.55;}
.box .kv{display:flex;flex-direction:column;gap:3px;margin-top:5px;}
.box .kv div{font-size:11.5px;color:var(--ink-soft);}
.box .kv b{color:var(--ink);font-weight:700;font-family:var(--mono);font-size:11px;}
.conn{display:flex;flex-direction:column;align-items:center;}
.conn i.l{width:1.5px;height:16px;background:var(--accent);opacity:.35;}
.conn i.h{width:0;height:0;border-left:4px solid transparent;border-right:4px solid transparent;border-top:6px solid var(--accent);opacity:.55;margin-top:-1px;}
.conn .lbl{font-family:var(--mono);font-size:10.5px;color:var(--ink-faint);margin-top:3px;}
.conn-row{display:flex;}
.row{display:flex;gap:14px;align-items:flex-start;}
.row.stretch{align-items:stretch;}
.col{display:flex;flex-direction:column;gap:8px;}
.grow{flex:1;min-width:0;}
.user-box{display:inline-block;border:1.3px solid var(--line-strong);border-radius:999px;padding:7px 20px;font-size:12.5px;font-weight:700;background:var(--paper);}
.center{display:flex;justify-content:center;}
.edge-col{width:236px;flex:none;}
.rail{width:236px;flex:none;display:flex;flex-direction:column;gap:8px;padding-left:14px;border-left:1px solid var(--line);}
.rail-label{font-size:11px;font-weight:700;color:var(--ink-faint);text-transform:uppercase;letter-spacing:.06em;margin-bottom:-1px;}
.reclist{display:flex;flex-direction:column;gap:5px;margin-top:7px;}
.rec{display:flex;gap:14px;font-size:12.5px;align-items:baseline;}
.rec .host{font-family:var(--mono);color:var(--ink);min-width:206px;}
.rec .arrow{color:var(--accent);opacity:.55;}
.rec .target{color:var(--ink-soft);}
table.flowtbl{width:100%;border-collapse:collapse;font-size:12.5px;}
table.flowtbl th{text-align:left;font-size:10.5px;text-transform:uppercase;letter-spacing:.05em;color:var(--ink-faint);border-bottom:1.5px solid var(--accent);padding:8px 11px;font-weight:700;}
table.flowtbl td{border-bottom:1px solid var(--rule);padding:9px 11px;vertical-align:top;color:var(--ink-soft);}
table.flowtbl td.mono{font-family:var(--mono);font-size:11px;}
table.flowtbl tr td:first-child{color:var(--ink);font-weight:700;}
table.flowtbl tr:last-child td{border-bottom:none;}
table.flowtbl tr:nth-child(even) td{background:#FAFAFC;}
ul.foot{margin:0;padding-left:16px;font-size:11.5px;color:var(--ink-faint);line-height:1.8;}
.panel{background:var(--paper);border:1px solid var(--line);border-radius:12px;padding:16px 20px;box-shadow:0 1px 2px rgba(30,25,60,.04),0 12px 28px -20px rgba(30,25,60,.14);}
section{margin-top:20px;}
.warn{font-size:11px;color:var(--security);margin-top:4px;}
"""


def kind_badge(text, cls=""):
    c = " " + cls if cls else ""
    return '<span class="kind{}">{}</span>'.format(c, esc(text))


def box(hd, line1="", kv=None, id_=None):
    parts = ['<div class="box"><div class="hd">{}</div>'.format(hd)]
    if id_:
        parts.append('<div class="id">{}</div>'.format(esc(id_)))
    if kv:
        parts.append('<div class="kv">')
        for k, v in kv:
            parts.append('<div><b>{}</b> {}</div>'.format(esc(k), v))
        parts.append('</div>')
    if line1:
        parts.append('<div class="line1">{}</div>'.format(line1))
    parts.append('</div>')
    return "".join(parts)


def conn(label=None):
    lbl = '<div class="lbl">{}</div>'.format(esc(label)) if label else ""
    return '<div class="conn"><i class="l"></i><i class="h"></i>{}</div>'.format(lbl)


def fmt_pct(v):
    return "{:.0f}%".format(v) if v is not None else "–"


def fmt_num(v):
    return "{:.0f}".format(v) if v is not None else "–"


def fmt_ready(v):
    if v is None:
        return "–"
    return "ready" if v >= 0.5 else "not ready"


def render(ctx):
    now = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M:%S UTC")

    vpc = ctx.get("vpc")
    vpc_id = vpc["VpcId"] if vpc else "?"
    vpc_cidr = vpc["CidrBlock"] if vpc else "?"
    subnets = ctx.get("subnets") or []
    nats = ctx.get("nats") or []
    igw = ctx.get("igw")
    eksinfo = ctx.get("eks")
    rds_list = ctx.get("rds") or []
    ec_groups = ctx.get("elasticache") or {}
    s3_buckets = ctx.get("s3_buckets") or []
    albs = ctx.get("albs") or []
    zone_id, records = ctx.get("route53") or (None, [])
    cfdists = ctx.get("cloudfront") or []
    ecr_repos = ctx.get("ecr") or []
    secrets = ctx.get("secrets") or []
    irsa_roles = ctx.get("irsa_roles") or []
    role_access = ctx.get("role_access") or {}
    dashboards = ctx.get("dashboards") or []
    acm_domains = ctx.get("acm_domains") or []
    cluster_live = ctx.get("cluster_live") or {}
    node_live = ctx.get("node_live") or {}
    workload_live = ctx.get("workload_live") or {}

    # ---- Route53 record list ----
    rec_html = []
    for rec in records:
        rec_html.append(
            '<div class="rec"><span class="host">{}</span><span class="arrow">&rarr;</span>'
            '<span class="target">{}</span></div>'.format(esc(rec["name"]), esc(rec["target"] or rec["type"]))
        )
    route53_box = box(
        kind_badge("DNS") + "Route 53" +
        '<span class="sub">{}{}</span>'.format(DOMAIN, " &middot; " + zone_id if zone_id else ""),
        line1='<div class="reclist">{}</div>'.format("".join(rec_html) or "레코드 없음"),
    )

    # ---- CloudFront + S3 edge column ----
    edge_parts = []
    if cfdists:
        d = cfdists[0]
        edge_parts.append(box(
            kind_badge("CDN") + "CloudFront",
            id_=d["id"],
            line1="{} &middot; origin {}".format(esc(", ".join(d["aliases"])), esc(d["origin"] or "?")),
        ))
        edge_parts.append('<div class="center">{}</div>'.format(conn("OAC")))
        origin_bucket = (d["origin"] or "").split(".")[0]
        if origin_bucket:
            edge_parts.append(box(kind_badge("S3") + esc(origin_bucket), line1="React build"))
    else:
        edge_parts.append('<div class="line1">CloudFront distribution 없음</div>')

    # ---- VPC / EKS caption ----
    eks_nodes = (eksinfo or {}).get("nodes", [])
    node_type = eksinfo["node_type"] if eksinfo else "?"
    node_azs = {}
    for n in eks_nodes:
        node_azs.setdefault(n["az"], []).append(n["id"])
    node_total = len(eks_nodes)
    vpc_caption = "IGW {} &middot; EKS {} {} &middot; 노드그룹 {}대 (min{}/max{})".format(
        esc((igw or {}).get("name", "-")),
        esc((eksinfo or {}).get("name", "team1-eks")),
        esc((eksinfo or {}).get("version", "?")),
        node_total, (eksinfo or {}).get("min", "?"), (eksinfo or {}).get("max", "?"),
    )
    if cluster_live and any(v is not None for v in cluster_live.values()):
        vpc_caption += (
            ' &nbsp;<span class="kind k-k8s">LIVE</span>'
            "cluster nodes {} &middot; running pods {} &middot; avg node CPU {} / Mem {}".format(
                fmt_num(cluster_live.get("nodes")), fmt_num(cluster_live.get("pods")),
                fmt_pct(cluster_live.get("cpu")), fmt_pct(cluster_live.get("mem")),
            )
        )

    # ---- Workloads (live, Container Insights) ----
    wl_labels = {
        ("default", "team1-backend"): "team1-backend",
        ("default", "team1-monitor"): "team1-monitor",
        ("monitoring", "kube-prometheus-stack-grafana"): "grafana",
    }
    wl_rows = []
    for key, label in wl_labels.items():
        live = workload_live.get(key)
        if not live or live.get("desired") is None:
            continue
        wl_rows.append((label, "desired {} / ready {}".format(
            fmt_num(live.get("desired")), fmt_num(live.get("ready")))))
    workloads_box = ""
    if wl_rows:
        workloads_box = box(
            kind_badge("LIVE", "k-k8s") + "Workloads <span class=\"sub\">Container Insights, replicas</span>",
            kv=wl_rows,
        )

    # ---- ALB box ----
    alb_html = []
    for lb in albs:
        rows = []
        for r in lb["rules"]:
            port = ":{}".format(r["port"]) if r.get("port") else ""
            rows.append((r["host"], "&rarr; {}{}".format(esc(r["target"]), port)))
        alb_html.append(box(
            kind_badge("ALB") + esc(lb["scheme"]),
            id_=lb["name"],
            kv=rows or None,
            line1="host rule 없음" if not rows else "",
        ))
    if not alb_html:
        alb_html = ['<div class="line1">internet-facing ALB 없음 (VPC 내)</div>']

    # ---- AZ columns ----
    azs = sorted({s["az"] for s in subnets}) or sorted(node_azs.keys())
    az_cols = []
    for az in azs:
        az_subnets = [s for s in subnets if s["az"] == az]
        pub = [s for s in az_subnets if s["tier"] == "public"]
        priv = [s for s in az_subnets if s["tier"] == "private"]
        data = [s for s in az_subnets if s["tier"] == "data"]

        # public tier: NAT
        pub_inner = []
        for s in pub:
            nat = next((n for n in nats if n["subnet"] == s["id"]), None)
            pub_inner.append('<div class="subnet-name">public &middot; {}</div>'.format(esc(s["cidr"])))
            if nat:
                pub_inner.append(box(kind_badge("NAT GW") + esc(nat["name"])))
        pub_html = '<div class="f-subnet t-net">{}</div>'.format("".join(pub_inner)) if pub else ""

        # private/compute tier: nodes in this AZ, with live CPU/Mem/ready averaged from Container Insights
        az_node_ids = node_azs.get(az, [])
        node_count = len(az_node_ids)
        priv_inner = []
        for s in priv:
            priv_inner.append('<div class="subnet-name">private &middot; {}</div>'.format(esc(s["cidr"])))
        if node_count:
            cpu_vals = [node_live.get(i, {}).get("cpu") for i in az_node_ids]
            mem_vals = [node_live.get(i, {}).get("mem") for i in az_node_ids]
            ready_vals = [node_live.get(i, {}).get("ready") for i in az_node_ids]
            cpu_vals = [v for v in cpu_vals if v is not None]
            mem_vals = [v for v in mem_vals if v is not None]
            ready_count = sum(1 for v in ready_vals if v is not None and v >= 0.5)
            avg_cpu = sum(cpu_vals) / len(cpu_vals) if cpu_vals else None
            avg_mem = sum(mem_vals) / len(mem_vals) if mem_vals else None
            live_line = "avg CPU {} &middot; avg Mem {} &middot; ready {}/{}".format(
                fmt_pct(avg_cpu), fmt_pct(avg_mem), ready_count, node_count) if cpu_vals or mem_vals else ""
            priv_inner.append(box(
                kind_badge("EC2", "k-compute") + "{} &times;{}".format(esc(node_type), node_count),
                line1=live_line,
            ))
        priv_html = '<div class="f-subnet t-compute">{}</div>'.format("".join(priv_inner)) if (priv or node_count) else ""

        # data tier: elasticache + rds
        data_inner = []
        for s in data:
            data_inner.append('<div class="subnet-name">data (isolated) &middot; {}</div>'.format(esc(s["cidr"])))
        for rg_name, nodes in ec_groups.items():
            in_az = [n for n in nodes if n["az"] == az]
            if in_az:
                data_inner.append(box(
                    kind_badge("ElastiCache", "k-db") + esc(in_az[0]["engine"]),
                    line1="{} &middot; {}".format(esc(", ".join(n["id"] for n in in_az)), esc(in_az[0]["type"])),
                ))
        for d in rds_list:
            if d["az"] == az:
                data_inner.append(box(
                    kind_badge("RDS", "k-db") + esc(d["engine"]),
                    line1="{} &middot; {}{}".format(
                        esc(d["id"]), esc(d["class"]), " &middot; Multi-AZ" if d["multi_az"] else ""),
                ))
        data_html = '<div class="f-subnet t-data">{}</div>'.format("".join(data_inner)) if data_inner else ""

        az_cols.append(
            '<div class="frame f-az"><div class="tag">AZ {}</div>{}{}{}</div>'.format(
                esc(az), pub_html, priv_html, data_html)
        )

    # ---- regional rail ----
    rail = ['<div class="rail-label">Regional</div>']
    rail.append(box(kind_badge("ACM") + esc(", ".join(acm_domains) or DOMAIN)))
    ecr_lines = "<br/>".join("{} : {}".format(esc(r["name"]), esc(r["tag"])) for r in ecr_repos) or "저장소 없음"
    rail.append(box(kind_badge("ECR") + "registry", line1=ecr_lines + "<br/><span style=\"color:var(--ink-faint)\">tag: 최근 push 기준, 배포본과 별개</span>"))
    secrets_lines = "<br/>".join(esc(s) for s in secrets) or "secrets 없음"
    roles_lines = ", ".join(esc(r) for r in irsa_roles) or "IRSA role 없음"
    rail.append(box("Secrets &amp; access <span class=\"sub\">IRSA</span>",
                     line1="{}<br/>{}: {}".format(secrets_lines, kind_badge("IAM"), roles_lines)))
    profile_bucket = next((b for b in s3_buckets if "profile" in b), None)
    if profile_bucket:
        rail.append(box(kind_badge("S3") + esc(profile_bucket)))
    dash_lines = ", ".join(esc(d) for d in dashboards) or "dashboard 없음"
    rail.append(box(kind_badge("CW") + "CloudWatch", line1=dash_lines))

    # ---- IAM access table (from IAM trust policy + attached policy resources) ----
    iam_rows = []
    for role in irsa_roles:
        subs, targets = role_access.get(role, ([], []))
        source = subs[0] if subs else "-"
        tstr = ", ".join(short_arn(t) for t in targets[:4]) if targets else "-"
        iam_rows.append(
            "<tr><td>{}</td><td class=\"mono\">{}</td><td colspan=\"2\">{}</td></tr>".format(
                esc(source), esc(role), esc(tstr))
        )
    iam_table = "".join(iam_rows) or "<tr><td colspan=\"4\">IRSA role 없음</td></tr>"

    errors_html = ""
    if ctx.get("errors"):
        errors_html = '<div class="warn">partial data &mdash; {} lookup(s) failed this run</div>'.format(
            len(ctx["errors"]))

    dashboard_line = dashboards[0] if dashboards else "team1-backend-overview"

    html_out = """<!doctype html><html><head><meta charset="utf-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1"/>
<title>team1-gomoku-infra (live)</title>
<style>{css}</style></head><body>
<div class="page">
  <div class="titlebar">
    <div>
      <div class="kicker"></div>
      <h1>Team1 (하닉없음) &mdash; AWS Infrastructure</h1>
      <div class="path">727646470302 &middot; {region} &middot; {vpc_id} ({vpc_cidr})</div>
    </div>
    <div class="live"><i></i>live &middot; {now}</div>
  </div>
  {errors_html}
  <div class="sheet-scroll"><div class="sheet">
    <div class="center"><div class="user-box">CLIENT (BROWSER)</div></div>
    <div class="conn-row" style="justify-content:center;">{conn_top}</div>
    {route53_box}
    <div class="row" style="margin-top:4px;">
      <div class="edge-col center">{conn_edge}</div>
      <div class="grow center">{conn_vpc}</div>
    </div>
    <div class="row stretch">
      <div class="edge-col col">{edge_html}</div>
      <div class="grow frame f-vpc">
        <div class="tag">VPC <small>{vpc_name} &middot; {vpc_cidr}</small></div>
        <div class="row stretch" style="gap:22px;">
          <div class="grow col">
            <div class="line1" style="margin-bottom:2px;">{vpc_caption}</div>
            {alb_html}
            {workloads_box}
            <div class="conn-row" style="justify-content:space-around;padding:2px 70px 0;">{conn_az_a}{conn_az_b}</div>
            <div class="row stretch" style="gap:14px;">{az_cols}</div>
          </div>
          <div class="rail">{rail_html}</div>
        </div>
      </div>
    </div>
  </div></div>

  <section><div class="panel">
    <h2 class="sect">IAM / Secrets 접근 경로 <span style="font-weight:400;text-transform:none;letter-spacing:0;">(출처: IAM Role trust policy + 첨부 정책, 실시간 조회)</span></h2>
    <table class="flowtbl"><tr><th>K8s ServiceAccount (OIDC sub)</th><th>IAM Role</th><th colspan="2">접근 가능 리소스</th></tr>
    {iam_table}
    </table>
  </div></section>

  <section><div class="panel">
    <h2 class="sect">CloudWatch &middot; {dashboard_line}</h2>
    <div class="line1" style="font-family:var(--mono);font-size:13px;">ALB &rarr; EKS &rarr; RDS &rarr; ElastiCache &rarr; CloudFront &rarr; error logs</div>
  </div></section>

  <section>
    <h2 class="sect">Scope</h2>
    <ul class="foot">
      <li>Team1(team1-gomoku) 리소스만 표시 &middot; 동일 계정의 team2/team5 제외</li>
      <li>서브넷/EKS 노드 수/RDS/Redis/S3/ALB 라우팅/Route53/ACM/CloudFront/ECR/Secrets/IAM Role/CloudWatch: 요청마다 실시간 조회</li>
      <li><span class="kind k-k8s">LIVE</span> 노드 CPU/메모리·워크로드 replica(desired/ready): CloudWatch Container Insights(amazon-cloudwatch-observability 애드온) 지표 기반, EKS API 직접 접근 없이 실시간 반영</li>
      <li>범위 밖: Pod 이름·컨테이너 로그 등 Container Insights 미노출 항목</li>
    </ul>
  </section>
</div>
</body></html>""".format(
        css=CSS, region=REGION, vpc_id=esc(vpc_id), vpc_cidr=esc(vpc_cidr), vpc_name=esc(VPC_NAME),
        now=now, errors_html=errors_html,
        conn_top=conn(), route53_box=route53_box,
        conn_edge=conn("omok.*"), conn_vpc=conn("api.* / monitor.* / grafana.*"),
        edge_html="".join(edge_parts), vpc_caption=vpc_caption,
        alb_html="".join(alb_html), workloads_box=workloads_box,
        conn_az_a=conn(), conn_az_b=conn(),
        az_cols="".join(az_cols) or '<div class="line1">subnet 없음</div>',
        rail_html="".join(rail),
        iam_table=iam_table, dashboard_line=esc(dashboard_line),
    )
    return html_out


# ------------------------------------------------------------------ handler --

def lambda_handler(event, context):
    try:
        ctx = collect()
        body = render(ctx)
        status = 200
    except Exception:
        body = "<pre>{}</pre>".format(esc(traceback.format_exc()))
        status = 500
    return {
        "statusCode": status,
        "headers": {"content-type": "text/html; charset=utf-8", "cache-control": "no-store"},
        "body": body,
        "isBase64Encoded": False,
    }
