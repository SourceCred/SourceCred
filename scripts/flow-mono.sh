#!/bin/sh
toplevel="$(git -C "$(dirname "$0")" rev-parse --show-toplevel)"

# FIXME: this runs two times which is weird
for package in $(ls ${toplevel}/packages); do
  cd $toplevel
  if [ -f "$toplevel/packages/$package/.flowconfig" ]; then
    yarn flow-mono create-symlinks $toplevel/packages/$package/.flowconfig
    yarn flow-mono create-symlinks $toplevel/packages/$package/.flowconfig-ci
  fi;
done