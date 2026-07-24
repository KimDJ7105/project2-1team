# GitHub Actions가 AWS(ECR push, EKS 배포)에 접근하기 위한 OIDC 연동
# (장기 액세스키 없이, prod 브랜치로의 push 워크플로우만 임시 자격증명 발급 가능)

# 이 AWS 계정은 여러 팀이 공유하는 계정이라 GitHub OIDC Provider가 이미
# 다른 팀(또는 이전 실습)에서 생성되어 있음. 여기서 다시 만들면(resource)
# terraform destroy 시 다른 팀이 쓰는 공유 Provider까지 같이 지워질 위험이
# 있으므로, 소유권 없이 조회만 하는 data source로 참조함
data "aws_iam_openid_connect_provider" "github_actions" {
  url = "https://token.actions.githubusercontent.com"
}

# --------------------------------------------------
# 배포 전용 IAM 역할
# prod 브랜치에 대한 push로 트리거된 워크플로우만 이 역할을 assume할 수 있음
# (pull_request로 트리거된 워크플로우는 sub 클레임 형식이 달라서 assume 불가)
# 버전 태그는 사람이 push하는 게 아니라 deploy.yml이 배포 때마다 ECR 안에서
# 자동으로 계산해서 붙이므로, 태그 push 트리거용 조건은 필요 없음
# --------------------------------------------------
data "aws_iam_policy_document" "github_actions_trust" {
  statement {
    actions = ["sts:AssumeRoleWithWebIdentity"]

    principals {
      type        = "Federated"
      identifiers = [data.aws_iam_openid_connect_provider.github_actions.arn]
    }

    condition {
      test     = "StringEquals"
      variable = "token.actions.githubusercontent.com:aud"
      values   = ["sts.amazonaws.com"]
    }

    condition {
      test     = "StringLike"
      variable = "token.actions.githubusercontent.com:sub"
      values   = ["repo:KimDJ7105/project2-1team:ref:refs/heads/prod"]
    }
  }
}

resource "aws_iam_role" "github_actions_deploy" {
  name               = "team1-github-actions-deploy"
  assume_role_policy = data.aws_iam_policy_document.github_actions_trust.json
}

# --------------------------------------------------
# ECR 권한: 기존 team1/ecr 저장소에만 push 허용
# (이 저장소는 terraform 밖에서 이미 만들어져 있으므로 data source로 참조)
# --------------------------------------------------
data "aws_ecr_repository" "team1" {
  name = "team1/ecr"
}

data "aws_iam_policy_document" "github_actions_ecr" {
  statement {
    # GetAuthorizationToken은 리소스 수준 권한을 지원하지 않는 액션이라 "*" 필수
    actions   = ["ecr:GetAuthorizationToken"]
    resources = ["*"]
  }

  statement {
    actions = [
      "ecr:BatchCheckLayerAvailability",
      "ecr:GetDownloadUrlForLayer",
      "ecr:BatchGetImage",
      "ecr:PutImage",
      "ecr:InitiateLayerUpload",
      "ecr:UploadLayerPart",
      "ecr:CompleteLayerUpload",
      "ecr:DescribeImages", # 배포 시 기존 vX.Y.Z 태그를 조회해 다음 버전을 자동 계산하기 위해 필요
    ]
    resources = [data.aws_ecr_repository.team1.arn]
  }
}

resource "aws_iam_policy" "github_actions_ecr" {
  name   = "team1-github-actions-ecr-policy"
  policy = data.aws_iam_policy_document.github_actions_ecr.json
}

resource "aws_iam_role_policy_attachment" "github_actions_ecr" {
  role       = aws_iam_role.github_actions_deploy.name
  policy_arn = aws_iam_policy.github_actions_ecr.arn
}

# --------------------------------------------------
# EKS 접근 권한: default 네임스페이스에 한정된 편집 권한만 부여
# (기존 iam.tf의 admin access entry 패턴을 따르되, cluster-admin이 아닌
#  namespace 범위로 최소 권한만 부여)
# --------------------------------------------------
resource "aws_eks_access_entry" "github_actions_deploy" {
  cluster_name  = module.eks.cluster_name
  principal_arn = aws_iam_role.github_actions_deploy.arn
  type          = "STANDARD"
}

resource "aws_eks_access_policy_association" "github_actions_deploy" {
  cluster_name  = module.eks.cluster_name
  principal_arn = aws_iam_role.github_actions_deploy.arn
  policy_arn    = "arn:aws:eks::aws:cluster-access-policy/AmazonEKSEditPolicy"

  access_scope {
    type       = "namespace"
    namespaces = ["default"]
  }
}
