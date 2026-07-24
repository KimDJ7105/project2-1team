# CloudWatch 대시보드: ALB(RED) -> EKS 노드/파드(USE) -> RDS -> ElastiCache -> CloudFront
# -> 백엔드 에러 로그 순서로 구성한 종합 모니터링 대시보드

# ALB/타겟그룹은 AWS Load Balancer Controller가 Ingress를 보고 직접 생성하므로
# terraform 리소스가 아니라 data source로 조회함
data "aws_lb" "team1_backend" {
  name = "k8s-default-team1bac-e659117ec8"
}

data "aws_lb_target_group" "team1_backend" {
  name = "k8s-default-team1bac-c79d8c42b2"
}

resource "aws_cloudwatch_dashboard" "team1_backend" {
  dashboard_name = "team1-backend-overview"

  dashboard_body = templatefile("${path.module}/dashboards/team1-backend-overview.json.tpl", {
    region          = "ap-northeast-2"
    cluster_name    = module.eks.cluster_name
    alb_arn_suffix  = data.aws_lb.team1_backend.arn_suffix
    tg_arn_suffix   = data.aws_lb_target_group.team1_backend.arn_suffix
    rds_id          = "team1-rds"
    redis_cluster_1 = "team1-elasticache-redis-001"
    redis_cluster_2 = "team1-elasticache-redis-002"
    redis_cluster_3 = "team1-elasticache-redis-003"
    cloudfront_id   = "E2DY5SXDS0HIEB"
    log_group       = "/aws/containerinsights/${module.eks.cluster_name}/application"
  })
}
