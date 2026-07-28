# IRSA(IAM Roles for Service Accounts) 구성

# Secrets Manager: team1/backend/secrets 시크릿만 읽기 허용 (최소 권한)
data "aws_iam_policy_document" "secrets_access" {
  statement {
    actions   = ["secretsmanager:GetSecretValue"]
    resources = [aws_secretsmanager_secret.backend.arn]
  }
}

resource "aws_iam_policy" "secrets_access" {
  name   = "team1-secrets-manager-policy"
  policy = data.aws_iam_policy_document.secrets_access.json
}

# default 네임스페이스의 team1-backend-sa ServiceAccount만 사용 가능한 역할
module "backend_irsa" {
  source  = "terraform-aws-modules/iam/aws//modules/iam-role-for-service-accounts-eks"
  version = "~> 5.0"

  role_name = "team1-backend-irsa"

  oidc_providers = {
    main = {
      provider_arn               = module.eks.oidc_provider_arn
      namespace_service_accounts = ["default:team1-backend-sa"]
    }
  }
}

resource "aws_iam_role_policy_attachment" "backend_secrets" {
  role       = module.backend_irsa.iam_role_name
  policy_arn = aws_iam_policy.secrets_access.arn
}

# AWS Load Balancer Controller 전용 IAM 정책 + IRSA 역할

# 필요한 권한 목록이 길고 자주 바뀌므로 AWS 공식 정책 문서를 그대로 사용
data "http" "alb_iam_policy" {
  url = "https://raw.githubusercontent.com/kubernetes-sigs/aws-load-balancer-controller/v2.13.4/docs/install/iam_policy.json"
}

resource "aws_iam_policy" "alb_controller" {
  name   = "team1-alb-controller-policy"
  policy = data.http.alb_iam_policy.response_body
}

module "alb_controller_irsa" {
  source  = "terraform-aws-modules/iam/aws//modules/iam-role-for-service-accounts-eks"
  version = "~> 5.0"

  role_name = "team1-alb-controller-irsa"

  oidc_providers = {
    main = {
      provider_arn               = module.eks.oidc_provider_arn
      namespace_service_accounts = ["kube-system:aws-load-balancer-controller"]
    }
  }
}

resource "aws_iam_role_policy_attachment" "alb_controller" {
  role       = module.alb_controller_irsa.iam_role_name
  policy_arn = aws_iam_policy.alb_controller.arn
}

# Parameter Store 읽기 권한: /team1/backend/ 경로 아래만 최소 권한으로 허용
data "aws_iam_policy_document" "parameter_store_access" {
  statement {
    actions = [
      "ssm:GetParameter",
      "ssm:GetParameters",
      "ssm:GetParametersByPath"
    ]
    resources = ["arn:aws:ssm:ap-northeast-2:727646470302:parameter/team1/backend/*"]
  }
}

resource "aws_iam_policy" "parameter_store_access" {
  name   = "team1-parameter-store-policy"
  policy = data.aws_iam_policy_document.parameter_store_access.json
}

resource "aws_iam_role_policy_attachment" "backend_parameter_store" {
  role       = module.backend_irsa.iam_role_name
  policy_arn = aws_iam_policy.parameter_store_access.arn
}

# EKS 클러스터 접근 권한(Access Entry) 등록
# bootstrap_cluster_creator_admin_permissions = false이므로
# 클러스터를 만든 사용자에게도 이 단계를 명시적으로 추가해야 함
data "aws_caller_identity" "current" {}

resource "aws_eks_access_entry" "admin" {
  cluster_name  = module.eks.cluster_name
  principal_arn = data.aws_caller_identity.current.arn
  type          = "STANDARD"
}

resource "aws_eks_access_policy_association" "admin" {
  cluster_name  = module.eks.cluster_name
  principal_arn = data.aws_caller_identity.current.arn
  policy_arn    = "arn:aws:eks::aws:cluster-access-policy/AmazonEKSClusterAdminPolicy"

  access_scope {
    type = "cluster"
  }
}

# 학생 IAM 계정용 EKS 접근 권한(Access Entry) 등록
# IAM 사용자 자체는 Terraform 밖(조직 계정 관리)에서 이미 생성되어 있으므로
# ARN만 조합해서 참조함
resource "aws_eks_access_entry" "students" {
  for_each = toset(var.student_users)

  cluster_name  = module.eks.cluster_name
  principal_arn = "arn:aws:iam::${data.aws_caller_identity.current.account_id}:user/${each.value}"
  type          = "STANDARD"
}

resource "aws_eks_access_policy_association" "students" {
  for_each = toset(var.student_users)

  cluster_name  = module.eks.cluster_name
  principal_arn = aws_eks_access_entry.students[each.key].principal_arn
  policy_arn    = "arn:aws:eks::aws:cluster-access-policy/AmazonEKSClusterAdminPolicy"

  access_scope {
    type = "cluster"
  }
}

# S3 프로필 버킷 접근 권한: team1-s3-profile 버킷에만 읽기/쓰기 허용
data "aws_iam_policy_document" "s3_profile_access" {
  statement {
    actions = [
      "s3:PutObject",
      "s3:GetObject",
      "s3:DeleteObject"
    ]
    resources = ["arn:aws:s3:::team1-s3-profile/*"]
  }

  statement {
    actions   = ["s3:ListBucket"]
    resources = ["arn:aws:s3:::team1-s3-profile"]
  }
}

resource "aws_iam_policy" "s3_profile_access" {
  name   = "team1-s3-profile-policy"
  policy = data.aws_iam_policy_document.s3_profile_access.json
}

resource "aws_iam_role_policy_attachment" "backend_s3_profile" {
  role       = module.backend_irsa.iam_role_name
  policy_arn = aws_iam_policy.s3_profile_access.arn
}
