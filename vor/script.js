const screens = {
  setup: document.getElementById("setup-screen"),
  countdown: document.getElementById("countdown-screen"),
  exercise: document.getElementById("exercise-screen"),
  rating: document.getElementById("rating-screen"),
  documentation: document.getElementById("documentation-screen"),
};

const heroBanner = document.getElementById("hero-banner");

const controls = {
  bpm: document.getElementById("bpm"),
  duration: document.getElementById("duration"),
  targetAmplitude: document.getElementById("target-amplitude"),
  plane: document.getElementById("plane"),
  targetMotion: document.getElementById("target-motion"),
  position: document.getElementById("position"),
  surface: document.getElementById("surface"),
};

const display = {
  bpmValue: document.getElementById("bpm-value"),
  durationValue: document.getElementById("duration-value"),
  targetAmplitudeValue: document.getElementById("target-amplitude-value"),
  setupPreview: document.getElementById("setup-preview"),
  setNumber: document.getElementById("set-number"),
  countdownNumber: document.getElementById("countdown-number"),
  countdownSummary: document.getElementById("countdown-summary"),
  liveSetNumber: document.getElementById("live-set-number"),
  timeRemaining: document.getElementById("time-remaining"),
  liveBpm: document.getElementById("live-bpm"),
  instructionLine: document.getElementById("instruction-line"),
  metaLine: document.getElementById("meta-line"),
  selectedRating: document.getElementById("selected-rating"),
  completedCount: document.getElementById("completed-count"),
  soapNote: document.getElementById("soap-note"),
};

const actions = {
  backToTop: document.getElementById("back-to-top"),
  start: document.getElementById("start-button"),
  finishEarly: document.getElementById("generate-early-button"),
  endSet: document.getElementById("end-set-button"),
  saveRating: document.getElementById("save-rating-button"),
  restart: document.getElementById("restart-button"),
};

const ratingGrid = document.getElementById("rating-grid");
const themeButtons = [...document.querySelectorAll(".theme-icon")];
const focusTarget = document.getElementById("focus-target");
const pulseRing = document.getElementById("pulse-ring");
const pulseCenter = document.getElementById("pulse-center");

const MAX_SETS = 3;
let setResults = [];
let currentSetConfig = null;
let selectedRating = null;
let countdownTimer = null;
let sessionTimer = null;
let beatTimer = null;
let targetMotionFrame = null;
let exerciseStartedAt = null;
let audioContext = null;
let deviceThemeQuery = null;
let currentThemeMode = "device";

function initialize() {
  setupThemeListener();
  buildRatingButtons();
  bindEvents();
  applyTheme();
  updateSetupPreview();
  refreshSessionState();
}

function bindEvents() {
  Object.values(controls).forEach((control) => {
    control.addEventListener("input", updateSetupPreview);
    control.addEventListener("change", updateSetupPreview);
  });

  themeButtons.forEach((button) => {
    button.addEventListener("click", () => applyTheme(button.dataset.theme));
  });

  actions.backToTop.addEventListener("click", goBackToTop);
  actions.start.addEventListener("click", startCountdown);
  actions.endSet.addEventListener("click", () => finishExercise(true));
  actions.saveRating.addEventListener("click", saveRating);
  actions.finishEarly.addEventListener("click", generateDocumentation);
  actions.restart.addEventListener("click", resetSession);
}

function setupThemeListener() {
  if (!window.matchMedia) {
    return;
  }

  deviceThemeQuery = window.matchMedia("(prefers-color-scheme: light)");
  const syncTheme = () => {
    if (currentThemeMode === "device") {
      applyTheme();
    }
  };

  if (deviceThemeQuery.addEventListener) {
    deviceThemeQuery.addEventListener("change", syncTheme);
  } else if (deviceThemeQuery.addListener) {
    deviceThemeQuery.addListener(syncTheme);
  }
}

function syncThemeButtons() {
  themeButtons.forEach((button) => {
    button.classList.toggle("is-active", button.dataset.theme === currentThemeMode);
  });
}

function applyTheme(mode = currentThemeMode) {
  currentThemeMode = mode;
  const resolvedTheme = mode === "device"
    ? (deviceThemeQuery?.matches ? "light" : "dark")
    : mode;

  document.body.dataset.theme = resolvedTheme;
  syncThemeButtons();
}

function buildRatingButtons() {
  for (let value = 0; value <= 10; value += 1) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "rating-button";
    button.textContent = String(value);
    button.setAttribute("role", "radio");
    button.setAttribute("aria-checked", "false");
    button.addEventListener("click", () => selectRating(value));
    ratingGrid.appendChild(button);
  }
}

function goBackToTop() {
  window.location.href = "../launch.html";
}

function updateSetupPreview() {
  applyTheme();
  const config = getCurrentConfig();
  display.bpmValue.textContent = config.bpm;
  display.durationValue.textContent = config.duration;
  display.targetAmplitudeValue.textContent = config.targetAmplitude;
  display.setupPreview.textContent =
    `${config.plane} head turns for ${config.duration} seconds at ${config.bpm} BPM, ` +
    `${config.targetMotionLabel} at ${config.targetAmplitude}px amplitude, ${config.position.toLowerCase()} on ${config.surface.toLowerCase()} surface, with audible beep.`;
}

function getCurrentConfig() {
  return {
    bpm: Number(controls.bpm.value),
    duration: Number(controls.duration.value),
    targetAmplitude: Number(controls.targetAmplitude.value),
    plane: controls.plane.value,
    targetMotion: controls.targetMotion.value,
    targetMotionLabel: formatTargetMotion(controls.targetMotion.value),
    position: controls.position.value,
    surface: controls.surface.value,
  };
}

function refreshSessionState() {
  const setNumber = setResults.length + 1;
  display.setNumber.textContent = String(Math.min(setNumber, MAX_SETS));
  actions.finishEarly.disabled = setResults.length === 0;

  if (setResults.length >= MAX_SETS) {
    generateDocumentation();
  }
}

function showScreen(name) {
  Object.values(screens).forEach((screen) => screen.classList.remove("active"));
  screens[name].classList.add("active");
  heroBanner.classList.toggle(
    "hidden",
    name === "countdown" || name === "exercise"
  );
}

function startCountdown() {
  clearAllTimers();
  currentSetConfig = getCurrentConfig();
  selectedRating = null;
  display.selectedRating.textContent = "Select 0-10";
  actions.saveRating.disabled = true;
  updateRatingSelection();

  display.countdownSummary.textContent =
    `Set ${setResults.length + 1}: ${currentSetConfig.plane} at ${currentSetConfig.bpm} BPM for ${currentSetConfig.duration} seconds.`;

  let count = 3;
  display.countdownNumber.textContent = String(count);
  showScreen("countdown");
  playBeep(880, 0.1, true);

  countdownTimer = setInterval(() => {
    count -= 1;

    if (count > 0) {
      display.countdownNumber.textContent = String(count);
      playBeep(880, 0.1, true);
      return;
    }

    clearInterval(countdownTimer);
    playBeep(880, 0.12, true);
    beginExercise();
  }, 1000);
}

function beginExercise() {
  exerciseStartedAt = Date.now();
  display.liveSetNumber.textContent = String(setResults.length + 1);
  display.liveBpm.textContent = `${currentSetConfig.bpm} BPM`;
  display.instructionLine.textContent =
    `Keep eyes on the center target while moving the head ${currentSetConfig.plane.toLowerCase()}.`;
  display.metaLine.textContent =
    `${currentSetConfig.plane} | ${currentSetConfig.targetMotionLabel} | ${currentSetConfig.targetAmplitude}px | ${currentSetConfig.position} | ${currentSetConfig.surface} surface`;
  updateRemainingTime(currentSetConfig.duration);
  showScreen("exercise");
  updateTargetMotionPosition();

  clearInterval(sessionTimer);
  clearInterval(beatTimer);

  sessionTimer = setInterval(() => {
    const elapsedSeconds = Math.floor((Date.now() - exerciseStartedAt) / 1000);
    const remaining = Math.max(currentSetConfig.duration - elapsedSeconds, 0);
    updateRemainingTime(remaining);

    if (remaining <= 0) {
      finishExercise(false);
    }
  }, 250);

  const beatInterval = (60 / currentSetConfig.bpm) * 1000;
  beatTimer = setInterval(() => {
    playBeep(880, 0.08, true);
  }, beatInterval);

  playBeep(880, 0.08, true);
  startTargetMotion();
}

function finishExercise(endedEarly) {
  clearInterval(sessionTimer);
  clearInterval(beatTimer);
  cancelAnimationFrame(targetMotionFrame);
  resetTargetMotionPosition();

  const elapsedSeconds = Math.max(
    1,
    Math.min(
      currentSetConfig.duration,
      Math.round((Date.now() - exerciseStartedAt) / 1000)
    )
  );

  currentSetConfig = {
    ...currentSetConfig,
    completedDuration: elapsedSeconds,
    endedEarly,
  };

  showScreen("rating");
}

function selectRating(value) {
  selectedRating = value;
  display.selectedRating.textContent = String(value);
  actions.saveRating.disabled = false;
  updateRatingSelection();
}

function updateRatingSelection() {
  [...ratingGrid.children].forEach((button, index) => {
    const isSelected = index === selectedRating;
    button.classList.toggle("selected", isSelected);
    button.setAttribute("aria-checked", String(isSelected));
  });
}

function saveRating() {
  const result = {
    ...currentSetConfig,
    dizziness: selectedRating,
  };

  setResults.push(result);
  selectedRating = null;
  refreshSessionState();

  if (setResults.length >= MAX_SETS) {
    generateDocumentation();
    return;
  }

  showScreen("setup");
}

function updateRemainingTime(secondsLeft) {
  const minutes = Math.floor(secondsLeft / 60);
  const seconds = secondsLeft % 60;
  display.timeRemaining.textContent = `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

function generateDocumentation() {
  clearAllTimers();
  showScreen("documentation");
  display.completedCount.textContent = String(setResults.length);
  display.soapNote.value = buildSoapNote();
}

function buildSoapNote() {
  if (setResults.length === 0) {
    return "No exercise sets were completed during this session.";
  }

  const subjectiveRatings = setResults
    .map((set, index) => `Set ${index + 1}: dizziness ${set.dizziness}/10`)
    .join("; ");

  const objectiveSets = setResults
    .map((set, index) => {
      const durationText = `${set.completedDuration} seconds${set.endedEarly ? " (ended early)" : ""}`;
      return `Set ${index + 1}: gaze stability exercise completed in ${set.position.toLowerCase()} on ${set.surface.toLowerCase()} surface, ${set.plane.toLowerCase()} head movement, ${set.targetMotionLabel.toLowerCase()} at ${set.targetAmplitude}px amplitude, ${set.bpm} BPM, ${durationText}, with audible metronome`;
    })
    .join(". ");

  const averageDizziness =
    (setResults.reduce((total, set) => total + set.dizziness, 0) / setResults.length).toFixed(1);

  return [
    "S:",
    `Patient completed ${setResults.length} gaze stability set${setResults.length > 1 ? "s" : ""}. Reported dizziness ratings: ${subjectiveRatings}. Average post-set dizziness ${averageDizziness}/10.`,
    "",
    "O:",
    objectiveSets + ".",
    "",
    "A:",
    `Patient tolerated gaze stability training with symptom response ranging from ${Math.min(...setResults.map((set) => set.dizziness))}/10 to ${Math.max(...setResults.map((set) => set.dizziness))}/10 dizziness. Skilled monitoring used to titrate duration, speed, position, and surface demands.`,
    "",
    "P:",
    "Continue vestibular gaze stability training and progress duration, tempo, support surface, and posture as tolerated. Reassess dizziness response before advancing intensity.",
    "",
    buildBriefSummary()
  ].join("\n");
}

function playBeep(frequency, duration, enabled) {
  if (!enabled) {
    return;
  }

  pulseTarget();

  if (!audioContext) {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextClass) {
      return;
    }
    audioContext = new AudioContextClass();
  }

  if (audioContext.state === "suspended") {
    audioContext.resume();
  }

  const oscillator = audioContext.createOscillator();
  const gainNode = audioContext.createGain();

  oscillator.type = "sine";
  oscillator.frequency.value = frequency;
  gainNode.gain.setValueAtTime(0.0001, audioContext.currentTime);
  gainNode.gain.exponentialRampToValueAtTime(0.22, audioContext.currentTime + 0.01);
  gainNode.gain.exponentialRampToValueAtTime(0.0001, audioContext.currentTime + duration);

  oscillator.connect(gainNode);
  gainNode.connect(audioContext.destination);

  oscillator.start();
  oscillator.stop(audioContext.currentTime + duration);
}

function pulseTarget() {
  [pulseRing, pulseCenter].forEach((element) => {
    if (!element) {
      return;
    }

    element.classList.remove("is-pulsing");
    void element.offsetWidth;
    element.classList.add("is-pulsing");
  });
}

function clearAllTimers() {
  clearInterval(countdownTimer);
  clearInterval(sessionTimer);
  clearInterval(beatTimer);
  cancelAnimationFrame(targetMotionFrame);
}

function resetSession() {
  clearAllTimers();
  resetTargetMotionPosition();
  setResults = [];
  currentSetConfig = null;
  selectedRating = null;
  actions.saveRating.disabled = true;
  display.selectedRating.textContent = "Select 0-10";
  updateRatingSelection();
  refreshSessionState();
  updateSetupPreview();
  showScreen("setup");
}

function buildBriefSummary() {
  if (setResults.length === 0) {
    return "Brief Summary: No sets completed.";
  }

  const averageDizziness =
    (setResults.reduce((total, set) => total + set.dizziness, 0) / setResults.length).toFixed(1);
  const finalSet = setResults[setResults.length - 1];

  return "Brief Summary: " +
    `Patient completed ${setResults.length} gaze stability set${setResults.length > 1 ? "s" : ""} ` +
    `with ${finalSet.plane.toLowerCase()} head movement at tempos ranging from ` +
    `${Math.min(...setResults.map((set) => set.bpm))} to ${Math.max(...setResults.map((set) => set.bpm))} BPM ` +
    `for durations between ${Math.min(...setResults.map((set) => set.completedDuration))} and ` +
    `${Math.max(...setResults.map((set) => set.completedDuration))} seconds. ` +
    `Target motion ranged from ${setResults[0].targetMotionLabel.toLowerCase()} to ${finalSet.targetMotionLabel.toLowerCase()}. ` +
    `Post-activity dizziness averaged ${averageDizziness}/10, and the patient performed the final set ` +
    `in ${finalSet.position.toLowerCase()} on a ${finalSet.surface.toLowerCase()} surface.`;
}

function startTargetMotion() {
  cancelAnimationFrame(targetMotionFrame);

  if (!focusTarget || currentSetConfig.targetMotion === "stationary") {
    resetTargetMotionPosition();
    return;
  }

  const animate = () => {
    updateTargetMotionPosition();
    targetMotionFrame = requestAnimationFrame(animate);
  };

  targetMotionFrame = requestAnimationFrame(animate);
}

function updateTargetMotionPosition() {
  if (!focusTarget || !currentSetConfig) {
    return;
  }

  if (currentSetConfig.targetMotion === "stationary") {
    resetTargetMotionPosition();
    return;
  }

  const elapsedMs = exerciseStartedAt ? Date.now() - exerciseStartedAt : 0;
  const phase = (elapsedMs / 1000) * ((currentSetConfig.bpm / 60) * Math.PI * 2);
  const amplitude = currentSetConfig.targetAmplitude;
  const offset = Math.sin(phase) * amplitude;
  const x = currentSetConfig.targetMotion === "horizontal" ? offset : 0;
  const y = currentSetConfig.targetMotion === "vertical" ? offset : 0;
  focusTarget.style.transform = `translate(${x}px, ${y}px)`;
}

function resetTargetMotionPosition() {
  if (focusTarget) {
    focusTarget.style.transform = "translate(0, 0)";
  }
}

function formatTargetMotion(value) {
  const labels = {
    stationary: "stationary target",
    horizontal: "side-to-side target",
    vertical: "up-and-down target",
  };
  return labels[value] || value;
}

initialize();
