#!/bin/bash

###
# Clean everything
###

# force CWD to be repo root
SCRIPT_PATH=$( cd "$(dirname "${BASH_SOURCE[0]}")" ; pwd -P )
cd "$SCRIPT_PATH/.."

rm -rf dist/
