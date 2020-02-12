#!/bin/bash

# functions
valorizedTelemetryBackendIPFunc () {
    if [ ! -f packages/frontend/src/Connection.ori ]
    then
       cp -f packages/frontend/src/Connection.ts packages/frontend/src/Connection.ori
    fi
    cp -f packages/frontend/src/Connection.ori packages/frontend/src/Connection.ts 
    sed -i '/feed/d' packages/frontend/src/Connection.ts 
    sed -i '/https/d' packages/frontend/src/Connection.ts 
    sed -i '20 i private static readonly address = "ws://TELEMETRY_BACKEND_IP:8000/feed/";' packages/frontend/src/Connection.ts 
    sed -i "s/TELEMETRY_BACKEND_IP/$1/g" packages/frontend/src/Connection.ts
}

buildAndServeFrontendFunc () {
    yarn build:all
    serve -s packages/frontend/build -l 3000
}

#main
if [ -z "$REMOTE_PUBLIC_IP_TELEMETRY_BACKEND" ]
then
    echo "REMOTE_PUBLIC_IP_TELEMETRY_BACKEND is empty. Target local Telemetry backend."
    myip="$(dig +short myip.opendns.com @resolver1.opendns.com)"
    echo "My WAN/Public IP address: ${myip}"
    valorizedTelemetryBackendIPFunc ${myip}
    buildAndServeFrontendFunc
else
    echo "\$REMOTE_PUBLIC_IP_TELEMETRY_BACKEND set to $REMOTE_PUBLIC_IP_TELEMETRY_BACKEND"
    valorizedTelemetryBackendIPFunc $REMOTE_PUBLIC_IP_TELEMETRY_BACKEND
    buildAndServeFrontendFunc
fi