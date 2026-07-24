# GitHub Actions가 프론트엔드(client) 정적 파일을 S3에 올리고
# CloudFront 캐시를 무효화하기 위한 OIDC 연동
# (백엔드 배포 역할과 분리: dev 브랜치 push만 assume 가능, S3/CloudFront 권한만 보유)

# --------------------------------------------------
# 프론트엔드 배포 전용 IAM 역할
# dev 브랜치에 대한 push로 트리거된 워크플로우만 이 역할을 assume할 수 있음
# --------------------------------------------------
data "aws_iam_policy_document" "github_actions_frontend_trust" {
  statement {
    actions = ["sts:AssumeRoleWithWebIdentity"]

    principals {
      type        = "Federated"
      identifiers = [data.aws_iam_openid_connect_provider.github_actions.arn]
    }

    condition {
      test     = "StringEquals"
      variable = "token.actions.githubusercontent.com:aud"
      values   = ["sts.amazonaws.com"]
    }

    condition {
      test     = "StringLike"
      variable = "token.actions.githubusercontent.com:sub"
      values   = ["repo:KimDJ7105/project2-1team:ref:refs/heads/dev"]
    }
  }
}

resource "aws_iam_role" "github_actions_frontend_deploy" {
  name               = "team1-github-actions-frontend-deploy"
  assume_role_policy = data.aws_iam_policy_document.github_actions_frontend_trust.json
}

# --------------------------------------------------
# S3 권한: 기존 team1-s3-asg-frontend 버킷에만 업로드/삭제 허용
# (버킷은 terraform 밖에서 이미 만들어져 있으므로 data source로 참조)
# --------------------------------------------------
data "aws_s3_bucket" "frontend" {
  bucket = "team1-s3-asg-frontend"
}

data "aws_iam_policy_document" "github_actions_frontend_s3" {
  statement {
    actions = [
      "s3:PutObject",
      "s3:DeleteObject",
    ]
    resources = ["${data.aws_s3_bucket.frontend.arn}/*"]
  }

  statement {
    actions   = ["s3:ListBucket"]
    resources = [data.aws_s3_bucket.frontend.arn]
  }

  # CloudFront 캐시 무효화 (omok.jhyang.click, distribution ID: E2DY5SXDS0HIEB)
  statement {
    actions   = ["cloudfront:CreateInvalidation"]
    resources = ["arn:aws:cloudfront::727646470302:distribution/E2DY5SXDS0HIEB"]
  }
}

resource "aws_iam_policy" "github_actions_frontend" {
  name   = "team1-github-actions-frontend-policy"
  policy = data.aws_iam_policy_document.github_actions_frontend_s3.json
}

resource "aws_iam_role_policy_attachment" "github_actions_frontend" {
  role       = aws_iam_role.github_actions_frontend_deploy.name
  policy_arn = aws_iam_policy.github_actions_frontend.arn
}
