#!/bin/bash

# Must run as root
if [ "$EUID" -ne 0 ]; then
  echo "Please run as root"
  exit
fi

echo "Starting Security Setup..."

# --- 1. Firewall (UFW) ---
echo "Configuring UFW (Uncomplicated Firewall)..."
# Set defaults
ufw default deny incoming
ufw default allow outgoing

# Allow Essential Ports
ufw allow ssh       # Port 22
ufw allow 80/tcp    # HTTP
ufw allow 443/tcp   # HTTPS

# Enable UFW
echo "Enabling UFW..."
ufw --force enable
ufw status verbose

# --- 2. OpenSSH Hardening ---
echo "Hardening OpenSSH..."
SSHD_CONFIG="/etc/ssh/sshd_config"
BACKUP_CONFIG="/etc/ssh/sshd_config.bak"

# Backup existing config
if [ ! -f "$BACKUP_CONFIG" ]; then
    cp $SSHD_CONFIG $BACKUP_CONFIG
    echo "Backed up sshd_config to $BACKUP_CONFIG"
fi

# Configure settings using sed to replace or append
# Disable Root Login
if grep -q "^PermitRootLogin" $SSHD_CONFIG; then
    sed -i 's/^PermitRootLogin.*/PermitRootLogin no/' $SSHD_CONFIG
else
    echo "PermitRootLogin no" >> $SSHD_CONFIG
fi

# Disable Password Authentication (Force SSH Keys)
if grep -q "^PasswordAuthentication" $SSHD_CONFIG; then
    sed -i 's/^PasswordAuthentication.*/PasswordAuthentication no/' $SSHD_CONFIG
else
    echo "PasswordAuthentication no" >> $SSHD_CONFIG
fi

# Disable Empty Passwords
if grep -q "^PermitEmptyPasswords" $SSHD_CONFIG; then
    sed -i 's/^PermitEmptyPasswords.*/PermitEmptyPasswords no/' $SSHD_CONFIG
else
    echo "PermitEmptyPasswords no" >> $SSHD_CONFIG
fi

# Validate config
sshd -t
if [ $? -eq 0 ]; then
    echo "SSH Config syntax valid. Restarting SSH service..."
    service ssh restart
    echo "WARNING: Do not close this session until you have verified you can login in a new terminal!"
else
    echo "SSH Config syntax error! Reverting..."
    cp $BACKUP_CONFIG $SSHD_CONFIG
fi

echo "Security Setup Complete."
