#!/usr/bin/env bash
set -euo pipefail

# GitHub's Ubuntu mirror list can select an unresponsive regional mirror.
# This runs only on disposable CI runners, before Playwright installs packages.
if [[ -f /etc/apt/apt-mirrors.txt ]]; then
  printf '%s\n' 'https://archive.ubuntu.com/ubuntu/' | sudo tee /etc/apt/apt-mirrors.txt >/dev/null
fi
printf '%s\n' 'Acquire::Retries "2";' 'Acquire::http::Timeout "30";' 'Acquire::https::Timeout "30";' \
  | sudo tee /etc/apt/apt.conf.d/80-sapienworx-ci-network >/dev/null
