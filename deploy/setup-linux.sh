#!/usr/bin/env bash
set -euo pipefail

# TDrive VPS Deployment Script (Ubuntu/Debian)
# Usage: bash deploy/setup-linux.sh

APP_NAME="tdrive"
APP_DIR="/opt/${APP_NAME}"
APP_USER="tdrive"
DB_NAME="tdrive"
DB_USER="postgres"
API_PORT=3001
WEB_PORT=3000
NODE_ENV="production"

echo "🔥 TDrive VPS Deployment"
echo "========================"

# 1. System dependencies
echo ""
echo "[1/8] Installing system dependencies..."
apt-get update -qq
apt-get install -y -qq curl wget gnupg2 unzip build-essential

# 2. Install Bun
echo ""
echo "[2/8] Installing Bun..."
if ! command -v bun &> /dev/null; then
  curl -fsSL https://bun.sh/install | bash
  export BUN_INSTALL="$HOME/.bun"
  export PATH="$BUN_INSTALL/bin:$PATH"
fi
echo "  Bun version: $(bun --version)"

# 3. Install PostgreSQL
echo ""
echo "[3/8] Installing PostgreSQL..."
if ! command -v psql &> /dev/null; then
  apt-get install -y -qq postgresql postgresql-contrib
fi
systemctl enable postgresql
systemctl start postgresql

# Create database
su - postgres -c "psql -tc \"SELECT 1 FROM pg_roles WHERE rolname='${APP_USER}'\" | grep -q 1 || psql -c \"CREATE USER ${APP_USER} WITH PASSWORD '${APP_USER}';\"" 2>/dev/null || true
su - postgres -c "psql -tc \"SELECT 1 FROM pg_database WHERE datname='${DB_NAME}'\" | grep -q 1 || psql -c \"CREATE DATABASE ${DB_NAME} OWNER ${APP_USER};\"" 2>/dev/null || true
su - postgres -c "psql -c \"GRANT ALL PRIVILEGES ON DATABASE ${DB_NAME} TO ${APP_USER};\"" 2>/dev/null || true
echo "  Database ${DB_NAME} ready."

# 4. Install Redis
echo ""
echo "[4/8] Installing Redis..."
if ! command -v redis-cli &> /dev/null; then
  apt-get install -y -qq redis-server
fi
systemctl enable redis-server
systemctl start redis-server
echo "  Redis running on port 6379."

# 5. Create app user and deploy code
echo ""
echo "[5/8] Deploying application..."
if ! id "${APP_USER}" &>/dev/null; then
  useradd -m -s /bin/bash "${APP_USER}"
fi

# Copy app files (assumes script runs from project root)
if [ ! -d "${APP_DIR}" ]; then
  mkdir -p "${APP_DIR}"
fi

# Copy current directory to app dir
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "${SCRIPT_DIR}")"
rsync -a --exclude='node_modules' --exclude='.git' --exclude='apps/api/node_modules' --exclude='apps/web/node_modules' "${PROJECT_DIR}/" "${APP_DIR}/"

chown -R "${APP_USER}:${APP_USER}" "${APP_DIR}"

# 6. Setup environment
echo ""
echo "[6/8] Configuring environment..."
if [ ! -f "${APP_DIR}/.env" ]; then
  cp "${APP_DIR}/.env.production.example" "${APP_DIR}/.env"
  # Generate random secrets
  JWT_SECRET=$(openssl rand -hex 32)
  ENCRYPTION_KEY=$(openssl rand -hex 32)
  sed -i "s/JWT_SECRET=.*/JWT_SECRET=${JWT_SECRET}/" "${APP_DIR}/.env"
  sed -i "s/ENCRYPTION_KEY=.*/ENCRYPTION_KEY=${ENCRYPTION_KEY}/" "${APP_DIR}/.env"
  sed -i "s/DATABASE_URL=.*/DATABASE_URL=postgresql:\/\/${APP_USER}:${APP_USER}@localhost:5432\/${DB_NAME}/" "${APP_DIR}/.env"
  echo "  .env created with random secrets."
else
  echo "  .env already exists, skipping."
fi

# 7. Install dependencies and build
echo ""
echo "[7/8] Installing dependencies and building..."
cd "${APP_DIR}"
su - "${APP_USER}" -c "cd ${APP_DIR} && bun install --frozen-lockfile 2>/dev/null || bun install"
su - "${APP_USER}" -c "cd ${APP_DIR} && bun run db:push 2>/dev/null || true"
su - "${APP_USER}" -c "cd ${APP_DIR}/apps/web && bun run build 2>/dev/null || true"

# 8. Create systemd services
echo ""
echo "[8/8] Creating systemd services..."

cat > /etc/systemd/system/${APP_NAME}-api.service << EOF
[Unit]
Description=TDrive API Server
After=network.target postgresql.service redis-server.service
Wants=postgresql.service redis-server.service

[Service]
Type=simple
User=${APP_USER}
Group=${APP_USER}
WorkingDirectory=${APP_DIR}/apps/api
ExecStart=${HOME}/.bun/bin/bun src/index.ts
Restart=always
RestartSec=5
Environment=NODE_ENV=${NODE_ENV}
EnvironmentFile=${APP_DIR}/.env

# Security
NoNewPrivileges=true
ProtectSystem=strict
ReadWritePaths=${APP_DIR}/apps/api/storage-temp
ReadWritePaths=${APP_DIR}/apps/api/server-files

[Install]
WantedBy=multi-user.target
EOF

cat > /etc/systemd/system/${APP_NAME}-web.service << EOF
[Unit]
Description=TDrive Web (Next.js)
After=network.target ${APP_NAME}-api.service
Wants=${APP_NAME}-api.service

[Service]
Type=simple
User=${APP_USER}
Group=${APP_USER}
WorkingDirectory=${APP_DIR}/apps/web
ExecStart=${HOME}/.bun/bin/bun run start
Restart=always
RestartSec=5
Environment=NODE_ENV=${NODE_ENV}
Environment=NEXT_PUBLIC_API_URL=http://127.0.0.1:${API_PORT}

[Install]
WantedBy=multi-user.target
EOF

systemctl daemon-reload
systemctl enable ${APP_NAME}-api ${APP_NAME}-web
systemctl start ${APP_NAME}-api
systemctl start ${APP_NAME}-web

echo ""
echo "✅ TDrive deployed successfully!"
echo ""
echo "Services:"
echo "  API:  http://localhost:${API_PORT}"
echo "  Web:  http://localhost:${WEB_PORT}"
echo ""
echo "Manage:"
echo "  systemctl status tdrive-api"
echo "  systemctl status tdrive-web"
echo "  journalctl -u tdrive-api -f"
echo ""
echo "Next: Configure nginx reverse proxy (deploy/nginx.conf)"
echo "      or access directly via http://YOUR_IP:${WEB_PORT}"
