#!/usr/bin/env bash
set -e

force=''
case $1 in
  --force)
    force='--force'
    ;;
esac

uuid='oclock@ortega.tech'
extension_pack_name="$uuid.shell-extension.zip"
extra_sources=(
  'analogClock.js'
  'prefs.ui'
  'schema.js'
)
extra_sources_opt=''
for file in "${extra_sources[@]}"; do
  extra_sources_opt+="--extra-source=$file "
done

gnome-extensions pack $force $extra_sources_opt src
