'use strict';

(() => {
  const form = document.getElementById('terminal-form');
  const gameConsole = document.getElementById('game-console');
  const startScreen = document.getElementById('start-screen');
  const beginCommunicationButton = document.getElementById('begin-communication');
  const countdownDisplay = document.getElementById('countdown');
  const input = document.getElementById('terminal-input');
  const scriptDisplay = document.getElementById('script-display');
  const output = document.getElementById('terminal-output');
  const status = document.getElementById('terminal-status');
  const gameMasterControls = document.getElementById('game-master-controls');
  const fullscreenToggleButton = document.getElementById('fullscreen-toggle');
  const lightsToggleButton = document.getElementById('lights-toggle');
  const bleConnectButton = document.getElementById('ble-connect');
  const skipToTimeoutButton = document.getElementById('skip-to-timeout');
  const simulateWinButton = document.getElementById('simulate-win');
  const fullResetButton = document.getElementById('full-reset');
  const quitDebugMenuButton = document.getElementById('quit-debug-menu');
  const bleStatus = document.getElementById('ble-status');
  const lightStates = new Set(['idle', 'flashing_red', 'solid_red', 'celebration']);
  const historyKey = 'atlasHintHistory';
  const winHistoryKey = 'atlasWinHistory';
  const lightsEnabledKey = 'atlasLightsEnabled';
  let currentScript = 1;
  const pendingAudioFiles = new Set();
  let activeScriptAudio = null;
  let scriptTypingInterval = null;
  let desiredLightState = 'flashing_red';
  let lightCharacteristic = null;
  let winCharacteristic = null;
  let lightDevice = null;
  let lightWriteQueue = Promise.resolve();
  let lightConfig = null;
  let lightsEnabled = false;
  let soundEffects = null;
  let gameMasterPassword = null;
  let debugMenuOpen = false;
  let helpConfig = null;
  let helpConfigError = null;
  let hintHistory = [];
  let gameConfig = null;
  let countdownInterval = null;
  let countdownDeadline = null;
  let countdownStartedAt = null;
  let countdownStarted = false;
  let lowTimeWarningSent = false;
  let countdownGeneration = 0;
  let lostState = false;
  let wonState = false;
  let winElapsedSeconds = null;
  let winHistory = [];
  let tvOff = false;

  try {
    const savedHistory = localStorage.getItem(historyKey);
    if (savedHistory) {
      const parsedHistory = JSON.parse(savedHistory);
      if (!Array.isArray(parsedHistory) || parsedHistory.some((record) =>
        !record || !Number.isInteger(record.script) || typeof record.category !== 'string' ||
        !Number.isInteger(record.hint) || typeof record.text !== 'string' ||
        typeof record.requestedAt !== 'string'
      )) {
        throw new Error('Saved hint history has an invalid format.');
      }
      hintHistory = parsedHistory;
    }
  } catch (error) {
    console.error('Could not load saved hint history:', error);
    status.textContent = 'Hint history could not be loaded from this browser.';
  }

  try {
    const savedWinHistory = localStorage.getItem(winHistoryKey);
    if (savedWinHistory) {
      const parsedWinHistory = JSON.parse(savedWinHistory);
      if (!Array.isArray(parsedWinHistory) || parsedWinHistory.some((record) =>
        !record || !Number.isSafeInteger(record.elapsedSeconds) || record.elapsedSeconds < 0 ||
        typeof record.completedAt !== 'string'
      )) {
        throw new Error('Saved win history has an invalid format.');
      }
      winHistory = parsedWinHistory;
    }
  } catch (error) {
    console.error('Could not load saved win history:', error);
    status.textContent = 'Win history could not be loaded from this browser.';
  }

  Object.defineProperty(window, 'atlasHintHistory', {
    configurable: false,
    get: () => hintHistory
  });

  Object.defineProperty(window, 'atlasWinHistory', {
    configurable: false,
    get: () => winHistory
  });

  function updateGameMasterControls() {
    gameMasterControls.hidden = !debugMenuOpen;
    fullscreenToggleButton.textContent = document.fullscreenElement ? 'EXIT FULLSCREEN' : 'ENTER FULLSCREEN';
    lightsToggleButton.textContent = lightsEnabled ? 'DISABLE LIGHTS' : 'ENABLE LIGHTS';
    bleConnectButton.hidden = !lightsEnabled;
    if (!lightsEnabled) setBleStatus('disabled');
  }

  function setBleStatus(message) {
    bleStatus.textContent = `Lights: ${message}`;
  }

  function formatClockTime(seconds) {
    const secondsInDay = 24 * 60 * 60;
    const clockSeconds = ((seconds % secondsInDay) + secondsInDay) % secondsInDay;
    const hours = Math.floor(clockSeconds / 3600);
    const minutes = Math.floor((clockSeconds % 3600) / 60);
    const remainingSeconds = clockSeconds % 60;
    return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(remainingSeconds).padStart(2, '0')}`;
  }

  function formatDuration(seconds) {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const remainingSeconds = seconds % 60;
    return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(remainingSeconds).padStart(2, '0')}`;
  }

  function getStartingClockSeconds() {
    return 24 * 60 * 60 - gameConfig.timerMinutes * 60;
  }

  function stopCountdown() {
    if (countdownInterval !== null) {
      window.clearInterval(countdownInterval);
      countdownInterval = null;
    }
    countdownDeadline = null;
  }

  function updateCountdown() {
    const secondsRemaining = Math.max(0, Math.ceil((countdownDeadline - Date.now()) / 1000));
    const elapsedSeconds = gameConfig.timerMinutes * 60 - secondsRemaining;
    countdownDisplay.textContent = formatClockTime(getStartingClockSeconds() + elapsedSeconds);
    if (secondsRemaining <= 5 * 60 && !lowTimeWarningSent) {
      lowTimeWarningSent = true;
      setLightState('flashing_red');
    }
    if (secondsRemaining === 0) {
      window.clearInterval(countdownInterval);
      countdownInterval = null;
      enterLostState();
    }
  }

  async function startCountdown() {
    if (countdownStarted) return;
    countdownStarted = true;
    const generation = countdownGeneration;
    await gameConfigPromise;
    if (generation !== countdownGeneration || !gameConfig) return;

    countdownDeadline = Date.now() + gameConfig.timerMinutes * 60 * 1000;
    countdownStartedAt = Date.now();
    updateCountdown();
    countdownInterval = window.setInterval(updateCountdown, 250);
  }

  async function skipToTimeout() {
    await gameConfigPromise;
    if (!gameConfig) {
      status.textContent = 'Cannot skip to timeout because game settings are unavailable.';
      return;
    }
    if (lostState) {
      appendOutput('The lost state has already started. Use FULL RESET for a new game.');
      return;
    }

    countdownGeneration += 1;
    countdownStarted = true;
    countdownDeadline = Date.now() + 5000;
    countdownStartedAt = Date.now();
    if (countdownInterval !== null) {
      window.clearInterval(countdownInterval);
    }
    updateCountdown();
    if (countdownDeadline !== null) {
      countdownInterval = window.setInterval(updateCountdown, 250);
    }
    appendOutput('Timer set to 23:59:55. Timeout in five seconds.');
  }

  function resetCountdown() {
    countdownGeneration += 1;
    countdownStarted = false;
    countdownStartedAt = null;
    lowTimeWarningSent = false;
    stopCountdown();
    countdownDisplay.textContent = gameConfig ? formatClockTime(getStartingClockSeconds()) : '--:--:--';
  }

  function setLightState(state) {
    if (!lightStates.has(state)) {
      throw new Error(`Unknown light state: ${state}`);
    }

    desiredLightState = state;
    if (!lightsEnabled || !lightCharacteristic || !lightDevice?.gatt?.connected) return;

    lightWriteQueue = lightWriteQueue
      .then(async () => {
        if (!lightCharacteristic || !lightDevice?.gatt?.connected) return;
        const value = new TextEncoder().encode(desiredLightState);
        await lightCharacteristic.writeValueWithResponse(value);
        setBleStatus(`connected (${desiredLightState.replace('_', ' ')})`);
      })
      .catch((error) => {
        console.error('Could not send light state to ESP32:', error);
        setBleStatus('connected, command failed');
      });
  }

  window.setAtlasLightState = setLightState;

  const configPromise = fetch('config.json', { cache: 'no-store' })
    .then((response) => {
      if (!response.ok) {
        throw new Error(`Could not load config.json: HTTP ${response.status}`);
      }
      return response.json();
    })
    .then((config) => {
      if (!config || typeof config !== 'object' || Array.isArray(config)) {
        throw new Error('Configuration must contain a JSON object.');
      }
      return config;
    });

  const gameConfigPromise = configPromise
    .then((config) => {
      if (!config.game || !Number.isSafeInteger(config.game.timerMinutes) || config.game.timerMinutes <= 0) {
        throw new Error('Configuration must contain a positive integer game.timerMinutes value.');
      }
      gameConfig = config.game;
      countdownDisplay.textContent = formatClockTime(getStartingClockSeconds());
    })
    .catch((error) => {
      console.error(error);
      status.textContent = 'Game settings are unavailable. Check config.json.';
    });

  fullscreenToggleButton.addEventListener('click', async () => {
    try {
      if (document.fullscreenElement) {
        await document.exitFullscreen();
      } else {
        await document.documentElement.requestFullscreen();
      }
    } catch (error) {
      console.error('Could not change fullscreen mode:', error);
      status.textContent = 'Fullscreen could not be changed. Use the browser fullscreen control instead.';
    }
  });

  document.addEventListener('fullscreenchange', () => {
    updateGameMasterControls();
  });

  function handleLightDisconnect() {
    lightCharacteristic = null;
    winCharacteristic = null;
    lightDevice = null;
    bleConnectButton.textContent = 'CONNECT LIGHTS';
    setBleStatus(lightsEnabled ? 'disconnected' : 'disabled');
  }

  function handleWinNotification(event) {
    const message = new TextDecoder().decode(event.target.value).trim();
    if (message === 'win') {
      enterWinState();
    } else {
      console.warn(`Ignored unknown ESP32 event "${message}".`);
    }
  }

  const lightConfigPromise = configPromise
    .then((config) => {
      const lights = config.lights;
      if (!lights || typeof lights.serviceUuid !== 'string' || !lights.serviceUuid.trim() ||
          typeof lights.characteristicUuid !== 'string' || !lights.characteristicUuid.trim() ||
          typeof lights.winCharacteristicUuid !== 'string' || !lights.winCharacteristicUuid.trim() ||
          typeof lights.enabledByDefault !== 'boolean') {
        throw new Error('Light controller configuration has an invalid format.');
      }
      lightConfig = lights;

      try {
        const storedSetting = localStorage.getItem(lightsEnabledKey);
        lightsEnabled = storedSetting === null ? config.enabledByDefault : storedSetting === 'true';
      } catch (error) {
        console.error('Could not read the lights setting:', error);
        lightsEnabled = config.enabledByDefault;
      }
      updateGameMasterControls();
    })
    .catch((error) => {
      console.error(error);
      setBleStatus('not configured');
    });

  function setLightsEnabled(enabled) {
    if (!lightConfig) {
      setBleStatus('not configured');
      return;
    }

    lightsEnabled = enabled;
    try {
      localStorage.setItem(lightsEnabledKey, String(lightsEnabled));
    } catch (error) {
      console.error('Could not save the lights setting:', error);
      status.textContent = 'Lights setting changed for this session but could not be saved.';
    }

    if (!lightsEnabled && lightDevice?.gatt?.connected) {
      lightDevice.gatt.disconnect();
    }
    updateGameMasterControls();
    if (lightsEnabled) setLightState(desiredLightState);
  }

  lightsToggleButton.addEventListener('click', () => {
    setLightsEnabled(!lightsEnabled);
  });

  gameMasterControls.querySelectorAll('[data-light-state]').forEach((button) => {
    button.addEventListener('click', () => {
      setLightState(button.dataset.lightState);
    });
  });

  skipToTimeoutButton.addEventListener('click', skipToTimeout);
  simulateWinButton.addEventListener('click', enterWinState);
  fullResetButton.addEventListener('click', resetGame);
  quitDebugMenuButton.addEventListener('click', quitDebugMenu);

  bleConnectButton.addEventListener('click', async () => {
    if (!lightConfig || !lightsEnabled) return;

    if (lightDevice?.gatt?.connected) {
      lightDevice.gatt.disconnect();
      handleLightDisconnect();
      return;
    }

    if (!navigator.bluetooth) {
      setBleStatus('Web Bluetooth unavailable; use Chrome or Edge on localhost/HTTPS');
      return;
    }

    bleConnectButton.disabled = true;
    setBleStatus('connecting');
    try {
      const device = await navigator.bluetooth.requestDevice({
        filters: [{ services: [lightConfig.serviceUuid] }],
        optionalServices: [lightConfig.serviceUuid]
      });
      device.addEventListener('gattserverdisconnected', handleLightDisconnect);

      const server = await device.gatt.connect();
      const service = await server.getPrimaryService(lightConfig.serviceUuid);
      lightCharacteristic = await service.getCharacteristic(lightConfig.characteristicUuid);
      winCharacteristic = await service.getCharacteristic(lightConfig.winCharacteristicUuid);
      await winCharacteristic.startNotifications();
      winCharacteristic.addEventListener('characteristicvaluechanged', handleWinNotification);
      lightDevice = device;
      bleConnectButton.textContent = 'DISCONNECT LIGHTS';
      setBleStatus('connected');
      setLightState(desiredLightState);
    } catch (error) {
      lightCharacteristic = null;
      winCharacteristic = null;
      lightDevice = null;
      if (error.name === 'NotFoundError') {
        setBleStatus('connection cancelled or no light controller found');
      } else {
        console.error('Could not connect to ESP32 lights:', error);
        setBleStatus('connection failed');
      }
    } finally {
      bleConnectButton.disabled = false;
    }
  });

  const gameMasterConfigPromise = configPromise
    .then((config) => {
      if (!config.gameMaster || typeof config.gameMaster.password !== 'string' ||
          !config.gameMaster.password.trim()) {
        throw new Error('Configuration needs a non-empty gameMaster.password value.');
      }
      gameMasterPassword = config.gameMaster.password.trim().toUpperCase();
    })
    .catch((error) => {
      console.error(error);
      status.textContent = 'Game master access is unavailable. Check config.json.';
    });

  const soundEffectsConfigPromise = configPromise
    .then((config) => {
      const events = config.soundEffects?.events;
      if (!events || typeof events !== 'object' ||
          typeof events.incorrectPassword !== 'string' ||
          !events.correctPassword || typeof events.correctPassword !== 'object' ||
          typeof events.correctPassword.script1 !== 'string' ||
          typeof events.correctPassword.script2 !== 'string' ||
          typeof events.timeExpired !== 'string' ||
          typeof events.powerDown !== 'string' ||
          typeof events.win !== 'string') {
        throw new Error('Sound effects configuration has an invalid format.');
      }
      soundEffects = events;
    })
    .catch((error) => {
      console.error(error);
      status.textContent = 'Sound effects are unavailable. Check config.json.';
    });

  async function playEventSound(eventName) {
    await soundEffectsConfigPromise;
    if (!soundEffects) return false;

    const file = eventName === 'incorrectPassword'
      ? soundEffects.incorrectPassword
      : eventName === 'timeExpired'
        ? soundEffects.timeExpired
        : eventName === 'powerDown'
          ? soundEffects.powerDown
          : eventName === 'win'
            ? soundEffects.win
            : soundEffects.correctPassword[`script${currentScript}`];
    if (!file) return false;

    const audio = new Audio(`sound-effects/${file}`);
    const playbackFinished = new Promise((resolve) => {
      audio.addEventListener('ended', () => resolve(true), { once: true });
      audio.addEventListener('error', () => resolve(false), { once: true });
    });

    try {
      const playback = audio.play();
      if (playback) await playback;
      if (audio.ended) return true;

      const completed = await playbackFinished;
      if (!completed) {
        console.error(`Could not play sound effect "${file}".`);
        status.textContent = `Unable to play sound effect "${file}".`;
      }
      return completed;
    } catch (error) {
      if (error.name === 'NotAllowedError') {
        pendingAudioFiles.add(`sound-effects/${file}`);
        return false;
      }

      console.error(`Could not play sound effect "${file}":`, error);
      status.textContent = `Unable to play sound effect "${file}".`;
      return false;
    }
  }

  async function showPasswordCorrectScreen(nextScript) {
    scriptDisplay.textContent = 'PASSWORD CORRECT';
    output.textContent = '';
    status.textContent = '';
    await playEventSound('correctPassword');
    await showScript(nextScript);
  }

  function validateHelpConfig(config) {
    if (!config || typeof config !== 'object' || !config.phases || typeof config.phases !== 'object') {
      throw new Error('Help configuration must contain a phases object.');
    }

    for (const phase of [1, 2, 3]) {
      const categories = config.phases[`script${phase}`];
      if (!Array.isArray(categories)) {
        throw new Error(`Help configuration needs a script${phase} category list.`);
      }

      const names = new Set();
      for (const category of categories) {
        if (!category || typeof category.name !== 'string' || !category.name.trim()) {
          throw new Error(`Every script${phase} category needs a name.`);
        }

        const normalizedName = category.name.trim().toLowerCase();
        if (names.has(normalizedName)) {
          throw new Error(`Duplicate help category "${category.name}" in script${phase}.`);
        }
        names.add(normalizedName);

        if (!Array.isArray(category.hints) || category.hints.length !== 3 ||
            category.hints.some((hint) => typeof hint !== 'string' || !hint.trim())) {
          throw new Error(`Category "${category.name}" in script${phase} must have exactly three non-empty hints.`);
        }
      }
    }

    return config.phases;
  }

  const helpConfigPromise = configPromise
    .then((config) => config.help)
    .then(validateHelpConfig)
    .then((phases) => {
      helpConfig = phases;
    })
    .catch((error) => {
      helpConfigError = error;
      console.error(error);
    });

  function appendOutput(text) {
    output.textContent += `${output.textContent ? '\n' : ''}${text}`;
  }

  function stopScriptTyping() {
    if (scriptTypingInterval !== null) {
      window.clearInterval(scriptTypingInterval);
      scriptTypingInterval = null;
    }
  }

  function typeScriptText(text) {
    stopScriptTyping();
    scriptDisplay.textContent = '';
    const characters = Array.from(text);
    let position = 0;
    scriptTypingInterval = window.setInterval(() => {
      scriptDisplay.textContent += characters[position];
      position += 1;
      if (position >= characters.length) stopScriptTyping();
    }, 20);
  }

  async function openDebugMenu() {
    await lightConfigPromise;
    debugMenuOpen = true;
    output.textContent = '';
    appendOutput('GAME MASTER DEBUG MENU');
    appendOutput('Use the grouped controls below to manage the display, lights, and game.');
    updateGameMasterControls();
  }

  function quitDebugMenu() {
    debugMenuOpen = false;
    output.textContent = '';
    status.textContent = '';
    updateGameMasterControls();
    input.focus();
  }

  function startTvPowerOff() {
    if (!lostState || currentScript !== 4 || tvOff) return;
    tvOff = true;
    document.body.classList.add('tv-off');
    gameConsole.classList.add('tv-powering-off');
  }

  function restoreFinalScreen() {
    if (!tvOff) return;
    tvOff = false;
    gameConsole.classList.remove('tv-powering-off');
    document.body.classList.remove('tv-off');
  }

  document.addEventListener('click', restoreFinalScreen);

  async function enterLostState() {
    if (lostState || wonState) return;
    lostState = true;
    countdownDeadline = null;
    pendingAudioFiles.clear();
    setLightState('solid_red');
    if (activeScriptAudio) {
      activeScriptAudio.pause();
      activeScriptAudio.currentTime = 0;
      activeScriptAudio = null;
    }

    const scriptLoaded = await showScript(4);
    if (scriptLoaded) playEventSound('timeExpired');
  }

  async function enterWinState() {
    if (wonState || lostState) return;
    wonState = true;
    winElapsedSeconds = countdownStartedAt === null
      ? 0
      : Math.max(0, Math.floor((Date.now() - countdownStartedAt) / 1000));
    countdownGeneration += 1;
    countdownStarted = true;
    stopCountdown();
    countdownStartedAt = null;
    countdownDisplay.textContent = '00:00:00';
    pendingAudioFiles.clear();
    setLightState('celebration');
    const winRecord = {
      elapsedSeconds: winElapsedSeconds,
      completedAt: new Date().toISOString()
    };
    winHistory.push(winRecord);
    try {
      localStorage.setItem(winHistoryKey, JSON.stringify(winHistory));
    } catch (error) {
      console.error('Could not save win time:', error);
      status.textContent = 'Win recorded, but the time could not be saved in this browser.';
    }
    if (activeScriptAudio) {
      activeScriptAudio.pause();
      activeScriptAudio.currentTime = 0;
      activeScriptAudio = null;
    }

    const scriptLoaded = await showScript(5);
    if (scriptLoaded) playEventSound('win');
  }

  window.atlasWinGame = enterWinState;

  async function resetGame() {
    debugMenuOpen = false;
    lostState = false;
    wonState = false;
    winElapsedSeconds = null;
    tvOff = false;
    gameConsole.classList.remove('tv-powering-off');
    document.body.classList.remove('tv-off');
    currentScript = 1;
    stopScriptTyping();
    pendingAudioFiles.clear();
    if (activeScriptAudio) {
      activeScriptAudio.pause();
      activeScriptAudio.currentTime = 0;
      activeScriptAudio = null;
    }
    resetCountdown();
    setLightState('flashing_red');
    hintHistory = [];
    output.textContent = '';
    scriptDisplay.textContent = '';
    status.textContent = '';
    gameConsole.hidden = true;
    startScreen.hidden = false;
    beginCommunicationButton.disabled = false;
    document.body.classList.add('start-active');
    updateGameMasterControls();

    let historyClearError = null;
    try {
      localStorage.removeItem(historyKey);
    } catch (error) {
      historyClearError = error;
      console.error('Could not clear saved hint history:', error);
    }

    beginCommunicationButton.focus();

    if (historyClearError) {
      status.textContent = 'Game reset, but saved hint history could not be cleared from this browser.';
    }
  }

  async function showHelpTopics() {
    await helpConfigPromise;
    if (!helpConfig) {
      status.textContent = 'Help topics are unavailable. Check config.json.';
      return;
    }

    const categories = helpConfig[`script${currentScript}`];
    appendOutput('What do you need help with?');
    if (categories.length === 0) {
      appendOutput('No help topics are configured for this script.');
      return;
    }

    for (const category of categories) {
      appendOutput(category.name);
    }
  }

  function recordHint(category, hintNumber, hintText) {
    const record = {
      script: currentScript,
      category: category.name,
      hint: hintNumber,
      text: hintText,
      requestedAt: new Date().toISOString()
    };
    hintHistory.push(record);

    try {
      localStorage.setItem(historyKey, JSON.stringify(hintHistory));
    } catch (error) {
      console.error('Could not save hint history:', error);
      status.textContent = 'Hint shown, but usage could not be saved in this browser.';
    }
  }

  async function showCategoryHint(categoryName) {
    await helpConfigPromise;
    if (!helpConfig) {
      status.textContent = 'Help topics are unavailable. Check config.json.';
      return true;
    }

    const categories = helpConfig[`script${currentScript}`];
    const category = categories.find((item) => item.name.trim().toLowerCase() === categoryName.toLowerCase());
    if (!category) return false;

    const requestedCount = hintHistory.filter((record) =>
      record.script === currentScript && record.category.toLowerCase() === category.name.trim().toLowerCase()
    ).length;

    if (requestedCount >= category.hints.length) {
      appendOutput(`All three hints for "${category.name}" have been shown.`);
      return true;
    }

    const hintNumber = requestedCount + 1;
    const hintText = category.hints[requestedCount];
    appendOutput(`${category.name} - Hint ${hintNumber}: ${hintText}`);
    recordHint(category, hintNumber, hintText);
    return true;
  }

  function playScriptAudio(number) {
    const file = `scripts/script${number}.wav`;
    const audio = new Audio(file);
    activeScriptAudio = audio;
    audio.preload = 'auto';

    const onFinished = () => {
      if (number === 1) {
        setLightState('idle');
        startCountdown();
      } else if (number === 4) {
        playEventSound('powerDown');
        startTvPowerOff();
      }
    };
    audio.addEventListener('ended', onFinished, { once: true });
    audio.addEventListener('error', onFinished, { once: true });

    audio.play().then(() => {
      if (number === 1) setLightState('flashing_red');
    }).catch((error) => {
      if (error.name === 'NotAllowedError') {
        pendingAudioFiles.add(file);
        return;
      }

      onFinished();
      console.error(`Could not play ${file}:`, error);
      status.textContent = `Unable to play ${file}. Check the audio file.`;
    });
  }

  function playPendingAudio() {
    const files = Array.from(pendingAudioFiles);
    pendingAudioFiles.clear();

    for (const file of files) {
      const audio = new Audio(file);
      const isFirstScript = file === 'scripts/script1.wav';
      const isFourthScript = file === 'scripts/script4.wav';
      if (isFirstScript || isFourthScript) activeScriptAudio = audio;

      const onFinished = () => {
        if (isFirstScript) {
          setLightState('idle');
          startCountdown();
        } else if (isFourthScript) {
          playEventSound('powerDown');
          startTvPowerOff();
        }
      };
      if (isFirstScript || isFourthScript) {
        audio.addEventListener('ended', onFinished, { once: true });
        audio.addEventListener('error', onFinished, { once: true });
      }

      if (isFirstScript) setLightState('flashing_red');
      audio.play().catch((error) => {
        if (error.name === 'NotAllowedError') {
          pendingAudioFiles.add(file);
          return;
        }

        onFinished();
        console.error(`Could not play ${file}:`, error);
        status.textContent = `Unable to play ${file}. Check the audio file.`;
      });
    }
  }

  async function showScript(number) {
    const file = `scripts/script${number}.txt`;
    stopScriptTyping();

    try {
      const response = await fetch(file, { cache: 'no-store' });
      if (!response.ok) {
        throw new Error(`Could not load ${file}: HTTP ${response.status}`);
      }

      const script = await response.text();
      const displayScript = number === 5 && winElapsedSeconds !== null
        ? `${script.trimEnd()}\n\nTOTAL TIME: ${formatDuration(winElapsedSeconds)}`
        : script;
      typeScriptText(displayScript);
      output.textContent = '';
      currentScript = number;
      status.textContent = '';
      if (number === 2 || number === 3) setLightState('idle');
      playScriptAudio(number);
      return true;
    } catch (error) {
      console.error(error);
      status.textContent = `Unable to load ${file}. Check the file and reload.`;
      return false;
    }
  }

  document.addEventListener('pointerdown', playPendingAudio);
  document.addEventListener('keydown', playPendingAudio);

  beginCommunicationButton.addEventListener('click', async () => {
    beginCommunicationButton.disabled = true;
    startScreen.hidden = true;
    document.body.classList.remove('start-active');
    gameConsole.hidden = false;
    await showScript(currentScript);
    input.focus();
  });

  input.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      form.requestSubmit();
    }
  });

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    const password = input.value.trim().toUpperCase();
    input.value = '';

    if (!password) return;

    if (debugMenuOpen) {
      if (password === 'LIGHTS ON') {
        setLightsEnabled(true);
        appendOutput('Lights enabled. Use CONNECT LIGHTS to choose the ESP32.');
      } else if (password === 'LIGHTS OFF') {
        setLightsEnabled(false);
        appendOutput('Lights disabled.');
      } else if (password === 'CONNECT LIGHTS') {
        appendOutput('Use the CONNECT LIGHTS button to choose the ESP32.');
      } else if (password === 'SKIP TO 23:59:55') {
        await skipToTimeout();
      } else if (password === 'WIN TEST') {
        await enterWinState();
      } else if (password === 'FULL RESET') {
        await resetGame();
      } else if (password === 'QUIT') {
        quitDebugMenu();
      } else {
        appendOutput('Choose LIGHTS ON, LIGHTS OFF, SKIP TO 23:59:55, WIN TEST, FULL RESET, or QUIT.');
      }
      return;
    }

    await gameMasterConfigPromise;
    if (gameMasterPassword && password === gameMasterPassword) {
      await openDebugMenu();
    } else if (wonState) {
      appendOutput('GAME COMPLETE. Enter the administrator password to reset the game.');
    } else if (lostState) {
      appendOutput('TIME EXPIRED. Enter the administrator password to reset the game.');
    } else if ((currentScript === 1 && password === 'OOPS') ||
               (currentScript === 2 && password === 'NSYNC')) {
      const correctScript = currentScript;
      input.disabled = true;
      await showPasswordCorrectScreen(correctScript + 1);
      input.disabled = false;
      input.focus();
    } else if (password.toUpperCase() === 'HELP') {
      await showHelpTopics();
    } else {
      input.disabled = true;
      const foundTopic = await showCategoryHint(password);
      if (!foundTopic) {
        await playEventSound('incorrectPassword');
      }
      input.disabled = false;
      input.focus();
      if (!foundTopic) {
        status.textContent = 'Input not recognized. Type HELP to see available topics.';
      }
    }
  });

})();
