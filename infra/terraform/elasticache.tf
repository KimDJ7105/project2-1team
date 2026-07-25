# Redis(ElastiCache) — 데이터 전용 서브넷에 새로 생성 후 블루/그린으로 전환
# 기존 team1-elasticache-redis는 세션/게임 룸 상태를 들고 있어서 무중단
# 전환이 불가능한 replication group 자체 재생성 대신, 새로 만들고 검증한 뒤
# REDIS_HOST를 컷오버하는 방식으로 진행함 (컷오버 순간 기존 세션은 끊김)

resource "aws_elasticache_subnet_group" "data" {
  name       = "team1-elasticache-data-subnet-group"
  subnet_ids = [aws_subnet.data_a.id, aws_subnet.data_b.id]

  tags = {
    Name = "team1-elasticache-data-subnet-group"
  }
}

resource "aws_elasticache_replication_group" "team1_redis_v2" {
  replication_group_id = "team1-elasticache-redis-v2"
  description          = "team1-elasticache-redis-v2"
  engine               = "redis"
  engine_version       = "7.1"
  node_type            = "cache.t3.micro"
  num_cache_clusters   = 3

  automatic_failover_enabled = true
  multi_az_enabled           = false

  parameter_group_name = "team1-redis7-keyspace-events"
  subnet_group_name    = aws_elasticache_subnet_group.data.name
  security_group_ids   = [aws_security_group.elasticache.id]
  port                 = 6379

  at_rest_encryption_enabled = true
  transit_encryption_enabled = true
  transit_encryption_mode    = "preferred"

  snapshot_retention_limit   = 1
  snapshot_window            = "01:00-02:00"
  auto_minor_version_upgrade = true

  tags = {
    Name = "team1-elasticache-redis-v2"
    Team = "team1"
  }
}
