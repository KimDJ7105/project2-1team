# EKS 클러스터 + 워커노드 (terraform-aws-modules 사용)

module "eks" {
  source  = "terraform-aws-modules/eks/aws"
  version = "~> 20.0"

  cluster_name    = var.cluster_name
  cluster_version = var.cluster_version

  cluster_endpoint_public_access  = true # 로컬에서 kubectl 접속 허용
  cluster_endpoint_private_access = true # 클러스터 내부 통신용

  vpc_id     = var.vpc_id
  subnet_ids = var.private_subnet_ids # 기존 Private 서브넷 재사용

  enable_irsa = true # Pod별 IAM 권한 부여(IRSA) 기능 활성화

  # kube-proxy/coredns/vpc-cni를 관리형 애드온으로 등록.
  # 등록 안 하면 클러스터 최초 생성 시 부트스트랩된 버전으로 방치되어
  # (1.30 → 1.36으로 여러 번 업그레이드해도 안 따라옴) 버전이 계속 뒤처짐.
  # kube-proxy는 이미 EKS 콘솔 "업그레이드 인사이트"에 skew ERROR로 표시된 상태였고,
  # coredns/vpc-cni는 EKS가 별도 skew 체크를 안 해서 눈에 안 띄었을 뿐 동일하게 뒤처져 있었음.
  # addon_version을 지정하지 않으면 클러스터 버전에 맞는 AWS 기본(default) 권장 버전을
  # 자동으로 선택하므로, 이후 cluster_version을 올릴 때마다 같이 따라감
  cluster_addons = {
    kube-proxy = {}
    coredns    = {}
    vpc-cni    = {}
  }

  # 워커노드 그룹 (기존 EC2 ASG 역할 대체)
  eks_managed_node_groups = {
    team1_backend = {
      name           = "team1-eks-nodegroup"
      instance_types = ["t3.medium"]
      min_size       = 1
      max_size       = 4
      desired_size   = 4 # ebs-csi-node DaemonSet까지 추가되며 노드 하나가 17 pod 한도에 다시 도달해 1대 더 늘림
      subnet_ids     = var.private_subnet_ids

      # CloudWatch Observability 애드온이 로그/지표를 전송하려면 필요
      # (없으면 AccessDenied: logs:PutLogEvents 에러 발생)
      iam_role_additional_policies = {
        CloudWatchAgentServerPolicy = "arn:aws:iam::aws:policy/CloudWatchAgentServerPolicy"
        # SSH 없이 Session Manager로 노드에 접속하기 위해 추가
        AmazonSSMManagedInstanceCore = "arn:aws:iam::aws:policy/AmazonSSMManagedInstanceCore"
      }
    }
  }

  tags = {
    Project = "team1-gomoku"
    Purpose = "team1-backend 게임 서버 파드와 모니터링 스택 Prometheus/Grafana를 구동하는 EKS 클러스터/워커노드"
  }
}
