terraform {
  required_version = ">= 1.0"

  required_providers {
    kubectl = {
      source  = "gavinbunney/kubectl"
      version = ">= 1.14"
    }
    helm = {
      source  = "hashicorp/helm"
      version = ">= 2.10"
    }
    kubernetes = {
      source  = "hashicorp/kubernetes"
      version = ">= 2.20"
    }
  }
}

provider "kubectl" {
  config_path = var.kubeconfig_path
}

provider "helm" {
  kubernetes = {
    config_path = var.kubeconfig_path
  }
}

provider "kubernetes" {
  config_path = var.kubeconfig_path
}

resource "kubernetes_namespace_v1" "argo_ns" {
  metadata {
    name = var.argo_namespace
  }
}

resource "helm_release" "argocd" {
  name             = "argocd"
  namespace        = var.argo_namespace
  create_namespace = false
  repository       = "https://argoproj.github.io/argo-helm"
  chart            = "argo-cd"
  version          = var.argo_version

  set = [
    {
      name  = "server.service.type"
      value = "LoadBalancer"
    },
    {
      name  = "server.extraArgs[0]"
      value = "--insecure"
    },
    {
      name  = "server.config.url"
      value = "http://${var.domain}"
    },
    {
      name  = "server.ingress.enabled"
      value = "true"
    },
    {
      name  = "server.ingress.hosts[0]"
      value = var.domain
    },
    {
      name  = "server.ingress.annotations.kubernetes.io/ingress.class"
      value = "nginx"
    },
    {
      name  = "dex.enabled"
      value = "false"
    },
    {
      name  = "prometheus.enabled"
      value = "false"
    },
    {
      name  = "grafana.enabled"
      value = "false"
    }
  ]

  depends_on = [kubernetes_namespace_v1.argo_ns]
}

resource "kubernetes_namespace_v1" "ingress_ns" {
  metadata {
    name = var.ingress_namespace
  }
}

resource "helm_release" "ingress_nginx" {
  name             = "ingress-nginx"
  namespace        = var.ingress_namespace
  create_namespace = true
  repository       = "https://kubernetes.github.io/ingress-nginx"
  chart            = "ingress-nginx"
  version          = "4.10.0"

  set = [
    {
      name  = "controller.service.type"
      value = var.ingress_service_type
    },
    {
      name  = "controller.admissionWebhooks.enabled"
      value = "false"
    }
  ]

  depends_on = [kubernetes_namespace_v1.ingress_ns]
}

resource "kubernetes_namespace_v1" "app_ns" {
  metadata {
    name = var.app_namespace
    labels = {
      "app.kubernetes.io/name" = var.app_namespace
    }
  }
}

resource "kubernetes_persistent_volume_claim" "postgres_pvc" {
  metadata {
    name      = "postgres-pvc"
    namespace = var.app_namespace
  }
  spec {
    access_modes       = ["ReadWriteOnce"]
    storage_class_name = var.storage_class_name
    resources {
      requests = {
        storage = var.postgres_storage_size
      }
    }
  }
  depends_on = [kubernetes_namespace_v1.app_ns]
}

resource "kubernetes_deployment" "postgres" {
  metadata {
    name      = "postgres"
    namespace = var.app_namespace
  }
  spec {
    replicas = 1
    selector {
      match_labels = {
        app = "postgres"
      }
    }
    template {
      metadata {
        labels = {
          app = "postgres"
        }
      }
      spec {
        container {
          name              = "postgres"
          image             = "postgres:${var.postgres_version}"
          image_pull_policy = "IfNotPresent"
          port {
            container_port = 5432
          }
          env {
            name  = "POSTGRES_USER"
            value = var.postgres_user
          }
          env {
            name  = "POSTGRES_PASSWORD"
            value = var.postgres_password
          }
          env {
            name  = "POSTGRES_DB"
            value = var.postgres_db
          }
          volume_mount {
            name       = "postgres-data"
            mount_path = "/var/lib/postgresql/data"
          }
          resources {
            requests = {
              memory = "256Mi"
              cpu    = "250m"
            }
            limits = {
              memory = "2Gi"
              cpu    = "1000m"
            }
          }
          liveness_probe {
            exec {
              command = ["pg_isready", "-U", "postgres"]
            }
            initial_delay_seconds = 30
            period_seconds        = 10
          }
          readiness_probe {
            exec {
              command = ["pg_isready", "-U", "postgres"]
            }
            initial_delay_seconds = 5
            period_seconds        = 5
          }
        }
        volume {
          name = "postgres-data"
          persistent_volume_claim {
            claim_name = kubernetes_persistent_volume_claim.postgres_pvc.metadata[0].name
          }
        }
      }
    }
  }
  depends_on = [kubernetes_namespace_v1.app_ns]
}

resource "kubernetes_service" "postgres" {
  metadata {
    name      = "postgres"
    namespace = var.app_namespace
  }
  spec {
    selector = {
      app = "postgres"
    }
    port {
      port        = 5432
      target_port = 5432
    }
    type = "ClusterIP"
  }
  depends_on = [kubernetes_namespace_v1.app_ns]
}

resource "kubernetes_persistent_volume_claim" "redis_pvc" {
  metadata {
    name      = "redis-pvc"
    namespace = var.app_namespace
  }
  spec {
    access_modes       = ["ReadWriteOnce"]
    storage_class_name = var.storage_class_name
    resources {
      requests = {
        storage = var.redis_storage_size
      }
    }
  }
  depends_on = [kubernetes_namespace_v1.app_ns]
}

resource "kubernetes_deployment" "redis" {
  metadata {
    name      = "redis"
    namespace = var.app_namespace
  }
  spec {
    replicas = 1
    selector {
      match_labels = {
        app = "redis"
      }
    }
    template {
      metadata {
        labels = {
          app = "redis"
        }
      }
      spec {
        container {
          name              = "redis"
          image             = "redis:${var.redis_version}"
          image_pull_policy = "IfNotPresent"
          port {
            container_port = 6379
          }
          command = ["redis-server", "--appendonly", "yes"]
          volume_mount {
            name       = "redis-data"
            mount_path = "/data"
          }
          resources {
            requests = {
              memory = "64Mi"
              cpu    = "100m"
            }
            limits = {
              memory = "512Mi"
              cpu    = "500m"
            }
          }
          liveness_probe {
            tcp_socket {
              port = 6379
            }
            initial_delay_seconds = 30
            period_seconds        = 10
          }
          readiness_probe {
            exec {
              command = ["redis-cli", "ping"]
            }
            initial_delay_seconds = 5
            period_seconds        = 5
          }
        }
        volume {
          name = "redis-data"
          persistent_volume_claim {
            claim_name = kubernetes_persistent_volume_claim.redis_pvc.metadata[0].name
          }
        }
      }
    }
  }
  depends_on = [kubernetes_namespace_v1.app_ns]
}

resource "kubernetes_service" "redis" {
  metadata {
    name      = "redis"
    namespace = var.app_namespace
  }
  spec {
    selector = {
      app = "redis"
    }
    port {
      port        = 6379
      target_port = 6379
    }
    type = "ClusterIP"
  }
  depends_on = [kubernetes_namespace_v1.app_ns]
}

resource "kubernetes_persistent_volume_claim" "seaweedfs_pvc" {
  metadata {
    name      = "seaweedfs-pvc"
    namespace = var.app_namespace
  }
  spec {
    access_modes       = ["ReadWriteOnce"]
    storage_class_name = var.storage_class_name
    resources {
      requests = {
        storage = var.seaweedfs_storage_size
      }
    }
  }
  depends_on = [kubernetes_namespace_v1.app_ns]
}

resource "kubernetes_deployment" "seaweedfs" {
  metadata {
    name      = "seaweedfs"
    namespace = var.app_namespace
  }
  spec {
    replicas = 1
    selector {
      match_labels = {
        app = "seaweedfs"
      }
    }
    template {
      metadata {
        labels = {
          app = "seaweedfs"
        }
      }
      spec {
        container {
          name              = "seaweedfs"
          image             = "chrislusf/seaweedfs:${var.seaweedfs_version}"
          image_pull_policy = "IfNotPresent"
          port {
            name           = "master"
            container_port = 9333
          }
          port {
            name           = "volume"
            container_port = 8333
          }
          port {
            name           = "s3"
            container_port = 8888
          }
          command = ["weed", "server", "-dir=/data", "-volume.max=100"]
          env {
            name  = "WEED_MASTER_PORT"
            value = "9333"
          }
          env {
            name  = "WEED_VOLUME_PORT"
            value = "8333"
          }
          env {
            name  = "WEED_S3_PORT"
            value = "8888"
          }
          volume_mount {
            name       = "seaweedfs-data"
            mount_path = "/data"
          }
          resources {
            requests = {
              memory = "256Mi"
              cpu    = "250m"
            }
            limits = {
              memory = "1Gi"
              cpu    = "1000m"
            }
          }
          liveness_probe {
            tcp_socket {
              port = 9333
            }
            initial_delay_seconds = 30
            period_seconds        = 10
          }
          readiness_probe {
            tcp_socket {
              port = 9333
            }
            initial_delay_seconds = 10
            period_seconds        = 5
          }
        }
        volume {
          name = "seaweedfs-data"
          persistent_volume_claim {
            claim_name = kubernetes_persistent_volume_claim.seaweedfs_pvc.metadata[0].name
          }
        }
      }
    }
  }
  depends_on = [kubernetes_namespace_v1.app_ns]
}

resource "kubernetes_service" "seaweedfs" {
  metadata {
    name      = "seaweedfs"
    namespace = var.app_namespace
  }
  spec {
    selector = {
      app = "seaweedfs"
    }
    port {
      name        = "master"
      port        = 9333
      target_port = 9333
    }
    port {
      name        = "volume"
      port        = 8333
      target_port = 8333
    }
    port {
      name        = "s3"
      port        = 8888
      target_port = 8888
    }
    type = "ClusterIP"
  }
  depends_on = [kubernetes_namespace_v1.app_ns]
}

resource "kubernetes_secret" "app_secrets" {
  metadata {
    name      = "optimistic-tanuki-secrets"
    namespace = var.app_namespace
  }
  type = "Opaque"
  data = {
    POSTGRES_USER     = var.postgres_user
    POSTGRES_PASSWORD = var.postgres_password
    JWT_SECRET        = var.jwt_secret
    S3_ACCESS_KEY     = var.s3_access_key
    S3_SECRET_KEY     = var.s3_secret_key
    REDIS_PASSWORD    = var.redis_password
  }
  depends_on = [kubernetes_namespace_v1.app_ns]
}
