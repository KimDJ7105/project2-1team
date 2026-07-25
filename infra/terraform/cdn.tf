# CloudFront — 콘솔에서 이미 만들어진 배포를 Terraform으로 편입
# (설정값은 조회된 실제 상태를 그대로 반영, 값 변경 없음)

resource "aws_cloudfront_origin_access_control" "frontend" {
  name                              = "oac-team1-s3-asg-frontend.s3.ap-northeast-2.amazonaw-mrvof3pdnsf"
  description                       = "Created by CloudFront"
  origin_access_control_origin_type = "s3"
  signing_behavior                  = "always"
  signing_protocol                  = "sigv4"
}

resource "aws_cloudfront_distribution" "frontend" {
  comment             = "team1-cloudfront-asg-frontend"
  enabled             = true
  is_ipv6_enabled     = true
  default_root_object = "index.html"
  aliases             = ["omok.jhyang.click"]
  price_class         = "PriceClass_All"
  http_version        = "http2"

  origin {
    origin_id                = "team1-s3-asg-frontend.s3.ap-northeast-2.amazonaws.com-mrvoe7vbyvi"
    domain_name              = aws_s3_bucket.frontend.bucket_regional_domain_name
    origin_access_control_id = aws_cloudfront_origin_access_control.frontend.id
    connection_attempts      = 3
    connection_timeout       = 10

    s3_origin_config {
      origin_access_identity = ""
    }
  }

  default_cache_behavior {
    target_origin_id       = "team1-s3-asg-frontend.s3.ap-northeast-2.amazonaws.com-mrvoe7vbyvi"
    viewer_protocol_policy = "redirect-to-https"
    allowed_methods        = ["GET", "HEAD"]
    cached_methods         = ["GET", "HEAD"]
    compress               = true
    cache_policy_id        = "658327ea-f89d-4fab-a63d-7e88639e58f6" # AWS managed: CachingOptimized
  }

  custom_error_response {
    error_code            = 403
    response_code         = 200
    response_page_path    = "/index.html"
    error_caching_min_ttl = 10
  }

  custom_error_response {
    error_code            = 404
    response_code         = 200
    response_page_path    = "/index.html"
    error_caching_min_ttl = 10
  }

  restrictions {
    geo_restriction {
      restriction_type = "none"
    }
  }

  viewer_certificate {
    acm_certificate_arn = "arn:aws:acm:us-east-1:727646470302:certificate/2a7eba8a-7f56-4de3-be61-fe5f7eee6bd1"
    ssl_support_method  = "sni-only"
    # 실제 콘솔 설정값은 TLSv1.3_2025지만, 현재 aws provider(5.100.0)가 아직
    # 이 값을 모름(스키마 미지원) -> 검증 통과용 placeholder만 넣고 실제 값은
    # ignore_changes로 보호해서 apply 시 다운그레이드되지 않도록 함
    minimum_protocol_version = "TLSv1.2_2021"
  }

  tags = {
    Name = "team1-cloudfront-frontend"
  }

  lifecycle {
    ignore_changes = [viewer_certificate]
  }
}
