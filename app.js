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
const xpPerLevel = 250;
const seenTierKey = "spaced-bambutition-seen-tier";
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
let renderedHeroTier = null;

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
  heroSprite: document.querySelector("#heroSprite"),
  heroClass: document.querySelector("#heroClass"),
  xpFill: document.querySelector("#xpFill"),
  xpText: document.querySelector("#xpText"),
  battleArena: document.querySelector("#battleArena"),
  battleStatus: document.querySelector("#battleStatus"),
  calendarCount: document.querySelector("#calendarCount"),
  overallChart: document.querySelector("#overallChart"),
  reviewPastNotes: document.querySelector("#reviewPastNotes"),
  topicDialog: document.querySelector("#topicDialog"),
  topicDialogSubject: document.querySelector("#topicDialogSubject"),
  topicDialogTitle: document.querySelector("#topicDialogTitle"),
  topicDialogBody: document.querySelector("#topicDialogBody"),
  closeTopicDialog: document.querySelector("#closeTopicDialog"),
};
let openTopicId = null;

document.querySelector("#dateInput").valueAsDate = new Date();

els.closeTopicDialog.addEventListener("click", () => els.topicDialog.close());
els.topicDialog.addEventListener("close", () => { openTopicId = null; });
[els.topicDialog, els.reviewDialog].forEach((dialog) => {
  dialog.addEventListener("click", (event) => {
    if (event.target === dialog) dialog.close();
  });
});
window.addEventListener("resize", () => {
  if (els.overallChart.offsetWidth) renderOverallChart();
  if (openTopicId) renderTopicDialog();
});

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
    if (tab.dataset.view === "progress") renderOverallChart();
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
    battle: raw.battle && typeof raw.battle === "object" ? raw.battle : null,
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
    if (item.type === "monster") return sum + (Number(item.points) || 0);
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

  const battle = updateBattle();

  els.pointsStat.textContent = state.points;
  const streak = currentStreak();
  els.streakStat.textContent = `${streak} ${streak === 1 ? "día" : "días"}`;
  els.todayStat.textContent = `${due.length} ${due.length === 1 ? "repaso" : "repasos"}`;
  els.loadStat.textContent = `${todayLoad}/`;
  els.dailyLimitSelect.value = String(dailyLimit());
  els.dueCount.textContent = due.length ? `${due.length} ${due.length === 1 ? "pendiente" : "pendientes"}` : "Al día";
  els.ivyCount.textContent = `${completedIvyTasks.length}/${ivyTasks.length || ivyTaskLimit} hechas`;
  els.averageScore.textContent = completed.length ? `Media ${formatScore(average)}` : "Sin notas";
  els.rewardPoints.textContent = `${state.points} puntos`;

  renderHero();
  renderSubjectOptions();
  renderDueList(due);
  renderIvyStats(ivyPomodoroStats());
  renderIvyTasks(ivyTasks);
  renderBattle(battle);
  renderCalendar();
  renderProgress();
  renderRewards();
  if (openTopicId) renderTopicDialog();
}

function renderDueList(items) {
  els.dueList.replaceChildren();
  if (!items.length) return renderEmpty(els.dueList, "✨ No tienes repasos pendientes hoy.");

  items.forEach((item) => {
    const dueDate = new Date(item.dueDate);
    const daysLate = Math.max(0, dayDistance(new Date(), dueDate));
    const overdue = daysLate > 0;
    const card = document.createElement("article");
    card.className = `review-card${overdue ? " overdue" : ""}${item.topic.hardcore ? " is-hardcore" : ""}`;
    card.innerHTML = `
      <div>
        <span class="badge ${overdue ? "warning" : "brand"}">${overdue ? `Atrasado ${daysLate} ${daysLate === 1 ? "día" : "días"}` : "Toca hoy"} · Repaso ${item.step}</span>
        <p class="card-title">${topicNameHtml(item.topic)}</p>
        <p class="card-meta">${escapeHtml(item.topic.subject)} · ${formatDate(dueDate)}</p>
        ${item.adjustmentReason ? `<p class="card-note">${escapeHtml(item.adjustmentReason)}</p>` : ""}
      </div>
      <div class="review-actions">
        <button class="ghost skip-btn" type="button">Saltar</button>
        <button class="primary" type="button">Evaluar</button>
      </div>
    `;
    card.querySelector(".primary").addEventListener("click", () => openReview(item));
    card.querySelector(".skip-btn").addEventListener("click", () => skipReview(item.id));
    els.dueList.append(card);
  });
}

function renderIvyTasks(tasks) {
  els.ivyList.replaceChildren();
  if (!tasks.length) return renderEmpty(els.ivyList, "Añade hasta 6 tareas clave para hoy.");

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

// ---------- Utilidades de presentacion ----------

function topicNameHtml(topic) {
  return topic.hardcore
    ? `<span class="topic-name is-hardcore">🔥 ${escapeHtml(topic.title)}</span>`
    : `<span class="topic-name">📘 ${escapeHtml(topic.title)}</span>`;
}

function formatScore(value) {
  return Number(value).toLocaleString("es", { maximumFractionDigits: 1 });
}

function scoreTone(score) {
  const key = getScoreProfile(score).key;
  return key === "easy" || key === "good" ? "good" : key === "hard" ? "fragile" : "weak";
}

function completedReviewsOf(topic) {
  return topic.reviews
    .filter((review) => review.completedAt && typeof review.score === "number")
    .sort((a, b) => new Date(a.completedAt) - new Date(b.completedAt));
}

function relativeDayLabel(date) {
  const diff = dayDistance(date, new Date());
  if (diff === 0) return "Hoy";
  if (diff === 1) return "Mañana";
  if (diff === -1) return "Ayer";
  return new Intl.DateTimeFormat("es", { weekday: "long" }).format(date).replace(/^./, (c) => c.toUpperCase());
}

// ---------- Heroe y experiencia ----------


function lifetimeXp() {
  const earned = state.history.reduce((sum, item) => {
    if (item.type === "completed" || item.type === "ivy" || item.type === "monster") return sum + (Number(item.points) || 0);
    if (item.type === "skipped") return sum - (Number(item.penalty) || 0);
    return sum;
  }, 0);
  return Math.max(0, earned, state.points);
}

function levelInfo() {
  const tiers = window.BambuSprites.heroTiers;
  const xp = lifetimeXp();
  const level = Math.floor(xp / xpPerLevel) + 1;
  const tier = Math.min(tiers.length - 1, Math.floor((level - 1) / 2));
  const nextTierLevel = tier < tiers.length - 1 ? (tier + 1) * 2 + 1 : null;
  return { xp, level, tier, into: xp % xpPerLevel, nextTierLevel, tiers };
}


function renderHero() {
  const info = levelInfo();
  els.levelStat.textContent = info.level;
  els.heroClass.textContent = info.tiers[info.tier].name;
  els.xpFill.style.width = `${Math.round((info.into / xpPerLevel) * 100)}%`;
  const next = info.nextTierLevel
    ? `Nivel ${info.nextTierLevel}: ${info.tiers[info.tier + 1].name.toLowerCase()}`
    : "Equipo legendario completo";
  els.xpText.textContent = `${info.into}/${xpPerLevel} XP para el nivel ${info.level + 1} · ${next}`;

  if (renderedHeroTier !== info.tier) {
    els.heroSprite.innerHTML = window.BambuSprites.heroSVG(info.tier);
    renderedHeroTier = info.tier;
  }

  let seen = null;
  try { seen = localStorage.getItem(seenTierKey); } catch {}
  if (seen === null) {
    try { localStorage.setItem(seenTierKey, String(info.tier)); } catch {}
  } else if (info.tier > Number(seen)) {
    try { localStorage.setItem(seenTierKey, String(info.tier)); } catch {}
    els.heroSprite.classList.remove("level-up");
    void els.heroSprite.offsetWidth;
    els.heroSprite.classList.add("level-up");
    showToast(`¡Nuevo equipo! Ahora eres: ${info.tiers[info.tier].name}`);
  }
}

function showToast(message) {
  let toast = document.querySelector(".toast");
  if (!toast) {
    toast = document.createElement("div");
    toast.className = "toast";
    toast.setAttribute("role", "status");
    document.body.append(toast);
  }
  toast.textContent = message;
  toast.classList.remove("show");
  void toast.offsetWidth;
  toast.classList.add("show");
  clearTimeout(showToast.timer);
  showToast.timer = setTimeout(() => toast.classList.remove("show"), 4200);
}

// ---------- Monstruo del dia ----------

function hashString(value) {
  return Array.from(value).reduce((hash, char) => (hash * 31 + char.charCodeAt(0)) >>> 0, 7);
}

function monsterIndexForThreat(threat) {
  if (threat <= 0) return -1;
  if (threat <= 2) return 0;
  if (threat <= 4) return 1;
  if (threat <= 6) return 2;
  if (threat <= 8) return 3;
  if (threat <= 11) return 4;
  return 5;
}

function battleSnapshot() {
  const today = dateKey(new Date());
  const isToday = (value) => value && dateKey(value) === today;
  const reviewsDone = state.history.filter((item) => item.type === "completed" && isToday(item.completedAt)).length;
  const ivyDone = state.history.filter((item) => item.type === "ivy" && isToday(item.completedAt)).length;
  const skipped = state.history.filter((item) => item.type === "skipped" && isToday(item.skippedAt)).length;
  const due = dueReviews();
  const ivyPending = todayIvyTasks().filter((task) => !task.completedAt).length;
  const overdue = due.filter((item) => new Date(item.dueDate) < startOfToday()).length;
  const weak = state.topics.filter((topic) => {
    const done = completedReviewsOf(topic);
    const last = done[done.length - 1];
    return topic.srs?.relearning || (last && last.score < 5);
  }).length;
  const hits = reviewsDone + ivyDone;
  const total = hits + due.length + ivyPending + skipped;
  return { hits, total, skipped, threat: total + weak + overdue, remaining: due.length + ivyPending };
}

function updateBattle() {
  const snapshot = battleSnapshot();
  const today = dateKey(new Date());
  let changed = false;
  if (!state.battle || state.battle.date !== today) {
    state.battle = { date: today, monster: -1, variant: hashString(today) % 3, defeated: false, reward: 0 };
    changed = true;
  }
  const battle = state.battle;
  const index = snapshot.total > 0 ? monsterIndexForThreat(snapshot.threat) : -1;
  if (!battle.defeated && index > battle.monster) {
    battle.monster = index;
    changed = true;
  }
  if (!battle.defeated && battle.monster >= 0 && snapshot.total > 0 && snapshot.hits >= snapshot.total && snapshot.skipped === 0) {
    const monster = window.BambuSprites.monsters[battle.monster];
    const reward = 10 + battle.monster * 5;
    battle.defeated = true;
    battle.reward = reward;
    state.points += reward;
    state.history.unshift({
      id: crypto.randomUUID(),
      type: "monster",
      monster: `${monster.name} ${monster.variants[battle.variant % monster.variants.length].label}`,
      points: reward,
      completedAt: new Date().toISOString(),
    });
    changed = true;
    setTimeout(() => showToast(`¡Has derrotado al ${monster.name.toLowerCase()}! +${reward} puntos`), 50);
  }
  if (changed) saveState();
  return snapshot;
}

function renderBattle(snapshot) {
  const battle = state.battle;
  const heroTier = levelInfo().tier;
  const heroSvg = window.BambuSprites.heroSVG(heroTier);

  if (!battle || battle.monster < 0 || (!battle.defeated && snapshot.total === 0)) {
    els.battleStatus.textContent = "Sin rival";
    els.battleArena.innerHTML = `
      <div class="arena-scene is-calm">
        <div class="arena-hero">${heroSvg}</div>
        <p class="arena-calm">Hoy no hay ningún monstruo a la vista. Añade tareas Ivy Lee o crea temas y aparecerá uno.</p>
      </div>
    `;
    return;
  }

  const monster = window.BambuSprites.monsters[battle.monster];
  const variant = monster.variants[battle.variant % monster.variants.length];
  const hp = Math.max(0, snapshot.total - snapshot.hits);
  const hpPercent = snapshot.total ? Math.round((hp / snapshot.total) * 100) : 0;
  const escaped = !battle.defeated && snapshot.skipped > 0 && snapshot.remaining === 0;
  const stateClass = battle.defeated ? "is-defeated" : escaped ? "is-escaped" : "";
  let message;
  if (battle.defeated) message = `¡Derrotado! Has ganado ${battle.reward} puntos extra.`;
  else if (escaped) message = "Se ha escapado: saltaste un repaso y se curó. Mañana tendrás otra oportunidad.";
  else if (snapshot.skipped > 0) message = "Saltar un repaso lo ha curado: hoy ya no podrás derrotarlo, pero cada golpe sigue sumando.";
  else message = `Te faltan ${hp} ${hp === 1 ? "golpe" : "golpes"}: cada repaso o tarea Ivy Lee completada hoy le quita vida. Recompensa: ${10 + battle.monster * 5} puntos.`;

  els.battleStatus.textContent = battle.defeated ? "Derrotado" : escaped ? "Escapó" : `Vida ${hp}/${snapshot.total}`;
  els.battleArena.innerHTML = `
    <div class="arena-scene ${stateClass}">
      <div class="arena-hero">${heroSvg}</div>
      <span class="arena-vs" aria-hidden="true">VS</span>
      <div class="arena-monster">${window.BambuSprites.monsterSVG(battle.monster, battle.variant)}</div>
    </div>
    <div class="arena-info">
      <div class="arena-name-row">
        <p class="monster-name">${monster.name} ${variant.label}</p>
        <span class="monster-rank">Rango ${battle.monster + 1}/6</span>
      </div>
      <div class="hp-bar" role="img" aria-label="Vida del monstruo ${hp} de ${snapshot.total}"><span style="width: ${hpPercent}%"></span></div>
      <p class="arena-message">${message}</p>
    </div>
  `;
}

// ---------- Calendario con repasos estimados ----------

function projectedReviews(topic, limitDate) {
  const pending = pendingReviewOf(topic);
  if (!pending || !topic.srs) return [];
  const projected = [];
  let srs = { ...topic.srs };
  let base = srs.relearning ? srs.interval : Math.max(1, Number(pending.intervalDays) || 1);
  let anchor = new Date(pending.dueDate) < startOfToday() ? atReviewTime(startOfToday()) : atReviewTime(pending.dueDate);
  let step = pending.step;
  for (let index = 0; index < 30; index += 1) {
    const result = scheduleNext(srs, topicMode(topic), 7, base, 0);
    srs = result.srs;
    base = result.gap;
    anchor = addDays(anchor, result.gap);
    step += 1;
    if (anchor > limitDate) break;
    projected.push({ topic, dueDate: anchor, step, estimated: true });
  }
  return projected;
}

function renderCalendar() {
  const limit = addDays(startOfToday(), 30);
  const today = startOfToday();
  const items = [];
  state.topics.forEach((topic) => {
    const pending = pendingReviewOf(topic);
    if (!pending) return;
    const dueDate = new Date(pending.dueDate);
    if (dueDate > limit) return;
    items.push({ topic, review: pending, dueDate: dueDate < today ? atReviewTime(today) : dueDate, overdue: dueDate < today, step: pending.step, estimated: false });
    items.push(...projectedReviews(topic, limit));
  });
  items.sort((a, b) => a.dueDate - b.dueDate || Number(a.estimated) - Number(b.estimated));

  const realCount = items.filter((item) => !item.estimated).length;
  els.calendarCount.textContent = `${realCount} ${realCount === 1 ? "programado" : "programados"}`;
  els.calendarList.replaceChildren();
  if (!items.length) return renderEmpty(els.calendarList, "No hay repasos en los próximos 30 días.");

  const groups = new Map();
  items.forEach((item) => {
    const key = dateKey(item.dueDate);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(item);
  });

  groups.forEach((dayItems, key) => {
    const date = parseDate(key);
    const real = dayItems.filter((item) => !item.estimated).length;
    const over = real > dailyLimit();
    const day = document.createElement("section");
    day.className = "calendar-day";
    day.innerHTML = `
      <header class="calendar-day-head">
        <div class="calendar-date">
          <span class="calendar-day-num">${date.getDate()}</span>
          <span class="calendar-month">${new Intl.DateTimeFormat("es", { month: "short" }).format(date)}</span>
        </div>
        <div>
          <p class="calendar-weekday">${relativeDayLabel(date)}</p>
          <p class="calendar-load${over ? " is-over" : ""}">${real}/${dailyLimit()} programados${dayItems.length > real ? ` · ${dayItems.length - real} estimados` : ""}</p>
        </div>
      </header>
      <div class="calendar-items"></div>
    `;
    const list = day.querySelector(".calendar-items");
    dayItems.forEach((item) => {
      const row = document.createElement("article");
      row.className = `calendar-row${item.estimated ? " is-estimated" : ""}${item.topic.hardcore ? " is-hardcore" : ""}`;
      const badge = item.estimated
        ? `<span class="badge ghost-badge">Estimado</span>`
        : item.overdue
          ? `<span class="badge warning">Atrasado</span>`
          : `<span class="badge brand">Repaso ${item.step}</span>`;
      row.innerHTML = `
        <div>
          <p class="card-title">${topicNameHtml(item.topic)}</p>
          <p class="card-meta">${escapeHtml(item.topic.subject)}${item.estimated ? ` · repaso ${item.step} si sacas un 7` : ""}</p>
        </div>
        ${badge}
      `;
      list.append(row);
    });
    els.calendarList.append(day);
  });
}

// ---------- Graficas ----------

// Grafica de linea de una sola serie (notas de 0 a 10) con tooltip al pasar o tocar.
function drawScoreChart(container, points, { ariaLabel, emptyText }) {
  container.replaceChildren();
  const valid = points.filter((point) => typeof point.value === "number");
  if (!valid.length) {
    container.innerHTML = `<p class="chart-empty">${emptyText}</p>`;
    return;
  }
  const width = Math.max(260, container.clientWidth || 560);
  const height = width < 420 ? 170 : 200;
  const pad = { top: 14, right: 16, bottom: 28, left: 30 };
  const plotW = width - pad.left - pad.right;
  const plotH = height - pad.top - pad.bottom;
  const x = (index) => pad.left + (points.length === 1 ? plotW / 2 : (index / (points.length - 1)) * plotW);
  const y = (value) => pad.top + plotH - (value / 10) * plotH;

  let grid = "";
  [0, 5, 10].forEach((value) => {
    grid += `<line class="chart-grid${value === 5 ? " is-pass" : ""}" x1="${pad.left}" x2="${width - pad.right}" y1="${y(value)}" y2="${y(value)}"/>`;
    grid += `<text class="chart-axis" x="${pad.left - 8}" y="${y(value) + 4}" text-anchor="end">${value}</text>`;
  });

  let path = "";
  let pen = false;
  points.forEach((point, index) => {
    if (typeof point.value !== "number") { pen = false; return; }
    path += `${pen ? "L" : "M"}${x(index).toFixed(1)},${y(point.value).toFixed(1)}`;
    pen = true;
  });

  const labelEvery = Math.max(1, Math.ceil(points.length / Math.floor(plotW / 56)));
  let labels = "";
  points.forEach((point, index) => {
    if (index % labelEvery !== 0 && index !== points.length - 1) return;
    if (index !== points.length - 1 && points.length - 1 - index < labelEvery) return;
    labels += `<text class="chart-axis" x="${x(index)}" y="${height - 8}" text-anchor="middle">${escapeHtml(point.label)}</text>`;
  });

  let dots = "";
  points.forEach((point, index) => {
    if (typeof point.value !== "number") return;
    dots += `<circle class="chart-dot tone-${scoreTone(point.value)}" cx="${x(index)}" cy="${y(point.value)}" r="5"/>`;
    dots += `<circle class="chart-hit" data-index="${index}" cx="${x(index)}" cy="${y(point.value)}" r="16" tabindex="0"/>`;
  });

  container.innerHTML = `
    <div class="chart-wrap">
      <svg class="score-chart" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" role="img" aria-label="${escapeHtml(ariaLabel)}">
        ${grid}${labels}
        <path class="chart-line" d="${path}"/>
        ${dots}
      </svg>
      <div class="chart-tooltip" hidden></div>
    </div>
  `;
  const tooltip = container.querySelector(".chart-tooltip");
  const show = (hit) => {
    const point = points[Number(hit.dataset.index)];
    tooltip.innerHTML = point.tooltip;
    tooltip.hidden = false;
    const cx = Number(hit.getAttribute("cx"));
    const cy = Number(hit.getAttribute("cy"));
    const tipWidth = tooltip.offsetWidth;
    tooltip.style.left = `${clamp(cx - tipWidth / 2, 0, width - tipWidth)}px`;
    tooltip.style.top = `${Math.max(0, cy - tooltip.offsetHeight - 12)}px`;
  };
  container.querySelectorAll(".chart-hit").forEach((hit) => {
    hit.addEventListener("pointerenter", () => show(hit));
    hit.addEventListener("focus", () => show(hit));
    hit.addEventListener("click", (event) => { event.stopPropagation(); show(hit); });
    hit.addEventListener("pointerleave", () => { tooltip.hidden = true; });
    hit.addEventListener("blur", () => { tooltip.hidden = true; });
  });
}

function weeklyAverages(weeks = 8) {
  const today = startOfToday();
  const monday = addDays(today, -((today.getDay() + 6) % 7));
  const buckets = Array.from({ length: weeks }, (_, index) => {
    const start = startOfDay(addDays(monday, -7 * (weeks - 1 - index)));
    return { start, end: startOfDay(addDays(start, 7)), scores: [] };
  });
  state.history.forEach((item) => {
    if (item.type !== "completed" || typeof item.score !== "number") return;
    const date = new Date(item.completedAt);
    const bucket = buckets.find((week) => date >= week.start && date < week.end);
    if (bucket) bucket.scores.push(item.score);
  });
  return buckets.map((week) => {
    const avg = week.scores.length ? week.scores.reduce((a, b) => a + b, 0) / week.scores.length : null;
    const label = shortDate(week.start);
    return {
      label,
      value: avg,
      tooltip: avg === null ? "" : `<strong>Semana del ${label}</strong><span>Media ${formatScore(avg)} · ${week.scores.length} ${week.scores.length === 1 ? "repaso" : "repasos"}</span>`,
    };
  });
}

function renderOverallChart() {
  const container = els.overallChart;
  container.innerHTML = `<div class="chart-head"><h3>Nota media por semana</h3><span class="muted">Últimas 8 semanas</span></div><div class="chart-body"></div>`;
  drawScoreChart(container.querySelector(".chart-body"), weeklyAverages(), {
    ariaLabel: "Nota media de los repasos en cada una de las últimas 8 semanas",
    emptyText: "Cuando evalúes tus primeros repasos verás aquí tu evolución semana a semana.",
  });
}

function sparklineSvg(scores) {
  if (scores.length < 2) return "";
  const width = 120;
  const height = 32;
  const points = scores.map((score, index) => `${(index / (scores.length - 1)) * (width - 6) + 3},${height - 3 - (score / 10) * (height - 6)}`);
  const last = points[points.length - 1].split(",");
  return `<svg class="sparkline" viewBox="0 0 ${width} ${height}" aria-hidden="true"><polyline points="${points.join(" ")}"/><circle cx="${last[0]}" cy="${last[1]}" r="3.5"/></svg>`;
}

// ---------- Progreso y detalle de tema ----------

function renderProgress() {
  els.progressList.replaceChildren();
  if (els.overallChart.offsetWidth) renderOverallChart();
  if (!state.topics.length) {
    const empty = document.createElement("div");
    empty.className = "empty-state";
    empty.innerHTML = "<strong>Aún no tienes temas.</strong><span>Crea tu primer tema en «Nuevo tema» para empezar a ver tu evolución.</span>";
    els.progressList.append(empty);
    return;
  }

  state.topics.forEach((topic) => {
    const done = completedReviewsOf(topic);
    const average = done.length ? done.reduce((sum, review) => sum + review.score, 0) / done.length : null;
    const nextReview = pendingReviewOf(topic);
    const notes = done.filter((review) => review.note).length;
    const card = document.createElement("button");
    card.type = "button";
    card.className = `topic-card${topic.hardcore ? " is-hardcore" : ""}`;
    card.setAttribute("aria-label", `Ver evolución y notas de ${topic.title}`);
    card.innerHTML = `
      <div class="topic-card-head">
        <div>
          <p class="card-title">${topicNameHtml(topic)}</p>
          <p class="card-meta">${escapeHtml(topic.subject)}</p>
        </div>
        <span class="topic-score tone-${average === null ? "none" : scoreTone(average)}">${average === null ? "–" : formatScore(average)}</span>
      </div>
      ${sparklineSvg(done.map((review) => review.score)) || `<p class="card-meta">${done.length ? "1 repaso hecho" : "Sin repasos todavía"}</p>`}
      <div class="topic-metrics">
        <span class="badge brand">🧠 Dominio ${Math.round(topic.mastery)}%</span>
        <span class="badge">⏭️ ${nextReview ? shortDate(new Date(nextReview.dueDate)) : "Al día"}</span>
        ${notes ? `<span class="badge">💬 ${notes} ${notes === 1 ? "nota" : "notas"}</span>` : ""}
      </div>
    `;
    card.addEventListener("click", () => openTopicDialog(topic.id));
    els.progressList.append(card);
  });
}

function openTopicDialog(topicId) {
  openTopicId = topicId;
  if (!els.topicDialog.open) els.topicDialog.showModal();
  renderTopicDialog();
}

function renderTopicDialog() {
  const topic = state.topics.find((item) => item.id === openTopicId);
  if (!topic) {
    els.topicDialog.close();
    return;
  }
  const done = completedReviewsOf(topic);
  const average = done.length ? done.reduce((sum, review) => sum + review.score, 0) / done.length : null;
  const nextReview = pendingReviewOf(topic);
  const interval = topic.srs?.interval || 1;

  els.topicDialogSubject.textContent = topic.subject;
  els.topicDialogTitle.innerHTML = topicNameHtml(topic);
  els.topicDialogBody.innerHTML = `
    <div class="detail-metrics">
      <div><span>Media</span><strong>${average === null ? "–" : formatScore(average)}</strong></div>
      <div><span>Repasos</span><strong>${done.length}</strong></div>
      <div><span>Dominio</span><strong>${Math.round(topic.mastery)}%</strong></div>
      <div><span>Próximo</span><strong>${nextReview ? shortDate(new Date(nextReview.dueDate)) : "–"}</strong></div>
    </div>
    <section class="detail-block">
      <div class="chart-head"><h3>Nota en cada repaso</h3><span class="muted">Intervalo actual: ${interval} ${interval === 1 ? "día" : "días"}</span></div>
      <div class="chart-body" id="topicChart"></div>
    </section>
    <label class="hardcore-toggle">
      <input type="checkbox" id="topicHardcoreToggle" ${topic.hardcore ? "checked" : ""} />
      <span>🔥 Modo hardcore <small>${topic.hardcore ? `Activado: más repasos y como mucho ${srsConfig.modes.hardcore.maxInterval} días entre ellos.` : "Actívalo para repasar este tema más a menudo (máximo 35 días entre repasos)."}</small></span>
    </label>
    <section class="detail-block">
      <h3>Tus comentarios</h3>
      <ol class="note-list">
        ${done.length ? done.slice().reverse().map((review) => `
          <li class="note-item">
            <span class="note-score tone-${scoreTone(review.score)}">${formatScore(review.score)}</span>
            <div>
              <p class="note-meta">Repaso ${review.step} · ${formatDate(new Date(review.completedAt))} · ${getScoreProfile(review.score).label}</p>
              <p class="note-text${review.note ? "" : " is-empty"}">${review.note ? escapeHtml(review.note) : "Sin comentario"}</p>
            </div>
          </li>
        `).join("") : `<li class="note-empty">Cuando evalúes un repaso, aquí verás tu nota y lo que escribiste (fallos típicos, qué reforzar…).</li>`}
      </ol>
    </section>
    <button type="button" class="ghost danger delete-topic" id="deleteTopicBtn">🗑️ Borrar tema</button>
  `;

  els.topicDialogBody.querySelector("#topicHardcoreToggle").addEventListener("change", (event) => setHardcore(topic.id, event.target.checked));
  els.topicDialogBody.querySelector("#deleteTopicBtn").addEventListener("click", () => deleteTopic(topic.id));

  const chartPoints = done.map((review) => ({
    label: shortDate(new Date(review.completedAt)),
    value: review.score,
    tooltip: `<strong>Repaso ${review.step} · ${formatScore(review.score)}</strong><span>${formatDate(new Date(review.completedAt))}</span>${review.note ? `<em>${escapeHtml(review.note)}</em>` : ""}`,
  }));
  drawScoreChart(els.topicDialogBody.querySelector("#topicChart"), chartPoints, {
    ariaLabel: `Notas de cada repaso de ${topic.title}`,
    emptyText: "Todavía no hay notas. La gráfica aparecerá tras tu primer repaso.",
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

function renderEmpty(container, message) {
  const node = document.querySelector("#emptyStateTemplate").content.cloneNode(true);
  if (message) node.querySelector("strong").textContent = message;
  container.append(node);
}

function openReview(item) {
  activeReviewId = item.id;
  els.reviewSubject.textContent = item.topic.subject;
  els.reviewTitle.innerHTML = topicNameHtml(item.topic);
  els.scoreInput.value = 7;
  els.scoreOutput.textContent = "7";
  els.noteInput.value = "";
  const pastNotes = completedReviewsOf(item.topic).filter((review) => review.note).slice(-3).reverse();
  els.reviewPastNotes.hidden = !pastNotes.length;
  els.reviewPastNotes.innerHTML = pastNotes.length
    ? `<p class="past-notes-title">💬 Lo que anotaste en repasos anteriores</p>${pastNotes.map((review) => `
        <p class="past-note"><span class="note-score tone-${scoreTone(review.score)}">${formatScore(review.score)}</span><span>${escapeHtml(review.note)}</span></p>
      `).join("")}`
    : "";
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
