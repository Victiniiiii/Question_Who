const socket = new WebSocket(`wss://${window.location.host}`);
let myUsername = null;
let currentPhase = "waiting";
let currentLanguage = localStorage.getItem("language") || "tr";
let translations = {};

const answer = document.getElementById("answer");
const submitAnswer = document.getElementById("submitAnswer");
const playerList = document.getElementById("playerList");
const timer = document.getElementById("timer");
const questionPhase = document.getElementById("questionPhase");
const votingPhase = document.getElementById("votingPhase");
const votingOptions = document.getElementById("votingOptions");
const resultsPhase = document.getElementById("resultsPhase");
const voteResults = document.getElementById("voteResults");

document.getElementById("usernameSubmit").addEventListener("click", () => {
	const username = document.getElementById("usernameInput").value.trim();
	if (username.length > 0 && username.length < 15) {
		myUsername = username;
		socket.send(
			JSON.stringify({
				type: "set_username",
				username,
				profileImage: pfpNo,
				profileDesc: descriptions[pfpNo - 1],
			})
		);

		document.getElementById("usernameScreen").classList.add("hidden");
		document.getElementById("gameContainer").classList.remove("hidden");
	} else {
		alert("Username not found or too short or too long (Limit = 15).");
	}
});

document.getElementById("languageSwitcher").addEventListener("change", function () {
	changeLanguage(this.value);
});

submitAnswer.addEventListener("click", () => {
	const answerValue = answer.value.trim();
	socket.send(JSON.stringify({ type: "submit_answer", answer: answerValue }));
	submitAnswer.disabled = true;
	answer.disabled = true;
});

socket.onmessage = (event) => {
	const data = JSON.parse(event.data);

	if (data.type === "update_player_list") {
		playerList.innerHTML = "";
		data.playerList.forEach((player) => {
			const listItem = document.createElement("p");

			if (player.profileImage) {
				const img = document.createElement("img");
				img.src = `images/pfp${player.profileImage}.png`;
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
			pointsSpan.textContent = `${player.points} ${translations[currentLanguage]["points"]}`;
			pointsSpan.classList.add("player-points");
			playerInfo.appendChild(pointsSpan);

			listItem.appendChild(playerInfo);
			playerList.appendChild(listItem);
		});
	} else if (data.type === "question") {
		updatePhase("question");
		document.getElementById("question").textContent = `${translations[currentLanguage]["question"]}: ${data.question}`;
		answer.disabled = false;
		submitAnswer.disabled = false;
		answer.value = "";
	} else if (data.type === "start_voting") {
		updatePhase("voting");
		votingOptions.innerHTML = "";

		const revealQuestionDiv = document.getElementById("revealQuestion");
		if (revealQuestionDiv) {
			revealQuestionDiv.textContent = `${translations[currentLanguage]["question"]}: ${data.commonQuestion}`;
			revealQuestionDiv.classList.add("revealed-question");
		}

		data.players.forEach((player) => {
			if (player.username !== myUsername) {
				const voteContainer = document.createElement("div");
				voteContainer.classList.add("vote-option");

				if (player.profileImage) {
					const img = document.createElement("img");
					img.src = `images/pfp${player.profileImage}.png`;
					img.alt = player.profileDesc || `Profile ${player.profileImage}`;
					img.classList.add("vote-pfp");
					voteContainer.appendChild(img);
				}

				const voteInfo = document.createElement("div");
				voteInfo.classList.add("flexcolumn");

				const voteButton = document.createElement("button");
				voteButton.textContent = `${player.username}: ${player.answer || translations[currentLanguage]["no_answer"]}`;
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
		timer.textContent = `${translations[currentLanguage]["remaining_time"]}: ${data.remainingTime} ${translations[currentLanguage]["seconds"]}`;
		if (data.remainingTime <= 10) {
			timer.classList.add("timerwarning");
		} else {
			timer.classList.remove("timerwarning");
		}
	} else if (data.type === "game_results") {
		updatePhase("results");
		voteResults.innerHTML = "";

		data.voteTally.forEach((result) => {
			const resultItem = document.createElement("div");
			resultItem.classList.add("result-item");

			if (result.profileImage) {
				const img = document.createElement("img");
				img.src = `images/pfp${result.profileImage}.png`;
				img.alt = result.profileDesc || `Profile ${result.profileImage}`;
				img.classList.add("result-pfp");
				resultItem.appendChild(img);
			}

			const resultInfo = document.createElement("div");
			resultInfo.classList.add("flexcolumn");

			const resultText = document.createElement("p");
			resultText.textContent = `${result.username}: ${result.votes} ${translations[currentLanguage]["votes"]}`;

			resultInfo.appendChild(resultText);
			resultItem.appendChild(resultInfo);
			voteResults.appendChild(resultItem);
		});

		document.getElementById("impostorReveal").textContent = `${translations[currentLanguage]["impostor"]}: ${data.impostor}`;
	}
};

function changeLanguage(lang) {
	document.body.querySelectorAll("*").forEach((el) => {
		if (el.childNodes.length === 1 && el.childNodes[0].nodeType === 3) {
			const text = el.textContent.trim();
			for (const key in translations[currentLanguage]) {
				if (translations[currentLanguage][key] === text) {
					el.textContent = translations[lang][key];
					break;
				}
			}
		}
	});
    
    document.getElementById("game_name").textContent = translations[lang]["game_name"];
    document.getElementById("enter_username").textContent = translations[lang]["enter_username"];
    document.getElementById("usernameSubmit").textContent = translations[lang]["join"];
    document.getElementById("players").textContent = translations[lang]["players"];
    document.getElementById("gamePhase").textContent = translations[lang]["waiting_game"];
    document.getElementById("question").textContent = translations[lang]["question"];
    document.getElementById("submitAnswer").textContent = translations[lang]["submit_answer"];
    document.getElementById("voteForImpostor").textContent = translations[lang]["click_on_spy"];
	document.getElementById("usernameInput").placeholder = translations[lang]["placeholder1"];
	document.getElementById("answer").placeholder = translations[lang]["placeholder2"];

	currentLanguage = lang;
	localStorage.setItem("language", lang);
	updatePhase(currentPhase);
}

function updatePhase(newPhase) {
	currentPhase = newPhase;

	questionPhase.classList.add("hidden");
	votingPhase.classList.add("hidden");
	resultsPhase.classList.add("hidden");

	document.getElementById("gamePhase").textContent = translations[currentLanguage][`${newPhase}_phase`];

	if (newPhase === "question") questionPhase.classList.remove("hidden");
	else if (newPhase === "voting") votingPhase.classList.remove("hidden");
	else if (newPhase === "results") resultsPhase.classList.remove("hidden");
}

const descriptions = ["Kedi", "Tahta bloğu", "Tarator", "Ağaç", "Havalı H Harfi", "Kolonya", "Uganda", "👌", "Sasalı", "😉", "😔", "Navy Seal", "Kağıt Uçak", "Sandviç", "İzban", "Erasmus", "Veri Tabanı"];

let pfpNo = 1;
const pfpCount = descriptions.length;
const pfpImage = document.getElementById("pfp");

function updatePfp() {
	pfpImage.src = `images/pfp${pfpNo}.png`;
	pfpImage.alt = `images/pfp${pfpNo}`;
	document.getElementById("description").textContent = descriptions[pfpNo - 1];
}

document.getElementById("left-arrow").addEventListener("click", () => {
	pfpNo = pfpNo === 1 ? pfpCount : pfpNo - 1;
	updatePfp();
});

document.getElementById("right-arrow").addEventListener("click", () => {
	pfpNo = pfpNo === pfpCount ? 1 : pfpNo + 1;
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
}

function kickPlayer(username) {
	socket.send(
		JSON.stringify({
			type: "admin_command",
			command: "kickPlayer",
			username: username,
		})
	);
}

window.startGame = startGame;
window.kickPlayer = kickPlayer;

document.addEventListener("DOMContentLoaded", async function () {
	console.log(`startGame("Question 1", "Question 2"), kickPlayer("username")`);
    
    try {
        const response = await fetch("translations.json");
        translations = await response.json();
        changeLanguage(currentLanguage);
        document.getElementById("languageSwitcher").value = currentLanguage;
    } catch (error) {
        console.error("Failed to load translations:", error);
    }
});
