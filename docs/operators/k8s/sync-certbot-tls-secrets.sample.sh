#!/usr/bin/env bash

set -euo pipefail

NAMESPACE="${NAMESPACE:-optimistic-tanuki}"
LE_DIR="${LE_DIR:-/etc/letsencrypt/live}"

# Each lineage directory below is expected to contain the SAN set used by the
# matching ingress secret group.

sync_tls_secret() {
  local secret_name="$1"
  local cert_path="$2"
  local key_path="$3"

  kubectl create secret tls "$secret_name" \
    --namespace "$NAMESPACE" \
    --cert "$cert_path" \
    --key "$key_path" \
    --dry-run=client \
    -o yaml | kubectl apply -f -
}

sync_tls_secret \
  christopherrutherford-net-public-tls \
  "$LE_DIR/christopherrutherford.net/fullchain.pem" \
  "$LE_DIR/christopherrutherford.net/privkey.pem"

sync_tls_secret \
  optimistic-tanuki-public-tls \
  "$LE_DIR/optimistic-tanuki.com/fullchain.pem" \
  "$LE_DIR/optimistic-tanuki.com/privkey.pem"

sync_tls_secret \
  forgeofwill-public-tls \
  "$LE_DIR/forgeofwill.com/fullchain.pem" \
  "$LE_DIR/forgeofwill.com/privkey.pem"

sync_tls_secret \
  hopefulaspirationsindustries-public-tls \
  "$LE_DIR/hopefulaspirationsindustries.com/fullchain.pem" \
  "$LE_DIR/hopefulaspirationsindustries.com/privkey.pem"

sync_tls_secret \
  towne-square-public-tls \
  "$LE_DIR/towne-square.com/fullchain.pem" \
  "$LE_DIR/towne-square.com/privkey.pem"
