#!/bin/bash
# Hachimi Service Status Script

# Get the directory where this script is located
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
cd "$SCRIPT_DIR"

echo "Hachimi Service Status"
echo "======================"
echo ""

# Check backend
if [ -f "$SCRIPT_DIR/backend.pid" ]; then
    BACKEND_PID=$(cat "$SCRIPT_DIR/backend.pid")
    if ps -p $BACKEND_PID > /dev/null 2>&1; then
        echo "✓ Backend:  RUNNING (PID: $BACKEND_PID)"
        echo "  URL:      http://0.0.0.0:5000"
        echo "  Log:      $SCRIPT_DIR/logs/backend.log"
    else
        echo "✗ Backend:  STOPPED (stale PID file)"
    fi
else
    echo "✗ Backend:  STOPPED"
fi

echo ""

# Check frontend
if [ -f "$SCRIPT_DIR/frontend.pid" ]; then
    FRONTEND_PID=$(cat "$SCRIPT_DIR/frontend.pid")
    if ps -p $FRONTEND_PID > /dev/null 2>&1; then
        echo "✓ Frontend: RUNNING (PID: $FRONTEND_PID)"
        echo "  URL:      http://localhost:5173"
        echo "  Log:      $SCRIPT_DIR/logs/frontend.log"
    else
        echo "✗ Frontend: STOPPED (stale PID file)"
    fi
else
    echo "✗ Frontend: STOPPED"
fi

echo ""
echo "======================"
echo ""

# Show recent log entries
if [ -f "$SCRIPT_DIR/logs/backend.log" ]; then
    echo "Recent backend log (last 5 lines):"
    tail -n 5 "$SCRIPT_DIR/logs/backend.log"
    echo ""
fi

if [ -f "$SCRIPT_DIR/logs/frontend.log" ]; then
    echo "Recent frontend log (last 5 lines):"
    tail -n 5 "$SCRIPT_DIR/logs/frontend.log"
    echo ""
fi
