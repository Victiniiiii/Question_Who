import { WebSocketServer, WebSocket } from "ws";
import * as http from "http";
import * as fs from "fs";
import * as path from "path";

const PORT = 3000;
let players: { ws: WebSocket, username: string | null }[] = [];
let impostorIndex: number;

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

wss.on("connection", (ws) => {
    players.push({ ws, username: null });
    ws.send(JSON.stringify({ type: "username_prompt", message: "Please enter your username:" }));
    ws.on("message", (message) => {
        const data = JSON.parse(message.toString());

        if (data.type === "set_username") {
            const player = players.find(player => player.ws === ws);
            if (player && data.username) {
                player.username = data.username;
                console.log(`${data.username} connected! Total players: ${players.length}`);
                ws.send(JSON.stringify({ type: "welcome", message: `Welcome ${data.username}!` }));
            }
        }
    });

    ws.on("close", () => {
        players = players.filter((player) => player.ws !== ws);
        console.log(`Player disconnected. Remaining players: ${players.length}`);
    });

    ws.on("error", (err) => {
        console.error("WebSocket error:", err);
    });
});

function startGame(commonQuestion: string, impostorQuestion: string) {
    const readyPlayers = players.filter(player => player.username);
    if (readyPlayers.length < 2) {
        console.log("Not enough players with usernames to start the game!");
        return;
    }

    impostorIndex = Math.floor(Math.random() * readyPlayers.length);

    readyPlayers.forEach((player, index) => {
        const question = index === impostorIndex ? impostorQuestion : commonQuestion;
        player.ws.send(JSON.stringify({ type: "question", question }));
    });

    const impostorUsername = readyPlayers[impostorIndex].username;
    console.log(`Game started! The impostor is ${impostorUsername}, player #${impostorIndex + 1}`);
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
