# Daymark

Daymark is a personal planner for tasks and exercise. Use the Planner to manage deadlines and check off tasks and exercises from the daily, weekly, monthly, and yearly calendar. Use Training to plan workouts, log sets and cardio, and view your progress. Undo and redo work across both sections. The prototype starts with editable sample data.

## Run on your computer

With Node.js 22 or newer, run `npm start` from this repository and open <http://127.0.0.1:4173/>. The app has no package dependencies.

## Open on an iPhone

1. Run `npm run start:lan` on your computer while both devices are on the same trusted Wi-Fi.
2. Open the computer URL and select **Devices** to see the phone URL and pairing code.
3. Open the phone URL in Safari and enter the pairing code. Keep the computer awake and the launcher running while you use the planner.

The planner saves to `.daymark-data/planner.json` on the computer. LAN mode uses local HTTP, so use it on a trusted private network. LAN mode shares one planner across paired browsers. For weight history, use a consistent unit for each exercise.

If the launcher selects the wrong network interface, set `DAYMARK_LAN_IP` to the computer's private Wi-Fi address. Set `DAYMARK_PORT` to choose a different port, or `DAYMARK_DATA_DIR` to store planner data in a separate directory. Do not commit a custom data directory.

## Checks

Run `npm test` for browser-script syntax and a server integration test. The test uses a temporary data directory.
