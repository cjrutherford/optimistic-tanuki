#!/bin/bash

set -euo pipefail

SCRIPT_NAME="$(basename "$0")"
DEFAULT_SWAG_NGINX_ROOT="/opt/swag/config/nginx"
DEFAULT_REMOTE_COMPOSE='~/docker-compose.yaml'
DEFAULT_STALWART_IMAGE='stalwartlabs/stalwart:v0.16'
DEFAULT_PRIMARY_DOMAIN='christopherrutherford.net'
DEFAULT_SECONDARY_DOMAIN='optimistic-tanuki.com'
DEFAULT_PRIMARY_MAIL_HOST='mail.christopherrutherford.net'
DEFAULT_SECONDARY_MAIL_HOST='mail.optimistic-tanuki.com'
DRY_RUN=0
SSH_TARGET=""
IPV4=""
IPV6=""
SWAG_NGINX_ROOT="$DEFAULT_SWAG_NGINX_ROOT"
REMOTE_COMPOSE_PATH="$DEFAULT_REMOTE_COMPOSE"
STALWART_IMAGE="$DEFAULT_STALWART_IMAGE"
RECOVERY_ADMIN=""
PRIMARY_DOMAIN="$DEFAULT_PRIMARY_DOMAIN"
SECONDARY_DOMAIN="$DEFAULT_SECONDARY_DOMAIN"
PRIMARY_MAIL_HOST="$DEFAULT_PRIMARY_MAIL_HOST"
SECONDARY_MAIL_HOST="$DEFAULT_SECONDARY_MAIL_HOST"
PRIMARY_MX_TARGET="$DEFAULT_PRIMARY_MAIL_HOST"
COMPOSE_SERVICE_NAME='stalwart'
NGINX_SITE_NAME='stalwart-mail.conf'
TIMESTAMP="$(date +%Y%m%d%H%M%S)"
TMP_DIR=""

usage() {
  cat <<EOF
Usage: $SCRIPT_NAME user@endpoint [options]

Connect to a remote host over SSH, insert a managed Stalwart service into the
remote docker compose file, install a SWAG nginx site config, and upsert the
required Cloudflare DNS records.

Required:
  user@endpoint                 SSH target for the remote host
  --ipv4 ADDRESS               Public IPv4 for mail host DNS records

Optional:
  --ipv6 ADDRESS               Public IPv6 for mail host DNS records
  --recovery-admin USER:PASS   Value for STALWART_RECOVERY_ADMIN
  --remote-compose PATH        Remote docker compose path (default: ~/docker-compose.yaml)
  --swag-nginx-root PATH       Remote SWAG nginx root (default: /opt/swag/config/nginx)
  --stalwart-image IMAGE       Stalwart image tag (default: stalwartlabs/stalwart:v0.16)
  --primary-domain DOMAIN      Primary mail domain (default: christopherrutherford.net)
  --secondary-domain DOMAIN    Secondary mail domain (default: optimistic-tanuki.com)
  --dry-run                    Print planned actions without mutating remote files or DNS
  -h, --help                   Show this help text

Environment:
  CLOUDFLARE_API_TOKEN         Required unless --dry-run is used

Notes:
  - Remote compose file is expected to contain a top-level services: block.
  - Mail host A/AAAA records are created as DNS only (proxied: false).
  - DKIM is intentionally not automated in this script; Stalwart must generate it later.
EOF
}

log() {
  printf '%s\n' "$*"
}

fail() {
  printf 'Error: %s\n' "$*" >&2
  exit 1
}

cleanup() {
  if [ -n "$TMP_DIR" ] && [ -d "$TMP_DIR" ]; then
    rm -rf "$TMP_DIR"
  fi
}

trap cleanup EXIT

require_command() {
  command -v "$1" >/dev/null 2>&1 || fail "Required command not found: $1"
}

run_ssh() {
  local command="$1"
  if [ "$DRY_RUN" -eq 1 ]; then
    log "DRY RUN ssh $SSH_TARGET $command"
    return 0
  fi
  ssh "$SSH_TARGET" "$command"
}

run_scp() {
  local src="$1"
  local dest="$2"
  if [ "$DRY_RUN" -eq 1 ]; then
    log "DRY RUN scp $src $dest"
    return 0
  fi
  scp "$src" "$dest"
}

run_curl_json() {
  local method="$1"
  local url="$2"
  local data="${3:-}"

  if [ "$DRY_RUN" -eq 1 ]; then
    log "DRY RUN curl -X $method $url ${data:+$data}"
    return 0
  fi

  if [ -n "$data" ]; then
    curl -sS -X "$method" "$url" \
      -H "Authorization: Bearer $CLOUDFLARE_API_TOKEN" \
      -H 'Content-Type: application/json' \
      --data "$data"
  else
    curl -sS -X "$method" "$url" \
      -H "Authorization: Bearer $CLOUDFLARE_API_TOKEN" \
      -H 'Content-Type: application/json'
  fi
}

json_escape() {
  node -e 'process.stdout.write(JSON.stringify(process.argv[1]))' "$1"
}

render_stalwart_service() {
  local recovery_line=""
  if [ -n "$RECOVERY_ADMIN" ]; then
    recovery_line="      - STALWART_RECOVERY_ADMIN=$RECOVERY_ADMIN"
  fi

  cat <<EOF
  # BEGIN managed by $SCRIPT_NAME
  $COMPOSE_SERVICE_NAME:
    image: $STALWART_IMAGE
    container_name: $COMPOSE_SERVICE_NAME
    restart: unless-stopped
    environment:
      - STALWART_PUBLIC_URL=https://$PRIMARY_MAIL_HOST
$recovery_line
    ports:
      - "8080:8080"
      - "25:25"
      - "465:465"
      - "587:587"
      - "143:143"
      - "993:993"
      - "110:110"
      - "995:995"
      - "4190:4190"
    volumes:
      - stalwart-etc:/etc/stalwart
      - stalwart-data:/var/lib/stalwart
  # END managed by $SCRIPT_NAME
EOF
}

ensure_top_level_volumes() {
  local compose_file="$1"
  if ! grep -Eq '^volumes:\s*$' "$compose_file"; then
    printf '\nvolumes:\n  stalwart-etc:\n  stalwart-data:\n' >> "$compose_file"
    return
  fi

  if ! grep -Eq '^  stalwart-etc:\s*$' "$compose_file"; then
    printf '  stalwart-etc:\n' >> "$compose_file"
  fi

  if ! grep -Eq '^  stalwart-data:\s*$' "$compose_file"; then
    printf '  stalwart-data:\n' >> "$compose_file"
  fi
}

insert_service_block() {
  local compose_file="$1"
  local service_block_file="$2"

  if grep -Eq "^  ${COMPOSE_SERVICE_NAME}:\s*$" "$compose_file"; then
    log "Compose already contains ${COMPOSE_SERVICE_NAME}; skipping service insertion"
    return
  fi

  grep -Eq '^services:\s*$' "$compose_file" || fail "Remote compose file has no top-level services: block"

  local output_file="$TMP_DIR/docker-compose.updated.yaml"
  awk -v insert_file="$service_block_file" '
    BEGIN {
      in_services = 0;
      inserted = 0;
      while ((getline line < insert_file) > 0) {
        insert_block = insert_block line ORS;
      }
      close(insert_file);
    }
    {
      if ($0 ~ /^services:[[:space:]]*$/) {
        in_services = 1;
        print $0;
        next;
      }

      if (in_services && !inserted && $0 ~ /^[A-Za-z0-9_-]+:[[:space:]]*$/) {
        printf "%s", insert_block;
        inserted = 1;
        in_services = 0;
      }

      print $0;
    }
    END {
      if (in_services && !inserted) {
        printf "%s", insert_block;
      }
    }
  ' "$compose_file" > "$output_file"

  mv "$output_file" "$compose_file"
}

render_nginx_config() {
  cat <<EOF
## managed by $SCRIPT_NAME
server {
    listen 80;
    listen [::]:80;
    server_name $PRIMARY_MAIL_HOST $SECONDARY_MAIL_HOST;
    return 301 https://\$host\$request_uri;
}

map \$http_upgrade \$connection_upgrade {
    default upgrade;
    ''      close;
}

server {
    listen 443 ssl http2;
    listen [::]:443 ssl http2;
    server_name $PRIMARY_MAIL_HOST $SECONDARY_MAIL_HOST;

    include /config/nginx/ssl.conf;

    client_max_body_size 50m;

    location / {
        include /config/nginx/proxy.conf;
        include /config/nginx/resolver.conf;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection \$connection_upgrade;
        proxy_set_header Host \$host;
        proxy_set_header X-Forwarded-Host \$host;
        proxy_set_header X-Forwarded-Proto https;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_read_timeout 300s;
        proxy_send_timeout 300s;

        proxy_pass http://127.0.0.1:8080;
    }
}
EOF
}

zone_lookup() {
  local zone_name="$1"
  local response
  response="$(run_curl_json GET "https://api.cloudflare.com/client/v4/zones?name=$zone_name")"
  [ -n "$response" ] || fail "Failed to resolve Cloudflare zone id for $zone_name"
  node -e '
    const payload = JSON.parse(process.argv[1]);
    if (!payload.success || !payload.result || payload.result.length === 0) {
      process.exit(1);
    }
    process.stdout.write(payload.result[0].id);
  ' "$response" || fail "Cloudflare zone lookup returned no result for $zone_name"
}

record_lookup_id() {
  local zone_id="$1"
  local type="$2"
  local name="$3"
  local response
  response="$(run_curl_json GET "https://api.cloudflare.com/client/v4/zones/$zone_id/dns_records?type=$type&name=$name")"
  if [ -z "$response" ]; then
    printf ''
    return
  fi
  node -e '
    const payload = JSON.parse(process.argv[1]);
    if (!payload.success || !Array.isArray(payload.result) || payload.result.length === 0) {
      process.stdout.write("");
      process.exit(0);
    }
    process.stdout.write(payload.result[0].id || "");
  ' "$response"
}

upsert_dns_record() {
  local zone_id="$1"
  local type="$2"
  local name="$3"
  local content="$4"
  local priority="${5:-}"
  local proxied="${6:-false}"

  local payload
  local name_json
  local content_json

  name_json="$(json_escape "$name")"
  content_json="$(json_escape "$content")"
  payload="{\"type\":\"$type\",\"name\":$name_json,\"content\":$content_json"

  if [ "$type" = 'A' ] || [ "$type" = 'AAAA' ] || [ "$type" = 'CNAME' ]; then
    payload="$payload,\"proxied\":$proxied"
  fi

  if [ -n "$priority" ]; then
    payload="$payload,\"priority\":$priority"
  fi

  payload="$payload}"

  local record_id
  record_id="$(record_lookup_id "$zone_id" "$type" "$name")"

  if [ -n "$record_id" ]; then
    run_curl_json PUT "https://api.cloudflare.com/client/v4/zones/$zone_id/dns_records/$record_id" "$payload" >/dev/null
  else
    run_curl_json POST "https://api.cloudflare.com/client/v4/zones/$zone_id/dns_records" "$payload" >/dev/null
  fi
}

upsert_txt_record() {
  local zone_id="$1"
  local name="$2"
  local content="$3"
  upsert_dns_record "$zone_id" TXT "$name" "$content"
}

update_cloudflare_records() {
  if [ "$DRY_RUN" -eq 1 ]; then
    log "DRY RUN would upsert Cloudflare DNS records for $PRIMARY_DOMAIN and $SECONDARY_DOMAIN"
    return
  fi

  local primary_zone_id secondary_zone_id

  primary_zone_id="$(zone_lookup "$PRIMARY_DOMAIN")"
  secondary_zone_id="$(zone_lookup "$SECONDARY_DOMAIN")"

  upsert_dns_record "$primary_zone_id" A "$PRIMARY_MAIL_HOST" "$IPV4" '' false
  upsert_dns_record "$secondary_zone_id" A "$SECONDARY_MAIL_HOST" "$IPV4" '' false

  if [ -n "$IPV6" ]; then
    upsert_dns_record "$primary_zone_id" AAAA "$PRIMARY_MAIL_HOST" "$IPV6" '' false
    upsert_dns_record "$secondary_zone_id" AAAA "$SECONDARY_MAIL_HOST" "$IPV6" '' false
  fi

  upsert_dns_record "$primary_zone_id" MX "$PRIMARY_DOMAIN" "$PRIMARY_MX_TARGET" '10'
  upsert_dns_record "$secondary_zone_id" MX "$SECONDARY_DOMAIN" "$PRIMARY_MX_TARGET" '10'

  upsert_txt_record "$primary_zone_id" "$PRIMARY_DOMAIN" 'v=spf1 mx -all'
  upsert_txt_record "$secondary_zone_id" "$SECONDARY_DOMAIN" 'v=spf1 mx -all'

  upsert_txt_record "$primary_zone_id" "_dmarc.$PRIMARY_DOMAIN" "v=DMARC1; p=none; rua=mailto:postmaster@$PRIMARY_DOMAIN"
  upsert_txt_record "$secondary_zone_id" "_dmarc.$SECONDARY_DOMAIN" "v=DMARC1; p=none; rua=mailto:postmaster@$SECONDARY_DOMAIN"
}

parse_args() {
  if [ "$#" -eq 0 ]; then
    usage >&2
    exit 1
  fi

  while [ "$#" -gt 0 ]; do
    case "$1" in
      -h|--help)
        usage
        exit 0
        ;;
      --dry-run)
        DRY_RUN=1
        ;;
      --ipv4)
        shift
        [ "$#" -gt 0 ] || fail "--ipv4 requires a value"
        IPV4="$1"
        ;;
      --ipv6)
        shift
        [ "$#" -gt 0 ] || fail "--ipv6 requires a value"
        IPV6="$1"
        ;;
      --remote-compose)
        shift
        [ "$#" -gt 0 ] || fail "--remote-compose requires a value"
        REMOTE_COMPOSE_PATH="$1"
        ;;
      --swag-nginx-root)
        shift
        [ "$#" -gt 0 ] || fail "--swag-nginx-root requires a value"
        SWAG_NGINX_ROOT="$1"
        ;;
      --stalwart-image)
        shift
        [ "$#" -gt 0 ] || fail "--stalwart-image requires a value"
        STALWART_IMAGE="$1"
        ;;
      --recovery-admin)
        shift
        [ "$#" -gt 0 ] || fail "--recovery-admin requires a value"
        RECOVERY_ADMIN="$1"
        ;;
      --primary-domain)
        shift
        [ "$#" -gt 0 ] || fail "--primary-domain requires a value"
        PRIMARY_DOMAIN="$1"
        PRIMARY_MAIL_HOST="mail.$PRIMARY_DOMAIN"
        PRIMARY_MX_TARGET="$PRIMARY_MAIL_HOST"
        ;;
      --secondary-domain)
        shift
        [ "$#" -gt 0 ] || fail "--secondary-domain requires a value"
        SECONDARY_DOMAIN="$1"
        SECONDARY_MAIL_HOST="mail.$SECONDARY_DOMAIN"
        ;;
      --*)
        fail "Unknown option: $1"
        ;;
      *)
        if [ -z "$SSH_TARGET" ]; then
          SSH_TARGET="$1"
        else
          fail "Unexpected positional argument: $1"
        fi
        ;;
    esac
    shift
  done

  [ -n "$SSH_TARGET" ] || fail "Missing required SSH target (user@endpoint)"
  [ -n "$IPV4" ] || fail "--ipv4 is required"

  if [ "$DRY_RUN" -ne 1 ]; then
    [ -n "${CLOUDFLARE_API_TOKEN:-}" ] || fail "CLOUDFLARE_API_TOKEN is required unless --dry-run is used"
  fi
}

prepare_temp_dir() {
  TMP_DIR="$(mktemp -d)"
}

update_remote_compose() {
  local local_compose="$TMP_DIR/docker-compose.yaml"
  local service_block="$TMP_DIR/stalwart-service.yaml"
  local remote_compose_backup="${REMOTE_COMPOSE_PATH}.bak.${TIMESTAMP}"

  render_stalwart_service > "$service_block"

  if [ "$DRY_RUN" -eq 1 ]; then
    log "DRY RUN would fetch remote compose from $REMOTE_COMPOSE_PATH"
    log "DRY RUN would back up remote compose to $remote_compose_backup"
    log "DRY RUN would insert Stalwart service block into $REMOTE_COMPOSE_PATH"
    return
  fi

  run_scp "$SSH_TARGET:$REMOTE_COMPOSE_PATH" "$local_compose"
  insert_service_block "$local_compose" "$service_block"
  ensure_top_level_volumes "$local_compose"

  run_ssh "cp $REMOTE_COMPOSE_PATH $remote_compose_backup"
  run_scp "$local_compose" "$SSH_TARGET:$REMOTE_COMPOSE_PATH"
}

update_remote_nginx() {
  local nginx_dir="$SWAG_NGINX_ROOT/site-confs"
  local remote_nginx_path="$nginx_dir/$NGINX_SITE_NAME"
  local remote_nginx_backup="${remote_nginx_path}.bak.${TIMESTAMP}"
  local local_nginx="$TMP_DIR/$NGINX_SITE_NAME"
  local remote_tmp_path="/tmp/$NGINX_SITE_NAME.$TIMESTAMP"

  render_nginx_config > "$local_nginx"

  if [ "$DRY_RUN" -eq 1 ]; then
    log "DRY RUN would write SWAG config to $remote_nginx_path"
    return
  fi

  run_scp "$local_nginx" "$SSH_TARGET:$remote_tmp_path"
  run_ssh "mkdir -p $nginx_dir"
  run_ssh "if [ -f $remote_nginx_path ]; then cp $remote_nginx_path $remote_nginx_backup; fi"
  run_ssh "mv $remote_tmp_path $remote_nginx_path"
}

print_summary() {
  log "Completed Stalwart + SWAG setup for $SSH_TARGET"
  log "Primary mail host: $PRIMARY_MAIL_HOST"
  log "Secondary mail host: $SECONDARY_MAIL_HOST"
}

main() {
  require_command ssh
  require_command scp
  require_command curl
  require_command awk
  require_command node

  parse_args "$@"
  prepare_temp_dir

  update_remote_compose
  update_remote_nginx
  update_cloudflare_records
  print_summary
}

main "$@"
