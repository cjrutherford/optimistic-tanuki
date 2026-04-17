output "argocd_server" {
  description = "ArgoCD server URL"
  value       = "http://${var.domain}"
}

output "ingress_ip" {
  description = "Ingress controller external IP"
  value       = "Will be assigned by LoadBalancer"
  sensitive   = false
}

output "cluster_name" {
  description = "Name of the Kubernetes cluster"
  value       = var.cluster_name
}

output "argo_namespace" {
  description = "Namespace where ArgoCD is installed"
  value       = var.argo_namespace
}

output "app_namespace" {
  description = "Namespace where the application is deployed"
  value       = var.app_namespace
}

output "postgres_service" {
  description = "PostgreSQL service endpoint"
  value       = "postgres.${var.app_namespace}.svc.cluster.local:5432"
}

output "redis_service" {
  description = "Redis service endpoint"
  value       = "redis.${var.app_namespace}.svc.cluster.local:6379"
}

output "seaweedfs_service" {
  description = "SeaweedFS service endpoints"
  value = {
    master = "seaweedfs.${var.app_namespace}.svc.cluster.local:9333"
    volume = "seaweedfs.${var.app_namespace}.svc.cluster.local:8333"
    s3     = "seaweedfs.${var.app_namespace}.svc.cluster.local:8888"
  }
}
