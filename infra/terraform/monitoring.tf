# Prometheus + Grafana (kube-prometheus-stack) — EKS 클러스터 상태 모니터링용
# AWS 서비스(RDS/ElastiCache/ALB/NAT/CloudFront) 지표는 Grafana의 CloudWatch
# 데이터소스로 같은 화면에서 함께 봄 (dashboard.tf의 CloudWatch 대시보드와 병행 사용)

# --- EBS CSI Driver -----------------------------------------------------
# gp2 StorageClass는 있지만 in-tree provisioner라 CSI 드라이버 없이는 동적
# 프로비저닝이 되지 않음. Prometheus/Grafana PVC를 위해 addon으로 추가.
module "ebs_csi_irsa" {
  source  = "terraform-aws-modules/iam/aws//modules/iam-role-for-service-accounts-eks"
  version = "~> 5.0"

  role_name             = "team1-ebs-csi-irsa"
  attach_ebs_csi_policy = true

  oidc_providers = {
    main = {
      provider_arn               = module.eks.oidc_provider_arn
      namespace_service_accounts = ["kube-system:ebs-csi-controller-sa"]
    }
  }
}

resource "aws_eks_addon" "ebs_csi" {
  cluster_name             = module.eks.cluster_name
  addon_name               = "aws-ebs-csi-driver"
  service_account_role_arn = module.ebs_csi_irsa.iam_role_arn

  depends_on = [module.eks]
}

# gp3 StorageClass — Prometheus/Grafana PVC 기본값 (gp2보다 저렴하고 빠름)
resource "kubernetes_storage_class_v1" "gp3" {
  metadata {
    name = "gp3"
    annotations = {
      "storageclass.kubernetes.io/is-default-class" = "true"
    }
  }

  storage_provisioner    = "ebs.csi.aws.com"
  volume_binding_mode    = "WaitForFirstConsumer"
  allow_volume_expansion = true

  parameters = {
    type      = "gp3"
    encrypted = "true"
  }

  depends_on = [aws_eks_addon.ebs_csi]
}

# --- 네임스페이스 --------------------------------------------------------
resource "kubernetes_namespace" "monitoring" {
  metadata {
    name = "monitoring"
  }

  depends_on = [module.eks]
}

# --- Grafana admin 비밀번호 (Secrets Manager) ----------------------------
# 민감정보는 Secrets Manager에 두고, external-secrets가 k8s Secret으로
# 동기화(infra/k8s/monitoring-secret-store.yaml) — team1-backend와 동일 패턴
resource "aws_secretsmanager_secret" "grafana_admin" {
  name = "team1/monitoring/grafana-admin"
}

resource "aws_secretsmanager_secret_version" "grafana_admin" {
  secret_id = aws_secretsmanager_secret.grafana_admin.id
  secret_string = jsonencode({
    admin-user     = var.grafana_admin_user
    admin-password = var.grafana_admin_password
  })
}

# --- Grafana -> CloudWatch 조회용 IRSA -----------------------------------
# Grafana 공식 문서가 권장하는 CloudWatch 데이터소스 최소 조회 권한
data "aws_iam_policy_document" "grafana_cloudwatch_access" {
  statement {
    actions = [
      "cloudwatch:GetMetricData",
      "cloudwatch:GetMetricStatistics",
      "cloudwatch:ListMetrics",
      "cloudwatch:DescribeAlarms",
      "cloudwatch:DescribeAlarmsForMetric",
      "cloudwatch:GetInsightRuleReport",
      "tag:GetResources",
      "ec2:DescribeTags",
      "ec2:DescribeInstances",
      "ec2:DescribeRegions",
    ]
    resources = ["*"]
  }
}

resource "aws_iam_policy" "grafana_cloudwatch_access" {
  name   = "team1-grafana-cloudwatch-policy"
  policy = data.aws_iam_policy_document.grafana_cloudwatch_access.json
}

module "grafana_irsa" {
  source  = "terraform-aws-modules/iam/aws//modules/iam-role-for-service-accounts-eks"
  version = "~> 5.0"

  role_name = "team1-grafana-irsa"

  oidc_providers = {
    main = {
      provider_arn               = module.eks.oidc_provider_arn
      namespace_service_accounts = ["monitoring:grafana"]
    }
  }
}

resource "aws_iam_role_policy_attachment" "grafana_cloudwatch" {
  role       = module.grafana_irsa.iam_role_name
  policy_arn = aws_iam_policy.grafana_cloudwatch_access.arn
}

# --- monitoring 네임스페이스의 ExternalSecret용 IRSA ----------------------
# grafana-admin 시크릿 하나만 읽을 수 있는 최소 권한
data "aws_iam_policy_document" "monitoring_secrets_access" {
  statement {
    actions   = ["secretsmanager:GetSecretValue"]
    resources = [aws_secretsmanager_secret.grafana_admin.arn]
  }
}

resource "aws_iam_policy" "monitoring_secrets_access" {
  name   = "team1-monitoring-secrets-policy"
  policy = data.aws_iam_policy_document.monitoring_secrets_access.json
}

module "monitoring_secrets_irsa" {
  source  = "terraform-aws-modules/iam/aws//modules/iam-role-for-service-accounts-eks"
  version = "~> 5.0"

  role_name = "team1-monitoring-secrets-irsa"

  oidc_providers = {
    main = {
      provider_arn               = module.eks.oidc_provider_arn
      namespace_service_accounts = ["monitoring:monitoring-secrets-sa"]
    }
  }
}

resource "aws_iam_role_policy_attachment" "monitoring_secrets" {
  role       = module.monitoring_secrets_irsa.iam_role_name
  policy_arn = aws_iam_policy.monitoring_secrets_access.arn
}

# --- kube-prometheus-stack (Prometheus + Alertmanager + Grafana) --------
resource "helm_release" "kube_prometheus_stack" {
  name       = "kube-prometheus-stack"
  repository = "https://prometheus-community.github.io/helm-charts"
  chart      = "kube-prometheus-stack"
  version    = "~> 87.19"
  namespace  = kubernetes_namespace.monitoring.metadata[0].name
  timeout    = 600

  values = [
    templatefile("${path.module}/monitoring-values/kube-prometheus-stack.yaml.tpl", {
      grafana_irsa_role_arn = module.grafana_irsa.iam_role_arn
    })
  ]

  depends_on = [
    module.eks,
    aws_eks_addon.ebs_csi,
    kubernetes_storage_class_v1.gp3,
    kubernetes_namespace.monitoring,
  ]
}
