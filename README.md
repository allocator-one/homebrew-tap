# Infra One Homebrew tap and CLI releases

This repository holds the release binaries of the `infraone` command line tool and its Homebrew formula.

## Install

With Homebrew:

    brew install allocator-one/tap/infraone

With the install script (macOS and Linux):

    curl -fsSL https://github.com/allocator-one/homebrew-tap/releases/latest/download/install.sh | sh

With npm:

    npm i -g @allocator-one/infraone

Then sign in with `infraone login`. One install gives you `infraone harness`, `infraone operator` and `infraone rcl`.

Releases are named `infraone-v<version>`. Each carries the binaries, `SHA256SUMS`, the install script and the formula that pins those checksums.
