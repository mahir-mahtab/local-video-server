const path = require('path');
const http = require('http');
const express = require('express');
const { WebSocketServer } = require('ws');
const screenshot = require('screenshot-desktop');
const { execFile } = require('child_process');

const PORT = 8000;
const FRAME_INTERVAL_MS = 180;
const MOUSE_INTERVAL_MS = 50;

const app = express();
app.use(express.static(path.join(__dirname, 'public')));

const server = http.createServer(app);
const wss = new WebSocketServer({ server, path: '/ws' });

let primaryDisplay = { width: 1920, height: 1080 };
let pendingMouse = null;

async function detectDisplay() {
  try {
    const displays = await screenshot.listDisplays();
    if (Array.isArray(displays) && displays.length > 0) {
      const chosen = displays.find((d) => d.primary || d.isPrimary) || displays[0];
      primaryDisplay = {
        width: chosen.width || 1920,
        height: chosen.height || 1080,
      };
    }
  } catch (err) {
    console.warn('Display detection failed, using default 1920x1080.');
  }
}

function clamp(n, min, max) {
  return Math.max(min, Math.min(max, n));
}

function runPowerShell(script) {
  if (process.platform !== 'win32') {
    return;
  }

  execFile(
    'powershell.exe',
    ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-Command', script],
    { windowsHide: true },
    () => {}
  );
}

function moveMouseAbs(x, y) {
  const px = clamp(Math.round(x), 0, primaryDisplay.width - 1);
  const py = clamp(Math.round(y), 0, primaryDisplay.height - 1);

  const script = `
Add-Type -AssemblyName System.Windows.Forms
[System.Windows.Forms.Cursor]::Position = New-Object System.Drawing.Point(${px}, ${py})
`;

  runPowerShell(script);
}

function leftClick() {
  const script = `
Add-Type @"
using System;
using System.Runtime.InteropServices;
public class MouseEvent {
  [DllImport(\"user32.dll\", CallingConvention = CallingConvention.StdCall)]
  public static extern void mouse_event(uint dwFlags, uint dx, uint dy, uint cButtons, UIntPtr dwExtraInfo);
}
"@
[MouseEvent]::mouse_event(0x0002, 0, 0, 0, [UIntPtr]::Zero)
Start-Sleep -Milliseconds 10
[MouseEvent]::mouse_event(0x0004, 0, 0, 0, [UIntPtr]::Zero)
`;

  runPowerShell(script);
}

wss.on('connection', (ws) => {
  ws.on('message', (raw) => {
    let data;
    try {
      data = JSON.parse(raw.toString());
    } catch {
      return;
    }

    if (data?.type === 'touch') {
      const nx = Number(data.x);
      const ny = Number(data.y);
      if (Number.isFinite(nx) && Number.isFinite(ny)) {
        const x = clamp(nx, 0, 1) * primaryDisplay.width;
        const y = clamp(ny, 0, 1) * primaryDisplay.height;
        pendingMouse = { x, y };
      }

      if (data.action === 'tap') {
        leftClick();
      }
    }
  });
});

setInterval(() => {
  if (!pendingMouse) return;
  moveMouseAbs(pendingMouse.x, pendingMouse.y);
  pendingMouse = null;
}, MOUSE_INTERVAL_MS);

let takingFrame = false;
setInterval(async () => {
  if (takingFrame) return;
  if (wss.clients.size === 0) return;

  takingFrame = true;
  try {
    const frame = await screenshot({ format: 'jpg' });
    const payload = JSON.stringify({
      type: 'frame',
      image: frame.toString('base64'),
      width: primaryDisplay.width,
      height: primaryDisplay.height,
      ts: Date.now(),
    });

    for (const client of wss.clients) {
      if (client.readyState === client.OPEN) {
        client.send(payload);
      }
    }
  } catch {
    // Ignore intermittent capture errors.
  } finally {
    takingFrame = false;
  }
}, FRAME_INTERVAL_MS);

server.listen(PORT, async () => {
  await detectDisplay();
  console.log(`Server running on http://0.0.0.0:${PORT}`);
  console.log('Open that URL on your phone using this PC\'s LAN IP.');
});
