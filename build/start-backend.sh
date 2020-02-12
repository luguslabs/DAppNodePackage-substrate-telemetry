#!/bin/bash
if [ -z "$REMOTE_PUBLIC_IP_TELEMETRY_BACKEND" ]
then
    echo "REMOTE_PUBLIC_IP_TELEMETRY_BACKEND is empty. Start local telemetry backend and use it."
    telemetry
else
    echo "REMOTE_PUBLIC_IP_TELEMETRY_BACKEND is set to $REMOTE_PUBLIC_IP_TELEMETRY_BACKEND. Do not start local telemetry backend. Frontend must target this remote telemetry backend."
    sleep infinity
fi



