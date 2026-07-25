#!/bin/bash
if [ -d .git/hooks ]; then
    cp scripts/pre-push.sh .git/hooks/pre-push
    chmod +x .git/hooks/pre-push
    echo "✅ Git pre-push hook installed."
fi
