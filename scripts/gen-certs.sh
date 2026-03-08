#!/usr/bin/env bash
# Generates local HTTPS certificates trusted by your browser.
# Requires mkcert: sudo apt install mkcert && mkcert -install

set -e

CERT_DIR="$(dirname "$0")/../certs"
mkdir -p "$CERT_DIR"

# Get local IP so phones on LAN can connect
LOCAL_IP=$(hostname -I | awk '{print $1}')

echo "🔐 Generating certs for localhost and $LOCAL_IP ..."
mkcert -cert-file "$CERT_DIR/localhost.pem" \
       -key-file  "$CERT_DIR/localhost-key.pem" \
       localhost 127.0.0.1 "$LOCAL_IP" ::1

echo ""
echo "✅ Certs written to certs/"
echo "   CERT_PATH=./certs/localhost.pem"
echo "   KEY_PATH=./certs/localhost-key.pem"
echo ""
echo "📱 To connect your phone, visit:"
echo "   https://$LOCAL_IP:3000/remote"
echo "   (Make sure your phone trusts mkcert's CA — copy from ~/.local/share/mkcert/rootCA.pem)"
