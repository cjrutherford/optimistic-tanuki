#!/bin/bash
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
K8S_BASE_DIR="$PROJECT_DIR/k8s/base"

echo "============================================="
echo "  Generating K8s Deployments from docker-compose"
echo "============================================="

SERVICES=(
    "authentication:3001"
    "profile:3002"
    "social:3003"
    "forum:3015"
    "chat-collector:3007"
    "assets:3005"
    "prompt-proxy:3009"
    "ai-orchestration:3010"
    "telos-docs-service:3008"
    "blogging:3011"
    "permissions:3012"
    "project-planning:3006"
    "store:3009"
    "app-configurator:3014"
    "wellness:3016"
)

CLIENT_SERVICES=(
    "client-interface:8080:4000"
    "forgeofwill:8081:4000"
    "digital-homestead:8082:4000"
    "christopherrutherford-net:8083:4000"
    "owner-console:8084:4000"
    "store-client:8085:4000"
    "configurable-client:8090:4000"
    "d6:8086:4000"
)

mkdir -p "$K8S_BASE_DIR/services"
mkdir -p "$K8S_BASE_DIR/clients"

generate_service_deployment() {
    local name=$1
    local port=$2
    local image_name="cjrutherford/optimistic_tanuki_${name}"
    
    cat > "$K8S_BASE_DIR/services/${name}.yaml" << EOF
apiVersion: apps/v1
kind: Deployment
metadata:
  name: ${name}
  namespace: optimistic-tanuki
spec:
  replicas: 2
  selector:
    matchLabels:
      app: ${name}
  template:
    metadata:
      labels:
        app: ${name}
    spec:
      containers:
        - name: ${name}
          image: ${image_name}:latest
          imagePullPolicy: Always
          ports:
            - containerPort: ${port}
          env:
            - name: NODE_ENV
              value: "production"
            - name: PORT
              value: "${port}"
            - name: POSTGRES_HOST
              value: "postgres"
            - name: POSTGRES_PORT
              value: "5432"
            - name: REDIS_HOST
              value: "redis"
            - name: REDIS_PORT
              value: "6379"
            - name: STORAGE_STRATEGY
              value: "network"
            - name: S3_ENDPOINT
              value: "http://seaweedfs:8888"
            - name: S3_BUCKET
              value: "assets"
          envFrom:
            - secretRef:
                name: optimistic-tanuki-secrets
          resources:
            requests:
              memory: "128Mi"
              cpu: "100m"
            limits:
              memory: "512Mi"
              cpu: "500m"
          livenessProbe:
            tcpSocket:
              port: ${port}
            initialDelaySeconds: 30
            periodSeconds: 10
          readinessProbe:
            tcpSocket:
              port: ${port}
            initialDelaySeconds: 10
            periodSeconds: 5
      restartPolicy: Always
---
apiVersion: v1
kind: Service
metadata:
  name: ${name}
  namespace: optimistic-tanuki
spec:
  selector:
    app: ${name}
  ports:
    - port: ${port}
      targetPort: ${port}
  clusterIP: None
EOF
    echo "Created $K8S_BASE_DIR/services/${name}.yaml"
}

generate_client_deployment() {
    local name=$1
    local port=$2
    local container_port=$3
    local image_name="cjrutherford/optimistic_tanuki_${name}"
    
    cat > "$K8S_BASE_DIR/clients/${name}.yaml" << EOF
apiVersion: apps/v1
kind: Deployment
metadata:
  name: ${name}
  namespace: optimistic-tanuki
spec:
  replicas: 2
  selector:
    matchLabels:
      app: ${name}
  template:
    metadata:
      labels:
        app: ${name}
    spec:
      containers:
        - name: ${name}
          image: ${image_name}:latest
          imagePullPolicy: Always
          ports:
            - containerPort: ${container_port}
          env:
            - name: NODE_ENV
              value: "production"
            - name: PORT
              value: "${container_port}"
            - name: GATEWAY_URL
              value: "http://gateway:3000"
          resources:
            requests:
              memory: "64Mi"
              cpu: "50m"
            limits:
              memory: "256Mi"
              cpu: "250m"
          livenessProbe:
            tcpSocket:
              port: ${container_port}
            initialDelaySeconds: 30
            periodSeconds: 10
          readinessProbe:
            tcpSocket:
              port: ${container_port}
            initialDelaySeconds: 10
            periodSeconds: 5
      restartPolicy: Always
---
apiVersion: v1
kind: Service
metadata:
  name: ${name}
  namespace: optimistic-tanuki
spec:
  selector:
    app: ${name}
  ports:
    - port: ${port}
      targetPort: ${container_port}
  clusterIP: None
EOF
    echo "Created $K8S_BASE_DIR/clients/${name}.yaml"
}

echo "Generating service deployments..."
for service in "${SERVICES[@]}"; do
    name="${service%%:*}"
    port="${service##*:}"
    generate_service_deployment "$name" "$port"
done

echo "Generating client deployments..."
for client in "${CLIENT_SERVICES[@]}"; do
    name="${client%%:*}"
    rest="${client#*:}"
    port="${rest%:*}"
    container_port="${rest##*:}"
    generate_client_deployment "$name" "$port" "$container_port"
done

echo "Updating kustomization.yaml..."
cat > "$K8S_BASE_DIR/kustomization.yaml" << 'EOF'
apiVersion: kustomize.config.k8s.io/v1beta1
kind: Kustomization

namespace: optimistic-tanuki

resources:
  - namespace.yaml
  - postgres.yaml
  - redis.yaml
  - seaweedfs.yaml
  - secrets.yaml
  - gateway.yaml
  - services/
  - clients/
  - ingress.yaml
EOF

echo "All K8s deployment files generated successfully!"
echo ""
echo "To apply to cluster:"
echo "  cd $K8S_BASE_DIR"
echo "  kubectl apply -k ."
