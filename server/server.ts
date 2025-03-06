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
    }
});

const wss = new WebSocketServer({ server });

function broadcastPlayerList() {
    const playersList = players.map(player => ({
        username: player.username,
        answered: player.answer !== null
    }));
    
    const message = JSON.stringify({ 
        type: "update_player_list", 
        playerList: playersList 
    });
   
    players.forEach(player => {
        if (player.ws.readyState === WebSocket.OPEN) {
            player.ws.send(message);
        }
    });
}

function checkAllAnswered() {
    const readyPlayers = players.filter(player => player.username !== null);
    return readyPlayers.every(player => player.answer !== null);
}

function checkAllVoted() {
    const readyPlayers = players.filter(player => player.username !== null);
    return readyPlayers.every(player => player.voted);
}

function startVotingPhase() {
    gamePhase = "voting";
    
    const playerData = players
        .filter(player => player.username !== null)
        .map(player => ({
            username: player.username,
            answer: player.answer
        }));
    
    const message = JSON.stringify({
        type: "start_voting",
        players: playerData
    });
    
    players.forEach(player => {
        if (player.ws.readyState === WebSocket.OPEN) {
            player.ws.send(message);
        }
    });
    
    setTimeout(() => {
        if (gamePhase === "voting") {
            endVotingPhase();
        }
    }, 60000);
}

function endVotingPhase() {
    gamePhase = "results";
    
    const voteTally = players
        .filter(player => player.username !== null)
        .map(player => ({
            username: player.username,
            votes: players.filter(p => p.votedFor === player.username).length
        }))
        .sort((a, b) => b.votes - a.votes);
    
    const readyPlayers = players.filter(player => player.username !== null);
    const impostor = readyPlayers[impostorIndex].username;
    
    const message = JSON.stringify({
        type: "game_results",
        voteTally,
        impostor
    });
    
    players.forEach(player => {
        if (player.ws.readyState === WebSocket.OPEN) {
            player.ws.send(message);
        }
    });
    
    players.forEach(player => {
        player.answer = null;
        player.voted = false;
        player.votedFor = null;
    });
    
    gamePhase = "waiting";
}

wss.on("connection", (ws) => {
    const newPlayer: Player = { 
        ws, 
        username: null, 
        answer: null, 
        voted: false, 
        votedFor: null 
    };
    
    players.push(newPlayer);
    ws.send(JSON.stringify({ type: "username_prompt", message: "Please enter your username:" }));
   
    broadcastPlayerList();
    
    ws.on("message", (message) => {
        const data = JSON.parse(message.toString());
        const player = players.find(p => p.ws === ws);
        
        if (!player) return;
        
        switch (data.type) {
            case "set_username":
                if (data.username) {
                    player.username = data.username;
                    console.log(`${data.username} connected! Total players: ${players.length}`);
                    ws.send(JSON.stringify({ type: "welcome", message: `Welcome ${data.username}!` }));
                    broadcastPlayerList();
                }
                break;
            
            case "submit_answer":
                if (gamePhase === "question" && player.answer === null) {
                    player.answer = data.answer;
                    broadcastPlayerList();
                    
                    if (checkAllAnswered()) {
                        startVotingPhase();
                    }
                }
                break;
            
            case "submit_vote":
                if (gamePhase === "voting" && !player.voted) {
                    player.voted = true;
                    player.votedFor = data.vote;
                    
                    if (checkAllVoted()) {
                        endVotingPhase();
                    }
                }
                break;
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

function startGame(common: string, impostor: string) {
    const readyPlayers = players.filter(player => player.username);
    if (readyPlayers.length < 2) {
        console.log("Not enough players with usernames to start the game!");
        return;
    }
    
    gamePhase = "question";
    commonQuestion = common;
    impostorQuestion = impostor;
    impostorIndex = Math.floor(Math.random() * readyPlayers.length);
    
    players.forEach(player => {
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
    console.log(`Game started! The impostor is ${impostorUsername}, player #${impostorIndex + 1}`);
    
    setTimeout(() => {
        if (gamePhase === "question") {
            startVotingPhase();
        }
    }, 60000);
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