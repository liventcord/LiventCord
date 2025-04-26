#!/bin/bash

PARALLEL_LIMIT=${1:-3}

SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"

cd "$SCRIPT_DIR/../web"

files=$(find cypress/e2e -name '*.cy.ts' | sort)

pnpm cypress run --spec "$(echo "$files" | head -n 1)"

echo "$files" | tail -n +2 | xargs -n 1 -P "$PARALLEL_LIMIT" -I {} pnpm cypress run --spec "{}"
