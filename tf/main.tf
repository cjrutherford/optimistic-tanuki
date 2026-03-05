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
      value = "LoadBalancer"
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
    name = "optimistic-tanuki"
    labels = {
      "app.kubernetes.io/name" = "optimistic-tanuki"
    }
  }
}
