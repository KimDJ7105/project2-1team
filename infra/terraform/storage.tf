# S3 버킷 — 콘솔에서 이미 만들어진 버킷을 Terraform으로 편입
# (버킷 자체의 설정값은 조회된 실제 상태를 그대로 반영, 값 변경 없음)

resource "aws_s3_bucket" "profile" {
  bucket = "team1-s3-profile"

  tags = {
    Name = "team1-s3-profile"
  }
}

resource "aws_s3_bucket_public_access_block" "profile" {
  bucket = aws_s3_bucket.profile.id

  # 접근은 presigned URL로만 이루어지므로 퍼블릭 정책이 필요 없음 — 전부 차단
  block_public_acls       = true
  ignore_public_acls      = true
  block_public_policy     = true
  restrict_public_buckets = true
}

resource "aws_s3_bucket_server_side_encryption_configuration" "profile" {
  bucket = aws_s3_bucket.profile.id

  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "AES256"
    }
    bucket_key_enabled = true
  }
}

resource "aws_s3_bucket" "frontend" {
  bucket = "team1-s3-frontend"

  tags = {
    Name = "team1-s3-frontend"
  }
}

resource "aws_s3_bucket_public_access_block" "frontend" {
  bucket = aws_s3_bucket.frontend.id

  block_public_acls       = true
  ignore_public_acls      = true
  block_public_policy     = true
  restrict_public_buckets = true
}

resource "aws_s3_bucket_server_side_encryption_configuration" "frontend" {
  bucket = aws_s3_bucket.frontend.id

  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "AES256"
    }
    bucket_key_enabled = true
  }
}

# CDN 강제 접근 정책: 버킷은 비공개로 두고 CloudFront(OAC)를 통해서만 접근 허용
resource "aws_s3_bucket_policy" "frontend" {
  bucket = aws_s3_bucket.frontend.id
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid       = "AllowCloudFrontServicePrincipal"
        Effect    = "Allow"
        Principal = { Service = "cloudfront.amazonaws.com" }
        Action    = "s3:GetObject"
        Resource  = "${aws_s3_bucket.frontend.arn}/*"
        Condition = {
          ArnLike = {
            "AWS:SourceArn" = "arn:aws:cloudfront::727646470302:distribution/E2DY5SXDS0HIEB"
          }
        }
      }
    ]
  })

  depends_on = [aws_s3_bucket_public_access_block.frontend]
}
