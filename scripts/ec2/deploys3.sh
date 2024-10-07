#!/bin/bash

## change folder
cd /home/ec2-user/samoc/samoc-webapp/dist/samoc-webapp

## copy to s3
aws s3 sync . s3://samoc-dev.flex.com/ --region us-west-2
