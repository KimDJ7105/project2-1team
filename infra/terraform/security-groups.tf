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
