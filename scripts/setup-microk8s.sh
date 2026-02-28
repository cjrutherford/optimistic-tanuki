#!/bin/bash
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"

echo "============================================="
echo "  Optimistic Tanuki - MicroK8s Setup"
echo "============================================="

check_ubuntu() {
    if [[ ! -r /etc/os-release ]]; then
        echo "Unable to detect OS: /etc/os-release not found"
        exit 1
    fi

    # shellcheck disable=SC1091
    . /etc/os-release

    local os_id="${ID,,}"
    local os_like="${ID_LIKE,,}"

    if [[ "$os_id" == "ubuntu" || "$os_id" == "debian" || "$os_like" == *"ubuntu"* || "$os_like" == *"debian"* ]]; then
        return
    fi

    echo "This script only supports Ubuntu or Debian-based systems."
    echo "Detected: ${PRETTY_NAME:-unknown}"
    exit 1
}

install_microk8s() {
    if command -v microk8s &> /dev/null; then
        echo "MicroK8s is already installed"
        return
    fi
    
    echo "Installing MicroK8s..."
    
    # Install snap on Debian if not present
    if ! command -v snap &> /dev/null; then
        echo "Installing snap..."
        sudo apt-get update
        sudo apt-get install -y snapd
    fi
    
    sudo snap install microk8s --classic --channel=1.29/stable
    
    echo "Adding current user to microk8s group..."
    sudo usermod -aG microk8s $USER
    sudo chown -f -R $USER ~/.kube
    
    echo "MicroK8s installed successfully!"
    echo "Please log out and back in, or run: newgrp microk8s"
}

enable_addons() {
    echo "Enabling MicroK8s addons..."
    
    microk8s enable dns
    microk8s enable hostpath-storage
    microk8s enable ingress
    microk8s enable metallb:192.168.1.240-192.168.1.250
    microk8s enable helm3
    
    echo "Addons enabled successfully!"
}

setup_terraform() {
    echo "Setting up Terraform..."
    
    if ! command -v terraform &> /dev/null; then
        echo "Installing Terraform..."
        sudo apt-get update
        sudo apt-get install -y wget unzip
        
        wget -O /tmp/terraform.zip https://releases.hashicorp.com/terraform/1.7.0/terraform_1.7.0_linux_amd64.zip
        sudo unzip -o /tmp/terraform.zip -d /usr/local/bin/
        rm /tmp/terraform.zip
    fi
    
    cd "$PROJECT_DIR/tf"
    
    echo "Initializing Terraform..."
    terraform init
    
    echo "Validating Terraform configuration..."
    terraform validate
    
    echo "Terraform setup complete!"
}

deploy_infrastructure() {
    echo "Deploying infrastructure with Terraform..."
    
    cd "$PROJECT_DIR/tf"
    
    read -p "Enter ArgoCD admin password: " -s ARGO_PASSWORD
    echo
    
    read -p "Enter your domain (e.g., example.com): " DOMAIN
    
    terraform plan -out=tfplan \
        -var="argo_admin_password=$ARGO_PASSWORD" \
        -var="domain=$DOMAIN"
    
    read -p "Apply Terraform plan? (y/n): " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        terraform apply -auto-approve tfplan
    fi
    
    echo "Infrastructure deployed!"
}

generate_secrets() {
    echo "Generating K8s secrets from .secrets file..."
    
    cd "$PROJECT_DIR"
    
    if [ ! -f ".secrets" ]; then
        echo "Warning: .secrets file not found. Skipping secret generation."
        echo "Run './scripts/generate-secrets.sh' after creating .secrets"
    else
        chmod +x scripts/generate-secrets.sh
        ./scripts/generate-secrets.sh
        
        echo "Applying secrets to cluster..."
        microk8s kubectl apply -f k8s/secrets/secrets.yaml
    fi
}

deploy_argocd_app() {
    echo "Deploying ArgoCD Application..."
    
    cd "$PROJECT_DIR"
    
    microk8s kubectl apply -f k8s/argo-app/application.yaml
    
    echo "ArgoCD Application deployed!"
}

wait_for_argocd() {
    echo "Waiting for ArgoCD to be ready..."
    
    sleep 30
    
    microk8s kubectl get pods -n argocd
    
    echo "ArgoCD is ready!"
}

main() {
    # check_ubuntu
    
    echo "Starting MicroK8s setup..."
    
    if [ "$1" == "--skip-install" ]; then
        echo "Skipping installation..."
    else
        install_microk8s
    fi
    
    enable_addons
    setup_terraform
    
    if [ "$1" == "--deploy" ]; then
        generate_secrets
        deploy_infrastructure
        wait_for_argocd
        deploy_argocd_app
    fi
    
    echo "============================================="
    echo "  Setup Complete!"
    echo "============================================="
    echo ""
    echo "Next steps:"
    echo "1. Run 'newgrp microk8s' to apply group changes"
    echo "2. Run './setup-microk8s.sh --deploy' to deploy infrastructure"
    echo ""
    echo "Useful commands:"
    echo "  microk8s status"
    echo "  microk8s kubectl get pods"
    echo "  microk8s kubectl get services -n argocd"
}

main "$@"
