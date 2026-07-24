# 공통 변수 정의 (기존 인프라 재사용 값들)

# 새 VPC를 만들지 않고 기존 team1-vpc를 그대로 재사용
variable "vpc_id" {
  default = "vpc-0550e9c9b61d67293"
}

# EKS 워커노드 배치용 Private 서브넷
# (외부에서 직접 접근 못 하게 막고 ALB를 통해서만 트래픽이 들어오게 함)
variable "private_subnet_ids" {
  description = "Private subnet-a, subnet-b IDs"
  type        = list(string)
  default     = ["subnet-0b1a238a09f507e71", "subnet-043fc6cea25972705"]
}

# 인터넷과 직접 통신하는 ALB 배치용 Public 서브넷
variable "public_subnet_ids" {
  description = "Public subnet-a, subnet-b IDs (ALB용)"
  type        = list(string)
  default     = ["subnet-082f8af72e8417755", "subnet-0e5c915b1e63805dd"]
}

variable "cluster_name" {
  default = "team1-eks"
}

variable "cluster_version" {
  default = "1.36"
}

variable "rds_sg_id" {
  default = "sg-041fd8b3182b64c10" # 기존 team1-sg-rds
}

variable "elasticache_sg_id" {
  default = "sg-0e461aeb186420897" # 기존 team1-sg-elasticache
}

variable "acm_cert_arn" {
  default = "arn:aws:acm:ap-northeast-2:727646470302:certificate/9085e196-5c96-4d18-9214-315810d902e6" # jhyang.click SSL 인증서
}
