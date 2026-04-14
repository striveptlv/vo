const WORD_BANK = [
  "focus", "steady", "follow", "target", "motion", "center", "vision", "smooth",
  "calm", "glide", "track", "orange", "teal", "silver", "anchor", "bright",
  "circle", "spring", "quiet", "align", "marker", "shadow", "signal", "ripple",
  "planet", "thrive", "gentle", "bridge", "meadow", "stream"
];

const LETTER_BANK = "ABCDEFGHJKLMNPQRSTUVWXYZ";
const TARGET_COLORS = ["#0c7a64", "#f2644c", "#3f88c5", "#ffb703", "#7b61ff", "#ef476f"];

const screens = {
  setup: document.getElementById("setup-screen"),
  countdown: document.getElementById("countdown-screen"),
  exercise: document.getElementById("exercise-screen"),
  rating: document.getElementById("rating-screen"),
  clinician: document.getElementById("clinician-screen"),
  patient: document.getElementById("patient-screen"),
};

const roleModal = document.getElementById("role-modal");

const controls = {
  duration: document.getElementById("duration"),
  speed: document.getElementById("speed"),
  difficulty: document.getElementById("difficulty"),
  targetType: document.getElementById("target-type"),
  backgroundMode: document.getElementById("background-mode"),
  position: document.getElementById("position"),
  surface: document.getElementById("surface"),
  sets: document.getElementById("sets"),
  clinicianEmail: document.getElementById("clinician-email"),
};

const display = {
  durationValue: document.getElementById("duration-value"),
  speedValue: document.getElementById("speed-value"),
  setupPreview: document.getElementById("setup-preview"),
  countdownLabel: document.getElementById("countdown-label"),
  countdownNumber: document.getElementById("countdown-number"),
  countdownSummary: document.getElementById("countdown-summary"),
  liveSet: document.getElementById("live-set"),
  timeLeft: document.getElementById("time-left"),
  livePattern: document.getElementById("live-pattern"),
  documentationOutput: document.getElementById("documentation-output"),
};

const buttons = {
  chooseClinician: document.getElementById("choose-clinician"),
  choosePatient: document.getElementById("choose-patient"),
  backToTop: document.getElementById("back-to-top"),
  finishEarly: document.getElementById("finish-early-button"),
  startSession: document.getElementById("start-session"),
  saveSetRating: document.getElementById("save-set-rating"),
  finishAfterRating: document.getElementById("finish-after-rating"),
  fullscreen: document.getElementById("fullscreen-button"),
  endSession: document.getElementById("end-session"),
  copyDocumentation: document.getElementById("copy-documentation"),
  restartFromClinician: document.getElementById("restart-from-clinician"),
  restartFromPatient: document.getElementById("restart-from-patient"),
  emailClinician: document.getElementById("email-clinician"),
  skipEmail: document.getElementById("skip-email"),
};

const exerciseStage = document.getElementById("exercise-stage");
const target = document.getElementById("target");
const targetContent = document.getElementById("target-content");
const trailLine = document.getElementById("trail-line");
const setRatingGrid = document.getElementById("set-rating-grid");
const clinicianRatingGrid = document.getElementById("clinician-rating-grid");
const patientRatingGrid = document.getElementById("patient-rating-grid");

let role = null;
let sessionConfig = null;
let completedSets = [];
let currentSetIndex = 0;
let countdownInterval = null;
let sessionInterval = null;
let animationFrame = null;
let exerciseStartTime = 0;
let currentDurationMs = 0;
let latestPoint = { x: 50, y: 50 };
let trailPoints = [];
let currentWordSchedule = [];
let clinicianRating = null;
let patientRating = null;
let setRating = null;
let pendingSetResult = null;
let activeLetter = LETTER_BANK[0];
let activeLetterBucket = -1;

function initialize() {
  buildRatingGrid(setRatingGrid, "set");
  buildRatingGrid(clinicianRatingGrid, "clinician");
  buildRatingGrid(patientRatingGrid, "patient");
  bindEvents();
  updatePreview();
}

function bindEvents() {
  Object.values(controls).forEach((element) => {
    element.addEventListener("input", updatePreview);
    element.addEventListener("change", updatePreview);
  });

  buttons.chooseClinician.addEventListener("click", () => setRole("Clinician"));
  buttons.choosePatient.addEventListener("click", () => setRole("Patient"));
  buttons.backToTop.addEventListener("click", goBackToTop);
  buttons.finishEarly.addEventListener("click", finishSession);
  buttons.startSession.addEventListener("click", startSession);
  buttons.saveSetRating.addEventListener("click", saveSetRating);
  buttons.finishAfterRating.addEventListener("click", finishAfterRating);
  buttons.endSession.addEventListener("click", completeCurrentSet);
  buttons.fullscreen.addEventListener("click", requestFullScreen);
  buttons.copyDocumentation.addEventListener("click", copyDocumentation);
  buttons.restartFromClinician.addEventListener("click", resetSession);
  buttons.restartFromPatient.addEventListener("click", resetSession);
  buttons.emailClinician.addEventListener("click", openPatientEmail);
  buttons.skipEmail.addEventListener("click", resetSession);
}

function buildRatingGrid(container, mode) {
  for (let value = 0; value <= 10; value += 1) {
    const button = document.createElement("button");
    button.type = "button";
    button.textContent = String(value);
    button.addEventListener("click", () => selectRating(mode, value));
    container.appendChild(button);
  }
}

function openRoleModal() {
  roleModal.classList.add("active");
}

function setRole(selectedRole) {
  role = selectedRole;
  roleModal.classList.remove("active");
  updatePreview();
}

function goBackToTop() {
  window.location.href = "#";
}

function getConfig() {
  return {
    duration: Number(controls.duration.value),
    speed: Number(controls.speed.value),
    difficulty: controls.difficulty.value,
    targetType: controls.targetType.value,
    backgroundMode: controls.backgroundMode.value,
    position: controls.position.value,
    surface: controls.surface.value,
    sets: Number(controls.sets.value),
    clinicianEmail: controls.clinicianEmail.value.trim(),
  };
}

function updatePreview() {
  const config = getConfig();
  display.durationValue.textContent = `${config.duration} seconds`;
  display.speedValue.textContent = `${config.speed} / 30`;
  buttons.finishEarly.disabled = completedSets.length === 0;
  display.setupPreview.textContent =
    `${formatDifficulty(config.difficulty)}, ${formatPattern(getPatternForDifficulty(config.difficulty))}, ${formatTargetType(config.targetType)}, ${formatBackground(config.backgroundMode)}, ${config.duration} seconds per set, speed ${config.speed}/30, ${config.sets} set${config.sets > 1 ? "s" : ""}, ${config.position.toLowerCase()} on ${config.surface.toLowerCase()} surface.`;
}

function startSession() {
  if (!role) {
    openRoleModal();
    return;
  }

  sessionConfig = getConfig();

  if (completedSets.length === 0) {
    currentSetIndex = 0;
    clinicianRating = null;
    patientRating = null;
    setRating = null;
    pendingSetResult = null;
    activeLetter = LETTER_BANK[Math.floor(Math.random() * LETTER_BANK.length)];
    activeLetterBucket = -1;
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
  const config = sessionConfig || getConfig();
  const needsStandPrompt = config.position === "Standing";
  let count = 3;

  display.countdownLabel.textContent = needsStandPrompt
    ? "Stand tall, steady your balance, and focus on the target"
    : "Sit comfortably, steady your posture, and focus on the target";
  display.countdownSummary.textContent =
    `Set ${currentSetIndex + 1} of ${config.sets}: ${formatDifficulty(config.difficulty)}, ${formatTargetType(config.targetType)}, ${config.duration} seconds.`;
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
  currentDurationMs = config.duration * 1000;
  exerciseStartTime = performance.now();
  trailPoints = [];
  currentWordSchedule = createWordSchedule(config.duration);
  activeLetter = LETTER_BANK[Math.floor(Math.random() * LETTER_BANK.length)];
  activeLetterBucket = -1;
  display.liveSet.textContent = `${currentSetIndex + 1} / ${config.sets}`;
  display.livePattern.textContent = formatPattern(getPatternForDifficulty(config.difficulty));
  display.timeLeft.textContent = formatClock(config.duration);

  applyBackgroundMode(config.backgroundMode);
  applyTargetStyle(config.targetType);
  updateTargetAppearance(0);
  showScreen("exercise");

  sessionInterval = window.setInterval(() => {
    const elapsed = performance.now() - exerciseStartTime;
    const secondsLeft = Math.max(0, Math.ceil((currentDurationMs - elapsed) / 1000));
    display.timeLeft.textContent = formatClock(secondsLeft);

    if (elapsed >= currentDurationMs) {
      completeCurrentSet();
    }
  }, 200);

  animationFrame = window.requestAnimationFrame(animateTarget);
}

function animateTarget(now) {
  const config = sessionConfig;
  const elapsed = now - exerciseStartTime;
  const progress = Math.min(elapsed / currentDurationMs, 1);
  const coords = calculatePoint(progress, config);

  latestPoint = coords;
  trailPoints.push(coords);
  if (trailPoints.length > 80) {
    trailPoints.shift();
  }

  positionTarget(coords);
  updateTrail(config.targetType);
  updateTargetAppearance(elapsed / 1000);

  if (progress >= 1) {
    completeCurrentSet();
    return;
  }

  animationFrame = window.requestAnimationFrame(animateTarget);
}

function calculatePoint(progress, config) {
  const pattern = getPatternForDifficulty(config.difficulty);
  const difficultyMultiplier = getDifficultyMultiplier(config.difficulty);
  const speedMultiplier = 0.45 + config.speed * 0.055;
  const t = progress * Math.PI * 2 * speedMultiplier;
  const margin = 12 - difficultyMultiplier;
  const width = 100 - margin * 2;
  const height = 100 - margin * 2;
  const centerX = 50;
  const centerY = 50;
  let x = centerX;
  let y = centerY;

  if (pattern === "horizontal") {
    x = margin + width * ((Math.sin(t) + 1) / 2);
  } else if (pattern === "vertical") {
    y = margin + height * ((Math.sin(t) + 1) / 2);
  } else if (pattern === "xy") {
    x = margin + width * ((Math.sin(t) + 1) / 2);
    y = margin + height * ((Math.sin(t * 0.75 + 0.8) + 1) / 2);
  } else if (pattern === "bounce") {
    x = margin + width * triangleWave(progress * speedMultiplier * 1.4);
    y = margin + height * triangleWave(progress * speedMultiplier * 1.05 + 0.2);
  } else {
    x = centerX + Math.cos(t) * (width / 2) * 0.72 + Math.cos(t * 2.1) * 6 * difficultyMultiplier;
    y = centerY + Math.sin(t * 1.2) * (height / 2) * 0.68 + Math.sin(t * 0.5 + 1.1) * 10;
  }

  return {
    x: clamp(x, margin / 2, 100 - margin / 2),
    y: clamp(y, margin / 2, 100 - margin / 2),
  };
}

function positionTarget(coords) {
  target.style.left = `${coords.x}%`;
  target.style.top = `${coords.y}%`;
}

function updateTrail(targetType) {
  if (targetType !== "trail-dot") {
    trailLine.setAttribute("points", "");
    return;
  }

  const points = trailPoints.map((point) => `${point.x},${point.y}`).join(" ");
  trailLine.setAttribute("points", points);
}

function updateTargetAppearance(elapsedSeconds) {
  const config = sessionConfig;
  const targetType = config.targetType;

  if (targetType === "color" || targetType === "word-color") {
    const colorIndex = Math.floor(elapsedSeconds / 1.2) % TARGET_COLORS.length;
    target.style.background = TARGET_COLORS[colorIndex];
    target.style.borderColor = TARGET_COLORS[colorIndex];
  } else {
    target.style.background = "";
    target.style.borderColor = "";
  }

  if (targetType === "letter") {
    targetContent.textContent = getScheduledLetter(elapsedSeconds);
  } else if (targetType === "word" || targetType === "word-color") {
    targetContent.textContent = getScheduledWord(elapsedSeconds);
  } else {
    targetContent.textContent = "";
  }
}

function applyTargetStyle(targetType) {
  target.className = "target";

  if (targetType === "trail-dot") {
    target.classList.add("trail-dot");
  } else if (targetType === "classic-dot") {
    target.classList.add("classic-dot");
  } else if (targetType === "ring") {
    target.classList.add("ring");
  } else if (targetType === "color") {
    target.classList.add("color");
  } else if (targetType === "letter") {
    target.classList.add("letter");
  } else if (targetType === "word") {
    target.classList.add("word");
  } else if (targetType === "word-color") {
    target.classList.add("word-color");
  }

  if (targetType !== "trail-dot") {
    trailLine.setAttribute("points", "");
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
    speed: sessionConfig.speed,
    difficulty: sessionConfig.difficulty,
    targetType: sessionConfig.targetType,
    backgroundMode: sessionConfig.backgroundMode,
    position: sessionConfig.position,
    surface: sessionConfig.surface,
  };

  setRating = null;
  updateRatingUI("set");
  buttons.saveSetRating.disabled = true;
  showScreen("rating");
}

function finishSession() {
  clearTimers();
  trailLine.setAttribute("points", "");
  applyBackgroundMode("none");
  document.body.classList.remove("session-mode");

  if (role === "Clinician") {
    display.documentationOutput.value = buildDocumentationParagraph();
    showScreen("clinician");
    return;
  }

  showScreen("patient");
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

  [...container.children].forEach((button, index) => {
    button.classList.toggle("selected", index === selectedValue);
  });
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
  updateRatingUI("set");
  buttons.saveSetRating.disabled = true;
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
  updateRatingUI("set");
  buttons.saveSetRating.disabled = true;
  updatePreview();
  finishSession();
}

function buildDocumentationParagraph() {
  if (!completedSets.length || !sessionConfig) {
    return "No smooth pursuit sets were completed.";
  }

  const ratingText = clinicianRating === null
    ? `Post-session dizziness ratings after each set were ${completedSets.map((set) => `${set.dizziness}/10`).join(", ")}.`
    : `Post-session dizziness ratings after each set were ${completedSets.map((set) => `${set.dizziness}/10`).join(", ")}. Final clinician rating ${clinicianRating}/10.`;
  const setText = `${completedSets.length} set${completedSets.length > 1 ? "s" : ""} of smooth pursuit eye tracking`;
  const setDetails = completedSets.map((set) =>
    `Set ${set.setNumber}: ${set.duration}s, speed ${set.speed}/30, ${formatPattern(getPatternForDifficulty(set.difficulty)).toLowerCase()}, ${formatTargetType(set.targetType).toLowerCase()}, ${set.position.toLowerCase()} on ${set.surface.toLowerCase()} surface, dizziness ${set.dizziness}/10`
  ).join("; ");
  const summary =
    `Patient completed ${setText}. ${setDetails}. ` +
    `${ratingText} Session focused on visual tracking tolerance, smooth pursuit accuracy, and graded symptom monitoring.`;

  return summary;
}

async function copyDocumentation() {
  const text = display.documentationOutput.value;
  if (!text) {
    return;
  }

  try {
    await navigator.clipboard.writeText(text);
    buttons.copyDocumentation.textContent = "Copied";
    window.setTimeout(() => {
      buttons.copyDocumentation.textContent = "Copy Paragraph";
    }, 1400);
  } catch (error) {
    buttons.copyDocumentation.textContent = "Copy Failed";
    window.setTimeout(() => {
      buttons.copyDocumentation.textContent = "Copy Paragraph";
    }, 1400);
  }
}

function openPatientEmail() {
  if (!sessionConfig) {
    return;
  }

  const email = sessionConfig?.clinicianEmail;
  const subject = encodeURIComponent("Smooth pursuit session update");
  const dizzinessText = patientRating === null ? "not provided" : `${patientRating}/10`;
  const body = encodeURIComponent(
    `Session completed.\nDizziness rating: ${dizzinessText}\nSets: ${completedSets.length}\nPer-set ratings: ${completedSets.map((set) => `${set.dizziness}/10`).join(", ")}`
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

function resetSession() {
  clearTimers();
  roleModal.classList.remove("active");
  sessionConfig = null;
  completedSets = [];
  currentSetIndex = 0;
  clinicianRating = null;
  patientRating = null;
  setRating = null;
  pendingSetResult = null;
  activeLetter = LETTER_BANK[0];
  activeLetterBucket = -1;
  trailLine.setAttribute("points", "");
  targetContent.textContent = "";
  document.body.classList.remove("session-mode");
  applyBackgroundMode("none");
  buttons.saveSetRating.disabled = true;
  updateRatingUI("clinician");
  updateRatingUI("patient");
  updateRatingUI("set");
  updatePreview();
  showScreen("setup");
}

function clearTimers() {
  clearInterval(countdownInterval);
  clearInterval(sessionInterval);
  cancelAnimationFrame(animationFrame);
}

function showScreen(name) {
  Object.entries(screens).forEach(([key, screen]) => {
    screen.classList.toggle("active", key === name);
  });
}

function createWordSchedule(durationSeconds) {
  const words = shuffle([...WORD_BANK]).slice(0, 20);
  const schedule = [];
  let cursor = 0;
  let wordIndex = 0;

  while (cursor <= durationSeconds + 1 && wordIndex < words.length) {
    schedule.push({
      start: cursor,
      end: cursor + randomBetween(3, 5),
      text: words[wordIndex],
    });
    cursor = schedule[schedule.length - 1].end;
    wordIndex += 1;
  }

  return schedule;
}

function getScheduledWord(elapsedSeconds) {
  const active = currentWordSchedule.find((item) => elapsedSeconds >= item.start && elapsedSeconds < item.end);
  return active ? active.text : currentWordSchedule[currentWordSchedule.length - 1]?.text || "focus";
}

function getScheduledLetter(elapsedSeconds) {
  const bucket = Math.floor(elapsedSeconds / 0.9);
  if (bucket !== activeLetterBucket) {
    activeLetterBucket = bucket;
    activeLetter = LETTER_BANK[Math.floor(Math.random() * LETTER_BANK.length)];
  }
  return activeLetter;
}

function getDifficultyMultiplier(level) {
  if (level === "level-1") {
    return 2;
  }
  if (level === "level-2") {
    return 4;
  }
  if (level === "level-4") {
    return 6;
  }
  return 8;
}

function getPatternForDifficulty(level) {
  const labels = {
    "level-1": "horizontal",
    "level-2": "vertical",
    "level-4": "bounce",
    "level-5": "curved",
  };
  return labels[level] || "vertical";
}

function formatDifficulty(level) {
  const labels = {
    "level-1": "Level 1 - Horizontal only",
    "level-2": "Level 2 - Vertical only",
    "level-4": "Level 4 - Bouncing diagonal",
    "level-5": "Level 5 - Diagonal + curved",
  };
  return labels[level] || level;
}

function formatPattern(pattern) {
  const labels = {
    horizontal: "Horizontal only",
    vertical: "Vertical only",
    xy: "X + Y axis",
    bounce: "Bouncing diagonal",
    curved: "Diagonal curved path",
  };
  return labels[pattern] || pattern;
}

function formatBackground(backgroundMode) {
  const labels = {
    none: "non distracting background",
    subtle: "slightly changing background color",
    optokinetic: "optokinetic background",
  };
  return labels[backgroundMode] || backgroundMode;
}

function applyBackgroundMode(mode) {
  exerciseStage.classList.remove("bg-subtle", "bg-optokinetic");

  if (mode === "subtle") {
    exerciseStage.classList.add("bg-subtle");
  } else if (mode === "optokinetic") {
    exerciseStage.classList.add("bg-optokinetic");
  }
}

function formatTargetType(targetType) {
  const labels = {
    "trail-dot": "moving dot with trail",
    "classic-dot": "classic dot target",
    ring: "ring target",
    color: "color changing target",
    letter: "changing letter target",
    word: "changing word target",
    "word-color": "changing word and color target",
  };
  return labels[targetType] || targetType;
}

function formatClock(totalSeconds) {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

function triangleWave(value) {
  const normalized = value - Math.floor(value);
  return normalized < 0.5 ? normalized * 2 : 2 - normalized * 2;
}

function shuffle(items) {
  for (let index = items.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [items[index], items[swapIndex]] = [items[swapIndex], items[index]];
  }
  return items;
}

function randomBetween(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

initialize();
