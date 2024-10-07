#!/bin/bash

AWS_HOST="samoc-dev-server.flex.com"
AWS_USER="ec2-user"
PEM_FILE="./.ssh/aws68-samoc-dev-us-west-2.pem"

if [ -z "$1" ]; then
	echo "Error: Missing environment, please specify a target environment [dev, clndev, or prod]."
	exit 0;
else
	if [ $1 = "dev" ]; then
		AWS_HOST="samoc-dev-server.flex.com"
		PEM_FILE="./.ssh/aws68-samoc-dev-us-west-2.pem"
	elif [ $1 = "clndev" ]; then
	  AWS_HOST="samoc-clientdev-server.flex.com"
	  PEM_FILE="../.ssh/aws68-samoc-clientdev-us-west-2.pem"
	elif [ $1 = "prod" ]; then
	  AWS_HOST="samoc-server.flex.com"
	  PEM_FILE="./.ssh/aws69-samoc-prod-us-west-2.pem"
	fi
fi

scp -r -i ${PEM_FILE} ${AWS_USER}@${AWS_HOST}:/home/ec2-user/samoc/samoc-server/logs .
