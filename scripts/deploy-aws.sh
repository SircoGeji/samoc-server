#!/bin/bash

AWS_HOST="samoc-dev-server.flex.com"
AWS_ROOT="/home/ec2-user/samoc/samoc-server"
AWS_USER="ec2-user"
PEM_FILE="./.ssh/aws68-samoc-dev-us-west-2.pem"

if [ -z "$1" ]; then
	echo "Error: Missing environment, please specify a target environment [dev, qa, clndev, or prod]."
	exit 0;
else
	if [ $1 = "dev" ]; then
		AWS_HOST="samoc-dev-server.flex.com"
		PEM_FILE="./.ssh/aws68-samoc-dev-us-west-2.pem"
	elif [ $1 = "clndev" ]; then
	  AWS_HOST="samoc-clientdev-server.flex.com"
	  PEM_FILE="../.ssh/aws68-samoc-clientdev-us-west-2.pem"
	elif [ $1 = "qa" ]; then
	  AWS_HOST="10.59.5.201" #"samoc-qa-server.flex.com"
	  PEM_FILE="./.ssh/aws88-samoc-qa-us-west-2.pem"
	elif [ $1 = "prod" ]; then
	  AWS_HOST="samoc-server.flex.com"
	  PEM_FILE="./.ssh/aws69-samoc-prod-us-west-2.pem"
	fi
fi

echo "### Deploying to ${AWS_HOST} using ${PEM_FILE} ###"

SCRIPT_PATH=$( cd "$(dirname "${BASH_SOURCE[0]}")" ; pwd -P )
cd "$SCRIPT_PATH/.."

echo "Removing Files via ssh"
ssh -o "StrictHostKeyChecking no" -i ${PEM_FILE} ${AWS_USER}@${AWS_HOST} "rm -fr ${AWS_HOST}/dist && rm -fr ${AWS_ROOT}/package.json && rm -fr ${AWS_ROOT}/yarn.lock && rm -fr ${AWS_ROOT}/db"
echo "Rsync"
rsync --progress -rave "ssh -o 'StrictHostKeyChecking no' -i ${PEM_FILE}" ./package.json ./yarn.lock ./db ./dist ${AWS_USER}@${AWS_HOST}:${AWS_ROOT}/
echo "Restarting Server via ssh"
ssh -o "StrictHostKeyChecking no" -i ${PEM_FILE} ${AWS_USER}@${AWS_HOST} "~/pm2restart.sh"
