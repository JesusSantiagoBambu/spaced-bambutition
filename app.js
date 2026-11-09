const curveDays = [1, 3, 7, 14, 30, 60, 120];
const dailyLimitOptions = [1, 2, 3, 4, 5];
const defaultDailyLimit = 3;
const schemaVersion = 2;
// Motor de repasos inspirado en SM-2 (Anki): cada intervalo se multiplica segun la nota,
// un fallo reinicia el aprendizaje y el ultimo intervalo se repite indefinidamente.
const srsConfig = {
  firstIntervalDays: 1,
  startingEase: 2.2,
  minEase: 1.3,
  maxEase: 3,
  hardMultiplier: 1.2,
  easyBonus: 1.15,
  lapseMemoryFactor: 0.2,
  modes: {
    normal: { label: "Normal", maxInterval: 120, intervalModifier: 1 },
    hardcore: { label: "Hardcore", maxInterval: 35, intervalModifier: 0.65 },
  },
};
const ivyTaskLimit = 6;
const ivyPointsPerPomodoro = 5;
const pomodoroDurations = [25, 30, 35, 50];
const ivyDifficulties = {
  green: { label: "Fácil", emoji: "🟢", className: "green", multiplier: 1, weight: 1 },
  yellow: { label: "Media", emoji: "🟡", className: "yellow", multiplier: 1.2, weight: 2 },
  red: { label: "Difícil", emoji: "🔴", className: "red", multiplier: 1.5, weight: 3 },
};
const storageKey = "spaced-bambutition-state-v1";
const backupVersion = 2;
const topicPanelStateKey = "spaced-bambutition-topic-panel-collapsed";
const legacyStorageKeys = ["repaso10-state-v7"];
const skipMasteryDelta = -6;
const scoreProfiles = [
  { min: 9, key: "easy", label: "Excelente", easeDelta: 0.1, masteryDelta: 12 },
  { min: 7, key: "good", label: "Bien fijado", easeDelta: 0, masteryDelta: 7 },
  { min: 5, key: "hard", label: "Fragil", easeDelta: -0.15, masteryDelta: 1 },
  { min: 0, key: "again", label: "Refuerzo", easeDelta: -0.2, masteryDelta: -8 },
];

const state = loadState();
let activeReviewId = null;
let lastNotificationKey = "";
let deferredInstallPrompt = null;

const els = {
  pointsStat: document.querySelector("#pointsStat"),
  streakStat: document.querySelector("#streakStat"),
  levelStat: document.querySelector("#levelStat"),
  todayStat: document.querySelector("#todayStat"),
  loadStat: document.querySelector("#loadStat"),
  dueCount: document.querySelector("#dueCount"),
  dueList: document.querySelector("#dueList"),
  ivyCount: document.querySelector("#ivyCount"),
  ivyStats: document.querySelector("#ivyStats"),
  ivyForm: document.querySelector("#ivyForm"),
  ivyTaskInput: document.querySelector("#ivyTaskInput"),
  ivyPomodoroInput: document.querySelector("#ivyPomodoroInput"),
  ivyDurationInput: document.querySelector("#ivyDurationInput"),
  ivyDifficultyInput: document.querySelector("#ivyDifficultyInput"),
  ivyList: document.querySelector("#ivyList"),
  calendarList: document.querySelector("#calendarList"),
  progressList: document.querySelector("#progressList"),
  averageScore: document.querySelector("#averageScore"),
  rewardPoints: document.querySelector("#rewardPoints"),
  rewardList: document.querySelector("#rewardList"),
  curveChips: document.querySelector("#curveChips"),
  topicPanel: document.querySelector("#topicPanel"),
  topicPanelBody: document.querySelector("#topicPanelBody"),
  topicPanelToggle: document.querySelector("#topicPanelToggle"),
  topicForm: document.querySelector("#topicForm"),
  subjectOptions: document.querySelector("#subjectOptions"),
  rewardForm: document.querySelector("#rewardForm"),
  reviewDialog: document.querySelector("#reviewDialog"),
  reviewForm: document.querySelector("#reviewForm"),
  reviewSubject: document.querySelector("#reviewSubject"),
  reviewTitle: document.querySelector("#reviewTitle"),
  scoreInput: document.querySelector("#scoreInput"),
  scoreOutput: document.querySelector("#scoreOutput"),
  noteInput: document.querySelector("#noteInput"),
  closeReview: document.querySelector("#closeReview"),
  notifyBtn: document.querySelector("#notifyBtn"),
  exportBtn: document.querySelector("#exportBtn"),
  importBtn: document.querySelector("#importBtn"),
  importFileInput: document.querySelector("#importFileInput"),
  installWrap: document.querySelector("#installWrap"),
  installBtn: document.querySelector("#installBtn"),
  installHelp: document.querySelector("#installHelp"),
  installDeviceText: document.querySelector("#installDeviceText"),
  installNowBtn: document.querySelector("#installNowBtn"),
  dailyLimitSelect: document.querySelector("#dailyLimitSelect"),
  curveChipsHardcore: document.querySelector("#curveChipsHardcore"),
};

document.querySelector("#dateInput").valueAsDate = new Date();

renderCurveChips(els.curveChips, false);
renderCurveChips(els.curveChipsHardcore, true);

dailyLimitOptions.forEach((value) => {
  const option = document.createElement("option");
  option.value = String(value);
  option.textContent = String(value);
  els.dailyLimitSelect.append(option);
});

els.dailyLimitSelect.addEventListener("change", () => {
  state.settings.dailyLimit = normalizeDailyLimit(els.dailyLimitSelect.value);
  balanceUpcomingLoad();
  saveState();
  render();
});

els.topicForm.addEventListener("submit", (event) => {
  event.preventDefault();
  const form = new FormData(els.topicForm);
  const studiedAt = parseDate(form.get("firstDate"));
  const subject = form.get("subject").trim();
  const topic = {
    id: crypto.randomUUID(),
    subject,
    title: form.get("topic").trim(),
    createdAt: new Date().toISOString(),
    studiedAt: studiedAt.toISOString(),
    ease: 1,
    mastery: 0,
    hardcore: form.get("hardcore") === "on",
    srs: makeInitialSrs(studiedAt),
    reviews: buildInitialReviews(studiedAt),
  };

  rememberSubject(subject);
  state.topics.unshift(topic);
  balanceUpcomingLoad();
  saveState();
  els.topicForm.reset();
  document.querySelector("#dateInput").valueAsDate = new Date();
  setTopicPanelCollapsed(true);
  render();
});

els.rewardForm.addEventListener("submit", (event) => {
  event.preventDefault();
  const name = document.querySelector("#rewardName").value.trim();
  const cost = Number(document.querySelector("#rewardCost").value);
  state.rewards.unshift({ id: crypto.randomUUID(), name, cost, redeemed: false });
  saveState();
  els.rewardForm.reset();
  document.querySelector("#rewardCost").value = 100;
  render();
});

els.scoreInput.addEventListener("input", () => {
  els.scoreOutput.textContent = els.scoreInput.value;
});

els.closeReview.addEventListener("click", () => {
  els.reviewDialog.close();
});

els.reviewForm.addEventListener("submit", (event) => {
  event.preventDefault();
  completeReview(activeReviewId, Number(els.scoreInput.value), els.noteInput.value.trim());
  els.reviewDialog.close();
});

els.notifyBtn.addEventListener("click", async () => {
  if (!("Notification" in window)) {
    alert("Este navegador no admite notificaciones.");
    return;
  }
  const permission = await Notification.requestPermission();
  if (permission === "granted") {
    notifyDueReviews(true);
  }
});

els.exportBtn.addEventListener("click", exportBackup);

els.importBtn.addEventListener("click", () => {
  els.importFileInput.click();
});

els.importFileInput.addEventListener("change", importBackup);

els.installBtn.addEventListener("click", (event) => {
  event.preventDefault();
  event.stopPropagation();
  toggleInstallHelp();
});

els.installNowBtn.addEventListener("click", async (event) => {
  event.preventDefault();
  event.stopPropagation();
  if (!deferredInstallPrompt) return;
  deferredInstallPrompt.prompt();
  await deferredInstallPrompt.userChoice;
  deferredInstallPrompt = null;
  renderInstallHelp();
  closeInstallHelp();
});

els.ivyForm.addEventListener("submit", (event) => {
  event.preventDefault();
  addIvyTask();
});

els.topicPanelToggle.addEventListener("click", () => {
  toggleTopicPanel();
});

els.topicPanelToggle.addEventListener("touchend", (event) => {
  event.preventDefault();
  toggleTopicPanel();
}, { passive: false });

document.addEventListener("click", (event) => {
  const target = event.target instanceof Element ? event.target : event.target.parentElement;
  if (!target?.closest(".help-wrap")) closeHelpPopovers();
  if (!target?.closest("#installWrap")) closeInstallHelp();
});

document.addEventListener("keydown", (event) => {
  if (event.key !== "Escape") return;
  closeHelpPopovers();
  closeInstallHelp();
});

window.addEventListener("beforeinstallprompt", (event) => {
  event.preventDefault();
  deferredInstallPrompt = event;
  renderInstallHelp();
});

window.addEventListener("appinstalled", () => {
  deferredInstallPrompt = null;
  renderInstallHelp();
  closeInstallHelp();
});

document.querySelectorAll(".tab").forEach((tab) => {
  tab.addEventListener("click", () => {
    document.querySelectorAll(".tab, .view").forEach((item) => item.classList.remove("active"));
    tab.classList.add("active");
    document.querySelector(`#${tab.dataset.view}View`).classList.add("active");
  });
});

setInterval(() => notifyDueReviews(false), 60_000);
registerServiceWorker();
cleanupOldCompletedIvyTasks();
setTopicPanelCollapsed(localStorage.getItem(topicPanelStateKey) === "true");
setupHelpPopovers();
renderInstallHelp();
render();

function registerServiceWorker() {
  if (!("serviceWorker" in navigator) || location.protocol === "file:") return;
  let refreshing = false;
  navigator.serviceWorker.addEventListener("controllerchange", () => {
    if (refreshing) return;
    refreshing = true;
    window.location.reload();
  });
  navigator.serviceWorker.register("./sw.js").then((registration) => {
    registration.addEventListener("updatefound", () => {
      const worker = registration.installing;
      if (!worker) return;
      worker.addEventListener("statechange", () => {
        if (worker.state === "installed" && navigator.serviceWorker.controller) {
          worker.postMessage({ type: "SKIP_WAITING" });
        }
      });
    });
  }).catch(() => {});
}

function loadState() {
  const saved = localStorage.getItem(storageKey) || legacyStorageKeys.map((key) => localStorage.getItem(key)).find(Boolean);
  if (!saved) return normalizeState({});
  try {
    const restoredState = normalizeState(JSON.parse(saved));
    localStorage.setItem(storageKey, JSON.stringify(restoredState));
    return restoredState;
  } catch {
    return normalizeState({});
  }
}

function setTopicPanelCollapsed(isCollapsed) {
  els.topicPanel.classList.toggle("is-collapsed", isCollapsed);
  els.topicPanelBody.hidden = isCollapsed;
  els.topicPanelToggle.textContent = isCollapsed ? "Mostrar" : "Ocultar";
  els.topicPanelToggle.setAttribute("aria-expanded", String(!isCollapsed));
  localStorage.setItem(topicPanelStateKey, String(isCollapsed));
}

function toggleTopicPanel() {
  setTopicPanelCollapsed(!els.topicPanel.classList.contains("is-collapsed"));
}

function setupHelpPopovers() {
  document.querySelectorAll(".help-wrap").forEach((wrap) => {
    const button = wrap.querySelector(".help-btn");
    if (!button) return;
    button.setAttribute("aria-expanded", "false");
    button.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      const willOpen = !wrap.classList.contains("is-open");
      closeHelpPopovers();
      closeInstallHelp();
      if (willOpen) {
        wrap.classList.add("is-open");
        button.setAttribute("aria-expanded", "true");
      }
    });
  });
}

function closeHelpPopovers() {
  document.querySelectorAll(".help-wrap.is-open").forEach((wrap) => {
    wrap.classList.remove("is-open");
    wrap.querySelector(".help-btn")?.setAttribute("aria-expanded", "false");
  });
}

function toggleInstallHelp() {
  const willOpen = els.installHelp.hidden;
  closeHelpPopovers();
  if (willOpen) {
    renderInstallHelp();
    els.installHelp.hidden = false;
    els.installWrap.classList.add("is-open");
    els.installBtn.setAttribute("aria-expanded", "true");
    return;
  }
  closeInstallHelp();
}

function closeInstallHelp() {
  els.installHelp.hidden = true;
  els.installWrap.classList.remove("is-open");
  els.installBtn.setAttribute("aria-expanded", "false");
}

function renderInstallHelp() {
  const userAgent = navigator.userAgent || "";
  const isIos = /iphone|ipad|ipod/i.test(userAgent);
  const isAndroid = /android/i.test(userAgent);
  const isStandalone = window.matchMedia("(display-mode: standalone)").matches || navigator.standalone;

  if (isStandalone) {
    els.installDeviceText.textContent = "Ya la tienes abierta como app. Para actualizarla, ciérrala y vuelve a abrirla después de publicar cambios.";
  } else if (isIos) {
    els.installDeviceText.textContent = "En iPhone/iPad: abre esta página en Safari, toca Compartir y elige Añadir a pantalla de inicio.";
  } else if (isAndroid) {
    els.installDeviceText.textContent = deferredInstallPrompt
      ? "En Android/Chrome puedes instalarla ahora o usar el menú de los tres puntos y tocar Instalar app."
      : "En Android/Chrome: abre el menú de los tres puntos y toca Instalar app o Añadir a pantalla de inicio.";
  } else {
    els.installDeviceText.textContent = "En ordenador: usa el icono de instalar de la barra del navegador o el menú del navegador. En móvil, abre esta URL y añádela a pantalla de inicio.";
  }

  els.installNowBtn.hidden = !deferredInstallPrompt || Boolean(isStandalone);
}

function exportBackup() {
  const backup = {
    app: "Spaced Bambutition",
    version: backupVersion,
    exportedAt: new Date().toISOString(),
    state,
  };
  const blob = new Blob([JSON.stringify(backup, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `spaced-bambutition-backup-${dateKey(new Date())}.json`;
  link.click();
  URL.revokeObjectURL(url);
}

async function importBackup(event) {
  const [file] = event.target.files || [];
  event.target.value = "";
  if (!file) return;

  try {
    const parsed = JSON.parse(await file.text());
    const importedState = parsed?.state && typeof parsed.state === "object" ? parsed.state : parsed;
    if (!looksLikeBackupState(importedState)) {
      alert("No parece una copia de seguridad válida de Spaced Bambutition.");
      return;
    }
    const confirmed = confirm("Importar esta copia sustituirá los datos actuales de esta app en este dispositivo. ¿Continuar?");
    if (!confirmed) return;

    replaceState(normalizeState(importedState));
    saveState();
    cleanupOldCompletedIvyTasks();
    render();
    alert("Copia importada correctamente.");
  } catch {
    alert("No se ha podido leer el archivo. Comprueba que sea un JSON válido.");
  }
}

function looksLikeBackupState(value) {
  if (!value || typeof value !== "object") return false;
  return ["topics", "rewards", "history", "ivyTasks", "subjects", "points"].some((key) => key in value);
}

function replaceState(nextState) {
  Object.keys(state).forEach((key) => delete state[key]);
  Object.assign(state, nextState);
}

function normalizeState(raw) {
  const settings = normalizeSettings(raw.settings);
  const revived = [];
  const topics = Array.isArray(raw.topics) ? raw.topics.map((topic) => normalizeTopic(topic, revived)) : [];
  if (revived.length) spreadRevivedReviews(topics, revived, settings.dailyLimit);
  return {
    schemaVersion,
    points: Math.max(0, Number(raw.points) || 0),
    streak: Number(raw.streak) || 0,
    lastCompletedDate: raw.lastCompletedDate || "",
    settings,
    subjects: normalizeSubjects(raw.subjects, topics),
    topics,
    rewards: Array.isArray(raw.rewards) && raw.rewards.length ? raw.rewards : makeInitialRewards(),
    ivyTasks: Array.isArray(raw.ivyTasks) ? raw.ivyTasks.map(normalizeIvyTask) : [],
    history: Array.isArray(raw.history) ? raw.history : [],
  };
}

function normalizeSettings(settings) {
  return {
    dailyLimit: normalizeDailyLimit(settings?.dailyLimit),
  };
}

function normalizeDailyLimit(value) {
  const limit = Number(value);
  return dailyLimitOptions.includes(limit) ? limit : defaultDailyLimit;
}

function dailyLimit() {
  return state.settings?.dailyLimit || defaultDailyLimit;
}

function normalizeSubjects(subjects, topics) {
  const topicSubjects = topics.map((topic) => topic.subject);
  const savedSubjects = Array.isArray(subjects) ? subjects : [];
  return Array.from(new Set([...savedSubjects, ...topicSubjects].map((item) => String(item || "").trim()).filter(Boolean)))
    .sort((a, b) => a.localeCompare(b, "es", { sensitivity: "base" }));
}

function normalizeTopic(topic, revived = []) {
  const studiedAt = topic.studiedAt || topic.createdAt || new Date().toISOString();
  const normalized = {
    id: topic.id || crypto.randomUUID(),
    subject: topic.subject || "Sin asignatura/oposición",
    title: topic.title || "Tema sin titulo",
    createdAt: topic.createdAt || new Date().toISOString(),
    studiedAt,
    ease: clamp(Number(topic.ease) || 1, 0.55, 1.85),
    mastery: clamp(Number(topic.mastery) || 0, 0, 100),
    hardcore: Boolean(topic.hardcore),
    srs: null,
    reviews: Array.isArray(topic.reviews)
      ? topic.reviews.map((review, index) => normalizeReview(review, index, studiedAt))
      : buildInitialReviews(new Date(studiedAt)),
  };

  if (topic.srs && typeof topic.srs === "object") {
    normalized.srs = normalizeSrs(topic.srs, studiedAt);
    ensurePendingReview(normalized);
  } else {
    migrateLegacyTopic(normalized, revived);
  }
  return normalized;
}

function normalizeSrs(srs, studiedAt) {
  return {
    ease: clamp(Number(srs.ease) || srsConfig.startingEase, srsConfig.minEase, srsConfig.maxEase),
    interval: Math.max(1, Math.round(Number(srs.interval) || srsConfig.firstIntervalDays)),
    reps: Math.max(0, Number(srs.reps) || 0),
    lapses: Math.max(0, Number(srs.lapses) || 0),
    lastReviewedAt: srs.lastReviewedAt || studiedAt,
    relearning: Boolean(srs.relearning),
  };
}

function makeInitialSrs(studiedAt) {
  return {
    ease: srsConfig.startingEase,
    interval: srsConfig.firstIntervalDays,
    reps: 0,
    lapses: 0,
    lastReviewedAt: new Date(studiedAt).toISOString(),
    relearning: false,
  };
}

// Convierte un tema creado con la version anterior (7 repasos fijos) al motor nuevo.
// Regla de oro: el proximo repaso pendiente conserva su fecha exacta.
function migrateLegacyTopic(topic, revived) {
  const completed = topic.reviews
    .filter((review) => review.completedAt)
    .sort((a, b) => new Date(a.completedAt) - new Date(b.completedAt));
  const nextPending = topic.reviews
    .filter((review) => !review.completedAt)
    .sort((a, b) => a.step - b.step)[0];
  const lastCompleted = completed[completed.length - 1];
  const lastReviewedAt = lastCompleted?.completedAt || topic.studiedAt;
  const previousAnchor = completed.length > 1 ? completed[completed.length - 2].completedAt : topic.studiedAt;

  topic.srs = {
    ease: legacyEaseToSrs(topic.ease),
    interval: Math.max(1, dayDistance(lastReviewedAt, previousAnchor)),
    reps: completed.length,
    lapses: completed.filter((review) => Number(review.score) < 5).length,
    lastReviewedAt,
    relearning: false,
  };

  if (nextPending) {
    const gap = Math.max(1, dayDistance(nextPending.dueDate, lastReviewedAt));
    nextPending.intervalDays = gap;
    nextPending.baseDay = gap;
    nextPending.idealDueDate = nextPending.dueDate;
    topic.srs.interval = gap;
    topic.reviews = [...completed, nextPending];
    return;
  }

  // Tema que la version anterior daba por "completado": vuelve al ciclo.
  const mode = topicMode(topic);
  const lastScore = Number(lastCompleted?.score);
  const gap = lastScore < 5
    ? 1
    : clamp(Math.round(topic.srs.interval * topic.srs.ease * mode.intervalModifier), 1, mode.maxInterval);
  const review = makePendingReview(completed.length + 1, lastReviewedAt, gap);
  review.adjusted = true;
  review.adjustmentReason = "El último repaso se repite para no olvidar";
  topic.srs.interval = gap;
  topic.reviews = [...completed, review];
  if (new Date(review.dueDate) < addDays(startOfToday(), 1)) revived.push({ topic, review, score: lastScore });
}

function legacyEaseToSrs(legacyEase) {
  const value = Number(legacyEase) || 1;
  if (value >= 1) return clamp(srsConfig.startingEase + (value - 1) * 0.6, srsConfig.minEase, srsConfig.maxEase);
  return clamp(srsConfig.startingEase - (1 - value) * 2, srsConfig.minEase, srsConfig.maxEase);
}

// Los temas "completados" que vuelven a tocar no se acumulan todos hoy:
// se reparten desde hoy respetando la carga diaria, empezando por los de peor nota.
function spreadRevivedReviews(topics, revived, limit) {
  const today = startOfToday();
  const loads = new Map();
  topics.forEach((topic) => {
    const pending = pendingReviewOf(topic);
    if (!pending || revived.some((item) => item.review === pending)) return;
    const key = new Date(pending.dueDate) < today ? dateKey(today) : dateKey(pending.dueDate);
    loads.set(key, (loads.get(key) || 0) + 1);
  });

  revived
    .sort((a, b) => (a.score || 0) - (b.score || 0))
    .forEach(({ review }) => {
      let date = atReviewTime(today);
      while ((loads.get(dateKey(date)) || 0) >= limit) date = addDays(date, 1);
      loads.set(dateKey(date), (loads.get(dateKey(date)) || 0) + 1);
      review.dueDate = date.toISOString();
      review.idealDueDate = review.dueDate;
    });
}

function ensurePendingReview(topic) {
  const pending = topic.reviews.filter((review) => !review.completedAt);
  if (pending.length === 1) return;
  const completed = topic.reviews.filter((review) => review.completedAt);
  if (pending.length > 1) {
    const first = pending.sort((a, b) => a.step - b.step)[0];
    topic.reviews = [...completed, first];
    return;
  }
  const review = makePendingReview(completed.length + 1, topic.srs.lastReviewedAt, topic.srs.interval);
  topic.reviews = [...completed, review];
}

function normalizeReview(review, index, studiedAt) {
  const baseDay = Number(review.baseDay ?? curveDays[index] ?? (index + 1) * 7);
  const dueDate = review.dueDate || addDays(new Date(studiedAt), baseDay).toISOString();
  return {
    id: review.id || crypto.randomUUID(),
    step: Number(review.step) || index + 1,
    baseDay,
    intervalDays: Number(review.intervalDays) || baseDay,
    dueDate,
    idealDueDate: review.idealDueDate || dueDate,
    completedAt: review.completedAt || "",
    skippedAt: review.skippedAt || "",
    skipCount: Number(review.skipCount) || 0,
    score: review.score === null || review.score === undefined ? null : Number(review.score),
    note: review.note || "",
    points: Number(review.points) || 0,
    adjusted: Boolean(review.adjusted),
    adjustmentReason: review.adjustmentReason || "",
  };
}

function makeInitialRewards() {
  return [
    { id: crypto.randomUUID(), name: "🎬 Ver un capitulo", cost: 80, redeemed: false },
    { id: crypto.randomUUID(), name: "🌿 Plan especial de descanso", cost: 180, redeemed: false },
  ];
}

function normalizeIvyTask(task) {
  const difficulty = ivyDifficulties[task.difficulty] ? task.difficulty : "yellow";
  const durationMinutes = normalizePomodoroDuration(task.durationMinutes);
  return {
    id: task.id || crypto.randomUUID(),
    date: task.date || dateKey(new Date()),
    title: String(task.title || "Tarea sin titulo").trim(),
    pomodoros: clamp(Number(task.pomodoros) || 1, 1, 8),
    durationMinutes,
    difficulty,
    completedAt: task.completedAt || "",
    points: Number(task.points) || 0,
  };
}

function normalizePomodoroDuration(value) {
  const duration = Number(value) || 25;
  return pomodoroDurations.includes(duration) ? duration : 25;
}

function saveState() {
  localStorage.setItem(storageKey, JSON.stringify(state));
}

function rememberSubject(subject) {
  const value = String(subject || "").trim();
  if (!value) return;
  const exists = state.subjects.some((item) => item.toLocaleLowerCase("es") === value.toLocaleLowerCase("es"));
  if (!exists) {
    state.subjects.push(value);
    state.subjects.sort((a, b) => a.localeCompare(b, "es", { sensitivity: "base" }));
  }
}

function renderSubjectOptions() {
  els.subjectOptions.replaceChildren();
  state.subjects.forEach((subject) => {
    const option = document.createElement("option");
    option.value = subject;
    els.subjectOptions.append(option);
  });
}

function buildInitialReviews(studiedAt) {
  return [makePendingReview(1, studiedAt, srsConfig.firstIntervalDays)];
}

function makePendingReview(step, anchorDate, gap) {
  const dueDate = addDays(atReviewTime(anchorDate), gap).toISOString();
  return {
    id: crypto.randomUUID(),
    step,
    baseDay: gap,
    intervalDays: gap,
    dueDate,
    idealDueDate: dueDate,
    completedAt: "",
    skippedAt: "",
    skipCount: 0,
    score: null,
    note: "",
    points: 0,
    adjusted: false,
    adjustmentReason: "",
  };
}

function topicMode(topic) {
  return topic.hardcore ? srsConfig.modes.hardcore : srsConfig.modes.normal;
}

function pendingReviewOf(topic) {
  return topic.reviews.find((review) => !review.completedAt) || null;
}

// Calcula el siguiente intervalo (en dias) a partir de la nota del repaso.
// base: intervalo que se acaba de superar; daysLate: dias de retraso al hacerlo.
function scheduleNext(srs, mode, score, base, daysLate) {
  const profile = getScoreProfile(score);
  const next = { ...srs };
  next.ease = clamp(srs.ease + profile.easeDelta, srsConfig.minEase, srsConfig.maxEase);
  next.reps = srs.reps + 1;

  if (profile.key === "again") {
    next.lapses = srs.lapses + 1;
    next.relearning = true;
    next.interval = Math.max(1, Math.round(base * srsConfig.lapseMemoryFactor));
    return { srs: next, gap: 1, profile };
  }

  let raw;
  if (profile.key === "easy") raw = (base + daysLate) * next.ease * srsConfig.easyBonus;
  else if (profile.key === "good") raw = (base + daysLate / 2) * next.ease;
  else raw = (base + daysLate / 4) * srsConfig.hardMultiplier;

  let gap = Math.max(base + 1, Math.round(raw * mode.intervalModifier));
  gap = Math.min(gap, mode.maxInterval);
  next.relearning = false;
  next.interval = gap;
  return { srs: next, gap, profile };
}

// Trayectoria tipica (siempre la misma nota) para mostrar la secuencia en pantalla.
function projectPath(hardcore, score = 7, steps = 8) {
  const mode = hardcore ? srsConfig.modes.hardcore : srsConfig.modes.normal;
  let srs = { ...makeInitialSrs(new Date()), interval: srsConfig.firstIntervalDays };
  const gaps = [srsConfig.firstIntervalDays];
  let base = srsConfig.firstIntervalDays;
  while (gaps.length < steps) {
    const result = scheduleNext(srs, mode, score, base, 0);
    srs = result.srs;
    base = result.gap;
    gaps.push(result.gap);
  }
  return gaps;
}

function renderCurveChips(container, hardcore) {
  if (!container) return;
  container.replaceChildren();
  const maxInterval = (hardcore ? srsConfig.modes.hardcore : srsConfig.modes.normal).maxInterval;
  const path = projectPath(hardcore, 7, 14);
  const capIndex = path.indexOf(maxInterval);
  const visible = capIndex >= 0 ? path.slice(0, capIndex + 1) : path;
  visible.forEach((gap, index) => {
    const chip = document.createElement("span");
    chip.className = "chip";
    if (index === 0) chip.textContent = "24 h";
    else chip.textContent = gap === maxInterval ? `cada ${gap} d 🔁` : `+${gap} d`;
    container.append(chip);
  });
}

function parseDate(value) {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(year, month - 1, day, 9, 0, 0);
}

function addDays(date, days) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return atReviewTime(next);
}

function atReviewTime(date) {
  const next = new Date(date);
  next.setHours(9, 0, 0, 0);
  return next;
}

function startOfDay(date) {
  const next = new Date(date);
  next.setHours(0, 0, 0, 0);
  return next;
}

function startOfToday() {
  return startOfDay(new Date());
}

function dateKey(date) {
  const value = new Date(date);
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, "0");
  const day = String(value.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function dayDistance(fromDate, toDate) {
  return Math.round((startOfDay(fromDate) - startOfDay(toDate)) / 86_400_000);
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function reviewItems() {
  return state.topics.flatMap((topic) => topic.reviews.map((review) => ({ review, topic })));
}

function allReviews() {
  return reviewItems().map(({ review, topic }) => ({ ...review, review, topic }));
}

function dueReviews() {
  const tomorrow = addDays(startOfToday(), 1);
  return allReviews()
    .filter((item) => !item.completedAt && new Date(item.dueDate) < tomorrow)
    .sort((a, b) => new Date(a.dueDate) - new Date(b.dueDate));
}

function findReview(reviewId) {
  for (const topic of state.topics) {
    const review = topic.reviews.find((item) => item.id === reviewId);
    if (review) return { topic, review };
  }
  return null;
}

function completeReview(reviewId, score, note) {
  const found = findReview(reviewId);
  if (!found) return;

  const { topic, review } = found;
  const completedAt = new Date();
  const dueDate = new Date(review.dueDate);
  const daysLate = Math.max(0, dayDistance(completedAt, dueDate));
  const isOnTime = daysLate === 0;
  const latenessPenalty = Math.min(10, daysLate * 2);
  const points = Math.max(4, 10 + Math.round(score * 2) + (isOnTime ? 8 : 0) + streakBonus() - latenessPenalty);
  const scheduledGap = Math.max(1, Number(review.intervalDays) || dayDistance(review.dueDate, topic.srs.lastReviewedAt));
  const base = topic.srs.relearning ? topic.srs.interval : scheduledGap;
  const result = scheduleNext(topic.srs, topicMode(topic), score, base, daysLate);
  const profile = result.profile;

  review.completedAt = completedAt.toISOString();
  review.score = score;
  review.note = note;
  review.points = points;
  review.adjusted = true;
  review.adjustmentReason = `${profile.label}: curva adaptada`;
  state.points += points;

  topic.srs = { ...result.srs, lastReviewedAt: completedAt.toISOString() };
  topic.mastery = clamp((topic.mastery || 0) + profile.masteryDelta, 0, 100);
  const nextReview = makePendingReview(review.step + 1, completedAt, result.gap);
  nextReview.adjusted = true;
  nextReview.adjustmentReason = profile.key === "again"
    ? "Refuerzo: se vuelve a repasar mañana"
    : `${profile.label}: próximo en ${result.gap} ${result.gap === 1 ? "día" : "días"}`;
  topic.reviews.push(nextReview);

  balanceUpcomingLoad();
  updateStreak(completedAt);
  state.history.unshift({
    id: crypto.randomUUID(),
    type: "completed",
    topicId: topic.id,
    topic: topic.title,
    subject: topic.subject,
    score,
    points,
    daysLate,
    profile: profile.label,
    nextIntervalDays: result.gap,
    hardcore: Boolean(topic.hardcore),
    completedAt: completedAt.toISOString(),
  });

  activeReviewId = null;
  saveState();
  render();
}

function skipReview(reviewId) {
  const found = findReview(reviewId);
  if (!found) return;

  const { topic, review } = found;
  const skippedAt = new Date();
  const penalty = Math.min(12, 5 + review.skipCount * 2);
  const rescueDate = addDays(startOfToday(), 1);

  state.points = Math.max(0, state.points - penalty);
  review.skipCount += 1;
  review.skippedAt = skippedAt.toISOString();
  review.dueDate = rescueDate.toISOString();
  review.idealDueDate = review.dueDate;
  review.adjusted = true;
  review.adjustmentReason = `Rescate por repaso saltado: -${penalty} puntos`;
  topic.mastery = clamp((topic.mastery || 0) + skipMasteryDelta, 0, 100);

  balanceUpcomingLoad();
  state.history.unshift({
    id: crypto.randomUUID(),
    type: "skipped",
    topicId: topic.id,
    topic: topic.title,
    subject: topic.subject,
    penalty,
    skippedAt: skippedAt.toISOString(),
  });

  saveState();
  render();
}

function setHardcore(topicId, enabled) {
  const topic = state.topics.find((item) => item.id === topicId);
  if (!topic || topic.hardcore === enabled) return;
  topic.hardcore = enabled;

  const pending = pendingReviewOf(topic);
  const tomorrow = addDays(startOfToday(), 1);
  if (pending && !topic.srs.relearning && new Date(pending.dueDate) >= tomorrow) {
    const hardcore = srsConfig.modes.hardcore;
    const normal = srsConfig.modes.normal;
    const gap = Math.max(1, Number(pending.intervalDays) || 1);
    const newGap = enabled
      ? Math.max(1, Math.min(hardcore.maxInterval, Math.round(gap * hardcore.intervalModifier)))
      : Math.min(normal.maxInterval, Math.round(gap / hardcore.intervalModifier));
    let newDue = addDays(atReviewTime(topic.srs.lastReviewedAt), newGap);
    if (newDue < tomorrow) newDue = tomorrow;
    const current = new Date(pending.idealDueDate || pending.dueDate);
    const shouldMove = enabled ? newDue < current : newDue > current;
    if (shouldMove) {
      pending.intervalDays = newGap;
      pending.baseDay = newGap;
      pending.dueDate = newDue.toISOString();
      pending.idealDueDate = pending.dueDate;
      pending.adjusted = true;
      pending.adjustmentReason = enabled ? "🔥 Hardcore activado: repaso adelantado" : "Modo normal: repaso reajustado";
      topic.srs.interval = newGap;
    }
  }

  balanceUpcomingLoad();
  saveState();
  render();
}

function deleteTopic(topicId) {
  const topic = state.topics.find((item) => item.id === topicId);
  if (!topic) return;
  const confirmed = confirm(`¿Borrar "${topic.title}" y todos sus repasos de la app?`);
  if (!confirmed) return;

  state.topics = state.topics.filter((item) => item.id !== topicId);
  state.history = state.history.filter((item) => item.topicId !== topicId);
  recomputePointsFromHistory();
  recomputeStreakFromHistory();
  balanceUpcomingLoad();
  saveState();
  render();
}

function deleteReward(rewardId) {
  const reward = state.rewards.find((item) => item.id === rewardId);
  if (!reward) return;
  const confirmed = confirm(`¿Borrar la recompensa "${reward.name}"?`);
  if (!confirmed) return;

  if (reward.redeemed) recordRedemption(reward);
  state.rewards = state.rewards.filter((item) => item.id !== rewardId);
  recomputePointsFromHistory();
  saveState();
  render();
}

// Deja constancia del canje para que borrar la recompensa no devuelva los puntos.
function recordRedemption(reward) {
  if (state.history.some((item) => item.type === "redeemed" && item.rewardId === reward.id)) return;
  state.history.unshift({
    id: crypto.randomUUID(),
    type: "redeemed",
    rewardId: reward.id,
    reward: reward.name,
    cost: Number(reward.cost) || 0,
    redeemedAt: new Date().toISOString(),
  });
}

function recomputePointsFromHistory() {
  const earned = state.history.reduce((sum, item) => {
    if (item.type === "completed") return sum + (Number(item.points) || 0);
    if (item.type === "ivy") return sum + (Number(item.points) || 0);
    if (item.type === "skipped") return sum - (Number(item.penalty) || 0);
    return sum;
  }, 0);
  const redeemedInHistory = new Set(state.history.filter((item) => item.type === "redeemed").map((item) => item.rewardId));
  const spentHistory = state.history.reduce((sum, item) => sum + (item.type === "redeemed" ? Number(item.cost) || 0 : 0), 0);
  const spentLegacy = state.rewards.reduce((sum, reward) => (
    sum + (reward.redeemed && !redeemedInHistory.has(reward.id) ? Number(reward.cost) || 0 : 0)
  ), 0);
  state.points = Math.max(0, earned - spentHistory - spentLegacy);
}

function recomputeStreakFromHistory() {
  const completionDays = Array.from(new Set(
    state.history
      .filter((item) => item.type === "completed" && item.completedAt)
      .map((item) => dateKey(item.completedAt))
  )).sort();

  if (!completionDays.length) {
    state.streak = 0;
    state.lastCompletedDate = "";
    return;
  }

  let streak = 1;
  let cursor = completionDays[completionDays.length - 1];
  for (let index = completionDays.length - 2; index >= 0; index -= 1) {
    const expectedPrevious = dateKey(addDays(parseDate(cursor), -1));
    if (completionDays[index] !== expectedPrevious) break;
    streak += 1;
    cursor = completionDays[index];
  }

  state.streak = streak;
  state.lastCompletedDate = completionDays[completionDays.length - 1];
}

function getScoreProfile(score) {
  return scoreProfiles.find((profile) => score >= profile.min) || scoreProfiles[scoreProfiles.length - 1];
}

// Reparte los repasos futuros sin romper la curva: cada repaso solo puede moverse
// dentro de un margen proporcional a su intervalo (como el equilibrador de carga de Anki).
// Los repasos de hoy, los atrasados y los de intervalo corto no se mueven nunca.
function balanceUpcomingLoad() {
  const limit = dailyLimit();
  const tomorrow = addDays(startOfToday(), 1);
  const loads = new Map();
  const movable = [];

  state.topics.forEach((topic) => {
    const review = pendingReviewOf(topic);
    if (!review) return;
    const ideal = atReviewTime(review.idealDueDate || review.dueDate);
    if (ideal < tomorrow) return;
    movable.push({ topic, review, ideal });
  });

  movable
    .sort((a, b) => (a.review.intervalDays - b.review.intervalDays) || (a.ideal - b.ideal))
    .forEach(({ topic, review, ideal }) => {
      const gap = Math.max(1, Number(review.intervalDays) || 1);
      const margin = gap <= 2 ? 0 : Math.min(7, Math.max(1, Math.round(gap * 0.1)));
      const earliest = addDays(atReviewTime(topic.srs.lastReviewedAt), 1);
      const offsets = [0];
      for (let step = 1; step <= margin; step += 1) offsets.push(-step, step);

      let chosen = ideal;
      for (const offset of offsets) {
        const candidate = addDays(ideal, offset);
        if (candidate < tomorrow || candidate < earliest) continue;
        if ((loads.get(dateKey(candidate)) || 0) < limit) {
          chosen = candidate;
          break;
        }
      }

      const key = dateKey(chosen);
      loads.set(key, (loads.get(key) || 0) + 1);
      const moved = key !== dateKey(ideal);
      const wasMoved = dateKey(review.dueDate) !== dateKey(ideal);
      review.dueDate = chosen.toISOString();
      if (moved) {
        review.adjusted = true;
        review.adjustmentReason = "Movido para equilibrar carga diaria";
      } else if (wasMoved && review.adjustmentReason === "Movido para equilibrar carga diaria") {
        review.adjustmentReason = "";
      }
    });
}

function streakBonus() {
  return Math.min(10, Math.floor(currentStreak() / 3) * 2);
}

// La racha solo sigue viva si el ultimo repaso fue hoy o ayer.
function currentStreak() {
  if (!state.lastCompletedDate) return 0;
  const today = dateKey(new Date());
  const yesterday = dateKey(addDays(new Date(), -1));
  return state.lastCompletedDate === today || state.lastCompletedDate === yesterday ? state.streak : 0;
}

function updateStreak(date) {
  const todayKey = dateKey(date);
  if (state.lastCompletedDate === todayKey) return;
  const yesterdayKey = dateKey(addDays(date, -1));
  state.streak = state.lastCompletedDate === yesterdayKey ? state.streak + 1 : 1;
  state.lastCompletedDate = todayKey;
}

function countReviewsOn(date) {
  const key = dateKey(date);
  return allReviews().filter((item) => !item.completedAt && dateKey(item.dueDate) === key).length;
}

function cleanupOldCompletedIvyTasks() {
  const today = dateKey(new Date());
  const initialLength = state.ivyTasks.length;
  state.ivyTasks = state.ivyTasks.filter((task) => !task.completedAt || task.date === today);
  if (state.ivyTasks.length !== initialLength) saveState();
}

function todayIvyTasks() {
  const today = dateKey(new Date());
  return state.ivyTasks
    .filter((task) => task.date === today)
    .sort((a, b) => {
      const completionOrder = Number(Boolean(a.completedAt)) - Number(Boolean(b.completedAt));
      if (completionOrder !== 0) return completionOrder;

      const difficultyOrder = ivyDifficultyWeight(b) - ivyDifficultyWeight(a);
      if (difficultyOrder !== 0) return difficultyOrder;

      const timeOrder = ivyTaskMinutes(b) - ivyTaskMinutes(a);
      if (timeOrder !== 0) return timeOrder;

      return a.title.localeCompare(b.title, "es", { sensitivity: "base" });
    });
}

function ivyDifficultyWeight(task) {
  return (ivyDifficulties[task.difficulty] || ivyDifficulties.yellow).weight;
}

function addIvyTask() {
  const tasks = todayIvyTasks();
  if (tasks.length >= ivyTaskLimit) {
    alert(`El método Ivy Lee recomienda como máximo ${ivyTaskLimit} tareas clave al día.`);
    return;
  }

  const title = els.ivyTaskInput.value.trim();
  const pomodoros = clamp(Number(els.ivyPomodoroInput.value) || 1, 1, 8);
  const durationMinutes = normalizePomodoroDuration(els.ivyDurationInput.value);
  const difficulty = ivyDifficulties[els.ivyDifficultyInput.value] ? els.ivyDifficultyInput.value : "yellow";
  if (!title) return;

  state.ivyTasks.unshift({
    id: crypto.randomUUID(),
    date: dateKey(new Date()),
    title,
    pomodoros,
    durationMinutes,
    difficulty,
    completedAt: "",
    points: 0,
  });
  saveState();
  els.ivyForm.reset();
  els.ivyPomodoroInput.value = 1;
  els.ivyDurationInput.value = "25";
  els.ivyDifficultyInput.value = "yellow";
  render();
}

function completeIvyTask(taskId) {
  const task = state.ivyTasks.find((item) => item.id === taskId);
  if (!task || task.completedAt) return;

  const completedAt = new Date();
  const points = ivyTaskPoints(task);
  task.completedAt = completedAt.toISOString();
  task.points = points;
  state.points += points;
  state.history.unshift({
    id: crypto.randomUUID(),
    type: "ivy",
    taskId: task.id,
    task: task.title,
    pomodoros: task.pomodoros,
    durationMinutes: task.durationMinutes,
    difficulty: task.difficulty || "yellow",
    points,
    completedAt: completedAt.toISOString(),
  });
  saveState();
  render();
}

function deleteIvyTask(taskId) {
  const task = state.ivyTasks.find((item) => item.id === taskId);
  if (!task) return;
  const confirmed = task.completedAt
    ? confirm(`¿Borrar "${task.title}"? También se retirarán sus puntos.`)
    : confirm(`¿Borrar "${task.title}"?`);
  if (!confirmed) return;

  state.ivyTasks = state.ivyTasks.filter((item) => item.id !== taskId);
  state.history = state.history.filter((item) => item.taskId !== taskId);
  recomputePointsFromHistory();
  saveState();
  render();
}

function ivyTaskPoints(task) {
  const difficulty = ivyDifficulties[task.difficulty] || ivyDifficulties.yellow;
  return Math.round(task.pomodoros * ivyPointsPerPomodoro * difficulty.multiplier);
}

function ivyTaskMinutes(task) {
  return task.pomodoros * normalizePomodoroDuration(task.durationMinutes);
}

function ivyPomodoroStats() {
  const today = dateKey(new Date());
  const weekStart = dateKey(addDays(new Date(), -6));
  const completedIvy = state.history.filter((item) => item.type === "ivy");
  const isInRange = (key) => key >= weekStart && key <= today;

  const todayCompleted = completedIvy
    .filter((item) => dateKey(item.completedAt) === today)
    .reduce((sum, item) => sum + (Number(item.pomodoros) || 0), 0);
  const todayMinutesCompleted = completedIvy
    .filter((item) => dateKey(item.completedAt) === today)
    .reduce((sum, item) => sum + ((Number(item.pomodoros) || 0) * normalizePomodoroDuration(item.durationMinutes)), 0);
  const todayPending = state.ivyTasks
    .filter((task) => task.date === today && !task.completedAt)
    .reduce((sum, task) => sum + task.pomodoros, 0);
  const todayMinutesPending = state.ivyTasks
    .filter((task) => task.date === today && !task.completedAt)
    .reduce((sum, task) => sum + ivyTaskMinutes(task), 0);
  const weekCompleted = completedIvy
    .filter((item) => isInRange(dateKey(item.completedAt)))
    .reduce((sum, item) => sum + (Number(item.pomodoros) || 0), 0);
  const weekMinutesCompleted = completedIvy
    .filter((item) => isInRange(dateKey(item.completedAt)))
    .reduce((sum, item) => sum + ((Number(item.pomodoros) || 0) * normalizePomodoroDuration(item.durationMinutes)), 0);
  const weekPending = state.ivyTasks
    .filter((task) => isInRange(task.date) && !task.completedAt)
    .reduce((sum, task) => sum + task.pomodoros, 0);
  const weekMinutesPending = state.ivyTasks
    .filter((task) => isInRange(task.date) && !task.completedAt)
    .reduce((sum, task) => sum + ivyTaskMinutes(task), 0);
  const weekDays = new Set(completedIvy.filter((item) => isInRange(dateKey(item.completedAt))).map((item) => dateKey(item.completedAt))).size;

  return {
    todayCompleted,
    todayPlanned: todayCompleted + todayPending,
    todayMinutesCompleted,
    todayMinutesPlanned: todayMinutesCompleted + todayMinutesPending,
    weekCompleted,
    weekPlanned: weekCompleted + weekPending,
    weekMinutesCompleted,
    weekMinutesPlanned: weekMinutesCompleted + weekMinutesPending,
    weekDays,
  };
}

function render() {
  const due = dueReviews();
  const ivyTasks = todayIvyTasks();
  const completedIvyTasks = ivyTasks.filter((task) => task.completedAt);
  const completed = state.history.filter((item) => item.type !== "skipped" && typeof item.score === "number");
  const average = completed.length
    ? completed.reduce((sum, item) => sum + item.score, 0) / completed.length
    : 0;
  const todayLoad = countReviewsOn(new Date());

  els.pointsStat.textContent = state.points;
  const streak = currentStreak();
  els.streakStat.textContent = `${streak} ${streak === 1 ? "dia" : "dias"}`;
  els.levelStat.textContent = Math.floor(state.points / 250) + 1;
  els.todayStat.textContent = `${due.length} ${due.length === 1 ? "repaso" : "repasos"}`;
  els.loadStat.textContent = `${todayLoad}/`;
  els.dailyLimitSelect.value = String(dailyLimit());
  els.dueCount.textContent = `${due.length} pendientes`;
  els.ivyCount.textContent = `${completedIvyTasks.length}/${ivyTasks.length || ivyTaskLimit} tareas`;
  els.averageScore.textContent = completed.length ? `Media ${average.toFixed(1)}/10` : "Sin notas";
  els.rewardPoints.textContent = `${state.points} puntos`;

  renderSubjectOptions();
  renderDueList(due);
  renderIvyStats(ivyPomodoroStats());
  renderIvyTasks(ivyTasks);
  renderCalendar();
  renderProgress();
  renderRewards();
}

function renderDueList(items) {
  els.dueList.replaceChildren();
  if (!items.length) return renderEmpty(els.dueList);

  items.forEach((item) => {
    const dueDate = new Date(item.dueDate);
    const daysLate = Math.max(0, dayDistance(new Date(), dueDate));
    const overdue = daysLate > 0;
    const card = document.createElement("article");
    card.className = `review-card${overdue ? " overdue" : ""}`;
    card.innerHTML = `
      <div>
        <span class="badge ${overdue ? "warning" : "brand"}">${overdue ? `⚠️ Atrasado ${daysLate}d` : "✅ Toca hoy"} · Repaso ${item.step}${item.topic.hardcore ? " · 🔥" : ""}</span>
        <p class="card-title">📘 ${escapeHtml(item.topic.title)}</p>
        <p class="card-meta">${escapeHtml(item.topic.subject)} · ${formatDate(dueDate)}</p>
        ${item.adjustmentReason ? `<p class="card-note">${escapeHtml(item.adjustmentReason)}</p>` : ""}
      </div>
      <div class="review-actions">
        <button class="ghost skip-btn" type="button">⏭️ Saltar</button>
        <button class="primary" type="button">📝 Evaluar</button>
      </div>
    `;
    card.querySelector(".primary").addEventListener("click", () => openReview(item));
    card.querySelector(".skip-btn").addEventListener("click", () => skipReview(item.id));
    els.dueList.append(card);
  });
}

function renderIvyTasks(tasks) {
  els.ivyList.replaceChildren();
  if (!tasks.length) return renderEmpty(els.ivyList);

  tasks.forEach((task) => {
    const difficulty = ivyDifficulties[task.difficulty] || ivyDifficulties.yellow;
    const item = document.createElement("article");
    item.className = `ivy-card difficulty-${difficulty.className}${task.completedAt ? " completed" : ""}`;
    item.innerHTML = `
      <div>
        <p class="card-title">${task.completedAt ? "✅" : "🍅"} ${escapeHtml(task.title)}</p>
        <p class="card-meta">
          <span class="difficulty-pill ${difficulty.className}">${difficulty.emoji} ${difficulty.label}</span>
          ${task.pomodoros} ${task.pomodoros === 1 ? "pomodoro" : "pomodoros"} de ${normalizePomodoroDuration(task.durationMinutes)} min · ${ivyTaskMinutes(task)} min · ${ivyTaskPoints(task)} puntos
        </p>
      </div>
      <div class="ivy-actions">
        <label class="check-action">
          <input type="checkbox" ${task.completedAt ? "checked disabled" : ""} />
          Hecha
        </label>
        <button class="ghost danger delete-ivy" type="button" aria-label="Borrar ${escapeHtml(task.title)}">🗑️</button>
      </div>
    `;
    item.querySelector("input").addEventListener("change", () => completeIvyTask(task.id));
    item.querySelector(".delete-ivy").addEventListener("click", () => deleteIvyTask(task.id));
    els.ivyList.append(item);
  });
}

function renderIvyStats(stats) {
  const todayPercent = stats.todayPlanned ? Math.round((stats.todayCompleted / stats.todayPlanned) * 100) : 0;
  const weekPercent = stats.weekPlanned ? Math.round((stats.weekCompleted / stats.weekPlanned) * 100) : 0;
  els.ivyStats.innerHTML = `
    <article class="ivy-stat-card">
      <span>Hoy</span>
      <strong>${stats.todayCompleted}/${stats.todayPlanned}</strong>
      <small>${stats.todayMinutesCompleted}/${stats.todayMinutesPlanned} min</small>
      <div class="mini-progress" aria-hidden="true"><span style="width: ${todayPercent}%"></span></div>
    </article>
    <article class="ivy-stat-card">
      <span>7 días</span>
      <strong>${stats.weekCompleted}/${stats.weekPlanned}</strong>
      <small>${stats.weekMinutesCompleted}/${stats.weekMinutesPlanned} min</small>
      <div class="mini-progress" aria-hidden="true"><span style="width: ${weekPercent}%"></span></div>
    </article>
    <article class="ivy-stat-card">
      <span>Días cumplidos</span>
      <strong>${stats.weekDays}/7</strong>
      <div class="mini-progress" aria-hidden="true"><span style="width: ${Math.round((stats.weekDays / 7) * 100)}%"></span></div>
    </article>
  `;
}

function renderCalendar() {
  const limit = addDays(startOfToday(), 30);
  const upcoming = allReviews()
    .filter((item) => !item.completedAt && new Date(item.dueDate) <= limit)
    .sort((a, b) => new Date(a.dueDate) - new Date(b.dueDate));

  els.calendarList.replaceChildren();
  if (!upcoming.length) return renderEmpty(els.calendarList);

  upcoming.forEach((item) => {
    const dueDate = new Date(item.dueDate);
    const row = document.createElement("article");
    row.className = "calendar-row";
    row.innerHTML = `
      <div class="date-pill">🗓️ ${shortDate(dueDate)}</div>
      <div>
        <p class="card-title">📘 ${escapeHtml(item.topic.title)}</p>
        <p class="card-meta">${escapeHtml(item.topic.subject)} · carga ${countReviewsOn(dueDate)}/${dailyLimit()}</p>
        ${item.adjustmentReason ? `<p class="card-note">${escapeHtml(item.adjustmentReason)}</p>` : ""}
      </div>
      <span class="badge ${item.topic.hardcore ? "hardcore" : item.adjusted ? "brand" : ""}">${item.topic.hardcore ? "🔥 Hardcore" : item.adjusted ? "🧠 Adaptado" : `Repaso ${item.step}`}</span>
    `;
    els.calendarList.append(row);
  });
}

function renderProgress() {
  els.progressList.replaceChildren();
  if (!state.topics.length) return renderEmpty(els.progressList);

  state.topics.forEach((topic) => {
    const done = topic.reviews.filter((review) => review.completedAt);
    const average = done.length ? done.reduce((sum, review) => sum + review.score, 0) / done.length : 0;
    const nextReview = pendingReviewOf(topic);
    const interval = topic.srs?.interval || 1;
    const card = document.createElement("article");
    card.className = `topic-card${topic.hardcore ? " is-hardcore" : ""}`;
    card.innerHTML = `
      <div class="topic-card-head">
        <div>
          <p class="card-title">📘 ${escapeHtml(topic.title)}</p>
          <p class="card-meta">${escapeHtml(topic.subject)} · ${done.length} ${done.length === 1 ? "repaso hecho" : "repasos hechos"} · intervalo ${interval} ${interval === 1 ? "día" : "días"}</p>
        </div>
        <button class="ghost danger delete-topic" type="button" aria-label="Borrar ${escapeHtml(topic.title)}">🗑️ Borrar</button>
      </div>
      <div class="score-bar" aria-label="Nota media">
        <div class="score-fill" style="width: ${average * 10}%"></div>
      </div>
      <div class="topic-metrics">
        <strong>${done.length ? average.toFixed(1) : "-"} / 10</strong>
        <span class="badge brand">🧠 Dominio ${Math.round(topic.mastery)}%</span>
        <span class="badge">${nextReview ? `⏭️ Próximo ${shortDate(new Date(nextReview.dueDate))}` : "✅ Al día"}</span>
      </div>
      <label class="hardcore-toggle">
        <input type="checkbox" ${topic.hardcore ? "checked" : ""} />
        <span>🔥 Modo hardcore <small>${topic.hardcore ? `más repasos, máximo ${srsConfig.modes.hardcore.maxInterval} días` : "desactivado"}</small></span>
      </label>
    `;
    card.querySelector(".delete-topic").addEventListener("click", () => deleteTopic(topic.id));
    card.querySelector(".hardcore-toggle input").addEventListener("change", (event) => setHardcore(topic.id, event.target.checked));
    els.progressList.append(card);
  });
}

function renderRewards() {
  els.rewardList.replaceChildren();
  if (!state.rewards.length) return renderEmpty(els.rewardList);

  state.rewards.forEach((reward) => {
    const canRedeem = state.points >= reward.cost && !reward.redeemed;
    const card = document.createElement("article");
    card.className = "reward-card";
    card.innerHTML = `
      <div>
        <p class="card-title">${escapeHtml(reward.name)}</p>
        <p class="card-meta">${reward.redeemed ? "Canjeada" : `${reward.cost} puntos`}</p>
      </div>
      <div class="reward-actions">
        <button class="ghost danger delete-reward" type="button">🗑️ Borrar</button>
        <button class="${canRedeem ? "primary" : "ghost"} redeem-reward" type="button" ${canRedeem ? "" : "disabled"}>🎁 Canjear</button>
      </div>
    `;
    card.querySelector(".delete-reward").addEventListener("click", () => deleteReward(reward.id));
    card.querySelector(".redeem-reward").addEventListener("click", () => {
      if (!canRedeem) return;
      reward.redeemed = true;
      recordRedemption(reward);
      recomputePointsFromHistory();
      saveState();
      render();
    });
    els.rewardList.append(card);
  });
}

function renderEmpty(container) {
  container.append(document.querySelector("#emptyStateTemplate").content.cloneNode(true));
}

function openReview(item) {
  activeReviewId = item.id;
  els.reviewSubject.textContent = item.topic.subject;
  els.reviewTitle.textContent = item.topic.title;
  els.scoreInput.value = 7;
  els.scoreOutput.textContent = "7";
  els.noteInput.value = "";
  els.reviewDialog.showModal();
}

function notifyDueReviews(force) {
  if (!("Notification" in window) || Notification.permission !== "granted") return;
  const due = dueReviews();
  if (!due.length) {
    if (force) new Notification("Spaced Bambutition", { body: "✨ Todo en orden." });
    return;
  }
  const key = `${dateKey(new Date())}-${due.map((item) => item.id).join("-")}`;
  if (!force && key === lastNotificationKey) return;
  lastNotificationKey = key;
  new Notification("Spaced Bambutition", {
    body: `${due.length} ${due.length === 1 ? "repaso necesita" : "repasos necesitan"} tu nota de hoy.`,
  });
}

function formatDate(date) {
  return new Intl.DateTimeFormat("es", { dateStyle: "medium" }).format(date);
}

function shortDate(date) {
  return new Intl.DateTimeFormat("es", { day: "2-digit", month: "short" }).format(date);
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;",
  })[char]);
}
