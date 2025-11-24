# Local Helper Scripts

This directory now includes several scripts that make it easier to work on macOS and
with the gcloud CLI when directory permissions or credential storage get in the way.

## tools/fix-quarantine.sh

Removes the `com.apple.quarantine` and `com.apple.provenance` attributes from any
path (folder or file). Usage:

```bash
./tools/fix-quarantine.sh ~/GitHub/osakamenesu
```

This requires sudo because it modifies extended attributes.

## tools/use-temp-gcloud-config.sh

Exports `CLOUDSDK_CONFIG` to a fresh temporary directory so that gcloud keeps its
state outside of `~/.config/gcloud`.

```bash
source tools/use-temp-gcloud-config.sh
# run gcloud commands
```

## tools/gcloud-login-no-browser.sh

Runs `gcloud auth login --no-launch-browser`, copies the authentication URL to the
clipboard, and prompts for the verification code. Handy when the terminal cannot
open a browser.

```bash
./tools/gcloud-login-no-browser.sh
```

## tools/backup-project.sh

Rsync-based backup of the repository to a destination directory (excluding `.git`,
`node_modules`, `.venv`).

```bash
./tools/backup-project.sh ~/Backups/osakamenesu-backup
```

Use `--exclude pattern` to add more exclusions if needed.

## tools/install-dev-tools.sh

Installs recommended CLI utilities via Homebrew (`direnv`, `mise`, `lefthook`, `bat`,
`fd`, `ripgrep`, `exa`).

```bash
./tools/install-dev-tools.sh
```
