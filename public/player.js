const socket = io();
const $ = id => document.getElementById(id);

let myName = null;
let roundDuration = 20;

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
  _tone(freq, dur, vol = 0.12, wave = 'sine') {
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = wave;
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(vol, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + dur);
    osc.connect(gain).connect(this.ctx.destination);
    osc.start();
    osc.stop(this.ctx.currentTime + dur);
  },
  pop() { this._tone(600, 0.1, 0.1); },
  tick() { this._tone(800, 0.06, 0.06); },
  win() {
    this._tone(784, 0.15, 0.12);
    setTimeout(() => this._tone(988, 0.15, 0.12), 120);
    setTimeout(() => this._tone(1175, 0.25, 0.15), 240);
  },
  lose() { this._tone(330, 0.3, 0.08, 'triangle'); },
};

document.addEventListener('click', () => sfx.init(), { once: true });
document.addEventListener('touchstart', () => sfx.init(), { once: true });

// ── Screens ──────────────────────────────────────
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

// ── Auto-fill room code from URL ─────────────────
const params = new URLSearchParams(location.search);
const roomFromUrl = params.get('room');
if (roomFromUrl) {
  $('p-room-code').value = roomFromUrl;
}

// ── Join ─────────────────────────────────────────
$('p-btn-join').onclick = () => joinRoom();
$('p-room-code').addEventListener('keydown', e => { if (e.key === 'Enter') $('p-player-name').focus(); });
$('p-player-name').addEventListener('keydown', e => { if (e.key === 'Enter') joinRoom(); });

function joinRoom() {
  sfx.init();
  const code = $('p-room-code').value.trim();
  const name = $('p-player-name').value.trim();
  if (!code || code.length !== 4) return toast('أدخل كود الغرفة (4 أرقام)');
  if (!name) return toast('أدخل اسمك');
  socket.emit('join-room', { roomCode: code, playerName: name });
}

socket.on('joined', data => {
  myName = data.playerName;
  showScreen('p-screen-waiting');
});

// ── Round Start ──────────────────────────────────
socket.on('round-started', data => {
  sfx.play('pop');
  roundDuration = data.duration;
  $('p-round-label').textContent = `الجولة ${data.roundNumber}/${data.totalRounds}`;
  $('p-question').textContent = data.question;
  $('p-timer-num').textContent = data.duration;

  const circle = $('p-timer-circle');
  circle.className = 'timer-circle';
  circle.style.setProperty('--progress', '100%');

  $('p-guess-input').value = '';
  $('p-guess-card').classList.remove('hidden');
  $('p-guess-sent').classList.add('hidden');

  showScreen('p-screen-playing');
  setTimeout(() => $('p-guess-input').focus(), 300);
});

// ── Timer ────────────────────────────────────────
socket.on('timer-tick', data => {
  $('p-timer-num').textContent = data.remaining;
  const circle = $('p-timer-circle');
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

// ── Submit Guess ─────────────────────────────────
$('p-btn-guess').onclick = () => submitGuess();
$('p-guess-input').addEventListener('keydown', e => { if (e.key === 'Enter') submitGuess(); });

function submitGuess() {
  const val = $('p-guess-input').value.trim();
  if (!val) return toast('أدخل تخمينك');
  socket.emit('submit-guess', { guess: val });
  try { navigator.vibrate && navigator.vibrate(50); } catch (_) {}
}

socket.on('guess-confirmed', data => {
  sfx.play('pop');
  $('p-guess-card').classList.add('hidden');
  $('p-guess-sent').classList.remove('hidden');
  $('p-sent-value').textContent = data.value;
});

// ── Your Result ──────────────────────────────────
socket.on('your-result', data => {
  $('p-correct-answer').textContent = data.yourGuess !== null ? '' : '';

  if (data.missed) {
    $('p-result-details').classList.add('hidden');
    $('p-missed-section').classList.remove('hidden');
    sfx.play('lose');
  } else {
    $('p-result-details').classList.remove('hidden');
    $('p-missed-section').classList.add('hidden');
    $('p-your-guess').textContent = data.yourGuess;
    $('p-your-diff').textContent = data.difference;

    const rankBadge = $('p-rank-badge');
    const rankSection = $('p-rank-section');
    if (data.rank <= 3) {
      const medals = ['', '🥇 الأقرب!', '🥈 الثاني!', '🥉 الثالث!'];
      rankBadge.textContent = medals[data.rank];
      rankBadge.className = `rank-badge rank-${data.rank}`;
      rankSection.classList.remove('hidden');
      sfx.play('win');
      try { navigator.vibrate && navigator.vibrate([100, 50, 100]); } catch (_) {}
      if (data.rank === 1) launchConfetti();
    } else {
      rankBadge.textContent = `المركز ${data.rank} من ${data.totalPlayers}`;
      rankBadge.className = 'rank-badge';
      rankBadge.style.background = 'rgba(255,255,255,0.05)';
      rankBadge.style.color = 'var(--text-dim)';
      rankSection.classList.remove('hidden');
      sfx.play('lose');
    }

    $('p-your-points').textContent = data.points > 0 ? `+${data.points} نقاط` : '';
  }

  $('p-total-score').textContent = `${data.totalScore} نقطة`;
  showScreen('p-screen-result');
});

socket.on('round-result', data => {
  animateNumber($('p-correct-answer'), data.correctAnswer);
});

// ── Next Round ───────────────────────────────────
socket.on('prepare-next-round', () => {
  showScreen('p-screen-waiting');
});

// ── Game Over ────────────────────────────────────
socket.on('game-over', data => {
  const scores = data.finalScores;
  const myIdx = scores.findIndex(s => s.name === myName);

  let html = '';
  if (myIdx >= 0) {
    const medals = ['🥇', '🥈', '🥉'];
    const myRank = myIdx + 1;
    html += `<div style="font-size:2.5rem;margin-bottom:12px;">${medals[myIdx] || '🏅'}</div>`;
    html += `<p style="font-size:1.3rem;font-weight:700;">ترتيبك: ${myRank} من ${scores.length}</p>`;
    html += `<p style="font-size:1.5rem;font-weight:900;color:var(--gold);margin-top:4px;">${scores[myIdx].score} نقطة</p>`;

    if (myIdx < 3) launchConfetti();
  }
  $('p-final-rank').innerHTML = html;

  let scoresHtml = '<div class="scoreboard" style="text-align:right;">';
  scoresHtml += '<h3 style="margin-bottom:12px;">🏅 الترتيب النهائي</h3>';
  scores.forEach((p, i) => {
    const isMe = p.name === myName;
    scoresHtml += `<div class="score-row" style="${isMe ? 'background:rgba(241,196,15,0.1);' : ''}">
      <span class="s-rank">${i + 1}</span>
      <span class="s-name" style="${isMe ? 'color:var(--gold);font-weight:700;' : ''}">${esc(p.name)}</span>
      <span class="s-score">${p.score}</span>
    </div>`;
  });
  scoresHtml += '</div>';
  $('p-final-scores').innerHTML = scoresHtml;

  showScreen('p-screen-gameover');
});

// ── Disconnects ──────────────────────────────────
socket.on('kicked', () => showScreen('p-screen-kicked'));
socket.on('room-closed', () => showScreen('p-screen-closed'));
socket.on('game-reset', () => showScreen('p-screen-waiting'));

// ── Error ────────────────────────────────────────
socket.on('error-msg', data => toast(data.message));

// ── Confetti ─────────────────────────────────────
function launchConfetti() {
  const canvas = $('confetti-canvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;

  const pieces = [];
  const confettiColors = ['#f1c40f', '#e74c3c', '#2ecc71', '#3498db', '#9b59b6', '#e67e22'];
  for (let i = 0; i < 80; i++) {
    pieces.push({
      x: Math.random() * canvas.width,
      y: Math.random() * canvas.height - canvas.height,
      w: Math.random() * 8 + 4,
      h: Math.random() * 5 + 2,
      color: confettiColors[Math.floor(Math.random() * confettiColors.length)],
      vx: (Math.random() - 0.5) * 3,
      vy: Math.random() * 2 + 1.5,
      rot: Math.random() * 360,
      rotSpeed: (Math.random() - 0.5) * 8,
      opacity: 1,
    });
  }

  let frame = 0;
  function animate() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    frame++;
    for (const p of pieces) {
      p.x += p.vx;
      p.y += p.vy;
      p.rot += p.rotSpeed;
      p.vy += 0.03;
      if (frame > 100) p.opacity -= 0.012;
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate((p.rot * Math.PI) / 180);
      ctx.globalAlpha = Math.max(0, p.opacity);
      ctx.fillStyle = p.color;
      ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
      ctx.restore();
    }
    if (frame < 200 && pieces.some(p => p.opacity > 0)) {
      requestAnimationFrame(animate);
    } else {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
    }
  }
  requestAnimationFrame(animate);
}

// ── Helpers ──────────────────────────────────────
function animateNumber(el, target) {
  const duration = 1000;
  const startTime = performance.now();
  const absTarget = Math.abs(target);
  const sign = target < 0 ? '-' : '';
  function step(now) {
    const elapsed = now - startTime;
    const progress = Math.min(elapsed / duration, 1);
    const eased = 1 - Math.pow(1 - progress, 3);
    el.textContent = sign + Math.round(absTarget * eased).toLocaleString();
    if (progress < 1) requestAnimationFrame(step);
  }
  requestAnimationFrame(step);
}

function esc(str) {
  const d = document.createElement('div');
  d.textContent = str;
  return d.innerHTML;
}
