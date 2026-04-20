#!/bin/bash
# Hachimi Service Startup Script

# Get the directory where this script is located
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
cd "$SCRIPT_DIR"

# Log file
LOG_DIR="$SCRIPT_DIR/logs"
mkdir -p "$LOG_DIR"
BACKEND_LOG="$LOG_DIR/backend.log"
FRONTEND_LOG="$LOG_DIR/frontend.log"

echo "Starting Hachimi Service..."
echo "Project directory: $SCRIPT_DIR"

# Start backend
echo "Starting backend server..."
nohup python3 app.py > "$BACKEND_LOG" 2>&1 &
BACKEND_PID=$!
echo $BACKEND_PID > "$SCRIPT_DIR/backend.pid"
echo "Backend started with PID: $BACKEND_PID"

# Wait for backend to start
sleep 3

# Start frontend
echo "Starting frontend server..."
cd "$SCRIPT_DIR/frontend"
nohup npm run dev > "$FRONTEND_LOG" 2>&1 &
FRONTEND_PID=$!
echo $FRONTEND_PID > "$SCRIPT_DIR/frontend.pid"
echo "Frontend started with PID: $FRONTEND_PID"

echo ""
echo "✓ Hachimi Service started successfully!"
echo "  Backend PID: $BACKEND_PID (log: $BACKEND_LOG)"
echo "  Frontend PID: $FRONTEND_PID (log: $FRONTEND_LOG)"
echo ""
echo "  Backend:  http://0.0.0.0:5000"
echo "  Frontend: http://localhost:5173"
echo ""
