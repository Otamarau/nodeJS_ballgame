const canvas = document.getElementById('myCanvas');
const ctx = canvas.getContext('2d');

// Set up canvas for HiDPI displays
const scale = window.devicePixelRatio;
canvas.width = 800 * scale;
canvas.height = 800 * scale;
canvas.style.width = '800px';
canvas.style.height = '800px';
ctx.scale(scale, scale);

const socket = io();

const squareSize = 50;
let players = {};
let keysPressed = {};

let ball = { x: 400, y: 400, size: 20, velocityX: 0, velocityY: 0 };

function drawSquare(player) {
    ctx.fillStyle = player.color;
    ctx.fillRect(player.x, player.y, squareSize, squareSize);
}

function drawBall() {
    ctx.beginPath();
    ctx.arc(ball.x, ball.y, ball.size, 0, Math.PI * 2);
    ctx.fillStyle = '#FF0000';
    ctx.fill();
    ctx.closePath();
}

function clearCanvas() {
    ctx.clearRect(0, 0, canvas.width / scale, canvas.height / scale);
}

function drawPlayers() {
    clearCanvas();
    for (let id in players) {
        drawSquare(players[id]);
    }
    drawBall();
}

socket.on('currentPlayers', (currentPlayers) => {
    players = currentPlayers;
    drawPlayers();
});

socket.on('newPlayer', (player) => {
    players[player.id] = player;
    drawPlayers();
});

socket.on('playerMoved', (player) => {
    players[player.id] = player;
    drawPlayers();
});

socket.on('playerDisconnected', (playerId) => {
    delete players[playerId];
    drawPlayers();
});

socket.on('currentBall', (currentBall) => {
    ball = currentBall;
    drawPlayers();
});

socket.on('ballMoved', (updatedBall) => {
    ball = updatedBall;
    drawPlayers();
});

function handleKeyDown(event) {
    keysPressed[event.key] = true;
    socket.emit('move', keysPressed);
}

function handleKeyUp(event) {
    keysPressed[event.key] = false;
    socket.emit('move', keysPressed);
}

document.addEventListener('keydown', handleKeyDown);
document.addEventListener('keyup', handleKeyUp);

setInterval(() => {
    socket.emit('move', keysPressed);
}, 1000 / FPS); // Continuously send key states to the server
