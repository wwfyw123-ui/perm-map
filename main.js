// ===== ПОДАВЛЕНИЕ ОШИБОК РАСШИРЕНИЙ =====
window.addEventListener('error', (e) => {
    if (e.message && (e.message.includes('runtime.lastError') || e.message.includes('message port'))) {
        e.stopImmediatePropagation();
        return false;
    }
});

// ===== FIREBASE =====
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-app.js";
import { getFirestore, collection, addDoc, getDocs, doc, deleteDoc, query, where, orderBy } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";

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

// ===== CLOUDINARY НАСТРОЙКИ =====
// ЗАМЕНИ ЭТИ ДВА ЗНАЧЕНИЯ:
const CLOUDINARY_CLOUD_NAME = 'ТВОЙ_CLOUD_NAME'; // Например: 'dxabc123'
const CLOUDINARY_UPLOAD_PRESET = 'travel_map';   // Тот что создал в пресете

// ===== ПЕРСОНАЖИ =====
const BOY = {
  id: 'boy',
  name: 'Я',
  emoji: '🧑',
  color: '#3498db',
  gradient: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)'
};

const GIRL = {
  id: 'girl',
  name: 'Она',
  emoji: '👩',
  color: '#e91e63',
  gradient: 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)'
};

// ===== КАРТА =====
const permCoords = [58.0105, 56.2502];
const map = L.map('map').setView(permCoords, 13);
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
  maxZoom: 19,
  attribution: '&copy; OpenStreetMap'
}).addTo(map);

let currentUser = null;
let currentClickLatLng = null;
let currentPlaceId = null;
let selectedPhotoFile = null;

// ===== DOM =====
const characterSelect = document.getElementById('character-select');
const countdown = document.getElementById('countdown');
const modal = document.getElementById('add-marker-modal');
const commentsModal = document.getElementById('comments-modal');
const legend = document.getElementById('legend');

const titleInput = document.getElementById('place-title');
const descInput = document.getElementById('place-desc');
const categoryInput = document.getElementById('place-category');
const photoInput = document.getElementById('place-photo');
const photoPreview = document.getElementById('photo-preview');
const modalAuthor = document.getElementById('modal-author');

const commentsList = document.getElementById('comments-list');
const commentText = document.getElementById('comment-text');
const commentAuthor = document.getElementById('comment-author');
const commentsPlaceTitle = document.getElementById('comments-place-title');

// ===== ВЫБОР ПЕРСОНАЖА =====
document.getElementById('btn-boy').addEventListener('click', () => selectCharacter('boy'));
document.getElementById('btn-girl').addEventListener('click', () => selectCharacter('girl'));

function selectCharacter(user) {
  currentUser = user;
  const userData = user === 'boy' ? BOY : GIRL;
  
  localStorage.setItem('travelUser', user);
  
  document.getElementById('current-user-display').textContent = `${userData.emoji} ${userData.name}`;
  modalAuthor.textContent = `${userData.emoji} ${userData.name === 'Я' ? 'Моя метка' : 'Её метка'}`;
  commentAuthor.textContent = userData.emoji;
  modalAuthor.className = `author-badge ${user}`;
  commentAuthor.className = `comment-author-badge ${user}`;
  
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
  
  // Проверка размера (макс 5MB для Cloudinary free)
  if (file.size > 5 * 1024 * 1024) {
    alert('Фото слишком большое! Максимум 5MB');
    photoInput.value = '';
    return;
  }
  
  selectedPhotoFile = file;
  const reader = new FileReader();
  reader.onload = (event) => {
    photoPreview.innerHTML = `<img src="${event.target.result}" alt="preview" />`;
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
  descInput.value = '';
  photoInput.value = '';
  photoPreview.innerHTML = '';
  photoPreview.classList.add('hidden');
  selectedPhotoFile = null;
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
    const response = await fetch(url, {
      method: 'POST',
      body: formData
    });
    
    if (!response.ok) throw new Error('Upload failed');
    
    const data = await response.json();
    // Возвращаем оптимизированную ссылку (авто-сжатие, webp)
    return data.secure_url.replace('/upload/', '/upload/w_800,q_auto,f_auto/');
    
  } catch (e) {
    console.error('Cloudinary error:', e);
    alert('Ошибка загрузки фото. Проверь настройки Cloudinary.');
    return null;
  }
}

// ===== СОЗДАНИЕ МАРКЕРА =====
function getMarkerStyle(author) {
  const isBoy = author === 'boy';
  return {
    bg: isBoy ? '#3498db' : '#e91e63',
    shadow: isBoy ? 'rgba(52, 152, 219, 0.4)' : 'rgba(233, 30, 99, 0.4)'
  };
}

function addMarkerToMap(id, lat, lng, title, desc, category, photoUrl, author) {
  const style = getMarkerStyle(author);
  const userData = author === 'boy' ? BOY : GIRL;
  
  const customIcon = L.divIcon({
    className: 'custom-div-icon',
    html: `
      <div class="marker-pin" style="
        background: ${style.bg};
        box-shadow: 0 4px 15px ${style.shadow};
        border: 3px solid white;
      ">
        <span class="marker-emoji">${category}</span>
        <div class="marker-author">${userData.emoji}</div>
      </div>
    `,
    iconSize: [40, 48],
    iconAnchor: [20, 48],
    popupAnchor: [0, -50]
  });

  let popupContent = `<div class="popup-card">`;
  popupContent += `<div class="popup-header" style="background: ${style.bg}">`;
  popupContent += `<span class="popup-category">${category}</span>`;
  popupContent += `<span class="popup-author">${userData.emoji} ${userData.name}</span>`;
  popupContent += `</div>`;
  
  popupContent += `<div class="popup-body">`;
  popupContent += `<h4>${title}</h4>`;
  if (desc) popupContent += `<p>${desc}</p>`;
  if (photoUrl) {
    popupContent += `<img src="${photoUrl}" class="popup-photo" alt="фото" loading="lazy" onclick="window.open('${photoUrl}', '_blank')" />`;
  }
  popupContent += `</div>`;
  
  popupContent += `<div class="popup-footer">`;
  popupContent += `<button class="comments-btn" onclick="openComments('${id}', '${title.replace(/'/g, "\\'")}')">💬 Комментарии</button>`;
  if (author === currentUser) {
    popupContent += `<button class="delete-btn" onclick="deletePlace('${id}')">🗑</button>`;
  }
  popupContent += `</div>`;
  popupContent += `</div>`;

  const marker = L.marker([lat, lng], { icon: customIcon }).addTo(map);
  marker.bindPopup(popupContent, { maxWidth: 300, className: 'custom-popup' });
  marker.placeId = id;
  return marker;
}

// ===== СОХРАНИТЬ МЕСТО =====
document.getElementById('save-marker-btn').addEventListener('click', async () => {
  if (!currentClickLatLng) {
    alert('Сначала кликни по карте!');
    return;
  }

  const title = titleInput.value.trim();
  const desc = descInput.value.trim();
  const category = categoryInput.value;

  if (!title) {
    alert('Введи название места!');
    return;
  }

  const saveBtn = document.getElementById('save-marker-btn');
  saveBtn.disabled = true;
  saveBtn.textContent = '⏳ Сохраняю...';

  try {
    // Загружаем фото в Cloudinary
    let photoUrl = null;
    if (selectedPhotoFile) {
      photoUrl = await uploadPhotoToCloudinary(selectedPhotoFile);
    }

    // Сохраняем в Firestore
    const docRef = await addDoc(collection(db, "places"), {
      lat: currentClickLatLng.lat,
      lng: currentClickLatLng.lng,
      title,
      desc,
      category,
      photoUrl,
      author: currentUser,
      createdAt: new Date().toISOString()
    });

    addMarkerToMap(docRef.id, currentClickLatLng.lat, currentClickLatLng.lng, title, desc, category, photoUrl, currentUser);
    closeModal();

  } catch (e) {
    console.error("Ошибка:", e);
    alert("Ошибка сохранения!");
  } finally {
    saveBtn.disabled = false;
    saveBtn.textContent = '💾 Сохранить';
  }
});

// ===== УДАЛЕНИЕ =====
window.deletePlace = async function(id) {
  if (!confirm('Удалить это место? Все комментарии тоже удалятся.')) return;
  
  try {
    await deleteDoc(doc(db, "places", id));
    
    const commentsQuery = query(collection(db, "comments"), where("placeId", "==", id));
    const commentsSnap = await getDocs(commentsQuery);
    commentsSnap.forEach(async (c) => {
      await deleteDoc(doc(db, "comments", c.id));
    });
    
    map.eachLayer((layer) => {
      if (layer instanceof L.Marker && layer.placeId === id) {
        map.removeLayer(layer);
      }
    });
  } catch (e) {
    console.error("Ошибка удаления:", e);
    alert("Не удалось удалить");
  }
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
    const q = query(
      collection(db, "comments"),
      where("placeId", "==", placeId),
      orderBy("createdAt", "asc")
    );
    const snapshot = await getDocs(q);
    
    if (snapshot.empty) {
      commentsList.innerHTML = '<div class="no-comments">Пока нет комментариев. Будь первым! 💕</div>';
      return;
    }
    
    commentsList.innerHTML = '';
    snapshot.forEach((doc) => {
      const data = doc.data();
      const userData = data.author === 'boy' ? BOY : GIRL;
      const isMe = data.author === currentUser;
      
      const commentEl = document.createElement('div');
      commentEl.className = `comment ${isMe ? 'comment-mine' : 'comment-hers'}`;
      commentEl.innerHTML = `
        <div class="comment-avatar" style="background: ${userData.color}">${userData.emoji}</div>
        <div class="comment-bubble">
          <div class="comment-header">
            <span class="comment-name">${userData.name}</span>
            <span class="comment-time">${formatTime(data.createdAt)}</span>
          </div>
          <div class="comment-text">${escapeHtml(data.text)}</div>
        </div>
      `;
      commentsList.appendChild(commentEl);
    });
    
    commentsList.scrollTop = commentsList.scrollHeight;
    
  } catch (e) {
    console.error("Ошибка загрузки комментариев:", e);
    commentsList.innerHTML = '<div class="error">Ошибка загрузки 💔</div>';
  }
}

document.getElementById('send-comment-btn').addEventListener('click', async () => {
  const text = commentText.value.trim();
  if (!text || !currentPlaceId) return;
  
  try {
    const btn = document.getElementById('send-comment-btn');
    btn.disabled = true;
    btn.textContent = '...';
    
    await addDoc(collection(db, "comments"), {
      placeId: currentPlaceId,
      author: currentUser,
      text: text,
      createdAt: new Date().toISOString()
    });
    
    commentText.value = '';
    await loadComments(currentPlaceId);
    
  } catch (e) {
    console.error("Ошибка отправки:", e);
    alert("Не удалось отправить");
  } finally {
    const btn = document.getElementById('send-comment-btn');
    btn.disabled = false;
    btn.textContent = 'Отправить';
  }
});

commentText.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    document.getElementById('send-comment-btn').click();
  }
});

// ===== УТИЛИТЫ =====
function formatTime(isoString) {
  const date = new Date(isoString);
  const now = new Date();
  const diff = (now - date) / 1000;
  
  if (diff < 60) return 'только что';
  if (diff < 3600) return `${Math.floor(diff / 60)} мин назад`;
  if (diff < 86400) return `${Math.floor(diff / 3600)} ч назад`;
  return `${date.getDate()}.${date.getMonth() + 1}`;
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// ===== ЗАГРУЗКА МЕСТ =====
async function loadPlaces() {
  try {
    const snapshot = await getDocs(collection(db, "places"));
    snapshot.forEach((doc) => {
      const data = doc.data();
      addMarkerToMap(doc.id, data.lat, data.lng, data.title, data.desc, data.category, data.photoUrl, data.author || 'boy');
    });
    console.log(`✅ Загружено ${snapshot.size} мест`);
  } catch (e) {
    console.error("Ошибка загрузки:", e);
  }
}

// ===== ТАЙМЕР =====
const meetingDate = new Date('2026-06-23T06:00:00');
const timerElement = document.getElementById('timer');

function updateTimer() {
  const now = new Date();
  const diff = meetingDate - now;
  
  if (diff <= 0) {
    timerElement.innerText = "Мы вместе! 💖🎉";
    return;
  }
  
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  const hours = Math.floor((diff / (1000 * 60 * 60)) % 24);
  const minutes = Math.floor((diff / (1000 * 60)) % 60);
  
  timerElement.innerText = `${days}д ${hours}ч ${minutes}м`;
}

setInterval(updateTimer, 1000);
updateTimer();

// ===== ВХОД НА КАРТУ =====
document.getElementById('enter-btn').addEventListener('click', () => {
  countdown.classList.add('hidden');
  legend.classList.remove('hidden');
  setTimeout(() => {
    map.invalidateSize();
    loadPlaces();
  }, 600);
});
