const TEAM_COLORS = [
  "#e74c3c", "#3498db", "#2ecc71", "#f39c12", "#9b59b6",
  "#1abc9c", "#e91e8c", "#795548", "#607d8b", "#8bc34a",
];
const GAME_CODE_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no 0/O/1/I to avoid confusion

let questionsData = null;
let gameCode = null;
let gameRef = null;
let teams = [];
let currentQuestionIndex = 0;
let rafId = null;
let scoringMode = "majority"; // "majority" (default) or "proportional" -- set on game creation, restored on resume

const setupScreen = document.getElementById("setup-screen");
const lobbyScreen = document.getElementById("lobby-screen");
const raceScreen = document.getElementById("race-screen");
const winnerScreen = document.getElementById("winner-screen");

const teamCountSelect = document.getElementById("team-count");
const teamNameInputs = document.getElementById("team-name-inputs");
const createGameBtn = document.getElementById("create-game-btn");
const exportTeamsBtn = document.getElementById("export-teams-btn");
const importTeamsBtn = document.getElementById("import-teams-btn");
const importTeamsFile = document.getElementById("import-teams-file");

const questionsStatus = document.getElementById("questions-status");
const exportQuestionsBtn = document.getElementById("export-questions-btn");
const importQuestionsBtn = document.getElementById("import-questions-btn");
const importQuestionsFile = document.getElementById("import-questions-file");
const resetQuestionsBtn = document.getElementById("reset-questions-btn");

const gameCodeDisplay = document.getElementById("game-code-display");
const joinUrlDisplay = document.getElementById("join-url-display");
const qrCodeEl = document.getElementById("qr-code");
const lobbyTeamsEl = document.getElementById("lobby-teams");
const startQuizBtn = document.getElementById("start-quiz-btn");

const track = document.getElementById("track");
const raceBackdrop = document.getElementById("race-backdrop");
const trackWrapper = document.getElementById("track-wrapper");
const questionPanel = document.getElementById("question-panel");
const questionText = document.getElementById("question-text");
const optionsList = document.getElementById("options-list");
const timerBar = document.getElementById("timer-bar");
const answersProgress = document.getElementById("answers-progress");
const revealPanel = document.getElementById("reveal-panel");
const revealSummary = document.getElementById("reveal-summary");
const nextBtn = document.getElementById("next-btn");
const audio = document.getElementById("race-audio");

const winnerName = document.getElementById("winner-name");
const restartBtn = document.getElementById("restart-btn");

const proportionalModeToggle = document.getElementById("proportional-mode-toggle");
const SCORING_MODE_KEY = "kamelenrace_scoring_mode";
proportionalModeToggle.checked = localStorage.getItem(SCORING_MODE_KEY) === "proportional";
proportionalModeToggle.addEventListener("change", () => {
  localStorage.setItem(SCORING_MODE_KEY, proportionalModeToggle.checked ? "proportional" : "majority");
});

const scoringModeInfoBtn = document.getElementById("scoring-mode-info-btn");
const scoringModeInfoPopup = document.getElementById("scoring-mode-info-popup");
scoringModeInfoBtn.addEventListener("click", (e) => {
  e.stopPropagation();
  const willShow = scoringModeInfoPopup.classList.contains("hidden");
  scoringModeInfoPopup.classList.toggle("hidden", !willShow);
  scoringModeInfoBtn.setAttribute("aria-expanded", String(willShow));
});
document.addEventListener("click", (e) => {
  if (!scoringModeInfoPopup.classList.contains("hidden") && !scoringModeInfoPopup.contains(e.target)) {
    scoringModeInfoPopup.classList.add("hidden");
    scoringModeInfoBtn.setAttribute("aria-expanded", "false");
  }
});

function loadSavedTeamSetup() {
  try {
    return JSON.parse(localStorage.getItem("kamelenrace_team_setup"));
  } catch {
    return null;
  }
}

function saveTeamSetup(count, names) {
  localStorage.setItem("kamelenrace_team_setup", JSON.stringify({ count, names }));
}

const savedTeamSetup = loadSavedTeamSetup();
if (savedTeamSetup && savedTeamSetup.count) {
  teamCountSelect.value = savedTeamSetup.count;
}

function renderTeamNameInputs() {
  const count = parseInt(teamCountSelect.value, 10);
  const saved = loadSavedTeamSetup();
  teamNameInputs.innerHTML = "";
  for (let i = 0; i < count; i++) {
    const row = document.createElement("div");
    row.className = "team-name-row";

    const dot = document.createElement("div");
    dot.className = "team-color-dot";
    dot.style.background = TEAM_COLORS[i];

    const input = document.createElement("input");
    input.type = "text";
    input.placeholder = `Team ${i + 1}`;
    input.dataset.teamIndex = i;
    if (saved && saved.names && saved.names[i]) input.value = saved.names[i];

    row.appendChild(dot);
    row.appendChild(input);
    teamNameInputs.appendChild(row);
  }
}

teamCountSelect.addEventListener("change", renderTeamNameInputs);
renderTeamNameInputs();

exportTeamsBtn.addEventListener("click", () => {
  const names = Array.from(teamNameInputs.querySelectorAll("input")).map(
    (input, i) => input.value.trim() || `Team ${i + 1}`
  );
  const blob = new Blob([JSON.stringify({ count: names.length, names }, null, 2)], {
    type: "application/json",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "kamelenrace-teams.json";
  a.click();
  URL.revokeObjectURL(url);
});

importTeamsBtn.addEventListener("click", () => importTeamsFile.click());

importTeamsFile.addEventListener("change", async () => {
  const file = importTeamsFile.files[0];
  if (!file) return;
  try {
    const data = JSON.parse(await file.text());
    if (!data.names || !Array.isArray(data.names)) throw new Error("invalid");
    teamCountSelect.value = Math.min(Math.max(data.names.length, 2), 10);
    saveTeamSetup(data.names.length, data.names);
    renderTeamNameInputs();
  } catch {
    alert("Kon dit bestand niet lezen als teamnamen-export.");
  }
  importTeamsFile.value = "";
});

function isValidQuestionsData(data) {
  return (
    data &&
    Array.isArray(data.questions) &&
    data.questions.length > 0 &&
    data.questions.every(
      (q) =>
        typeof q.question === "string" &&
        Array.isArray(q.options) &&
        q.options.length > 0 &&
        Number.isInteger(q.correctIndex)
    )
  );
}

function updateQuestionsStatus() {
  const custom = localStorage.getItem("kamelenrace_questions");
  if (custom) {
    const data = JSON.parse(custom);
    questionsStatus.textContent = `Vragenset: ${data.title || "eigen vragenset"} (${data.questions.length} vragen)`;
  } else {
    questionsStatus.textContent = "Vragenset: standaard (AI-thema)";
  }
}

async function loadQuestions() {
  const custom = localStorage.getItem("kamelenrace_questions");
  if (custom) {
    questionsData = JSON.parse(custom);
    return;
  }
  const res = await fetch("data/questions.json");
  questionsData = await res.json();
}

updateQuestionsStatus();

exportQuestionsBtn.addEventListener("click", async () => {
  if (!questionsData) await loadQuestions();
  const blob = new Blob([JSON.stringify(questionsData, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "kamelenrace-vragen.json";
  a.click();
  URL.revokeObjectURL(url);
});

importQuestionsBtn.addEventListener("click", () => importQuestionsFile.click());

importQuestionsFile.addEventListener("change", async () => {
  const file = importQuestionsFile.files[0];
  if (!file) return;
  try {
    const data = JSON.parse(await file.text());
    if (!isValidQuestionsData(data)) throw new Error("invalid");
    localStorage.setItem("kamelenrace_questions", JSON.stringify(data));
    questionsData = data;
    updateQuestionsStatus();
  } catch {
    alert("Kon dit bestand niet lezen als geldige vragenset (verwacht: title + questions[] met question/options/correctIndex).");
  }
  importQuestionsFile.value = "";
});

resetQuestionsBtn.addEventListener("click", async () => {
  localStorage.removeItem("kamelenrace_questions");
  questionsData = null;
  await loadQuestions();
  updateQuestionsStatus();
});

function makeGameCode() {
  let code = "";
  for (let i = 0; i < 4; i++) {
    code += GAME_CODE_CHARS[Math.floor(Math.random() * GAME_CODE_CHARS.length)];
  }
  return code;
}

function buildTeamsFromInputs() {
  const inputs = teamNameInputs.querySelectorAll("input");
  return Array.from(inputs).map((input, i) => ({
    id: `t${i}`,
    name: input.value.trim() || `Team ${i + 1}`,
    color: TEAM_COLORS[i],
    position: 0,
  }));
}

createGameBtn.addEventListener("click", async () => {
  if (!questionsData) await loadQuestions();
  teams = buildTeamsFromInputs();
  saveTeamSetup(teams.length, teams.map((t) => t.name));
  scoringMode = proportionalModeToggle.checked ? "proportional" : "majority";
  gameCode = makeGameCode();
  gameRef = db.ref(`games/${gameCode}`);

  const teamsObj = {};
  teams.forEach((t) => {
    teamsObj[t.id] = { name: t.name, color: t.color, position: 0 };
  });

  await gameRef.set({
    status: "lobby",
    currentQuestionIndex: 0,
    totalQuestions: questionsData.questions.length,
    teams: teamsObj,
    scoringMode,
    createdAt: firebase.database.ServerValue.TIMESTAMP,
  });

  history.replaceState(null, "", `${location.pathname}?game=${gameCode}`);
  setupScreen.classList.add("hidden");
  showLobbyScreen();
});

function getJoinUrl() {
  return `${location.origin}${location.pathname.replace(/index\.html$/, "")}player.html?game=${gameCode}`;
}

function showLobbyScreen() {
  lobbyScreen.classList.remove("hidden");

  gameCodeDisplay.textContent = gameCode;
  const joinUrl = getJoinUrl();
  joinUrlDisplay.textContent = joinUrl;
  qrCodeEl.innerHTML = "";
  new QRCode(qrCodeEl, { text: joinUrl, width: 220, height: 220 });

  listenForPlayers();
}

function renderMiniJoin() {
  const miniQrEl = document.getElementById("mini-qr");
  miniQrEl.innerHTML = "";
  new QRCode(miniQrEl, { text: getJoinUrl(), width: 72, height: 72 });
  document.getElementById("mini-join-code").textContent = gameCode;
}

function listenForPlayers() {
  gameRef.child("players").on("value", (snap) => {
    const players = snap.val() || {};
    const byTeam = {};
    teams.forEach((t) => (byTeam[t.id] = []));
    Object.values(players).forEach((p) => {
      if (byTeam[p.teamId]) byTeam[p.teamId].push(p.name);
    });

    lobbyTeamsEl.innerHTML = "";
    teams.forEach((t) => {
      const box = document.createElement("div");
      box.className = "lobby-team-box";
      box.style.borderColor = t.color;
      const names = byTeam[t.id];
      box.innerHTML = `<strong style="color:${t.color}">${t.name}</strong> (${names.length})<br>${names.join(", ") || "<em>nog niemand</em>"}`;
      lobbyTeamsEl.appendChild(box);
    });
  });
}

startQuizBtn.addEventListener("click", async () => {
  gameRef.child("players").off();
  lobbyScreen.classList.add("hidden");
  raceScreen.classList.remove("hidden");

  renderTrack();
  renderMiniJoin();
  currentQuestionIndex = 0;
  await gameRef.update({ status: "question", currentQuestionIndex: 0 });
  showQuestion(currentQuestionIndex);
});

const LANE_HEIGHT = 50;
const TRACK_TOP_PADDING = 80; // the title now lives above the track entirely, this only needs room for the spectators strip
const TRACK_BOTTOM_PADDING = 20;
const MAX_TEAMS = 10; // track height is always based on this, so it never resizes as questions/reveal alternate

function syncBackdropWidth() {
  const wrapperLeft = trackWrapper.getBoundingClientRect().left;
  raceBackdrop.style.left = `${-wrapperLeft}px`;
  raceBackdrop.style.width = `${window.innerWidth}px`;
}

function renderTrack() {
  track.innerHTML = "";
  raceBackdrop.innerHTML = "";
  const laneHeight = LANE_HEIGHT;
  syncBackdropWidth();
  syncTrackHeight();

  const spectators = document.createElement("div");
  spectators.id = "track-spectators";
  spectators.style.height = `${TRACK_TOP_PADDING - 20}px`;
  raceBackdrop.appendChild(spectators);

  const ground = document.createElement("div");
  ground.id = "track-ground";
  ground.style.top = `${TRACK_TOP_PADDING - 20}px`;
  raceBackdrop.appendChild(ground);

  const topLine = document.createElement("div");
  topLine.className = "track-top-line";
  topLine.style.top = `${TRACK_TOP_PADDING - 20}px`;
  raceBackdrop.appendChild(topLine);

  const startLine = document.createElement("div");
  startLine.className = "track-vline";
  startLine.id = "track-start-line";
  track.appendChild(startLine);

  const startLabel = document.createElement("div");
  startLabel.className = "track-vline-label";
  startLabel.id = "track-start-label";
  startLabel.textContent = "START";
  track.appendChild(startLabel);

  const finishLine = document.createElement("div");
  finishLine.className = "track-vline";
  finishLine.id = "track-finish-line";
  track.appendChild(finishLine);

  const finishLabel = document.createElement("div");
  finishLabel.className = "track-vline-label";
  finishLabel.id = "track-finish-label";
  finishLabel.textContent = "FINISH";
  track.appendChild(finishLabel);

  teams.forEach((team, i) => {
    const lane = document.createElement("div");
    lane.className = "lane";
    lane.style.top = `${TRACK_TOP_PADDING + i * laneHeight}px`;
    lane.style.height = `${laneHeight}px`;

    const camel = document.createElement("div");
    camel.className = "camel";
    camel.id = `camel-${team.id}`;
    camel.style.setProperty("--bob-delay", `${(Math.random() * 0.9).toFixed(2)}s`);
    camel.style.setProperty("--bob-duration", `${(0.8 + Math.random() * 0.4).toFixed(2)}s`);

    const badge = document.createElement("div");
    badge.className = "camel-badge";
    badge.style.background = team.color;
    badge.innerHTML = "<span>🐫</span>";

    const label = document.createElement("div");
    label.className = "camel-label";
    label.textContent = team.name;

    camel.appendChild(badge);
    camel.appendChild(label);
    lane.appendChild(camel);
    track.appendChild(lane);
  });

  updateCamelPositions();
}

const TRACK_SIDE_MARGIN = 24; // keeps camels from starting/finishing flush against the track's own edges
const CAMEL_HALF_WIDTH = 23; // half of .camel-badge's 46px, so the badge centers on the start/finish line instead of its back edge touching it

function updateCamelPositions() {
  const totalQuestions = questionsData.questions.length;
  const travelWidth = track.clientWidth - 80 - TRACK_SIDE_MARGIN;
  const startX = TRACK_SIDE_MARGIN;
  const finishX = TRACK_SIDE_MARGIN + travelWidth;

  const startLine = document.getElementById("track-start-line");
  const finishLine = document.getElementById("track-finish-line");
  const startLabel = document.getElementById("track-start-label");
  const finishLabel = document.getElementById("track-finish-label");
  if (startLine) startLine.style.left = `${startX}px`;
  if (finishLine) finishLine.style.left = `${finishX}px`;
  if (startLabel) startLabel.style.left = `${startX}px`;
  if (finishLabel) finishLabel.style.left = `${finishX}px`;

  teams.forEach((team) => {
    const camel = document.getElementById(`camel-${team.id}`);
    const progress = team.position / totalQuestions;
    // Center the camel badge on its start/finish x, rather than anchoring its
    // back edge there — otherwise the whole camel looks like it's already past
    // the start line at 0%, and lands a full badge-width beyond the finish line at 100%.
    camel.style.left = `${startX - CAMEL_HALF_WIDTH + progress * travelWidth}px`;
    camel.classList.toggle("label-flip", progress > 0.5);
  });
}

function renderQuestionPanel(index) {
  const q = questionsData.questions[index];
  questionText.textContent = q.question;
  optionsList.innerHTML = "";
  q.options.forEach((opt) => {
    const li = document.createElement("li");
    li.textContent = opt;
    optionsList.appendChild(li);
  });
}

function showQuestion(index) {
  renderQuestionPanel(index);

  questionPanel.classList.remove("hidden");
  revealPanel.classList.add("hidden");
  timerBar.style.width = "100%";
  answersProgress.textContent = "";

  gameRef.child(`answers/${index}`).on("value", (snap) => {
    const count = snap.val() ? Object.keys(snap.val()).length : 0;
    answersProgress.textContent = `${count} antwoord(en) binnen`;
  });

  audio.currentTime = 0;
  audio.play();

  cancelAnimationFrame(rafId);
  const tick = () => {
    if (!audio.duration || audio.paused) return;
    const remaining = Math.max(0, 1 - audio.currentTime / audio.duration);
    timerBar.style.width = `${remaining * 100}%`;
    rafId = requestAnimationFrame(tick);
  };
  rafId = requestAnimationFrame(tick);

  audio.onended = () => {
    timerBar.style.width = "0%";
    gameRef.child(`answers/${index}`).off();
    tallyAndReveal(index);
  };
}

async function computeQuestionTally(index) {
  const q = questionsData.questions[index];
  const snap = await gameRef.child(`answers/${index}`).once("value");
  const answers = snap.val() || {};

  const playersSnap = await gameRef.child("players").once("value");
  const players = playersSnap.val() || {};

  const tally = {};
  teams.forEach((t) => (tally[t.id] = { correct: 0, total: 0 }));

  Object.entries(answers).forEach(([playerId, ans]) => {
    const player = players[playerId];
    if (!player || !tally[player.teamId]) return;
    tally[player.teamId].total++;
    if (ans.choice === q.correctIndex) tally[player.teamId].correct++;
  });

  return { q, tally };
}

function gcd(a, b) {
  return b === 0 ? a : gcd(b, a % b);
}

// Simplifies e.g. 6/9 to "2/3", for the proportional-mode advance label.
function simplifyFraction(numerator, denominator) {
  const divisor = gcd(numerator, denominator) || 1;
  return `${numerator / divisor}/${denominator / divisor}`;
}

// How far a team's camel advances on this tally, and the label to show for
// it, per the active scoring mode. Shared by renderRevealPanel (display) and
// tallyAndReveal (actually moving the camel), so the two can never disagree.
function computeTeamStep(t) {
  if (t.total === 0) return { step: 0, label: "" };
  if (scoringMode === "proportional") {
    const step = t.correct / t.total;
    return { step, label: step > 0 ? `${simplifyFraction(t.correct, t.total)} stap vooruit!` : "" };
  }
  const majorityCorrect = t.correct / t.total > 0.5;
  return { step: majorityCorrect ? 1 : 0, label: majorityCorrect ? "stap vooruit!" : "" };
}

function renderRevealPanel(q, tally) {
  const rows = teams.map((team) => {
    const t = tally[team.id];
    const { step, label } = computeTeamStep(t);
    return `
      <li class="reveal-team-row ${step > 0 ? "correct" : ""}">
        <span class="reveal-team-dot" style="background:${team.color}"></span>
        <span class="reveal-team-name">${team.name}</span>
        <span class="reveal-team-tally">${t.correct}/${t.total} goed</span>
        ${label ? `<span class="reveal-team-advance">${label}</span>` : ""}
      </li>
    `;
  });

  questionPanel.classList.add("hidden");
  revealPanel.classList.remove("hidden");
  revealSummary.innerHTML = `
    <p class="reveal-answer">Juist antwoord: <strong>${q.options[q.correctIndex]}</strong></p>
    <ul class="reveal-team-list">${rows.join("")}</ul>
  `;
}

// Fixed height for exactly MAX_TEAMS lanes -- deliberately NOT based on the
// sidebar's own height, so the track never resizes between the question and
// reveal panels. If the reveal panel ends up taller than the track, it's
// allowed to visually extend past the bottom of the track/backdrop.
function syncTrackHeight() {
  const height = MAX_TEAMS * LANE_HEIGHT + TRACK_TOP_PADDING + TRACK_BOTTOM_PADDING;
  track.style.height = `${height}px`;
  raceBackdrop.style.height = `${height}px`;
}

async function tallyAndReveal(index) {
  const { q, tally } = await computeQuestionTally(index);
  const updates = {};

  teams.forEach((team) => {
    const t = tally[team.id];
    const { step } = computeTeamStep(t);
    if (step > 0) {
      const rawPosition = Math.min(team.position + step, questionsData.questions.length);
      team.position = Math.round(rawPosition * 1000) / 1000; // avoid float drift accumulating over many questions
      updates[`teams/${team.id}/position`] = team.position;
      const camel = document.getElementById(`camel-${team.id}`);
      camel.classList.add("moving");
      setTimeout(() => camel.classList.remove("moving"), 1400);
    }
  });

  await gameRef.update({ ...updates, status: "reveal" });
  updateCamelPositions();
  renderRevealPanel(q, tally);
}

nextBtn.addEventListener("click", async () => {
  currentQuestionIndex++;
  const totalQuestions = questionsData.questions.length;

  if (currentQuestionIndex >= totalQuestions) {
    await gameRef.update({ status: "finished" });
    showWinnerScreen();
  } else {
    await gameRef.update({ status: "question", currentQuestionIndex });
    showQuestion(currentQuestionIndex);
  }
});

function showWinnerScreen() {
  raceScreen.classList.add("hidden");
  winnerScreen.classList.remove("hidden");

  // Round before comparing -- in proportional mode positions are sums of
  // fractions (e.g. 2/3 + 1/3) and can differ by a tiny float error even
  // when a tie is really intended.
  const rounded = (n) => Math.round(n * 1000) / 1000;
  const maxPosition = Math.max(...teams.map((t) => rounded(t.position)));
  const winners = teams.filter((t) => rounded(t.position) === maxPosition);

  winnerName.textContent =
    winners.length > 1
      ? `${winners.map((w) => w.name).join(" & ")} winnen samen de kamelenrace!`
      : `${winners[0].name} wint de kamelenrace!`;
}

restartBtn.addEventListener("click", () => {
  if (gameRef) gameRef.off();
  history.replaceState(null, "", location.pathname);
  winnerScreen.classList.add("hidden");
  setupScreen.classList.remove("hidden");
});

window.addEventListener("resize", () => {
  if (!raceScreen.classList.contains("hidden") && questionsData) {
    syncBackdropWidth();
    updateCamelPositions();
  }
});

async function resumeGame(code) {
  const snap = await db.ref(`games/${code}`).once("value");
  const data = snap.val();
  if (!data) {
    history.replaceState(null, "", location.pathname);
    return;
  }

  gameCode = code;
  gameRef = db.ref(`games/${gameCode}`);
  teams = Object.entries(data.teams || {}).map(([id, t]) => ({
    id,
    name: t.name,
    color: t.color,
    position: t.position,
  }));
  scoringMode = data.scoringMode || "majority"; // older games have no scoringMode saved; default to the original behavior

  if (!questionsData) await loadQuestions();
  currentQuestionIndex = data.currentQuestionIndex || 0;

  setupScreen.classList.add("hidden");

  if (data.status === "lobby") {
    showLobbyScreen();
  } else if (data.status === "question") {
    raceScreen.classList.remove("hidden");
    renderTrack();
    renderMiniJoin();
    showQuestion(currentQuestionIndex);
  } else if (data.status === "reveal") {
    raceScreen.classList.remove("hidden");
    renderTrack();
    renderMiniJoin();
    renderQuestionPanel(currentQuestionIndex);
    timerBar.style.width = "0%";
    const { q, tally } = await computeQuestionTally(currentQuestionIndex);
    const answerCount = Object.values(tally).reduce((sum, t) => sum + t.total, 0);
    answersProgress.textContent = `${answerCount} antwoord(en) binnen`;
    renderRevealPanel(q, tally);
  } else if (data.status === "finished") {
    showWinnerScreen();
  }
}

const resumeCode = new URLSearchParams(location.search).get("game");
if (resumeCode) resumeGame(resumeCode.toUpperCase());
