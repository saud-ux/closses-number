const socket = io();
const $ = id => document.getElementById(id);

let roomCode = null;
let totalRounds = 10;
let roundDuration = 20;
let currentRound = 0;
let players = [];

// ── Sound FX (light) ─────────────────────────────
const sfx = {
  ctx: null,
  enabled: true,
  init() {
    if (this.ctx) return;
    try { this.ctx = new (window.AudioContext || window.webkitAudioContext)(); } catch (_) {}
  },
  play(type) {
    if (!this.enabled || !this.ctx) return;
    try { this[type](); } catch (_) {}
  },
  _tone(freq, duration, vol = 0.15, waveType = 'sine') {
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = waveType;
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(vol, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + duration);
    osc.connect(gain).connect(this.ctx.destination);
    osc.start();
    osc.stop(this.ctx.currentTime + duration);
  },
  tick() { this._tone(800, 0.08, 0.08); },
  roundStart() {
    this._tone(523, 0.15, 0.12);
    setTimeout(() => this._tone(659, 0.15, 0.12), 120);
    setTimeout(() => this._tone(784, 0.2, 0.15), 240);
  },
  result() {
    this._tone(784, 0.15, 0.12);
    setTimeout(() => this._tone(988, 0.15, 0.12), 150);
    setTimeout(() => this._tone(1175, 0.3, 0.15), 300);
  },
  timeUp() { this._tone(330, 0.4, 0.12, 'square'); },
  gameOver() {
    [523, 659, 784, 1047].forEach((f, i) => {
      setTimeout(() => this._tone(f, 0.25, 0.12), i * 180);
    });
  },
};

document.addEventListener('click', () => sfx.init(), { once: true });

// ── Screen Management ────────────────────────────
function showScreen(id) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  $(id).classList.add('active');
}

function toast(msg) {
  const t = $('toast');
  t.textContent = msg;
  t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), 2500);
}

function esc(str) {
  const d = document.createElement('div');
  d.textContent = str;
  return d.innerHTML;
}

// ── Create Room ──────────────────────────────────
$('btn-create').onclick = () => {
  sfx.init();
  totalRounds = parseInt($('total-rounds')?.value || 10);
  roundDuration = parseInt($('round-duration')?.value || 20);
  socket.emit('create-room', { totalRounds, roundDuration });
};

socket.on('room-created', data => {
  roomCode = data.roomCode;
  $('room-code-display').textContent = roomCode;
  const link = `${location.origin}/play.html?room=${roomCode}`;
  $('room-link-text').textContent = link;
  showScreen('screen-lobby');
});

$('btn-copy-link').onclick = () => {
  const link = `${location.origin}/play.html?room=${roomCode}`;
  navigator.clipboard.writeText(link).then(() => toast('تم نسخ الرابط!'));
};

// ── Settings ─────────────────────────────────────
$('total-rounds').onchange = () => {
  totalRounds = parseInt($('total-rounds').value);
  socket.emit('update-settings', { totalRounds });
};

$('round-duration').onchange = () => {
  roundDuration = parseInt($('round-duration').value);
  socket.emit('update-settings', { roundDuration });
};

// ── Twitch ───────────────────────────────────────
$('btn-twitch-connect').onclick = () => {
  const channel = $('twitch-channel').value.trim();
  if (!channel) return;
  socket.emit('connect-twitch', { channel });
};

$('btn-twitch-disconnect').onclick = () => {
  socket.emit('disconnect-twitch');
};

socket.on('twitch-status', data => {
  const status = $('twitch-status');
  status.classList.remove('hidden');
  if (data.connected) {
    status.className = 'twitch-status connected';
    status.textContent = `✓ متصل بقناة: ${data.channel}`;
    $('btn-twitch-connect').classList.add('hidden');
    $('btn-twitch-disconnect').classList.remove('hidden');
    $('twitch-channel').disabled = true;
  } else {
    status.className = 'twitch-status error';
    status.textContent = data.error ? `✗ ${data.error}` : 'غير متصل';
    $('btn-twitch-connect').classList.remove('hidden');
    $('btn-twitch-disconnect').classList.add('hidden');
    $('twitch-channel').disabled = false;
  }
});

// ── Players ──────────────────────────────────────
function renderPlayers(list) {
  players = list;
  const container = $('players-list-lobby');
  $('player-count-lobby').textContent = list.length;
  $('no-players').style.display = list.length ? 'none' : 'block';
  $('btn-start-game').disabled = list.length === 0;

  container.innerHTML = list.map(p => `
    <div class="player-chip ${p.type}">
      <span class="icon"></span>
      <span>${esc(p.name)}</span>
      <button class="kick-btn" onclick="kickPlayer('${esc(p.name)}')" title="إخراج">✕</button>
    </div>
  `).join('');
}

window.kickPlayer = (name) => {
  socket.emit('kick-player', { name });
};

socket.on('player-joined', data => renderPlayers(data.players));
socket.on('player-left', data => renderPlayers(data.players));

// ── Start Game → Setup First Round ───────────────
$('btn-start-game').onclick = () => {
  sfx.play('roundStart');
  currentRound = 0;
  socket.emit('update-settings', {
    totalRounds: parseInt($('total-rounds').value),
    roundDuration: parseInt($('round-duration').value),
  });
  goToSetup();
};

function goToSetup() {
  $('round-label-setup').textContent = `الجولة ${currentRound + 1}/${totalRounds}`;
  $('question-input').value = '';
  $('answer-input').value = '';
  $('btn-start-round').disabled = true;
  showScreen('screen-setup');
  socket.emit('get-question-bank');
}

// ── Question Bank ────────────────────────────────
socket.on('question-bank', data => {
  const list = $('question-bank-list');
  list.innerHTML = data.questions.map(q => `
    <div class="bank-item ${q.used ? 'used' : ''}" data-index="${q.index}">
      <span class="q-emoji">${q.emoji}</span>
      <span class="q-text">${esc(q.question)}</span>
      ${q.used
        ? '<span class="badge badge-gold" style="font-size:0.75rem;">مُستخدم</span>'
        : `<button class="btn btn-sm btn-secondary" onclick="useQuestion(${q.index}, '${esc(q.question).replace(/'/g, "\\'")}', ${q.answer})">استخدم</button>`
      }
    </div>
  `).join('');
});

window.useQuestion = (index, question, answer) => {
  $('question-input').value = question;
  $('answer-input').value = answer;
  $('btn-start-round').disabled = false;
};

$('question-input').oninput = checkRoundReady;
$('answer-input').oninput = checkRoundReady;

function checkRoundReady() {
  const q = $('question-input').value.trim();
  const a = $('answer-input').value.trim();
  $('btn-start-round').disabled = !(q && a && !isNaN(parseFloat(a)));
}

// ── Start Round ──────────────────────────────────
$('btn-start-round').onclick = () => {
  const question = $('question-input').value.trim();
  const correctAnswer = parseFloat($('answer-input').value);
  if (!question || isNaN(correctAnswer)) return;

  const bankItem = document.querySelector(`.bank-item:not(.used)`);
  let questionIndex;
  document.querySelectorAll('.bank-item').forEach(el => {
    const q = el.querySelector('.q-text');
    if (q && q.textContent === question) {
      questionIndex = parseInt(el.dataset.index);
    }
  });

  socket.emit('start-round', { question, correctAnswer, questionIndex });
};

socket.on('round-started', data => {
  sfx.play('roundStart');
  currentRound = data.roundNumber;
  $('round-label-playing').textContent = `الجولة ${data.roundNumber}/${data.totalRounds}`;
  $('question-display').textContent = data.question;
  $('timer-num').textContent = data.duration;
  $('guess-counter').textContent = `التخمينات: 0/0`;

  const circle = $('timer-circle');
  circle.className = 'timer-circle';
  circle.style.setProperty('--progress', '100%');

  showScreen('screen-playing');
});

// ── Timer ────────────────────────────────────────
socket.on('timer-tick', data => {
  $('timer-num').textContent = data.remaining;
  const circle = $('timer-circle');
  const progress = (data.remaining / roundDuration) * 100;
  circle.style.setProperty('--progress', progress + '%');

  if (data.remaining <= 3) {
    circle.className = 'timer-circle danger';
    sfx.play('tick');
  } else if (data.remaining <= 5) {
    circle.className = 'timer-circle warning';
    sfx.play('tick');
  }
});

$('btn-end-early').onclick = () => socket.emit('end-round-early');

// ── Guess Counter ────────────────────────────────
socket.on('guess-count-updated', data => {
  $('guess-counter').textContent = `التخمينات: ${data.guessed}/${data.total}`;
});

// ── Round Result ─────────────────────────────────
socket.on('round-result', data => {
  sfx.play('result');
  $('round-label-results').textContent = `الجولة ${data.roundNumber}/${data.totalRounds}`;
  $('result-question').textContent = data.question;
  animateNumber($('result-answer'), data.correctAnswer);

  renderRankings(data.rankings);
  if (data.numberLine && data.rankings.length > 0) {
    renderNumberLine(data.numberLine);
    $('numberline-card').classList.remove('hidden');
  } else {
    $('numberline-card').classList.add('hidden');
  }
  renderScoreboard($('scoreboard-results'), data.scores);

  const btn = $('btn-next-round');
  if (data.isLastRound) {
    btn.textContent = 'النتيجة النهائية 🏆';
  } else {
    btn.textContent = 'الجولة التالية ←';
  }
  showScreen('screen-results');
});

function renderRankings(rankings) {
  const list = $('rankings-list');
  if (rankings.length === 0) {
    list.innerHTML = '';
    $('no-guesses').classList.remove('hidden');
    return;
  }
  $('no-guesses').classList.add('hidden');
  const medals = ['🥇', '🥈', '🥉'];
  list.innerHTML = rankings.map((r, i) => `
    <li class="ranking-item" style="animation-delay:${i * 0.08}s">
      <span class="medal">${medals[i] || (i + 1)}</span>
      <span class="r-name">${esc(r.name)}</span>
      <span class="r-value">${r.value}</span>
      <span class="r-diff">(فرق: ${r.difference})</span>
      <span class="r-pts">${r.points > 0 ? '+' + r.points + ' نقاط' : ''}</span>
    </li>
  `).join('');
}

function renderNumberLine(nl) {
  const container = $('number-line-container');
  let html = '<div class="number-line">';

  html += `<div class="nl-correct" style="left:${nl.correctPosition}%">
    <span class="nl-val">${nl.correctAnswer}</span>
    <span class="star">⭐</span>
  </div>`;

  const colors = ['#2ecc71', '#3498db', '#9b59b6', '#e67e22', '#e74c3c', '#1abc9c', '#e91e63', '#ff9800'];
  nl.points.slice(0, 8).forEach((p, i) => {
    const color = colors[i % colors.length];
    html += `<div class="nl-point" style="left:${p.position}%">
      <div class="nl-dot" style="background:${color}"></div>
      <span class="nl-val">${p.value}</span>
      <span class="nl-label">${esc(p.name)}</span>
    </div>`;
  });

  html += '</div>';
  container.innerHTML = html;
}

function renderScoreboard(container, scores) {
  let html = '<h3>🏅 لوحة النقاط</h3>';
  scores.forEach((p, i) => {
    html += `<div class="score-row">
      <span class="s-rank">${i + 1}</span>
      <span class="s-type">${p.type === 'twitch' ? '🟣' : '🌐'}</span>
      <span class="s-name">${esc(p.name)}</span>
      <span class="s-score">${p.score}</span>
    </div>`;
  });
  container.innerHTML = html;
}

// ── Next Round / Game Over ───────────────────────
$('btn-next-round').onclick = () => socket.emit('next-round');

socket.on('prepare-next-round', data => {
  currentRound = data.currentRound - 1;
  totalRounds = data.totalRounds;
  goToSetup();
});

socket.on('game-over', data => {
  sfx.play('gameOver');
  renderGameOver(data.finalScores);
  showScreen('screen-gameover');
});

function renderGameOver(scores) {
  const medals = ['🥇', '🥈', '🥉'];
  const podium = $('final-podium');
  let podiumHtml = '';
  scores.slice(0, 3).forEach((p, i) => {
    const sizes = ['3rem', '2.2rem', '1.8rem'];
    podiumHtml += `<div style="margin:16px 0;animation:slideUp 0.5s ease ${i * 0.2}s backwards;">
      <span style="font-size:${sizes[i]}">${medals[i]}</span>
      <span style="font-size:1.3rem;font-weight:700;margin:0 8px;">${esc(p.name)}</span>
      <span class="badge badge-gold">${p.score} نقطة</span>
    </div>`;
  });
  podium.innerHTML = podiumHtml;

  renderScoreboard($('final-scoreboard'), scores);
}

$('btn-play-again').onclick = () => {
  socket.emit('reset-game');
};

socket.on('game-reset', data => {
  renderPlayers(data.players);
  showScreen('screen-lobby');
});

// ── Animate Number ───────────────────────────────
function animateNumber(el, target) {
  const duration = 1000;
  const startTime = performance.now();
  const absTarget = Math.abs(target);
  const sign = target < 0 ? '-' : '';

  function step(now) {
    const elapsed = now - startTime;
    const progress = Math.min(elapsed / duration, 1);
    const eased = 1 - Math.pow(1 - progress, 3);
    const current = Math.round(absTarget * eased);
    el.textContent = sign + current.toLocaleString();
    if (progress < 1) requestAnimationFrame(step);
  }
  requestAnimationFrame(step);
}

// ── Error Handling ───────────────────────────────
socket.on('error-msg', data => toast(data.message));
socket.on('room-closed', () => {
  toast('الغرفة أُغلقت');
  showScreen('screen-create');
});
