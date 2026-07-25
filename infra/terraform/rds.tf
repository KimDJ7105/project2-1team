# RDS(team1-rds) — 콘솔에서 이미 만들어진 인스턴스를 Terraform으로 편입

resource "aws_db_subnet_group" "team1_rds" {
  name        = "team1-rds-subnet-group"
  description = "team1-rds-subnet-group"
  subnet_ids  = [aws_subnet.private_a.id, aws_subnet.private_b.id]

  tags = {
    Name = "team1-rds-subnet-group"
  }
}

resource "aws_db_instance" "team1_rds" {
  identifier     = "team1-rds"
  engine         = "mysql"
  engine_version = "8.4.9"
  instance_class = "db.t3.micro"

  allocated_storage     = 20
  max_allocated_storage = 1000 # Storage Auto Scaling
  storage_type          = "gp2"
  storage_encrypted     = true

  db_name  = "testdb"
  username = "root"
  # 실제 비밀번호는 API로 조회 불가 + Secrets Manager가 진짜 값을 갖고 있으므로
  # 여기 값은 최초 import 시 diff를 안 내려고 넣는 placeholder일 뿐, 절대 apply로 반영되지 않음
  password = "REPLACED_BY_IMPORT_placeholder"

  db_subnet_group_name   = aws_db_subnet_group.team1_rds.name
  vpc_security_group_ids = [aws_security_group.rds.id]
  parameter_group_name   = "default.mysql8.4"

  multi_az                   = false
  publicly_accessible        = false
  backup_retention_period    = 1
  auto_minor_version_upgrade = true
  deletion_protection        = false
  copy_tags_to_snapshot      = true
  skip_final_snapshot        = true # destroy 시에만 영향(최종 프로젝트 정리 단계용)

  tags = {
    Name = "team1-rds"
    Team = "team1"
  }

  lifecycle {
    ignore_changes = [password, engine_version]
  }
}
