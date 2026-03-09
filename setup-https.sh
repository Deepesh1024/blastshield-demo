#!/bin/bash
# ─────────────────────────────────────────────────────────────────
# BlastShield NGINX HTTPS Setup Script
# Run this on your EC2 instance to serve sandboxes over HTTPS
# ─────────────────────────────────────────────────────────────────

set -e

echo "╔══════════════════════════════════════════════════╗"
echo "║  BlastShield NGINX HTTPS Setup                   ║"
echo "╚══════════════════════════════════════════════════╝"

# 1. Install NGINX
echo "[1/5] Installing NGINX..."
if command -v apt &>/dev/null; then
  sudo apt update -y && sudo apt install nginx -y
elif command -v yum &>/dev/null; then
  sudo yum install nginx -y
fi

# 2. Generate self-signed SSL certificate
echo "[2/5] Generating self-signed SSL certificate..."
sudo openssl req -x509 -nodes -days 365 \
  -newkey rsa:2048 \
  -keyout /etc/nginx/key.pem \
  -out /etc/nginx/cert.pem \
  -subj "/CN=blastshield-demo"

# 3. Write NGINX config
echo "[3/5] Writing NGINX config..."
sudo tee /etc/nginx/conf.d/blastshield.conf > /dev/null <<'NGINX'
# ── BlastShield Reverse Proxy ────────────────────────────
# Serves Node app (3000) and code-server sandboxes (9000-9100)
# over a single HTTPS endpoint on port 443.

map $http_upgrade $connection_upgrade {
    default upgrade;
    ''      close;
}

server {
    listen 443 ssl;
    server_name _;

    ssl_certificate     /etc/nginx/cert.pem;
    ssl_certificate_key /etc/nginx/key.pem;

    # ── Landing page: proxy to Node.js on port 3000 ──
    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection $connection_upgrade;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # ── Sandbox proxy: /sandbox-proxy/PORT → localhost:PORT ──
    # Uses regex to extract the dynamic port number
    location ~ ^/sandbox-proxy/(\d+)(/.*)?$ {
        set $sandbox_port $1;
        proxy_pass http://127.0.0.1:$sandbox_port$2$is_args$args;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection $connection_upgrade;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;

        # Long timeouts for WebSocket connections
        proxy_read_timeout 86400s;
        proxy_send_timeout 86400s;
    }
}
NGINX

# 4. Remove default site if it conflicts
sudo rm -f /etc/nginx/sites-enabled/default 2>/dev/null || true

# 5. Test and restart NGINX
echo "[4/5] Testing NGINX config..."
sudo nginx -t

echo "[5/5] Restarting NGINX..."
sudo systemctl restart nginx
sudo systemctl enable nginx

echo ""
echo "╔══════════════════════════════════════════════════╗"
echo "║  ✅ HTTPS proxy is live!                         ║"
echo "║                                                  ║"
echo "║  Open: https://YOUR_EC2_IP                       ║"
echo "║  (Click 'Advanced → Proceed' on cert warning)   ║"
echo "╚══════════════════════════════════════════════════╝"
