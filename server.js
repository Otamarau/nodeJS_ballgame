const express = require('express');
const path = require('path');
const http = require('http');
const socketIo = require('socket.io');
const app = express();
const port = 80;

// Settings
const MAP_SIZE = 800;
const SQUARE_SIZE = 50;
const BALL_SIZE = 20;
const BALL_HITBOX_BUFFER = 10;
const BASE_VELOCITY = 15;
const FRICTION = 0.98;
const FPS = 60;

// Player Settings
const ACCELERATION = 2;
const DECELERATION = 0.1;
const MAX_SPEED = 30;

app.use(express.static(path.join(__dirname, 'public')));
const server = http.createServer(app);
const io = socketIo(server);

let players = {};
let ball = {
    x: MAP_SIZE / 2,
    y: MAP_SIZE / 2,
    size: BALL_SIZE,
    velocityX: 0,
    velocityY: 0
};

io.on('connection', (socket) => {
    console.log('a user connected:', socket.id);
    
    players[socket.id] = {
        id: socket.id,
        x: Math.random() * (MAP_SIZE - SQUARE_SIZE),
        y: Math.random() * (MAP_SIZE - SQUARE_SIZE),
        color: getRandomColor(),
        speedX: 0,
        speedY: 0,
        keys: {}
    };

    socket.emit('currentPlayers', players);
    socket.emit('currentBall', ball);

    socket.broadcast.emit('newPlayer', players[socket.id]);

    socket.on('move', (keys) => {
        const player = players[socket.id];
        if (player) {
            player.keys = keys;
        }
    });

    socket.on('disconnect', () => {
        console.log('user disconnected:', socket.id);
        delete players[socket.id];
        io.emit('playerDisconnected', socket.id);
    });
});

function getRandomColor() {
    const letters = '0123456789ABCDEF';
    let color = '#';
    for (let i = 0; i < 6; i++) {
        color += letters[Math.floor(Math.random() * 16)];
    }
    return color;
}

function checkWallCollision(player) {
    if (player.x < 0) {
        player.x = 0;
        player.speedX = 0;
    }
    if (player.x + SQUARE_SIZE > MAP_SIZE) {
        player.x = MAP_SIZE - SQUARE_SIZE;
        player.speedX = 0;
    }
    if (player.y < 0) {
        player.y = 0;
        player.speedY = 0;
    }
    if (player.y + SQUARE_SIZE > MAP_SIZE) {
        player.y = MAP_SIZE - SQUARE_SIZE;
        player.speedY = 0;
    }
}

function checkPlayerCollision(player) {
    for (let id in players) {
        if (id !== player.id) {
            const other = players[id];
            if (
                player.x < other.x + SQUARE_SIZE &&
                player.x + SQUARE_SIZE > other.x &&
                player.y < other.y + SQUARE_SIZE &&
                player.y + SQUARE_SIZE > other.y
            ) {
                if (player.speedX > 0 && player.x < other.x) {
                    player.x = other.x - SQUARE_SIZE;
                    player.speedX = 0;
                }
                if (player.speedX < 0 && player.x > other.x) {
                    player.x = other.x + SQUARE_SIZE;
                    player.speedX = 0;
                }
                if (player.speedY > 0 && player.y < other.y) {
                    player.y = other.y - SQUARE_SIZE;
                    player.speedY = 0;
                }
                if (player.speedY < 0 && player.y > other.y) {
                    player.y = other.y + SQUARE_SIZE;
                    player.speedY = 0;
                }
            }
        }
    }
}

function updatePlayers() {
    for (let id in players) {
        const player = players[id];
        const keys = player.keys;

        if (keys['w']) {
            player.speedY = Math.max(player.speedY - ACCELERATION, -MAX_SPEED);
        } else if (keys['s']) {
            player.speedY = Math.min(player.speedY + ACCELERATION, MAX_SPEED);
        } else {
            player.speedY *= (1 - DECELERATION);
        }

        if (keys['a']) {
            player.speedX = Math.max(player.speedX - ACCELERATION, -MAX_SPEED);
        } else if (keys['d']) {
            player.speedX = Math.min(player.speedX + ACCELERATION, MAX_SPEED);
        } else {
            player.speedX *= (1 - DECELERATION);
        }

        player.x += player.speedX;
        player.y += player.speedY;

        checkWallCollision(player);
        checkPlayerCollision(player);

        io.emit('playerMoved', player);
    }
}

function checkBallCollision() {
    for (let id in players) {
        const player = players[id];
        const playerLeft = player.x;
        const playerRight = player.x + SQUARE_SIZE;
        const playerTop = player.y;
        const playerBottom = player.y + SQUARE_SIZE;

        const ballLeft = ball.x - ball.size - BALL_HITBOX_BUFFER;
        const ballRight = ball.x + ball.size + BALL_HITBOX_BUFFER;
        const ballTop = ball.y - ball.size - BALL_HITBOX_BUFFER;
        const ballBottom = ball.y + ball.size + BALL_HITBOX_BUFFER;

        if (
            playerRight > ballLeft &&
            playerLeft < ballRight &&
            playerBottom > ballTop &&
            playerTop < ballBottom
        ) {
            const dx = ball.x - (player.x + SQUARE_SIZE / 2);
            const dy = ball.y - (player.y + SQUARE_SIZE / 2);
            const distance = Math.sqrt(dx * dx + dy * dy);
            const angle = Math.atan2(dy, dx);
            const hitForce = Math.sqrt(player.speedX * player.speedX + player.speedY * player.speedY) / 10;

            if (hitForce > 0) {
                ball.velocityX = Math.cos(angle) * BASE_VELOCITY * hitForce;
                ball.velocityY = Math.sin(angle) * BASE_VELOCITY * hitForce;
            } else {
                ball.velocityX += Math.cos(angle) * BASE_VELOCITY * FRICTION;
                ball.velocityY += Math.sin(angle) * BASE_VELOCITY * FRICTION;
            }

            ball.x += ball.velocityX;
            ball.y += ball.velocityY;

            if (ball.x - ball.size < 0) {
                ball.x = ball.size;
                ball.velocityX *= -1;
            }
            if (ball.x + ball.size > MAP_SIZE) {
                ball.x = MAP_SIZE - ball.size;
                ball.velocityX *= -1;
            }
            if (ball.y - ball.size < 0) {
                ball.y = ball.size;
                ball.velocityY *= -1;
            }
            if (ball.y + ball.size > MAP_SIZE) {
                ball.y = MAP_SIZE - ball.size;
                ball.velocityY *= -1;
            }

            io.emit('ballMoved', ball);
        }
    }
}

function updateBall() {
    ball.x += ball.velocityX;
    ball.y += ball.velocityY;

    ball.velocityX *= FRICTION;
    ball.velocityY *= FRICTION;

    if (ball.x - ball.size < 0) {
        ball.x = ball.size;
        ball.velocityX *= -1;
    }
    if (ball.x + ball.size > MAP_SIZE) {
        ball.x = MAP_SIZE - ball.size;
        ball.velocityX *= -1;
    }
    if (ball.y - ball.size < 0) {
        ball.y = ball.size;
        ball.velocityY *= -1;
    }
    if (ball.y + ball.size > MAP_SIZE) {
        ball.y = MAP_SIZE - ball.size;
        ball.velocityY *= -1;
    }

    checkBallCollision();

    io.emit('ballMoved', ball);
}

setInterval(() => {
    updatePlayers();
    updateBall();
}, 1000 / FPS); // Update players and ball at 60 FPS

server.listen(port, () => {
  console.log(`Server running at http://127.0.0.1:${port}/`);
});
