// ===== ПОДАВЛЕНИЕ ОШИБОК РАСШИРЕНИЙ =====
window.addEventListener('error', (e) => {
    if (e.message && (e.message.includes('runtime.lastError') || e.message.includes('message port'))) {
        e.stopImmediatePropagation();
        return false;
    }
});

// ===== FIREBASE =====
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-app.js";
import { getFirestore, collection, addDoc, getDocs, getDoc, doc, deleteDoc, updateDoc, setDoc, query, where, onSnapshot } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyCZH3ZrRWqhr25goGwGjJUHCqCiYoHxqiM",
  authDomain: "perm-map-38735.firebaseapp.com",
  projectId: "perm-map-38735",
  storageBucket: "perm-map-38735.firebasestorage.app",
  messagingSenderId: "938258637332",
  appId: "1:938258637332:web:cf47a541ead77f0d857d01"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// ===== CLOUDINARY =====
const CLOUDINARY_CLOUD_NAME = 'dbtwgtle5';
const CLOUDINARY_UPLOAD_PRESET = 'travel_map';

// ===== ПОГОДА (Open-Meteo — бесплатно, без ключа) =====
const PERM_LAT = 58.0105;
const PERM_LON = 56.2502;
const WEATHER_CACHE_KEY = 'weather_cache_v2';
const WEATHER_CACHE_TTL = 30 * 60 * 1000;

function getWeatherEmoji(code, isDay) {
    if (code === 0)    return isDay ? '☀️' : '🌙';
    if (code <= 2)     return isDay ? '⛅' : '🌤️';
    if (code === 3)    return '☁️';
    if (code <= 48)    return '🌫️';
    if (code <= 55)    return '🌦️';
    if (code <= 65)    return '🌧️';
    if (code <= 75)    return '❄️';
    if (code <= 82)    return '🌧️';
    if (code <= 86)    return '🌨️';
    return '⛈️';
}

function renderWeather(data) {
    const widget = document.getElementById('weather-widget');
    if (!widget) return;
    const c     = data.current;
    const temp  = Math.round(c.temperature_2m);
    const feels = Math.round(c.apparent_temperature);
    const wind  = Math.round(c.wind_speed_10m);
    const emoji = getWeatherEmoji(c.weather_code, c.is_day);
    widget.innerHTML = `
        <div class="weather-card" title="Ощущается как ${feels}° · Ветер ${wind} км/ч">
            <span class="weather-emoji">${emoji}</span>
            <span class="weather-temp">${temp}°</span>
            <span class="weather-desc">ощущается ${feels}°</span>
        </div>`;
}

function loadWeatherFromCache() {
    try {
        const raw = localStorage.getItem(WEATHER_CACHE_KEY);
        if (!raw) return false;
        const { data, timestamp } = JSON.parse(raw);
        renderWeather(data);
        return Date.now() - timestamp < WEATHER_CACHE_TTL;
    } catch { return false; }
}

async function fetchWeather() {
    const cacheIsFresh = loadWeatherFromCache();
    if (cacheIsFresh) return;
    try {
        const url = `https://api.open-meteo.com/v1/forecast?latitude=${PERM_LAT}&longitude=${PERM_LON}&current=temperature_2m,apparent_temperature,weather_code,wind_speed_10m,is_day&timezone=Europe%2FMoscow`;
        const response = await fetch(url);
        if (!response.ok) throw new Error('Weather error: ' + response.status);
        const data = await response.json();
        localStorage.setItem(WEATHER_CACHE_KEY, JSON.stringify({ data, timestamp: Date.now() }));
        renderWeather(data);
    } catch (e) {
        console.error('Ошибка погоды:', e);
        const widget = document.getElementById('weather-widget');
        if (widget && !widget.innerHTML.includes('weather-card'))
            widget.innerHTML = `<div class="weather-error">🌤️</div>`;
    }
}

setInterval(fetchWeather, WEATHER_CACHE_TTL);
fetchWeather();

// ===== ПЕРСОНАЖИ =====
const BOY  = { id: 'boy',  name: 'Леша', emoji: '🧑', color: '#3498db', gradient: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' };
const GIRL = { id: 'girl', name: 'Лера', emoji: '👩', color: '#e91e63', gradient: 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)' };

// ===== ТЁМНАЯ ТЕМА =====
function initTheme() {
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    const savedTheme = localStorage.getItem('theme');
    if (savedTheme === 'dark' || (!savedTheme && prefersDark))
        document.body.classList.add('dark-theme');

    document.getElementById('theme-toggle')?.addEventListener('click', () => {
        document.body.classList.toggle('dark-theme');
        localStorage.setItem('theme', document.body.classList.contains('dark-theme') ? 'dark' : 'light');
    });
}

// ===== КАРТА =====
const permCoords = [58.0105, 56.2502];
const map = L.map('map').setView(permCoords, 13);
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
  maxZoom: 19, attribution: '&copy; OpenStreetMap'
}).addTo(map);

let currentUser = null;
let currentClickLatLng = null;
let currentPlaceId = null;
let selectedPhotoFile = null;
let allPlaces = []; // локальный кэш всех мест

// ===== DOM =====
const characterSelect = document.getElementById('character-select');
const countdown       = document.getElementById('countdown');
const modal           = document.getElementById('add-marker-modal');
const commentsModal   = document.getElementById('comments-modal');
const noteModal       = document.getElementById('note-modal');
const legend          = document.getElementById('legend');
const sidePanel       = document.getElementById('side-panel');

const titleInput    = document.getElementById('place-title');
const descInput     = document.getElementById('place-desc');
const categoryInput = document.getElementById('place-category');
const photoInput    = document.getElementById('place-photo');
const photoPreview  = document.getElementById('photo-preview');
const modalAuthor   = document.getElementById('modal-author');

const commentsList      = document.getElementById('comments-list');
const commentText       = document.getElementById('comment-text');
const commentAuthor     = document.getElementById('comment-author');
const commentsPlaceTitle = document.getElementById('comments-place-title');

// ===== ВЫБОР ПЕРСОНАЖА =====
document.getElementById('btn-boy').addEventListener('click',  () => selectCharacter('boy'));
document.getElementById('btn-girl').addEventListener('click', () => selectCharacter('girl'));

function selectCharacter(user) {
  currentUser = user;
  const userData = user === 'boy' ? BOY : GIRL;
  localStorage.setItem('travelUser', user);

  document.getElementById('current-user-display').textContent = `${userData.emoji} ${userData.name}`;
  modalAuthor.textContent  = `${userData.emoji} ${userData.name === 'Леша' ? 'Моя метка' : 'Её метка'}`;
  commentAuthor.textContent = userData.emoji;
  modalAuthor.className    = `author-badge ${user}`;
  commentAuthor.className  = `comment-author-badge ${user}`;

  characterSelect.classList.add('hidden');
  countdown.classList.remove('hidden');
}

const savedUser = localStorage.getItem('travelUser');
if (savedUser) {
  characterSelect.classList.add('hidden');
  countdown.classList.remove('hidden');
  selectCharacter(savedUser);
}

document.getElementById('switch-user').addEventListener('click', () => {
  countdown.classList.add('hidden');
  characterSelect.classList.remove('hidden');
  localStorage.removeItem('travelUser');
});

// ===== ПРЕВЬЮ ФОТО =====
photoInput.addEventListener('change', (e) => {
  const file = e.target.files[0];
  if (!file) return;
  if (file.size > 5 * 1024 * 1024) {
    alert('Фото слишком большое! Максимум 5MB');
    photoInput.value = '';
    return;
  }
  selectedPhotoFile = file;
  const reader = new FileReader();
  reader.onload = (ev) => {
    photoPreview.innerHTML = `<img src="${ev.target.result}" alt="preview" />`;
    photoPreview.classList.remove('hidden');
  };
  reader.readAsDataURL(file);
});

// ===== КЛИК ПО КАРТЕ =====
map.on('click', function(e) {
  if (!currentUser) return;
  currentClickLatLng = e.latlng;
  modal.classList.remove('hidden');
});

// ===== ЗАКРЫТИЕ МОДАЛОК =====
function closeModal() {
  modal.classList.add('hidden');
  titleInput.value = '';
  descInput.value  = '';
  photoInput.value = '';
  photoPreview.innerHTML = '';
  photoPreview.classList.add('hidden');
  selectedPhotoFile  = null;
  currentClickLatLng = null;
}

document.getElementById('close-modal-btn').addEventListener('click', closeModal);
modal.addEventListener('click', (e) => { if (e.target === modal) closeModal(); });

document.getElementById('close-comments-btn').addEventListener('click', () => {
  commentsModal.classList.add('hidden');
  currentPlaceId = null;
});
commentsModal.addEventListener('click', (e) => { if (e.target === commentsModal) commentsModal.classList.add('hidden'); });

// ===== ЗАГРУЗКА ФОТО В CLOUDINARY =====
async function uploadPhotoToCloudinary(file) {
  if (!file) return null;
  const url = `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/image/upload`;
  const formData = new FormData();
  formData.append('file', file);
  formData.append('upload_preset', CLOUDINARY_UPLOAD_PRESET);
  try {
    const response = await fetch(url, { method: 'POST', body: formData });
    if (!response.ok) throw new Error('Upload failed: ' + response.status);
    const data = await response.json();
    return data.secure_url.replace('/upload/', '/upload/w_800,q_auto,f_auto/');
  } catch (e) {
    console.error('Cloudinary error:', e);
    alert('Ошибка загрузки фото. Проверь Upload Preset в Cloudinary.');
    return null;
  }
}

// ===== СОЗДАНИЕ МАРКЕРА =====
function addMarkerToMap(id, lat, lng, title, desc, category, photoUrl, author, status) {
  const isBoy    = author === 'boy';
  const userData = isBoy ? BOY : GIRL;
  const isDone   = status === 'done';

  const bg     = isBoy ? '#3498db' : '#e91e63';
  const shadow = isBoy ? 'rgba(52,152,219,0.4)' : 'rgba(233,30,99,0.4)';
  const opacity = isDone ? '0.55' : '1';
  const checkmark = isDone ? '<div class="marker-done">✓</div>' : '';

  const customIcon = L.divIcon({
    className: 'custom-div-icon',
    html: `<div class="marker-pin" style="background:${bg};box-shadow:0 4px 15px ${shadow};border:3px solid white;opacity:${opacity};">
      <span class="marker-emoji">${category}</span>
      <div class="marker-author">${userData.emoji}</div>
      ${checkmark}
    </div>`,
    iconSize: [40, 48], iconAnchor: [20, 48], popupAnchor: [0, -50]
  });

  const statusLabel = isDone
    ? `<span class="status-badge done">✅ Уже были</span>`
    : `<span class="status-badge want">🎯 Хотим сходить</span>`;

  const statusBtn = `<button class="status-toggle-btn" onclick="toggleStatus('${id}', '${status || 'want'}')">
    ${isDone ? '↩️ Хотим ещё' : '✅ Уже были!'}
  </button>`;

  let popup = `<div class="popup-card">`;
  popup += `<div class="popup-header" style="background:${bg}">`;
  popup += `<span class="popup-category">${category}</span>`;
  popup += `<span class="popup-author">${userData.emoji} ${userData.name}</span></div>`;
  popup += `<div class="popup-body">`;
  popup += `<div class="popup-status-row">${statusLabel}${statusBtn}</div>`;
  popup += `<h4>${title}</h4>`;
  if (desc) popup += `<p>${desc}</p>`;
  if (photoUrl) popup += `<img src="${photoUrl}" class="popup-photo" loading="lazy" onclick="window.open('${photoUrl}','_blank')" />`;
  popup += `</div><div class="popup-footer">`;
  popup += `<button class="comments-btn" onclick="openComments('${id}','${title.replace(/'/g,"\\'")}')">💬 Комментарии</button>`;
  if (author === currentUser) popup += `<button class="delete-btn" onclick="deletePlace('${id}')">🗑</button>`;
  popup += `</div></div>`;

  const marker = L.marker([lat, lng], { icon: customIcon }).addTo(map);
  marker.bindPopup(popup, { maxWidth: 300, className: 'custom-popup' });
  marker.placeId = id;
  return marker;
}

// ===== ПЕРЕКЛЮЧЕНИЕ СТАТУСА =====
window.toggleStatus = async function(id, currentStatus) {
  const newStatus = currentStatus === 'done' ? 'want' : 'done';
  try {
    await updateDoc(doc(db, "places", id), { status: newStatus });
    // Обновляем маркер
    map.eachLayer(layer => {
      if (layer instanceof L.Marker && layer.placeId === id) map.removeLayer(layer);
    });
    const place = allPlaces.find(p => p.id === id);
    if (place) {
      place.status = newStatus;
      addMarkerToMap(id, place.lat, place.lng, place.title, place.desc, place.category, place.photoUrl, place.author, newStatus);
    }
    updateCounters();
    renderPanel();
  } catch (e) { console.error('Ошибка статуса:', e); }
};

// ===== СОХРАНИТЬ МЕСТО =====
document.getElementById('save-marker-btn').addEventListener('click', async () => {
  if (!currentClickLatLng) { alert('Сначала кликни по карте!'); return; }
  const title    = titleInput.value.trim();
  const desc     = descInput.value.trim();
  const category = categoryInput.value;
  if (!title) { alert('Введи название места!'); return; }

  const btn = document.getElementById('save-marker-btn');
  btn.disabled = true; btn.textContent = '⏳ Сохраняю...';

  try {
    let photoUrl = null;
    if (selectedPhotoFile) photoUrl = await uploadPhotoToCloudinary(selectedPhotoFile);

    const docRef = await addDoc(collection(db, "places"), {
      lat: currentClickLatLng.lat, lng: currentClickLatLng.lng,
      title, desc, category, photoUrl,
      author: currentUser,
      status: 'want',
      createdAt: new Date().toISOString()
    });

    const newPlace = {
      id: docRef.id,
      lat: currentClickLatLng.lat, lng: currentClickLatLng.lng,
      title, desc, category, photoUrl,
      author: currentUser,
      status: 'want',
      createdAt: new Date().toISOString()
    };
    allPlaces.push(newPlace);
    addMarkerToMap(docRef.id, currentClickLatLng.lat, currentClickLatLng.lng, title, desc, category, photoUrl, currentUser, 'want');
    updateCounters();
    renderPanel();
    closeModal();
  } catch (e) {
    console.error("Ошибка сохранения:", e);
    alert("Ошибка сохранения! " + e.message);
  } finally {
    btn.disabled = false; btn.textContent = '💾 Сохранить';
  }
});

// ===== УДАЛЕНИЕ =====
window.deletePlace = async function(id) {
  if (!confirm('Удалить это место? Все комментарии тоже удалятся.')) return;
  try {
    await deleteDoc(doc(db, "places", id));
    const q = query(collection(db, "comments"), where("placeId", "==", id));
    const snap = await getDocs(q);
    snap.forEach(async (c) => { await deleteDoc(doc(db, "comments", c.id)); });
    map.eachLayer((layer) => { if (layer instanceof L.Marker && layer.placeId === id) map.removeLayer(layer); });
    allPlaces = allPlaces.filter(p => p.id !== id);
    updateCounters();
    renderPanel();
  } catch (e) { console.error(e); alert("Не удалось удалить: " + e.message); }
};

// ===== КОММЕНТАРИИ =====
window.openComments = async function(placeId, placeTitle) {
  currentPlaceId = placeId;
  commentsPlaceTitle.textContent = `💬 ${placeTitle}`;
  commentsModal.classList.remove('hidden');
  await loadComments(placeId);
};

async function loadComments(placeId) {
  commentsList.innerHTML = '<div class="loading">Загрузка...</div>';
  try {
    const q    = query(collection(db, "comments"), where("placeId", "==", placeId));
    const snap = await getDocs(q);

    if (snap.empty) {
      commentsList.innerHTML = '<div class="no-comments">Пока нет комментариев. Будь первым! 💕</div>';
      return;
    }

    const comments = [];
    snap.forEach((doc) => comments.push({ id: doc.id, ...doc.data() }));
    comments.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));

    commentsList.innerHTML = '';
    comments.forEach((data) => {
      const userData = data.author === 'boy' ? BOY : GIRL;
      const isMe     = data.author === currentUser;
      const el       = document.createElement('div');
      el.className   = `comment ${isMe ? 'comment-mine' : 'comment-hers'}`;
      el.innerHTML   = `
        <div class="comment-avatar" style="background:${userData.color}">${userData.emoji}</div>
        <div class="comment-bubble">
          <div class="comment-header">
            <span class="comment-name">${userData.name}</span>
            <span class="comment-time">${formatTime(data.createdAt)}</span>
          </div>
          <div class="comment-text">${escapeHtml(data.text)}</div>
        </div>`;
      commentsList.appendChild(el);
    });
    commentsList.scrollTop = commentsList.scrollHeight;
  } catch (e) {
    console.error("Ошибка загрузки комментариев:", e);
    commentsList.innerHTML = `<div class="error">Ошибка загрузки 💔<br><small>${e.message}</small></div>`;
  }
}

document.getElementById('send-comment-btn').addEventListener('click', async () => {
  const text = commentText.value.trim();
  if (!text || !currentPlaceId) return;
  try {
    const btn = document.getElementById('send-comment-btn');
    btn.disabled = true; btn.textContent = '...';
    await addDoc(collection(db, "comments"), {
      placeId: currentPlaceId, author: currentUser, text,
      createdAt: new Date().toISOString()
    });
    commentText.value = '';
    await loadComments(currentPlaceId);
  } catch (e) {
    console.error("Ошибка отправки:", e);
    alert("Не удалось отправить: " + e.message);
  } finally {
    const btn = document.getElementById('send-comment-btn');
    btn.disabled = false; btn.textContent = 'Отправить';
  }
});

commentText.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    document.getElementById('send-comment-btn').click();
  }
});

// ===== ОБЩАЯ ЗАМЕТКА =====
document.getElementById('note-btn').addEventListener('click', () => {
  noteModal.classList.remove('hidden');
  loadNote();
});
document.getElementById('close-note-btn').addEventListener('click', () => noteModal.classList.add('hidden'));
noteModal.addEventListener('click', (e) => { if (e.target === noteModal) noteModal.classList.add('hidden'); });

async function loadNote() {
  const noteText = document.getElementById('note-text');
  const noteMeta = document.getElementById('note-meta');
  noteText.value = 'Загрузка...';
  noteText.disabled = true;
  try {
    const snap = await getDoc(doc(db, "shared", "note"));
    if (snap.exists()) {
      const d = snap.data();
      noteText.value = d.text || '';
      const who = d.updatedBy === 'boy' ? BOY : GIRL;
      noteMeta.textContent = `Последнее изменение: ${who.emoji} ${who.name}, ${formatTime(d.updatedAt)}`;
    } else {
      noteText.value = '';
      noteMeta.textContent = 'Заметка пока пустая';
    }
  } catch (e) {
    noteText.value = '';
    noteMeta.textContent = 'Ошибка загрузки';
  } finally {
    noteText.disabled = false;
  }
}

document.getElementById('save-note-btn').addEventListener('click', async () => {
  const noteText = document.getElementById('note-text');
  const btn = document.getElementById('save-note-btn');
  btn.disabled = true; btn.textContent = '⏳ Сохраняю...';
  try {
    await setDoc(doc(db, "shared", "note"), {
      text: noteText.value,
      updatedBy: currentUser,
      updatedAt: new Date().toISOString()
    });
    const who = currentUser === 'boy' ? BOY : GIRL;
    document.getElementById('note-meta').textContent = `Сохранено: ${who.emoji} ${who.name}, только что`;
    showNotification('📝 Заметка сохранена', 'Партнёр увидит изменения');
  } catch (e) {
    alert('Ошибка сохранения заметки: ' + e.message);
  } finally {
    btn.disabled = false; btn.textContent = '💾 Сохранить заметку';
  }
});

// ===== БОКОВАЯ ПАНЕЛЬ =====
let currentTab    = 'list';
let currentFilter = 'all';

document.getElementById('panel-toggle-btn').addEventListener('click', () => {
  sidePanel.classList.toggle('hidden');
  if (!sidePanel.classList.contains('hidden')) renderPanel();
});
document.getElementById('close-panel-btn').addEventListener('click', () => sidePanel.classList.add('hidden'));

window.switchTab = function(tab) {
  currentTab = tab;
  document.getElementById('tab-list').classList.toggle('active',     tab === 'list');
  document.getElementById('tab-timeline').classList.toggle('active', tab === 'timeline');
  document.getElementById('panel-list').classList.toggle('hidden',     tab !== 'list');
  document.getElementById('panel-timeline').classList.toggle('hidden', tab !== 'timeline');
  document.getElementById('panel-filters').style.display = tab === 'list' ? 'flex' : 'none';
  renderPanel();
};

// Фильтры
document.querySelectorAll('.filter-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    currentFilter = btn.dataset.filter;
    renderPanel();
  });
});

function renderPanel() {
  if (currentTab === 'list') renderPlacesList();
  else renderTimeline();
}

function renderPlacesList() {
  const container = document.getElementById('panel-list');
  let places = [...allPlaces];

  if (currentFilter === 'want') places = places.filter(p => p.status !== 'done');
  if (currentFilter === 'done') places = places.filter(p => p.status === 'done');

  if (places.length === 0) {
    container.innerHTML = `<div class="panel-empty">Мест нет 🗺️</div>`;
    return;
  }

  container.innerHTML = places.map(p => {
    const user   = p.author === 'boy' ? BOY : GIRL;
    const isDone = p.status === 'done';
    return `<div class="panel-item ${isDone ? 'panel-item-done' : ''}" onclick="flyToPlace(${p.lat}, ${p.lng})">
      <div class="panel-item-icon">${p.category}</div>
      <div class="panel-item-info">
        <div class="panel-item-title">${p.title}</div>
        <div class="panel-item-meta">${user.emoji} ${user.name} · ${isDone ? '✅ Были' : '🎯 Хотим'}</div>
      </div>
    </div>`;
  }).join('');
}

function renderTimeline() {
  const container = document.getElementById('panel-timeline');
  if (allPlaces.length === 0) {
    container.innerHTML = `<div class="panel-empty">Мест пока нет 🗺️</div>`;
    return;
  }

  const sorted = [...allPlaces].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

  // Группируем по дате
  const groups = {};
  sorted.forEach(p => {
    const d   = new Date(p.createdAt);
    const key = `${d.getDate()}.${d.getMonth() + 1}.${d.getFullYear()}`;
    if (!groups[key]) groups[key] = [];
    groups[key].push(p);
  });

  container.innerHTML = Object.entries(groups).map(([date, places]) => `
    <div class="timeline-group">
      <div class="timeline-date">${date}</div>
      ${places.map(p => {
        const user = p.author === 'boy' ? BOY : GIRL;
        return `<div class="timeline-item" onclick="flyToPlace(${p.lat}, ${p.lng})">
          <div class="timeline-dot" style="background:${user.color}"></div>
          <div class="timeline-content">
            <span class="timeline-cat">${p.category}</span>
            <span class="timeline-title">${p.title}</span>
            <span class="timeline-who">${user.emoji}</span>
          </div>
        </div>`;
      }).join('')}
    </div>
  `).join('');
}

window.flyToPlace = function(lat, lng) {
  map.setView([lat, lng], 16, { animate: true });
  sidePanel.classList.add('hidden');
};

// ===== СЧЁТЧИКИ =====
function updateCounters() {
  const boyCount  = allPlaces.filter(p => p.author === 'boy').length;
  const girlCount = allPlaces.filter(p => p.author === 'girl').length;
  const bc = document.getElementById('boy-count');
  const gc = document.getElementById('girl-count');
  if (bc) bc.textContent = boyCount;
  if (gc) gc.textContent = girlCount;
}

// ===== УТИЛИТЫ =====
function formatTime(iso) {
  const d = new Date(iso), n = new Date(), diff = (n - d) / 1000;
  if (diff < 60)    return 'только что';
  if (diff < 3600)  return `${Math.floor(diff / 60)} мин назад`;
  if (diff < 86400) return `${Math.floor(diff / 3600)} ч назад`;
  return `${d.getDate()}.${d.getMonth() + 1}`;
}

function escapeHtml(t) { const d = document.createElement('div'); d.textContent = t; return d.innerHTML; }

// ===== ЗАГРУЗКА МЕСТ =====
async function loadPlaces() {
  try {
    const snap = await getDocs(collection(db, "places"));
    allPlaces = [];
    snap.forEach((document) => {
      const d = document.data();
      const place = { id: document.id, ...d, author: d.author || 'boy', status: d.status || 'want' };
      allPlaces.push(place);
      addMarkerToMap(document.id, d.lat, d.lng, d.title, d.desc, d.category, d.photoUrl, place.author, place.status);
    });
    updateCounters();
    renderPanel();
    console.log(`✅ Загружено ${snap.size} мест`);
  } catch (e) { console.error("Ошибка загрузки мест:", e); }
}

// ===== ТАЙМЕР =====
const meetingDate = new Date('2026-06-23T06:00:00');
function updateTimer() {
  const diff = meetingDate - new Date();
  if (diff <= 0) { document.getElementById('timer').innerText = "Мы вместе! 💖🎉"; return; }
  const d = Math.floor(diff / 86400000), h = Math.floor((diff % 86400000) / 3600000), m = Math.floor((diff % 3600000) / 60000);
  document.getElementById('timer').innerText = `${d}д ${h}ч ${m}м`;
}
setInterval(updateTimer, 1000); updateTimer();

// ===== ГЕОЛОКАЦИЯ =====
let userLocationMarker = null;

function initGeolocation() {
    if (!navigator.geolocation) return;
    document.getElementById('locate-btn')?.addEventListener('click', () => {
        navigator.geolocation.getCurrentPosition(
            (position) => {
                const lat = position.coords.latitude;
                const lng = position.coords.longitude;
                if (userLocationMarker) map.removeLayer(userLocationMarker);
                const pulseIcon = L.divIcon({
                    className: 'pulse-marker',
                    html: `<div class="pulse-dot"></div><div class="pulse-ring"></div>`,
                    iconSize: [20, 20], iconAnchor: [10, 10]
                });
                userLocationMarker = L.marker([lat, lng], { icon: pulseIcon }).addTo(map);
                map.setView([lat, lng], 15);
                showDistanceToPerm(lat, lng);
            },
            (err) => { console.error('Геолокация ошибка:', err); alert('Не удалось получить геолокацию.'); },
            { enableHighAccuracy: true, timeout: 5000 }
        );
    });
}

function showDistanceToPerm(lat, lng) {
    const R = 6371;
    const dLat = (PERM_LAT - lat) * Math.PI / 180;
    const dLng = (PERM_LON - lng) * Math.PI / 180;
    const a = Math.sin(dLat/2)**2 + Math.cos(lat*Math.PI/180) * Math.cos(PERM_LAT*Math.PI/180) * Math.sin(dLng/2)**2;
    const distance = Math.round(R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a)));
    L.popup()
        .setLatLng([lat, lng])
        .setContent(`📍 Ты здесь<br>🚗 ${distance} км до Перми<br>💕 Скоро увидимся!`)
        .openOn(map);
}

// ===== LIVE ИНДИКАТОР + УВЕДОМЛЕНИЯ =====
let lastPlacesCount = 0;
let isFirstLoad = true;

function initLiveIndicator() {
    onSnapshot(collection(db, "places"), (snapshot) => {
        const count = snapshot.size;
        const indicator = document.getElementById('live-indicator');
        if (indicator) {
            indicator.classList.add('active');
            setTimeout(() => indicator.classList.remove('active'), 3000);
        }
        if (!isFirstLoad && count > lastPlacesCount)
            showNotification('💕 Новая метка!', 'Кто-то добавил место на карту');
        lastPlacesCount = count;
        isFirstLoad = false;
    });
}

function showNotification(title, body) {
    if (navigator.vibrate) navigator.vibrate([200, 100, 200]);
    const notif = document.createElement('div');
    notif.className = 'in-app-notification';
    notif.innerHTML = `<strong>${title}</strong><br>${body}`;
    document.body.appendChild(notif);
    setTimeout(() => notif.classList.add('show'), 100);
    setTimeout(() => { notif.classList.remove('show'); setTimeout(() => notif.remove(), 300); }, 4000);
    if ('Notification' in window && Notification.permission === 'granted')
        new Notification(title, { body, icon: 'icon-192.png' });
}

function requestNotificationPermission() {
    if ('Notification' in window && Notification.permission === 'default')
        Notification.requestPermission();
}

// ===== ВХОД НА КАРТУ =====
document.getElementById('enter-btn').addEventListener('click', () => {
  countdown.classList.add('hidden');
  legend.classList.remove('hidden');
  setTimeout(() => { map.invalidateSize(); loadPlaces(); }, 600);
  requestNotificationPermission();
  initLiveIndicator();
});

// ===== ИНИЦИАЛИЗАЦИЯ =====
initTheme();
initGeolocation();
