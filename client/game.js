const socket = new WebSocket("ws://localhost:3000");
let myUsername = null;
let currentPhase = "waiting";

const usernameScreen = document.getElementById("usernameScreen");
const usernameInput = document.getElementById("usernameInput");
const submitUsername = document.getElementById("submitUsername");
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

submitUsername.addEventListener("click", () => {
	const username = usernameInput.value.trim();
	if (username) {
		myUsername = username;
		socket.send(JSON.stringify({ type: "set_username", username }));

		usernameScreen.classList.add("hidden");
		gameContainer.classList.remove("hidden");
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
			const listItem = document.createElement("li");
			listItem.textContent = player.username;
			if (player.answered) {
				listItem.textContent += " ✓";
			}
			playerList.appendChild(listItem);
		});
	} else if (data.type === "question") {
		updatePhase("question");
		question.textContent = `Your question: ${data.question}`;
		answer.disabled = false;
		submitAnswer.disabled = false;
	} else if (data.type === "start_voting") {
		updatePhase("voting");
		votingOptions.innerHTML = "";

		data.players.forEach((player) => {
			if (player.username !== myUsername) {
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
				votingOptions.appendChild(voteButton);
			}
		});
	} else if (data.type === "game_results") {
		updatePhase("results");
		voteResults.innerHTML = "";

		data.voteTally.forEach((result) => {
			const resultItem = document.createElement("p");
			resultItem.textContent = `${result.username}: ${result.votes} votes`;
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

	if (newPhase === "question") {
		gamePhase.textContent = "Answer the question!";
		questionPhase.classList.remove("hidden");
	} else if (newPhase === "voting") {
		gamePhase.textContent = "Vote for the impostor!";
		votingPhase.classList.remove("hidden");
	} else if (newPhase === "results") {
		gamePhase.textContent = "Results";
		resultsPhase.classList.remove("hidden");
	} else {
		gamePhase.textContent = "Waiting for players...";
	}
}
