#!/bin/bash
# Hachimi Service Uninstallation Script

echo "Uninstalling Hachimi Service..."
echo ""

# Stop the service if running
echo "Stopping service..."
sudo systemctl stop hachimi.service 2>/dev/null
echo "✓ Service stopped"
echo ""

# Disable the service
echo "Disabling service..."
sudo systemctl disable hachimi.service 2>/dev/null
echo "✓ Service disabled"
echo ""

# Remove service file
echo "Removing service file..."
sudo rm -f /etc/systemd/system/hachimi.service
sudo systemctl daemon-reload
echo "✓ Service file removed"
echo ""

echo "Uninstallation complete!"
echo ""
echo "Note: Project files and logs are still in /home/heihe/Hachimi"
echo "You can still use the scripts directly (./start.sh, ./stop.sh, etc.)"
echo ""
