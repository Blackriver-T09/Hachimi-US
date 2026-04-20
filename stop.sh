#!/bin/bash
# Hachimi Service Shutdown Script

# Get the directory where this script is located
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
cd "$SCRIPT_DIR"

echo "Stopping Hachimi Service..."

# Stop backend
if [ -f "$SCRIPT_DIR/backend.pid" ]; then
    BACKEND_PID=$(cat "$SCRIPT_DIR/backend.pid")
    if ps -p $BACKEND_PID > /dev/null 2>&1; then
        echo "Stopping backend (PID: $BACKEND_PID)..."
        kill $BACKEND_PID
        sleep 2
        # Force kill if still running
        if ps -p $BACKEND_PID > /dev/null 2>&1; then
            echo "Force stopping backend..."
            kill -9 $BACKEND_PID
        fi
        echo "✓ Backend stopped"
    else
        echo "Backend process not found"
    fi
    rm -f "$SCRIPT_DIR/backend.pid"
else
    echo "Backend PID file not found"
fi

# Stop frontend
if [ -f "$SCRIPT_DIR/frontend.pid" ]; then
    FRONTEND_PID=$(cat "$SCRIPT_DIR/frontend.pid")
    if ps -p $FRONTEND_PID > /dev/null 2>&1; then
        echo "Stopping frontend (PID: $FRONTEND_PID)..."
        kill $FRONTEND_PID
        sleep 2
        # Force kill if still running
        if ps -p $FRONTEND_PID > /dev/null 2>&1; then
            echo "Force stopping frontend..."
            kill -9 $FRONTEND_PID
        fi
        echo "✓ Frontend stopped"
    else
        echo "Frontend process not found"
    fi
    rm -f "$SCRIPT_DIR/frontend.pid"
else
    echo "Frontend PID file not found"
fi

# Also kill any remaining python app.py or vite processes
echo "Cleaning up any remaining processes..."
pkill -f "python3 app.py" 2>/dev/null
pkill -f "vite" 2>/dev/null

echo ""
echo "✓ Hachimi Service stopped successfully!"
echo ""
