#!/bin/bash

file="$1"
grep -v ^[[:space:]]*$ "$file" > temp && mv temp "$file"
