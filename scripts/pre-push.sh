#!/bin/bash
BRANCH=$(git rev-parse --abbrev-ref HEAD)
echo "🔄 [pre-push] Pulling latest changes from origin/$BRANCH with rebase..."
git fetch origin "$BRANCH" 2>/dev/null
if git rev-parse origin/"$BRANCH" >/dev/null 2>&1; then
    if ! git merge-base --is-ancestor origin/"$BRANCH" @ 2>/dev/null; then
        echo "⬇️  Remote changes detected. Rebasing..."
        git pull --rebase origin "$BRANCH"
        
        if [ $? -ne 0 ]; then
            echo "❌ [pre-push] Error: Failed to pull remote changes. Please resolve conflicts and try pushing again."
            exit 1
        fi
        echo "✅ [pre-push] Successfully rebased latest changes."
        echo "⚠️ [pre-push] Push aborted because the local branch was just updated. Please run 'git push' again."
        exit 1
    else
        echo "✅ [pre-push] Branch is up to date."
    fi
fi
exit 0
