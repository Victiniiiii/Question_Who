const socket = new WebSocket(`wss://${window.location.host}`);
let myUsername = null;
let currentPhase = "waiting";

const usernameScreen = document.getElementById("usernameScreen");
const usernameInput = document.getElementById("usernameInput");
const submitUsername = document.getElementById("usernameSubmit");
const gameContainer = document.getElementById("gameContainer");
const question = document.getElementById("question");
const answer = document.getElementById("answer");
const submitAnswer = document.getElementById("submitAnswer");
const playerList = document.getElementById("playerList");
const timer = document.getElementById("timer");
const gamePhase = document.getElementById("gamePhase");
const questionPhase = document.getElementById("questionPhase");
const votingPhase = document.getElementById("votingPhase");
const votingOptions = document.getElementById("votingOptions");
const resultsPhase = document.getElementById("resultsPhase");
const voteResults = document.getElementById("voteResults");
const impostorReveal = document.getElementById("impostorReveal");
const gameOutcome = document.getElementById("gameOutcome");

submitUsername.addEventListener("click", () => {
	const username = usernameInput.value.trim();
	if (username.length > 0 && username.length < 15) {
		myUsername = username;
		socket.send(
			JSON.stringify({
				type: "set_username",
				username,
				profileImage: currentPfpIndex,
				profileDesc: descriptions[currentPfpIndex - 1],
			})
		);

		usernameScreen.classList.add("hidden");
		gameContainer.classList.remove("hidden");
	} else {
        alert("Username not found or too short or too long (Limit = 15).");
    }
});

submitAnswer.addEventListener("click", () => {
	const answerValue = answer.value.trim();
	socket.send(JSON.stringify({ type: "submit_answer", answer: answerValue }));
	submitAnswer.disabled = true;
	answer.disabled = true;
});

socket.onopen = () => {
	console.log("Connected to game server!");
};

socket.onmessage = (event) => {
	const data = JSON.parse(event.data);
	console.log("Received from server:", data);

	if (data.type === "update_player_list") {
		playerList.innerHTML = "";
		data.playerList.forEach((player) => {
			const listItem = document.createElement("p");

			if (player.profileImage) {
				const img = document.createElement("img");
				img.src = `pfp${player.profileImage}.png`;
				img.alt = player.profileDesc || `Profile ${player.profileImage}`;
				img.classList.add("player-pfp");
				listItem.appendChild(img);
			}

			const playerInfo = document.createElement("div");
			playerInfo.classList.add("flexcolumn");

			const usernameSpan = document.createElement("span");
			usernameSpan.textContent = player.username;
			if (player.answered) {
				usernameSpan.textContent += " ✓";
			}
			playerInfo.appendChild(usernameSpan);

			const pointsSpan = document.createElement("span");
			pointsSpan.textContent = `${player.points} points`;
			pointsSpan.classList.add("player-points");
			playerInfo.appendChild(pointsSpan);

			listItem.appendChild(playerInfo);
			playerList.appendChild(listItem);
		});
	} else if (data.type === "question") {
		updatePhase("question");
		question.textContent = `Your question: ${data.question}`;
		answer.disabled = false;
		submitAnswer.disabled = false;
		answer.value = "";
	} else if (data.type === "start_voting") {
		updatePhase("voting");
		votingOptions.innerHTML = "";

		const revealQuestionDiv = document.getElementById("revealQuestion");
		if (revealQuestionDiv) {
			revealQuestionDiv.textContent = `The Question was: ${data.commonQuestion}`;
			revealQuestionDiv.classList.add("revealed-question");
		}

		data.players.forEach((player) => {
			if (player.username !== myUsername) {
				const voteContainer = document.createElement("div");
				voteContainer.classList.add("vote-option");

				if (player.profileImage) {
					const img = document.createElement("img");
					img.src = `pfp${player.profileImage}.png`;
					img.alt = player.profileDesc || `Profile ${player.profileImage}`;
					img.classList.add("vote-pfp");
					voteContainer.appendChild(img);
				}

				const voteInfo = document.createElement("div");
				voteInfo.classList.add("flexcolumn");

				const voteButton = document.createElement("button");
				voteButton.textContent = `${player.username}: ${player.answer || "[No answer]"}`;
				voteButton.classList.add("vote-button");
				voteButton.addEventListener("click", () => {
					socket.send(
						JSON.stringify({
							type: "submit_vote",
							vote: player.username,
						})
					);
					document.querySelectorAll(".vote-button").forEach((btn) => {
						btn.disabled = true;
					});
				});
				voteInfo.appendChild(voteButton);
				voteContainer.appendChild(voteInfo);
				votingOptions.appendChild(voteContainer);
			}
		});
	} else if (data.type === "time_remaining") {
		timer.textContent = `Time remaining: ${data.remainingTime} seconds`;
		if (data.remainingTime <= 10) {
			timer.classList.add("timerwarning");
		} else {
			timer.classList.remove("timerwarning");
		}
	} else if (data.type === "game_results") {
		updatePhase("results");
		voteResults.innerHTML = "";

		if (gameOutcome) {
			if (data.isTie) {
				gameOutcome.textContent = "It's a tie! The impostor earns 1 point.";
			} else if (data.impostorWon) {
				gameOutcome.textContent = "The impostor wasn't caught and earns 3 points!";
			} else {
				gameOutcome.textContent = "The impostor was caught! Everyone else earns 1 point.";
			}
			gameOutcome.classList.remove("hidden");
		}

		data.voteTally.forEach((result) => {
			const resultItem = document.createElement("div");
			resultItem.classList.add("result-item");

			if (result.profileImage) {
				const img = document.createElement("img");
				img.src = `pfp${result.profileImage}.png`;
				img.alt = result.profileDesc || `Profile ${result.profileImage}`;
				img.classList.add("result-pfp");
				resultItem.appendChild(img);
			}

			const resultInfo = document.createElement("div");
			resultInfo.classList.add("flexcolumn");

			const resultText = document.createElement("p");
			resultText.textContent = `${result.username}: ${result.votes} votes`;

			resultInfo.appendChild(resultText);
			resultItem.appendChild(resultInfo);
			voteResults.appendChild(resultItem);
		});

		impostorReveal.textContent = `The impostor was: ${data.impostor}`;
	}
};

function updatePhase(newPhase) {
	currentPhase = newPhase;

	questionPhase.classList.add("hidden");
	votingPhase.classList.add("hidden");
	resultsPhase.classList.add("hidden");

	if (gameOutcome) {
		gameOutcome.classList.add("hidden");
	}

	if (newPhase === "question") {
		gamePhase.textContent = "Answer the question!";
		questionPhase.classList.remove("hidden");
	} else if (newPhase === "voting") {
		gamePhase.textContent = "Vote for the impostor!";
		votingPhase.classList.remove("hidden");
	} else if (newPhase === "results") {
		gamePhase.textContent = "Results Phase";
		resultsPhase.classList.remove("hidden");
	} else {
		gamePhase.textContent = "Waiting for players...";
	}
}

let currentPfpIndex = 1;

const descriptions = ["Kedi", "Tahta bloğu", "Tarator", "Ağaç", "Havalı H Harfi", "Kolonya", "Uganda", "👌", "Sasalı", "😉", "😔", "Navy Seal", "Kağıt Uçak", "Sandviç", "İzban", "Erasmus", "Veri Tabanı"];

const pfpCount = descriptions.length;
const pfpImage = document.getElementById("pfp");
const description = document.getElementById("description");

function updatePfp() {
	pfpImage.src = `pfp${currentPfpIndex}.png`;
	pfpImage.alt = `pfp${currentPfpIndex}`;
	description.textContent = descriptions[currentPfpIndex - 1];
}

document.getElementById("left-arrow").addEventListener("click", () => {
	currentPfpIndex = currentPfpIndex === 1 ? pfpCount : currentPfpIndex - 1;
	updatePfp();
});

document.getElementById("right-arrow").addEventListener("click", () => {
	currentPfpIndex = currentPfpIndex === pfpCount ? 1 : currentPfpIndex + 1;
	updatePfp();
});

updatePfp();

function handleKickEvent(event) {
	const data = JSON.parse(event.data);

	if (data.type === "kicked") {
		alert(data.message);
		window.location.reload();
	}
}

socket.addEventListener("message", handleKickEvent);

function startGame(commonQuestion, impostorQuestion) {
	socket.send(
		JSON.stringify({
			type: "admin_command",
			command: "startGame",
			commonQuestion: commonQuestion,
			impostorQuestion: impostorQuestion,
		})
	);
	console.log("Sent start game command!");
}

function kickPlayer(username) {
	socket.send(
		JSON.stringify({
			type: "admin_command",
			command: "kickPlayer",
			username: username,
		})
	);
	console.log(`Sent kick command for player: ${username}`);
}

console.log(`startGame("Question 1","Question 2") --> Starts the game with these two questions`);
console.log(`kickPlayer("username") --> Kicks the player with that username`);

window.startGame = startGame;
window.kickPlayer = kickPlayer;
