#!/bin/bash

# Script to run all E2E projects in sequence locally
# utilizing their specific docker-compose environments.

# Export CI=true to prevent Playwright from opening the HTML report interactively
export CI=true

# Cleanup any existing containers from the root docker-compose
echo "🧹 Cleaning up any existing containers..."
docker compose down -v 2>/dev/null || true

PROJECTS=$(ls apps | grep "\-e2e$")
FAILED_PROJECTS=()

# Define port mappings
declare -A PORTS
PORTS["authentication-e2e"]=3001
PORTS["profile-e2e"]=3002
PORTS["social-e2e"]=3003
PORTS["assets-e2e"]=3005
PORTS["blogging-e2e"]=3011
PORTS["gateway-e2e"]=3000
PORTS["permissions-e2e"]=3012
PORTS["project-planning-e2e"]=3006
PORTS["chat-collector-e2e"]=3007
PORTS["prompt-proxy-e2e"]=3009
PORTS["telos-docs-service-e2e"]=3008
PORTS["ai-orchestrator-e2e"]=3010
PORTS["app-configurator-e2e"]=3014
PORTS["client-interface-e2e"]=8080
PORTS["forgeofwill-e2e"]=8081
PORTS["digital-homestead-e2e"]=8082
PORTS["christopherrutherford-net-e2e"]=8083
PORTS["owner-console-e2e"]=8084
PORTS["store-client-e2e"]=8085
PORTS["configurable-client-e2e"]=8090

echo "Found E2E projects:"
echo "$PROJECTS"
echo "--------------------------------"

for PROJECT in $PROJECTS; do
  echo ">>> Processing $PROJECT"

  if [ "$PROJECT" == "full-stack-e2e" ]; then
     echo "Running full-stack-e2e via helper script..."
     if ./run-full-stack-e2e.sh; then
        echo "✅ Tests passed for full-stack-e2e"
     else
        echo "❌ Tests failed for full-stack-e2e"
        FAILED_PROJECTS+=("full-stack-e2e")
        docker compose down -v
     fi
     echo "Stopping main stack..."
     docker compose down -v
     echo "--------------------------------"
     continue
  fi

  # Set environment variables for this project
  if [ -n "${PORTS[$PROJECT]}" ]; then
      export PORT="${PORTS[$PROJECT]}"
      export HOST="localhost"
      export BASE_URL="http://localhost:${PORTS[$PROJECT]}"
      echo "Set env: PORT=$PORT, HOST=$HOST, BASE_URL=$BASE_URL"
  fi

  COMPOSE_FILE="e2e/docker-compose.$PROJECT.yaml"

  # Determine if it's a Jest project
  IS_JEST=false
  if [ -f "apps/$PROJECT/jest.config.ts" ] || [ -f "apps/$PROJECT/jest.config.js" ]; then
      IS_JEST=true
  fi

  if [ -f "$COMPOSE_FILE" ]; then
    echo "Starting environment for $PROJECT..."
    # clean up potential orphans or previous runs
    docker compose -f "$COMPOSE_FILE" down -v 2>/dev/null
    docker compose -f "$COMPOSE_FILE" up -d --build

    echo "Waiting for services to stabilize (30s)..."
    sleep 30

    echo "Running tests for $PROJECT..."
    if [ "$IS_JEST" = true ]; then
        # Unset CI for Jest to avoid nx/jest config issues
        if CI= npx nx e2e "$PROJECT"; then
            echo "✅ Tests passed for $PROJECT"
        else
            echo "❌ Tests failed for $PROJECT"
            FAILED_PROJECTS+=("$PROJECT")
        fi
    else
        # Playwright
        if npx nx e2e "$PROJECT"; then
            echo "✅ Tests passed for $PROJECT"
        else
            echo "❌ Tests failed for $PROJECT"
            FAILED_PROJECTS+=("$PROJECT")
        fi
    fi

    echo "Stopping environment for $PROJECT..."
    docker compose -f "$COMPOSE_FILE" down -v
  else
    echo "⚠️ No docker-compose file found for $PROJECT ($COMPOSE_FILE). Skipping docker setup, running nx e2e directly..."
    if [ "$IS_JEST" = true ]; then
        if CI= npx nx e2e "$PROJECT"; then
             echo "✅ Tests passed for $PROJECT"
        else
             echo "❌ Tests failed for $PROJECT"
             FAILED_PROJECTS+=("$PROJECT")
        fi
    else
        if npx nx e2e "$PROJECT"; then
             echo "✅ Tests passed for $PROJECT"
        else
             echo "❌ Tests failed for $PROJECT"
             FAILED_PROJECTS+=("$PROJECT")
        fi
    fi
  fi

  echo "--------------------------------"
done

echo ""
echo "========================================="
echo "E2E Run Complete"
echo "========================================="

if [ ${#FAILED_PROJECTS[@]} -eq 0 ]; then
    echo "🎉 All E2E projects completed successfully!"
    exit 0
else
    echo "❌ The following projects failed:"
    for PROJ in "${FAILED_PROJECTS[@]}"; do
        echo "  - $PROJ"
    done
    exit 1
fi
