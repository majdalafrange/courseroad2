#!/bin/bash
# To run this script you must have 'aklog' written in ~/.bash_environment
# (or the environment file for whatever shell you use)
# and 'sipb' and 'athena' written in ~/.xlog (both files should be in your
# athena locker). Otherwise you will not have permission to access the
# courseroad locker, even if you are on courseroad-dev.
#
# syntax: ./deploy.sh [dev or prod] [kerberos]
set -euo pipefail

if { [ "${1-}" != "dev" ] && [ "${1-}" != "prod" ]; } || [ -z "${2-}" ]; then
  echo "Usage: ./deploy.sh [dev|prod] [kerberos]" >&2
  exit 1
fi

npm run "build-$1"

if [ "$1" = "prod" ]; then
  echo -n "You are about to deploy to the production site, are you sure? (y/n)? "
  read -r answer
  if [ "$answer" != "${answer#[Yy]}" ]; then
    scp -r deploy/production/.htaccess dist/* "$2@athena.dialup.mit.edu:/mit/courseroad/web_scripts/courseroad/"
  else
    echo cancelled
  fi
else
  scp -r deploy/development/.htaccess dist/* "$2@athena.dialup.mit.edu:/mit/courseroad/web_scripts/courseroad/dev/"
fi
