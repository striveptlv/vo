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
  plane: document.getElementById("plane"),
  position: document.getElementById("position"),
  surface: document.getElementById("surface"),
  beepEnabled: document.getElementById("beep-enabled"),
};

const display = {
  bpmValue: document.getElementById("bpm-value"),
  durationValue: document.getElementById("duration-value"),
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
  start: document.getElementById("start-button"),
  finishEarly: document.getElementById("generate-early-button"),
  endSet: document.getElementById("end-set-button"),
  saveRating: document.getElementById("save-rating-button"),
  restart: document.getElementById("restart-button"),
};

const ratingGrid = document.getElementById("rating-grid");

const MAX_SETS = 3;
let setResults = [];
let currentSetConfig = null;
let selectedRating = null;
let countdownTimer = null;
let sessionTimer = null;
let beatTimer = null;
let exerciseStartedAt = null;
let audioContext = null;

function initialize() {
  buildRatingButtons();
  bindEvents();
  updateSetupPreview();
  refreshSessionState();
}

function bindEvents() {
  Object.values(controls).forEach((control) => {
    control.addEventListener("input", updateSetupPreview);
    control.addEventListener("change", updateSetupPreview);
  });

  actions.start.addEventListener("click", startCountdown);
  actions.endSet.addEventListener("click", () => finishExercise(true));
  actions.saveRating.addEventListener("click", saveRating);
  actions.finishEarly.addEventListener("click", generateDocumentation);
  actions.restart.addEventListener("click", resetSession);
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

function updateSetupPreview() {
  const config = getCurrentConfig();
  display.bpmValue.textContent = config.bpm;
  display.durationValue.textContent = config.duration;
  display.setupPreview.textContent =
    `${config.plane} head turns for ${config.duration} seconds at ${config.bpm} BPM, ` +
    `${config.position.toLowerCase()} on ${config.surface.toLowerCase()} surface` +
    `${config.beepEnabled ? ", with audible beep." : ", without audible beep."}`;
}

function getCurrentConfig() {
  return {
    bpm: Number(controls.bpm.value),
    duration: Number(controls.duration.value),
    plane: controls.plane.value,
    position: controls.position.value,
    surface: controls.surface.value,
    beepEnabled: controls.beepEnabled.checked,
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
    name === "countdown" || name === "exercise" || name === "rating"
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
  playBeep(880, 0.08, currentSetConfig.beepEnabled);

  countdownTimer = setInterval(() => {
    count -= 1;

    if (count > 0) {
      display.countdownNumber.textContent = String(count);
      playBeep(880, 0.08, currentSetConfig.beepEnabled);
      return;
    }

    clearInterval(countdownTimer);
    playBeep(1040, 0.12, currentSetConfig.beepEnabled);
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
    `${currentSetConfig.plane} | ${currentSetConfig.position} | ${currentSetConfig.surface} surface`;
  updateRemainingTime(currentSetConfig.duration);
  showScreen("exercise");

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
    playBeep(740, 0.06, currentSetConfig.beepEnabled);
  }, beatInterval);

  if (currentSetConfig.beepEnabled) {
    playBeep(740, 0.06, true);
  }
}

function finishExercise(endedEarly) {
  clearInterval(sessionTimer);
  clearInterval(beatTimer);

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
      const beepText = set.beepEnabled ? "with audible metronome" : "without audible metronome";
      return `Set ${index + 1}: gaze stability exercise completed in ${set.position.toLowerCase()} on ${set.surface.toLowerCase()} surface, ${set.plane.toLowerCase()} head movement, ${set.bpm} BPM, ${durationText}, ${beepText}`;
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
  gainNode.gain.exponentialRampToValueAtTime(0.12, audioContext.currentTime + 0.01);
  gainNode.gain.exponentialRampToValueAtTime(0.0001, audioContext.currentTime + duration);

  oscillator.connect(gainNode);
  gainNode.connect(audioContext.destination);

  oscillator.start();
  oscillator.stop(audioContext.currentTime + duration);
}

function clearAllTimers() {
  clearInterval(countdownTimer);
  clearInterval(sessionTimer);
  clearInterval(beatTimer);
}

function resetSession() {
  clearAllTimers();
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
    `Post-activity dizziness averaged ${averageDizziness}/10, and the patient performed the final set ` +
    `in ${finalSet.position.toLowerCase()} on a ${finalSet.surface.toLowerCase()} surface.`;
}

initialize();
