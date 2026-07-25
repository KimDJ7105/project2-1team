# 콘솔에서 만들어진 RDS/ElastiCache 보안그룹 본체를 Terraform으로 편입
# (ingress/egress 블록은 비워둠 — 규칙은 아래 aws_security_group_rule이 별도로 관리하므로
#  여기 인라인으로 채우면 두 관리 방식이 충돌함)
resource "aws_security_group" "rds" {
  name        = "team1-sg-rds"
  description = "Created by RDS management console"
  vpc_id      = aws_vpc.main.id

  tags = {
    Name = "team1-sg-rds"
  }

  lifecycle {
    ignore_changes = [ingress, egress, description]
  }
}

resource "aws_security_group" "elasticache" {
  name        = "team1-sg-elasticache"
  description = "team1-sg-elasticache"
  vpc_id      = aws_vpc.main.id

  tags = {
    Name = "team1-sg-elasticache"
    Team = "team1"
  }

  lifecycle {
    ignore_changes = [ingress, egress]
  }
}

# 기존 RDS / ElastiCache 보안그룹에 EKS 노드 접근 허용 규칙 추가

resource "aws_security_group_rule" "rds_from_eks" {
  type      = "ingress"
  from_port = 3306
  to_port   = 3306
  protocol  = "tcp"

  security_group_id        = var.rds_sg_id
  source_security_group_id = module.eks.node_security_group_id
}

resource "aws_security_group_rule" "redis_from_eks" {
  type      = "ingress"
  from_port = 6379
  to_port   = 6379
  protocol  = "tcp"

  security_group_id        = var.elasticache_sg_id
  source_security_group_id = module.eks.node_security_group_id
}
