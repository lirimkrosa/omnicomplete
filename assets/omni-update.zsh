#!/usr/bin/env zsh

# Omni Auto-Update Script (Production Mode)
# Source this file in your ~/.zshrc:
# source /usr/local/lib/node_modules/@lirimkrosa/omnicomplete/assets/omni-update.zsh

OMNI_UPDATE_CHECK_INTERVAL=${OMNI_UPDATE_CHECK_INTERVAL:-86400} # 24 hours in seconds
OMNI_UPDATE_FILE="$HOME/.omni-update-last-check"
OMNI_LATEST_VERSION_FILE="$HOME/.omni-latest-version"

function _omni_perform_update() {
  echo "\n✨ Updating Omni to the latest version..."
  
  # Install the latest global version
  if ! npm install -g @lirimkrosa/omnicomplete@latest; then
    echo "❌ Failed to update Omni. Please try manually: npm install -g @lirimkrosa/omnicomplete@latest"
    return 1
  fi
  
  # Stop the background daemon so the new version takes over
  echo "♻️  Restarting daemon..."
  omni daemon stop >/dev/null 2>&1
  
  # Clean up update state
  rm -f "$OMNI_LATEST_VERSION_FILE"
  touch "$OMNI_UPDATE_FILE"
  
  echo "✅ Omni updated successfully!"
  echo "♻️  Reloading terminal..."
  sleep 1
  
  # Restart zsh completely
  exec zsh
}

function _omni_check_update() {
  # 1. Check if we already found an update in the background
  if [[ -f "$OMNI_LATEST_VERSION_FILE" ]]; then
    local LATEST_VERSION=$(cat "$OMNI_LATEST_VERSION_FILE" 2>/dev/null)
    local CURRENT_VERSION=$(omni --version 2>/dev/null)
    
    # If versions differ, prompt the user
    if [[ -n "$LATEST_VERSION" && -n "$CURRENT_VERSION" && "$LATEST_VERSION" != "$CURRENT_VERSION" ]]; then
      if read -q "?✨ A new version of Omni ($LATEST_VERSION) is available! You are on $CURRENT_VERSION. Would you like to update? [Y/n] "; then
        _omni_perform_update
      else
        echo "\nOkay, you can update later!"
      fi
      return
    else
      # We are up to date, clear the file so we don't check the version string unnecessarily
      rm -f "$OMNI_LATEST_VERSION_FILE"
    fi
  fi

  # 2. Check if 24 hours have passed since last background check
  local current_time=$(date +%s)
  local last_update=0

  if [[ -f "$OMNI_UPDATE_FILE" ]]; then
    if [[ "$OSTYPE" == darwin* ]]; then
      last_update=$(stat -f "%m" "$OMNI_UPDATE_FILE")
    else
      last_update=$(stat -c "%Y" "$OMNI_UPDATE_FILE")
    fi
  else
    # First time running, just create it and don't check immediately to keep first startup fast
    touch "$OMNI_UPDATE_FILE"
    return
  fi

  local time_diff=$(( current_time - last_update ))
  
  if [[ $time_diff -gt $OMNI_UPDATE_CHECK_INTERVAL ]]; then
    # Update timestamp right away so we don't spam background checks
    touch "$OMNI_UPDATE_FILE"
    
    # Run NPM registry check in a background subshell so we don't slow down prompt
    (
      local LATEST=$(npm view @lirimkrosa/omnicomplete version 2>/dev/null)
      if [[ -n "$LATEST" ]]; then
        echo "$LATEST" > "$OMNI_LATEST_VERSION_FILE"
      fi
    ) &!
  fi
}

# Run the check on startup
_omni_check_update
