# Basic Screen Stream + Mobile Controller

Minimal Node.js app that:
- Streams your PC screen to a phone browser
- Lets phone touch move the mouse pointer
- Sends quick tap as left click

## Run

1. Install dependencies:
   - `npm install`
2. Start server:
   - `npm start`
3. Get your PC LAN URL:
   - `npm run find-ip`
4. Open one of the printed URLs on your phone (same Wi-Fi).

## Notes

- Port is fixed at `8000`.
- Mouse control in this version is Windows-only (uses PowerShell/User32).
- If stream appears slow, this is expected for the very basic implementation.
