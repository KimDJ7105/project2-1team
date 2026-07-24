{
  "widgets": [
    { "type": "text", "x": 0, "y": 0, "width": 24, "height": 1,
      "properties": { "markdown": "## ALB — 트래픽 / 에러 (RED: Rate, Errors, Duration)" } },

    { "type": "metric", "x": 0, "y": 1, "width": 6, "height": 6,
      "properties": {
        "title": "요청 수 (RequestCount)", "region": "${region}", "view": "timeSeries", "stacked": false,
        "metrics": [
          [ "AWS/ApplicationELB", "RequestCount", "LoadBalancer", "${alb_arn_suffix}", { "stat": "Sum", "period": 60 } ]
        ]
      } },
    { "type": "metric", "x": 6, "y": 1, "width": 6, "height": 6,
      "properties": {
        "title": "응답 지연시간 (TargetResponseTime)", "region": "${region}", "view": "timeSeries", "stacked": false,
        "metrics": [
          [ "AWS/ApplicationELB", "TargetResponseTime", "LoadBalancer", "${alb_arn_suffix}", { "stat": "p50", "label": "p50" } ],
          [ "AWS/ApplicationELB", "TargetResponseTime", "LoadBalancer", "${alb_arn_suffix}", { "stat": "p90", "label": "p90" } ],
          [ "AWS/ApplicationELB", "TargetResponseTime", "LoadBalancer", "${alb_arn_suffix}", { "stat": "p99", "label": "p99" } ]
        ]
      } },
    { "type": "metric", "x": 12, "y": 1, "width": 6, "height": 6,
      "properties": {
        "title": "HTTP 4xx / 5xx 에러", "region": "${region}", "view": "timeSeries", "stacked": false,
        "metrics": [
          [ "AWS/ApplicationELB", "HTTPCode_Target_4XX_Count", "LoadBalancer", "${alb_arn_suffix}", { "stat": "Sum", "label": "Target 4xx" } ],
          [ "AWS/ApplicationELB", "HTTPCode_Target_5XX_Count", "LoadBalancer", "${alb_arn_suffix}", { "stat": "Sum", "label": "Target 5xx" } ],
          [ "AWS/ApplicationELB", "HTTPCode_ELB_5XX_Count", "LoadBalancer", "${alb_arn_suffix}", { "stat": "Sum", "label": "ELB 5xx" } ]
        ]
      } },
    { "type": "metric", "x": 18, "y": 1, "width": 6, "height": 6,
      "properties": {
        "title": "정상/비정상 타겟 수", "region": "${region}", "view": "timeSeries", "stacked": false,
        "metrics": [
          [ "AWS/ApplicationELB", "HealthyHostCount", "TargetGroup", "${tg_arn_suffix}", "LoadBalancer", "${alb_arn_suffix}", { "stat": "Average", "label": "Healthy" } ],
          [ "AWS/ApplicationELB", "UnHealthyHostCount", "TargetGroup", "${tg_arn_suffix}", "LoadBalancer", "${alb_arn_suffix}", { "stat": "Average", "label": "Unhealthy" } ]
        ]
      } },

    { "type": "text", "x": 0, "y": 7, "width": 24, "height": 1,
      "properties": { "markdown": "## EKS 클러스터 — 노드 (USE: Utilization, Saturation, Errors)" } },

    { "type": "metric", "x": 0, "y": 8, "width": 8, "height": 6,
      "properties": {
        "title": "노드 CPU 사용률", "region": "${region}", "view": "timeSeries", "stacked": false,
        "metrics": [
          [ "ContainerInsights", "node_cpu_utilization", "ClusterName", "${cluster_name}", { "stat": "Average", "label": "Average" } ],
          [ "ContainerInsights", "node_cpu_utilization", "ClusterName", "${cluster_name}", { "stat": "Maximum", "label": "Max" } ]
        ]
      } },
    { "type": "metric", "x": 8, "y": 8, "width": 8, "height": 6,
      "properties": {
        "title": "노드 메모리 사용률", "region": "${region}", "view": "timeSeries", "stacked": false,
        "metrics": [
          [ "ContainerInsights", "node_memory_utilization", "ClusterName", "${cluster_name}", { "stat": "Average", "label": "Average" } ],
          [ "ContainerInsights", "node_memory_utilization", "ClusterName", "${cluster_name}", { "stat": "Maximum", "label": "Max" } ]
        ]
      } },
    { "type": "metric", "x": 16, "y": 8, "width": 8, "height": 6,
      "properties": {
        "title": "노드 수 / 실패 노드 수", "region": "${region}", "view": "timeSeries", "stacked": false,
        "metrics": [
          [ "ContainerInsights", "cluster_node_count", "ClusterName", "${cluster_name}", { "stat": "Average", "label": "Node Count" } ],
          [ "ContainerInsights", "cluster_failed_node_count", "ClusterName", "${cluster_name}", { "stat": "Sum", "label": "Failed Node Count" } ]
        ]
      } },

    { "type": "text", "x": 0, "y": 14, "width": 24, "height": 1,
      "properties": { "markdown": "## team1-backend 파드" } },

    { "type": "metric", "x": 0, "y": 15, "width": 6, "height": 6,
      "properties": {
        "title": "파드 CPU 사용률", "region": "${region}", "view": "timeSeries", "stacked": false,
        "metrics": [
          [ "ContainerInsights", "pod_cpu_utilization", "ClusterName", "${cluster_name}", "Namespace", "default", "PodName", "team1-backend", { "stat": "Average" } ]
        ]
      } },
    { "type": "metric", "x": 6, "y": 15, "width": 6, "height": 6,
      "properties": {
        "title": "파드 메모리 사용률", "region": "${region}", "view": "timeSeries", "stacked": false,
        "metrics": [
          [ "ContainerInsights", "pod_memory_utilization", "ClusterName", "${cluster_name}", "Namespace", "default", "PodName", "team1-backend", { "stat": "Average" } ]
        ]
      } },
    { "type": "metric", "x": 12, "y": 15, "width": 6, "height": 6,
      "properties": {
        "title": "컨테이너 재시작 횟수 (크래시루프 감지)", "region": "${region}", "view": "timeSeries", "stacked": false,
        "metrics": [
          [ "ContainerInsights", "pod_number_of_container_restarts", "ClusterName", "${cluster_name}", "Namespace", "default", "PodName", "team1-backend", { "stat": "Sum" } ]
        ]
      } },
    { "type": "metric", "x": 18, "y": 15, "width": 6, "height": 6,
      "properties": {
        "title": "실행 중인 파드 수", "region": "${region}", "view": "timeSeries", "stacked": false,
        "metrics": [
          [ "ContainerInsights", "service_number_of_running_pods", "ClusterName", "${cluster_name}", "Namespace", "default", "Service", "team1-backend-svc", { "stat": "Average" } ]
        ]
      } },

    { "type": "text", "x": 0, "y": 21, "width": 24, "height": 1,
      "properties": { "markdown": "## RDS (${rds_id})" } },

    { "type": "metric", "x": 0, "y": 22, "width": 6, "height": 6,
      "properties": {
        "title": "CPU 사용률", "region": "${region}", "view": "timeSeries", "stacked": false,
        "metrics": [
          [ "AWS/RDS", "CPUUtilization", "DBInstanceIdentifier", "${rds_id}", { "stat": "Average" } ]
        ]
      } },
    { "type": "metric", "x": 6, "y": 22, "width": 6, "height": 6,
      "properties": {
        "title": "DB 커넥션 수", "region": "${region}", "view": "timeSeries", "stacked": false,
        "metrics": [
          [ "AWS/RDS", "DatabaseConnections", "DBInstanceIdentifier", "${rds_id}", { "stat": "Average" } ]
        ]
      } },
    { "type": "metric", "x": 12, "y": 22, "width": 6, "height": 6,
      "properties": {
        "title": "가용 메모리 / 스토리지", "region": "${region}", "view": "timeSeries", "stacked": false,
        "metrics": [
          [ "AWS/RDS", "FreeableMemory", "DBInstanceIdentifier", "${rds_id}", { "stat": "Average", "label": "FreeableMemory" } ],
          [ "AWS/RDS", "FreeStorageSpace", "DBInstanceIdentifier", "${rds_id}", { "stat": "Average", "label": "FreeStorageSpace" } ]
        ]
      } },
    { "type": "metric", "x": 18, "y": 22, "width": 6, "height": 6,
      "properties": {
        "title": "읽기/쓰기 지연시간", "region": "${region}", "view": "timeSeries", "stacked": false,
        "metrics": [
          [ "AWS/RDS", "ReadLatency", "DBInstanceIdentifier", "${rds_id}", { "stat": "Average", "label": "Read" } ],
          [ "AWS/RDS", "WriteLatency", "DBInstanceIdentifier", "${rds_id}", { "stat": "Average", "label": "Write" } ]
        ]
      } },

    { "type": "text", "x": 0, "y": 28, "width": 24, "height": 1,
      "properties": { "markdown": "## ElastiCache Redis" } },

    { "type": "metric", "x": 0, "y": 29, "width": 6, "height": 6,
      "properties": {
        "title": "CPU 사용률 (노드별)", "region": "${region}", "view": "timeSeries", "stacked": false,
        "metrics": [
          [ "AWS/ElastiCache", "CPUUtilization", "CacheClusterId", "${redis_cluster_1}", { "stat": "Average", "label": "Primary" } ],
          [ "AWS/ElastiCache", "CPUUtilization", "CacheClusterId", "${redis_cluster_2}", { "stat": "Average", "label": "Replica 1" } ],
          [ "AWS/ElastiCache", "CPUUtilization", "CacheClusterId", "${redis_cluster_3}", { "stat": "Average", "label": "Replica 2" } ]
        ]
      } },
    { "type": "metric", "x": 6, "y": 29, "width": 6, "height": 6,
      "properties": {
        "title": "현재 커넥션 수", "region": "${region}", "view": "timeSeries", "stacked": false,
        "metrics": [
          [ "AWS/ElastiCache", "CurrConnections", "CacheClusterId", "${redis_cluster_1}", { "stat": "Average" } ]
        ]
      } },
    { "type": "metric", "x": 12, "y": 29, "width": 6, "height": 6,
      "properties": {
        "title": "캐시 히트율 (%)", "region": "${region}", "view": "timeSeries", "stacked": false,
        "metrics": [
          [ "AWS/ElastiCache", "CacheHitRate", "CacheClusterId", "${redis_cluster_1}", { "stat": "Average" } ]
        ]
      } },
    { "type": "metric", "x": 18, "y": 29, "width": 6, "height": 6,
      "properties": {
        "title": "Evictions / 가용 메모리", "region": "${region}", "view": "timeSeries", "stacked": false,
        "metrics": [
          [ "AWS/ElastiCache", "Evictions", "CacheClusterId", "${redis_cluster_1}", { "stat": "Sum", "label": "Evictions", "yAxis": "left" } ],
          [ "AWS/ElastiCache", "FreeableMemory", "CacheClusterId", "${redis_cluster_1}", { "stat": "Average", "label": "FreeableMemory", "yAxis": "right" } ]
        ]
      } },

    { "type": "text", "x": 0, "y": 35, "width": 24, "height": 1,
      "properties": { "markdown": "## 프론트엔드 (CloudFront — omok.jhyang.click)" } },

    { "type": "metric", "x": 0, "y": 36, "width": 8, "height": 6,
      "properties": {
        "title": "요청 수", "region": "us-east-1", "view": "timeSeries", "stacked": false,
        "metrics": [
          [ "AWS/CloudFront", "Requests", "DistributionId", "${cloudfront_id}", "Region", "Global", { "stat": "Sum" } ]
        ]
      } },
    { "type": "metric", "x": 8, "y": 36, "width": 8, "height": 6,
      "properties": {
        "title": "4xx / 5xx 에러율 (%)", "region": "us-east-1", "view": "timeSeries", "stacked": false,
        "metrics": [
          [ "AWS/CloudFront", "4xxErrorRate", "DistributionId", "${cloudfront_id}", "Region", "Global", { "stat": "Average", "label": "4xx" } ],
          [ "AWS/CloudFront", "5xxErrorRate", "DistributionId", "${cloudfront_id}", "Region", "Global", { "stat": "Average", "label": "5xx" } ]
        ]
      } },
    { "type": "metric", "x": 16, "y": 36, "width": 8, "height": 6,
      "properties": {
        "title": "오리진 응답 지연시간", "region": "us-east-1", "view": "timeSeries", "stacked": false,
        "metrics": [
          [ "AWS/CloudFront", "OriginLatency", "DistributionId", "${cloudfront_id}", "Region", "Global", { "stat": "Average" } ]
        ]
      } },

    { "type": "text", "x": 0, "y": 42, "width": 24, "height": 1,
      "properties": { "markdown": "## 백엔드 최근 에러 로그" } },

    { "type": "log", "x": 0, "y": 43, "width": 24, "height": 6,
      "properties": {
        "title": "최근 에러/치명적 오류 로그", "region": "${region}",
        "query": "SOURCE '${log_group}' | fields @timestamp, @message | filter @message like /(?i)(error|에러|오류|exception)/ | sort @timestamp desc | limit 50",
        "view": "table"
      } }
  ]
}
