#!/bin/sh

set -eu

usage() {
  cat <<'EOF'
Generate CrowdSec and Grafana credentials without storing secrets in Git.

Usage:
  scripts/generate-observability-credentials.sh --output-dir PATH [options]

Options:
  --namespace NAME              Kubernetes namespace (default: optimistic-tanuki)
  --crowdsec-deployment NAME   CrowdSec LAPI deployment name (default: crowdsec-lapi)
  --crowdsec-container NAME    CrowdSec container name (default: crowdsec)
  --bouncer-name NAME           CrowdSec bouncer name (default: ingress-nginx-bouncer)
  --grafana-user NAME           Grafana administrator username (default: admin)
  --output-dir PATH             New directory for generated, untracked manifests
  --dry-run                     Describe the operation without generating credentials
  -h, --help                    Show this help

The script obtains a valid bouncer API key from CrowdSec LAPI with `cscli`
and generates a Grafana password locally. It writes these files with 0600
permissions: crowdsec-bouncer-credentials.yaml,
grafana-admin-credentials.yaml, and credentials.env.
EOF
}

namespace='optimistic-tanuki'
crowdsec_deployment='crowdsec-lapi'
crowdsec_container='crowdsec'
bouncer_name='ingress-nginx-bouncer'
grafana_user='admin'
output_dir=''
dry_run=false

while [ "$#" -gt 0 ]; do
  case "$1" in
    --namespace) namespace=${2:?missing value for --namespace}; shift 2 ;;
    --crowdsec-deployment) crowdsec_deployment=${2:?missing value for --crowdsec-deployment}; shift 2 ;;
    --crowdsec-container) crowdsec_container=${2:?missing value for --crowdsec-container}; shift 2 ;;
    --bouncer-name) bouncer_name=${2:?missing value for --bouncer-name}; shift 2 ;;
    --grafana-user) grafana_user=${2:?missing value for --grafana-user}; shift 2 ;;
    --output-dir) output_dir=${2:?missing value for --output-dir}; shift 2 ;;
    --dry-run) dry_run=true; shift ;;
    -h|--help) usage; exit 0 ;;
    *) echo "Unknown option: $1" >&2; usage >&2; exit 2 ;;
  esac
done

if [ -z "$output_dir" ]; then
  echo '--output-dir is required; choose an ignored directory or a path outside the repository.' >&2
  exit 2
fi

for name in "$namespace" "$crowdsec_deployment" "$crowdsec_container" "$bouncer_name" "$grafana_user"; do
  case "$name" in
    ''|*[!A-Za-z0-9._-]*)
      echo 'Names may contain only letters, numbers, dots, underscores, and hyphens.' >&2
      exit 2
      ;;
  esac
done

if [ -e "$output_dir" ]; then
  echo "Refusing to use existing output path: $output_dir" >&2
  exit 2
fi

if [ "$dry_run" = true ]; then
  printf '%s\n' "Dry run: would generate a Grafana password and create a CrowdSec bouncer named '$bouncer_name'."
  printf '%s\n' "Dry run: would write Kubernetes Secret manifests to '$output_dir' in namespace '$namespace'."
  exit 0
fi

for command in kubectl openssl mktemp; do
  if ! command -v "$command" >/dev/null 2>&1; then
    echo "Required command is unavailable: $command" >&2
    exit 1
  fi
done

umask 077
mkdir "$output_dir"
temporary_env=$(mktemp)
cleanup() {
  rm -f "$temporary_env"
}
trap cleanup EXIT HUP INT TERM

grafana_password=$(openssl rand -base64 36 | tr -d '\n')
crowdsec_key=$(kubectl --namespace "$namespace" exec "deployment/$crowdsec_deployment" -c "$crowdsec_container" -- \
  cscli bouncers add "$bouncer_name" -o raw)

if [ -z "$crowdsec_key" ]; then
  echo 'CrowdSec returned an empty bouncer API key; no manifests were written.' >&2
  exit 1
fi

printf '%s\n' "BOUNCER_KEY=$crowdsec_key" > "$temporary_env"
kubectl --namespace "$namespace" create secret generic crowdsec-bouncer-credentials \
  --from-env-file="$temporary_env" --dry-run=client -o yaml > "$output_dir/crowdsec-bouncer-credentials.yaml"

printf '%s\n%s\n' "admin-user=$grafana_user" "admin-password=$grafana_password" > "$temporary_env"
kubectl --namespace "$namespace" create secret generic grafana-admin-credentials \
  --from-env-file="$temporary_env" --dry-run=client -o yaml > "$output_dir/grafana-admin-credentials.yaml"

printf '%s\n%s\n%s\n' \
  "GRAFANA_ADMIN_USER=$grafana_user" \
  "GRAFANA_ADMIN_PASSWORD=$grafana_password" \
  "CROWDSEC_BOUNCER_KEY=$crowdsec_key" > "$output_dir/credentials.env"
chmod 600 "$output_dir/crowdsec-bouncer-credentials.yaml" "$output_dir/grafana-admin-credentials.yaml" "$output_dir/credentials.env"

printf '%s\n' 'Generated credentials without printing their values.'
printf '%s\n' "Apply the manifests only after reviewing them in: $output_dir"
