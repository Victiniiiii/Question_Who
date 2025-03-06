import { WebSocketServer, WebSocket } from "ws";
import * as http from "http";
import * as fs from "fs";
import * as path from "path";

const PORT = 3000;

interface Player {
	ws: WebSocket;
	username: string | null;
	profileImage: number | null;
	profileDesc: string | null;
	answer: string | null;
	voted: boolean;
	votedFor: string | null;
	points: number;
}

let players: Player[] = [];
let impostorIndex: number;
let gamePhase: "waiting" | "question" | "voting" | "results" = "waiting";
let commonQuestion: string;
let impostorQuestion: string;
let questionTimer: NodeJS.Timeout | null = null;
let votingTimer: NodeJS.Timeout | null = null;

const serveFile = (filePath: string, contentType: string, res: http.ServerResponse): void => {
	fs.readFile(filePath, (err, data) => {
		if (err) {
			res.writeHead(500);
			res.end(`Error loading ${filePath}`);
		} else {
			res.writeHead(200, { "Content-Type": contentType });
			res.end(data);
		}
	});
};

const server = http.createServer((req, res) => {
	const fileMap: { [key: string]: { path: string; contentType: string } } = {
		"/": { path: "../client/index.html", contentType: "text/html" },
		"/style.css": { path: "../client/style.css", contentType: "text/css" },
		"/game.js": { path: "../client/game.js", contentType: "application/javascript" },
	};

	if (fileMap[req.url || ""]) {
		const file = fileMap[req.url || ""];
		serveFile(file.path, file.contentType, res);
	} else if (/^\/pfp\d+\.png$/.test(req.url || "")) {
		const index = req.url?.match(/\d+/)?.[0];
		if (index) {
			serveFile(path.join(__dirname, `../client/pfp${index}.png`), "image/png", res);
		} else {
			res.writeHead(400);
			res.end("Invalid image request");
		}
	} else {
		res.writeHead(404);
		res.end("Not Found");
	}
});

const wss = new WebSocketServer({ server });

function broadcastPlayerList() {
	const playersList = players.map((player) => ({
		username: player.username,
		profileImage: player.profileImage,
		profileDesc: player.profileDesc,
		answered: player.answer !== null,
		points: player.points,
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

function kickPlayer(username: string): boolean {
	const playerIndex = players.findIndex(p => p.username === username);
	if (playerIndex === -1) {
		console.log(`Player ${username} not found`);
		return false;
	}
	
	const player = players[playerIndex];
	console.log(`Kicking player: ${username}`);
	
	if (player.ws.readyState === WebSocket.OPEN) {
		player.ws.send(JSON.stringify({ type: "kicked", message: "You have been kicked from the game" }));
		player.ws.close();
	}
	
	players.splice(playerIndex, 1);
	broadcastPlayerList();
	return true;
}

function startGame(common: string, impostor: string) {
	const readyPlayers = players.filter((player) => player.username);
	if (readyPlayers.length < 3) {
		console.log("Not enough players with usernames to start the game!");
		return false;
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
	console.log(`Game started! Impostor is: ${impostorUsername}`);

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
	
	return true;
}

function listPlayers(): void {
	console.log("Connected players:");
	console.table(players.map(p => ({
		username: p.username || "Anonymous",
		profileImage: p.profileImage,
		points: p.points,
		status: p.answer !== null ? "Answered" : "Waiting"
	})));
}

function resetGame(): void {
	if (questionTimer) {
		clearInterval(questionTimer);
		questionTimer = null;
	}
	
	if (votingTimer) {
		clearInterval(votingTimer);
		votingTimer = null;
	}
	
	players.forEach((player) => {
		player.answer = null;
		player.voted = false;
		player.votedFor = null;
	});
	
	gamePhase = "waiting";
	console.log("Game reset to waiting state");
	broadcastPlayerList();
}

wss.on("connection", (ws) => {
	const newPlayer: Player = {
		ws,
		username: null,
		profileImage: null,
		profileDesc: null,
		answer: null,
		voted: false,
		votedFor: null,
		points: 0,
	};

	players.push(newPlayer);
	broadcastPlayerList();

	ws.on("message", (message) => {
		const data = JSON.parse(message.toString());
		const player = players.find((p) => p.ws === ws);

		if (!player) return;

		if (data.type === "set_username") {
			if (data.username) {
				const existingPlayer = players.find((p) => p !== player && p.username === data.username);

				if (existingPlayer) {
					player.points = existingPlayer.points;
				}

				player.username = data.username;
				player.profileImage = data.profileImage || null;
				player.profileDesc = data.profileDesc || null;
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
			profileImage: player.profileImage,
			profileDesc: player.profileDesc,
			answer: player.answer,
			points: player.points,
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

function updatePoints(impostorWon: boolean, isTie: boolean) {
	const readyPlayers = players.filter((player) => player.username !== null);
	const impostor = readyPlayers[impostorIndex];

	if (impostorWon) {
		impostor.points += 3;
	} else if (isTie) {
		impostor.points += 1;
	} else {
		readyPlayers.forEach((player) => {
			if (player !== impostor) {
				player.points += 1;
			}
		});
	}
}

function endVotingPhase() {
	gamePhase = "results";

	const voteTally = players
		.filter((player) => player.username !== null)
		.map((player) => ({
			username: player.username,
			profileImage: player.profileImage,
			profileDesc: player.profileDesc,
			votes: players.filter((p) => p.votedFor === player.username).length,
			points: player.points,
		}))
		.sort((a, b) => b.votes - a.votes);

	const readyPlayers = players.filter((player) => player.username !== null);
	const impostor = readyPlayers[impostorIndex];

	const maxVotes = voteTally[0].votes;
	const mostVotedPlayers = voteTally.filter((p) => p.votes === maxVotes);

	const impostorWon = mostVotedPlayers.length > 1 || (mostVotedPlayers.length === 1 && mostVotedPlayers[0].username !== impostor.username);

	const isTie = mostVotedPlayers.length > 1;

	updatePoints(impostorWon, isTie);

	const updatedVoteTally = voteTally.map((player) => {
		const currentPlayer = players.find((p) => p.username === player.username);
		return {
			...player,
			points: currentPlayer ? currentPlayer.points : player.points,
		};
	});

	const gameResultMessage = JSON.stringify({
		type: "game_results",
		voteTally: updatedVoteTally,
		impostor: impostor.username,
		impostorWon,
		isTie,
	});

	players.forEach((player) => {
		if (player.ws.readyState === WebSocket.OPEN) {
			player.ws.send(gameResultMessage);
		}
	});

	players.forEach((player) => {
		player.answer = null;
		player.voted = false;
		player.votedFor = null;
	});

	gamePhase = "waiting";
	broadcastPlayerList();

	if (votingTimer) {
		clearInterval(votingTimer);
		votingTimer = null;
	}
}

(global as any).startGame = startGame;
(global as any).kickPlayer = kickPlayer;
(global as any).listPlayers = listPlayers;
(global as any).resetGame = resetGame;

server.listen(PORT, () => {
	console.log(`WebSocket server running on port ${PORT}`);
	console.log(`Available admin commands (use in server console):`);
	console.log(`- startGame("common question", "impostor question")`);
	console.log(`- kickPlayer("username")`);
	console.log(`- listPlayers()`);
	console.log(`- resetGame()`);
});