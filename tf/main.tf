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
  config_path = "~/.kube/config"
}

provider "helm" {
  kubernetes {
    config_path = "~/.kube/config"
  }
}

provider "kubernetes" {
  config_path = "~/.kube/config"
}

resource "kubernetes_namespace" "argo_ns" {
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

  set {
    name  = "server.service.type"
    value = "LoadBalancer"
  }

  set {
    name  = "server.extraArgs"
    value = ["--insecure"]
  }

  set {
    name  = "server.ingress.enabled"
    value = "true"
  }

  set {
    name  = "server.ingress.hosts[0]"
    value = var.domain
  }

  set {
    name  = "server.ingress.annotations.kubernetes.io/ingress.class"
    value = "nginx"
  }

  set {
    name  = "dex.enabled"
    value = "false"
  }

  set {
    name  = "prometheus.enabled"
    value = "false"
  }

  set {
    name  = "grafana.enabled"
    value = "false"
  }

  depends_on = [kubernetes_namespace.argo_ns]
}

resource "kubernetes_namespace" "ingress_ns" {
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

  set {
    name  = "controller.service.type"
    value = "LoadBalancer"
  }

  set {
    name  = "controller.admissionWebhooks.enabled"
    value = "false"
  }

  depends_on = [kubernetes_namespace.ingress_ns]
}

resource "kubernetes_namespace" "app_ns" {
  metadata {
    name = "optimistic-tanuki"
    labels = {
      "app.kubernetes.io/name" = "optimistic-tanuki"
    }
  }
}

output "argocd_server" {
  description = "ArgoCD server URL"
  value       = "http://${var.domain}"
}

output "ingress_ip" {
  description = "Ingress controller external IP"
  value       = "Will be assigned by LoadBalancer"
}
