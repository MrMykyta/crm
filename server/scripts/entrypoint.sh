#!/usr/bin/env bash
set -e

echo "[api] Waiting for DB..."
until node -e "const u=new URL(process.env.DATABASE_URL||''); if(!u.hostname) process.exit(0); require('net').createConnection({host:u.hostname, port:u.port||5432},()=>process.exit(0)).on('error',()=>process.exit(1))"; do
  sleep 1
done

echo "[api] Running migrations..."
npx sequelize-cli db:migrate

echo "[api] Syncing core ACL..."
npm run acl:sync:core

echo "[api] Syncing WMS ACL..."
npm run acl:sync:wms

echo "[api] Starting server..."
npm run start
