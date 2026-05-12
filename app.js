/**
 * ════════════════════════════════════════════════════════════════
 *  ¿QUIÉN SOY? — app.js  (Modo ONLINE con Supabase)
 *
 *  Backend: Supabase Realtime + REST API
 *  Funciona entre dispositivos de distintas redes.
 * ════════════════════════════════════════════════════════════════
 */

'use strict';

/* ══════════════════════════════════════════════════════════════
   CONFIGURACIÓN SUPABASE
   ══════════════════════════════════════════════════════════════ */
var SUPABASE_URL = 'https://wvgycpvdpiutzaxvoxcq.supabase.co';
var SUPABASE_KEY = 'sb_publishable_2V_etQHsoX0SQt57PqtoSw_yse3xZn1';

/* ── Cabeceras para todas las peticiones REST ──────────────── */
var SB_HEADERS = {
  'Content-Type':  'application/json',
  'apikey':        SUPABASE_KEY,
  'Authorization': 'Bearer ' + SUPABASE_KEY,
  'Prefer':        'return=representation'
};

/* ── Leer sala desde Supabase ──────────────────────────────── */
function readRoom(code) {
  return fetch(SUPABASE_URL + '/rest/v1/rooms?code=eq.' + code + '&select=data', {
    headers: SB_HEADERS
  })
  .then(function(r) { return r.json(); })
  .then(function(rows) { return rows.length ? rows[0].data : null; })
  .catch(function() { return null; });
}

/* ── Escribir / actualizar sala en Supabase ─────────────────── */
function writeRoom(code, room) {
  return fetch(SUPABASE_URL + '/rest/v1/rooms', {
    method:  'POST',
    headers: Object.assign({}, SB_HEADERS, { 'Prefer': 'resolution=merge-duplicates,return=minimal' }),
    body:    JSON.stringify({ code: code, data: room, updated_at: new Date().toISOString() })
  }).catch(function(e) { console.error('writeRoom error:', e); });
}

/* ── Borrar sala de Supabase ─────────────────────────────────── */
function deleteRoom(code) {
  return fetch(SUPABASE_URL + '/rest/v1/rooms?code=eq.' + code, {
    method:  'DELETE',
    headers: SB_HEADERS
  }).catch(function(e) { console.error('deleteRoom error:', e); });
}

/* ══════════════════════════════════════════════════════════════
   SUPABASE REALTIME — escucha cambios en tiempo real
   ══════════════════════════════════════════════════════════════
 *  Supabase Realtime usa WebSockets para notificar cambios en
 *  la tabla. Cuando cualquier jugador escribe en la sala,
 *  todos los demás reciben el evento al instante.
 *
 *  Protocolo: WebSocket con mensajes JSON tipo Phoenix.
 */
var _realtimeWs   = null;
var _realtimeCode = null;
var _heartbeatInterval = null;
var _realtimeRef  = 1;

function openRealtime(code, onUpdate, onDelete) {
  closeRealtime();
  _realtimeCode = code;

  var wsUrl = SUPABASE_URL.replace('https://', 'wss://') +
              '/realtime/v1/websocket?apikey=' + SUPABASE_KEY + '&vsn=1.0.0';

  _realtimeWs = new WebSocket(wsUrl);

  _realtimeWs.onopen = function() {
    // 1. Unirse al canal de la tabla rooms filtrado por code
    _realtimeWs.send(JSON.stringify({
      topic:   'realtime:public:rooms:code=eq.' + code,
      event:   'phx_join',
      payload: { config: { broadcast: { self: false }, presence: {}, postgres_changes: [
        { event: '*', schema: 'public', table: 'rooms', filter: 'code=eq.' + code }
      ]}},
      ref:     String(_realtimeRef++)
    }));

    // 2. Heartbeat cada 25 s para mantener la conexión viva
    _heartbeatInterval = setInterval(function() {
      if (_realtimeWs && _realtimeWs.readyState === WebSocket.OPEN) {
        _realtimeWs.send(JSON.stringify({
          topic: 'phoenix', event: 'heartbeat', payload: {}, ref: String(_realtimeRef++)
        }));
      }
    }, 25000);
  };

  _realtimeWs.onmessage = function(e) {
    try {
      var msg = JSON.parse(e.data);
      if (!msg.payload || !msg.payload.data) return;

      var eventType = msg.payload.data.type; // INSERT, UPDATE, DELETE
      if (eventType === 'DELETE') {
        onDelete();
      } else if (eventType === 'INSERT' || eventType === 'UPDATE') {
        var newData = msg.payload.data.record && msg.payload.data.record.data;
        if (newData) onUpdate(newData);
      }
    } catch (err) { /* ignorar mensajes que no son de datos */ }
  };

  _realtimeWs.onclose = function() {
    clearInterval(_heartbeatInterval);
    // Reconectar tras 3 s si la sala sigue activa
    if (_realtimeCode === code) {
      setTimeout(function() {
        if (_realtimeCode === code) openRealtime(code, onUpdate, onDelete);
      }, 3000);
    }
  };

  _realtimeWs.onerror = function() { _realtimeWs.close(); };
}

function closeRealtime() {
  _realtimeCode = null;
  clearInterval(_heartbeatInterval);
  if (_realtimeWs) { _realtimeWs.close(); _realtimeWs = null; }
}

/* ══════════════════════════════════════════════════════════════
   BANCO DE IMÁGENES
   ══════════════════════════════════════════════════════════════ */
var IMAGE_BANK = {
  actors: [
    { name: 'Dwayne Johnson', url: 'img/actores/dwayne-johnson.jpg' },
    { name: 'Johnny Depp',    url: 'img/actores/johnny-depp.jpg'    },
    { name: 'Will Smith',     url: 'img/actores/wiil-smith.jpg'     },
  ],
  movies: [
    { name: 'Crepúsculo',         url: 'img/peliculas/creepusculo.jpg'        },
    { name: 'Piratas del Caribe', url: 'img/peliculas/piratas-del-caribe.jpg' },
    { name: 'Titanic',            url: 'img/peliculas/titanic.jpg'             },
  ],
  animals: [
    { name: 'Capybara', url: 'img/animales/capybara.jpg' },
    { name: 'Gato',     url: 'img/animales/gato.jpg'     },
    { name: 'León',     url: 'img/animales/leon.jpg'     },
    { name: 'Lobo',     url: 'img/animales/lobo.jpg'     },
    { name: 'Panda',    url: 'img/animales/panda.jpg'    },
    { name: 'Pollito',  url: 'img/animales/pollito.jpg'  },
    { name: 'Tiburón',  url: 'img/animales/tiburon.jpg'  },
    { name: 'Tucán',    url: 'img/animales/tucan.jpg'    },
  ]
};

/* ══════════════════════════════════════════════════════════════
   ESTADO LOCAL
   ══════════════════════════════════════════════════════════════ */
var myState = {
  roomCode:   null,
  playerId:   null,
  playerName: null,
  isHost:     false,
  gameMode:   'category',
  category:   'actors',
};

/* ══════════════════════════════════════════════════════════════
   UTILIDADES UI
   ══════════════════════════════════════════════════════════════ */
function generateRoomCode() {
  var chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  var code = '';
  for (var i = 0; i < 6; i++) code += chars[Math.floor(Math.random() * chars.length)];
  return code;
}

function generatePlayerId() {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
}

function nameToEmoji(name) {
  var emojis = ['🦊','🐯','🦁','🐸','🦋','🐙','🦄','🐺','🦖','🐬','🦅','🐧'];
  var sum = 0;
  for (var i = 0; i < name.length; i++) sum += name.charCodeAt(i);
  return emojis[sum % emojis.length];
}

var toastTimer;
function showToast(msg, duration) {
  duration = duration || 2800;
  var t = document.getElementById('toast');
  t.textContent = msg;
  t.classList.remove('hidden');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(function() { t.classList.add('hidden'); }, duration);
}

function showOverlay(msg) {
  document.getElementById('overlay-msg').textContent = msg || 'Cargando…';
  document.getElementById('overlay').classList.remove('hidden');
}
function hideOverlay() {
  document.getElementById('overlay').classList.add('hidden');
}

function showScreen(id) {
  document.querySelectorAll('.screen').forEach(function(s) { s.classList.remove('active'); });
  var target = document.getElementById(id);
  if (target) {
    requestAnimationFrame(function() {
      requestAnimationFrame(function() { target.classList.add('active'); });
    });
  }
}

/* ══════════════════════════════════════════════════════════════
   DERANGEMENT — Modo Libre
   ══════════════════════════════════════════════════════════════ */
function buildDerangement(n) {
  if (n < 2) return [0];
  var perm, hasFixed;
  do {
    perm = [];
    for (var i = 0; i < n; i++) perm.push(i);
    for (var i = n - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var tmp = perm[i]; perm[i] = perm[j]; perm[j] = tmp;
    }
    hasFixed = false;
    for (var i = 0; i < n; i++) { if (perm[i] === i) { hasFixed = true; break; } }
  } while (hasFixed);
  return perm;
}

function assignFreeImages(players) {
  var ids  = Object.keys(players);
  var urls = ids.map(function(id) { return players[id].freeUrl || ''; });
  var perm = buildDerangement(ids.length);
  var result = {};
  ids.forEach(function(id, i) { result[id] = urls[perm[i]]; });
  return result;
}

/* ══════════════════════════════════════════════════════════════
   COLA ALEATORIA DE IMÁGENES
   ══════════════════════════════════════════════════════════════ */
function shuffle(arr) {
  var a = arr.slice();
  for (var i = a.length - 1; i > 0; i--) {
    var j = Math.floor(Math.random() * (i + 1));
    var t = a[i]; a[i] = a[j]; a[j] = t;
  }
  return a;
}

function drawFromQueue(queue, bank, n) {
  var bankUrls = bank.map(function(img) { return img.url; });
  queue = queue ? queue.slice() : [];
  if (queue.length < n) {
    var fresh = shuffle(bankUrls);
    if (queue.length > 0 && fresh.length > 1) {
      var lastUsed = queue[queue.length - 1];
      if (fresh[0] === lastUsed) {
        var swap = Math.floor(Math.random() * (fresh.length - 1)) + 1;
        var t = fresh[0]; fresh[0] = fresh[swap]; fresh[swap] = t;
      }
    }
    queue = queue.concat(fresh);
  }
  return { picked: queue.slice(0, n), remaining: queue.slice(n) };
}

function assignCategoryImages(players, category, currentQueue) {
  var bank = IMAGE_BANK[category];
  var ids  = Object.keys(players);
  if (!bank || bank.length === 0) return { assignments: {}, queue: [] };
  var drawn = drawFromQueue(currentQueue, bank, ids.length);
  var assignments = {};
  ids.forEach(function(id, i) { assignments[id] = drawn.picked[i]; });
  return { assignments: assignments, queue: drawn.remaining };
}

/* ══════════════════════════════════════════════════════════════
   REACCIONAR A CAMBIOS RECIBIDOS POR REALTIME
   ══════════════════════════════════════════════════════════════ */
function onRoomUpdated(room) {
  var currentScreen = document.querySelector('.screen.active');
  var screenId = currentScreen ? currentScreen.id : '';

  if (room.status === 'lobby' && screenId === 'screen-lobby') {
    renderLobbyPlayers(room);
  } else if (room.status === 'playing') {
    if (screenId !== 'screen-game') {
      enterGame(room);
    } else {
      renderArena(room);
      renderRoundVotes(room);
    }
  }
}

function onRoomDeleted() {
  closeRealtime();
  showScreen('screen-home');
  showToast('La sala fue cerrada');
}

/* ══════════════════════════════════════════════════════════════
   ACCIONES PRINCIPALES
   ══════════════════════════════════════════════════════════════ */
function createRoom() {
  var name = document.getElementById('create-name').value.trim();
  if (!name) { showToast('⚠️ Escribe tu nombre'); return; }

  var mode        = myState.gameMode;
  var category    = myState.category;
  var freeUrl     = document.getElementById('create-free-url').value.trim();
  var freeDataUrl = window._createFreeDataUrl || null;
  if (freeDataUrl) freeUrl = freeDataUrl;
  if (mode === 'free' && !freeUrl) { showToast('⚠️ Añade una URL o sube una imagen'); return; }

  showOverlay('Creando sala…');

  var code     = generateRoomCode();
  var playerId = generatePlayerId();
  myState.roomCode   = code;
  myState.playerId   = playerId;
  myState.playerName = name;
  myState.isHost     = true;

  var players = {};
  players[playerId] = { name: name, freeUrl: freeUrl || null, assignedImage: null };

  var room = { host: playerId, mode: mode, category: mode === 'category' ? category : null,
               status: 'lobby', players: players };

  writeRoom(code, room).then(function() {
    hideOverlay();
    openRealtime(code, onRoomUpdated, onRoomDeleted);
    enterLobby(room);
  });
}

function joinRoom() {
  var name        = document.getElementById('join-name').value.trim();
  var code        = document.getElementById('join-code').value.trim().toUpperCase();
  var freeUrl     = document.getElementById('join-free-url').value.trim();
  var freeDataUrl = window._joinFreeDataUrl || null;
  if (freeDataUrl) freeUrl = freeDataUrl;

  if (!name) { showToast('⚠️ Escribe tu nombre'); return; }
  if (code.length !== 6) { showToast('⚠️ El código tiene 6 caracteres'); return; }

  showOverlay('Buscando sala…');

  readRoom(code).then(function(room) {
    if (!room) { hideOverlay(); showToast('❌ Sala no encontrada'); return; }
    if (room.status === 'playing') { hideOverlay(); showToast('🎮 El juego ya empezó'); return; }
    if (room.mode === 'free' && !freeUrl) { hideOverlay(); showToast('⚠️ Añade una URL o sube una imagen'); return; }

    var playerId = generatePlayerId();
    myState.roomCode   = code;
    myState.playerId   = playerId;
    myState.playerName = name;
    myState.isHost     = false;
    myState.gameMode   = room.mode;

    room.players[playerId] = { name: name, freeUrl: freeUrl || null, assignedImage: null };

    writeRoom(code, room).then(function() {
      hideOverlay();
      openRealtime(code, onRoomUpdated, onRoomDeleted);
      enterLobby(room);
    });
  });
}

/* ── LOBBY ──────────────────────────────────────────────────── */
function enterLobby(room) {
  document.getElementById('display-room-code').textContent = myState.roomCode;
  document.getElementById('btn-start-game').classList.toggle('hidden', !myState.isHost);
  showScreen('screen-lobby');
  renderLobbyPlayers(room);
}

function renderLobbyPlayers(room) {
  var players = room.players || {};
  var count   = Object.keys(players).length;

  document.getElementById('lobby-waiting').textContent =
    count < 2 ? 'Esperando jugadores… (mínimo 2)' : count + ' jugadores listos ✓';
  document.getElementById('btn-start-game').disabled = (count < 2);

  var container = document.getElementById('lobby-players');
  container.innerHTML = '';
  Object.entries(players).forEach(function(entry) {
    var id = entry[0], p = entry[1];
    var div = document.createElement('div');
    div.className = 'player-lobby-item';
    div.innerHTML =
      '<div class="player-avatar">' + nameToEmoji(p.name) + '</div>' +
      '<span class="player-lobby-name">' + p.name + '</span>' +
      (id === room.host ? '<span class="player-host-badge">HOST</span>' : '');
    container.appendChild(div);
  });
}

/* ── INICIAR JUEGO (solo host) ─────────────────────────────── */
function hostStartGame() {
  readRoom(myState.roomCode).then(function(room) {
    if (!room) return;
    var count = Object.keys(room.players || {}).length;
    if (count < 2) { showToast('⚠️ Necesitas al menos 2 jugadores'); return; }
    _doStartGame(room);
  });
}

function _doStartGame(room) {
  if (room.mode !== 'free') {
    var bank = IMAGE_BANK[room.category] || [];
    if (bank.length === 0) { showToast('⚠️ No hay imágenes en esta categoría'); return; }
  }

  if (room.mode === 'free') {
    var assignments = assignFreeImages(room.players);
    Object.entries(assignments).forEach(function(e) { room.players[e[0]].assignedImage = e[1]; });
  } else {
    var result = assignCategoryImages(room.players, room.category, room.imageQueue || null);
    Object.entries(result.assignments).forEach(function(e) { room.players[e[0]].assignedImage = e[1]; });
    room.imageQueue = result.queue;
  }

  room.status = 'playing';
  showOverlay('Iniciando…');
  writeRoom(myState.roomCode, room).then(function() {
    hideOverlay();
    enterGame(room); // el host entra directamente; los demás lo detectan por Realtime
  });
}

/* ── JUEGO ──────────────────────────────────────────────────── */
var CATEGORY_LABELS = { actors: '🎬 Actores', movies: '🎞 Películas', animals: '🐾 Animales', free: '🖼 Modo Libre' };

function enterGame(room) {
  document.getElementById('my-player-name').textContent = myState.playerName;
  document.getElementById('game-room-code-display').textContent = 'SALA: ' + myState.roomCode;
  var catKey = room.mode === 'free' ? 'free' : (room.category || 'actors');
  document.getElementById('game-category-display').textContent = CATEGORY_LABELS[catKey] || catKey;
  showScreen('screen-game');
  renderArena(room);
  renderRoundVotes(room);
}

/* ── Posiciones por número de jugadores ─────────────────────── */
function getPlayerPositions(n) {
  if (n === 2) return [{ x: 0.25, y: 0.5 }, { x: 0.75, y: 0.5 }];
  if (n === 3) return [{ x: 0.5, y: 0.15 }, { x: 0.18, y: 0.75 }, { x: 0.82, y: 0.75 }];
  if (n === 4) return [{ x: 0.5, y: 0.08 }, { x: 0.08, y: 0.5 }, { x: 0.92, y: 0.5 }, { x: 0.5, y: 0.88 }];
  var pos = [], cx = 0.5, cy = 0.5, R = 0.36, off = -Math.PI / 2;
  for (var i = 0; i < n; i++) {
    var a = off + (2 * Math.PI / n) * i;
    pos.push({ x: cx + R * Math.cos(a), y: cy + R * Math.sin(a) });
  }
  return pos;
}

function renderArena(room) {
  var players = room.players || {};
  var arena   = document.getElementById('game-arena');
  arena.innerHTML = '';
  arena.className = 'game-arena';

  var ids = Object.keys(players);
  var n   = ids.length;
  if (n === 0) return;

  var W   = arena.clientWidth  || window.innerWidth;
  var H   = arena.clientHeight || Math.max(280, window.innerHeight - 220);
  var pos = getPlayerPositions(n);

  ids.forEach(function(id, i) {
    var p = players[id], isMe = (id === myState.playerId);
    var card = document.createElement('div');
    card.className = 'player-card' + (isMe ? ' is-me' : '');
    card.style.left = (pos[i].x * W) + 'px';
    card.style.top  = (pos[i].y * H) + 'px';

    var imgHtml;
    if (isMe) {
      imgHtml = '<div class="player-image-wrap hidden-card" title="Esta es tu imagen"></div>';
    } else if (p.assignedImage) {
      imgHtml = '<div class="player-image-wrap clickable-img" data-src="' + p.assignedImage +
                '" data-name="' + p.name + '" title="Toca para ampliar">' +
                '<img src="' + p.assignedImage + '" alt="' + p.name + '" loading="lazy"' +
                ' onerror="this.src=\'https://placehold.co/90x90/1c1c2e/00f5ff?text=?\'" />' +
                '<div class="img-zoom-hint">🔍</div></div>';
    } else {
      imgHtml = '<div class="player-image-wrap hidden-card"></div>';
    }

    card.innerHTML = (isMe ? '<div class="me-badge">YO</div>' : '') + imgHtml +
                     '<div class="player-card-name">' + p.name + '</div>';
    arena.appendChild(card);
  });

  arena.querySelectorAll('.clickable-img').forEach(function(wrap) {
    wrap.addEventListener('click', function() { openLightbox(wrap.dataset.src, wrap.dataset.name); });
  });
}

window.addEventListener('resize', function() {
  var active = document.querySelector('.screen.active');
  if (active && active.id === 'screen-game' && myState.roomCode) {
    readRoom(myState.roomCode).then(function(room) { if (room) renderArena(room); });
  }
});

/* ── LIGHTBOX ──────────────────────────────────────────────── */
function openLightbox(src, name) {
  var lb = document.getElementById('lightbox');
  document.getElementById('lightbox-img').src = src;
  document.getElementById('lightbox-img').alt = name;
  document.getElementById('lightbox-name').textContent = name;
  lb.classList.remove('hidden');
  requestAnimationFrame(function() { lb.classList.add('open'); });
}
function closeLightbox() {
  var lb = document.getElementById('lightbox');
  lb.classList.remove('open');
  setTimeout(function() { lb.classList.add('hidden'); }, 250);
}

/* ── NUEVA RONDA — votos ─────────────────────────────────────── */
function voteNewRound() {
  readRoom(myState.roomCode).then(function(room) {
    if (!room) return;
    if (!room.roundVotes) room.roundVotes = {};
    room.roundVotes[myState.playerId] = true;

    var totalPlayers = Object.keys(room.players).length;
    var totalVotes   = Object.keys(room.roundVotes).length;

    if (totalVotes >= totalPlayers) {
      Object.keys(room.players).forEach(function(pid) { room.players[pid].assignedImage = null; });

      if (room.mode === 'free') {
        var assignments = assignFreeImages(room.players);
        Object.entries(assignments).forEach(function(e) { room.players[e[0]].assignedImage = e[1]; });
      } else {
        var result = assignCategoryImages(room.players, room.category, room.imageQueue || null);
        Object.entries(result.assignments).forEach(function(e) { room.players[e[0]].assignedImage = e[1]; });
        room.imageQueue = result.queue;
      }

      room.roundVotes = {};
      writeRoom(myState.roomCode, room).then(function() {
        renderArena(room);
        renderRoundVotes(room);
        showToast('🔄 ¡Nueva ronda!');
      });
    } else {
      writeRoom(myState.roomCode, room).then(function() {
        renderRoundVotes(room);
        showToast('✅ Voto registrado (' + totalVotes + '/' + totalPlayers + ')');
      });
    }
  });
}

function renderRoundVotes(room) {
  var votes  = room.roundVotes || {};
  var total  = Object.keys(room.players).length;
  var count  = Object.keys(votes).length;
  var iVoted = !!votes[myState.playerId];
  var btn    = document.getElementById('btn-new-round');
  btn.disabled = iVoted;
  btn.classList.toggle('voted', iVoted);
  document.getElementById('round-votes-display').textContent = count > 0 ? count + '/' + total : '';
  document.getElementById('round-hint-text').textContent = iVoted
    ? 'Esperando al resto… (' + count + '/' + total + ')'
    : 'Todos deben pulsar para iniciar nueva ronda';
}

/* ── SALIR ──────────────────────────────────────────────────── */
function leaveRoom() {
  if (myState.roomCode && myState.playerId) {
    if (myState.isHost) {
      deleteRoom(myState.roomCode);
    } else {
      readRoom(myState.roomCode).then(function(room) {
        if (room) {
          delete room.players[myState.playerId];
          writeRoom(myState.roomCode, room);
        }
      });
    }
  }
  closeRealtime();
  myState = { roomCode: null, playerId: null, playerName: null, isHost: false, gameMode: 'category', category: 'actors' };
  showScreen('screen-home');
  showToast('👋 Has salido de la sala');
}

/* ══════════════════════════════════════════════════════════════
   DETECTAR MODO LIBRE AL ESCRIBIR CÓDIGO EN "UNIRSE"
   ══════════════════════════════════════════════════════════════ */
var _joinCodeTimer;
document.getElementById('join-code').addEventListener('input', function(e) {
  var code = e.target.value.trim().toUpperCase();
  document.getElementById('join-free-image-input').classList.add('hidden');
  clearTimeout(_joinCodeTimer);
  if (code.length !== 6) return;
  _joinCodeTimer = setTimeout(function() {
    readRoom(code).then(function(room) {
      document.getElementById('join-free-image-input')
        .classList.toggle('hidden', !room || room.mode !== 'free');
    });
  }, 400);
});

/* ══════════════════════════════════════════════════════════════
   LISTENERS DE INTERFAZ
   ══════════════════════════════════════════════════════════════ */
document.getElementById('btn-create-room').addEventListener('click', function() { showScreen('screen-create'); });
document.getElementById('btn-join-room').addEventListener('click', function() { showScreen('screen-join'); });

document.querySelectorAll('.btn-back').forEach(function(btn) {
  btn.addEventListener('click', function() { showScreen(btn.dataset.target); });
});

document.querySelectorAll('.mode-btn').forEach(function(btn) {
  btn.addEventListener('click', function() {
    document.querySelectorAll('.mode-btn').forEach(function(b) { b.classList.remove('active'); });
    btn.classList.add('active');
    myState.gameMode = btn.dataset.mode;
    document.getElementById('category-selector').classList.toggle('hidden', myState.gameMode !== 'category');
    document.getElementById('free-image-input').classList.toggle('hidden', myState.gameMode !== 'free');
  });
});

document.querySelectorAll('.pill').forEach(function(pill) {
  pill.addEventListener('click', function() {
    document.querySelectorAll('.pill').forEach(function(p) { p.classList.remove('active'); });
    pill.classList.add('active');
    myState.category = pill.dataset.cat;
  });
});

document.getElementById('btn-confirm-create').addEventListener('click', createRoom);
document.getElementById('btn-confirm-join').addEventListener('click', joinRoom);

document.getElementById('btn-copy-code').addEventListener('click', function() {
  if (navigator.clipboard) {
    navigator.clipboard.writeText(myState.roomCode || '').then(function() { showToast('📋 Código copiado'); });
  } else { showToast('Código: ' + myState.roomCode); }
});

document.getElementById('btn-start-game').addEventListener('click', hostStartGame);
document.getElementById('btn-leave-lobby').addEventListener('click', leaveRoom);
document.getElementById('btn-leave-game').addEventListener('click', leaveRoom);
document.getElementById('btn-new-round').addEventListener('click', voteNewRound);

document.getElementById('lightbox').addEventListener('click', function(e) {
  if (e.target === this || e.target.id === 'lightbox-close') closeLightbox();
});
document.addEventListener('keydown', function(e) { if (e.key === 'Escape') closeLightbox(); });

/* ── File inputs Modo Libre ──────────────────────────────────── */
function setupFileInput(fileInputId, urlInputId, previewId, storeKey) {
  var fileInput = document.getElementById(fileInputId);
  var urlInput  = document.getElementById(urlInputId);
  var preview   = document.getElementById(previewId);
  if (!fileInput) return;
  fileInput.addEventListener('change', function() {
    var file = fileInput.files[0];
    if (!file) return;
    var reader = new FileReader();
    reader.onload = function(e) {
      window[storeKey] = e.target.result;
      if (preview) { preview.src = e.target.result; preview.classList.remove('hidden'); }
      if (urlInput) urlInput.value = '';
      showToast('✅ Imagen cargada');
    };
    reader.readAsDataURL(file);
  });
  if (urlInput) {
    urlInput.addEventListener('input', function() {
      if (urlInput.value.trim()) {
        window[storeKey] = null; fileInput.value = '';
        if (preview) preview.classList.add('hidden');
      }
    });
  }
}

setupFileInput('create-free-file', 'create-free-url', 'create-free-preview', '_createFreeDataUrl');
setupFileInput('join-free-file',   'join-free-url',   'join-free-preview',   '_joinFreeDataUrl');
