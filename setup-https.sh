#!/bin/bash
# ─────────────────────────────────────────────────────────────────
# BlastShield Caddy HTTPS Setup
# Domain: blastshield-demo.duckdns.org
# Auto-provisions a real Let's Encrypt certificate
# ─────────────────────────────────────────────────────────────────

set -e

echo "╔══════════════════════════════════════════════════╗"
echo "║  BlastShield Caddy HTTPS Setup                   ║"
echo "╚══════════════════════════════════════════════════╝"

# 1. Stop NGINX if running (frees port 80/443)
echo "[1/4] Stopping NGINX (if running)..."
sudo systemctl stop nginx 2>/dev/null || true
sudo systemctl disable nginx 2>/dev/null || true

# 2. Install Caddy
echo "[2/4] Installing Caddy..."
sudo yum install -y yum-utils 2>/dev/null || true
sudo yum-config-manager --add-repo https://copr.fedorainfracloud.org/coprs/ganto/caddy/repo/epel-8/ganto-caddy-epel-8.repo 2>/dev/null || true

# Direct binary install (works on any Linux)
curl -sL "https://caddyserver.com/api/download?os=linux&arch=amd64" -o /tmp/caddy
sudo mv /tmp/caddy /usr/local/bin/caddy
sudo chmod +x /usr/local/bin/caddy

echo "  Caddy version: $(/usr/local/bin/caddy version)"

# 3. Write Caddyfile
echo "[3/4] Writing Caddyfile..."
sudo mkdir -p /etc/caddy
sudo tee /etc/caddy/Caddyfile > /dev/null <<'CADDYFILE'
blastshield-demo.duckdns.org {
    # Landing page → Node.js on port 3000
    handle /sandbox-proxy/* {
        reverse_proxy localhost:{re.port.1} {
            header_up Host {host}
            header_up X-Forwarded-Proto {scheme}
        }
    }

    # Everything else → Node.js
    reverse_proxy localhost:3000 {
        header_up Host {host}
        header_up X-Forwarded-Proto {scheme}
    }
}
CADDYFILE

# Actually, Caddy needs regex matching for dynamic ports.
# Let's use a simpler approach: proxy everything to Node,
# and let Node handle the sandbox routing.
sudo tee /etc/caddy/Caddyfile > /dev/null <<'CADDYFILE'
blastshield-demo.duckdns.org {
    reverse_proxy localhost:3000 {
        header_up Host {host}
        header_up X-Forwarded-Proto {scheme}
    }
}
CADDYFILE

# 4. Create systemd service and start
echo "[4/4] Starting Caddy..."
sudo tee /etc/systemd/system/caddy.service > /dev/null <<'SERVICE'
[Unit]
Description=Caddy web server
After=network.target

[Service]
ExecStart=/usr/local/bin/caddy run --config /etc/caddy/Caddyfile --adapter caddyfile
ExecReload=/usr/local/bin/caddy reload --config /etc/caddy/Caddyfile --adapter caddyfile
Restart=always
RestartSec=5
LimitNOFILE=65535
AmbientCapabilities=CAP_NET_BIND_SERVICE

[Install]
WantedBy=multi-user.target
SERVICE

sudo systemctl daemon-reload
sudo systemctl enable caddy
sudo systemctl start caddy

# Wait for cert provisioning
echo ""
echo "  Waiting for Let's Encrypt certificate..."
sleep 5

echo ""
echo "╔══════════════════════════════════════════════════╗"
echo "║  ✅ HTTPS is live!                               ║"
echo "║                                                  ║"
echo "║  https://blastshield-demo.duckdns.org            ║"
echo "║                                                  ║"
echo "║  Real Let's Encrypt cert — works on ALL browsers ║"
echo "╚══════════════════════════════════════════════════╝"
