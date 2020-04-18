#!/bin/bash
echo "Strat Xvfb display..."
Xvfb :10 -ac &
export DISPLAY=:10
echo "launch Archipel Telemetry Bot..."
exec node index.js