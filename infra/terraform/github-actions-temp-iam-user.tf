# 임시 방편: GitHub Actions OIDC(token.actions.githubusercontent.com)로 역할을
# assume하는 게 계정 SCP에 막혀있어서(AccessDenied), 관리자 확인 전까지
# 액세스키 방식으로 대체함. 기존 IAM 정책(github_actions_ecr, github_actions_frontend)은
# 그대로 재사용하고, 이 IAM 사용자만 추가로 만듦.
#
# ⚠️ SCP 문제 해결되면 이 파일과 GitHub Secrets(AWS_*_ACCESS_KEY_ID/SECRET_ACCESS_KEY)를
#    삭제하고 다시 OIDC(role-to-assume) 방식으로 되돌릴 것

resource "aws_iam_user" "github_actions_backend_ci" {
  name = "team1-github-actions-backend-ci"
}

resource "aws_iam_user_policy_attachment" "backend_ci_ecr" {
  user       = aws_iam_user.github_actions_backend_ci.name
  policy_arn = aws_iam_policy.github_actions_ecr.arn
}

resource "aws_eks_access_entry" "backend_ci" {
  cluster_name  = module.eks.cluster_name
  principal_arn = aws_iam_user.github_actions_backend_ci.arn
  type          = "STANDARD"
}

resource "aws_eks_access_policy_association" "backend_ci" {
  cluster_name  = module.eks.cluster_name
  principal_arn = aws_iam_user.github_actions_backend_ci.arn
  policy_arn    = "arn:aws:eks::aws:cluster-access-policy/AmazonEKSEditPolicy"

  access_scope {
    type       = "namespace"
    namespaces = ["default"]
  }
}

resource "aws_iam_access_key" "backend_ci" {
  user = aws_iam_user.github_actions_backend_ci.name
}

resource "aws_iam_user" "github_actions_frontend_ci" {
  name = "team1-github-actions-frontend-ci"
}

resource "aws_iam_user_policy_attachment" "frontend_ci" {
  user       = aws_iam_user.github_actions_frontend_ci.name
  policy_arn = aws_iam_policy.github_actions_frontend.arn
}

resource "aws_iam_access_key" "frontend_ci" {
  user = aws_iam_user.github_actions_frontend_ci.name
}

output "backend_ci_access_key_id" {
  value = aws_iam_access_key.backend_ci.id
}

output "backend_ci_secret_access_key" {
  value     = aws_iam_access_key.backend_ci.secret
  sensitive = true
}

output "frontend_ci_access_key_id" {
  value = aws_iam_access_key.frontend_ci.id
}

output "frontend_ci_secret_access_key" {
  value     = aws_iam_access_key.frontend_ci.secret
  sensitive = true
}
