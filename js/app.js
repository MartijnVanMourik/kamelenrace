const TEAM_COLORS = ["#e74c3c", "#3498db", "#2ecc71", "#f39c12", "#9b59b6", "#1abc9c"];

let questionsData = null;
let teams = [];
let currentQuestionIndex = 0;
let rafId = null;

const setupScreen = document.getElementById("setup-screen");
const raceScreen = document.getElementById("race-screen");
const winnerScreen = document.getElementById("winner-screen");

const teamCountSelect = document.getElementById("team-count");
const teamNameInputs = document.getElementById("team-name-inputs");
const startBtn = document.getElementById("start-btn");

const track = document.getElementById("track");
const questionText = document.getElementById("question-text");
const optionsList = document.getElementById("options-list");
const timerBar = document.getElementById("timer-bar");
const revealPanel = document.getElementById("reveal-panel");
const revealButtons = document.getElementById("reveal-buttons");
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

function buildTeams() {
  const inputs = teamNameInputs.querySelectorAll("input");
  teams = Array.from(inputs).map((input, i) => ({
    id: i,
    name: input.value.trim() || `Team ${i + 1}`,
    color: TEAM_COLORS[i],
    position: 0,
  }));
}

function renderTrack() {
  track.innerHTML = "";
  const laneHeight = 260 / teams.length;

  teams.forEach((team, i) => {
    const lane = document.createElement("div");
    lane.className = "lane";
    lane.style.top = `${i * laneHeight}px`;
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
  const trackWidth = track.clientWidth - 80; // leave room for finish flag + badge

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
    showRevealPanel();
  };
}

function showRevealPanel() {
  revealPanel.classList.remove("hidden");
  revealButtons.innerHTML = "";

  teams.forEach((team) => {
    const btn = document.createElement("button");
    btn.className = "reveal-toggle";
    btn.textContent = team.name;
    btn.dataset.teamId = team.id;
    btn.addEventListener("click", () => btn.classList.toggle("active"));
    revealButtons.appendChild(btn);
  });
}

function advanceCorrectTeams() {
  const activeIds = Array.from(revealButtons.querySelectorAll(".reveal-toggle.active"))
    .map((btn) => parseInt(btn.dataset.teamId, 10));

  const totalQuestions = questionsData.questions.length;

  activeIds.forEach((id) => {
    const team = teams.find((t) => t.id === id);
    team.position = Math.min(team.position + 1, totalQuestions);
    const camel = document.getElementById(`camel-${id}`);
    camel.classList.add("moving");
    setTimeout(() => camel.classList.remove("moving"), 1400);
  });

  updateCamelPositions();

  currentQuestionIndex++;
  if (currentQuestionIndex >= totalQuestions) {
    setTimeout(showWinnerScreen, 1600);
  } else {
    setTimeout(() => showQuestion(currentQuestionIndex), 1600);
  }
}

function showWinnerScreen() {
  raceScreen.classList.add("hidden");
  winnerScreen.classList.remove("hidden");

  const winner = teams.reduce((best, t) => (t.position > best.position ? t : best), teams[0]);
  winnerCamel.textContent = "🐫";
  winnerCamel.style.color = winner.color;
  winnerName.textContent = `${winner.name} wint de kamelenrace!`;
}

startBtn.addEventListener("click", async () => {
  if (!questionsData) await loadQuestions();
  buildTeams();
  currentQuestionIndex = 0;

  setupScreen.classList.add("hidden");
  raceScreen.classList.remove("hidden");

  renderTrack();
  showQuestion(currentQuestionIndex);
});

nextBtn.addEventListener("click", advanceCorrectTeams);

restartBtn.addEventListener("click", () => {
  winnerScreen.classList.add("hidden");
  setupScreen.classList.remove("hidden");
});

window.addEventListener("resize", () => {
  if (!raceScreen.classList.contains("hidden")) updateCamelPositions();
});
