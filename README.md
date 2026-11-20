# Atlas System Console

A simple browser terminal that displays editable scripts and advances when players enter the passwords.

When the page opens, click **BEGIN COMMUNICATION** to start Script 1 and begin the game.

## Countdown

The header clock begins when Script 1 audio finishes and counts up to midnight. For example, a 30-minute timer starts at `23:30:00`, and a 45-minute timer starts at `23:15:00`. Edit `game.timerMinutes` in `config.json` to change the duration in whole minutes:

```json
{
  "game": {
    "timerMinutes": 30
  }
}
```

When five minutes remain, connected lights switch to `flashing_red`.

When the timer expires, the game enters the lost state, displays `scripts\script4.txt`, plays `scripts\script4.wav`, and sets connected lights to solid red. The `scripts\script4.wav` file is a silent placeholder; replace it with the loss audio. Full reset returns to the start screen and resets the timer.

After Script 4 audio finishes, the configured power-down sound plays during the console's CRT-style animation to black. The timeout sound continues independently. Click anywhere to restore the final screen.

The win state is available through `window.atlasWinGame()`. Calling it stops the timer without triggering a loss, changes the clock display to `00:00:00`, displays and plays Script 5, plays the configured win sound, and sets connected lights to `celebration`. Script 5 displays the elapsed game time. Completed times are saved in browser `localStorage` under `atlasWinHistory` and exposed at runtime as `window.atlasWinHistory`; a full reset does not clear this history. To test it, enter the game master menu and click **SIMULATE WIN** or type `WIN TEST`. Connect a puzzle's success condition to `window.atlasWinGame()` when that condition is ready. Script 5 and its WAV file are editable in `scripts\script5.txt` and `scripts\script5.wav`.

## Scripts

Edit these files to change what appears on screen:

- `scripts\script1.txt` appears when the console opens.
- `scripts\script1.wav` plays when Script 1 is displayed.
- Enter `OOPS` to display `scripts\script2.txt`.
- `scripts\script2.wav` plays when Script 2 is displayed.
- Enter `NSYNC` to display `scripts\script3.txt`.
- `scripts\script3.wav` plays when Script 3 is displayed.
- When time expires, `scripts\script4.txt` and `scripts\script4.wav` are used for the lost state.
- On a win, `scripts\script5.txt` and `scripts\script5.wav` are used for the win screen.

The script files are plain text. Their contents are displayed as-is, including line breaks.
Script text is revealed with a typewriter effect; other interface text appears normally.
The WAV files are silent placeholders; replace them with recordings to add script audio. Browsers may wait for the first user interaction before allowing audio playback.

Store additional short audio clips in `sound-effects\`.

## ESP32 light controller (BLE)

The browser can connect directly to an ESP32 over Bluetooth Low Energy; no Wi-Fi network or router is needed. Enter the game master password to open the debug menu, enable lights, then click **CONNECT LIGHTS** and select `Atlas-Lights`. BLE support requires a Web Bluetooth-capable Chromium browser on `localhost` or HTTPS.

The `lights` section of `config.json` contains the BLE service and characteristic UUIDs and the optional default enabled setting. The default is disabled. The enabled/disabled setting can also be changed from the game master menu with `LIGHTS ON` and `LIGHTS OFF` and is remembered in this browser. The **CONNECT LIGHTS** picker is only shown in that menu while lights are enabled.

The game master menu has test buttons for **IDLE**, **FLASHING RED**, **SOLID RED**, and **CELEBRATION**. Enable and connect the lights first; selecting a test state sends it to the ESP32.

The browser sends `flashing_red` from the start menu and while Script 1 audio is playing, then `idle` when it ends. When a controller connects, it receives the current light state and subscribes to its win notifications. On timeout, connected lights are set to `solid_red`; on a win, they are set to `celebration`. If lights are disabled, no controller is connected, the user cancels the device picker, or Web Bluetooth is unavailable, the game continues without sending anything. The browser exposes `window.setAtlasLightState("solid_red")` for setting a state.

The starter Arduino sketch is in `esp32-ble-lights\AtlasLights.ino`. Install **NimBLE-Arduino** and **FastLED** from the Arduino Library Manager, select an ESP32 board, and upload the sketch. It is set up for a 100-LED WS2812B strip in GRB order on data pin 13, with brightness 150. Idle is off, flashing red smoothly pulses the full strip using a sine wave, solid red holds the strip red, and celebration animates a rainbow pattern. If your strip uses a different chipset or color order, adjust the `FastLED.addLeds` template in the sketch. Use an appropriately rated external power supply for the LED strip and connect its ground to ESP32 ground.

Wire a momentary pushbutton between GPIO 27 and GND. Pressing it sends a BLE `win` notification to the connected game; the browser enters the win state, stops the timer, displays Script 5, plays the configured win sound, and sets the lights to `celebration`. The button is debounced in the sketch.

## Event sound effects

Edit `soundEffects.events` in `config.json` to assign a clip filename to an event. Put the referenced clips in `sound-effects\`. Leave a filename empty to disable that event's sound:

```json
{
  "soundEffects": {
    "events": {
      "incorrectPassword": "",
      "correctPassword": {
        "script1": "mmm_yeah.wav",
        "script2": "may.wav"
      },
      "timeExpired": "time-expired.wav",
      "powerDown": "power_down.wav",
      "win": "win.wav"
    }
  }
}
```

Incorrect-password audio plays for invalid passwords and unrecognized terminal input; correct-password audio is selected by the current script stage.
After a correct password, the console displays `PASSWORD CORRECT` until that stage's configured sound effect finishes, then loads the next script. If no sound is configured, it proceeds immediately.
The configured `sound-effects\time-expired.wav` is currently a silent placeholder. Replace it with the timeout sound to play it alongside the Script 4 audio.
The configured `sound-effects\power_down.wav` is a silent placeholder. Replace it with the shutdown sound to play it during the CRT power-down animation.
The configured `sound-effects\win.wav` is a silent placeholder. Replace it with the win sound to play it when the win state begins.

## Configurable help

Edit `help.phases` in `config.json` to add any number of help categories to each script stage. Every category must have a unique name within its stage and exactly three non-empty hints:

```json
{
  "help": {
    "phases": {
      "script1": [
        {
          "name": "Example topic",
          "hints": ["First hint", "Second hint", "Third hint"]
        }
      ],
      "script2": [],
      "script3": []
    }
  }
}
```

Players type `HELP` to list the current stage's categories, then type a category name to reveal its next hint. Hints are shown in order, and each category stops after its third hint. Requested hints are recorded in this browser's `localStorage` under `atlasHintHistory` and are also available at runtime as `window.atlasHintHistory`. Records include the script stage, category, hint number and text, and request time; they are not sent to a server.

## Game master reset

The game master password is set in `gameMaster.password` in `config.json` (currently `britney`). Enter it in the terminal to open the debug menu. Controls are grouped into display, lights, light-state tests, game-flow, and session rows. Click **RETURN TO GAME** to close the menu without changing settings, or **FULL RESET** to return to the start screen and clear saved hint history for a new game. Full reset preserves the fullscreen and lights enabled/disabled settings.

Use the **SKIP TO 23:59:55** admin control, or enter `SKIP TO 23:59:55` in the debug menu, to set the clock five seconds before timeout for testing.

This is a local game-control feature, not secure authentication: the browser must download the configuration file, so anyone with access to the page can inspect the password. Do not reuse a sensitive password or expose this setup as a protected online admin tool.

## Run locally

In PowerShell, run these two commands to start the local server from the project folder:

```powershell
Set-Location "$HOME\OneDrive\Documents\GitHub\ESCAPE-ROOM"
py -m http.server 8000 --bind 127.0.0.1
```

Keep that PowerShell window open while you play. Open `http://127.0.0.1:8000` in Chrome or Firefox. To stop the server, return to PowerShell and press **Ctrl+C**. If the `py` command is not recognized, use `python -m http.server 8000 --bind 127.0.0.1` instead.
