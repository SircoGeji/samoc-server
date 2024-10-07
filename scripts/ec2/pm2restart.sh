#!/bin/bash

cd /home/ec2-user/samoc/samoc-server
yarn install --prod
npx pm2 restart dist/server.js
