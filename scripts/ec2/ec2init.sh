#!/bin/bash

curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.34.0/install.sh | bash
. ~/.nvm/nvm.sh
nvm install node
nvm install 12.18.2
node -e "console.log('Running Node.js ' + process.version)"
curl -o- -L https://yarnpkg.com/install.sh | bash
