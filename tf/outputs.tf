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
