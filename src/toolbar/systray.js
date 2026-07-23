import SysTray from 'systray2';
import { chmodSync, existsSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';

let systrayInstance = null;

export function initSystray() {
  if (systrayInstance) return;

  try {
    // Attempt to proactively fix permissions for the downloaded binary
    // node-systray downloads to ~/.cache/node-systray/<version>/tray_darwin_release
    const cacheDir = join(homedir(), '.cache', 'node-systray');
    if (existsSync(cacheDir)) {
      // In a real app we'd traverse and fix, but this is a heuristic
      try {
        const binPath = join(cacheDir, '2.1.4', 'tray_darwin_release');
        if (existsSync(binPath)) chmodSync(binPath, '755');
      } catch (e) {}
    }

    systrayInstance = new SysTray.default({
      menu: {
        icon: '', // Optionally a small base64 icon
        title: 'Omni',
        tooltip: 'Omni Interactive Shell',
        items: [
          {
            title: 'Status: Running',
            tooltip: 'The interactive shell is active',
            enabled: false
          },
          {
            title: 'Quit Omni',
            tooltip: 'Exit the shell',
            checked: false,
            enabled: true
          }
        ]
      },
      debug: false,
      copyDir: true
    });

    systrayInstance.onClick(action => {
      if (action.seq_id === 1) { // Quit clicked
        destroySystray();
        process.exit(0);
      }
    });
  } catch (err) {
    // Silently fail if systray fails to initialize (e.g. headless environment)
  }
}

export function destroySystray() {
  if (systrayInstance) {
    try {
      systrayInstance.kill();
    } catch (e) {}
    systrayInstance = null;
  }
}
