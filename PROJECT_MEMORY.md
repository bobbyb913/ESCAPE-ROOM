# Project Memory — Project Atlas (Y2K Escape Room CRT Terminal)

> **CRITICAL WORKFLOW RULE — AUTO-SYNC WITH GITHUB:**  
> **Repository:** `https://github.com/RitvikChunamari/ESCAPE-ROOM` (`origin`, branch `main`)  
> **MANDATORY RULE:** Whenever ANY changes are made to this project, you MUST stage, commit (Conventional Commits), run secret/syntax checks, and **push to `origin main`** (`git add ... && git commit ... && git push origin main`) so GitHub is always up to date!

---

## 1. Project Purpose & Architecture

A full-screen 1999 retro CRT terminal web application built for the **Project Atlas Y2K 11th Hour Escape Room** (Design Studio Group 2).

- **Stack:** Pure Vanilla HTML5, CSS3 (CRT scanlines, radial vignette curvature, flicker, phosphor glow, responsive layout), ES6 JavaScript (`CRTTerminal`, `RetroAudio`, `CountdownTimer`, `MatrixRain`), Web Audio API + sampled `.wav` speech/typing FX. No build step or external framework dependencies.
- **Core Files:**
  - `index.html`: Terminal shell, 15:00 countdown header, scrollable output log, command prompt, and interactive CRT hint modal (`#hint-modal`).
  - `style.css`: Phosphor color themes (`green`, `amber`, `cyan`, `white`), scanline/vignette overlays, flashing warnings, ASCII abort button, tiered hint cards, and mobile responsive rules (`<=768px` + `prefers-reduced-motion`).
  - `terminal.js`: Finite state machine (`INTRO` -> `PUZZLE_1` -> `PUZZLE_2` -> `PUZZLE_3` -> `FINAL` -> `VICTORY`), `HINT_MATRIX`, virtual DOS Directory Maze (`VIRTUAL_FS`), typewriter engine, and Web Audio synthesizer.
  - `audio/`: Sampled mechanical keyboard clicks (`click1.wav`–`click5.wav`, `space.wav`, `enter.wav`) and Zarvox robotic voice prompts.

---

## 2. Canonical Puzzle Flow & Interactive Hint Matrix

1. **Intro (`INTRO`):** 15:00 timer auto-starts; Dr. Elena Ferland briefing typewrites (click/Enter skips).
2. **Phase 1 (`PUZZLE_1` — Before `OOPS`):**
   - **Admin Password:** `OOPS` (case-insensitive).
   - **Hint Topics (`Would you like help with?`):** `Locks` (disks), `Terminal` (dual terminal date sync), `Admin password` (SPOT color/shape codes).
3. **Phase 2 (`PUZZLE_2` — After `OOPS`, Before `NSYNC`):**
   - **Admin Password:** `NSYNC` (accepts `'N SYNC`, `N-SYNC`, `N'SYNC`, `*NSYNC`).
   - **Hint Topics:** `Locks` (binary birds), `Server connections` (logic puzzle; configurable manual page number via `LOGIC_PUZZLE_PAGE` or `?page=<num>`, `E goes with 5`), `Admin password` (I-Spy poster + server grid coordinates).
4. **Phase 3 (`PUZZLE_3` — After `NSYNC` / Directory Maze):**
   - **Virtual CLI:** `DIR`/`LS`, `CD`, `TYPE`/`CAT`, `TREE`, `MAP`/`MAZE`, `PWD`.
   - **Maze Target:** `C:\RESTRICTED\VAULT\SAFE_KEY.TXT` yields safe code **`8492`**.
   - **Drive Verification:** Enter `ATLAS-2000` (or `8492`, `MOUNT D:`, `FLASH`) -> triggers flashing red warning + `[ ABORT EMERGENCY PROTOCOL ]`.
5. **Victory (`VICTORY`):** Stops countdown, runs checks, turns terminal phosphor white (`theme-white`), prints Dr. Ferland victory dialogue + `JANUARY 1, 2000 - 00:00:00` + `HINTS REVEALED` stats.

---

## 3. Established Conventions & Constraints

- **Pure Vanilla Frontend:** Keep zero bundler dependencies so `index.html` runs directly from static HTTP or browser.
- **UI Safety:** Never leak hidden modal keystrokes into `#hidden-input`, and always clear `theme-white` + hide `#abort-button-container` on `reboot`.
- **Hint Accessibility:** Both `[ ? HINT ]` button, `F1`, and CLI `hint [topic]` invoke `#hint-modal` with keyboard shortcuts (`1`-`3`, `N`, `B`, `Esc`).
- **Configurable Page Number:** Phase 2 Server Hint 2 page number defaults to `'#'` and can be set via `?page=<num>` query parameter.

---

## 4. Verification Commands

- **JS Syntax Check:** `node -c /Users/ritvik/Documents/Y2K/terminal.js`
- **Secret Scan before Push:** `gitleaks detect --source /Users/ritvik/Documents/Y2K`
- **Git Status & Remote Push:** `git status && git push origin main`
- **Local Preview:** `python3 -m http.server 8000 --directory /Users/ritvik/Documents/Y2K`
