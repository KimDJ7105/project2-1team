# kube-prometheus-stack Helm values
# t3.medium 노드 2~3대 규모의 소규모 클러스터에 맞게 차트 기본 리소스 요청량을 축소함

# EKS 관리형 컨트롤플레인(kube-scheduler/controller-manager/etcd)은 스크랩 대상으로 노출되지
# 않아서 기본값대로 두면 타겟이 영구적으로 Down으로 잡힘 (EKS에서 흔히 적용하는 튜닝)
kubeControllerManager:
  enabled: false
kubeScheduler:
  enabled: false
kubeEtcd:
  enabled: false
kubeProxy:
  enabled: false

prometheus:
  prometheusSpec:
    retention: 7d
    resources:
      requests:
        cpu: 250m
        memory: 512Mi
      limits:
        cpu: 500m
        memory: 1Gi
    storageSpec:
      volumeClaimTemplate:
        spec:
          storageClassName: gp3
          accessModes: ["ReadWriteOnce"]
          resources:
            requests:
              storage: 10Gi

alertmanager:
  alertmanagerSpec:
    resources:
      requests:
        cpu: 25m
        memory: 64Mi
      limits:
        cpu: 100m
        memory: 128Mi
    storage:
      volumeClaimTemplate:
        spec:
          storageClassName: gp3
          accessModes: ["ReadWriteOnce"]
          resources:
            requests:
              storage: 2Gi

prometheusOperator:
  resources:
    requests:
      cpu: 50m
      memory: 64Mi
    limits:
      cpu: 200m
      memory: 128Mi

kube-state-metrics:
  resources:
    requests:
      cpu: 25m
      memory: 64Mi
    limits:
      cpu: 100m
      memory: 128Mi

prometheus-node-exporter:
  resources:
    requests:
      cpu: 25m
      memory: 32Mi
    limits:
      cpu: 50m
      memory: 64Mi

grafana:
  # 대시보드/UI에 표시되는 시간대를 한국 표준시(KST)로 고정 (Prometheus 저장 데이터 자체는 UTC 그대로)
  grafana.ini:
    date_formats:
      default_timezone: Asia/Seoul

  serviceAccount:
    create: true
    name: grafana
    annotations:
      eks.amazonaws.com/role-arn: "${grafana_irsa_role_arn}"

  # admin 계정은 Terraform이 만든 Secrets Manager 값을 external-secrets가
  # 동기화한 k8s Secret(infra/k8s/monitoring-secret-store.yaml)을 그대로 참조
  admin:
    existingSecret: grafana-admin-credentials
    userKey: admin-user
    passwordKey: admin-password

  persistence:
    enabled: true
    storageClassName: gp3
    size: 5Gi

  resources:
    requests:
      cpu: 100m
      memory: 128Mi
    limits:
      cpu: 200m
      memory: 256Mi

  # ALB Ingress는 infra/k8s/grafana-ingress.yaml에서 다른 서비스들과 동일한
  # 패턴(team1-shared 그룹)으로 별도 관리
  ingress:
    enabled: false

  additionalDataSources:
    - name: CloudWatch
      type: cloudwatch
      access: proxy
      jsonData:
        authType: default # 파드에 붙은 IRSA(team1-grafana-irsa) 자격증명 사용
        defaultRegion: ap-northeast-2
