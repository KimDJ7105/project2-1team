# SSM Parameter Store에 비민감 설정값 등록
# 민감정보(DB_PASSWORD, DB_USERNAME)는 Secrets Manager에 그대로 둠

resource "aws_ssm_parameter" "db_host" {
  name  = "/team1/backend/DB_HOST"
  type  = "String"
  value = aws_db_instance.team1_rds_data.address
}

resource "aws_ssm_parameter" "db_port" {
  name  = "/team1/backend/DB_PORT"
  type  = "String"
  value = "3306"
}

resource "aws_ssm_parameter" "db_name" {
  name  = "/team1/backend/DB_NAME"
  type  = "String"
  value = "testdb"
}

resource "aws_ssm_parameter" "redis_host" {
  name  = "/team1/backend/REDIS_HOST"
  type  = "String"
  value = aws_elasticache_replication_group.team1_redis_v2.primary_endpoint_address
}

resource "aws_ssm_parameter" "redis_port" {
  name  = "/team1/backend/REDIS_PORT"
  type  = "String"
  value = "6379"
}

# server/src/app.ts가 REDIS_HOST/PORT와 별도로 직접 참조하는 연결 URL
# (원래 콘솔에서 만들어져 있던 것을 편입)
resource "aws_ssm_parameter" "redis_url" {
  name  = "/team1/backend/REDIS_URL"
  type  = "String"
  value = "redis://${aws_elasticache_replication_group.team1_redis_v2.primary_endpoint_address}:6379"
}

resource "aws_ssm_parameter" "client_url" {
  name  = "/team1/backend/CLIENT_URL"
  type  = "String"
  value = "https://omok.jhyang.click"
}

resource "aws_ssm_parameter" "s3_profile_bucket" {
  name  = "/team1/backend/S3_PROFILE_BUCKET"
  type  = "String"
  value = "team1-s3-profile"
}

resource "aws_ssm_parameter" "s3_region" {
  name  = "/team1/backend/S3_REGION"
  type  = "String"
  value = "ap-northeast-2"
}
