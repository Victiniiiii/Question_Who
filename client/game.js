const socket = new WebSocket("ws://localhost:3000");
let myUsername = null;
let currentPhase = "waiting";

const question = document.getElementById("question");
const answer = document.getElementById("answer");
const submitAnswer = document.getElementById("submitAnswer");
const playerList = document.getElementById("playerList");
const timer = document.getElementById("timer");
const gamePhase = document.getElementById("gamePhase");
const questionPhase = document.getElementById("questionPhase");
const votingPhase = document.getElementById("votingPhase");
const resultsPhase = document.getElementById("resultsPhase");
const voteResults = document.getElementById("voteResults");
const impostorReveal = document.getElementById("impostorReveal");

function updatePhase(phase) {
    currentPhase = phase;
    gamePhase.textContent = phase.charAt(0).toUpperCase() + phase.slice(1) + " Phase";

    questionPhase.classList.add("hidden");
    votingPhase.classList.add("hidden");
    resultsPhase.classList.add("hidden");

    if (phase === "question") {
        questionPhase.classList.remove("hidden");
    } else if (phase === "voting") {
        votingPhase.classList.remove("hidden");
    } else if (phase === "results") {
        resultsPhase.classList.remove("hidden");
    }
}

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

    if (data.type === "username_prompt") {
        const username = prompt(data.message);
        if (username) {
            myUsername = username;
            socket.send(JSON.stringify({ type: "set_username", username }));
        }
    } else if (data.type === "update_player_list") {
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
    } else if (data.type === "time_remaining") {
        timer.textContent = `Time remaining: ${data.remainingTime} seconds`;
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

socket.onerror = (error) => {
    console.error("WebSocket error:", error);
};

socket.onclose = () => {
    console.log("Disconnected from server.");
};
