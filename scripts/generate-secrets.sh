#!/bin/bash
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
SECRETS_FILE="$PROJECT_DIR/.secrets"
OUTPUT_FILE="$PROJECT_DIR/k8s/secrets/secrets.yaml"

echo "============================================="
echo "  Generating K8s Secrets from .secrets"
echo "============================================="

if [ ! -f "$SECRETS_FILE" ]; then
    echo "Error: .secrets file not found at $SECRETS_FILE"
    echo "Please copy .secrets.example to .secrets and fill in your values"
    exit 1
fi

echo "Reading secrets from $SECRETS_FILE..."

POSTGRES_USER=$(grep "^POSTGRES_USER=" "$SECRETS_FILE" | cut -d'=' -f2-)
POSTGRES_PASSWORD=$(grep "^POSTGRES_PASSWORD=" "$SECRETS_FILE" | cut -d'=' -f2-)
JWT_SECRET=$(grep "^JWT_SECRET=" "$SECRETS_FILE" | cut -d'=' -f2-)
S3_ACCESS_KEY=$(grep "^S3_ACCESS_KEY=" "$SECRETS_FILE" | cut -d'=' -f2-)
S3_SECRET_KEY=$(grep "^S3_SECRET_KEY=" "$SECRETS_FILE" | cut -d'=' -f2-)
REDIS_PASSWORD=$(grep "^REDIS_PASSWORD=" "$SECRETS_FILE" | cut -d'=' -f2-)

if [ -z "$POSTGRES_USER" ] || [ -z "$POSTGRES_PASSWORD" ] || [ -z "$JWT_SECRET" ]; then
    echo "Error: Required secrets not found in .secrets file"
    echo "Please ensure the following are set:"
    echo "  - POSTGRES_USER"
    echo "  - POSTGRES_PASSWORD"
    echo "  - JWT_SECRET"
    exit 1
fi

echo "Generating $OUTPUT_FILE..."

cat > "$OUTPUT_FILE" << EOF
apiVersion: v1
kind: Secret
metadata:
  name: optimistic-tanuki-secrets
  namespace: optimistic-tanuki
type: Opaque
stringData:
  POSTGRES_USER: ${POSTGRES_USER}
  POSTGRES_PASSWORD: ${POSTGRES_PASSWORD}
  JWT_SECRET: ${JWT_SECRET}
  S3_ACCESS_KEY: ${S3_ACCESS_KEY}
  S3_SECRET_KEY: ${S3_SECRET_KEY}
  REDIS_PASSWORD: ${REDIS_PASSWORD}
EOF

echo "K8s secrets generated successfully at $OUTPUT_FILE"
echo ""
echo "To apply to cluster:"
echo "  microk8s kubectl apply -f $OUTPUT_FILE"
