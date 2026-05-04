const LETTER_BANK = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
const COLOR_BANK = [
  { name: "Red", hex: "#ef476f" },
  { name: "Orange", hex: "#f9844a" },
  { name: "Yellow", hex: "#ffca3a" },
  { name: "Green", hex: "#5ad66f" },
  { name: "Blue", hex: "#39b8ff" },
  { name: "Purple", hex: "#8f6cff" },
];
const WORD_BANK = [
  "Focus", "Steady", "Center", "Bright", "Vision", "Target", "Calm", "Anchor",
  "Quick", "Clear", "Shift", "Motion", "Follow", "Signal", "Balance", "Track",
];

const screens = {
  setup: document.getElementById("setup-screen"),
  countdown: document.getElementById("countdown-screen"),
  exercise: document.getElementById("exercise-screen"),
  rating: document.getElementById("rating-screen"),
  clinician: document.getElementById("clinician-screen"),
  patient: document.getElementById("patient-screen"),
};

const heroBanner = document.getElementById("hero-banner");

const controls = {
  duration: document.getElementById("duration"),
  bpm: document.getElementById("bpm"),
  difficulty: document.getElementById("difficulty"),
  backgroundMode: document.getElementById("background-mode"),
  position: document.getElementById("position"),
  surface: document.getElementById("surface"),
  sets: document.getElementById("sets"),
  clinicianEmail: document.getElementById("clinician-email"),
  theme: document.getElementById("theme"),
};

const display = {
  durationValue: document.getElementById("duration-value"),
  bpmValue: document.getElementById("bpm-value"),
  setupPreview: document.getElementById("setup-preview"),
  countdownLabel: document.getElementById("countdown-label"),
  countdownNumber: document.getElementById("countdown-number"),
  countdownSummary: document.getElementById("countdown-summary"),
  liveSet: document.getElementById("live-set"),
  timeLeft: document.getElementById("time-left"),
  liveBpm: document.getElementById("live-bpm"),
  instructionLine: document.getElementById("instruction-line"),
  metaLine: document.getElementById("meta-line"),
  documentationOutput: document.getElementById("documentation-output"),
};

const buttons = {
  backToTop: document.getElementById("back-to-top"),
  finishEarly: document.getElementById("finish-early-button"),
  startSession: document.getElementById("start-session"),
  fullscreen: document.getElementById("fullscreen-button"),
  endSession: document.getElementById("end-session"),
  saveSetRating: document.getElementById("save-set-rating"),
  finishAfterRating: document.getElementById("finish-after-rating"),
  copyDocumentation: document.getElementById("copy-documentation"),
  continueToPatient: document.getElementById("continue-to-patient"),
  restartFromClinician: document.getElementById("restart-from-clinician"),
  emailClinician: document.getElementById("email-clinician"),
  skipEmail: document.getElementById("skip-email"),
  restartFromPatient: document.getElementById("restart-from-patient"),
};

const exerciseStage = document.getElementById("exercise-stage");
const sideTarget = document.getElementById("side-target");
const sideTargetContent = document.getElementById("side-target-content");
const setRatingGrid = document.getElementById("set-rating-grid");
const clinicianRatingGrid = document.getElementById("clinician-rating-grid");
const patientRatingGrid = document.getElementById("patient-rating-grid");
const themeButtons = [...document.querySelectorAll(".theme-icon")];

let sessionConfig = null;
let completedSets = [];
let pendingSetResult = null;
let currentSetIndex = 0;
let setRating = null;
let clinicianRating = null;
let patientRating = null;
let countdownInterval = null;
let sessionInterval = null;
let beatInterval = null;
let beatHideTimeout = null;
let exerciseStartedAt = 0;
let currentSide = "right";
let alphabeticalCursor = 0;
let deviceThemeQuery = null;
let currentThemeMode = "device";

function initialize() {
  setupThemeListener();
  buildRatingGrid(setRatingGrid, "set");
  buildRatingGrid(clinicianRatingGrid, "clinician");
  buildRatingGrid(patientRatingGrid, "patient");
  bindEvents();
  applyTheme();
  updatePreview();
}

function bindEvents() {
  Object.values(controls).forEach((element) => {
    element.addEventListener("input", updatePreview);
    element.addEventListener("change", updatePreview);
  });

  themeButtons.forEach((button) => {
    button.addEventListener("click", () => {
      controls.theme.value = button.dataset.theme;
      applyTheme(button.dataset.theme);
    });
  });

  controls.theme.addEventListener("change", () => applyTheme(controls.theme.value));

  buttons.backToTop.addEventListener("click", () => {
    window.location.href = "../index.html";
  });
  buttons.finishEarly.addEventListener("click", finishSession);
  buttons.startSession.addEventListener("click", startSession);
  buttons.fullscreen.addEventListener("click", requestFullScreen);
  buttons.endSession.addEventListener("click", completeCurrentSet);
  buttons.saveSetRating.addEventListener("click", saveSetRating);
  buttons.finishAfterRating.addEventListener("click", finishAfterRating);
  buttons.copyDocumentation.addEventListener("click", copyDocumentation);
  buttons.continueToPatient.addEventListener("click", () => showScreen("patient"));
  buttons.restartFromClinician.addEventListener("click", resetSession);
  buttons.emailClinician.addEventListener("click", openPatientEmail);
  buttons.skipEmail.addEventListener("click", resetSession);
  buttons.restartFromPatient.addEventListener("click", resetSession);
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

function applyTheme(mode = controls.theme.value || currentThemeMode) {
  currentThemeMode = mode;
  controls.theme.value = mode;
  const resolvedTheme = mode === "device"
    ? (deviceThemeQuery?.matches ? "light" : "dark")
    : mode;

  document.body.dataset.theme = resolvedTheme;
  themeButtons.forEach((button) => {
    button.classList.toggle("is-active", button.dataset.theme === currentThemeMode);
  });
}

function buildRatingGrid(container, mode) {
  for (let value = 1; value <= 10; value += 1) {
    const button = document.createElement("button");
    button.type = "button";
    button.textContent = String(value);
    button.setAttribute("role", "radio");
    button.setAttribute("aria-checked", "false");
    button.addEventListener("click", () => selectRating(mode, value));
    container.appendChild(button);
  }
}

function getConfig() {
  return {
    duration: Number(controls.duration.value),
    bpm: Number(controls.bpm.value),
    difficulty: controls.difficulty.value,
    backgroundMode: controls.backgroundMode.value,
    position: controls.position.value,
    surface: controls.surface.value,
    sets: Number(controls.sets.value),
    clinicianEmail: controls.clinicianEmail.value.trim(),
  };
}

function updatePreview() {
  applyTheme(controls.theme.value || currentThemeMode);
  const config = getConfig();
  display.durationValue.textContent = `${config.duration} seconds`;
  display.bpmValue.textContent = `${config.bpm} BPM`;
  buttons.finishEarly.disabled = completedSets.length === 0;
  display.setupPreview.textContent =
    `${formatDifficulty(config.difficulty)} at ${config.bpm} BPM for ${config.duration} seconds, ${config.sets} set${config.sets > 1 ? "s" : ""}, ${formatBackground(config.backgroundMode).toLowerCase()} background, ${config.position.toLowerCase()} on ${config.surface.toLowerCase()} surface.`;
}

function startSession() {
  sessionConfig = getConfig();

  if (completedSets.length === 0) {
    currentSetIndex = 0;
    clinicianRating = null;
    patientRating = null;
    setRating = null;
    pendingSetResult = null;
    alphabeticalCursor = 0;
    currentSide = "right";
    updateRatingUI("set");
    updateRatingUI("clinician");
    updateRatingUI("patient");
  } else {
    currentSetIndex = completedSets.length;
  }

  startCountdown();
}

function startCountdown() {
  clearTimers();
  const config = sessionConfig;
  let count = 3;

  display.countdownLabel.textContent = config.position === "Standing"
    ? "Stand tall, lock onto center, and get ready to shift quickly"
    : "Sit tall, lock onto center, and get ready to shift quickly";
  display.countdownSummary.textContent =
    `Set ${currentSetIndex + 1} of ${config.sets}: ${formatDifficulty(config.difficulty)}, ${config.bpm} BPM, ${config.duration} seconds.`;
  display.countdownNumber.textContent = String(count);

  document.body.classList.add("session-mode");
  showScreen("countdown");

  countdownInterval = window.setInterval(() => {
    count -= 1;

    if (count > 0) {
      display.countdownNumber.textContent = String(count);
      return;
    }

    clearInterval(countdownInterval);
    beginExercise();
  }, 1000);
}

function beginExercise() {
  const config = sessionConfig;
  exerciseStartedAt = Date.now();
  currentSide = "right";
  display.liveSet.textContent = `${currentSetIndex + 1} / ${config.sets}`;
  display.liveBpm.textContent = `${config.bpm} BPM`;
  display.timeLeft.textContent = formatClock(config.duration);
  display.instructionLine.textContent = getInstructionLine(config.difficulty);
  display.metaLine.textContent = `${formatDifficulty(config.difficulty)} | ${config.position} | ${config.surface} surface | ${formatBackground(config.backgroundMode)} background`;
  sideTarget.classList.add("hidden");
  applyBackgroundMode(config.backgroundMode);
  showScreen("exercise");

  sessionInterval = window.setInterval(() => {
    const elapsedMs = Date.now() - exerciseStartedAt;
    const secondsLeft = Math.max(0, Math.ceil((config.duration * 1000 - elapsedMs) / 1000));
    display.timeLeft.textContent = formatClock(secondsLeft);

    if (elapsedMs >= config.duration * 1000) {
      completeCurrentSet();
    }
  }, 200);

  const beatMs = Math.max(220, (60 / config.bpm) * 1000);
  triggerBeat();
  beatInterval = window.setInterval(triggerBeat, beatMs);
}

function triggerBeat() {
  if (!sessionConfig) {
    return;
  }

  const beatMs = Math.max(220, (60 / sessionConfig.bpm) * 1000);
  currentSide = currentSide === "left" ? "right" : "left";

  const content = getNextTargetPayload(sessionConfig.difficulty);
  renderSideTarget(content, currentSide, sessionConfig.difficulty);

  clearTimeout(beatHideTimeout);
  beatHideTimeout = window.setTimeout(() => {
    sideTarget.classList.add("hidden");
  }, Math.min(beatMs * 0.48, 420));
}

function getNextTargetPayload(difficulty) {
  if (difficulty === "simple-round") {
    return { text: "", color: "#ffffff", label: "round target" };
  }

  if (difficulty === "alphabetical-letters") {
    const letter = LETTER_BANK[alphabeticalCursor % LETTER_BANK.length];
    alphabeticalCursor += 1;
    return { text: letter, color: "#ffffff", label: `letter ${letter}` };
  }

  if (difficulty === "randomized-letters") {
    const letter = LETTER_BANK[Math.floor(Math.random() * LETTER_BANK.length)];
    return { text: letter, color: "#ffffff", label: `letter ${letter}` };
  }

  if (difficulty === "random-color") {
    const color = COLOR_BANK[Math.floor(Math.random() * COLOR_BANK.length)];
    return { text: "", color: color.hex, label: color.name };
  }

  const word = WORD_BANK[Math.floor(Math.random() * WORD_BANK.length)];
  return { text: word, color: "#ffffff", label: `word ${word}` };
}

function renderSideTarget(payload, side, difficulty) {
  sideTarget.className = `side-target is-${side} ${difficulty}`;
  sideTarget.classList.remove("hidden");
  sideTargetContent.textContent = payload.text;
  sideTarget.setAttribute("aria-label", payload.label);

  if (difficulty === "random-color") {
    sideTarget.style.background = payload.color;
    sideTarget.style.borderColor = payload.color;
    sideTargetContent.textContent = "";
  } else if (difficulty === "simple-round") {
    sideTarget.style.background = "#ffffff";
    sideTarget.style.borderColor = "#39b8ff";
  } else {
    sideTarget.style.background = "#ffffff";
    sideTarget.style.borderColor = "#39b8ff";
  }
}

function completeCurrentSet() {
  if (!sessionConfig) {
    return;
  }

  clearTimers();
  pendingSetResult = {
    setNumber: currentSetIndex + 1,
    duration: sessionConfig.duration,
    bpm: sessionConfig.bpm,
    difficulty: sessionConfig.difficulty,
    backgroundMode: sessionConfig.backgroundMode,
    position: sessionConfig.position,
    surface: sessionConfig.surface,
  };

  sideTarget.classList.add("hidden");
  setRating = null;
  updateRatingUI("set");
  buttons.saveSetRating.disabled = true;
  showScreen("rating");
}

function saveSetRating() {
  if (!pendingSetResult || setRating === null) {
    return;
  }

  completedSets.push({
    ...pendingSetResult,
    dizziness: setRating,
  });

  currentSetIndex = completedSets.length;
  pendingSetResult = null;
  setRating = null;
  buttons.saveSetRating.disabled = true;
  updateRatingUI("set");
  updatePreview();

  if (completedSets.length >= Number(controls.sets.value)) {
    finishSession();
    return;
  }

  showScreen("setup");
}

function finishAfterRating() {
  if (!pendingSetResult || setRating === null) {
    return;
  }

  completedSets.push({
    ...pendingSetResult,
    dizziness: setRating,
  });

  currentSetIndex = completedSets.length;
  pendingSetResult = null;
  setRating = null;
  buttons.saveSetRating.disabled = true;
  updateRatingUI("set");
  updatePreview();
  finishSession();
}

function finishSession() {
  clearTimers();
  applyBackgroundMode("none");
  sideTarget.classList.add("hidden");
  document.body.classList.remove("session-mode");
  display.documentationOutput.value = buildDocumentationParagraph();
  showScreen("clinician");
}

function selectRating(mode, value) {
  if (mode === "set") {
    setRating = value;
    buttons.saveSetRating.disabled = false;
  } else if (mode === "clinician") {
    clinicianRating = value;
    display.documentationOutput.value = buildDocumentationParagraph();
  } else {
    patientRating = value;
  }

  updateRatingUI(mode);
}

function updateRatingUI(mode) {
  const container = mode === "set"
    ? setRatingGrid
    : mode === "clinician"
      ? clinicianRatingGrid
      : patientRatingGrid;
  const selectedValue = mode === "set"
    ? setRating
    : mode === "clinician"
      ? clinicianRating
      : patientRating;

  [...container.children].forEach((button) => {
    const value = Number(button.textContent);
    const selected = value === selectedValue;
    button.classList.toggle("selected", selected);
    button.setAttribute("aria-checked", String(selected));
  });
}

function buildDocumentationParagraph() {
  if (!completedSets.length) {
    return "No saccade sets were completed.";
  }

  const setSummary = completedSets
    .map((set) =>
      `Set ${set.setNumber}: ${set.duration}s at ${set.bpm} BPM using ${formatDifficulty(set.difficulty).toLowerCase()}, ${formatBackground(set.backgroundMode).toLowerCase()} background, ${set.position.toLowerCase()} on ${set.surface.toLowerCase()} surface, dizziness ${set.dizziness}/10`
    )
    .join("; ");

  const finalLine = clinicianRating === null
    ? "Final clinician dizziness rating pending."
    : `Final clinician dizziness rating ${clinicianRating}/10.`;

  return `Patient completed ${completedSets.length} saccade set${completedSets.length > 1 ? "s" : ""} with alternating lateral visual targets while maintaining central fixation. ${setSummary}. ${finalLine} Session emphasized rapid gaze shifts, visual accuracy, symptom monitoring, and graded balance challenge.`;
}

async function copyDocumentation() {
  const text = display.documentationOutput.value;
  if (!text) {
    return;
  }

  try {
    await navigator.clipboard.writeText(text);
    buttons.copyDocumentation.textContent = "Copied";
  } catch (error) {
    buttons.copyDocumentation.textContent = "Copy Failed";
  }

  window.setTimeout(() => {
    buttons.copyDocumentation.textContent = "Copy Paragraph";
  }, 1400);
}

function openPatientEmail() {
  if (!sessionConfig) {
    return;
  }

  const email = sessionConfig.clinicianEmail;
  const subject = encodeURIComponent("Saccades session update");
  const body = encodeURIComponent(
    `Saccades activity completed.\nPatient dizziness rating: ${patientRating === null ? "not provided" : `${patientRating}/10`}\nCompleted sets: ${completedSets.length}\nPer-set ratings: ${completedSets.map((set) => `${set.dizziness}/10`).join(", ") || "none"}`
  );

  if (email) {
    window.location.href = `mailto:${email}?subject=${subject}&body=${body}`;
    return;
  }

  window.location.href = `mailto:?subject=${subject}&body=${body}`;
}

async function requestFullScreen() {
  if (!document.fullscreenElement && exerciseStage.requestFullscreen) {
    await exerciseStage.requestFullscreen();
    return;
  }

  if (document.exitFullscreen) {
    await document.exitFullscreen();
  }
}

function applyBackgroundMode(mode) {
  exerciseStage.classList.remove("bg-horizontal", "bg-vertical", "bg-combination");

  if (mode === "horizontal") {
    exerciseStage.classList.add("bg-horizontal");
  } else if (mode === "vertical") {
    exerciseStage.classList.add("bg-vertical");
  } else if (mode === "combination") {
    exerciseStage.classList.add("bg-combination");
  }
}

function getInstructionLine(difficulty) {
  const prompts = {
    "simple-round": "Focus on the pulsing center target. Shift eyes quickly to each round side target.",
    "alphabetical-letters": "Keep the head still. Shift eyes center to side and identify the letters in order.",
    "randomized-letters": "Shift eyes quickly and call out each random letter.",
    "random-color": "Shift eyes quickly and name the color you see.",
    "randomized-words": "Shift eyes quickly and read each word aloud if able.",
  };
  return prompts[difficulty] || prompts["simple-round"];
}

function formatDifficulty(value) {
  const labels = {
    "simple-round": "Simple round target",
    "alphabetical-letters": "Alphabetical letters",
    "randomized-letters": "Randomized letters",
    "random-color": "Random color",
    "randomized-words": "Randomized words",
  };
  return labels[value] || value;
}

function formatBackground(value) {
  const labels = {
    none: "No shifting",
    horizontal: "Horizontal shifting",
    vertical: "Vertical shifting",
    combination: "Combination shifting",
  };
  return labels[value] || value;
}

function formatClock(totalSeconds) {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

function clearTimers() {
  clearInterval(countdownInterval);
  clearInterval(sessionInterval);
  clearInterval(beatInterval);
  clearTimeout(beatHideTimeout);
}

function showScreen(name) {
  Object.entries(screens).forEach(([key, screen]) => {
    screen.classList.toggle("active", key === name);
  });

  heroBanner.classList.toggle("hidden", name === "countdown" || name === "exercise");
}

function resetSession() {
  clearTimers();
  sessionConfig = null;
  completedSets = [];
  pendingSetResult = null;
  currentSetIndex = 0;
  setRating = null;
  clinicianRating = null;
  patientRating = null;
  alphabeticalCursor = 0;
  currentSide = "right";
  sideTarget.className = "side-target hidden";
  sideTarget.removeAttribute("style");
  document.body.classList.remove("session-mode");
  applyBackgroundMode("none");
  buttons.saveSetRating.disabled = true;
  updateRatingUI("set");
  updateRatingUI("clinician");
  updateRatingUI("patient");
  updatePreview();
  showScreen("setup");
}

initialize();
