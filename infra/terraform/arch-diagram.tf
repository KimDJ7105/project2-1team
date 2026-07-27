# Team1 인프라 구조도 실시간 페이지
# Lambda Function URL이 요청마다 AWS를 read-only로 조회해서 HTML을 그려 반환함.
# 캐시/스케줄/S3/CloudFront 없이 Lambda 하나로 끝나서 "새로고침 = 그 순간의 실제 상태".
#
# 조회 대상은 read-only describe/list/get 계열로만 한정한 전용 IAM 정책을 붙임
# (team1 백엔드 실서비스와 무관한 별도 역할 — 최소 권한 원칙).

data "archive_file" "arch_diagram" {
  type        = "zip"
  source_dir  = "${path.module}/lambda/arch-diagram"
  output_path = "${path.module}/lambda/arch-diagram.zip"
}

data "aws_iam_policy_document" "arch_diagram_assume" {
  statement {
    actions = ["sts:AssumeRole"]
    principals {
      type        = "Service"
      identifiers = ["lambda.amazonaws.com"]
    }
  }
}

resource "aws_iam_role" "arch_diagram" {
  name               = "team1-arch-diagram-lambda"
  assume_role_policy = data.aws_iam_policy_document.arch_diagram_assume.json

  tags = {
    Team = "team1"
  }
}

resource "aws_iam_role_policy_attachment" "arch_diagram_logs" {
  role       = aws_iam_role.arch_diagram.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole"
}

# 페이지 렌더링에 실제로 쓰는 describe/list/get API만 나열 (핸들러 코드와 1:1로 맞춤)
data "aws_iam_policy_document" "arch_diagram_readonly" {
  statement {
    actions = [
      "ec2:DescribeVpcs",
      "ec2:DescribeSubnets",
      "ec2:DescribeNatGateways",
      "ec2:DescribeInternetGateways",
      "eks:ListClusters",
      "eks:DescribeCluster",
      "eks:ListNodegroups",
      "eks:DescribeNodegroup",
      "autoscaling:DescribeAutoScalingGroups",
      "rds:DescribeDBInstances",
      "elasticache:DescribeCacheClusters",
      "s3:ListAllMyBuckets",
      "elasticloadbalancing:DescribeLoadBalancers",
      "elasticloadbalancing:DescribeListeners",
      "elasticloadbalancing:DescribeRules",
      "elasticloadbalancing:DescribeTargetGroups",
      "route53:ListHostedZonesByName",
      "route53:ListResourceRecordSets",
      "cloudfront:ListDistributions",
      "ecr:DescribeRepositories",
      "ecr:DescribeImages",
      "secretsmanager:ListSecrets",
      "iam:ListRoles",
      "iam:GetRole",
      "iam:ListAttachedRolePolicies",
      "iam:GetPolicy",
      "iam:GetPolicyVersion",
      "cloudwatch:ListDashboards",
      "cloudwatch:ListMetrics",
      "cloudwatch:GetMetricData",
      "acm:ListCertificates",
    ]
    resources = ["*"]
  }
}

resource "aws_iam_policy" "arch_diagram_readonly" {
  name   = "team1-arch-diagram-readonly"
  policy = data.aws_iam_policy_document.arch_diagram_readonly.json
}

resource "aws_iam_role_policy_attachment" "arch_diagram_readonly" {
  role       = aws_iam_role.arch_diagram.name
  policy_arn = aws_iam_policy.arch_diagram_readonly.arn
}

resource "aws_lambda_function" "arch_diagram" {
  function_name    = "team1-arch-diagram"
  role             = aws_iam_role.arch_diagram.arn
  handler          = "handler.lambda_handler"
  runtime          = "python3.12"
  timeout          = 29
  memory_size      = 256
  filename         = data.archive_file.arch_diagram.output_path
  source_code_hash = data.archive_file.arch_diagram.output_base64sha256

  tags = {
    Team = "team1"
  }
}

# 조직 SCP가 인증 없는(Principal "*") Function URL 호출을 막고 있어
# authorization_type = "NONE"은 403으로 거부됨. 대안으로 AWS_IAM(SigV4) 사용.
resource "aws_lambda_function_url" "arch_diagram" {
  function_name      = aws_lambda_function.arch_diagram.function_name
  authorization_type = "AWS_IAM"

  cors {
    allow_origins = ["*"]
    allow_methods = ["GET"]
  }
}

output "arch_diagram_url" {
  description = "Team1 인프라 구조도 실시간 페이지 URL (AWS_IAM, SigV4 서명 필요 — 관리용)"
  value       = aws_lambda_function_url.arch_diagram.function_url
}

# 조직 SCP가 막는 건 Lambda Function URL의 Principal "*" 호출뿐이라, 완전히
# 다른 서비스인 API Gateway(HTTP API) 앞단을 통해 같은 Lambda를 그대로 호출한다.
# API Gateway -> Lambda 권한은 apigateway.amazonaws.com 서비스 principal +
# 이 API로 source_arn을 한정한 스코프라서 "*" 공개 정책과는 다른 종류의 허용.
resource "aws_apigatewayv2_api" "arch_diagram" {
  name          = "team1-arch-diagram"
  protocol_type = "HTTP"

  tags = {
    Team = "team1"
  }
}

resource "aws_apigatewayv2_integration" "arch_diagram" {
  api_id                 = aws_apigatewayv2_api.arch_diagram.id
  integration_type       = "AWS_PROXY"
  integration_uri        = aws_lambda_function.arch_diagram.invoke_arn
  payload_format_version = "2.0"
}

resource "aws_apigatewayv2_route" "arch_diagram" {
  api_id    = aws_apigatewayv2_api.arch_diagram.id
  route_key = "$default"
  target    = "integrations/${aws_apigatewayv2_integration.arch_diagram.id}"
}

resource "aws_apigatewayv2_stage" "arch_diagram" {
  api_id      = aws_apigatewayv2_api.arch_diagram.id
  name        = "$default"
  auto_deploy = true
}

resource "aws_lambda_permission" "arch_diagram_apigw" {
  statement_id  = "AllowAPIGatewayInvoke"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.arch_diagram.function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_apigatewayv2_api.arch_diagram.execution_arn}/*/*"
}

output "arch_diagram_public_url" {
  description = "Team1 인프라 구조도 실시간 페이지 URL (인증 없이 브라우저로 바로 열람 가능)"
  value       = aws_apigatewayv2_api.arch_diagram.api_endpoint
}

# ---------------------------------------------------------------------------
# 커스텀 도메인 — diagram.jhyang.click
# 기존 jhyang.click 레코드(api/monitor/grafana/omok/www)는 콘솔에서 만들어져
# Terraform이 관리하지 않으므로, zone은 데이터소스로만 조회하고 새 레코드
# 하나만 추가한다 (기존 레코드에는 영향 없음).

locals {
  arch_diagram_domain = "jhyang.click"
}

data "aws_route53_zone" "jhyang" {
  name = "${local.arch_diagram_domain}."
}

resource "aws_acm_certificate" "arch_diagram" {
  domain_name       = "diagram.${local.arch_diagram_domain}"
  validation_method = "DNS"

  tags = {
    Team = "team1"
  }

  lifecycle {
    create_before_destroy = true
  }
}

resource "aws_route53_record" "arch_diagram_cert_validation" {
  for_each = {
    for dvo in aws_acm_certificate.arch_diagram.domain_validation_options : dvo.domain_name => {
      name  = dvo.resource_record_name
      type  = dvo.resource_record_type
      value = dvo.resource_record_value
    }
  }

  zone_id = data.aws_route53_zone.jhyang.zone_id
  name    = each.value.name
  type    = each.value.type
  records = [each.value.value]
  ttl     = 300
}

resource "aws_acm_certificate_validation" "arch_diagram" {
  certificate_arn         = aws_acm_certificate.arch_diagram.arn
  validation_record_fqdns = [for r in aws_route53_record.arch_diagram_cert_validation : r.fqdn]
}

resource "aws_apigatewayv2_domain_name" "arch_diagram" {
  domain_name = "diagram.${local.arch_diagram_domain}"

  domain_name_configuration {
    certificate_arn = aws_acm_certificate_validation.arch_diagram.certificate_arn
    endpoint_type   = "REGIONAL"
    security_policy = "TLS_1_2"
  }
}

resource "aws_apigatewayv2_api_mapping" "arch_diagram" {
  api_id      = aws_apigatewayv2_api.arch_diagram.id
  domain_name = aws_apigatewayv2_domain_name.arch_diagram.id
  stage       = aws_apigatewayv2_stage.arch_diagram.id
}

resource "aws_route53_record" "arch_diagram" {
  zone_id = data.aws_route53_zone.jhyang.zone_id
  name    = "diagram.${local.arch_diagram_domain}"
  type    = "A"

  alias {
    name                   = aws_apigatewayv2_domain_name.arch_diagram.domain_name_configuration[0].target_domain_name
    zone_id                = aws_apigatewayv2_domain_name.arch_diagram.domain_name_configuration[0].hosted_zone_id
    evaluate_target_health = false
  }
}

output "arch_diagram_dns_url" {
  description = "Team1 인프라 구조도 실시간 페이지 URL (커스텀 도메인)"
  value       = "https://diagram.${local.arch_diagram_domain}"
}
