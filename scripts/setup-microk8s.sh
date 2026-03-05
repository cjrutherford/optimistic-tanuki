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

install_snap() {
    if command -v snap &> /dev/null; then
        echo "snap is already installed"
        return
    fi
    
    echo "Installing snap..."
    sudo apt-get update
    sudo apt-get install -y snapd
    echo "snap installed successfully!"
}

install_microk8s() {
    if command -v microk8s &> /dev/null; then
        echo "MicroK8s is already installed"
        return
    fi
    
    echo "Installing MicroK8s..."
    
    install_snap
    
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

main() {
    # check_ubuntu
    
    echo "Starting MicroK8s setup..."
    
    install_microk8s
    enable_addons
    
    echo "============================================="
    echo "  Setup Complete!"
    echo "============================================="
    echo ""
    echo "Next steps:"
    echo "1. Run 'newgrp microk8s' to apply group changes"
    echo "2. Run './scripts/install-terraform.sh' to install Terraform"
    echo "3. Run './scripts/deploy-production.sh' to deploy the infrastructure"
    echo ""
    echo "Useful commands:"
    echo "  microk8s status"
    echo "  microk8s kubectl get pods"
    echo "  microk8s kubectl get services -n argocd"
}

main "$@"
