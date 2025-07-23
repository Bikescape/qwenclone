// player/script.js - PARTE 1: Inicialización y Carga de Juegos

let teamId = localStorage.getItem('teamId');
let currentGame = null;
let currentTrial = null;
let currentHints = [];
let currentUsedHints = 0;
let timer = null;
let trialStartTime = 0;
let games = [];

// Inicialización al cargar la app
async function init() {
  if (teamId) {
    const { data, error } = await supabaseClient
      .from('teams')
      .select('*')
      .eq('id', teamId)
      .single();
    if (!error && data && !data.is_finished) {
      currentGame = await getGame(data.game_id);
      showGameProgress();
      return;
    } else {
      localStorage.removeItem('teamId');
      teamId = null;
    }
  }
  loadActiveGames();
}

// Cargar juegos activos desde Supabase
async function loadActiveGames() {
  const { data, error } = await supabaseClient
    .from('games')
    .select('*')
    .eq('active', true);

  if (error) {
    console.error('Error cargando juegos:', error);
    document.getElementById('games-list').innerHTML = '<p>Error al cargar juegos. Revisa tu conexión.</p>';
    return;
  }

  games = data;
  const container = document.getElementById('games-list');
  container.innerHTML = data.length > 0 
    ? data.map(g => `
        <div>
          <h3>${g.title}</h3>
          <p>${g.description || 'Sin descripción'}</p>
          <button onclick="showIntro(${g.id})">Jugar</button>
        </div>
      `).join('')
    : '<p>No hay juegos activos en este momento.</p>';
}

// player/script.js - PARTE 2: Inicio del Juego

function showIntro(gameId) {
  currentGame = games.find(g => g.id === gameId);
  document.getElementById('welcome').style.display = 'none';
  document.getElementById('intro').style.display = 'block';
  document.getElementById('intro-content').innerHTML = `
    <h3>${currentGame.title}</h3>
    <p>${currentGame.narrative || '¡Prepárate para la aventura!'}</p>
  `;
}

function startLocation() {
  document.getElementById('intro').style.display = 'none';
  document.getElementById('create-team').style.display = 'block';
}

async function startGame() {
  const teamName = document.getElementById('team-name').value.trim();
  if (!teamName) {
    alert('Por favor, ingresa un nombre de equipo');
    return;
  }

  const { data, error } = await supabaseClient
    .from('teams')
    .insert([{
      team_name: teamName,
      game_id: currentGame.id,
      start_time: new Date().toISOString(),
      total_score: 1000, // Puntuación inicial (las penalizaciones restan)
      total_time: 0,
      hints_used_global: 0,
      hints_used_per_trial: [],
      progress_log: [],
      last_activity: new Date().toISOString(),
      is_finished: false
    }])
    .select('id')
    .single();

  if (error) {
    console.error('Error al crear equipo:', error);
    alert('Error al iniciar el juego. Revisa tu conexión.');
    return;
  }

  teamId = data.id;
  localStorage.setItem('teamId', teamId);
  loadNextLocation();
}

// player/script.js - PARTE 3: Navegación entre Localizaciones y Pruebas

async function loadNextLocation() {
  // Obtener la siguiente localización según el orden
  const { data: locations } = await supabaseClient
    .from('locations')
    .select('id')
    .eq('game_id', currentGame.id)
    .order('order_index')
    .is('current_location_id', null); // Simplificado: en producción usa lógica de progreso

  if (locations.length === 0) {
    finishGame();
    return;
  }

  const nextLocationId = locations[0].id;
  await showTrial(nextLocationId);
}

// player/script.js - PARTE 4: Mostrar Prueba Dinámica

async function showTrial(locationId) {
  const { data: trials, error } = await supabaseClient
    .from('trials')
    .select('*, hints(*)')
    .eq('location_id', locationId)
    .order('order_index')
    .limit(1);

  if (error || trials.length === 0) {
    loadNextLocation();
    return;
  }

  currentTrial = trials[0];
  currentHints = currentTrial.hints?.sort((a, b) => a.order_index - b.order_index) || [];
  currentUsedHints = getHintsUsedCount(currentTrial.id);

  // Actualizar interfaz
  document.getElementById('create-team').style.display = 'none';
  document.getElementById('trial-screen').style.display = 'block';

  // Limpiar contenido previo
  const container = document.getElementById('trial-options-container');
  container.innerHTML = '';
  document.getElementById('answer-input').style.display = 'none';
  document.getElementById('gps-map').style.display = 'none';
  document.getElementById('qr-scan').innerHTML = '';

  // Mostrar narrativa e imagen/audio
  document.getElementById('trial-narrative').textContent = currentTrial.narrative || '';
  document.getElementById('trial-image').src = currentTrial.image_url || '';
  document.getElementById('trial-audio').src = currentTrial.audio_url || '';

  // Iniciar temporizador
  startTimer();

  // Renderizar por tipo
  if (currentTrial.type === 'texto') {
    document.getElementById('answer-input').style.display = 'block';
    document.getElementById('answer-input').value = '';
  }

  else if (currentTrial.type === 'opciones') {
    renderMultipleChoice();
  }

  else if (currentTrial.type === 'ordenacion') {
    renderSorting();
  }

  else if (currentTrial.type === 'gps') {
    showGPSMap();
  }

  else if (currentTrial.type === 'qr') {
    startQRScanner();
  }

  updateHintButton();
}

// player/script.js - PARTE 5: Tipos de Prueba

function renderMultipleChoice() {
  currentTrial.options.forEach(opt => {
    const label = document.createElement('label');
    label.style.display = 'block';
    label.innerHTML = `
      <input type="${currentTrial.allow_multiple ? 'checkbox' : 'radio'}" name="option" value="${opt.text}">
      ${opt.text}
    `;
    document.getElementById('trial-options-container').appendChild(label);
  });
}

function renderSorting() {
  const list = document.createElement('ul');
  list.id = 'sortable-list';
  list.style.listStyle = 'none';

  // Mezclar opciones
  const shuffled = [...currentTrial.options].sort(() => Math.random() - 0.5);
  shuffled.forEach(item => {
    const li = document.createElement('li');
    li.textContent = item.text;
    li.draggable = true;
    li.style.padding = '8px';
    li.style.margin = '4px 0';
    li.style.background = '#e3f2fd';
    li.style.cursor = 'move';
    list.appendChild(li);
  });

  document.getElementById('trial-options-container').appendChild(list);
  setupDragAndDrop();
}

function showGPSMap() {
  document.getElementById('gps-map').style.display = 'block';
  const map = L.map('gps-map').setView([40.7128, -74.0060], 16); // placeholder
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(map);

  // Marcador objetivo
  L.circle([currentTrial.gps_lat, currentTrial.gps_lng], {
    radius: currentTrial.gps_radius,
    color: 'red',
    fillOpacity: 0.2
  }).addTo(map);

  // Marcador del jugador (simulado)
  navigator.geolocation.getCurrentPosition(pos => {
    L.marker([pos.coords.latitude, pos.coords.longitude]).addTo(map);
  });
}

function startQRScanner() {
  const qrDiv = document.getElementById('qr-scan');
  qrDiv.innerHTML = '<div id="qr-reader" style="width:100%;"></div>';
  const html5Qrcode = new Html5Qrcode("qr-reader");
  html5Qrcode.start(
    { facingMode: "environment" },
    { fps: 10, qrbox: 250 },
    (decodedText) => {
      if (decodedText === currentTrial.qr_content) {
        validateAnswer(true);
        html5Qrcode.stop();
      }
    },
    () => {}
  );
}

// player/script.js - PARTE 6: Validación

function validateAnswer(forceCorrect = false) {
  clearInterval(timer);
  const timeTaken = Math.floor((Date.now() - trialStartTime) / 1000);
  const hintsUsed = currentUsedHints;
  let isCorrect = forceCorrect;

  if (!forceCorrect) {
    if (currentTrial.type === 'texto') {
      const input = document.getElementById('answer-input').value.trim();
      isCorrect = input.toLowerCase() === currentTrial.correct_answer.toLowerCase();
    }

    else if (currentTrial.type === 'opciones') {
      const selected = Array.from(document.querySelectorAll('#trial-options-container input:checked'))
        .map(el => el.value);
      const correct = currentTrial.options.filter(o => o.correct).map(o => o.text);
      isCorrect = arraysEqual(selected.sort(), correct.sort());
    }

    else if (currentTrial.type === 'ordenacion') {
      const userOrder = Array.from(document.querySelectorAll('#sortable-list li'))
        .map(li => li.textContent);
      const correctOrder = currentTrial.options
        .sort((a, b) => a.order - b.order)
        .map(o => o.text);
      isCorrect = arraysEqual(userOrder, correctOrder);
    }
  }

  if (isCorrect) {
    const deduction = timeTaken + (hintsUsed * 10);
    saveTrialResult(timeTaken, hintsUsed, deduction);
    showFeedback('🎉 ¡Correcto!', 'success');
    setTimeout(loadNextLocation, 1500);
  } else {
    showFeedback('❌ Incorrecto. Intenta de nuevo.', 'error');
    startTimer(); // Reanudar temporizador
  }
}

function arraysEqual(a, b) {
  return a.length === b.length && a.every((val, i) => val === b[i]);
}

// player/script.js - PARTE 7: Pistas

function updateHintButton() {
  const btn = document.getElementById('hint-btn');
  if (currentUsedHints >= currentHints.length) {
    btn.disabled = true;
    btn.textContent = 'No hay más pistas';
  } else {
    const nextHint = currentHints[currentUsedHints];
    btn.disabled = false;
    btn.textContent = `Pista (-${nextHint.cost} pts)`;
  }
}

function useHint() {
  if (currentUsedHints >= currentHints.length) return;

  const hint = currentHints[currentUsedHints];
  showModal(`
    <div style="text-align: left;">
      <h3>💡 Pista ${currentUsedHints + 1}</h3>
      <p>${hint.content_text || ''}</p>
      ${hint.image_url ? `<img src="${hint.image_url}" style="max-width:100%; margin:10px 0; border-radius:8px;" />` : ''}
      ${hint.audio_url ? `<audio src="${hint.audio_url}" controls style="width:100%"></audio>` : ''}
      <p><small>Coste: ${hint.cost} puntos</small></p>
    </div>
  `);

  logHintUsed(currentTrial.id, hint.id, hint.cost);
  currentUsedHints++;
  updateHintButton();
}

function showModal(html) {
  const modal = document.createElement('div');
  modal.id = 'hint-modal';
  modal.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.8);display:flex;justify-content:center;align-items:center;z-index:1000;';
  modal.innerHTML = `
    <div style="background:white;padding:20px;border-radius:12px;max-width:90%;color:#333;">
      ${html}
      <button onclick="closeModal()" style="margin-top:10px;background:#e74c3c;color:white;border:none;padding:8px 16px;">Cerrar</button>
    </div>
  `;
  document.body.appendChild(modal);
}

function closeModal() {
  const modal = document.getElementById('hint-modal');
  if (modal) modal.remove();
}

async function logHintUsed(trialId, hintId, cost) {
  const { error } = await supabaseClient.rpc('log_hint_used', {
    team_id: teamId,
    trial_id: trialId,
    hint_id: hintId,
    cost: cost
  });

  if (error) console.error('Error al registrar pista:', error);
}

// player/script.js - PARTE 8: Temporizador y Final

function startTimer() {
  trialStartTime = Date.now();
  timer = setInterval(() => {
    const elapsed = Math.floor((Date.now() - trialStartTime) / 1000);
    document.getElementById('timer').textContent = `Tiempo: ${elapsed}s`;
  }, 1000);
}

function getHintsUsedCount(trialId) {
  const log = JSON.parse(localStorage.getItem(`hints_${teamId}`) || '{}');
  return log[trialId] || 0;
}

async function saveTrialResult(timeTaken, hintsUsed, deduction) {
  const { error } = await supabaseClient.rpc('update_team_score', {
    team_id: teamId,
    time_taken: timeTaken,
    hints_used: hintsUsed,
    deduction: deduction
  });

  if (error) console.error('Error al guardar:', error);
}

function showFeedback(msg, type) {
  const feedback = document.createElement('div');
  feedback.textContent = msg;
  feedback.style.cssText = `color:${type==='success'?'green':'red'};font-weight:bold;margin:10px 0;`;
  feedback.id = 'feedback-msg';
  if (document.getElementById('feedback-msg')) document.getElementById('feedback-msg').remove();
  document.getElementById('trial-screen').insertBefore(feedback, document.getElementById('timer'));
  setTimeout(() => feedback.remove(), 2000);
}

async function finishGame() {
  const { data } = await supabaseClient
    .from('teams')
    .update({ is_finished: true, finish_time: new Date().toISOString() })
    .eq('id', teamId)
    .select('total_score, total_time')
    .single();

  document.getElementById('trial-screen').style.display = 'none';
  document.getElementById('finish').style.display = 'block';
  document.getElementById('final-score').textContent = data.total_score;
  document.getElementById('final-time').textContent = formatTime(data.total_time);
}

function formatTime(seconds) {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}m ${secs}s`;
}

// Iniciar app
init();