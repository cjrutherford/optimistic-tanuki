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

variable "kubeconfig_path" {
  description = "Path to kubeconfig used by Terraform Kubernetes/Helm providers"
  type        = string
  default     = "~/.kube/config"
}

variable "app_namespace" {
  description = "Namespace for the application"
  type        = string
  default     = "optimistic-tanuki"
}

variable "storage_class_name" {
  description = "Storage class for persistent volumes"
  type        = string
  default     = "microk8s-hostpath"
}

variable "ingress_service_type" {
  description = "Service type for ingress controller (LoadBalancer, NodePort, ClusterIP)"
  type        = string
  default     = "LoadBalancer"
}

variable "ingress_node_port" {
  description = "Node port for ingress when using NodePort type"
  type        = number
  default     = 30080
}

variable "postgres_version" {
  description = "PostgreSQL container version"
  type        = string
  default     = "17"
}

variable "postgres_storage_size" {
  description = "PostgreSQL storage size"
  type        = string
  default     = "10Gi"
}

variable "postgres_user" {
  description = "PostgreSQL username"
  type        = string
  default     = "postgres"
}

variable "postgres_password" {
  description = "PostgreSQL password"
  type        = string
  sensitive   = true
  default     = ""
}

variable "postgres_db" {
  description = "PostgreSQL database name"
  type        = string
  default     = "postgres"
}

variable "redis_version" {
  description = "Redis container version"
  type        = string
  default     = "latest"
}

variable "redis_storage_size" {
  description = "Redis storage size"
  type        = string
  default     = "1Gi"
}

variable "redis_password" {
  description = "Redis password"
  type        = string
  sensitive   = true
  default     = ""
}

variable "seaweedfs_version" {
  description = "SeaweedFS container version"
  type        = string
  default     = "3.16"
}

variable "seaweedfs_storage_size" {
  description = "SeaweedFS storage size"
  type        = string
  default     = "20Gi"
}

variable "jwt_secret" {
  description = "JWT secret for authentication"
  type        = string
  sensitive   = true
  default     = ""
}

variable "s3_access_key" {
  description = "S3/SeaweedFS access key"
  type        = string
  sensitive   = true
  default     = ""
}

variable "s3_secret_key" {
  description = "S3/SeaweedFS secret key"
  type        = string
  sensitive   = true
  default     = ""
}
