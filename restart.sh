#!/bin/bash
# Hachimi Service Restart Script

# Get the directory where this script is located
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
cd "$SCRIPT_DIR"

echo "Restarting Hachimi Service..."
echo ""

# Stop the service
bash "$SCRIPT_DIR/stop.sh"

# Wait a moment
sleep 2

# Start the service
bash "$SCRIPT_DIR/start.sh"
