#!/bin/bash

# 1. Verify we are in a directory with a valid docker-compose file
if ! docker compose config > /dev/null 2>&1; then
    echo "Error: No valid docker-compose.yml found in the current directory."
    exit 1
fi

# 2. Get all service names from the compose file and store them in an array
mapfile -t SERVICES < <(docker compose config --services)

TOTAL_SERVICES=${#SERVICES[@]}
BATCH_SIZE=4

echo "Found $TOTAL_SERVICES services. Starting pull in batches of $BATCH_SIZE..."

# 3. Loop through the array in chunks of 4
for (( i=0; i<$TOTAL_SERVICES; i+=$BATCH_SIZE )); do
    # Slice the array for the current batch
    BATCH=("${SERVICES[@]:$i:$BATCH_SIZE}")
    
    echo "---------------------------------------------------------"
    echo "Pulling batch $(( (i/BATCH_SIZE) + 1 )): ${BATCH[*]}"
    echo "---------------------------------------------------------"
    
    # Run docker compose pull for just these specific services
    docker compose pull "${BATCH[@]}"
    
    # Check if the pull succeeded before moving on
    if [ $? -ne 0 ]; then
        echo "Error pulling batch: ${BATCH[*]}. Exiting script to prevent cascade failure."
        exit 1
    fi
    
    echo "Batch $(( (i/BATCH_SIZE) + 1 )) completed successfully."
done

echo "---------------------------------------------------------"
echo "Success! All $TOTAL_SERVICES services have been pulled."
