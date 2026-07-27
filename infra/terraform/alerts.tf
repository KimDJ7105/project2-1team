# CloudWatch Alarm — dashboard.tf와 동일한 5개 계층(ALB -> EKS -> RDS ->
# ElastiCache -> CloudFront)에서 현업에서 가장 널리 쓰는 golden-signal 지표에 알람을 건다.
# ALB/EKS/RDS/ElastiCache 알람은 리소스가 있는 서울 리전, CloudFront 알람은
# 지표 자체가 us-east-1에만 존재해서 별도 provider(aws.us_east_1)로 생성함.

# --- 알림 채널 (SNS -> 이메일 구독) ---------------------------------------
resource "aws_sns_topic" "alerts" {
  name = "team1-cloudwatch-alerts"
}

resource "aws_sns_topic_subscription" "alerts_email" {
  topic_arn = aws_sns_topic.alerts.arn
  protocol  = "email"
  endpoint  = var.alert_email
}

# CloudFront 알람은 us-east-1에 있어야 하고, CloudWatch Alarm의 알림 대상
# SNS Topic도 알람과 같은 리전에 있어야 하므로 별도로 하나 더 둠
resource "aws_sns_topic" "alerts_use1" {
  provider = aws.us_east_1
  name     = "team1-cloudwatch-alerts"
}

resource "aws_sns_topic_subscription" "alerts_email_use1" {
  provider  = aws.us_east_1
  topic_arn = aws_sns_topic.alerts_use1.arn
  protocol  = "email"
  endpoint  = var.alert_email
}

# --- ALB (RED) -------------------------------------------------------------
resource "aws_cloudwatch_metric_alarm" "alb_target_5xx" {
  alarm_name          = "team1-alb-target-5xx-high"
  alarm_description   = "백엔드(타겟)가 5xx를 반환하는 비율이 높음"
  namespace           = "AWS/ApplicationELB"
  metric_name         = "HTTPCode_Target_5XX_Count"
  dimensions          = { LoadBalancer = data.aws_lb.team1_backend.arn_suffix }
  statistic           = "Sum"
  period              = 300
  evaluation_periods  = 1
  threshold           = 10
  comparison_operator = "GreaterThanOrEqualToThreshold"
  treat_missing_data  = "notBreaching"

  alarm_actions = [aws_sns_topic.alerts.arn]
  ok_actions    = [aws_sns_topic.alerts.arn]
}

resource "aws_cloudwatch_metric_alarm" "alb_elb_5xx" {
  alarm_name          = "team1-alb-elb-5xx-high"
  alarm_description   = "ALB 자체가 5xx(주로 타겟 연결 실패)를 반환하는 비율이 높음"
  namespace           = "AWS/ApplicationELB"
  metric_name         = "HTTPCode_ELB_5XX_Count"
  dimensions          = { LoadBalancer = data.aws_lb.team1_backend.arn_suffix }
  statistic           = "Sum"
  period              = 300
  evaluation_periods  = 1
  threshold           = 10
  comparison_operator = "GreaterThanOrEqualToThreshold"
  treat_missing_data  = "notBreaching"

  alarm_actions = [aws_sns_topic.alerts.arn]
  ok_actions    = [aws_sns_topic.alerts.arn]
}

resource "aws_cloudwatch_metric_alarm" "alb_latency_p99" {
  alarm_name          = "team1-alb-latency-p99-high"
  alarm_description   = "응답 지연시간(p99)이 2초를 초과함"
  namespace           = "AWS/ApplicationELB"
  metric_name         = "TargetResponseTime"
  dimensions          = { LoadBalancer = data.aws_lb.team1_backend.arn_suffix }
  extended_statistic  = "p99"
  period              = 60
  evaluation_periods  = 3
  threshold           = 2
  comparison_operator = "GreaterThanThreshold"
  treat_missing_data  = "notBreaching"

  alarm_actions = [aws_sns_topic.alerts.arn]
  ok_actions    = [aws_sns_topic.alerts.arn]
}

resource "aws_cloudwatch_metric_alarm" "alb_unhealthy_hosts" {
  alarm_name        = "team1-alb-unhealthy-hosts"
  alarm_description = "비정상(Unhealthy) 타겟이 1개 이상 존재함"
  namespace         = "AWS/ApplicationELB"
  metric_name       = "UnHealthyHostCount"
  dimensions = {
    LoadBalancer = data.aws_lb.team1_backend.arn_suffix
    TargetGroup  = data.aws_lb_target_group.team1_backend.arn_suffix
  }
  statistic           = "Maximum"
  period              = 60
  evaluation_periods  = 2
  threshold           = 1
  comparison_operator = "GreaterThanOrEqualToThreshold"
  treat_missing_data  = "notBreaching"

  alarm_actions = [aws_sns_topic.alerts.arn]
  ok_actions    = [aws_sns_topic.alerts.arn]
}

# --- EKS (USE) ---------------------------------------------------------
resource "aws_cloudwatch_metric_alarm" "eks_node_cpu_high" {
  alarm_name          = "team1-eks-node-cpu-high"
  alarm_description   = "워커노드 평균 CPU 사용률이 80%를 초과함"
  namespace           = "ContainerInsights"
  metric_name         = "node_cpu_utilization"
  dimensions          = { ClusterName = module.eks.cluster_name }
  statistic           = "Average"
  period              = 300
  evaluation_periods  = 3
  threshold           = 80
  comparison_operator = "GreaterThanThreshold"
  treat_missing_data  = "notBreaching"

  alarm_actions = [aws_sns_topic.alerts.arn]
  ok_actions    = [aws_sns_topic.alerts.arn]
}

resource "aws_cloudwatch_metric_alarm" "eks_node_memory_high" {
  alarm_name          = "team1-eks-node-memory-high"
  alarm_description   = "워커노드 평균 메모리 사용률이 80%를 초과함"
  namespace           = "ContainerInsights"
  metric_name         = "node_memory_utilization"
  dimensions          = { ClusterName = module.eks.cluster_name }
  statistic           = "Average"
  period              = 300
  evaluation_periods  = 3
  threshold           = 80
  comparison_operator = "GreaterThanThreshold"
  treat_missing_data  = "notBreaching"

  alarm_actions = [aws_sns_topic.alerts.arn]
  ok_actions    = [aws_sns_topic.alerts.arn]
}

resource "aws_cloudwatch_metric_alarm" "eks_failed_nodes" {
  alarm_name          = "team1-eks-failed-nodes"
  alarm_description   = "실패한(Failed) 워커노드가 1개 이상 존재함"
  namespace           = "ContainerInsights"
  metric_name         = "cluster_failed_node_count"
  dimensions          = { ClusterName = module.eks.cluster_name }
  statistic           = "Sum"
  period              = 300
  evaluation_periods  = 1
  threshold           = 1
  comparison_operator = "GreaterThanOrEqualToThreshold"
  treat_missing_data  = "notBreaching"

  alarm_actions = [aws_sns_topic.alerts.arn]
  ok_actions    = [aws_sns_topic.alerts.arn]
}

resource "aws_cloudwatch_metric_alarm" "backend_pod_restarts" {
  alarm_name        = "team1-backend-pod-restarts-high"
  alarm_description = "team1-backend 파드 컨테이너 재시작 횟수가 급증함 (크래시루프 의심)"
  namespace         = "ContainerInsights"
  metric_name       = "pod_number_of_container_restarts"
  dimensions = {
    ClusterName = module.eks.cluster_name
    Namespace   = "default"
    PodName     = "team1-backend"
  }
  statistic           = "Sum"
  period              = 300
  evaluation_periods  = 1
  threshold           = 3
  comparison_operator = "GreaterThanOrEqualToThreshold"
  treat_missing_data  = "notBreaching"

  alarm_actions = [aws_sns_topic.alerts.arn]
  ok_actions    = [aws_sns_topic.alerts.arn]
}

# --- RDS -----------------------------------------------------------------
resource "aws_cloudwatch_metric_alarm" "rds_cpu_high" {
  alarm_name          = "team1-rds-cpu-high"
  alarm_description   = "RDS CPU 사용률이 80%를 초과함"
  namespace           = "AWS/RDS"
  metric_name         = "CPUUtilization"
  dimensions          = { DBInstanceIdentifier = aws_db_instance.team1_rds_data.identifier }
  statistic           = "Average"
  period              = 300
  evaluation_periods  = 3
  threshold           = 80
  comparison_operator = "GreaterThanThreshold"
  treat_missing_data  = "notBreaching"

  alarm_actions = [aws_sns_topic.alerts.arn]
  ok_actions    = [aws_sns_topic.alerts.arn]
}

resource "aws_cloudwatch_metric_alarm" "rds_storage_low" {
  alarm_name          = "team1-rds-free-storage-low"
  alarm_description   = "RDS 여유 스토리지가 2GiB 미만으로 떨어짐 (현재 할당 20GiB 기준)"
  namespace           = "AWS/RDS"
  metric_name         = "FreeStorageSpace"
  dimensions          = { DBInstanceIdentifier = aws_db_instance.team1_rds_data.identifier }
  statistic           = "Average"
  period              = 300
  evaluation_periods  = 1
  threshold           = 2 * 1024 * 1024 * 1024
  comparison_operator = "LessThanThreshold"
  treat_missing_data  = "notBreaching"

  alarm_actions = [aws_sns_topic.alerts.arn]
  ok_actions    = [aws_sns_topic.alerts.arn]
}

resource "aws_cloudwatch_metric_alarm" "rds_connections_high" {
  alarm_name          = "team1-rds-connections-high"
  alarm_description   = "RDS 커넥션 수가 db.t3.micro 최대치(약 66)에 근접함"
  namespace           = "AWS/RDS"
  metric_name         = "DatabaseConnections"
  dimensions          = { DBInstanceIdentifier = aws_db_instance.team1_rds_data.identifier }
  statistic           = "Average"
  period              = 300
  evaluation_periods  = 3
  threshold           = 50
  comparison_operator = "GreaterThanThreshold"
  treat_missing_data  = "notBreaching"

  alarm_actions = [aws_sns_topic.alerts.arn]
  ok_actions    = [aws_sns_topic.alerts.arn]
}

# --- ElastiCache Redis -----------------------------------------------------
# 노드마다(Primary + Replica 2개) 각각 알람을 둠 — 한 노드만 봐서는 놓치는 문제를 방지
resource "aws_cloudwatch_metric_alarm" "redis_cpu_high" {
  for_each = aws_elasticache_replication_group.team1_redis_v2.member_clusters

  alarm_name          = "team1-redis-${each.value}-cpu-high"
  alarm_description   = "Redis 노드(${each.value}) CPU 사용률이 75%를 초과함"
  namespace           = "AWS/ElastiCache"
  metric_name         = "CPUUtilization"
  dimensions          = { CacheClusterId = each.value }
  statistic           = "Average"
  period              = 300
  evaluation_periods  = 3
  threshold           = 75
  comparison_operator = "GreaterThanThreshold"
  treat_missing_data  = "notBreaching"

  alarm_actions = [aws_sns_topic.alerts.arn]
  ok_actions    = [aws_sns_topic.alerts.arn]
}

resource "aws_cloudwatch_metric_alarm" "redis_evictions" {
  for_each = aws_elasticache_replication_group.team1_redis_v2.member_clusters

  alarm_name          = "team1-redis-${each.value}-evictions"
  alarm_description   = "Redis 노드(${each.value})에서 메모리 부족으로 키가 축출(eviction)되고 있음"
  namespace           = "AWS/ElastiCache"
  metric_name         = "Evictions"
  dimensions          = { CacheClusterId = each.value }
  statistic           = "Sum"
  period              = 300
  evaluation_periods  = 1
  threshold           = 0
  comparison_operator = "GreaterThanThreshold"
  treat_missing_data  = "notBreaching"

  alarm_actions = [aws_sns_topic.alerts.arn]
  ok_actions    = [aws_sns_topic.alerts.arn]
}

resource "aws_cloudwatch_metric_alarm" "redis_memory_low" {
  for_each = aws_elasticache_replication_group.team1_redis_v2.member_clusters

  alarm_name          = "team1-redis-${each.value}-freeable-memory-low"
  alarm_description   = "Redis 노드(${each.value}) 가용 메모리가 50MiB 미만 (cache.t3.micro 총 0.5GiB 기준)"
  namespace           = "AWS/ElastiCache"
  metric_name         = "FreeableMemory"
  dimensions          = { CacheClusterId = each.value }
  statistic           = "Average"
  period              = 300
  evaluation_periods  = 3
  threshold           = 50 * 1024 * 1024
  comparison_operator = "LessThanThreshold"
  treat_missing_data  = "notBreaching"

  alarm_actions = [aws_sns_topic.alerts.arn]
  ok_actions    = [aws_sns_topic.alerts.arn]
}

# --- CloudFront (us-east-1 전용) --------------------------------------------
resource "aws_cloudwatch_metric_alarm" "cloudfront_5xx" {
  provider = aws.us_east_1

  alarm_name        = "team1-cloudfront-5xx-error-rate-high"
  alarm_description = "CloudFront 5xx 에러율이 1%를 초과함"
  namespace         = "AWS/CloudFront"
  metric_name       = "5xxErrorRate"
  dimensions = {
    DistributionId = aws_cloudfront_distribution.frontend.id
    Region         = "Global"
  }
  statistic           = "Average"
  period              = 300
  evaluation_periods  = 3
  threshold           = 1
  comparison_operator = "GreaterThanThreshold"
  treat_missing_data  = "notBreaching"

  alarm_actions = [aws_sns_topic.alerts_use1.arn]
  ok_actions    = [aws_sns_topic.alerts_use1.arn]
}
