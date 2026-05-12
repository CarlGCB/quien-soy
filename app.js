/**
 * ════════════════════════════════════════════════════════════════
 *  ¿QUIÉN SOY? — app.js  (Modo LOCAL)
 *
 *  Multijugador local: varias pestañas del mismo navegador
 *  comparten estado vía localStorage + BroadcastChannel.
 * ════════════════════════════════════════════════════════════════
 */

'use strict';

/* ══════════════════════════════════════════════════════════════
   BANCO DE IMÁGENES
   ══════════════════════════════════════════════════════════════
 *
 *  ✏️  PARA AÑADIR MÁS IMÁGENES:
 *  1. Pon el archivo .jpg/.png en la carpeta correspondiente.
 *  2. Añade una línea aquí con el nombre visible y la ruta.
 *  Ejemplo:
 *    { name: 'Nuevo Animal', url: 'img/animales/nuevo-animal.jpg' },
 * ══════════════════════════════════════════════════════════════ */

var IMAGE_BANK = {

  /* ── ACTORES → carpeta img/actores/ ───────────────────────── */
  actors: [
    { name: 'Dwayne Johnson', url: 'img/actores/dwayne-johnson.jpg' },
    { name: 'Johnny Depp',    url: 'img/actores/johnny-depp.jpg'    },
    { name: 'Will Smith',     url: 'img/actores/wiil-smith.jpg'     },
    // ↓ Añade más actores aquí
    // { name: 'Nombre Apellido', url: 'img/actores/nombre-apellido.jpg' },
  ],

  /* ── PELÍCULAS → carpeta img/peliculas/ ───────────────────── */
  movies: [
    { name: 'Crepúsculo',        url: 'img/peliculas/creepusculo.jpg'        },
    { name: 'Piratas del Caribe', url: 'img/peliculas/piratas-del-caribe.jpg' },
    { name: 'Titanic',            url: 'img/peliculas/titanic.jpg'             },
    // ↓ Añade más películas aquí
    // { name: 'Nombre Película', url: 'img/peliculas/nombre-pelicula.jpg' },
  ],

  /* ── ANIMALES → carpeta img/animales/ ────────────────────── */
  animals: [
    { name: 'Capybara', url: 'img/animales/capybara.jpg' },
    { name: 'Gato',     url: 'img/animales/gato.jpg'     },
    { name: 'León',     url: 'img/animales/leon.jpg'     },
    { name: 'Lobo',     url: 'img/animales/lobo.jpg'     },
    { name: 'Panda',    url: 'img/animales/panda.jpg'    },
    { name: 'Pollito',  url: 'img/animales/pollito.jpg'  },
    { name: 'Tiburón',  url: 'img/animales/tiburon.jpg'  },
    { name: 'Tucán',    url: 'img/animales/tucan.jpg'    },
    // ↓ Añade más animales aquí
    // { name: 'Nombre Animal', url: 'img/animales/nombre-animal.jpg' },
  ]
};

/* loadImageBank es un stub — sin fetch, sin servidor necesario */
var IMAGE_BANK_LOADED = true;
function loadImageBank(callback) { callback(); }

/* ══════════════════════════════════════════════════════════════
   ESTADO LOCAL DE ESTA PESTAÑA/JUGADOR
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
   PERSISTENCIA: localStorage + BroadcastChannel
   ══════════════════════════════════════════════════════════════ */

function ROOM_KEY(code) { return 'quien_soy_room_' + code; }

function readRoom(code) {
  try {
    var raw = localStorage.getItem(ROOM_KEY(code));
    return raw ? JSON.parse(raw) : null;
  } catch (e) { return null; }
}

function writeRoom(code, room) {
  localStorage.setItem(ROOM_KEY(code), JSON.stringify(room));
  if (window._bc) window._bc.postMessage({ type: 'room_updated', code: code });
}

function deleteRoom(code) {
  localStorage.removeItem(ROOM_KEY(code));
  if (window._bc) window._bc.postMessage({ type: 'room_deleted', code: code });
}

function openBroadcastChannel(code) {
  closeBroadcastChannel();
  if (typeof BroadcastChannel !== 'undefined') {
    window._bc = new BroadcastChannel('quien_soy');
    window._bc.onmessage = function(e) {
      if (e.data.code !== code) return;
      if (e.data.type === 'room_deleted') { handleRoomGone(); return; }
      if (e.data.type === 'room_updated') { handleRoomUpdated(); }
    };
  }
}

function closeBroadcastChannel() {
  if (window._bc) { window._bc.close(); window._bc = null; }
}

function handleRoomUpdated() {
  var room = readRoom(myState.roomCode);
  if (!room) { handleRoomGone(); return; }

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

function handleRoomGone() {
  closeBroadcastChannel();
  window.removeEventListener('storage', onStorageChange);
  showScreen('screen-home');
  showToast('La sala fue cerrada');
}

/* ══════════════════════════════════════════════════════════════
   UTILIDADES UI
   ══════════════════════════════════════════════════════════════ */

function generateRoomCode() {
  var chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  var code = '';
  for (var i = 0; i < 6; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
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

function showScreen(id) {
  document.querySelectorAll('.screen').forEach(function(s) { s.classList.remove('active'); });
  var target = document.getElementById(id);
  if (target) {
    requestAnimationFrame(function() {
      requestAnimationFrame(function() {
        target.classList.add('active');
      });
    });
  }
}

/* ══════════════════════════════════════════════════════════════
   DERANGEMENT — Reparto Modo Libre
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
   COLA ALEATORIA DE IMÁGENES (Shuffled Queue)
   ══════════════════════════════════════════════════════════════
 *  Todas las imágenes pasan una vez antes de repetirse.
 *  La cola se guarda en la sala para que todas las pestañas
 *  estén sincronizadas.
 */
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
    // Evitar que la primera del nuevo ciclo coincida con la última del anterior
    if (queue.length > 0 && fresh.length > 1) {
      var lastUsed = queue[queue.length - 1];
      if (fresh[0] === lastUsed) {
        var swap = Math.floor(Math.random() * (fresh.length - 1)) + 1;
        var t = fresh[0]; fresh[0] = fresh[swap]; fresh[swap] = t;
      }
    }
    queue = queue.concat(fresh);
  }

  var picked    = queue.slice(0, n);
  var remaining = queue.slice(n);
  return { picked: picked, remaining: remaining };
}

function assignCategoryImages(players, category, currentQueue) {
  var bank = IMAGE_BANK[category];
  var ids  = Object.keys(players);
  var n    = ids.length;

  if (!bank || bank.length === 0) return { assignments: {}, queue: [] };

  var drawn = drawFromQueue(currentQueue, bank, n);
  var assignments = {};
  ids.forEach(function(id, i) { assignments[id] = drawn.picked[i]; });
  return { assignments: assignments, queue: drawn.remaining };
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

  if (mode === 'free' && !freeUrl) {
    showToast('⚠️ Añade una URL o sube una imagen'); return;
  }

  var code     = generateRoomCode();
  var playerId = generatePlayerId();

  myState.roomCode   = code;
  myState.playerId   = playerId;
  myState.playerName = name;
  myState.isHost     = true;

  var players = {};
  players[playerId] = { name: name, freeUrl: freeUrl || null, assignedImage: null };

  var room = {
    host:     playerId,
    mode:     mode,
    category: mode === 'category' ? category : null,
    status:   'lobby',
    players:  players
  };

  writeRoom(code, room);
  openBroadcastChannel(code);
  enterLobby(room);
}

function joinRoom() {
  var name        = document.getElementById('join-name').value.trim();
  var code        = document.getElementById('join-code').value.trim().toUpperCase();
  var freeUrl     = document.getElementById('join-free-url').value.trim();
  var freeDataUrl = window._joinFreeDataUrl || null;
  if (freeDataUrl) freeUrl = freeDataUrl;

  if (!name) { showToast('⚠️ Escribe tu nombre'); return; }
  if (code.length !== 6) { showToast('⚠️ El código tiene 6 caracteres'); return; }

  var room = readRoom(code);
  if (!room) { showToast('❌ Sala no encontrada'); return; }
  if (room.status === 'playing') { showToast('🎮 El juego ya empezó'); return; }
  if (room.mode === 'free' && !freeUrl) {
    showToast('⚠️ Añade una URL o sube una imagen'); return;
  }

  var playerId = generatePlayerId();
  myState.roomCode   = code;
  myState.playerId   = playerId;
  myState.playerName = name;
  myState.isHost     = false;
  myState.gameMode   = room.mode;

  room.players[playerId] = { name: name, freeUrl: freeUrl || null, assignedImage: null };
  writeRoom(code, room);

  openBroadcastChannel(code);
  enterLobby(room);
}

/* ── LOBBY ──────────────────────────────────────────────────── */
function enterLobby(room) {
  document.getElementById('display-room-code').textContent = myState.roomCode;
  document.getElementById('btn-start-game').classList.toggle('hidden', !myState.isHost);
  showScreen('screen-lobby');
  renderLobbyPlayers(room);
  window.addEventListener('storage', onStorageChange);
}

function onStorageChange(e) {
  if (!myState.roomCode) return;
  if (e.key === ROOM_KEY(myState.roomCode)) handleRoomUpdated();
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
  var room = readRoom(myState.roomCode);
  if (!room) return;

  var count = Object.keys(room.players || {}).length;
  if (count < 2) { showToast('⚠️ Necesitas al menos 2 jugadores'); return; }

  _doStartGame(room);
}

function _doStartGame(room) {
  if (room.mode !== 'free') {
    var bank = IMAGE_BANK[room.category] || [];
    if (bank.length === 0) {
      showToast('⚠️ No hay imágenes en esta categoría');
      return;
    }
  }

  if (room.mode === 'free') {
    var assignments = assignFreeImages(room.players);
    Object.entries(assignments).forEach(function(entry) {
      room.players[entry[0]].assignedImage = entry[1];
    });
  } else {
    var result = assignCategoryImages(room.players, room.category, room.imageQueue || null);
    Object.entries(result.assignments).forEach(function(entry) {
      room.players[entry[0]].assignedImage = entry[1];
    });
    room.imageQueue = result.queue;
  }

  room.status = 'playing';
  writeRoom(myState.roomCode, room);
  enterGame(room);
}

/* ── JUEGO ──────────────────────────────────────────────────── */
var CATEGORY_LABELS = {
  actors:  '🎬 Actores',
  movies:  '🎞 Películas',
  animals: '🐾 Animales',
  free:    '🖼 Modo Libre'
};

function enterGame(room) {
  document.getElementById('my-player-name').textContent = myState.playerName;
  document.getElementById('game-room-code-display').textContent = 'SALA: ' + myState.roomCode;
  var catKey = room.mode === 'free' ? 'free' : (room.category || 'actors');
  document.getElementById('game-category-display').textContent = CATEGORY_LABELS[catKey] || catKey;
  showScreen('screen-game');
  renderArena(room);
  renderRoundVotes(room);
}

/* ══════════════════════════════════════════════════════════════
   POSICIONES DE JUGADORES SEGÚN NÚMERO
   ══════════════════════════════════════════════════════════════
 *
 *  Cada layout devuelve un array de {x, y} en porcentaje (0-1)
 *  relativo al tamaño del área de juego.
 *
 *  2 jugadores → horizontal (izquierda / derecha)
 *  3 jugadores → triángulo  (1 arriba, 2 abajo)
 *  4 jugadores → rombo      (arriba, izquierda, derecha, abajo)
 *  5+ jugadores → círculo   (puntos equidistantes en circunferencia)
 *
 *  Coordenadas: x=0 izquierda, x=1 derecha, y=0 arriba, y=1 abajo.
 *  El centro es (0.5, 0.5).
 */
function getPlayerPositions(n) {
  if (n === 2) {
    return [
      { x: 0.25, y: 0.5 },   // izquierda
      { x: 0.75, y: 0.5 }    // derecha
    ];
  }

  if (n === 3) {
    return [
      { x: 0.5,  y: 0.15 },  // arriba-centro
      { x: 0.18, y: 0.75 },  // abajo-izquierda
      { x: 0.82, y: 0.75 }   // abajo-derecha
    ];
  }

  if (n === 4) {
    return [
      { x: 0.5,  y: 0.08 },  // arriba
      { x: 0.08, y: 0.5  },  // izquierda
      { x: 0.92, y: 0.5  },  // derecha
      { x: 0.5,  y: 0.88 }   // abajo
    ];
  }

  /* 5+ jugadores: círculo
   * Ángulo inicial -90° (arriba), giro horario.
   * Radio = 0.36 (en fracción del ancho/alto del área).
   */
  var positions = [];
  var cx = 0.5, cy = 0.5;
  var R  = 0.36;
  var offset = -Math.PI / 2; // empieza arriba
  for (var i = 0; i < n; i++) {
    var angle = offset + (2 * Math.PI / n) * i;
    positions.push({
      x: cx + R * Math.cos(angle),
      y: cy + R * Math.sin(angle)
    });
  }
  return positions;
}

/* ── renderArena ─────────────────────────────────────────────────
 *  REGLA DE VISIBILIDAD:
 *  • Mi tarjeta  → muestra "?" (yo no puedo ver mi imagen)
 *  • Las demás   → muestra la imagen asignada + lupa para ampliar
 *
 *  Las posiciones {x, y} se convierten a píxeles usando el tamaño
 *  real del contenedor en el momento del render.
 */
function renderArena(room) {
  var players = room.players || {};
  var arena   = document.getElementById('game-arena');
  arena.innerHTML = '';
  arena.className = 'game-arena';

  var ids = Object.keys(players);
  var n   = ids.length;
  if (n === 0) return;

  var W = arena.clientWidth  || window.innerWidth;
  var H = arena.clientHeight || Math.max(280, window.innerHeight - 220);

  var positions = getPlayerPositions(n);

  ids.forEach(function(id, i) {
    var p    = players[id];
    var isMe = (id === myState.playerId);
    var pos  = positions[i];

    var card = document.createElement('div');
    card.className = 'player-card' + (isMe ? ' is-me' : '');
    card.style.left = (pos.x * W) + 'px';
    card.style.top  = (pos.y * H) + 'px';

    var imgHtml;
    if (isMe) {
      imgHtml = '<div class="player-image-wrap hidden-card" title="Esta es tu imagen"></div>';
    } else if (p.assignedImage) {
      imgHtml =
        '<div class="player-image-wrap clickable-img"' +
             ' data-src="' + p.assignedImage + '"' +
             ' data-name="' + p.name + '" title="Toca para ampliar">' +
          '<img src="' + p.assignedImage + '" alt="' + p.name + '" loading="lazy"' +
               ' onerror="this.src=\'https://placehold.co/90x90/1c1c2e/00f5ff?text=?\'" />' +
          '<div class="img-zoom-hint">🔍</div>' +
        '</div>';
    } else {
      imgHtml = '<div class="player-image-wrap hidden-card"></div>';
    }

    card.innerHTML =
      (isMe ? '<div class="me-badge">YO</div>' : '') +
      imgHtml +
      '<div class="player-card-name">' + p.name + '</div>';

    arena.appendChild(card);
  });

  // Click para abrir lightbox
  arena.querySelectorAll('.clickable-img').forEach(function(wrap) {
    wrap.addEventListener('click', function() {
      openLightbox(wrap.dataset.src, wrap.dataset.name);
    });
  });
}

// Re-calcular si la ventana cambia de tamaño (rotación móvil, resize)
window.addEventListener('resize', function() {
  var active = document.querySelector('.screen.active');
  if (active && active.id === 'screen-game' && myState.roomCode) {
    var room = readRoom(myState.roomCode);
    if (room) renderArena(room);
  }
});

/* ── LIGHTBOX ──────────────────────────────────────────────── */
function openLightbox(src, name) {
  var lb     = document.getElementById('lightbox');
  var lbImg  = document.getElementById('lightbox-img');
  var lbName = document.getElementById('lightbox-name');
  lbImg.src          = src;
  lbImg.alt          = name;
  lbName.textContent = name;
  lb.classList.remove('hidden');
  requestAnimationFrame(function() { lb.classList.add('open'); });
}

function closeLightbox() {
  var lb = document.getElementById('lightbox');
  lb.classList.remove('open');
  setTimeout(function() { lb.classList.add('hidden'); }, 250);
}

/* ── NUEVA RONDA — sistema de votos ─────────────────────────── *
 *  Todos pulsan "Nueva Ronda". Cuando el último vota, se reparte *
 *  automáticamente una nueva ronda y se limpian los votos.       */
function voteNewRound() {
  var room = readRoom(myState.roomCode);
  if (!room) return;

  if (!room.roundVotes) room.roundVotes = {};
  room.roundVotes[myState.playerId] = true;

  var totalPlayers = Object.keys(room.players).length;
  var totalVotes   = Object.keys(room.roundVotes).length;

  if (totalVotes >= totalPlayers) {
    Object.keys(room.players).forEach(function(pid) {
      room.players[pid].assignedImage = null;
    });

    if (room.mode === 'free') {
      var assignments = assignFreeImages(room.players);
      Object.entries(assignments).forEach(function(entry) {
        room.players[entry[0]].assignedImage = entry[1];
      });
    } else {
      var result = assignCategoryImages(room.players, room.category, room.imageQueue || null);
      Object.entries(result.assignments).forEach(function(entry) {
        room.players[entry[0]].assignedImage = entry[1];
      });
      room.imageQueue = result.queue;
    }

    room.roundVotes = {};
    writeRoom(myState.roomCode, room);
    // El votante final no recibe su propio broadcast → actualizamos manualmente
    renderArena(room);
    renderRoundVotes(room);
    showToast('🔄 ¡Nueva ronda!');
  } else {
    writeRoom(myState.roomCode, room);
    renderRoundVotes(room);
    showToast('✅ Voto registrado (' + totalVotes + '/' + totalPlayers + ')');
  }
}

function renderRoundVotes(room) {
  var votes  = room.roundVotes || {};
  var total  = Object.keys(room.players).length;
  var count  = Object.keys(votes).length;
  var iVoted = !!votes[myState.playerId];

  var btn     = document.getElementById('btn-new-round');
  var display = document.getElementById('round-votes-display');

  btn.disabled = iVoted;
  btn.classList.toggle('voted', iVoted);
  display.textContent = count > 0 ? count + '/' + total : '';
  document.getElementById('round-hint-text').textContent =
    iVoted
      ? 'Esperando al resto… (' + count + '/' + total + ')'
      : 'Todos deben pulsar para iniciar nueva ronda';
}

/* ── SALIR ──────────────────────────────────────────────────── */
function leaveRoom() {
  window.removeEventListener('storage', onStorageChange);

  if (myState.roomCode && myState.playerId) {
    if (myState.isHost) {
      deleteRoom(myState.roomCode);
    } else {
      var room = readRoom(myState.roomCode);
      if (room) {
        delete room.players[myState.playerId];
        writeRoom(myState.roomCode, room);
      }
    }
  }

  closeBroadcastChannel();
  myState = { roomCode: null, playerId: null, playerName: null, isHost: false, gameMode: 'category', category: 'actors' };
  showScreen('screen-home');
  showToast('👋 Has salido de la sala');
}

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

document.getElementById('join-code').addEventListener('input', function(e) {
  var code = e.target.value.trim().toUpperCase();
  if (code.length !== 6) {
    document.getElementById('join-free-image-input').classList.add('hidden'); return;
  }
  var room = readRoom(code);
  document.getElementById('join-free-image-input').classList.toggle('hidden', !room || room.mode !== 'free');
});

document.getElementById('btn-confirm-join').addEventListener('click', joinRoom);

document.getElementById('btn-copy-code').addEventListener('click', function() {
  if (navigator.clipboard) {
    navigator.clipboard.writeText(myState.roomCode || '').then(function() { showToast('📋 Código copiado'); });
  } else {
    showToast('Código: ' + myState.roomCode);
  }
});

document.getElementById('btn-start-game').addEventListener('click', hostStartGame);
document.getElementById('btn-leave-lobby').addEventListener('click', leaveRoom);
document.getElementById('btn-leave-game').addEventListener('click', leaveRoom);
document.getElementById('btn-new-round').addEventListener('click', voteNewRound);

document.getElementById('lightbox').addEventListener('click', function(e) {
  if (e.target === this || e.target.id === 'lightbox-close') closeLightbox();
});
document.addEventListener('keydown', function(e) {
  if (e.key === 'Escape') closeLightbox();
});

/* ── File inputs para Modo Libre ─────────────────────────────── */
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
      if (preview) {
        preview.src = e.target.result;
        preview.classList.remove('hidden');
      }
      if (urlInput) urlInput.value = '';
      showToast('✅ Imagen cargada');
    };
    reader.readAsDataURL(file);
  });

  if (urlInput) {
    urlInput.addEventListener('input', function() {
      if (urlInput.value.trim()) {
        window[storeKey] = null;
        fileInput.value = '';
        if (preview) preview.classList.add('hidden');
      }
    });
  }
}

setupFileInput('create-free-file', 'create-free-url', 'create-free-preview', '_createFreeDataUrl');
setupFileInput('join-free-file',   'join-free-url',   'join-free-preview',   '_joinFreeDataUrl');