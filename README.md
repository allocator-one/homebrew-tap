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

## How a release gets here

The release workflow of `allocator-one/harness-cli` cannot call this repository's
releases API, only push git refs (a read-write deploy key). So a release moves as
two pushed branches that workflows here act on, with this repository's own token:

- `incoming/infraone-v<version>` carries the payload (`payload/`): the binaries,
  gzip-compressed and split into parts when large, `SHA256SUMS`, `install.sh`,
  `infraone.rb` and `SOURCE`. `attach.yml` restores and verifies it and attaches it
  to a **draft** release `infraone-v<version>`, writing `Built from …` into the notes
  only after every asset is attached.
- `publish/infraone-v<version>` is the marker (`PUBLISH`: source commit and version).
  `publish.yml` refuses unless the draft carries exactly its assets and its notes
  name that commit, makes the release public, and commits `Formula/infraone.rb`
  unless this repository already holds a newer one.

Everything on those branches is untrusted input: `.github/scripts` matches ref
names, file names, versions and commits against strict patterns first.
`render-formula.mjs`, `check-tap.mjs` and `version-newer.mjs` are copies from
harness-cli's `packaging/homebrew`; change both together.
