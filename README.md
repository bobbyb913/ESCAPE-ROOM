# 1999 Retro CRT Terminal - Project Atlas Escape Room

A full-screen retro CRT terminal web application styled after late-90s mainframe systems with an authentic Y2K escape room storyline.

## Escape Room State Machine (Figma Group 2 Flow)

The terminal operates on a 6-stage finite state machine aligned with the official Figma escape room design:
1. **`INTRO`**:
   - Auto-starts the 15:00 digital countdown timer.
   - Displays the emergency alert: `PROJECT ATLAS. Y2K RECOVERY FAILURE DETECTED. EMERGENCY PROTOCOL ARMED.`
   - Typewrites Dr. Elena Ferland's emergency transmission character-by-character with mechanical typing sounds (click or press Enter to skip).
   - Upon completion, automatically transitions to `PUZZLE_1`, clears the screen, and prints `STEP 1: VERIFY SYSTEM DATE // PHASE 1`.
2. **`PUZZLE_1` (Phase 1 — Before `OOPS`)**:
   - Title: `STEP 1: VERIFY SYSTEM DATE // PHASE 1`
   - Story beat: Align layered floppy disks for lock combinations, sync dual physical terminals to the target date, and match color/shape codes with **SPOT**.
   - Canonical Admin Password: **`OOPS`** (case-insensitive).
   - Tiered Hints (`[ ? HINT ]` / `HINT`): **Locks**, **Terminal**, **Admin password** (each with Hint 1 -> Hint 2 -> Hint 3).
   - On Error: Prints `'ERR: INVALID SYSTEM DATE - RETRY'` in red, returning prompt to green for the next attempt.
   - On Success: Prints `'SYSTEM DATE VERIFIED. RECOVERY 1 OF 3 COMPLETE.'`, triggers Dr. Ferland's Phase 2 dialogue, and advances to `PUZZLE_2`.
3. **`PUZZLE_2` (Phase 2 — After `OOPS`, Before `NSYNC`)**:
   - Title: `STEP 2: MAINFRAME SERVER CONNECTIONS // PHASE 2`
   - Story beat: Decode the binary birds poster for locks, use the manual logic puzzle (`?page=<num>` configurable) to wire server sockets, and read server grid coordinates (`E5` etc.) on the I-Spy poster.
   - Canonical Admin Password: **`NSYNC`** (also accepts `'N SYNC`, `N-SYNC`, `N'SYNC`, `*NSYNC`).
   - Tiered Hints (`[ ? HINT ]` / `HINT`): **Locks**, **Server connections**, **Admin password** (each with Hint 1 -> Hint 2 -> Hint 3).
   - On Success: Prints `'SERVER CONNECTIONS SYNCHRONIZED. EMERGENCY STORAGE BUFFER UNLOCKED.'`, plays `audio/server_online.wav`, triggers Dr. Ferland's transmission introducing the Maze, and advances to `PUZZLE_3`.
   - Continuous Countdown: The 15:00 countdown timer continues running uninterrupted across all transitions.
4. **`PUZZLE_3` (Phase 3 — After `NSYNC` / Mainframe Directory Maze & Safe Recovery)**:
   - Title: `STEP 3: MAINFRAME DIRECTORY MAZE // PHASE 3`
   - Tiered Hints (`[ ? HINT ]` / `HINT`): **Maze** (Hint 1 -> Hint 2 -> Hint 3).
   - Interactive Filesystem Console:
     - `DIR` / `LS`: List files and subfolders in MS-DOS table format.
     - `CD <dir>`: Navigate folders (`CD RESTRICTED`, `CD VAULT`, `CD ..`, `CD \`).
     - `TYPE <file>` / `CAT <file>`: View text files.
     - `TREE`: Display complete ASCII directory hierarchy.
     - `MAP` / `MAZE`: Display memory sector radar visualization.
     - `PWD`: Print current directory.
   - Vault Target: Navigating to `C:\RESTRICTED\VAULT\` and reading `SAFE_KEY.TXT` reveals the physical safe combination: **`8492`**.
   - Safe Retrieval: Players open the physical safe in the room and retrieve the Emergency Recovery Flash Drive.
   - Flash Drive Authentication: Players enter the code on the drive label (Canonical: `ATLAS-2000`, also accepts `8492`, `FLASH`, `MOUNT D:`).
   - Warning Trigger: Displays flashing red alert:
     `EMERGENCY RECOVERY DRIVE DETECTED. FINAL AUTHORIZATION REQUIRED.`
   - Interactive Abort Button: Replaces the command prompt with a clickable, ASCII-styled button:
     `[ ABORT EMERGENCY PROTOCOL ]`
   - On Click / Activation:
     - Countdown timer stops immediately.
     - Screen clears.
     - Staggered sequence of system checks prints (`BOULDER NODE - ONLINE`, `POWER SYSTEMS - STABLE`, etc.).
     - Screen text color shifts to a calm terminal white (`theme-white`).
     - Displays `PROJECT ATLAS: EMERGENCY PROTOCOL CANCELLED`.
     - Dr. Elena Ferland's final victory transmission is printed via typewriter.
     - Displays a large `JANUARY 1, 2000 - 00:00:00` millennium banner.
5. **`VICTORY`**:
   - Freezes the countdown timer.
   - Plays a triumphant retro victory fanfare.
   - Displays celebratory ASCII banner, mission completion statistics, elapsed time, and remaining time.

## Retro Audio & Voice Synthesis

- **Y2K Robotic Voice Prompts** (sampled with late-90s mainframe robotic synthesis + Web Speech fallback):
  - `audio/puzzle1.wav` : *"Please add password 1."* (plays upon entering Step 1)
  - `audio/puzzle2.wav` : *"Please add password 2."* (plays upon entering Step 2)
  - `audio/puzzle3.wav` : *"Please add password 3."* (plays upon entering Step 3)
  - `audio/warning_abort.wav` : *"Emergency recovery drive detected. Final authorization required."*
  - `audio/system_verified.wav` : *"System date verified. Recovery 1 of 3 complete."*
  - `audio/boulder_online.wav` : *"Boulder network online."*
  - `audio/protocol_cancelled.wav` : *"Project Atlas. Emergency protocol cancelled."*
  - `audio/error_retry.wav` : *"Error. Invalid entry. Retry."*

- **Mechanical Y2K Typing Sounds**:
  - Multi-sample mechanical keyboard audio (`click1.wav` – `click5.wav`) with randomized pitch and timbre variations.
  - Deep mechanical stabilizer clack for `Space` (`space.wav`).
  - Heavy mechanical bottom-out and return clack for `Enter` (`enter.wav`).
  - Crisp switch clack for `Backspace`.
  - Layered with real-time zero-latency Web Audio API physical impulse and acoustic body synthesis on every keystroke and typewriter character.

## Terminal Controls & Commands

During any state, players can execute:
- `hint [topic]` (or click `[ ? HINT ]` / press `F1`) : Opens `"Would you like help with?"` interactive progressive hint system (Hint 1 -> Hint 2 -> Hint 3).
- `status` : Displays current escape room state, countdown timer, and system health.
- `scan` : Runs a retro network port scan.
- `matrix` : Toggles background green digital phosphor rain.
- `color <green|amber|cyan|white>` : Switches CRT phosphor spectrum tint.
- `audio` : Toggles synthesized mechanical sound effects.
- `clear` : Clears the screen buffer (`Ctrl + L`).
- `reboot` : Restarts the simulation back to `INTRO`.
- `skip` : Developer override to advance to the next puzzle stage.

## How to Run

1. Open `index.html` in any modern web browser (optionally pass `?page=5` in the URL to set the manual logic puzzle page number for Phase 2 Hint 2).
2. Watch Dr. Ferland's transmission or click to fast-forward.
3. Enter Phase 1 Admin Password `OOPS`, Phase 2 Admin Password `NSYNC`, navigate the Phase 3 Maze (`CD RESTRICTED`, `CD VAULT`, `TYPE SAFE_KEY.TXT`) to get `8492`, then enter `ATLAS-2000` to trigger the final abort sequence.
