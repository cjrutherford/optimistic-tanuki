variable "cluster_name" {
  description = "Name of the Kubernetes cluster"
  type        = string
  default     = "optimistic-tanuki"
}

variable "argo_version" {
  description = "Version of ArgoCD to install"
  type        = string
  default     = "7.7.0"
}

variable "ingress_namespace" {
  description = "Namespace for ingress controller"
  type        = string
  default     = "ingress"
}

variable "argo_namespace" {
  description = "Namespace for ArgoCD"
  type        = string
  default     = "argocd"
}

variable "argo_admin_password" {
  description = "ArgoCD admin password"
  type        = string
  sensitive   = true
}

variable "domain" {
  description = "Domain for ingress"
  type        = string
  default     = "localhost"
}

variable "docker_registry" {
  description = "Docker registry for images"
  type        = string
  default     = "cjrutherford"
}
