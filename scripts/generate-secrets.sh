#!/bin/bash
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
SECRETS_FILE="$PROJECT_DIR/.secrets"
OUTPUT_FILE="$PROJECT_DIR/k8s/base/secrets.yaml"
LEGACY_OUTPUT_FILE="$PROJECT_DIR/k8s/secrets/secrets.yaml"
OAUTH_OUTPUT_FILE="$PROJECT_DIR/k8s/base/gateway-oauth-secrets.yaml"
OAUTH_LEGACY_OUTPUT_FILE="$PROJECT_DIR/k8s/secrets/gateway-oauth-secrets.yaml"

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
OAUTH_STATE_SECRET=$(grep "^OAUTH_STATE_SECRET=" "$SECRETS_FILE" | cut -d'=' -f2-)
LEMON_SQUEEZY_WEBHOOK_SECRET=$(grep "^LEMON_SQUEEZY_WEBHOOK_SECRET=" "$SECRETS_FILE" | cut -d'=' -f2- || true)
S3_ACCESS_KEY=$(grep "^S3_ACCESS_KEY=" "$SECRETS_FILE" | cut -d'=' -f2-)
S3_SECRET_KEY=$(grep "^S3_SECRET_KEY=" "$SECRETS_FILE" | cut -d'=' -f2-)
REDIS_PASSWORD=$(grep "^REDIS_PASSWORD=" "$SECRETS_FILE" | cut -d'=' -f2-)
SMTP_HOST=$(grep "^SMTP_HOST=" "$SECRETS_FILE" | cut -d'=' -f2-)
SMTP_PORT=$(grep "^SMTP_PORT=" "$SECRETS_FILE" | cut -d'=' -f2-)
SMTP_SECURE=$(grep "^SMTP_SECURE=" "$SECRETS_FILE" | cut -d'=' -f2-)
SMTP_USER=$(grep "^SMTP_USER=" "$SECRETS_FILE" | cut -d'=' -f2-)
SMTP_PASS=$(grep "^SMTP_PASS=" "$SECRETS_FILE" | cut -d'=' -f2-)
SMTP_FROM=$(grep "^SMTP_FROM=" "$SECRETS_FILE" | cut -d'=' -f2-)
TAILSCALE_OAUTH_CLIENT_ID=$(grep "^TAILSCALE_OAUTH_CLIENT_ID=" "$SECRETS_FILE" | cut -d'=' -f2-)
TAILSCALE_OAUTH_CLIENT_SECRET=$(grep "^TAILSCALE_OAUTH_CLIENT_SECRET=" "$SECRETS_FILE" | cut -d'=' -f2-)
TAILSCALE_FQDN=$(grep "^TAILSCALE_FQDN=" "$SECRETS_FILE" | cut -d'=' -f2-)
GOOGLE_CLIENT_ID=$(grep "^GOOGLE_CLIENT_ID=" "$SECRETS_FILE" | cut -d'=' -f2- || true)
GOOGLE_CLIENT_SECRET=$(grep "^GOOGLE_CLIENT_SECRET=" "$SECRETS_FILE" | cut -d'=' -f2- || true)
GOOGLE_REDIRECT_URI=$(grep "^GOOGLE_REDIRECT_URI=" "$SECRETS_FILE" | cut -d'=' -f2- || true)
GITHUB_CLIENT_ID=$(grep "^GITHUB_CLIENT_ID=" "$SECRETS_FILE" | cut -d'=' -f2- || true)
GITHUB_CLIENT_SECRET=$(grep "^GITHUB_CLIENT_SECRET=" "$SECRETS_FILE" | cut -d'=' -f2- || true)
GITHUB_REDIRECT_URI=$(grep "^GITHUB_REDIRECT_URI=" "$SECRETS_FILE" | cut -d'=' -f2- || true)
MICROSOFT_CLIENT_ID=$(grep "^MICROSOFT_CLIENT_ID=" "$SECRETS_FILE" | cut -d'=' -f2- || true)
MICROSOFT_CLIENT_SECRET=$(grep "^MICROSOFT_CLIENT_SECRET=" "$SECRETS_FILE" | cut -d'=' -f2- || true)
MICROSOFT_REDIRECT_URI=$(grep "^MICROSOFT_REDIRECT_URI=" "$SECRETS_FILE" | cut -d'=' -f2- || true)
FACEBOOK_CLIENT_ID=$(grep "^FACEBOOK_CLIENT_ID=" "$SECRETS_FILE" | cut -d'=' -f2- || true)
FACEBOOK_CLIENT_SECRET=$(grep "^FACEBOOK_CLIENT_SECRET=" "$SECRETS_FILE" | cut -d'=' -f2- || true)
FACEBOOK_REDIRECT_URI=$(grep "^FACEBOOK_REDIRECT_URI=" "$SECRETS_FILE" | cut -d'=' -f2- || true)

if [ -z "$POSTGRES_USER" ] || [ -z "$POSTGRES_PASSWORD" ] || [ -z "$JWT_SECRET" ]; then
    echo "Error: Required secrets not found in .secrets file"
    echo "Please ensure the following are set:"
    echo "  - POSTGRES_USER"
    echo "  - POSTGRES_PASSWORD"
    echo "  - JWT_SECRET"
    exit 1
fi

echo "Generating $OUTPUT_FILE and $LEGACY_OUTPUT_FILE..."

SECRET_CONTENT=$(cat << EOF
apiVersion: v1
kind: Secret
metadata:
  name: optimistic-tanuki-secrets
  namespace: optimistic-tanuki
type: Opaque
stringData:
  POSTGRES_USER: "${POSTGRES_USER}"
  POSTGRES_PASSWORD: "${POSTGRES_PASSWORD}"
  JWT_SECRET: "${JWT_SECRET}"
  OAUTH_STATE_SECRET: "${OAUTH_STATE_SECRET}"
  LEMON_SQUEEZY_WEBHOOK_SECRET: "${LEMON_SQUEEZY_WEBHOOK_SECRET}"
  S3_ACCESS_KEY: "${S3_ACCESS_KEY}"
  S3_SECRET_KEY: "${S3_SECRET_KEY}"
  REDIS_PASSWORD: "${REDIS_PASSWORD}"
  SMTP_HOST: "${SMTP_HOST:-mail.christopherrutherford.net}"
  SMTP_PORT: "${SMTP_PORT:-465}"
  SMTP_SECURE: "${SMTP_SECURE:-true}"
  SMTP_USER: "${SMTP_USER}"
  SMTP_PASS: "${SMTP_PASS}"
  SMTP_FROM: "${SMTP_FROM:-no-reply@christopherrutherford.net}"
  TAILSCALE_OAUTH_CLIENT_ID: "${TAILSCALE_OAUTH_CLIENT_ID}"
  TAILSCALE_OAUTH_CLIENT_SECRET: "${TAILSCALE_OAUTH_CLIENT_SECRET}"
  TAILSCALE_FQDN: "${TAILSCALE_FQDN}"
EOF
)

OAUTH_SECRET_CONTENT=$(cat << EOF
apiVersion: v1
kind: Secret
metadata:
  name: gateway-oauth-secrets
  namespace: optimistic-tanuki
type: Opaque
stringData:
  GOOGLE_CLIENT_ID: "${GOOGLE_CLIENT_ID}"
  GOOGLE_CLIENT_SECRET: "${GOOGLE_CLIENT_SECRET}"
  GOOGLE_REDIRECT_URI: "${GOOGLE_REDIRECT_URI}"
  GITHUB_CLIENT_ID: "${GITHUB_CLIENT_ID}"
  GITHUB_CLIENT_SECRET: "${GITHUB_CLIENT_SECRET}"
  GITHUB_REDIRECT_URI: "${GITHUB_REDIRECT_URI}"
  MICROSOFT_CLIENT_ID: "${MICROSOFT_CLIENT_ID}"
  MICROSOFT_CLIENT_SECRET: "${MICROSOFT_CLIENT_SECRET}"
  MICROSOFT_REDIRECT_URI: "${MICROSOFT_REDIRECT_URI}"
  FACEBOOK_CLIENT_ID: "${FACEBOOK_CLIENT_ID}"
  FACEBOOK_CLIENT_SECRET: "${FACEBOOK_CLIENT_SECRET}"
  FACEBOOK_REDIRECT_URI: "${FACEBOOK_REDIRECT_URI}"
EOF
)

mkdir -p "$(dirname "$LEGACY_OUTPUT_FILE")"
printf "%s\n" "$SECRET_CONTENT" > "$OUTPUT_FILE"
printf "%s\n" "$SECRET_CONTENT" > "$LEGACY_OUTPUT_FILE"
printf "%s\n" "$OAUTH_SECRET_CONTENT" > "$OAUTH_OUTPUT_FILE"
printf "%s\n" "$OAUTH_SECRET_CONTENT" > "$OAUTH_LEGACY_OUTPUT_FILE"

echo "K8s secrets generated successfully at:"
echo "  - $OUTPUT_FILE"
echo "  - $LEGACY_OUTPUT_FILE"
echo "  - $OAUTH_OUTPUT_FILE (gateway only)"
echo "  - $OAUTH_LEGACY_OUTPUT_FILE (gateway only)"
echo ""
echo "To apply to cluster:"
echo "  microk8s kubectl apply -f $OUTPUT_FILE"
echo "  microk8s kubectl apply -f $OAUTH_OUTPUT_FILE"
