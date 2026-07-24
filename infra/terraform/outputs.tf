# terraform apply 완료 후 콘솔에 출력할 값들

output "backend_irsa_role_arn" {
  description = "team1-backend-sa가 사용할 IAM 역할 ARN"
  value       = module.backend_irsa.iam_role_arn
}

output "cluster_endpoint" {
  description = "EKS 클러스터 API 서버 주소"
  value       = module.eks.cluster_endpoint
}

output "github_actions_deploy_role_arn" {
  description = "GitHub Actions 배포 워크플로우가 assume할 IAM 역할 ARN (repo Variables에 등록)"
  value       = aws_iam_role.github_actions_deploy.arn
}
