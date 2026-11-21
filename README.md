# LifeSolver

LifeSolver organizes tasks and training. Calendar gives a read-only overview of the week or month. Select a date to open its Tasks checklist and check off scheduled runs when you finish them. All tasks shows every deadline and the selected week's training. Under Training, assign weekdays to workout days or run types, log workout sets, and view lifting progress. Log workout opens today's scheduled session, and Finish workout saves your sets and marks the workout complete in Tasks. Saved changes support undo and redo.

## Run on your computer

With Node.js 22 or newer, run `npm start` from this repository and open <http://127.0.0.1:4173/>. A new planner starts empty. The app has no package dependencies.

## Open on an iPhone

The hosted build is designed for a private HTTPS deployment with sign-in. It gives each signed-in account a separate planner and starts empty. It does not import the local planner. Build the Sites Worker with `npm run build:hosted`. An owner-private Sites project, a `DB` D1 binding, and the migration in `drizzle/` are required for deployment.

From the hosted address in Safari, select **Share → Add to Home Screen** and turn on **Open as Web App**. Sign in with the same account on both devices.

### Local Wi-Fi preview

1. Run `npm run start:lan` on your computer while both devices are on the same trusted Wi-Fi.
2. Open the computer URL and select **Devices** to see the phone URL and pairing code.
3. Open the phone URL in Safari and enter the pairing code. Keep the computer awake and the launcher running while you use the planner.

The planner saves to `.daymark-data/planner.json` on the computer. LAN mode uses local HTTP, so use it on a trusted private network. LAN mode shares one planner across paired browsers. For weight history, use a consistent unit for each exercise.

If the launcher selects the wrong network interface, set `DAYMARK_LAN_IP` to the computer's private Wi-Fi address. Set `DAYMARK_PORT` to choose a different port, or `DAYMARK_DATA_DIR` to store planner data in a separate directory. Do not commit a custom data directory.

## Checks

Run `npm test` for browser-script syntax and a server integration test. The test uses a temporary data directory.
