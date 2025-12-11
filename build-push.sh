#!/bin/bash

DOCKERFILES=$(find ./ -type f -iname 'dockerfile')

declare -a app_dockerfile_mapping=()

echo "App Name --> Dockerfile Path"

for dockerfile in $DOCKERFILES; do
    app_name=$(basename "$(dirname "$dockerfile")")
    echo "$app_name --> $dockerfile"
    app_dockerfile_mapping+=("$app_name:$dockerfile")
done

IMAGE_TAG=${BUILD_IMAGE_TAG:-development}

for mapping in "${app_dockerfile_mapping[@]}"; do
    app_name=$(echo "$mapping" | cut -d':' -f1)
    dockerfile_path=$(echo "$mapping" | cut -d':' -f2)

    # Build the Docker image
    echo "Building image for $app_name using $dockerfile_path..."
    docker build -t "$app_name:latest" -t "$app_name:${IMAGE_TAG}" -f "$dockerfile_path" .

    # Push the Docker image
    echo "Pushing image for $app_name..."
    docker push "$app_name:latest"
done