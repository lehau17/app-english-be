#!/bin/sh
set -e

# Default to client-api if APP_NAME not set
APP_NAME=${APP_NAME:-client-api}

echo "🚀 Starting ${APP_NAME}..."

# Execute the Node.js application
exec node "dist/apps/${APP_NAME}/main.js"
