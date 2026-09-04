const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

let tmi;
try { tmi = require('tmi.js'); } catch (_) { tmi = null; }

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: '*' } });

app.use(express.static(path.join(__dirname, 'public')));

app.get('/download-offline', (req, res) => {
  res.download(path.join(__dirname, 'public', 'offline.html'), 'أقرب-رقم-بدون-نت.html');
});

// ── Question Bank ──────────────────────────────────────────────
const questionBank = [
  { category: 'جغرافيا', emoji: '🌍', question: 'كم عدد دول العالم؟', answer: 195 },
  { category: 'جغرافيا', emoji: '🛣️', question: 'كم المسافة بين الرياض وجدة بالكيلومتر؟', answer: 949 },
  { category: 'جغرافيا', emoji: '🗺️', question: 'كم مساحة السعودية بالكيلومتر المربع؟', answer: 2149690 },
  { category: 'جغرافيا', emoji: '👥', question: 'كم عدد سكان مصر بالمليون (تقريباً)؟', answer: 105 },
  { category: 'جغرافيا', emoji: '🏙️', question: 'كم ارتفاع برج خليفة بالمتر؟', answer: 828 },
  { category: 'جغرافيا', emoji: '🏝️', question: 'كم عدد جزر إندونيسيا؟', answer: 17508 },
  { category: 'جغرافيا', emoji: '🌊', question: 'كم عمق أعمق نقطة في المحيط بالمتر؟', answer: 10994 },
  { category: 'جغرافيا', emoji: '🏔️', question: 'كم ارتفاع جبل إيفرست بالمتر؟', answer: 8849 },
  { category: 'علوم', emoji: '🦴', question: 'كم عدد عظام جسم الإنسان البالغ؟', answer: 206 },
  { category: 'علوم', emoji: '🦷', question: 'كم عدد أسنان الإنسان البالغ؟', answer: 32 },
  { category: 'علوم', emoji: '🌡️', question: 'كم درجة حرارة الإنسان الطبيعية؟', answer: 37 },
  { category: 'علوم', emoji: '🧬', question: 'كم عدد كروموسومات الإنسان؟', answer: 46 },
  { category: 'علوم', emoji: '🌙', question: 'كم المسافة بين الأرض والقمر بالكيلومتر؟', answer: 384400 },
  { category: 'علوم', emoji: '🪐', question: 'كم عدد كواكب المجموعة الشمسية؟', answer: 8 },
  { category: 'علوم', emoji: '💡', question: 'كم سرعة الضوء بالكيلومتر في الثانية؟', answer: 299792 },
  { category: 'علوم', emoji: '❤️', question: 'كم مرة ينبض قلب الإنسان في الدقيقة (تقريباً)؟', answer: 72 },
  { category: 'رياضة', emoji: '⚽', question: 'كم عدد لاعبي فريق كرة القدم؟', answer: 11 },
  { category: 'رياضة', emoji: '🏟️', question: 'كم طول ملعب كرة القدم بالمتر (تقريباً)؟', answer: 105 },
  { category: 'رياضة', emoji: '🏆', question: 'في أي سنة أُقيمت أول بطولة كأس عالم؟', answer: 1930 },
  { category: 'رياضة', emoji: '🇧🇷', question: 'كم عدد بطولات كأس العالم اللي فازت فيها البرازيل؟', answer: 5 },
  { category: 'رياضة', emoji: '🏀', question: 'كم ارتفاع سلة كرة السلة بالسنتيمتر؟', answer: 305 },
  { category: 'تاريخ', emoji: '📞', question: 'في أي سنة ميلادية اخترع الهاتف؟', answer: 1876 },
  { category: 'تاريخ', emoji: '🚀', question: 'في أي سنة هبط أول إنسان على القمر؟', answer: 1969 },
  { category: 'تاريخ', emoji: '🇸🇦', question: 'في أي سنة تأسست المملكة العربية السعودية؟', answer: 1932 },
  { category: 'تاريخ', emoji: '🌐', question: 'في أي سنة اخترعت شبكة الإنترنت؟', answer: 1983 },
  { category: 'إسلامية', emoji: '📖', question: 'كم عدد سور القرآن الكريم؟', answer: 114 },
  { category: 'إسلامية', emoji: '📜', question: 'كم عدد آيات سورة البقرة؟', answer: 286 },
  { category: 'إسلامية', emoji: '✨', question: 'كم عدد أحرف البسملة؟', answer: 19 },
  { category: 'أرقام', emoji: '⏱️', question: 'كم ثانية في اليوم؟', answer: 86400 },
  { category: 'أرقام', emoji: '🕐', question: 'كم ساعة في السنة؟', answer: 8760 },
  { category: 'أرقام', emoji: '📅', question: 'كم يوم في 4 سنوات (مع السنة الكبيسة)؟', answer: 1461 },
  { category: 'أرقام', emoji: '🔢', question: 'كم عدد الدقائق في الأسبوع؟', answer: 10080 },
];

// ── Helpers ─────────────────────────────────────────────────────
const rooms = new Map();
const hostRooms = new Map(); // persistentHostId → roomCode

function generateRoomCode() {
  let code;
  do {
    code = Math.floor(1000 + Math.random() * 9000).toString();
  } while (rooms.has(code));
  return code;
}

function extractNumber(message) {
  let text = message.replace(/[٠-٩]/g, d => '٠١٢٣٤٥٦٧٨٩'.indexOf(d).toString());
  text = text.replace(/,/g, '');
  const match = text.match(/-?\d+\.?\d*/);
  if (!match) return null;
  return parseFloat(match[0]);
}

function rankGuesses(guessesArr, correctAnswer) {
  return guessesArr
    .map(g => ({ ...g, difference: Math.abs(g.value - correctAnswer) }))
    .sort((a, b) => {
      if (a.difference !== b.difference) return a.difference - b.difference;
      return a.timestamp - b.timestamp;
    });
}

function buildNumberLine(ranked, correctAnswer) {
  const values = ranked.map(r => r.value).concat(correctAnswer);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const padding = range * 0.12;
  const lineMin = min - padding;
  const lineMax = max + padding;
  const lineRange = lineMax - lineMin;

  const points = ranked.map(r => ({
    name: r.playerName,
    value: r.value,
    difference: r.difference,
    position: ((r.value - lineMin) / lineRange) * 100,
  }));

  const correctPos = ((correctAnswer - lineMin) / lineRange) * 100;
  return { points, correctAnswer, correctPosition: correctPos, min: lineMin, max: lineMax };
}

function getPlayersArray(room) {
  return [...room.players.values()].map(p => ({ name: p.name, type: p.type, score: p.score }));
}

// ── Socket.IO ───────────────────────────────────────────────────
io.on('connection', (socket) => {
  let currentRoom = null;
  let role = null;
  let playerName = null;
  let watchingHostId = null;

  // ── Host: Create Room ──
  socket.on('create-room', (data) => {
    const code = generateRoomCode();
    const persistentHostId = data && data.hostId;
    const room = {
      code,
      hostSocketId: socket.id,
      persistentHostId,
      players: new Map(),
      overlays: new Set(),
      state: 'lobby',
      settings: {
        totalRounds: (data && data.totalRounds) || 10,
        roundDuration: (data && data.roundDuration) || 20,
      },
      currentRound: 0,
      question: null,
      correctAnswer: null,
      guesses: new Map(),
      usedQuestions: new Set(),
      timer: null,
      remaining: 0,
      twitchClient: null,
      twitchChannel: null,
    };
    rooms.set(code, room);
    currentRoom = code;
    role = 'host';
    socket.join(code);

    if (persistentHostId) {
      hostRooms.set(persistentHostId, code);
      io.to(`hostwatch:${persistentHostId}`).emit('host-room-changed', {
        roomCode: code,
        settings: room.settings,
        players: [],
        state: room.state,
        currentRound: 0,
      });
    }

    socket.emit('room-created', { roomCode: code });
  });

  // ── Host: Update Settings ──
  socket.on('update-settings', (data) => {
    const room = rooms.get(currentRoom);
    if (!room || room.hostSocketId !== socket.id) return;
    if (data.totalRounds) room.settings.totalRounds = parseInt(data.totalRounds);
    if (data.roundDuration) room.settings.roundDuration = parseInt(data.roundDuration);
    io.to(currentRoom).emit('settings-updated', room.settings);
  });

  // ── Player: Join Room ──
  socket.on('join-room', (data) => {
    const { roomCode, playerName: name } = data;
    const room = rooms.get(roomCode);
    if (!room) return socket.emit('error-msg', { message: 'الغرفة غير موجودة' });
    if (room.state === 'playing') {
      return socket.emit('error-msg', { message: 'الجولة قائمة، انتظر الجولة القادمة' });
    }

    const existingNames = [...room.players.values()].map(p => p.name);
    if (existingNames.includes(name)) {
      return socket.emit('error-msg', { message: 'الاسم مستخدم، اختر اسم ثاني' });
    }

    room.players.set(socket.id, { name, type: 'web', score: 0 });
    currentRoom = roomCode;
    role = 'player';
    playerName = name;
    socket.join(roomCode);

    socket.emit('joined', {
      roomCode,
      playerName: name,
      roundInfo: room.state !== 'lobby' ? {
        currentRound: room.currentRound,
        totalRounds: room.settings.totalRounds,
        state: room.state,
      } : null,
    });

    io.to(roomCode).emit('player-joined', {
      name,
      type: 'web',
      playerCount: room.players.size,
      players: getPlayersArray(room),
    });
  });

  // ── Overlay: Join by room code (legacy) ──
  socket.on('join-overlay', (data) => {
    const room = rooms.get(data.roomCode);
    if (!room) return socket.emit('error-msg', { message: 'الغرفة غير موجودة' });
    currentRoom = data.roomCode;
    role = 'overlay';
    room.overlays.add(socket.id);
    socket.join(data.roomCode);
    socket.emit('overlay-joined', {
      roomCode: data.roomCode,
      settings: room.settings,
      players: getPlayersArray(room),
      state: room.state,
      currentRound: room.currentRound,
    });
  });

  // ── Overlay: Join by persistent host ID (auto-connect) ──
  socket.on('join-overlay-by-host', (data) => {
    const { hostId } = data;
    watchingHostId = hostId;
    role = 'overlay';
    socket.join(`hostwatch:${hostId}`);

    const roomCode = hostRooms.get(hostId);
    if (roomCode && rooms.has(roomCode)) {
      const room = rooms.get(roomCode);
      currentRoom = roomCode;
      room.overlays.add(socket.id);
      socket.join(roomCode);
      socket.emit('overlay-joined', {
        roomCode,
        settings: room.settings,
        players: getPlayersArray(room),
        state: room.state,
        currentRound: room.currentRound,
      });
    } else {
      socket.emit('waiting-for-host');
    }
  });

  // ── Host: Question Bank ──
  socket.on('get-question-bank', () => {
    const room = rooms.get(currentRoom);
    if (!room || room.hostSocketId !== socket.id) return;
    const available = questionBank
      .map((q, i) => ({ ...q, index: i, used: room.usedQuestions.has(i) }));
    socket.emit('question-bank', { questions: available });
  });

  // ── Host: Start Round ──
  socket.on('start-round', (data) => {
    const room = rooms.get(currentRoom);
    if (!room || room.hostSocketId !== socket.id) return;
    if (room.currentRound >= room.settings.totalRounds) return;

    room.currentRound++;
    room.question = data.question;
    room.correctAnswer = parseFloat(data.correctAnswer);
    room.guesses = new Map();
    room.state = 'playing';

    if (data.questionIndex !== undefined && data.questionIndex !== null) {
      room.usedQuestions.add(data.questionIndex);
    }

    const roundData = {
      roundNumber: room.currentRound,
      totalRounds: room.settings.totalRounds,
      question: room.question,
      duration: room.settings.roundDuration,
    };

    io.to(currentRoom).emit('round-started', roundData);

    let remaining = room.settings.roundDuration;
    room.remaining = remaining;

    room.timer = setInterval(() => {
      remaining--;
      room.remaining = remaining;
      io.to(currentRoom).emit('timer-tick', { remaining });

      if (remaining <= 0) {
        clearInterval(room.timer);
        room.timer = null;
        endRound(room);
      }
    }, 1000);
  });

  // ── Player: Submit Guess ──
  socket.on('submit-guess', (data) => {
    const room = rooms.get(currentRoom);
    if (!room || room.state !== 'playing') return;

    const playerId = socket.id;
    if (room.guesses.has(playerId)) {
      return socket.emit('error-msg', { message: 'سبق وأرسلت تخمينك' });
    }

    const value = extractNumber(String(data.guess));
    if (value === null) {
      return socket.emit('error-msg', { message: 'أرسل رقم صحيح' });
    }

    const player = room.players.get(playerId);
    if (!player) return;

    room.guesses.set(playerId, {
      playerId,
      playerName: player.name,
      value,
      timestamp: Date.now(),
    });

    socket.emit('guess-confirmed', { value });

    io.to(currentRoom).emit('guess-count-updated', {
      guessed: room.guesses.size,
      total: room.players.size,
    });

    if (room.guesses.size >= room.players.size) {
      clearInterval(room.timer);
      room.timer = null;
      setTimeout(() => endRound(room), 500);
    }
  });

  // ── Host: End Round Early ──
  socket.on('end-round-early', () => {
    const room = rooms.get(currentRoom);
    if (!room || room.hostSocketId !== socket.id || room.state !== 'playing') return;
    if (room.timer) { clearInterval(room.timer); room.timer = null; }
    endRound(room);
  });

  // ── Host: Next Round ──
  socket.on('next-round', () => {
    const room = rooms.get(currentRoom);
    if (!room || room.hostSocketId !== socket.id) return;

    if (room.currentRound >= room.settings.totalRounds) {
      const finalScores = getPlayersArray(room).sort((a, b) => b.score - a.score);
      room.state = 'gameover';
      io.to(room.code).emit('game-over', { finalScores });
    } else {
      room.state = 'setup';
      io.to(room.code).emit('prepare-next-round', {
        currentRound: room.currentRound + 1,
        totalRounds: room.settings.totalRounds,
      });
    }
  });

  // ── Host: Reset Game ──
  socket.on('reset-game', () => {
    const room = rooms.get(currentRoom);
    if (!room || room.hostSocketId !== socket.id) return;
    if (room.timer) { clearInterval(room.timer); room.timer = null; }
    room.currentRound = 0;
    room.state = 'lobby';
    room.usedQuestions.clear();
    room.guesses.clear();
    for (const p of room.players.values()) p.score = 0;

    io.to(room.code).emit('game-reset', { players: getPlayersArray(room) });
  });

  // ── Host: Connect Twitch ──
  socket.on('connect-twitch', (data) => {
    const room = rooms.get(currentRoom);
    if (!room || room.hostSocketId !== socket.id) return;
    if (!tmi) return socket.emit('twitch-status', { connected: false, error: 'tmi.js غير مثبت' });

    const channel = data.channel.replace(/^#/, '').toLowerCase().trim();
    if (!channel) return;

    if (room.twitchClient) {
      room.twitchClient.disconnect().catch(() => {});
      room.twitchClient = null;
    }

    const client = new tmi.Client({
      connection: { reconnect: true, secure: true },
      channels: [channel],
    });

    client.connect().then(() => {
      room.twitchClient = client;
      room.twitchChannel = channel;
      socket.emit('twitch-status', { connected: true, channel });

      client.on('message', (_ch, tags, message, self) => {
        if (self) return;
        const username = tags['display-name'] || tags.username;
        const twitchId = `twitch:${tags.username}`;
        const msg = message.trim().toLowerCase();

        if (msg === '!join' || msg === '!انضم') {
          if (room.players.has(twitchId)) return;
          room.players.set(twitchId, { name: username, type: 'twitch', score: 0 });
          io.to(room.code).emit('player-joined', {
            name: username, type: 'twitch',
            playerCount: room.players.size, players: getPlayersArray(room),
          });
          return;
        }

        if (msg === '!leave' || msg === '!انسحب') {
          if (!room.players.has(twitchId)) return;
          room.players.delete(twitchId);
          io.to(room.code).emit('player-left', {
            name: username,
            playerCount: room.players.size, players: getPlayersArray(room),
          });
          return;
        }

        if (room.state === 'playing' && room.players.has(twitchId) && !room.guesses.has(twitchId)) {
          const value = extractNumber(message);
          if (value === null) return;
          room.guesses.set(twitchId, {
            playerId: twitchId, playerName: username, value, timestamp: Date.now(),
          });
          io.to(room.code).emit('guess-count-updated', {
            guessed: room.guesses.size, total: room.players.size,
          });
          if (room.guesses.size >= room.players.size) {
            clearInterval(room.timer); room.timer = null;
            setTimeout(() => endRound(room), 500);
          }
        }
      });
    }).catch(err => {
      socket.emit('twitch-status', { connected: false, error: err.message });
    });
  });

  socket.on('disconnect-twitch', () => {
    const room = rooms.get(currentRoom);
    if (!room || room.hostSocketId !== socket.id) return;
    if (room.twitchClient) {
      room.twitchClient.disconnect().catch(() => {});
      room.twitchClient = null;
      room.twitchChannel = null;
      socket.emit('twitch-status', { connected: false });
    }
  });

  // ── Host: Kick Player ──
  socket.on('kick-player', (data) => {
    const room = rooms.get(currentRoom);
    if (!room || room.hostSocketId !== socket.id) return;
    for (const [id, player] of room.players) {
      if (player.name === data.name) {
        room.players.delete(id);
        if (!id.startsWith('twitch:')) io.to(id).emit('kicked');
        io.to(room.code).emit('player-left', {
          name: player.name,
          playerCount: room.players.size, players: getPlayersArray(room),
        });
        break;
      }
    }
  });

  // ── Leave / Disconnect ──
  socket.on('leave-room', () => leaveRoom(socket));
  socket.on('disconnect', () => leaveRoom(socket));

  function leaveRoom(sock) {
    if (watchingHostId) {
      sock.leave(`hostwatch:${watchingHostId}`);
    }
    if (!currentRoom) return;
    const room = rooms.get(currentRoom);
    if (!room) return;

    if (role === 'host') {
      if (room.timer) { clearInterval(room.timer); room.timer = null; }
      if (room.twitchClient) { room.twitchClient.disconnect().catch(() => {}); }
      io.to(currentRoom).emit('room-closed');
      rooms.delete(currentRoom);
    } else if (role === 'player') {
      const player = room.players.get(sock.id);
      room.players.delete(sock.id);
      if (player) {
        io.to(currentRoom).emit('player-left', {
          name: player.name,
          playerCount: room.players.size, players: getPlayersArray(room),
        });
      }
    } else if (role === 'overlay') {
      room.overlays.delete(sock.id);
    }
    sock.leave(currentRoom);
    currentRoom = null;
    role = null;
  }
});

function endRound(room) {
  room.state = 'results';
  const guessesArr = [...room.guesses.values()];
  const ranked = rankGuesses(guessesArr, room.correctAnswer);

  ranked.forEach((r, i) => {
    const pts = i === 0 ? 3 : i === 1 ? 2 : i === 2 ? 1 : 0;
    r.points = pts;
    r.rank = i + 1;
    const player = room.players.get(r.playerId);
    if (player) player.score += pts;
  });

  const numberLine = guessesArr.length > 0 ? buildNumberLine(ranked, room.correctAnswer) : null;
  const scores = getPlayersArray(room).sort((a, b) => b.score - a.score);

  const resultData = {
    question: room.question,
    correctAnswer: room.correctAnswer,
    rankings: ranked.map(r => ({
      name: r.playerName, value: r.value, difference: r.difference, points: r.points, rank: r.rank,
    })),
    numberLine, scores,
    roundNumber: room.currentRound,
    totalRounds: room.settings.totalRounds,
    isLastRound: room.currentRound >= room.settings.totalRounds,
  };

  io.to(room.code).emit('round-result', resultData);

  for (const r of ranked) {
    if (!r.playerId.startsWith('twitch:')) {
      io.to(r.playerId).emit('your-result', {
        yourGuess: r.value, rank: r.rank, difference: r.difference,
        points: r.points, totalScore: room.players.get(r.playerId)?.score || 0,
        totalPlayers: ranked.length,
      });
    }
  }

  for (const [id, player] of room.players) {
    if (!room.guesses.has(id) && !id.startsWith('twitch:')) {
      io.to(id).emit('your-result', {
        yourGuess: null, rank: null, difference: null, points: 0,
        totalScore: player.score, totalPlayers: ranked.length, missed: true,
      });
    }
  }
}

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
