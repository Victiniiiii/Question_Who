import { WebSocketServer, WebSocket } from "ws";
import * as http from "http";
import * as fs from "fs";
import * as path from "path";

const PORT = 3000;

interface Player {
    ws: WebSocket;
    username: string | null;
    answer: string | null;
    voted: boolean;
    votedFor: string | null;
}

let players: Player[] = [];
let impostorIndex: number;
let gamePhase: "waiting" | "question" | "voting" | "results" = "waiting";
let commonQuestion: string;
let impostorQuestion: string;
let questionTimer: NodeJS.Timeout | null = null;
let votingTimer: NodeJS.Timeout | null = null;

const server = http.createServer((req, res) => {
    if (req.url === "/") {
        fs.readFile(path.join(__dirname, "../client/index.html"), (err, data) => {
            if (err) {
                res.writeHead(500);
                res.end("Error loading index.html");
            } else {
                res.writeHead(200, { "Content-Type": "text/html" });
                res.end(data);
            }
        });
    } else if (req.url === "/style.css") {
        fs.readFile(path.join(__dirname, "../client/style.css"), (err, data) => {
            if (err) {
                res.writeHead(500);
                res.end("Error loading style.css");
            } else {
                res.writeHead(200, { "Content-Type": "text/css" });
                res.end(data);
            }
        });
    } else if (req.url === "/game.js") {
        fs.readFile(path.join(__dirname, "../client/game.js"), (err, data) => {
            if (err) {
                res.writeHead(500);
                res.end("Error loading game.js");
            } else {
                res.writeHead(200, { "Content-Type": "application/javascript" });
                res.end(data);
            }
        });
    }
});

const wss = new WebSocketServer({ server });

function broadcastPlayerList() {
    const playersList = players.map((player) => ({
        username: player.username,
        answered: player.answer !== null,
    }));

    const message = JSON.stringify({
        type: "update_player_list",
        playerList: playersList,
    });

    players.forEach((player) => {
        if (player.ws.readyState === WebSocket.OPEN) {
            player.ws.send(message);
        }
    });
}

wss.on("connection", (ws) => {
    const newPlayer: Player = {
        ws,
        username: null,
        answer: null,
        voted: false,
        votedFor: null,
    };

    players.push(newPlayer);
    ws.send(JSON.stringify({ type: "username_prompt", message: "Please enter your username:" }));

    broadcastPlayerList();

    ws.on("message", (message) => {
        const data = JSON.parse(message.toString());
        const player = players.find((p) => p.ws === ws);

        if (!player) return;

        if (data.type === "set_username") {
            if (data.username) {
                player.username = data.username;
                console.log(`${data.username} connected! Total players: ${players.length}`);
                ws.send(JSON.stringify({ type: "welcome", message: `Welcome ${data.username}!` }));
                broadcastPlayerList();
            }
        } else if (data.type === "submit_answer") {
            if (gamePhase === "question" && player.answer === null) {
                player.answer = data.answer;
                broadcastPlayerList();

                const readyPlayers = players.filter((player) => player.username !== null);
                const allAnswered = readyPlayers.every((p) => p.answer !== null);

                if (allAnswered) {
                    gamePhase = "voting";
                    startVotingPhase();
                }
            }
        } else if (data.type === "submit_vote") {
            if (gamePhase === "voting" && !player.voted) {
                player.voted = true;
                player.votedFor = data.vote;

                const readyPlayers = players.filter((player) => player.username !== null);
                const allVoted = readyPlayers.every((p) => p.voted);

                if (allVoted) {
                    endVotingPhase();
                }
            }
        }
    });

    ws.on("close", () => {
        players = players.filter((p) => p.ws !== ws);
        console.log(`Player disconnected. Remaining players: ${players.length}`);
        broadcastPlayerList();
    });

    ws.on("error", (err) => {
        console.error("WebSocket error:", err);
    });
});

function sendTimeRemaining(remainingTime: number) {
    const message = JSON.stringify({
        type: "time_remaining",
        remainingTime,
    });

    players.forEach((player) => {
        if (player.ws.readyState === WebSocket.OPEN) {
            player.ws.send(message);
        }
    });
}

function startVotingPhase() {
    gamePhase = "voting";

    const playerData = players
        .filter((player) => player.username !== null)
        .map((player) => ({
            username: player.username,
            answer: player.answer,
        }));

    const message = JSON.stringify({
        type: "start_voting",
        players: playerData,
    });

    players.forEach((player) => {
        if (player.ws.readyState === WebSocket.OPEN) {
            player.ws.send(message);
        }
    });

    let remainingTime = 60;

    if (questionTimer) {
        clearInterval(questionTimer);
        questionTimer = null;
    }

    votingTimer = setInterval(() => {
        sendTimeRemaining(remainingTime);
        remainingTime--;
        if (remainingTime <= 0) {
            clearInterval(votingTimer as NodeJS.Timeout);
            votingTimer = null;
            endVotingPhase();
        }
    }, 1000);
}

function endVotingPhase() {
    gamePhase = "results";

    const voteTally = players
        .filter((player) => player.username !== null)
        .map((player) => ({
            username: player.username,
            votes: players.filter((p) => p.votedFor === player.username).length,
        }))
        .sort((a, b) => b.votes - a.votes);

    const readyPlayers = players.filter((player) => player.username !== null);
    const impostor = readyPlayers[impostorIndex].username;

    const message = JSON.stringify({
        type: "game_results",
        voteTally,
        impostor,
    });

    players.forEach((player) => {
        if (player.ws.readyState === WebSocket.OPEN) {
            player.ws.send(message);
        }
    });

    players.forEach((player) => {
        player.answer = null;
        player.voted = false;
        player.votedFor = null;
    });

    gamePhase = "waiting";

    if (votingTimer) {
        clearInterval(votingTimer);
        votingTimer = null;
    }
}

function startGame(common: string, impostor: string) {
    const readyPlayers = players.filter((player) => player.username);
    if (readyPlayers.length < 2) {
        console.log("Not enough players with usernames to start the game!");
        return;
    }

    gamePhase = "question";
    commonQuestion = common;
    impostorQuestion = impostor;
    impostorIndex = Math.floor(Math.random() * readyPlayers.length);

    players.forEach((player) => {
        player.answer = null;
        player.voted = false;
        player.votedFor = null;
    });

    readyPlayers.forEach((player, index) => {
        const question = index === impostorIndex ? impostorQuestion : commonQuestion;
        if (player.ws.readyState === WebSocket.OPEN) {
            player.ws.send(JSON.stringify({ type: "question", question }));
        }
    });

    const impostorUsername = readyPlayers[impostorIndex].username;
    console.log(`Game started!`);

    let remainingTime = 60;

    if (votingTimer) {
        clearInterval(votingTimer);
        votingTimer = null;
    }

    questionTimer = setInterval(() => {
        sendTimeRemaining(remainingTime);
        remainingTime--;
        if (remainingTime <= 0) {
            clearInterval(questionTimer as NodeJS.Timeout);
            questionTimer = null;
            startVotingPhase();
        }
    }, 1000);
}

process.stdin.on("data", (input) => {
    const command = input.toString().trim();
    if (command === "start") {
        process.stdout.write("Enter a common question: ");
        process.stdin.once("data", (commonInput) => {
            const commonQuestion = commonInput.toString().trim();
            process.stdout.write("Enter a unique question for the impostor: ");
            process.stdin.once("data", (impostorInput) => {
                const impostorQuestion = impostorInput.toString().trim();
                startGame(commonQuestion, impostorQuestion);
            });
        });
    }
});

server.listen(PORT, () => {
    console.log(`HTTP & WebSocket server running at http://localhost:${PORT}`);
});
