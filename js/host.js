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

const setupScreen = document.getElementById("setup-screen");
const lobbyScreen = document.getElementById("lobby-screen");
const raceScreen = document.getElementById("race-screen");
const winnerScreen = document.getElementById("winner-screen");

const teamCountSelect = document.getElementById("team-count");
const teamNameInputs = document.getElementById("team-name-inputs");
const createGameBtn = document.getElementById("create-game-btn");

const gameCodeDisplay = document.getElementById("game-code-display");
const joinUrlDisplay = document.getElementById("join-url-display");
const qrCodeEl = document.getElementById("qr-code");
const lobbyTeamsEl = document.getElementById("lobby-teams");
const startQuizBtn = document.getElementById("start-quiz-btn");

const track = document.getElementById("track");
const questionText = document.getElementById("question-text");
const optionsList = document.getElementById("options-list");
const timerBar = document.getElementById("timer-bar");
const answersProgress = document.getElementById("answers-progress");
const revealPanel = document.getElementById("reveal-panel");
const revealSummary = document.getElementById("reveal-summary");
const nextBtn = document.getElementById("next-btn");
const audio = document.getElementById("race-audio");

const winnerCamel = document.getElementById("winner-camel");
const winnerName = document.getElementById("winner-name");
const restartBtn = document.getElementById("restart-btn");

function renderTeamNameInputs() {
  const count = parseInt(teamCountSelect.value, 10);
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

    row.appendChild(dot);
    row.appendChild(input);
    teamNameInputs.appendChild(row);
  }
}

teamCountSelect.addEventListener("change", renderTeamNameInputs);
renderTeamNameInputs();

async function loadQuestions() {
  const res = await fetch("data/questions.json");
  questionsData = await res.json();
}

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
    createdAt: firebase.database.ServerValue.TIMESTAMP,
  });

  setupScreen.classList.add("hidden");
  lobbyScreen.classList.remove("hidden");

  gameCodeDisplay.textContent = gameCode;
  const joinUrl = `${location.origin}${location.pathname.replace(/index\.html$/, "")}player.html?game=${gameCode}`;
  joinUrlDisplay.textContent = joinUrl;
  qrCodeEl.innerHTML = "";
  new QRCode(qrCodeEl, { text: joinUrl, width: 220, height: 220 });

  listenForPlayers();
});

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
  currentQuestionIndex = 0;
  await gameRef.update({ status: "question", currentQuestionIndex: 0 });
  showQuestion(currentQuestionIndex);
});

const LANE_HEIGHT = 50;
const TRACK_PADDING = 20;

function renderTrack() {
  track.innerHTML = "";
  track.style.height = `${teams.length * LANE_HEIGHT + TRACK_PADDING * 2}px`;
  const laneHeight = LANE_HEIGHT;

  teams.forEach((team, i) => {
    const lane = document.createElement("div");
    lane.className = "lane";
    lane.style.top = `${TRACK_PADDING + i * laneHeight}px`;
    lane.style.height = `${laneHeight}px`;

    const camel = document.createElement("div");
    camel.className = "camel";
    camel.id = `camel-${team.id}`;

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

function updateCamelPositions() {
  const totalQuestions = questionsData.questions.length;
  const trackWidth = track.clientWidth - 80;

  teams.forEach((team) => {
    const camel = document.getElementById(`camel-${team.id}`);
    const progress = team.position / totalQuestions;
    camel.style.left = `${progress * trackWidth}px`;
  });
}

function showQuestion(index) {
  const q = questionsData.questions[index];
  questionText.textContent = q.question;
  optionsList.innerHTML = "";
  q.options.forEach((opt) => {
    const li = document.createElement("li");
    li.textContent = opt;
    optionsList.appendChild(li);
  });

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

async function tallyAndReveal(index) {
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

  const summaryParts = [];
  const updates = {};

  teams.forEach((team) => {
    const t = tally[team.id];
    const majorityCorrect = t.total > 0 && t.correct / t.total > 0.5;
    if (majorityCorrect) {
      team.position = Math.min(team.position + 1, questionsData.questions.length);
      updates[`teams/${team.id}/position`] = team.position;
      const camel = document.getElementById(`camel-${team.id}`);
      camel.classList.add("moving");
      setTimeout(() => camel.classList.remove("moving"), 1400);
    }
    summaryParts.push(`${team.name}: ${t.correct}/${t.total} goed${majorityCorrect ? " → stap vooruit!" : ""}`);
  });

  await gameRef.update({ ...updates, status: "reveal" });
  updateCamelPositions();

  revealPanel.classList.remove("hidden");
  revealSummary.innerHTML = `Juist antwoord: <strong>${q.options[q.correctIndex]}</strong><br>` + summaryParts.join("<br>");
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

  const winner = teams.reduce((best, t) => (t.position > best.position ? t : best), teams[0]);
  winnerCamel.textContent = "🐫";
  winnerCamel.style.color = winner.color;
  winnerName.textContent = `${winner.name} wint de kamelenrace!`;
}

restartBtn.addEventListener("click", () => {
  if (gameRef) gameRef.off();
  winnerScreen.classList.add("hidden");
  setupScreen.classList.remove("hidden");
});

window.addEventListener("resize", () => {
  if (!raceScreen.classList.contains("hidden") && questionsData) updateCamelPositions();
});
