# 클러스터 애드온 설치 (Helm)

# External Secrets Operator: Secrets Manager/Parameter Store 값을 K8s Secret으로 동기화
resource "helm_release" "external_secrets" {
  name             = "external-secrets"
  repository       = "https://charts.external-secrets.io"
  chart            = "external-secrets"
  namespace        = "external-secrets"
  create_namespace = true

  depends_on = [module.eks]
}

# AWS Load Balancer Controller: Ingress를 감지해 ALB를 자동 생성/관리
resource "helm_release" "aws_lb_controller" {
  name       = "aws-load-balancer-controller"
  repository = "https://aws.github.io/eks-charts"
  chart      = "aws-load-balancer-controller"
  namespace  = "kube-system"

  set {
    name  = "clusterName"
    value = module.eks.cluster_name
  }

  set {
    name  = "vpcId"
    value = var.vpc_id
  }

  set {
    name  = "serviceAccount.create"
    value = "true"
  }

  # IRSA 연결 annotation (alb_controller_irsa 역할 사용)
  set {
    name  = "serviceAccount.annotations.eks\\.amazonaws\\.com/role-arn"
    value = module.alb_controller_irsa.iam_role_arn
  }

  depends_on = [module.eks, module.alb_controller_irsa]
}

# Metrics Server: HPA가 참조하는 CPU/메모리 사용량 지표 제공
resource "helm_release" "metrics_server" {
  name       = "metrics-server"
  repository = "https://kubernetes-sigs.github.io/metrics-server/"
  chart      = "metrics-server"
  namespace  = "kube-system"

  depends_on = [module.eks]
}

# CloudWatch Observability: 노드/Pod 지표를 CloudWatch로 전송 (Container Insights)
resource "aws_eks_addon" "cloudwatch_observability" {
  cluster_name = module.eks.cluster_name
  addon_name   = "amazon-cloudwatch-observability"

  depends_on = [module.eks]
}
