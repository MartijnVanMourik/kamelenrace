let questionsData = null;
let gameCode = null;
let gameRef = null;
let playerId = null;
let currentTeams = {};
let lastSeenQuestionIndex = -1;
let hasAnsweredThisQuestion = false;

const joinScreen = document.getElementById("join-screen");
const waitingScreen = document.getElementById("waiting-screen");
const questionScreen = document.getElementById("question-screen");
const revealScreen = document.getElementById("reveal-screen");
const finishedScreen = document.getElementById("finished-screen");

const gameCodeInput = document.getElementById("game-code-input");
const playerNameInput = document.getElementById("player-name-input");
const teamSelect = document.getElementById("team-select");
const joinError = document.getElementById("join-error");
const joinBtn = document.getElementById("join-btn");

const waitingName = document.getElementById("waiting-name");
const waitingTeam = document.getElementById("waiting-team");

const playerQuestionText = document.getElementById("player-question-text");
const playerOptions = document.getElementById("player-options");
const answeredMsg = document.getElementById("answered-msg");

const revealResult = document.getElementById("reveal-result");
const revealCorrectAnswer = document.getElementById("reveal-correct-answer");

const finishedCamel = document.getElementById("finished-camel");
const finishedWinner = document.getElementById("finished-winner");

function showScreen(el) {
  [joinScreen, waitingScreen, questionScreen, revealScreen, finishedScreen].forEach((s) =>
    s.classList.add("hidden")
  );
  el.classList.remove("hidden");
}

async function loadQuestions() {
  const res = await fetch("data/questions.json");
  questionsData = await res.json();
}

async function loadTeamsForCode(code) {
  const snap = await db.ref(`games/${code}/teams`).once("value");
  return snap.val();
}

function populateTeamSelect(teams) {
  teamSelect.innerHTML = "";
  Object.entries(teams).forEach(([id, t]) => {
    const opt = document.createElement("option");
    opt.value = id;
    opt.textContent = t.name;
    teamSelect.appendChild(opt);
  });
}

const params = new URLSearchParams(location.search);
const prefillCode = params.get("game");
if (prefillCode) gameCodeInput.value = prefillCode.toUpperCase();

let teamsLoadedForCode = null;
async function tryLoadTeams() {
  const code = gameCodeInput.value.trim().toUpperCase();
  if (code.length !== 4 || code === teamsLoadedForCode) return;
  const teams = await loadTeamsForCode(code);
  if (teams) {
    currentTeams = teams;
    populateTeamSelect(teams);
    teamsLoadedForCode = code;
    joinError.classList.add("hidden");
  }
}

gameCodeInput.addEventListener("input", () => {
  gameCodeInput.value = gameCodeInput.value.toUpperCase();
  tryLoadTeams();
});

if (prefillCode) tryLoadTeams();

joinBtn.addEventListener("click", async () => {
  const code = gameCodeInput.value.trim().toUpperCase();
  const name = playerNameInput.value.trim();

  if (code.length !== 4) {
    joinError.textContent = "Vul een geldige 4-letter spelcode in.";
    joinError.classList.remove("hidden");
    return;
  }
  if (!name) {
    joinError.textContent = "Vul je naam in.";
    joinError.classList.remove("hidden");
    return;
  }

  const statusSnap = await db.ref(`games/${code}/status`).once("value");
  if (statusSnap.val() === null) {
    joinError.textContent = "Deze spelcode bestaat niet.";
    joinError.classList.remove("hidden");
    return;
  }
  if (statusSnap.val() !== "lobby") {
    joinError.textContent = "Deze quiz is al gestart.";
    joinError.classList.remove("hidden");
    return;
  }

  const teamId = teamSelect.value;
  gameCode = code;
  gameRef = db.ref(`games/${gameCode}`);

  const newPlayerRef = gameRef.child("players").push();
  playerId = newPlayerRef.key;
  await newPlayerRef.set({ name, teamId });

  localStorage.setItem("kamelenrace_player", JSON.stringify({ gameCode, playerId, teamId, name }));

  waitingName.textContent = name;
  waitingTeam.textContent = currentTeams[teamId].name;

  await loadQuestions();
  showScreen(waitingScreen);
  listenForGameUpdates();
});

function listenForGameUpdates() {
  gameRef.on("value", (snap) => {
    const game = snap.val();
    if (!game) return;

    if (game.status === "lobby") {
      showScreen(waitingScreen);
    } else if (game.status === "question") {
      if (game.currentQuestionIndex !== lastSeenQuestionIndex) {
        lastSeenQuestionIndex = game.currentQuestionIndex;
        hasAnsweredThisQuestion = false;
        showQuestion(game.currentQuestionIndex);
      }
    } else if (game.status === "reveal") {
      showReveal(game.currentQuestionIndex);
    } else if (game.status === "finished") {
      showFinished(game.teams);
    }
  });
}

function showQuestion(index) {
  const q = questionsData.questions[index];
  playerQuestionText.textContent = q.question;
  playerOptions.innerHTML = "";
  answeredMsg.classList.add("hidden");

  q.options.forEach((opt, i) => {
    const btn = document.createElement("button");
    btn.className = "player-option-btn";
    btn.textContent = opt;
    btn.addEventListener("click", () => submitAnswer(index, i, q.correctIndex));
    playerOptions.appendChild(btn);
  });

  showScreen(questionScreen);
}

async function submitAnswer(questionIndex, choice, correctIndex) {
  if (hasAnsweredThisQuestion) return;
  hasAnsweredThisQuestion = true;

  playerOptions.querySelectorAll("button").forEach((b) => (b.disabled = true));
  answeredMsg.classList.remove("hidden");

  await gameRef.child(`answers/${questionIndex}/${playerId}`).set({
    choice,
    correct: choice === correctIndex,
    ts: firebase.database.ServerValue.TIMESTAMP,
  });
}

async function showReveal(questionIndex) {
  const q = questionsData.questions[questionIndex];
  const snap = await gameRef.child(`answers/${questionIndex}/${playerId}`).once("value");
  const answer = snap.val();

  if (answer && answer.correct) {
    revealResult.textContent = "✅ Goed!";
  } else if (answer) {
    revealResult.textContent = "❌ Helaas!";
  } else {
    revealResult.textContent = "⏱️ Geen antwoord ingestuurd";
  }
  revealCorrectAnswer.textContent = `Juiste antwoord: ${q.options[q.correctIndex]}`;
  showScreen(revealScreen);
}

function showFinished(teams) {
  const teamList = Object.values(teams || {});
  const winner = teamList.reduce((best, t) => (t.position > best.position ? t : best), teamList[0] || { position: 0, name: "?" });
  finishedCamel.textContent = "🐫";
  finishedCamel.style.color = winner.color || "#333";
  finishedWinner.textContent = `${winner.name} wint de kamelenrace!`;
  showScreen(finishedScreen);
}
