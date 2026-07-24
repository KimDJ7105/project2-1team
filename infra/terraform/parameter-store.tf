# SSM Parameter Store에 비민감 설정값 등록
# 민감정보(DB_PASSWORD, DB_USERNAME)는 Secrets Manager에 그대로 둠

resource "aws_ssm_parameter" "db_host" {
  name  = "/team1/backend/DB_HOST"
  type  = "String"
  value = "team1-rds.cnqmcq6uwqa3.ap-northeast-2.rds.amazonaws.com"
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
  value = "master.team1-elasticache-redis.q2tpkl.apn2.cache.amazonaws.com"
}

resource "aws_ssm_parameter" "redis_port" {
  name  = "/team1/backend/REDIS_PORT"
  type  = "String"
  value = "6379"
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
