#!/bin/bash
set -e

echo "Installing Terraform via snap..."

if command -v terraform &> /dev/null; then
    echo "Terraform is already installed: $(terraform version)"
    exit 0
fi

if ! command -v snap &> /dev/null; then
    echo "Error: snap is not installed. Please install snap first."
    echo "On Ubuntu: sudo apt install snapd"
    exit 1
fi

sudo snap install terraform --classic

echo "Terraform installed successfully: $(terraform version)"
