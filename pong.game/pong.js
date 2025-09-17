const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');

const overlay = document.getElementById('overlay');
const startButton = document.getElementById('start');
const restartButton = document.getElementById('restart');
const playerScoreEl = document.getElementById('playerScore');
const cpuScoreEl = document.getElementById('cpuScore');
const overlayTitle = overlay.querySelector('h1');
const overlayMessage = overlay.querySelector('p');

const PADDLE = {
  width: 14,
  height: 120,
  minHeight: 90,
  maxHeight: 160,
  speed: 540,
};

const BALL = {
  radius: 10,
  baseSpeed: 420,
  maxSpeed: 980,
};

const WIN_SCORE = 7;

const player = {
  x: 24,
  y: canvas.height / 2 - PADDLE.height / 2,
  width: PADDLE.width,
  height: PADDLE.height,
  targetY: canvas.height / 2,
};

const cpu = {
  x: canvas.width - 24 - PADDLE.width,
  y: canvas.height / 2 - (PADDLE.height - 40) / 2,
  width: PADDLE.width,
  height: PADDLE.height - 40,
  drift: 0,
};

const ball = {
  x: canvas.width / 2,
  y: canvas.height / 2,
  vx: 0,
  vy: 0,
  speed: BALL.baseSpeed,
};

const state = {
  running: false,
  gameOver: false,
  scores: {
    player: 0,
    cpu: 0,
  },
  lastDirection: Math.random() > 0.5 ? 1 : -1,
};

const keys = {
  up: false,
  down: false,
};

let lastTime = performance.now();
requestAnimationFrame(loop);

function loop(timestamp) {
  const delta = Math.min((timestamp - lastTime) / 1000, 0.05);
  lastTime = timestamp;

  update(delta);
  render();

  requestAnimationFrame(loop);
}

function update(delta) {
  if (!state.running) {
    applyIdleGlow(delta);
    return;
  }

  updatePlayer(delta);
  updateCpu(delta);
  updateBall(delta);
}

function updatePlayer(delta) {
  if (keys.up) {
    player.targetY -= PADDLE.speed * delta;
  } else if (keys.down) {
    player.targetY += PADDLE.speed * delta;
  }

  const halfHeight = player.height / 2;
  const clampedTarget = clamp(player.targetY, halfHeight, canvas.height - halfHeight);
  player.targetY = clampedTarget;

  const center = player.y + halfHeight;
  const distance = clampedTarget - center;
  const move = Math.sign(distance) * Math.min(Math.abs(distance), PADDLE.speed * delta * 0.9);
  player.y += move;
}

function updateCpu(delta) {
  const trackingStrength = 0.9 - Math.min(ball.speed / BALL.maxSpeed, 0.7);
  const ballAhead = ball.vx > 0;
  const targetCenter = ballAhead ? ball.y + cpu.drift : canvas.height / 2;

  const halfHeight = cpu.height / 2;
  const desired = clamp(targetCenter, halfHeight + 16, canvas.height - halfHeight - 16);
  const center = cpu.y + halfHeight;
  const diff = desired - center;
  const moveAmount = Math.sign(diff) * Math.min(Math.abs(diff), (PADDLE.speed * trackingStrength) * delta);
  cpu.y += moveAmount;

  cpu.drift = lerp(cpu.drift, randomRange(-40, 40), 0.005);
}

function updateBall(delta) {
  ball.x += ball.vx * delta;
  ball.y += ball.vy * delta;

  if (ball.y - BALL.radius <= 0 || ball.y + BALL.radius >= canvas.height) {
    ball.vy *= -1;
    ball.y = clamp(ball.y, BALL.radius, canvas.height - BALL.radius);
    flashGlow(ball.y < canvas.height / 2 ? 'top' : 'bottom');
  }

  if (ball.vx < 0 && intersects(player)) {
    bounceOffPaddle(player, true);
    flashGlow('left');
  } else if (ball.vx > 0 && intersects(cpu)) {
    bounceOffPaddle(cpu, false);
    flashGlow('right');
  }

  if (ball.x < -BALL.radius) {
    awardPoint('cpu');
  } else if (ball.x > canvas.width + BALL.radius) {
    awardPoint('player');
  }
}

function applyIdleGlow(delta) {
  cpu.drift = lerp(cpu.drift, 0, 0.03);
  const idleWobble = Math.sin(performance.now() / 600) * 0.25;
  ball.x = lerp(ball.x, canvas.width / 2 + Math.sin(performance.now() / 1000) * 80, delta * 2.5);
  ball.y = lerp(ball.y, canvas.height / 2 + idleWobble * 120, delta * 2.5);
}

function bounceOffPaddle(paddle, isLeftPaddle) {
  const relativeIntersect = (paddle.y + paddle.height / 2) - ball.y;
  const normalized = relativeIntersect / (paddle.height / 2);
  const bounceAngle = normalized * (Math.PI / 3);
  const newSpeed = clamp(ball.speed * 1.05, BALL.baseSpeed, BALL.maxSpeed);
  const horizontalDirection = isLeftPaddle ? 1 : -1;

  ball.speed = newSpeed;
  ball.vx = newSpeed * Math.cos(bounceAngle) * horizontalDirection;
  ball.vy = newSpeed * -Math.sin(bounceAngle);

  const paddleEdge = isLeftPaddle
    ? paddle.x + paddle.width + BALL.radius
    : paddle.x - BALL.radius;
  ball.x = paddleEdge;
}

function awardPoint(side) {
  state.scores[side] += 1;
  updateScoreboard();

  if (state.scores[side] >= WIN_SCORE) {
    endGame(side === 'player');
  } else {
    state.running = false;
    state.lastDirection = side === 'player' ? -1 : 1;
    setTimeout(() => {
      resetRound(state.lastDirection);
      state.running = true;
    }, 700);
  }
}

function endGame(playerWon) {
  state.gameOver = true;
  state.running = false;
  const title = playerWon ? 'Victory!' : 'CPU Wins';
  const message = playerWon
    ? 'You dominated the arena. Click play to run it back.'
    : 'The CPU outplayed you this time. Study the angles and try again!';
  showOverlay(title, message, 'Play Again');
}

function resetRound(direction = 1) {
  ball.x = canvas.width / 2;
  ball.y = canvas.height / 2;
  ball.speed = BALL.baseSpeed;
  const angle = randomRange(-Math.PI / 4, Math.PI / 4);
  ball.vx = ball.speed * Math.cos(angle) * direction;
  ball.vy = ball.speed * Math.sin(angle);

  player.y = canvas.height / 2 - player.height / 2;
  player.targetY = canvas.height / 2;
  cpu.y = canvas.height / 2 - cpu.height / 2;
  cpu.drift = 0;
}

function updateScoreboard() {
  playerScoreEl.textContent = state.scores.player;
  cpuScoreEl.textContent = state.scores.cpu;
}

function intersects(paddle) {
  return (
    ball.x - BALL.radius < paddle.x + paddle.width &&
    ball.x + BALL.radius > paddle.x &&
    ball.y - BALL.radius < paddle.y + paddle.height &&
    ball.y + BALL.radius > paddle.y
  );
}

function startGame() {
  hideOverlay();
  state.running = true;
  state.gameOver = false;
  state.lastDirection = Math.random() > 0.5 ? 1 : -1;
  resetRound(state.lastDirection);
}

function restartGame() {
  state.scores.player = 0;
  state.scores.cpu = 0;
  updateScoreboard();
  startGame();
}

function showOverlay(title, message, buttonText) {
  overlayTitle.textContent = title;
  overlayMessage.textContent = message;
  startButton.textContent = buttonText;
  overlay.classList.remove('hidden');
}

function hideOverlay() {
  overlay.classList.add('hidden');
}

function render() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  drawCenterLine();
  drawGlowCircle(ball.x, ball.y, 24, 'rgba(91, 194, 255, 0.18)');
  drawBall();
  drawPaddle(player, 'rgba(91, 194, 255, 0.85)');
  drawPaddle(cpu, 'rgba(255, 77, 255, 0.85)');
}

function drawCenterLine() {
  const segmentHeight = 24;
  const gap = 18;
  ctx.fillStyle = 'rgba(91, 194, 255, 0.25)';
  for (let y = gap; y < canvas.height - segmentHeight; y += segmentHeight + gap) {
    ctx.fillRect(canvas.width / 2 - 2, y, 4, segmentHeight);
  }
}

function drawBall() {
  ctx.beginPath();
  ctx.fillStyle = '#ffffff';
  ctx.shadowColor = 'rgba(91, 194, 255, 0.9)';
  ctx.shadowBlur = 25;
  ctx.arc(ball.x, ball.y, BALL.radius, 0, Math.PI * 2);
  ctx.fill();
  ctx.shadowBlur = 0;
}

function drawPaddle(paddle, color) {
  ctx.shadowColor = color;
  ctx.shadowBlur = 25;
  ctx.fillStyle = 'rgba(6, 15, 36, 0.65)';
  ctx.fillRect(paddle.x, paddle.y, paddle.width, paddle.height);
  ctx.shadowBlur = 0;
  ctx.strokeStyle = color;
  ctx.lineWidth = 2.5;
  ctx.strokeRect(paddle.x - 1.5, paddle.y - 1.5, paddle.width + 3, paddle.height + 3);
  ctx.fillStyle = color;
  ctx.globalAlpha = 0.18;
  ctx.fillRect(paddle.x, paddle.y, paddle.width, paddle.height);
  ctx.globalAlpha = 1;
}

function drawGlowCircle(x, y, radius, color) {
  const gradient = ctx.createRadialGradient(x, y, 0, x, y, radius);
  gradient.addColorStop(0, color);
  gradient.addColorStop(1, 'rgba(91, 194, 255, 0)');
  ctx.fillStyle = gradient;
  ctx.beginPath();
  ctx.arc(x, y, radius, 0, Math.PI * 2);
  ctx.fill();
}

function flashGlow(side) {
  const root = document.documentElement;
  const prop = `--pulse-${side}`;
  root.style.setProperty(prop, '1');
  setTimeout(() => root.style.setProperty(prop, '0'), 140);
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function lerp(start, end, t) {
  return start + (end - start) * t;
}

function randomRange(min, max) {
  return Math.random() * (max - min) + min;
}

canvas.addEventListener('mousemove', (event) => {
  const rect = canvas.getBoundingClientRect();
  const scaleY = canvas.height / rect.height;
  const y = (event.clientY - rect.top) * scaleY;
  player.targetY = y;
});

window.addEventListener('keydown', (event) => {
  if (event.key === 'ArrowUp' || event.key === 'w') {
    keys.up = true;
  }
  if (event.key === 'ArrowDown' || event.key === 's') {
    keys.down = true;
  }
  if (!state.running && !state.gameOver && (event.key === ' ' || event.key === 'Enter')) {
    startGame();
  }
});

window.addEventListener('keyup', (event) => {
  if (event.key === 'ArrowUp' || event.key === 'w') {
    keys.up = false;
  }
  if (event.key === 'ArrowDown' || event.key === 's') {
    keys.down = false;
  }
});

startButton.addEventListener('click', () => {
  if (state.gameOver) {
    restartGame();
  } else {
    startGame();
  }
});

restartButton.addEventListener('click', () => {
  restartGame();
});

showOverlay('Neon Pong', 'Move your paddle with the mouse or arrow keys. First to 7 points wins.', 'Play');
updateScoreboard();
resetRound(state.lastDirection);
