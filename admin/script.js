let currentGameId = null;
let games = [];
let locations = [];

// Cargar juegos
async function loadGames() {
  const { data, error } = await supabaseClient.from('games').select('*');
  if (error) return alert('Error: ' + error.message);
  games = data;
  renderGames();
}

function renderGames() {
  const ul = document.getElementById('games');
  ul.innerHTML = '';
  games.forEach(game => {
    const li = document.createElement('li');
    li.innerHTML = `
      ${game.title} (${game.active ? '🟢 Activo' : '🔴 Inactivo'}) 
      <button onclick="editGame(${game.id})">Editar</button>
      <button onclick="viewRankings(${game.id})">Rankings</button>
    `;
    ul.appendChild(li);
  });
}

function showCreateGameForm() {
  document.getElementById('create-game').style.display = 'block';
  document.getElementById('game-list').style.display = 'none';
  document.getElementById('game-form').reset();
  currentGameId = null;
}

async function editGame(id) {
  const game = games.find(g => g.id === id);
  if (!game) return;
  currentGameId = id;
  document.getElementById('title').value = game.title;
  document.getElementById('description').value = game.description;
  document.getElementById('narrative').value = game.narrative;
  document.getElementById('active').checked = game.active;
  document.getElementById('mechanic').value = game.mechanic;

  document.getElementById('create-game').style.display = 'block';
  document.getElementById('game-list').style.display = 'none';

  await loadLocations(id);
  document.getElementById('edit-locations').style.display = 'block';
}

async function loadLocations(gameId) {
  const {  locations } = await supabaseClient
    .from('locations')
    .select('*, trials(*, hints(*))')
    .eq('game_id', gameId)
    .order('order_index');
  if (error) return alert('Error cargando localizaciones');
  locations = data || [];
  renderLocations();
}

function renderLocations() {
  const container = document.getElementById('locations-container');
  container.innerHTML = '';
  locations.forEach((loc, idx) => {
    const div = document.createElement('div');
    div.className = 'location';
    div.innerHTML = `
      <h3>📍 Localización ${idx + 1}</h3>
      <input value="${loc.title || ''}" placeholder="Título" onchange="updateLocation(${loc.id}, 'title', this.value)" />
      <textarea placeholder="Narrativa" onchange="updateLocation(${loc.id}, 'narrative', this.value)">${loc.narrative || ''}</textarea>
      <input value="${loc.image_url || ''}" placeholder="URL Imagen" onchange="updateLocation(${loc.id}, 'image_url', this.value)" />
      <input value="${loc.audio_url || ''}" placeholder="URL Audio" onchange="updateLocation(${loc.id}, 'audio_url', this.value)" />
      <button onclick="addTrial(${loc.id})">+ Prueba</button>
      <div id="trials-${loc.id}"></div>
      <button onclick="deleteLocation(${loc.id})">Eliminar</button>
    `;
    container.appendChild(div);
    renderTrials(loc.id, loc.trials || []);
  });
}

async function addLocation() {
  const newLoc = {
    game_id: currentGameId,
    title: 'Nueva Localización',
    narrative: '',
    image_url: '',
    audio_url: '',
    order_index: locations.length
  };
  const { data, error } = await supabaseClient.from('locations').insert([newLoc]).select();
  if (error) return alert('Error: ' + error.message);
  locations.push(data[0]);
  renderLocations();
}

async function updateLocation(id, field, value) {
  const { error } = await supabaseClient.from('locations').update({ [field]: value }).eq('id', id);
  if (error) alert('Error: ' + error.message);
}

async function deleteLocation(id) {
  if (!confirm('¿Eliminar localización?')) return;
  const { error } = await supabaseClient.from('locations').delete().eq('id', id);
  if (error) return alert('Error: ' + error.message);
  locations = locations.filter(l => l.id !== id);
  renderLocations();
}

function renderTrials(locationId, trials) {
  const container = document.getElementById(`trials-${locationId}`);
  container.innerHTML = '';
  trials.forEach(t => {
    const div = document.createElement('div');
    div.className = 'trial';
    div.innerHTML = `
      <strong>[${t.type}]</strong> ${t.question || 'Sin pregunta'}
      <button onclick="editTrial(${t.id})">Editar</button>
      <button onclick="deleteTrial(${t.id}, ${locationId})">Eliminar</button>
      <div id="hints-${t.id}" style="margin: 10px 0;"></div>
    `;
    container.appendChild(div);
    renderHints(t.id, t.hints || []);
  });
}

async function addTrial(locationId) {
  const type = prompt("Tipo de prueba:\n- texto\n- gps\n- qr\n- opciones\n- ordenacion");
  if (!['texto', 'gps', 'qr', 'opciones', 'ordenacion'].includes(type)) {
    alert('Tipo no válido');
    return;
  }

  let trial = {
    location_id: locationId,
    type: type,
    narrative: '',
    image_url: '',
    audio_url: '',
    hints: 3,
    hint_cost: 10
  };

  if (type === 'texto') {
    trial.question = 'Pregunta';
    trial.correct_answer = 'respuesta';
  }

  if (type === 'opciones' || type === 'ordenacion') {
    trial.question = 'Instrucción';
    trial.options = type === 'opciones' 
      ? [{ text: "Opción 1", correct: true }, { text: "Opción 2", correct: false }]
      : [{ text: "Paso 1", order: 1 }, { text: "Paso 2", order: 2 }];
  }

  const { data, error } = await supabaseClient.from('trials').insert([trial]).select();
  if (error) return alert('Error: ' + error.message);
  await loadLocations(currentGameId);
}

function renderHints(trialId, hints) {
  const container = document.getElementById(`hints-${trialId}`);
  container.innerHTML = `<strong>Pistas (${hints.length}):</strong> <button onclick="addHint(${trialId})">+ Añadir</button>`;
  const list = document.createElement('ul');
  hints.sort((a, b) => a.order_index - b.order_index).forEach(hint => {
    const li = document.createElement('li');
    li.className = 'hint-item';
    li.innerHTML = `
      ${hint.content_text?.substring(0, 50) || 'Sin texto'} 
      [${hint.cost} pts]
      <button onclick="editHint(${hint.id})">✏️</button>
      <button onclick="deleteHint(${hint.id}, ${trialId})">🗑️</button>
    `;
    list.appendChild(li);
  });
  container.appendChild(list);
}

async function addHint(trialId) {
  const hint = { trial_id: trialId, content_text: 'Pista...', image_url: '', audio_url: '', cost: 10, order_index: 0 };
  const { data, error } = await supabaseClient.from('hints').insert([hint]).select();
  if (error) return alert('Error: ' + error.message);
  await loadLocations(currentGameId);
}

async function editHint(hintId) {
  const { data: hint, error } = await supabaseClient.from('hints').select('*').eq('id', hintId).single();
  if (error) return;

  const modal = document.createElement('div');
  modal.id = 'edit-hint-modal';
  modal.innerHTML = `
    <div>
      <h4>Editar Pista</h4>
      <textarea id="hint-text" placeholder="Texto">${hint.content_text || ''}</textarea>
      <input id="hint-image" value="${hint.image_url || ''}" placeholder="URL Imagen" />
      <input id="hint-audio" value="${hint.audio_url || ''}" placeholder="URL Audio" />
      <input type="number" id="hint-cost" value="${hint.cost}" min="1" /> Puntos
      <button onclick="saveHint(${hintId})">Guardar</button>
      <button onclick="closeHintModal()">Cancelar</button>
    </div>
  `;
  document.body.appendChild(modal);
}

function closeHintModal() {
  const modal = document.getElementById('edit-hint-modal');
  if (modal) modal.remove();
}

async function saveHint(hintId) {
  const data = {
    content_text: document.getElementById('hint-text').value,
    image_url: document.getElementById('hint-image').value,
    audio_url: document.getElementById('hint-audio').value,
    cost: parseInt(document.getElementById('hint-cost').value)
  };
  const { error } = await supabaseClient.from('hints').update(data).eq('id', hintId);
  if (error) alert('Error: ' + error.message);
  closeHintModal();
  await loadLocations(currentGameId);
}

async function deleteHint(hintId, trialId) {
  if (!confirm('¿Eliminar pista?')) return;
  const { error } = await supabaseClient.from('hints').delete().eq('id', hintId);
  if (!error) await loadLocations(currentGameId);
}

async function saveGame() {
  const form = document.getElementById('game-form');
  const gameData = {
    title: form.title.value,
    description: form.description.value,
    narrative: form.narrative.value,
    mechanic: form.mechanic.value,
    active: form.active.checked
  };

  if (currentGameId) {
    const { error } = await supabaseClient.from('games').update(gameData).eq('id', currentGameId);
    if (error) return alert('Error: ' + error.message);
    alert('Juego actualizado');
  } else {
    const { data, error } = await supabaseClient.from('games').insert([gameData]).select();
    if (error) return alert('Error: ' + error.message);
    currentGameId = data[0].id;
    alert('Juego creado');
  }
  loadGames();
  document.getElementById('edit-locations').style.display = 'block';
}

function previewGame() {
  const game = games.find(g => g.id === currentGameId);
  const content = document.getElementById('preview-content');
  content.innerHTML = `
    <h3>${game.title}</h3>
    <p>${game.narrative}</p>
    <p><strong>Mecánica:</strong> ${game.mechanic}</p>
    ${locations.map(l => `
      <div><strong>${l.title}</strong>: ${l.narrative || 'Sin narrativa'}</div>
      ${l.trials.map(t => `
        <div class="trial">
          <strong>[${t.type}]</strong> ${t.question}
          ${t.hints && t.hints.length > 0 ? `
            <div><small>💡 Pistas: ${t.hints.length}</small></div>
            ${t.hints.map(h => `<div style="font-size:0.9em;">${h.content_text}</div>`).join('')}
          ` : ''}
        </div>
      `).join('')}
    `).join('')}
  `;
  document.getElementById('preview').style.display = 'block';
  document.getElementById('edit-locations').style.display = 'none';
}

function exitPreview() {
  document.getElementById('preview').style.display = 'none';
  document.getElementById('edit-locations').style.display = 'block';
}

function viewRankings(gameId) {
  // Implementar si se desea
}

// Event Listeners
document.getElementById('game-form').addEventListener('submit', (e) => {
  e.preventDefault();
  saveGame();
});

// Inicializar
loadGames();