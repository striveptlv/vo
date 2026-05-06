const TARGET_COLORS = [
  { fill: "#2ba6df", light: "#a5ebff", dark: "#0e6d98" },
  { fill: "#f4694d", light: "#ffd2bc", dark: "#b63a23" },
  { fill: "#ffd15f", light: "#fff0b9", dark: "#b98610" },
  { fill: "#72d66a", light: "#d9ffb8", dark: "#2f8c2f" },
  { fill: "#bc7dff", light: "#ecd8ff", dark: "#7042a8" },
  { fill: "#ff7daa", light: "#ffd7e4", dark: "#b63967" },
];

const MEMORIZE_SECONDS = 3;

const screens = {
  setup: document.getElementById("setup-screen"),
  countdown: document.getElementById("countdown-screen"),
  exercise: document.getElementById("exercise-screen"),
  selection: document.getElementById("selection-screen"),
  rating: document.getElementById("rating-screen"),
  clinician: document.getElementById("clinician-screen"),
  patient: document.getElementById("patient-screen"),
};

const controls = {
  ballCount: document.getElementById("ball-count"),
  speed: document.getElementById("speed"),
  duration: document.getElementById("duration"),
  backgroundMode: document.getElementById("background-mode"),
  stageBackground: document.getElementById("stage-background"),
  colorMode: document.getElementById("color-mode"),
  highlightMode: document.getElementById("highlight-mode"),
  sets: document.getElementById("sets"),
  clinicianEmail: document.getElementById("clinician-email"),
  theme: document.getElementById("theme"),
};

const display = {
  setNumber: document.getElementById("set-number"),
  setTotal: document.getElementById("set-total"),
  ballCountValue: document.getElementById("ball-count-value"),
  speedValue: document.getElementById("speed-value"),
  durationValue: document.getElementById("duration-value"),
  setupPreview: document.getElementById("setup-preview"),
  countdownLabel: document.getElementById("countdown-label"),
  countdownNumber: document.getElementById("countdown-number"),
  countdownSummary: document.getElementById("countdown-summary"),
  liveSet: document.getElementById("live-set"),
  timeLeft: document.getElementById("time-left"),
  phaseLabel: document.getElementById("phase-label"),
  selectionMessage: document.getElementById("selection-message"),
  documentationOutput: document.getElementById("documentation-output"),
};

const buttons = {
  backToTop: document.getElementById("back-to-top"),
  finishEarly: document.getElementById("finish-early-button"),
  startSession: document.getElementById("start-session"),
  fullscreen: document.getElementById("fullscreen-button"),
  selectionFullscreen: document.getElementById("selection-fullscreen-button"),
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

const moverLayer = document.getElementById("mover-layer");
const selectionLayer = document.getElementById("selection-layer");
const exerciseStage = document.getElementById("exercise-stage");
const selectionStage = document.getElementById("selection-stage");
const fullscreenRoot = document.querySelector(".app-shell");
const setRatingGrid = document.getElementById("set-rating-grid");
const clinicianRatingGrid = document.getElementById("clinician-rating-grid");
const patientRatingGrid = document.getElementById("patient-rating-grid");
const themeButtons = [...document.querySelectorAll(".theme-icon")];

let sessionConfig = null;
let completedSets = [];
let currentSetIndex = 0;
let pendingSetResult = null;
let setRating = null;
let clinicianRating = null;
let patientRating = null;
let countdownInterval = null;
let sessionInterval = null;
let animationFrame = null;
let sessionStartTime = 0;
let currentMovers = [];
let currentTargetId = null;
let memorizeMode = true;
let selectionChoiceId = null;
let deviceThemeQuery = null;
let currentThemeMode = "device";

function initialize() {
  setupThemeListener();
  buildRatingGrid(setRatingGrid, "set");
  buildRatingGrid(clinicianRatingGrid, "clinician");
  buildRatingGrid(patientRatingGrid, "patient");
  bindEvents();
  applyTheme();
  syncFullscreenButtons();
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
    window.location.href = "../launch.html";
  });
  buttons.finishEarly.addEventListener("click", finishSession);
  buttons.startSession.addEventListener("click", startSession);
  buttons.fullscreen.addEventListener("click", requestFullScreen);
  buttons.selectionFullscreen.addEventListener("click", requestSelectionFullScreen);
  buttons.endSession.addEventListener("click", endTrackingPhase);
  buttons.saveSetRating.addEventListener("click", saveSetRating);
  buttons.finishAfterRating.addEventListener("click", finishAfterRating);
  buttons.copyDocumentation.addEventListener("click", copyDocumentation);
  buttons.continueToPatient.addEventListener("click", () => showScreen("patient"));
  buttons.restartFromClinician.addEventListener("click", resetSession);
  buttons.emailClinician.addEventListener("click", openPatientEmail);
  buttons.skipEmail.addEventListener("click", resetSession);
  buttons.restartFromPatient.addEventListener("click", resetSession);
  document.addEventListener("fullscreenchange", syncFullscreenButtons);
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
  for (let value = 0; value <= 10; value += 1) {
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
    ballCount: Number(controls.ballCount.value),
    speed: Number(controls.speed.value),
    duration: Number(controls.duration.value),
    backgroundMode: controls.backgroundMode.value,
    stageBackground: controls.stageBackground.value,
    colorMode: controls.colorMode.value,
    targetType: "ball",
    highlightMode: controls.highlightMode.value,
    sets: Number(controls.sets.value),
    clinicianEmail: controls.clinicianEmail.value.trim(),
  };
}

function updatePreview() {
  applyTheme(controls.theme.value || currentThemeMode);
  const config = getConfig();
  display.setNumber.textContent = String(Math.min(completedSets.length + 1, config.sets));
  display.setTotal.textContent = String(config.sets);
  display.ballCountValue.textContent = `${config.ballCount} balls`;
  display.speedValue.textContent = `${config.speed} / 24`;
  display.durationValue.textContent = `${config.duration} seconds`;
  buttons.finishEarly.disabled = completedSets.length === 0;
  display.setupPreview.textContent =
    `${config.ballCount} balls, speed ${config.speed}/24, ${config.duration} seconds of tracking after a ${MEMORIZE_SECONDS} second target-identify phase, ${formatBackground(config.backgroundMode).toLowerCase()} distraction, ${formatStageBackground(config.stageBackground).toLowerCase()} stage, ${formatColorMode(config.colorMode).toLowerCase()}, target highlight ${config.highlightMode === "on" ? "on" : "off"}, ${config.sets} set${config.sets > 1 ? "s" : ""}.`;
}

function startSession() {
  sessionConfig = getConfig();

  if (completedSets.length === 0) {
    currentSetIndex = 0;
    pendingSetResult = null;
    setRating = null;
    clinicianRating = null;
    patientRating = null;
    selectionChoiceId = null;
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
  let count = 3;

  display.countdownLabel.textContent = "Focus on the highlighted target first";
  display.countdownSummary.textContent =
    `Set ${currentSetIndex + 1} of ${sessionConfig.sets}: identify the highlighted ball for ${MEMORIZE_SECONDS} seconds, then track it for ${sessionConfig.duration} seconds.`;
  display.countdownNumber.textContent = String(count);
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
  currentMovers = createMovers(sessionConfig);
  currentTargetId = currentMovers[Math.floor(Math.random() * currentMovers.length)].id;
  currentMovers.forEach((mover) => {
    mover.isTarget = mover.id === currentTargetId;
  });

  sessionStartTime = performance.now();
  memorizeMode = true;
  selectionChoiceId = null;
  display.liveSet.textContent = `${currentSetIndex + 1} / ${sessionConfig.sets}`;
  display.phaseLabel.textContent = "Memorize";
  display.timeLeft.textContent = formatClock(sessionConfig.duration + MEMORIZE_SECONDS);
  applyBackgroundMode(exerciseStage, sessionConfig.backgroundMode);
  applyStageBackground(exerciseStage, sessionConfig.stageBackground);
  applyHighlightMode(exerciseStage, "on");
  renderMovers(moverLayer, currentMovers, false);
  showScreen("exercise");

  sessionInterval = window.setInterval(() => {
    const elapsedSeconds = (performance.now() - sessionStartTime) / 1000;
    const totalRemaining = Math.max(0, Math.ceil(sessionConfig.duration + MEMORIZE_SECONDS - elapsedSeconds));
    display.timeLeft.textContent = formatClock(totalRemaining);

    if (memorizeMode && elapsedSeconds >= MEMORIZE_SECONDS) {
      memorizeMode = false;
      display.phaseLabel.textContent = "Track";
      applyHighlightMode(exerciseStage, "off");
      currentMovers.forEach((mover) => {
        mover.element?.classList.add("hide-target");
      });
    }

    if (elapsedSeconds >= sessionConfig.duration + MEMORIZE_SECONDS) {
      endTrackingPhase();
    }
  }, 100);

  animationFrame = window.requestAnimationFrame(animateMovers);
}

function animateMovers(now) {
  if (!currentMovers.length) {
    return;
  }

  const dt = Math.min(32, now - (animateMovers.lastTime || now)) / 16.6667;
  animateMovers.lastTime = now;

  currentMovers.forEach((mover) => {
    mover.x += mover.vx * dt;
    mover.y += mover.vy * dt;
    mover.rotation += mover.rotationSpeed * dt;

    if (mover.x <= mover.margin || mover.x >= 100 - mover.margin) {
      mover.vx *= -1;
      mover.x = clamp(mover.x, mover.margin, 100 - mover.margin);
    }

    if (mover.y <= mover.margin || mover.y >= 100 - mover.margin) {
      mover.vy *= -1;
      mover.y = clamp(mover.y, mover.margin, 100 - mover.margin);
    }

    if (mover.element) {
      mover.element.style.left = `${mover.x}%`;
      mover.element.style.top = `${mover.y}%`;
      mover.element.style.transform = `translate(-50%, -50%) rotate(${mover.rotation}deg)`;
    }
  });

  animationFrame = window.requestAnimationFrame(animateMovers);
}

function createMovers(config) {
  const movers = [];
  const colors = buildColorSequence(config.ballCount, config.colorMode);

  for (let index = 0; index < config.ballCount; index += 1) {
    const size = getSizeForTarget(config.targetType);
    const margin = getMovementMargin(config.targetType);
    const angle = Math.random() * Math.PI * 2;
    const speed = 0.09 + config.speed * 0.018;

    movers.push({
      id: `mover-${index}`,
      size,
      margin,
      x: randomBetween(margin, 100 - margin),
      y: randomBetween(margin + 3, 97 - margin),
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      rotation: Math.random() * 360,
      rotationSpeed: (Math.random() * 2 - 1) * (config.targetType === "leaf" ? 2.4 : 1.1),
      color: colors[index],
      type: config.targetType,
      isTarget: false,
      element: null,
    });
  }

  return movers;
}

function renderMovers(container, movers, selectable) {
  container.innerHTML = "";

  movers.forEach((mover) => {
    const node = document.createElement("button");
    node.type = "button";
    node.className = `mover mover-${mover.type}`;
    node.dataset.moverId = mover.id;
    node.style.setProperty("--size", `${mover.size}px`);
    node.style.setProperty("--fill", mover.color.fill);
    node.style.setProperty("--fill-light", mover.color.light);
    node.style.setProperty("--fill-dark", mover.color.dark);
    node.style.left = `${mover.x}%`;
    node.style.top = `${mover.y}%`;
    node.style.transform = `translate(-50%, -50%) rotate(${mover.rotation}deg)`;
    node.setAttribute("aria-label", selectable ? "Select tracked target" : `${formatTargetType(mover.type)} moving on screen`);
    node.disabled = !selectable;

    if (mover.isTarget && !selectable) {
      node.classList.add("is-target");
    }

    if (selectable) {
      node.classList.add("selectable");
      node.addEventListener("click", () => chooseSelection(mover.id));
    }

    const inner = document.createElement("span");
    inner.className = "mover-inner";
    node.appendChild(inner);

    if (mover.type === "bird") {
      const birdCore = document.createElement("span");
      birdCore.className = "bird-core";
      inner.appendChild(birdCore);
    }

    container.appendChild(node);
    mover.element = node;
  });
}

function endTrackingPhase() {
  if (!sessionConfig || !currentMovers.length) {
    return;
  }

  clearTimers();
  pendingSetResult = {
    setNumber: currentSetIndex + 1,
    ballCount: sessionConfig.ballCount,
    speed: sessionConfig.speed,
    duration: sessionConfig.duration,
    backgroundMode: sessionConfig.backgroundMode,
    stageBackground: sessionConfig.stageBackground,
    colorMode: sessionConfig.colorMode,
    targetType: sessionConfig.targetType,
    highlightMode: sessionConfig.highlightMode,
  };

  display.selectionMessage.textContent = "Choose the mover you tracked.";
  applyBackgroundMode(selectionStage, sessionConfig.backgroundMode);
  applyStageBackground(selectionStage, sessionConfig.stageBackground);
  applyHighlightMode(selectionStage, sessionConfig.highlightMode);
  renderMovers(selectionLayer, currentMovers, true);
  selectionChoiceId = null;
  showScreen("selection");
}

function chooseSelection(moverId) {
  selectionChoiceId = moverId;
  [...selectionLayer.children].forEach((node) => {
    node.classList.toggle("selected", node === findSelectionNode(moverId));
  });
  confirmSelection();
}

function confirmSelection() {
  if (!pendingSetResult || !selectionChoiceId) {
    return;
  }

  const isCorrect = selectionChoiceId === currentTargetId;
  pendingSetResult.correct = isCorrect;
  pendingSetResult.selectedId = selectionChoiceId;
  pendingSetResult.targetId = currentTargetId;
  pendingSetResult.accuracyLabel = isCorrect ? "correct" : "incorrect";

  [...selectionLayer.children].forEach((node) => {
    const nodeId = node.dataset.moverId;
    node.classList.remove("selected");
    if (nodeId === currentTargetId) {
      node.classList.add("correct");
    } else if (nodeId === selectionChoiceId && selectionChoiceId !== currentTargetId) {
      node.classList.add("wrong");
    }
  });

  display.selectionMessage.textContent = isCorrect
    ? "Correct target found."
    : "The original target is highlighted in green.";

  window.setTimeout(() => {
    setRating = null;
    updateRatingUI("set");
    buttons.saveSetRating.disabled = true;
    showScreen("rating");
  }, 850);
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
    const selected = index === selectedValue;
    button.classList.toggle("selected", selected);
    button.setAttribute("aria-checked", selected ? "true" : "false");
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
  moverLayer.innerHTML = "";
  selectionLayer.innerHTML = "";
  currentMovers = [];
  display.documentationOutput.value = buildDocumentationParagraph();
  showScreen("clinician");
}

function buildDocumentationParagraph() {
  if (!completedSets.length) {
    return "No visual tracking sets were completed.";
  }

  const correctCount = completedSets.filter((set) => set.correct).length;
  const setDetails = completedSets.map((set) =>
    `Set ${set.setNumber}: ${set.ballCount} ${formatTargetType(set.targetType).toLowerCase()}, speed ${set.speed}/24, ${set.duration}s tracking, ${formatBackground(set.backgroundMode).toLowerCase()} distraction, ${formatStageBackground(set.stageBackground).toLowerCase()} stage, ${formatColorMode(set.colorMode).toLowerCase()}, highlight ${set.highlightMode === "on" ? "on" : "off"}, target identification ${set.accuracyLabel}, dizziness ${set.dizziness}/10`
  ).join("; ");
  const dizzinessRange = `${Math.min(...completedSets.map((set) => set.dizziness))}/10 to ${Math.max(...completedSets.map((set) => set.dizziness))}/10`;
  const finalLine = clinicianRating === null
    ? `Post-set dizziness ranged from ${dizzinessRange}.`
    : `Post-set dizziness ranged from ${dizzinessRange}, with final clinician-rated dizziness ${clinicianRating}/10.`;

  return `Patient completed ${completedSets.length} visual tracking set${completedSets.length > 1 ? "s" : ""}. Tracking accuracy was ${correctCount}/${completedSets.length} correct target identification${completedSets.length > 1 ? "s" : ""}. ${setDetails}. ${finalLine} Session emphasized visual fixation, target retention, graded motion tolerance, and symptom monitoring.`;
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
  if (!completedSets.length) {
    return;
  }

  const email = sessionConfig?.clinicianEmail;
  const subject = encodeURIComponent("Visual tracking session update");
  const dizzinessText = patientRating === null ? "not provided" : `${patientRating}/10`;
  const accuracyText = `${completedSets.filter((set) => set.correct).length}/${completedSets.length}`;
  const body = encodeURIComponent(
    `Session completed.\nDizziness rating: ${dizzinessText}\nTracking accuracy: ${accuracyText}\nPer-set ratings: ${completedSets.map((set) => `${set.dizziness}/10`).join(", ")}`
  );

  if (email) {
    window.location.href = `mailto:${email}?subject=${subject}&body=${body}`;
    return;
  }

  window.location.href = `mailto:?subject=${subject}&body=${body}`;
}

async function requestFullScreen() {
  await toggleFullScreen();
}

async function requestSelectionFullScreen() {
  await toggleFullScreen();
}

async function toggleFullScreen() {
  if (!document.fullscreenElement && fullscreenRoot?.requestFullscreen) {
    await fullscreenRoot.requestFullscreen();
    return;
  }

  if (document.exitFullscreen) {
    await document.exitFullscreen();
  }
}

function syncFullscreenButtons() {
  const label = document.fullscreenElement ? "Exit Full Screen" : "Full Screen";
  buttons.fullscreen.textContent = label;
  buttons.selectionFullscreen.textContent = label;
}

function resetSession() {
  clearTimers();
  sessionConfig = null;
  completedSets = [];
  currentSetIndex = 0;
  pendingSetResult = null;
  setRating = null;
  clinicianRating = null;
  patientRating = null;
  currentMovers = [];
  currentTargetId = null;
  selectionChoiceId = null;
  moverLayer.innerHTML = "";
  selectionLayer.innerHTML = "";
  animateMovers.lastTime = 0;
  buttons.saveSetRating.disabled = true;
  updateRatingUI("set");
  updateRatingUI("clinician");
  updateRatingUI("patient");
  updatePreview();
  showScreen("setup");
}

function clearTimers() {
  clearInterval(countdownInterval);
  clearInterval(sessionInterval);
  cancelAnimationFrame(animationFrame);
  animateMovers.lastTime = 0;
}

function showScreen(name) {
  Object.entries(screens).forEach(([key, screen]) => {
    screen.classList.toggle("active", key === name);
  });
}

function applyBackgroundMode(stage, mode) {
  stage.classList.remove("bg-pulse", "bg-grid", "bg-storm");

  if (mode === "pulse") {
    stage.classList.add("bg-pulse");
  } else if (mode === "grid") {
    stage.classList.add("bg-grid");
  } else if (mode === "storm") {
    stage.classList.add("bg-storm");
  }
}

function applyStageBackground(stage, mode) {
  stage.classList.remove("stage-black", "stage-white");
  stage.classList.add(mode === "white" ? "stage-white" : "stage-black");
}

function applyHighlightMode(stage, mode) {
  stage.classList.toggle("highlight-off", mode === "off");
}

function buildColorSequence(count, mode) {
  if (mode === "same") {
    return Array.from({ length: count }, () => TARGET_COLORS[0]);
  }

  if (mode === "dual") {
    return Array.from({ length: count }, (_, index) => TARGET_COLORS[index % 2]);
  }

  return Array.from({ length: count }, (_, index) => TARGET_COLORS[index % TARGET_COLORS.length]);
}

function getSizeForTarget(targetType) {
  if (targetType === "bird") {
    return 52;
  }
  if (targetType === "leaf") {
    return 48;
  }
  if (targetType === "puck") {
    return 46;
  }
  return 42;
}

function getMovementMargin(targetType) {
  if (targetType === "puck") {
    return 8;
  }
  if (targetType === "bird") {
    return 7;
  }
  if (targetType === "leaf") {
    return 6.5;
  }
  return 6;
}

function formatTargetType(type) {
  const labels = {
    ball: "Ball",
    bird: "Birds flapping",
    leaf: "Leaves",
    puck: "Hockey puck",
  };
  return labels[type] || type;
}

function formatBackground(mode) {
  const labels = {
    none: "Minimal",
    pulse: "Low distraction",
    grid: "Medium distraction",
    storm: "High distraction",
  };
  return labels[mode] || mode;
}

function formatColorMode(mode) {
  const labels = {
    same: "Same color",
    dual: "2 colors",
    mixed: "Different colors",
  };
  return labels[mode] || mode;
}

function formatStageBackground(mode) {
  const labels = {
    black: "Black",
    white: "White",
  };
  return labels[mode] || mode;
}

function formatClock(totalSeconds) {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

function findSelectionNode(moverId) {
  return [...selectionLayer.children].find((node) => node.dataset.moverId === moverId) || null;
}

function randomBetween(min, max) {
  return Math.random() * (max - min) + min;
}

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

initialize();
