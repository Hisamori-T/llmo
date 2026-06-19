#!/bin/bash
# LLMO Score デプロイスクリプト (VPS: 116.80.96.175)
# 実行: bash infra/deploy.sh

set -e

# GITHUB_TOKEN を .env や環境変数から取得すること（直接記述禁止）
GITHUB_TOKEN="${GITHUB_TOKEN:-}"
if [ -z "$GITHUB_TOKEN" ]; then
  echo "Error: GITHUB_TOKEN 環境変数を設定してください"
  echo "例: export GITHUB_TOKEN=ghp_..."
  exit 1
fi
REPO_URL="https://${GITHUB_TOKEN}@github.com/Hisamori-T/llmo.git"
APP_DIR="/root/llmo"

echo "=== LLMO Score デプロイ開始 ==="

# 初回デプロイ or 更新
if [ ! -d "$APP_DIR/.git" ]; then
  echo "初回クローン..."
  git clone "$REPO_URL" "$APP_DIR"
else
  echo "最新コードを pull..."
  cd "$APP_DIR" && git pull origin main
fi

cd "$APP_DIR"

# --- Backend セットアップ ---
echo "Backend セットアップ..."
cd "$APP_DIR/backend"

if [ ! -d "venv" ]; then
  python3 -m venv venv
fi
./venv/bin/pip install --quiet -r requirements.txt

# DB作成（初回のみ）
psql -U postgres -tc "SELECT 1 FROM pg_database WHERE datname='llmo_db'" | grep -q 1 || \
  psql -U postgres -c "CREATE DATABASE llmo_db;"

# --- Frontend セットアップ ---
echo "Frontend セットアップ..."
cd "$APP_DIR/frontend"

# Node.js 確認
if ! command -v node &> /dev/null; then
  curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
  apt-get install -y nodejs
fi

npm ci --production=false
npm run build

# --- Nginx 設定 ---
echo "Nginx 設定..."
cp "$APP_DIR/infra/nginx/llmo.conf" /etc/nginx/sites-available/llmo
ln -sf /etc/nginx/sites-available/llmo /etc/nginx/sites-enabled/llmo
nginx -t && systemctl reload nginx

# --- Systemd サービス ---
echo "Systemd サービス設定..."
cp "$APP_DIR/infra/systemd/llmo-frontend.service" /etc/systemd/system/
cp "$APP_DIR/infra/systemd/llmo-backend.service" /etc/systemd/system/
systemctl daemon-reload
systemctl enable llmo-frontend llmo-backend
systemctl restart llmo-frontend llmo-backend

# --- SSL (初回のみ) ---
if [ ! -f "/etc/letsencrypt/live/llmo.fact-ally.com/fullchain.pem" ]; then
  echo "SSL証明書取得..."
  certbot --nginx -d llmo.fact-ally.com --non-interactive --agree-tos -m hisa1975@gmail.com
fi

echo "=== デプロイ完了 ==="
echo "URL: https://llmo.fact-ally.com"
systemctl status llmo-frontend --no-pager
systemctl status llmo-backend --no-pager
