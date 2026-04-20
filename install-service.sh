#!/bin/bash
# Hachimi Service Installation Script

# Get the directory where this script is located
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
cd "$SCRIPT_DIR"

echo "Installing Hachimi Service..."
echo ""

# Make scripts executable
echo "Making scripts executable..."
chmod +x start.sh
chmod +x stop.sh
chmod +x restart.sh
chmod +x status.sh
echo "✓ Scripts are now executable"
echo ""

# Create logs directory
echo "Creating logs directory..."
mkdir -p logs
echo "✓ Logs directory created"
echo ""

# Install systemd service
echo "Installing systemd service..."
sudo cp hachimi.service /etc/systemd/system/
sudo systemctl daemon-reload
echo "✓ Service file installed"
echo ""

# Enable service
echo "Enabling Hachimi service..."
sudo systemctl enable hachimi.service
echo "✓ Service enabled (will start on boot)"
echo ""

echo "Installation complete!"
echo ""
echo "Available commands:"
echo "  sudo systemctl start hachimi    - Start the service"
echo "  sudo systemctl stop hachimi     - Stop the service"
echo "  sudo systemctl restart hachimi  - Restart the service"
echo "  sudo systemctl status hachimi   - Check service status"
echo "  ./status.sh                     - Check detailed status"
echo ""
echo "Or use the scripts directly:"
echo "  ./start.sh    - Start Hachimi"
echo "  ./stop.sh     - Stop Hachimi"
echo "  ./restart.sh  - Restart Hachimi"
echo "  ./status.sh   - Check status"
echo ""
