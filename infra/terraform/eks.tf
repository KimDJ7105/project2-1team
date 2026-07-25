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

  # 워커노드 그룹 (기존 EC2 ASG 역할 대체)
  eks_managed_node_groups = {
    team1_backend = {
      name           = "team1-eks-nodegroup"
      instance_types = ["t3.medium"]
      min_size       = 1
      max_size       = 3
      desired_size   = 2
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
  }
}
