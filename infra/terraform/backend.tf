# 팀 공유용 원격 state 백엔드 (S3 + 네이티브 락)
# 이전에는 로컬 tfstate만 사용해 팀원 간 상태가 공유되지 않았음
terraform {
  backend "s3" {
    bucket       = "team1-terraform-state-727646470302"
    key          = "team1/terraform.tfstate"
    region       = "ap-northeast-2"
    use_lockfile = true
    encrypt      = true
  }
}
