#!/bin/bash
set -e

BASE_DIR="${1:-.}"

find "$BASE_DIR" -type f -name "go.mod" | while read -r modfile; do
    dir=$(dirname "$modfile")
    echo "Updating Go dependencies in: $dir"
    (cd "$dir" && go get -u ./...)
done

