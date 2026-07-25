# RDS(team1-rds-data) — 원래 콘솔에서 만들어진 team1-rds를 데이터 전용
# 서브넷으로 이전(Read Replica 생성 후 promote)한 최종 인스턴스.
# 이전 과정: team1-rds(private 서브넷) -> Read Replica 생성(데이터 서브넷)
# -> 복제 지연 0 확인 후 promote -> DB_HOST 컷오버 -> 검증 -> 구 인스턴스
# 스냅샷(team1-rds-final-before-subnet-migration) 후 삭제
resource "aws_db_subnet_group" "team1_rds_data" {
  name        = "team1-rds-data-subnet-group"
  description = "team1-rds-data-subnet-group"
  subnet_ids  = [aws_subnet.data_a.id, aws_subnet.data_b.id]

  tags = {
    Name = "team1-rds-data-subnet-group"
  }
}

resource "aws_db_instance" "team1_rds_data" {
  identifier        = "team1-rds-data"
  instance_class    = "db.t3.micro"
  apply_immediately = true

  db_subnet_group_name   = aws_db_subnet_group.team1_rds_data.name
  vpc_security_group_ids = [aws_security_group.rds.id]

  storage_type        = "gp2"
  storage_encrypted   = true
  publicly_accessible = false
  skip_final_snapshot = true

  # 승격 후 원본(team1-rds)과 동일한 운영 설정으로 맞춤
  max_allocated_storage      = 1000
  backup_retention_period    = 1
  auto_minor_version_upgrade = true
  deletion_protection        = false
  copy_tags_to_snapshot      = true

  tags = {
    Name = "team1-rds-data"
    Team = "team1"
  }

  lifecycle {
    ignore_changes = [engine_version]
  }
}
