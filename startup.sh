#!/bin/bash
# startup.sh - Place this in your project root

# Install fonts if not present (Azure Web Apps with custom startup)
apt-get update
apt-get install -y fontconfig fonts-dejavu-core fonts-liberation
fc-cache -fv

# Set font environment variables
export FONTCONFIG_PATH=/etc/fonts
export XDG_CONFIG_HOME=/tmp

# Set Electron environment variables for headless rendering
export DISPLAY=:99
export ELECTRON_DISABLE_SANDBOX=1
export ELECTRON_DISABLE_GPU=1

# Start your Node.js application
npm start