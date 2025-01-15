#!/bin/bash
# Merge dev into main without committing yet (preserve manual control over merge)
# Keep the README.md from main (in case of conflicts, use main's version)

git checkout main || { echo "Failed to checkout main branch"; exit 1; }

git pull origin main || { echo "Failed to pull latest changes from main"; exit 1; }

git merge dev --no-commit --no-ff || { echo "Merge failed"; exit 1; }

git checkout --ours -- README.md || { echo "Failed to preserve README.md"; exit 1; }

git add . || { echo "Failed to stage changes"; exit 1; }

git commit -m "Sync main with dev, keeping main's README.md" || { echo "Failed to commit merge"; exit 1; }

git push origin main || { echo "Failed to push changes to remote main"; exit 1; }
