"use strict";
var __createBinding =
	(this && this.__createBinding) ||
	(Object.create
		? function (o, m, k, k2) {
				if (k2 === undefined) k2 = k;
				var desc = Object.getOwnPropertyDescriptor(m, k);
				if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
					desc = {
						enumerable: true,
						get: function () {
							return m[k];
						},
					};
				}
				Object.defineProperty(o, k2, desc);
		  }
		: function (o, m, k, k2) {
				if (k2 === undefined) k2 = k;
				o[k2] = m[k];
		  });
var __setModuleDefault =
	(this && this.__setModuleDefault) ||
	(Object.create
		? function (o, v) {
				Object.defineProperty(o, "default", { enumerable: true, value: v });
		  }
		: function (o, v) {
				o["default"] = v;
		  });
var __importStar =
	(this && this.__importStar) ||
	(function () {
		var ownKeys = function (o) {
			ownKeys =
				Object.getOwnPropertyNames ||
				function (o) {
					var ar = [];
					for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
					return ar;
				};
			return ownKeys(o);
		};
		return function (mod) {
			if (mod && mod.__esModule) return mod;
			var result = {};
			if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
			__setModuleDefault(result, mod);
			return result;
		};
	})();
Object.defineProperty(exports, "__esModule", { value: true });
const ws_1 = require("ws");
const http = __importStar(require("http"));
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const PORT = 3000;
let players = [];
let impostorIndex;
let gamePhase = "waiting";
let commonQuestion;
let impostorQuestion;
let questionTimer = null;
let votingTimer = null;
const serveFile = (filePath, contentType, res) => {
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
	var _a, _b;
	const fileMap = {
		"/": { path: path.join(__dirname, "../client/index.html"), contentType: "text/html" },
		"/style.css": { path: path.join(__dirname, "../client/style.css"), contentType: "text/css" },
		"/game.js": { path: path.join(__dirname, "../client/game.js"), contentType: "application/javascript" },
	};
	if (fileMap[req.url || ""]) {
		const file = fileMap[req.url || ""];
		serveFile(file.path, file.contentType, res);
	} else if (/^\/pfp\d+\.png$/.test(req.url || "")) {
		const index = (_b = (_a = req.url) === null || _a === void 0 ? void 0 : _a.match(/\d+/)) === null || _b === void 0 ? void 0 : _b[0];
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
const wss = new ws_1.WebSocketServer({ server });
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
		if (player.ws.readyState === ws_1.WebSocket.OPEN) {
			player.ws.send(message);
		}
	});
}
wss.on("connection", (ws) => {
	const newPlayer = {
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
function sendTimeRemaining(remainingTime) {
	const message = JSON.stringify({
		type: "time_remaining",
		remainingTime,
	});
	players.forEach((player) => {
		if (player.ws.readyState === ws_1.WebSocket.OPEN) {
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
		if (player.ws.readyState === ws_1.WebSocket.OPEN) {
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
			clearInterval(votingTimer);
			votingTimer = null;
			endVotingPhase();
		}
	}, 1000);
}
function updatePoints(impostorWon, isTie) {
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
		return Object.assign(Object.assign({}, player), { points: currentPlayer ? currentPlayer.points : player.points });
	});
	const gameResultMessage = JSON.stringify({
		type: "game_results",
		voteTally: updatedVoteTally,
		impostor: impostor.username,
		impostorWon,
		isTie,
	});
	players.forEach((player) => {
		if (player.ws.readyState === ws_1.WebSocket.OPEN) {
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
function startGame(common, impostor) {
	const readyPlayers = players.filter((player) => player.username);
	if (readyPlayers.length < 3) {
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
		if (player.ws.readyState === ws_1.WebSocket.OPEN) {
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
			clearInterval(questionTimer);
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
	console.log(`WebSocket server running on port ${PORT}`);
});
