// Подавляем ошибки расширений (чтобы не срали в консоль)
window.addEventListener('error', (e) => {
    if (e.message && (e.message.includes('runtime.lastError') || e.message.includes('message port'))) {
        e.stopImmediatePropagation();
        return false;
    }
});

// Подключаем Firebase
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-app.js";
import { getFirestore, collection, addDoc, getDocs } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";

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

// Карта Пермь
const permCoords = [58.0105, 56.2502];
const map = L.map('map').setView(permCoords, 13);
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: '&copy; OpenStreetMap'
}).addTo(map);

let currentClickLatLng = null;

// DOM элементы
const modal = document.getElementById('add-marker-modal');
const titleInput = document.getElementById('place-title');
const descInput = document.getElementById('place-desc');
const categoryInput = document.getElementById('place-category');
const saveBtn = document.getElementById('save-marker-btn');
const closeBtn = document.getElementById('close-modal-btn');

// Клик по карте -> открываем модалку
map.on('click', function(e) {
    currentClickLatLng = e.latlng;
    modal.classList.remove('hidden');
});

// Закрыть модалку
function closeModal() {
    modal.classList.add('hidden');
    titleInput.value = '';
    descInput.value = '';
    currentClickLatLng = null;
}

closeBtn.addEventListener('click', closeModal);

// Закрытие по клику вне окна
modal.addEventListener('click', (e) => {
    if (e.target === modal) closeModal();
});

// Эмодзи-иконки для маркеров
function addMarkerToMap(lat, lng, title, desc, category) {
    const customIcon = L.divIcon({
        className: 'custom-div-icon',
        html: `<div style="font-size: 28px; text-shadow: 2px 2px 4px rgba(0,0,0,0.5);">${category}</div>`,
        iconSize: [30, 42],
        iconAnchor: [15, 42]
    });

    const marker = L.marker([lat, lng], { icon: customIcon }).addTo(map);
    marker.bindPopup(`<<b>${category} ${title}</b><br>${desc}`);
    return marker;
}

// Сохранить в Firebase
saveBtn.addEventListener('click', async () => {
    if (!currentClickLatLng) {
        alert('Сначала кликни по карте, куда ставить метку!');
        return;
    }

    const title = titleInput.value.trim();
    const desc = descInput.value.trim();
    const category = categoryInput.value;

    if (!title) {
        alert('Братик, введи название!');
        return;
    }

    try {
        await addDoc(collection(db, "places"), {
            lat: currentClickLatLng.lat,
            lng: currentClickLatLng.lng,
            title: title,
            desc: desc,
            category: category,
            createdAt: new Date().toISOString()
        });

        addMarkerToMap(currentClickLatLng.lat, currentClickLatLng.lng, title, desc, category);
        closeModal();
    } catch (e) {
        console.error("Ошибка добавления:", e);
        alert("Ошибка! Проверь Firestore Database в Test Mode.");
    }
});

// Загрузить все точки
async function loadPlaces() {
    try {
        const querySnapshot = await getDocs(collection(db, "places"));
        querySnapshot.forEach((doc) => {
            const data = doc.data();
            addMarkerToMap(data.lat, data.lng, data.title, data.desc, data.category);
        });
        console.log(`Загружено ${querySnapshot.size} мест`);
    } catch (e) {
        console.error("Ошибка загрузки:", e);
    }
}

// --- ТАЙМЕР ---
const meetingDate = new Date('2026-06-23T06:00:00');
const timerElement = document.getElementById('timer');
const enterBtn = document.getElementById('enter-btn');
const overlay = document.getElementById('countdown');

function updateTimer() {
    const now = new Date();
    const diff = meetingDate - now;
    
    if (diff <= 0) {
        timerElement.innerText = "Мы вместе! 💖";
        return;
    }
    
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diff / (1000 * 60 * 60)) % 24);
    const minutes = Math.floor((diff / (1000 * 60)) % 60);
    
    timerElement.innerText = `${days} дней, ${hours} часов и ${minutes} минут`;
}

setInterval(updateTimer, 1000);
updateTimer();

// Кнопка входа — исправлен порядок!
enterBtn.addEventListener('click', () => {
    overlay.classList.add('hidden');
    setTimeout(() => {
        map.invalidateSize();
        loadPlaces(); // Загружаем ПОСЛЕ ресайза карты
    }, 600);
});
