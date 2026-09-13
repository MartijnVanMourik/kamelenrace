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

const finishedWinner = document.getElementById("finished-winner");

const CONNECTION_TIMEOUT_MS = 6000;
const CONNECTION_TIMEOUT_MSG =
  "Kan geen verbinding maken. Mogelijk zit de kamer vol of is er een netwerkprobleem — probeer het zo opnieuw.";

function withTimeout(promise, ms = CONNECTION_TIMEOUT_MS) {
  return Promise.race([
    promise,
    new Promise((_, reject) => setTimeout(() => reject(new Error("connection-timeout")), ms)),
  ]);
}

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

  const placeholder = document.createElement("option");
  placeholder.value = "";
  placeholder.textContent = "Kies een team";
  placeholder.disabled = true;
  placeholder.selected = true;
  teamSelect.appendChild(placeholder);

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

let lastCheckedCode = null;

async function tryLoadTeams() {
  const code = gameCodeInput.value.trim().toUpperCase();
  if (code.length !== 4 || code === lastCheckedCode) return;
  lastCheckedCode = code;

  let statusSnap;
  try {
    statusSnap = await withTimeout(db.ref(`games/${code}/status`).once("value"));
  } catch {
    lastCheckedCode = null; // allow retrying this code
    teamSelect.innerHTML = "";
    joinError.textContent = CONNECTION_TIMEOUT_MSG;
    joinError.classList.remove("hidden");
    return;
  }
  if (gameCodeInput.value.trim().toUpperCase() !== code) return; // code changed while awaiting

  if (statusSnap.val() === null) {
    teamSelect.innerHTML = "";
    joinError.textContent = "Deze spelcode bestaat niet.";
    joinError.classList.remove("hidden");
    return;
  }
  if (statusSnap.val() === "finished") {
    teamSelect.innerHTML = "";
    joinError.textContent = "Deze quiz is afgelopen.";
    joinError.classList.remove("hidden");
    return;
  }

  const teams = await loadTeamsForCode(code);
  if (teams) {
    currentTeams = teams;
    populateTeamSelect(teams);
    joinError.classList.add("hidden");
  }
}

gameCodeInput.addEventListener("input", () => {
  gameCodeInput.value = gameCodeInput.value.toUpperCase();
  tryLoadTeams();
});

function loadStoredSession() {
  try {
    return JSON.parse(localStorage.getItem("kamelenrace_player"));
  } catch {
    return null;
  }
}

async function tryAutoRejoin() {
  const stored = loadStoredSession();
  if (!stored) return false;
  if (prefillCode && prefillCode.toUpperCase() !== stored.gameCode) return false;

  try {
    const statusSnap = await withTimeout(db.ref(`games/${stored.gameCode}/status`).once("value"));
    if (statusSnap.val() === null) {
      localStorage.removeItem("kamelenrace_player");
      return false;
    }

    gameCode = stored.gameCode;
    playerId = stored.playerId;
    gameRef = db.ref(`games/${gameCode}`);

    const teamsSnap = await withTimeout(gameRef.child("teams").once("value"));
    currentTeams = teamsSnap.val() || {};
    const team = currentTeams[stored.teamId];

    waitingName.textContent = stored.name;
    waitingTeam.textContent = team ? team.name : "?";

    await loadQuestions();
    showScreen(waitingScreen);
    listenForGameUpdates();
    return true;
  } catch {
    joinError.textContent = CONNECTION_TIMEOUT_MSG;
    joinError.classList.remove("hidden");
    return false;
  }
}

(async () => {
  const rejoined = await tryAutoRejoin();
  if (!rejoined && prefillCode) tryLoadTeams();
})();

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

  joinBtn.disabled = true;
  joinError.classList.add("hidden");

  try {
    const statusSnap = await withTimeout(db.ref(`games/${code}/status`).once("value"));
    if (statusSnap.val() === null) {
      joinError.textContent = "Deze spelcode bestaat niet.";
      joinError.classList.remove("hidden");
      return;
    }
    if (statusSnap.val() === "finished") {
      joinError.textContent = "Deze quiz is afgelopen.";
      joinError.classList.remove("hidden");
      return;
    }
    if (!teamSelect.value) {
      joinError.textContent = "Kies eerst een team.";
      joinError.classList.remove("hidden");
      return;
    }

    const teamId = teamSelect.value;
    gameCode = code;
    gameRef = db.ref(`games/${gameCode}`);

    const newPlayerRef = gameRef.child("players").push();
    playerId = newPlayerRef.key;
    await withTimeout(newPlayerRef.set({ name, teamId }));

    localStorage.setItem("kamelenrace_player", JSON.stringify({ gameCode, playerId, teamId, name }));

    waitingName.textContent = name;
    waitingTeam.textContent = currentTeams[teamId].name;

    await loadQuestions();
    showScreen(waitingScreen);
    listenForGameUpdates();
  } catch {
    joinError.textContent = CONNECTION_TIMEOUT_MSG;
    joinError.classList.remove("hidden");
  } finally {
    joinBtn.disabled = false;
  }
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
  if (teamList.length === 0) return;

  const maxPosition = Math.max(...teamList.map((t) => t.position));
  const winners = teamList.filter((t) => t.position === maxPosition);

  finishedWinner.textContent =
    winners.length > 1
      ? `${winners.map((w) => w.name).join(" & ")} winnen samen de kamelenrace!`
      : `${winners[0].name} wint de kamelenrace!`;
  showScreen(finishedScreen);
}
