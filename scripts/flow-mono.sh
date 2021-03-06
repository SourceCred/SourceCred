#!/bin/sh
toplevel="$(git -C "$(dirname "$0")" rev-parse --show-toplevel)"

for package in $(ls ${toplevel}/packages); do
  cd $toplevel
  if [ -f "$toplevel/packages/$package/.flowconfig" ]; then
    flow-mono create-symlinks $toplevel/packages/$package/.flowconfig
    flow-mono create-symlinks $toplevel/packages/$package/.flowconfig-ci
  fi;
done
