#!/bin/sh

set -eu

COMPOSE_FILES="-f docker-compose.yaml -f docker-compose.dev.yaml"
DEV_SEED_SKIP_REFRESH="${DEV_SEED_SKIP_REFRESH:-false}"
DEV_SEED_SKIP_OPTIONAL="${DEV_SEED_SKIP_OPTIONAL:-false}"
GATEWAY_API_URL="${GATEWAY_API_URL:-http://gateway:3000/api}"
GATEWAY_BASE_URL="${GATEWAY_BASE_URL:-http://gateway:3000}"
HOST_GATEWAY_BASE_URL="${HOST_GATEWAY_BASE_URL:-http://127.0.0.1:3000}"
APP_RUNTIME_DIR="/usr/src/app"
CLASSIFIEDS_RUNTIME_DIR="/app"

scoped_fixture_id() {
  fixture_kind="$1"
  fixture_scope="$2"
  fixture_workspace_id="$3"

  node -e '
    const crypto = require("node:crypto");
    const [kind, scope, workspaceId] = process.argv.slice(1);
    const bytes = crypto
      .createHash("sha256")
      .update(`${kind}:${scope}:${workspaceId}`)
      .digest()
      .subarray(0, 16);
    bytes[6] = (bytes[6] & 0x0f) | 0x50;
    bytes[8] = (bytes[8] & 0x3f) | 0x80;
    const hex = bytes.toString("hex");
    process.stdout.write(
      `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`
    );
  ' "$fixture_kind" "$fixture_scope" "$fixture_workspace_id"
}

case "${DEV_SEED_SKIP_REFRESH}" in
  true|false) ;;
  *)
    echo "DEV_SEED_SKIP_REFRESH must be true or false." >&2
    exit 2
    ;;
esac

case "${DEV_SEED_SKIP_OPTIONAL}" in
  true|false) ;;
  *)
    echo "DEV_SEED_SKIP_OPTIONAL must be true or false." >&2
    exit 2
    ;;
esac

if [ -n "${HOST_GATEWAY_READY_URL:-}" ]; then
  :
else
  HOST_GATEWAY_READY_URL="${HOST_GATEWAY_BASE_URL}/api-docs"
fi

run_seed() {
  service="$1"
  workdir="$2"
  shift 2

  echo "Seeding ${service}..."
  docker compose ${COMPOSE_FILES} exec -T "$service" sh -lc '
    workdir="$1"
    shift
    cd "$workdir"
    exec "$@"
  ' sh "${workdir}" "$@"
}

run_seed_with_run() {
  service="$1"
  workdir="$2"
  shift 2

  echo "Seeding ${service}..."
  docker compose ${COMPOSE_FILES} exec -T "$service" sh -lc '
    workdir="$1"
    shift
    cd "$workdir"
    exec "$@"
  ' sh "${workdir}" "$@"
}

run_seed_with_env() {
  service="$1"
  workdir="$2"
  env_key="$3"
  env_value="$4"
  shift 4

  echo "Seeding ${service}..."
  docker compose ${COMPOSE_FILES} exec -T -e "${env_key}=${env_value}" "$service" sh -lc '
    workdir="$1"
    shift
    cd "$workdir"
    exec "$@"
  ' sh "${workdir}" "$@"
}

run_seed_with_run_env() {
  service="$1"
  workdir="$2"
  env_key="$3"
  env_value="$4"
  shift 4

  echo "Seeding ${service}..."
  docker compose ${COMPOSE_FILES} exec -T -e "${env_key}=${env_value}" "$service" sh -lc '
    workdir="$1"
    shift
    cd "$workdir"
    exec "$@"
  ' sh "${workdir}" "$@"
}

run_seed_from_workspace() {
  service="$1"
  workdir="$2"
  shift 2

  echo "Seeding ${service} from workspace mount..."
  docker compose ${COMPOSE_FILES} exec -T "$service" sh -lc '
    workdir="$1"
    shift
    cd "$workdir"
    exec "$@"
  ' sh "${workdir}" "$@"
}

run_seed_from_workspace_env() {
  service="$1"
  workdir="$2"
  env_key="$3"
  env_value="$4"
  shift 4

  echo "Seeding ${service} from workspace mount..."
  docker compose ${COMPOSE_FILES} exec -T -e "${env_key}=${env_value}" "$service" sh -lc '
    workdir="$1"
    shift
    cd "$workdir"
    exec "$@"
  ' sh "${workdir}" "$@"
}

refresh_service() {
  service="$1"

  if [ "${DEV_SEED_SKIP_REFRESH}" = "true" ]; then
    echo "Skipping Compose refresh for ${service} (DEV_SEED_SKIP_REFRESH=true)."
    return 0
  fi

  echo "Refreshing ${service} with current compose configuration..."
  docker compose ${COMPOSE_FILES} up -d --force-recreate --renew-anon-volumes --no-deps "$service"
}

refresh_services() {
  if [ "$#" -eq 0 ]; then
    return 0
  fi

  if [ "${DEV_SEED_SKIP_REFRESH}" = "true" ]; then
    echo "Skipping Compose refresh for services (DEV_SEED_SKIP_REFRESH=true)."
    return 0
  fi

  echo "Refreshing services with current compose configuration..."
  docker compose ${COMPOSE_FILES} up -d --force-recreate --renew-anon-volumes --no-deps "$@"
}

refresh_gateway_safely() {
  gateway_health="$(docker inspect --format '{{.State.Health.Status}}' ot_gateway 2>/dev/null || true)"

  if [ "${gateway_health}" = "healthy" ]; then
    echo "Skipping gateway refresh; healthy gateway has current mounted configuration."
    return 0
  fi

  echo "Refreshing gateway with its development runtime image..."
  docker compose ${COMPOSE_FILES} up -d --build --force-recreate \
    --renew-anon-volumes --no-deps gateway
}

restart_gateway_after_dependencies() {
  if [ "${DEV_SEED_SKIP_REFRESH}" = "true" ]; then
    echo "Skipping gateway restart (DEV_SEED_SKIP_REFRESH=true)."
    return 0
  fi

  echo "Restarting gateway after dependency refreshes..."
  docker compose ${COMPOSE_FILES} restart gateway
}

refresh_app_configurator_safely() {
  app_configurator_status="$(docker inspect --format '{{.State.Status}}' ot_app_configurator 2>/dev/null || true)"
  app_configurator_health="$(docker inspect --format '{{if .State.Health}}{{.State.Health.Status}}{{end}}' ot_app_configurator 2>/dev/null || true)"

  if [ "${app_configurator_status}" = "running" ] &&
    { [ -z "${app_configurator_health}" ] || [ "${app_configurator_health}" = "healthy" ]; }; then
    echo "Skipping app-configurator refresh; current container is running with its mounted seed bundle."
    return 0
  fi

  echo "Refreshing app-configurator with its development runtime image..."
  docker compose ${COMPOSE_FILES} up -d --build --force-recreate \
    --renew-anon-volumes --no-deps app-configurator
}

ensure_development_runtime() {
  project="$1"
  runtime_file="$2"

  if [ -f "$runtime_file" ]; then
    return 0
  fi

  echo "Missing ${runtime_file}; building ${project}:build:development..."
  NX_DAEMON=false NX_ISOLATE_PLUGINS=false pnpm exec nx run "${project}:build:development" --outputStyle=static

  if [ ! -f "$runtime_file" ]; then
    echo "${project} build completed without ${runtime_file}." >&2
    return 1
  fi
}

wait_for_gateway() {
  attempts="${1:-60}"
  delay_seconds="${2:-2}"

  echo "Waiting for gateway at ${HOST_GATEWAY_READY_URL}..."

  while [ "${attempts}" -gt 0 ]; do
    auth_status="$(
      curl -s -o /dev/null -w '%{http_code}' \
        -H 'content-type: application/json' \
        -d '{}' \
        "${HOST_GATEWAY_BASE_URL}/api/authentication/login" || true
    )"

    if curl -fsS "${HOST_GATEWAY_READY_URL}" >/dev/null 2>&1 &&
      [ "${auth_status}" = "400" ]; then
      echo "Gateway is ready."
      return 0
    fi

    attempts=$((attempts - 1))
    sleep "${delay_seconds}"
  done

  echo "Gateway did not become ready in time." >&2
  return 1
}

wait_for_tcp_service() {
  service_host="$1"
  service_port="$2"
  service_label="$3"
  attempts="${4:-60}"
  delay_seconds="${5:-2}"

  echo "Waiting for ${service_label} from app-configurator TCP probe..."

  while [ "${attempts}" -gt 0 ]; do
    if docker compose ${COMPOSE_FILES} exec -T \
      -e "TCP_SERVICE_HOST=${service_host}" \
      -e "TCP_SERVICE_PORT=${service_port}" \
      app-configurator node -e '
        const net = require("node:net");
        const socket = net.createConnection({
          host: process.env.TCP_SERVICE_HOST,
          port: Number(process.env.TCP_SERVICE_PORT),
        });
        socket.setTimeout(5000);
        socket.once("connect", () => {
          socket.end();
          process.exit(0);
        });
        socket.once("timeout", () => {
          socket.destroy();
          process.exit(1);
        });
        socket.once("error", () => process.exit(1));
      ' >/dev/null 2>&1; then
      echo "${service_label} is ready."
      return 0
    fi

    attempts=$((attempts - 1))
    sleep "${delay_seconds}"
  done

  echo "${service_label} did not become ready in time." >&2
  return 1
}

seed_default_owner() {
  owner_name="${OWNER_BOOTSTRAP_NAME:-${DEV_OWNER_NAME:-Development Owner}}"
  owner_email="${OWNER_BOOTSTRAP_EMAIL:-${DEV_OWNER_EMAIL:-owner@optimistic-tanuki.local}}"
  owner_password="${OWNER_BOOTSTRAP_PASSWORD:-${DEV_OWNER_PASSWORD:-DevOwner!123}}"
  owner_payload="$(
    node -e '
      const [name, email, password] = process.argv.slice(1);
      const parts = name.trim().split(/\s+/).filter(Boolean);
      console.log(JSON.stringify({
        fn: parts.shift() || "Development",
        ln: parts.join(" ") || "Owner",
        email,
        password,
        confirm: password,
        bio: "Development owner",
      }));
    ' "$owner_name" "$owner_email" "$owner_password"
  )"

  echo "Provisioning development owner ${owner_email}..."
  owner_response="$(
    curl -sS -w '\n%{http_code}' \
      -H 'content-type: application/json' \
      -H 'x-ot-appscope: owner-console' \
      -H 'x-ot-app-id: owner-console' \
      -d "$owner_payload" \
      "${HOST_GATEWAY_BASE_URL}/api/authentication/register"
  )"
  owner_status="$(printf '%s\n' "$owner_response" | tail -n 1)"
  owner_body="$(printf '%s\n' "$owner_response" | sed '$d')"

  case "$owner_status" in
    2*) echo "Development owner is ready." ;;
    *)
      if printf '%s' "$owner_body" | grep -q 'Owner Console registration is closed'; then
        echo "Development owner already exists."
      else
        echo "Unable to provision development owner: ${owner_body}" >&2
        return 1
      fi
      ;;
  esac
}

SEED_COOKIE_DIR="$(mktemp -d "${TMPDIR:-/tmp}/ot-dev-seed.XXXXXX")"
trap 'rm -rf "$SEED_COOKIE_DIR"' EXIT HUP INT TERM

json_field() {
  json="$1"
  field_path="$2"
  printf '%s' "$json" | node -e '
    const fs = require("node:fs");
    const path = process.argv[1].split(".");
    let value = JSON.parse(fs.readFileSync(0, "utf8"));
    for (const part of path) value = value?.[part];
    if (value === undefined || value === null || value === "") process.exit(1);
    process.stdout.write(String(value));
  ' "$field_path"
}

is_missing_identity_login_response() {
  login_status="$1"
  login_body="$2"

  case "$login_status" in
    401|404) return 0 ;;
    5*) ;;
    *) return 1 ;;
  esac

  printf '%s' "$login_body" | node -e '
    const fs = require("node:fs");
    let body;
    try {
      body = JSON.parse(fs.readFileSync(0, "utf8"));
    } catch {
      process.exit(1);
    }

    const code = [
      body?.code,
      body?.error?.code,
      body?.data?.code,
    ].find((value) => typeof value === "string");
    const message = [
      body?.message,
      body?.error?.message,
      body?.data?.message,
    ].find((value) => typeof value === "string");
    const normalizedCode = String(code || "")
      .trim()
      .toUpperCase()
      .replace(/[^A-Z0-9_\-]/g, "");
    const normalizedMessage = String(message || "")
      .replace(/[\r\n\t]+/g, " ")
      .replace(/\s+/g, " ")
      .trim()
      .toLowerCase();
    const missingIdentityMessages = [
      "user not found",
      "user missing",
      "identity not found",
      "identity missing",
    ];
    const isMissingIdentityMessage =
      missingIdentityMessages.includes(normalizedMessage) ||
      /^login failed:\s+(?:user not found|user missing|identity not found|identity missing)$/.test(
        normalizedMessage
      );

    process.exit(
      [
        "USER_NOT_FOUND",
        "USER_MISSING",
        "IDENTITY_NOT_FOUND",
        "IDENTITY_MISSING",
      ].includes(normalizedCode) ||
      isMissingIdentityMessage
        ? 0
        : 1
    );
  '
}

is_existing_identity_registration_error() {
  registration_status="$1"
  registration_body="$2"

  case "$registration_status" in
    400|409|500) ;;
    *) return 1 ;;
  esac

  registration_error_summary="$(
    printf '%s' "$registration_body" | node -e '
      const fs = require("node:fs");
      let body;
      try {
        body = JSON.parse(fs.readFileSync(0, "utf8"));
      } catch {
        process.exit(1);
      }

      const code = [
        body?.code,
        body?.error?.code,
        body?.data?.code,
      ].find((value) => typeof value === "string");
      const message = [
        body?.message,
        body?.error?.message,
        body?.data?.message,
      ].find((value) => typeof value === "string");
      const normalizedCode = String(code || "")
        .trim()
        .toUpperCase()
        .replace(/[^A-Z0-9_\-]/g, "")
        .slice(0, 80);
      const normalizedMessage = String(message || "")
        .replace(/[\r\n\t]+/g, " ")
        .replace(/\s+/g, " ")
        .trim()
        .slice(0, 160);

      if (
        normalizedCode === "USER_ALREADY_EXISTS" ||
        normalizedMessage === "User already exists" ||
        normalizedMessage === "Registration failed: User already exists"
      ) {
        process.stdout.write(`${normalizedCode}|${normalizedMessage}`);
      }
    '
  )"

  [ -n "$registration_error_summary" ]
}

register_seed_identity() {
  identity_label="$1"
  identity_email="$2"
  identity_password="$3"
  identity_app_scope="$4"
  allow_existing_identity="${5:-false}"

  identity_payload="$(
    node -e '
      const [label, email, password] = process.argv.slice(1);
      console.log(JSON.stringify({
        email,
        fn: "Development",
        ln: label,
        password,
        confirm: password,
        bio: "Development P4.3 fixture identity",
      }));
    ' "$identity_label" "$identity_email" "$identity_password"
  )"

  identity_response="$(
    curl -sS -w '\n%{http_code}' \
      -H 'content-type: application/json' \
      -H "x-ot-appscope: ${identity_app_scope}" \
      -H "x-ot-app-id: ${identity_app_scope}" \
      -d "$identity_payload" \
      "${HOST_GATEWAY_BASE_URL}/api/authentication/register"
  )"
  identity_status="$(printf '%s\n' "$identity_response" | tail -n 1)"
  identity_body="$(printf '%s\n' "$identity_response" | sed '$d')"

  case "$identity_status" in
    201) ;;
    400|409|500)
      if [ "$allow_existing_identity" != "true" ] ||
        ! is_existing_identity_registration_error "$identity_status" "$identity_body"; then
        echo "Unable to provision ${identity_label} fixture identity: HTTP ${identity_status}" >&2
        return 1
      fi
      echo "${identity_label} fixture identity already exists; continuing."
      ;;
    *)
      echo "Unable to provision ${identity_label} fixture identity: HTTP ${identity_status}" >&2
      return 1
      ;;
  esac
}

authenticate_seed_identity() {
  identity_label="$1"
  identity_email="$2"
  identity_password="$3"
  identity_cookie="$4"
  identity_app_scope="${5:-business-site}"

  identity_login="$(
    curl -sS -w '\n%{http_code}' -c "$identity_cookie" \
      -H 'content-type: application/json' \
      -H "x-ot-appscope: ${identity_app_scope}" \
      -H "x-ot-app-id: ${identity_app_scope}" \
      -H 'x-ot-session-mode: cookie' \
      -d "$(node -e '
        const [email, password] = process.argv.slice(1);
        console.log(JSON.stringify({ email, password }));
      ' "$identity_email" "$identity_password")" \
      "${HOST_GATEWAY_BASE_URL}/api/authentication/login"
  )"
  identity_login_status="$(printf '%s\n' "$identity_login" | tail -n 1)"
  if ! printf '%s' "$identity_login_status" | grep -q '^2'; then
    echo "Unable to authenticate ${identity_label} fixture identity: HTTP ${identity_login_status}" >&2
    return 1
  fi

  identity_session="$(
    curl -sS -w '\n%{http_code}' -b "$identity_cookie" \
      -H "x-ot-appscope: ${identity_app_scope}" \
      "${HOST_GATEWAY_BASE_URL}/api/authentication/session"
  )"
  identity_session_status="$(printf '%s\n' "$identity_session" | tail -n 1)"
  identity_session_body="$(printf '%s\n' "$identity_session" | sed '$d')"
  if ! printf '%s' "$identity_session_status" | grep -q '^2'; then
    echo "Unable to resolve ${identity_label} fixture session: HTTP ${identity_session_status}" >&2
    return 1
  fi

  SEED_IDENTITY_USER_ID="$(json_field "$identity_session_body" data.userId)"
  SEED_IDENTITY_PROFILE_ID="$(json_field "$identity_session_body" data.profileId)"
}

attempt_seed_identity_login() {
  identity_label="$1"
  identity_email="$2"
  identity_password="$3"
  identity_cookie="$4"
  identity_app_scope="${5:-business-site}"

  identity_login="$(
    curl -sS -w '\n%{http_code}' -c "$identity_cookie" \
      -H 'content-type: application/json' \
      -H "x-ot-appscope: ${identity_app_scope}" \
      -H "x-ot-app-id: ${identity_app_scope}" \
      -H 'x-ot-session-mode: cookie' \
      -d "$(node -e '
        const [email, password] = process.argv.slice(1);
        console.log(JSON.stringify({ email, password }));
      ' "$identity_email" "$identity_password")" \
      "${HOST_GATEWAY_BASE_URL}/api/authentication/login"
  )"
  identity_login_status="$(printf '%s\n' "$identity_login" | tail -n 1)"
  identity_login_body="$(printf '%s\n' "$identity_login" | sed '$d')"
  SEED_LOGIN_STATUS="$identity_login_status"
  SEED_LOGIN_MISSING_IDENTITY=false

  case "$identity_login_status" in
    2*) ;;
    401|404) return 1 ;;
    5*)
      if is_missing_identity_login_response "$identity_login_status" "$identity_login_body"; then
        SEED_LOGIN_MISSING_IDENTITY=true
        return 1
      fi
      echo "Unable to authenticate ${identity_label} fixture identity: HTTP ${identity_login_status}" >&2
      return 2
      ;;
    *)
      echo "Unable to authenticate ${identity_label} fixture identity: HTTP ${identity_login_status}" >&2
      return 2
      ;;
  esac

  identity_session="$(
    curl -sS -w '\n%{http_code}' -b "$identity_cookie" \
      -H "x-ot-appscope: ${identity_app_scope}" \
      "${HOST_GATEWAY_BASE_URL}/api/authentication/session"
  )"
  identity_session_status="$(printf '%s\n' "$identity_session" | tail -n 1)"
  identity_session_body="$(printf '%s\n' "$identity_session" | sed '$d')"
  if ! printf '%s' "$identity_session_status" | grep -q '^2'; then
    echo "Unable to resolve ${identity_label} fixture session: HTTP ${identity_session_status}" >&2
    return 2
  fi

  SEED_IDENTITY_USER_ID="$(json_field "$identity_session_body" data.userId)"
  SEED_IDENTITY_PROFILE_ID="$(json_field "$identity_session_body" data.profileId)"
}

register_configurable_client_identity() {
  identity_label="$1"
  identity_email="$2"
  identity_password="$3"
  identity_cookie="$4"

  if attempt_seed_identity_login "$identity_label" "$identity_email" \
    "$identity_password" "$identity_cookie" configurable-client; then
    echo "${identity_label} fixture identity already exists; continuing."
    return 0
  fi

  case "$SEED_LOGIN_STATUS" in
    401|404|5*)
      if [ "${SEED_LOGIN_STATUS}" != "401" ] &&
        [ "${SEED_LOGIN_STATUS}" != "404" ] &&
        [ "${SEED_LOGIN_MISSING_IDENTITY}" != "true" ]; then
        echo "Unable to authenticate ${identity_label} fixture identity: HTTP ${SEED_LOGIN_STATUS}" >&2
        return 1
      fi
      register_seed_identity "$identity_label" "$identity_email" \
        "$identity_password" configurable-client
      authenticate_seed_identity "$identity_label" "$identity_email" \
        "$identity_password" "$identity_cookie" configurable-client
      ;;
    *)
      echo "Unable to authenticate ${identity_label} fixture identity: HTTP ${SEED_LOGIN_STATUS}" >&2
      return 1
      ;;
  esac
}

register_seed_identity_login_first() {
  identity_label="$1"
  identity_email="$2"
  identity_password="$3"
  identity_cookie="$4"
  identity_app_scope="${5:-business-site}"

  if attempt_seed_identity_login "$identity_label" "$identity_email" \
    "$identity_password" "$identity_cookie" "$identity_app_scope"; then
    echo "${identity_label} fixture identity already exists; continuing."
    return 0
  fi

  case "$SEED_LOGIN_STATUS" in
    401|404|5*)
      if [ "${SEED_LOGIN_STATUS}" != "401" ] &&
        [ "${SEED_LOGIN_STATUS}" != "404" ] &&
        [ "${SEED_LOGIN_MISSING_IDENTITY}" != "true" ]; then
        echo "Unable to authenticate ${identity_label} fixture identity: HTTP ${SEED_LOGIN_STATUS}" >&2
        return 1
      fi
      register_seed_identity "$identity_label" "$identity_email" \
        "$identity_password" "$identity_app_scope"
      authenticate_seed_identity "$identity_label" "$identity_email" \
        "$identity_password" "$identity_cookie" "$identity_app_scope"
      ;;
    *)
      echo "Unable to authenticate ${identity_label} fixture identity: HTTP ${SEED_LOGIN_STATUS}" >&2
      return 1
      ;;
  esac
}

provision_business_workspace() {
  identity_label="$1"
  identity_profile_id="$2"
  identity_cookie="$3"
  identity_app_scope="${4:-business-site}"
  always_provision="${5:-false}"

  if [ "${identity_app_scope}" = "business-site" ]; then
    expected_slug="owner-${identity_profile_id}"
    expected_name="Your Business"
  else
    expected_slug="owner-${identity_app_scope}-${identity_profile_id}"
    expected_name="${identity_app_scope} workspace"
  fi
  if [ "${always_provision}" != "true" ]; then
    workspace_list="$(
      curl -sS -w '\n%{http_code}' -b "$identity_cookie" \
        -H "x-ot-appscope: ${identity_app_scope}" \
        "${HOST_GATEWAY_BASE_URL}/api/workspaces"
    )"
    workspace_list_status="$(printf '%s\n' "$workspace_list" | tail -n 1)"
    workspace_list_body="$(printf '%s\n' "$workspace_list" | sed '$d')"
    if ! printf '%s' "$workspace_list_status" | grep -q '^2'; then
      echo "Unable to look up ${identity_label} workspaces: HTTP ${workspace_list_status}" >&2
      return 1
    fi

    workspace_lookup="$(
      printf '%s' "$workspace_list_body" | node -e '
        const fs = require("node:fs");
        const [slug, appScope] = process.argv.slice(1);
        const workspaces = JSON.parse(fs.readFileSync(0, "utf8"));
        const workspace = Array.isArray(workspaces)
          ? workspaces.find((entry) =>
              entry?.slug === slug && entry?.appScope === appScope
            )
          : undefined;
        if (workspace?.workspaceId && workspace?.slug) {
          process.stdout.write(`${workspace.workspaceId}\t${workspace.slug}`);
        }
      ' "$expected_slug" "$identity_app_scope"
    )"

    if [ -n "$workspace_lookup" ]; then
      SEED_WORKSPACE_ID="$(printf '%s' "$workspace_lookup" | cut -f 1)"
      SEED_WORKSPACE_SLUG="$(printf '%s' "$workspace_lookup" | cut -f 2)"
      echo "${identity_label} workspace already exists (status 200)."
      return 0
    fi
  fi

  workspace_response="$(
    curl -sS -w '\n%{http_code}' -b "$identity_cookie" \
      -H 'content-type: application/json' \
      -H "x-ot-appscope: ${identity_app_scope}" \
      -H "x-ot-app-id: ${identity_app_scope}" \
      -d "$(node -e '
        const [appScope, slug, displayName] = process.argv.slice(1);
        console.log(JSON.stringify({ appScope, slug, displayName }));
      ' "$identity_app_scope" "$expected_slug" "$expected_name")" \
      -X POST \
      "${HOST_GATEWAY_BASE_URL}/api/workspaces/business-sites/provision"
  )"
  workspace_status="$(printf '%s\n' "$workspace_response" | tail -n 1)"
  workspace_body="$(printf '%s\n' "$workspace_response" | sed '$d')"
  if ! printf '%s' "$workspace_status" | grep -q '^2'; then
    echo "Unable to provision ${identity_label} workspace: HTTP ${workspace_status}" >&2
    return 1
  fi

  SEED_WORKSPACE_ID="$(json_field "$workspace_body" workspace.workspaceId)"
  SEED_WORKSPACE_SLUG="$(json_field "$workspace_body" workspace.slug)"
  if [ -z "$SEED_WORKSPACE_SLUG" ]; then
    echo "Workspace provisioning did not return a stable slug for ${identity_label}." >&2
    return 1
  fi
  echo "${identity_label} workspace provisioned (status ${workspace_status})."
}

demo_app_configuration_payload() {
  payload_mode="$1"
  expected_revision="${2:-}"
  app_scope="${3:-business-site}"
  blog_catalog_id="${4:-}"
  config_name="${5:-demo-app}"
  access_policy="${6:-public}"
  config_domain="${7:-}"

  node - "$payload_mode" "$expected_revision" "$app_scope" "$blog_catalog_id" \
    "$config_name" "$access_policy" "$config_domain" <<'NODE'
const mode = process.argv[2];
const expectedRevision = process.argv[3];
const appScope = process.argv[4];
const blogCatalogId = process.argv[5];
const configName = process.argv[6];
const accessPolicy = process.argv[7];
const configDomain = process.argv[8];
const payload = {
  name: configName,
  description: 'A demonstration application showcasing all features',
  active: true,
  landingPage: {
    layout: 'single-column',
    sections: [
      {
        id: 'hero-1',
        type: 'hero',
        order: 0,
        visible: true,
        title: 'Welcome to Our Platform',
        subtitle: 'Build amazing things with our powerful tools',
        ctaText: 'Get Started',
        ctaLink: '/signup',
      },
      {
        id: 'features-1',
        type: 'features',
        order: 1,
        visible: true,
        title: 'Powerful Features',
        features: [
          {
            title: 'Social Networking',
            description: 'Connect with others and share posts',
            icon: 'people',
          },
          {
            title: 'Task Management',
            description: 'Organize your work efficiently',
            icon: 'task_alt',
          },
        ],
      },
      {
        id: 'cta-1',
        type: 'cta',
        order: 2,
        visible: true,
        title: 'Ready to Get Started?',
        description: 'Join our platform today',
        buttonText: 'Start Free Trial',
        buttonLink: '/signup',
      },
    ],
  },
  routes: [],
  features: {
    social: { enabled: true },
    tasks: { enabled: true },
  },
  theme: {
    primaryColor: '#007bff',
    secondaryColor: '#6c757d',
    backgroundColor: '#ffffff',
    textColor: '#212529',
    fontFamily: 'Arial, sans-serif',
  },
  accessPolicy,
};

if (configDomain) payload.domain = configDomain;

if (appScope === 'configurable-client') {
  if (!blogCatalogId) process.exit(1);
  payload.domain = 'demo-app.configurable-client.local';
  payload.routes = [{
    id: 'blogging-posts-public',
    path: '/blog',
    name: 'Blog',
    componentType: 'feature',
    featureName: 'blogging',
    order: 1,
    showInNav: true,
  }];
  payload.features.blogging = { enabled: true };
  payload.manifest = {
    schemaVersion: 1,
    surfaceType: 'business-site',
    capabilities: {
      'blogging.posts': {
        enabled: true,
        placement: 'public-navigation',
        permissions: ['blog.post.read'],
        resourceRef: { type: 'blog-catalog', id: blogCatalogId },
        deepLink: { path: '/blog', label: 'Blog' },
      },
    },
  };
}

if (configDomain) payload.domain = configDomain;

if (mode === 'update') {
  const revision = Number(expectedRevision);
  if (!Number.isInteger(revision) || revision < 1) {
    process.exit(1);
  }
  payload.expectedRevision = revision;
}

process.stdout.write(JSON.stringify(payload));
NODE
}

demo_app_configuration_matches() {
  existing_body="$1"
  desired_payload="$2"

  printf '%s' "$existing_body" | node -e '
const fs = require("node:fs");

const existing = JSON.parse(fs.readFileSync(0, "utf8"));
const desired = JSON.parse(process.argv[1]);
const fields = [
  "name",
  "description",
  "active",
  "domain",
  "landingPage",
  "routes",
  "features",
  "theme",
  "manifest",
];

process.exit(
  fields.every(
    (field) =>
      (existing?.[field] == null && desired[field] == null) ||
      JSON.stringify(existing?.[field]) === JSON.stringify(desired[field])
  )
    ? 0
    : 1
);
' "$desired_payload"
}

seed_configurable_client_blog_catalog() {
  identity_label="$1"
  identity_cookie="$2"
  identity_workspace_slug="$3"
  app_scope="${4:-configurable-client}"

  encoded_workspace_slug="$(
    node -e 'process.stdout.write(encodeURIComponent(process.argv[1]))' \
      "$identity_workspace_slug"
  )"
  catalog_url="${HOST_GATEWAY_BASE_URL}/api/blog/catalogs/mine?workspaceSlug=${encoded_workspace_slug}"
  catalog_response="$(curl -sS -w '\n%{http_code}' -b "$identity_cookie" \
    -H "x-ot-appscope: ${app_scope}" \
    -H "x-ot-app-id: ${app_scope}" \
    "$catalog_url")"
  catalog_status="$(printf '%s\n' "$catalog_response" | tail -n 1)"
  catalog_body="$(printf '%s\n' "$catalog_response" | sed '$d')"
  if ! printf '%s' "$catalog_status" | grep -q '^2'; then
    echo "Unable to look up ${identity_label} Blog catalogs: HTTP ${catalog_status}" >&2
    return 1
  fi

  CONFIGURABLE_CLIENT_BLOG_CATALOG_ID="$(printf '%s' "$catalog_body" | node -e '
const fs = require("node:fs");
const catalogs = JSON.parse(fs.readFileSync(0, "utf8"));
const catalog = Array.isArray(catalogs)
  ? catalogs.find((entry) => entry?.name === "Configurable Client Blog")
  : undefined;
if (catalog?.id) process.stdout.write(catalog.id);
')"
  if [ -z "$CONFIGURABLE_CLIENT_BLOG_CATALOG_ID" ]; then
    catalog_create_response="$(curl -sS -w '\n%{http_code}' -b "$identity_cookie" \
      -H 'content-type: application/json' \
      -H "x-ot-appscope: ${app_scope}" \
      -H "x-ot-app-id: ${app_scope}" \
      -X POST \
      -d '{"name":"Configurable Client Blog","description":"Published Blog feature fixture"}' \
      "${HOST_GATEWAY_BASE_URL}/api/blog/catalogs?workspaceSlug=${encoded_workspace_slug}")"
    catalog_create_status="$(printf '%s\n' "$catalog_create_response" | tail -n 1)"
    catalog_create_body="$(printf '%s\n' "$catalog_create_response" | sed '$d')"
    if ! printf '%s' "$catalog_create_status" | grep -q '^2'; then
      echo "Unable to create ${identity_label} Blog catalog: HTTP ${catalog_create_status}" >&2
      return 1
    fi
    CONFIGURABLE_CLIENT_BLOG_CATALOG_ID="$(json_field "$catalog_create_body" id)"
  fi
  if [ -z "$CONFIGURABLE_CLIENT_BLOG_CATALOG_ID" ]; then
    echo "Unable to resolve ${identity_label} Blog catalog ID." >&2
    return 1
  fi
  echo "${identity_label} Blog catalog ready (${CONFIGURABLE_CLIENT_BLOG_CATALOG_ID})."
}

seed_configurable_client_blog_post() {
  identity_label="$1"
  identity_cookie="$2"
  identity_workspace_slug="$3"
  identity_author_id="$4"
  identity_catalog_id="$5"
  app_scope="${6:-configurable-client}"

  encoded_workspace_slug="$(
    node -e 'process.stdout.write(encodeURIComponent(process.argv[1]))' \
      "$identity_workspace_slug"
  )"
  encoded_catalog_id="$(
    node -e 'process.stdout.write(encodeURIComponent(process.argv[1]))' \
      "$identity_catalog_id"
  )"
  published_url="${HOST_GATEWAY_BASE_URL}/api/post/published?catalogId=${encoded_catalog_id}"
  published_response="$(curl -sS -w '\n%{http_code}' "$published_url")"
  published_status="$(printf '%s\n' "$published_response" | tail -n 1)"
  published_body="$(printf '%s\n' "$published_response" | sed '$d')"
  if ! printf '%s' "$published_status" | grep -q '^2'; then
    echo "Unable to inspect ${identity_label} Blog posts: HTTP ${published_status}" >&2
    return 1
  fi

  if printf '%s' "$published_body" | node -e '
    const fs = require("node:fs");
    const posts = JSON.parse(fs.readFileSync(0, "utf8"));
    process.exit(
      Array.isArray(posts) && posts.some((post) =>
        post?.title === "Configurable Client launch notes"
      )
        ? 0
        : 1
    );
  '; then
    echo "${identity_label} Blog post already exists; reusing it."
    return 0
  fi

  post_payload="$(node - "$identity_author_id" "$identity_catalog_id" <<'NODE'
const [authorId, catalogId] = process.argv.slice(2);
process.stdout.write(JSON.stringify({
  title: 'Configurable Client launch notes',
  content: '<p>Configurable Client seeded publishing proof.</p>',
  authorId,
  selectedCatalogId: catalogId,
  isDraft: false,
}));
NODE
  )"
  create_response="$(curl -sS -w '\n%{http_code}' -b "$identity_cookie" \
    -H 'content-type: application/json' \
    -H "x-ot-appscope: ${app_scope}" \
    -H "x-ot-app-id: ${app_scope}" \
    -X POST \
    -d "$post_payload" \
    "${HOST_GATEWAY_BASE_URL}/api/post?workspaceSlug=${encoded_workspace_slug}")"
  create_status="$(printf '%s\n' "$create_response" | tail -n 1)"
  create_body="$(printf '%s\n' "$create_response" | sed '$d')"
  if ! printf '%s' "$create_status" | grep -q '^2'; then
    echo "Unable to create ${identity_label} Blog post: HTTP ${create_status}" >&2
    return 1
  fi

  post_id="$(json_field "$create_body" id)"
  echo "${identity_label} Blog post ready (${post_id})."
}

seed_app_configuration() {
  identity_label="$1"
  identity_user_id="$2"
  identity_profile_id="$3"
  identity_workspace_id="$4"
  identity_cookie="$5"
  identity_workspace_slug="$6"
  app_instance_id="$7"
  membership_id="$8"
  app_scope="${9:-business-site}"
  identity_blog_catalog_id="${10:-}"
  config_name="${11:-demo-app}"
  access_policy="${12:-public}"
  config_domain="${13:-}"
  publish_fixture="${14:-false}"

  echo "Seeding ${identity_label} app fixture..."
  echo "Reconciling ${identity_label} app instance, membership, and demo configuration through the supported seed runtime."
  docker compose ${COMPOSE_FILES} exec -T \
    -e "APP_CONFIG_SEED_OWNER_USER_ID=${identity_user_id}" \
    -e "APP_CONFIG_SEED_OWNER_PROFILE_ID=${identity_profile_id}" \
    -e "APP_CONFIG_SEED_WORKSPACE_ID=${identity_workspace_id}" \
    -e "APP_CONFIG_SEED_APP_INSTANCE_ID=${app_instance_id}" \
    -e "APP_CONFIG_SEED_MEMBERSHIP_ID=${membership_id}" \
    -e "APP_CONFIG_SEED_APP_SCOPE=${app_scope}" \
    -e "APP_CONFIG_SEED_BLOG_CATALOG_ID=${identity_blog_catalog_id}" \
    -e "APP_CONFIG_SEED_CONFIG_NAME=${config_name}" \
    -e "APP_CONFIG_SEED_ACCESS_POLICY=${access_policy}" \
    -e "APP_CONFIG_SEED_DOMAIN=${config_domain}" \
    -e "APP_CONFIG_SEED_PUBLISH=${publish_fixture}" \
    app-configurator sh -lc '
      exec node /usr/src/app/dist/apps/app-configurator/seed-script.js
    '

  encoded_workspace_slug="$(
    node -e 'process.stdout.write(encodeURIComponent(process.argv[1]))' \
      "$identity_workspace_slug"
  )"
  encoded_config_name="$(
    node -e 'process.stdout.write(encodeURIComponent(process.argv[1]))' \
      "$config_name"
  )"
  configuration_url="${HOST_GATEWAY_BASE_URL}/api/app-config/by-name/${encoded_config_name}?workspaceSlug=${encoded_workspace_slug}"
  configuration_lookup="$(
    curl -sS -w '\n%{http_code}' -b "$identity_cookie" \
      -H "x-ot-appscope: ${app_scope}" \
      -H "x-ot-app-id: ${app_scope}" \
      "$configuration_url"
  )"
  configuration_lookup_status="$(printf '%s\n' "$configuration_lookup" | tail -n 1)"
  configuration_lookup_body="$(printf '%s\n' "$configuration_lookup" | sed '$d')"

  case "$configuration_lookup_status" in
    2*)
      configuration_id="$(json_field "$configuration_lookup_body" id)"
      configuration_revision="$(json_field "$configuration_lookup_body" revision)"
      desired_payload="$(demo_app_configuration_payload update "$configuration_revision" "$app_scope" "$identity_blog_catalog_id" "$config_name" "$access_policy" "$config_domain")"

      if demo_app_configuration_matches "$configuration_lookup_body" "$desired_payload"; then
      echo "${identity_label} configuration already matches the canonical seed; reusing it."
        return 0
      fi

      echo "${identity_label} configuration differs; reconciling through the supported Gateway update API."
      encoded_configuration_id="$(
        node -e 'process.stdout.write(encodeURIComponent(process.argv[1]))' \
          "$configuration_id"
      )"
      update_response="$(
        curl -sS -w '\n%{http_code}' -b "$identity_cookie" \
          -H 'content-type: application/json' \
          -H "x-ot-appscope: ${app_scope}" \
          -H "x-ot-app-id: ${app_scope}" \
          -X PUT \
          -d "$desired_payload" \
          "${HOST_GATEWAY_BASE_URL}/api/app-config/${encoded_configuration_id}?workspaceSlug=${encoded_workspace_slug}"
      )"
      update_status="$(printf '%s\n' "$update_response" | tail -n 1)"
      if ! printf '%s' "$update_status" | grep -q '^2'; then
        echo "Unable to reconcile ${identity_label} app fixture: HTTP ${update_status}" >&2
        return 1
      fi
      ;;
    *)
      echo "Unable to look up ${identity_label} configuration: HTTP ${configuration_lookup_status}" >&2
      return 1
      ;;
  esac
}

verify_seed_configuration() {
  identity_label="$1"
  identity_cookie="$2"
  workspace_slug="$3"
  app_scope="${4:-business-site}"
  config_name="${5:-demo-app}"

  configuration_response="$(
    curl -sS -w '\n%{http_code}' -b "$identity_cookie" \
      -H "x-ot-appscope: ${app_scope}" \
      -H "x-ot-app-id: ${app_scope}" \
      "${HOST_GATEWAY_BASE_URL}/api/app-config?workspaceSlug=${workspace_slug}"
  )"
  configuration_status="$(printf '%s\n' "$configuration_response" | tail -n 1)"
  configuration_body="$(printf '%s\n' "$configuration_response" | sed '$d')"
  if ! printf '%s' "$configuration_status" | grep -q '^2'; then
    echo "Unable to verify ${identity_label} app fixture: HTTP ${configuration_status}" >&2
    return 1
  fi

  configuration_summary="$(
    printf '%s' "$configuration_body" | node -e '
      const fs = require("node:fs");
      const configName = process.argv[1];
      const configs = JSON.parse(fs.readFileSync(0, "utf8"));
      const config = Array.isArray(configs)
        ? configs.find((entry) => entry?.name === configName)
        : undefined;
      if (!config?.id || !config?.appInstanceId) process.exit(1);
      process.stdout.write(`${config.id}\t${config.appInstanceId}`);
    ' "$config_name"
  )"
  echo "${identity_label} app fixture verified (HTTP ${configuration_status}; config/app ${configuration_summary})."
}

cleanup_legacy_p11_configurations() {
  identity_cookie="$1"
  identity_workspace_slug="$2"
  app_scope="${3:-configurable-client}"

  encoded_workspace_slug="$(
    node -e 'process.stdout.write(encodeURIComponent(process.argv[1]))' \
      "$identity_workspace_slug"
  )"

  for legacy_config_name in p11-joinable p11-request-only p11-private; do
    encoded_config_name="$(
      node -e 'process.stdout.write(encodeURIComponent(process.argv[1]))' \
        "$legacy_config_name"
    )"
    configuration_url="${HOST_GATEWAY_BASE_URL}/api/app-config/by-name/${encoded_config_name}?workspaceSlug=${encoded_workspace_slug}"
    configuration_lookup="$(
      curl -sS -w '\n%{http_code}' -b "$identity_cookie" \
        -H "x-ot-appscope: ${app_scope}" \
        -H "x-ot-app-id: ${app_scope}" \
        "$configuration_url"
    )"
    configuration_lookup_status="$(printf '%s\n' "$configuration_lookup" | tail -n 1)"
    configuration_lookup_body="$(printf '%s\n' "$configuration_lookup" | sed '$d')"

    case "$configuration_lookup_status" in
      2*)
        configuration_id="$(json_field "$configuration_lookup_body" id)" || {
          echo "Unable to identify legacy ${legacy_config_name} configuration." >&2
          return 1
        }
        returned_config_name="$(json_field "$configuration_lookup_body" name)" || {
          echo "Unable to verify legacy ${legacy_config_name} configuration name." >&2
          return 1
        }
        returned_app_scope="$(json_field "$configuration_lookup_body" appScope)" || {
          echo "Unable to verify legacy ${legacy_config_name} configuration app scope." >&2
          return 1
        }
        if [ "$returned_config_name" != "$legacy_config_name" ] ||
          [ "$returned_app_scope" != "$app_scope" ]; then
          echo "Refusing to delete unexpected configuration returned for ${legacy_config_name}." >&2
          return 1
        fi

        encoded_configuration_id="$(
          node -e 'process.stdout.write(encodeURIComponent(process.argv[1]))' \
            "$configuration_id"
        )"
        delete_response="$(
          curl -sS -w '\n%{http_code}' -b "$identity_cookie" \
            -H "x-ot-appscope: ${app_scope}" \
            -H "x-ot-app-id: ${app_scope}" \
            -X DELETE \
            "${HOST_GATEWAY_BASE_URL}/api/app-config/${encoded_configuration_id}?workspaceSlug=${encoded_workspace_slug}"
        )"
        delete_status="$(printf '%s\n' "$delete_response" | tail -n 1)"
        case "$delete_status" in
          2*) echo "Removed legacy ${legacy_config_name} app fixture." ;;
          404) echo "Legacy ${legacy_config_name} app fixture is already absent." ;;
          *)
            echo "Unable to remove legacy ${legacy_config_name} app fixture: HTTP ${delete_status}" >&2
            return 1
            ;;
        esac
        ;;
      404) echo "Legacy ${legacy_config_name} app fixture is already absent." ;;
      *)
        echo "Unable to inspect legacy ${legacy_config_name} app fixture: HTTP ${configuration_lookup_status}" >&2
        return 1
        ;;
    esac
  done
}

build_app_configurator_runtime() {
  if [ "${DEV_SEED_SKIP_REFRESH}" = "true" ] &&
    [ -f ./dist/apps/app-configurator/seed-script.js ]; then
    echo "Reusing existing app-configurator seed runtime (DEV_SEED_SKIP_REFRESH=true)."
    return 0
  fi

  echo "Building app-configurator seed runtime..."
  NX_DAEMON=false NX_ISOLATE_PLUGINS=false pnpm exec nx run app-configurator:build:development --outputStyle=static
  if [ ! -f ./dist/apps/app-configurator/seed-script.js ]; then
    echo "app-configurator build completed without the seed runtime." >&2
    return 1
  fi
}

wait_for_chat_collector() {
  attempts="${1:-30}"
  delay_seconds="${2:-2}"

  echo "Waiting for chat-collector TCP health check..."

  while [ "${attempts}" -gt 0 ]; do
    if docker compose ${COMPOSE_FILES} exec -T social sh -lc '
      cd "$1"
      node -e "const { ClientProxyFactory, Transport } = require(\"@nestjs/microservices\"); const { firstValueFrom, timeout } = require(\"rxjs\"); (async () => { const client = ClientProxyFactory.create({ transport: Transport.TCP, options: { host: process.env.CHAT_COLLECTOR_HOST || \"chat-collector\", port: Number.parseInt(process.env.CHAT_COLLECTOR_PORT || \"3007\", 10) } }); await client.connect(); const result = await firstValueFrom(client.send({ cmd: \"health-check\" }, {}).pipe(timeout(5000))); client.close(); if (!result || result.status !== \"healthy\") { throw new Error(\"chat-collector returned unhealthy status\"); } })().catch((error) => { console.error(error?.message || error); process.exit(1); });"
    ' sh "${APP_RUNTIME_DIR}" >/dev/null 2>&1; then
      echo "chat-collector is ready."
      return 0
    fi

    attempts=$((attempts - 1))
    sleep "${delay_seconds}"
  done

  echo "chat-collector did not become ready in time." >&2
  return 1
}

wait_for_forum() {
  attempts="${1:-30}"
  delay_seconds="${2:-2}"

  echo "Waiting for forum TCP service..."

  while [ "${attempts}" -gt 0 ]; do
    if docker compose ${COMPOSE_FILES} exec -T forum node -e '
      const net = require("node:net");
      const socket = net.createConnection({ host: "127.0.0.1", port: 3015 });
      socket.once("connect", () => socket.end());
      socket.once("close", () => process.exit(0));
      socket.once("error", () => process.exit(1));
      setTimeout(() => process.exit(1), 1000).unref();
    ' >/dev/null 2>&1; then
      echo "forum is ready."
      return 0
    fi

    attempts=$((attempts - 1))
    sleep "${delay_seconds}"
  done

  echo "forum did not become ready in time." >&2
  return 1
}

wait_for_videos() {
  attempts="${1:-60}"
  delay_seconds="${2:-2}"

  echo "Waiting for videos TCP service..."

  while [ "${attempts}" -gt 0 ]; do
    if docker compose ${COMPOSE_FILES} exec -T videos node -e '
      const net = require("node:net");
      const socket = net.createConnection({ host: "127.0.0.1", port: 3022 });
      socket.once("connect", () => socket.end());
      socket.once("close", () => process.exit(0));
      socket.once("error", () => process.exit(1));
      setTimeout(() => process.exit(1), 1000).unref();
    ' >/dev/null 2>&1; then
      echo "videos is ready."
      return 0
    fi

    attempts=$((attempts - 1))
    sleep "${delay_seconds}"
  done

  echo "videos did not become ready in time." >&2
  return 1
}

has_video_seed_media() {
  docker compose ${COMPOSE_FILES} exec -T videos sh -lc '
    source_dir="${VIDEO_SEED_SOURCE_DIR:-/media/TV}"
    find "$source_dir" -type f \
      \( -iname "*.mp4" -o -iname "*.mpeg" -o -iname "*.mov" -o -iname "*.webm" -o -iname "*.mkv" -o -iname "*.avi" -o -iname "*.m3u8" \) \
      -print -quit 2>/dev/null | grep -q .
  '
}

seed_optional_services() {
  optional_phase="$1"

  case "${optional_phase}" in
    pre-core)
      refresh_service telos-docs-service
      run_seed telos-docs-service "${APP_RUNTIME_DIR}" node ./seed-persona.js
      refresh_service permissions
      run_seed permissions "${APP_RUNTIME_DIR}" node ./dist/apps/permissions/seed-permissions.js
      refresh_service forum
      wait_for_forum
      run_seed forum "${APP_RUNTIME_DIR}" node -e 'const { ClientProxyFactory, Transport } = require("@nestjs/microservices"); const { firstValueFrom } = require("rxjs"); (async () => { const client = ClientProxyFactory.create({ transport: Transport.TCP, options: { host: process.env.FORUM_HOST || "forum", port: Number(process.env.FORUM_PORT || 3015) } }); await client.connect(); await firstValueFrom(client.send({ cmd: "SEED_DEMO_FORUM_TOPICS" }, {})); client.close(); })().catch((error) => { console.error(error); process.exit(1); });'
      ;;
    store)
      run_seed store "${APP_RUNTIME_DIR}" node ./seed-store.js
      ;;
    post-core)
      run_seed_with_env social "${APP_RUNTIME_DIR}" GATEWAY_URL "${GATEWAY_API_URL}" node ./seed-social.js
      wait_for_chat_collector
      run_seed_with_run social "${APP_RUNTIME_DIR}" node ./seed-local-communities.js
      run_seed_with_env social "${APP_RUNTIME_DIR}" GATEWAY_URL "${GATEWAY_API_URL}" node ./seed-community-posts.js
      run_seed_with_env classifieds "${CLASSIFIEDS_RUNTIME_DIR}" GATEWAY_URL "${GATEWAY_BASE_URL}" node ./dist/apps/classifieds/seed-classifieds.js
      refresh_service payments
      run_seed_with_run payments "${APP_RUNTIME_DIR}" node ./seed-products.js
      run_seed_from_workspace_env business-site "/app/apps/business-site" GATEWAY_URL "${GATEWAY_API_URL}" node ./src/seed-business.mjs
      ;;
    videos)
      refresh_service videos
      wait_for_videos
      if has_video_seed_media; then
        run_seed_with_media_volume videos "${APP_RUNTIME_DIR}" node ./dist/apps/videos/seed-videos.js
      else
        echo "Skipping video seed: no supported media files were found in VIDEO_SEED_SOURCE_DIR."
      fi
      ;;
    *)
      echo "Unknown optional seed phase: ${optional_phase}." >&2
      return 2
      ;;
  esac
}

run_optional_seeders() {
  if [ "${DEV_SEED_SKIP_OPTIONAL}" = "true" ]; then
    echo "Skipping optional seeders (DEV_SEED_SKIP_OPTIONAL=true)."
  else
    seed_optional_services "$1"
  fi
}

run_optional_seeders pre-core
refresh_gateway_safely
build_app_configurator_runtime
refresh_app_configurator_safely
ensure_development_runtime chat-collector ./dist/apps/chat-collector/main.js
refresh_services store authentication profile social payments assets chat-collector classifieds
run_optional_seeders store
wait_for_tcp_service app-configurator 3014 app-configurator
wait_for_tcp_service authentication 3001 authentication
wait_for_tcp_service profile 3002 profile
restart_gateway_after_dependencies
wait_for_gateway
seed_default_owner

OWNER_COOKIE="${SEED_COOKIE_DIR}/owner.cookies"
FOREIGN_COOKIE="${SEED_COOKIE_DIR}/foreign.cookies"
authenticate_seed_identity owner "${owner_email}" "${owner_password}" "${OWNER_COOKIE}"
OWNER_USER_ID="${SEED_IDENTITY_USER_ID}"
OWNER_PROFILE_ID="${SEED_IDENTITY_PROFILE_ID}"
provision_business_workspace owner "${OWNER_PROFILE_ID}" "${OWNER_COOKIE}"
OWNER_WORKSPACE_ID="${SEED_WORKSPACE_ID}"
OWNER_WORKSPACE_SLUG="${SEED_WORKSPACE_SLUG}"
seed_app_configuration owner \
  "${OWNER_USER_ID}" "${OWNER_PROFILE_ID}" "${OWNER_WORKSPACE_ID}" \
  "${OWNER_COOKIE}" "${OWNER_WORKSPACE_SLUG}" \
  "${APP_CONFIG_SEED_APP_INSTANCE_ID:-$(scoped_fixture_id app-instance business-site "${OWNER_WORKSPACE_ID}")}" \
  "${APP_CONFIG_SEED_MEMBERSHIP_ID:-$(scoped_fixture_id membership business-site "${OWNER_WORKSPACE_ID}")}"
verify_seed_configuration owner "${OWNER_COOKIE}" "${OWNER_WORKSPACE_SLUG}"

CONFIGURABLE_CLIENT_COOKIE="${SEED_COOKIE_DIR}/configurable-client-owner.cookies"
configurable_client_owner_email="${CONFIGURABLE_CLIENT_OWNER_EMAIL:-configurable-client-owner-v2@optimistic-tanuki.local}"
configurable_client_owner_password="${CONFIGURABLE_CLIENT_OWNER_PASSWORD:-DevConfigurableClient!123}"
register_configurable_client_identity configurable-client-owner \
  "${configurable_client_owner_email}" "${configurable_client_owner_password}" \
  "${CONFIGURABLE_CLIENT_COOKIE}"
CONFIGURABLE_CLIENT_USER_ID="${SEED_IDENTITY_USER_ID}"
CONFIGURABLE_CLIENT_PROFILE_ID="${SEED_IDENTITY_PROFILE_ID}"
provision_business_workspace owner-configurable-client "${CONFIGURABLE_CLIENT_PROFILE_ID}" \
  "${CONFIGURABLE_CLIENT_COOKIE}" configurable-client true
CONFIGURABLE_CLIENT_WORKSPACE_ID="${SEED_WORKSPACE_ID}"
CONFIGURABLE_CLIENT_WORKSPACE_SLUG="${SEED_WORKSPACE_SLUG}"
seed_configurable_client_blog_catalog owner-configurable-client \
  "${CONFIGURABLE_CLIENT_COOKIE}" "${CONFIGURABLE_CLIENT_WORKSPACE_SLUG}" configurable-client
seed_configurable_client_blog_post owner-configurable-client \
  "${CONFIGURABLE_CLIENT_COOKIE}" "${CONFIGURABLE_CLIENT_WORKSPACE_SLUG}" \
  "${CONFIGURABLE_CLIENT_PROFILE_ID}" "${CONFIGURABLE_CLIENT_BLOG_CATALOG_ID}" configurable-client
seed_app_configuration owner-configurable-client \
  "${CONFIGURABLE_CLIENT_USER_ID}" "${CONFIGURABLE_CLIENT_PROFILE_ID}" \
  "${CONFIGURABLE_CLIENT_WORKSPACE_ID}" "${CONFIGURABLE_CLIENT_COOKIE}" \
  "${CONFIGURABLE_CLIENT_WORKSPACE_SLUG}" \
  "$(scoped_fixture_id app-instance configurable-client "${CONFIGURABLE_CLIENT_WORKSPACE_ID}")" \
  "$(scoped_fixture_id membership configurable-client "${CONFIGURABLE_CLIENT_WORKSPACE_ID}")" \
  configurable-client "${CONFIGURABLE_CLIENT_BLOG_CATALOG_ID}" \
  demo-app public demo-app.configurable-client.local true
verify_seed_configuration owner-configurable-client "${CONFIGURABLE_CLIENT_COOKIE}" \
  "${CONFIGURABLE_CLIENT_WORKSPACE_SLUG}" configurable-client
cleanup_legacy_p11_configurations "${CONFIGURABLE_CLIENT_COOKIE}" \
  "${CONFIGURABLE_CLIENT_WORKSPACE_SLUG}" configurable-client

# P11 keeps deterministic, published access-policy fixtures in isolated
# configurable-client workspaces. App memberships are scoped to appInstanceId,
# and app instances are one-per-workspace, so sharing the owner workspace would
# make a membership in one discovered app appear in every other fixture.
P11_JOINABLE_COOKIE="${SEED_COOKIE_DIR}/p11-joinable-owner.cookies"
p11_joinable_owner_email="${P11_JOINABLE_OWNER_EMAIL:-p11-joinable-owner@optimistic-tanuki.local}"
p11_joinable_owner_password="${P11_JOINABLE_OWNER_PASSWORD:-DevP11Joinable!123}"
register_configurable_client_identity p11-joinable-owner \
  "${p11_joinable_owner_email}" "${p11_joinable_owner_password}" \
  "${P11_JOINABLE_COOKIE}"
P11_JOINABLE_USER_ID="${SEED_IDENTITY_USER_ID}"
P11_JOINABLE_PROFILE_ID="${SEED_IDENTITY_PROFILE_ID}"
provision_business_workspace p11-joinable-owner "${P11_JOINABLE_PROFILE_ID}" \
  "${P11_JOINABLE_COOKIE}" configurable-client true
P11_JOINABLE_WORKSPACE_ID="${SEED_WORKSPACE_ID}"
P11_JOINABLE_WORKSPACE_SLUG="${SEED_WORKSPACE_SLUG}"
  seed_app_configuration p11-joinable \
  "${P11_JOINABLE_USER_ID}" "${P11_JOINABLE_PROFILE_ID}" \
  "${P11_JOINABLE_WORKSPACE_ID}" "${P11_JOINABLE_COOKIE}" \
  "${P11_JOINABLE_WORKSPACE_SLUG}" \
  "$(scoped_fixture_id app-instance configurable-client "${P11_JOINABLE_WORKSPACE_ID}")" \
  "$(scoped_fixture_id membership configurable-client "${P11_JOINABLE_WORKSPACE_ID}")" \
  configurable-client "${CONFIGURABLE_CLIENT_BLOG_CATALOG_ID}" \
  "Open Community" joinable community.configurable-client.local true
verify_seed_configuration p11-joinable "${P11_JOINABLE_COOKIE}" \
  "${P11_JOINABLE_WORKSPACE_SLUG}" configurable-client "Open Community"
cleanup_legacy_p11_configurations "${P11_JOINABLE_COOKIE}" \
  "${P11_JOINABLE_WORKSPACE_SLUG}" configurable-client

P11_REQUEST_ONLY_COOKIE="${SEED_COOKIE_DIR}/p11-request-only-owner.cookies"
p11_request_only_owner_email="${P11_REQUEST_ONLY_OWNER_EMAIL:-p11-request-only-owner@optimistic-tanuki.local}"
p11_request_only_owner_password="${P11_REQUEST_ONLY_OWNER_PASSWORD:-DevP11RequestOnly!123}"
register_configurable_client_identity p11-request-only-owner \
  "${p11_request_only_owner_email}" "${p11_request_only_owner_password}" \
  "${P11_REQUEST_ONLY_COOKIE}"
P11_REQUEST_ONLY_USER_ID="${SEED_IDENTITY_USER_ID}"
P11_REQUEST_ONLY_PROFILE_ID="${SEED_IDENTITY_PROFILE_ID}"
provision_business_workspace p11-request-only-owner "${P11_REQUEST_ONLY_PROFILE_ID}" \
  "${P11_REQUEST_ONLY_COOKIE}" configurable-client true
P11_REQUEST_ONLY_WORKSPACE_ID="${SEED_WORKSPACE_ID}"
P11_REQUEST_ONLY_WORKSPACE_SLUG="${SEED_WORKSPACE_SLUG}"
  seed_app_configuration p11-request-only \
  "${P11_REQUEST_ONLY_USER_ID}" "${P11_REQUEST_ONLY_PROFILE_ID}" \
  "${P11_REQUEST_ONLY_WORKSPACE_ID}" "${P11_REQUEST_ONLY_COOKIE}" \
  "${P11_REQUEST_ONLY_WORKSPACE_SLUG}" \
  "$(scoped_fixture_id app-instance configurable-client "${P11_REQUEST_ONLY_WORKSPACE_ID}")" \
  "$(scoped_fixture_id membership configurable-client "${P11_REQUEST_ONLY_WORKSPACE_ID}")" \
  configurable-client "${CONFIGURABLE_CLIENT_BLOG_CATALOG_ID}" \
  "Access Request Hub" request-only access.configurable-client.local true
verify_seed_configuration p11-request-only "${P11_REQUEST_ONLY_COOKIE}" \
  "${P11_REQUEST_ONLY_WORKSPACE_SLUG}" configurable-client "Access Request Hub"
cleanup_legacy_p11_configurations "${P11_REQUEST_ONLY_COOKIE}" \
  "${P11_REQUEST_ONLY_WORKSPACE_SLUG}" configurable-client

P11_PRIVATE_COOKIE="${SEED_COOKIE_DIR}/p11-private-owner.cookies"
p11_private_owner_email="${P11_PRIVATE_OWNER_EMAIL:-p11-private-owner@optimistic-tanuki.local}"
p11_private_owner_password="${P11_PRIVATE_OWNER_PASSWORD:-DevP11Private!123}"
register_configurable_client_identity p11-private-owner \
  "${p11_private_owner_email}" "${p11_private_owner_password}" \
  "${P11_PRIVATE_COOKIE}"
P11_PRIVATE_USER_ID="${SEED_IDENTITY_USER_ID}"
P11_PRIVATE_PROFILE_ID="${SEED_IDENTITY_PROFILE_ID}"
provision_business_workspace p11-private-owner "${P11_PRIVATE_PROFILE_ID}" \
  "${P11_PRIVATE_COOKIE}" configurable-client true
P11_PRIVATE_WORKSPACE_ID="${SEED_WORKSPACE_ID}"
P11_PRIVATE_WORKSPACE_SLUG="${SEED_WORKSPACE_SLUG}"
  seed_app_configuration p11-private \
  "${P11_PRIVATE_USER_ID}" "${P11_PRIVATE_PROFILE_ID}" \
  "${P11_PRIVATE_WORKSPACE_ID}" "${P11_PRIVATE_COOKIE}" \
  "${P11_PRIVATE_WORKSPACE_SLUG}" \
  "$(scoped_fixture_id app-instance configurable-client "${P11_PRIVATE_WORKSPACE_ID}")" \
  "$(scoped_fixture_id membership configurable-client "${P11_PRIVATE_WORKSPACE_ID}")" \
  configurable-client "${CONFIGURABLE_CLIENT_BLOG_CATALOG_ID}" \
  "Private Studio" private private.configurable-client.local true
verify_seed_configuration p11-private "${P11_PRIVATE_COOKIE}" \
  "${P11_PRIVATE_WORKSPACE_SLUG}" configurable-client "Private Studio"
cleanup_legacy_p11_configurations "${P11_PRIVATE_COOKIE}" \
  "${P11_PRIVATE_WORKSPACE_SLUG}" configurable-client

foreign_email="${DEV_FOREIGN_EMAIL:-foreign@optimistic-tanuki.local}"
foreign_password="${DEV_FOREIGN_PASSWORD:-DevForeign!123}"
register_seed_identity foreign "${foreign_email}" "${foreign_password}" business-site true
authenticate_seed_identity foreign "${foreign_email}" "${foreign_password}" \
  "${FOREIGN_COOKIE}" business-site
FOREIGN_USER_ID="${SEED_IDENTITY_USER_ID}"
FOREIGN_PROFILE_ID="${SEED_IDENTITY_PROFILE_ID}"
provision_business_workspace foreign "${FOREIGN_PROFILE_ID}" "${FOREIGN_COOKIE}"
FOREIGN_WORKSPACE_ID="${SEED_WORKSPACE_ID}"
FOREIGN_WORKSPACE_SLUG="${SEED_WORKSPACE_SLUG}"
seed_app_configuration foreign \
  "${FOREIGN_USER_ID}" "${FOREIGN_PROFILE_ID}" "${FOREIGN_WORKSPACE_ID}" \
  "${FOREIGN_COOKIE}" "${FOREIGN_WORKSPACE_SLUG}" \
  "${APP_CONFIG_SEED_FOREIGN_APP_INSTANCE_ID:-$(scoped_fixture_id app-instance business-site "${FOREIGN_WORKSPACE_ID}")}" \
  "${APP_CONFIG_SEED_FOREIGN_MEMBERSHIP_ID:-$(scoped_fixture_id membership business-site "${FOREIGN_WORKSPACE_ID}")}"
verify_seed_configuration foreign "${FOREIGN_COOKIE}" "${FOREIGN_WORKSPACE_SLUG}"

run_optional_seeders post-core

run_seed_with_media_volume() {
  service="$1"
  workdir="$2"
  shift 2

  echo "Seeding ${service} inside running container..."
  docker compose ${COMPOSE_FILES} exec -T -e "ASSETS_HOST=assets" "$service" sh -lc '
    workdir="$1"
    shift
    cd "$workdir"
    exec "$@"
  ' sh "${workdir}" "$@"
}

run_seed_with_media_volume_from_image() {
  service="$1"
  workdir="$2"
  shift 2

  echo "Seeding ${service} inside running container..."
  docker compose ${COMPOSE_FILES} exec -T -e "ASSETS_HOST=assets" "$service" sh -lc '
    workdir="$1"
    shift
    cd "$workdir"
    exec "$@"
  ' sh "${workdir}" "$@"
}

run_optional_seeders videos
# Optional: clear videos db before seeding to avoid duplicate slug issues
# docker exec db psql -U postgres -d ot_videos -c "DELETE FROM video; DELETE FROM channel;"

echo "Development seeding complete."
