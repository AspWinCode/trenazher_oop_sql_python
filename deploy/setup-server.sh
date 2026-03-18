#!/bin/bash
set -e

echo "=== Task Checker Platform — Server Setup ==="
echo ""

# --- 1. Install Docker ---
if ! command -v docker &> /dev/null; then
    echo "[1/5] Installing Docker..."
    apt-get update -qq
    apt-get install -y -qq ca-certificates curl gnupg
    install -m 0755 -d /etc/apt/keyrings
    curl -fsSL https://download.docker.com/linux/ubuntu/gpg | gpg --dearmor -o /etc/apt/keyrings/docker.gpg
    chmod a+r /etc/apt/keyrings/docker.gpg
    echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu $(. /etc/os-release && echo "$VERSION_CODENAME") stable" > /etc/apt/sources.list.d/docker.list
    apt-get update -qq
    apt-get install -y -qq docker-ce docker-ce-cli containerd.io docker-compose-plugin
    systemctl enable docker
    systemctl start docker
    echo "Docker installed."
else
    echo "[1/5] Docker already installed."
fi

# --- 2. Install docker-compose standalone (if not plugin) ---
if ! command -v docker-compose &> /dev/null && ! docker compose version &> /dev/null; then
    echo "[2/5] Installing docker-compose..."
    curl -SL https://github.com/docker/compose/releases/latest/download/docker-compose-linux-x86_64 -o /usr/local/bin/docker-compose
    chmod +x /usr/local/bin/docker-compose
else
    echo "[2/5] docker-compose already available."
fi

# --- 3. Create swap (1 GB RAM is tight) ---
if [ ! -f /swapfile ]; then
    echo "[3/5] Creating 2GB swap..."
    fallocate -l 2G /swapfile
    chmod 600 /swapfile
    mkswap /swapfile
    swapon /swapfile
    echo '/swapfile none swap sw 0 0' >> /etc/fstab
    echo "Swap created."
else
    echo "[3/5] Swap already exists."
fi

# --- 4. Create project directory ---
echo "[4/5] Creating project directory..."
mkdir -p /opt/platform
echo "Directory /opt/platform ready."

# --- 5. Firewall ---
echo "[5/5] Configuring firewall..."
if command -v ufw &> /dev/null; then
    ufw allow 22/tcp
    ufw allow 80/tcp
    ufw allow 443/tcp
    ufw allow 3000/tcp
    ufw allow 8000/tcp
    echo "y" | ufw enable 2>/dev/null || true
    echo "Firewall configured."
else
    echo "UFW not found, skipping."
fi

echo ""
echo "=== Server setup complete ==="
echo "Now copy your project files to /opt/platform/"
echo ""
