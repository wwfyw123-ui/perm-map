// Подключаем Firebase через прямые ссылки (специально для браузера)
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-app.js";
import { getFirestore, collection, addDoc, getDocs } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";

// ТВОЙ КОНФИГ ИЗ FIREBASE
const firebaseConfig = {
  apiKey: "AIzaSyCZH3ZrRWqhr25goGwGjJUHCqCiYoHxqiM",
  authDomain: "perm-map-38735.firebaseapp.com",
  projectId: "perm-map-38735",
  storageBucket: "perm-map-38735.firebasestorage.app",
  messagingSenderId: "938258637332",
  appId: "1:938258637332:web:cf47a541ead77f0d857d01"
};

// Инициализируем Базу Данных
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// Настройки карты (Пермь)
const permCoords = [58.0105, 56.2502];
const map = L.map('map').setView(permCoords, 13);
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19 }).addTo(map);

// Переменная для хранения координат клика
let currentClickLatLng = null;

// Элементы модального окна
const modal = document.getElementById('add-marker-modal');
const titleInput = document.getElementById('place-title');
const descInput = document.getElementById('place-desc');
const categoryInput = document.getElementById('place-category');
const saveBtn = document.getElementById('save-marker-btn');
const closeBtn = document.getElementById('close-modal-btn');

// Клик по карте -> Открываем окно
map.on('click', function(e) {
    currentClickLatLng = e.latlng;
    modal.classList.remove('hidden'); // Показываем окно
});

// Закрыть окно (кнопка Отмена)
closeBtn.addEventListener('click', () => {
    modal.classList.add('hidden');
    titleInput.value = ''; descInput.value = ''; // очищаем поля
});

// ФУНКЦИЯ: Нарисовать маркер на карте (используем эмодзи из категории!)
function addMarkerToMap(lat, lng, title, desc, category) {
    const customIcon = L.divIcon({
        className: 'custom-div-icon',
        html: `<div style="font-size: 28px; text-shadow: 2px 2px 4px rgba(0,0,0,0.5);">${category}</div>`,
        iconSize: [30, 42],
        iconAnchor: [15, 42]
    });

    L.marker([lat, lng], {icon: customIcon}).addTo(map)
        .bindPopup(`<b>${category} ${title}</b><br>${desc}`);
}

// Кнопка "Сохранить" -> Отправляем в Firebase
saveBtn.addEventListener('click', async () => {
    const title = titleInput.value;
    const desc = descInput.value;
    const category = categoryInput.value;

    if (!title) { alert('Братик, введи название!'); return; }

    try {
        // Сохраняем в облако!
        await addDoc(collection(db, "places"), {
            lat: currentClickLatLng.lat,
            lng: currentClickLatLng.lng,
            title: title,
            desc: desc,
            category: category
        });

        // Рисуем на карте сразу
        addMarkerToMap(currentClickLatLng.lat, currentClickLatLng.lng, title, desc, category);
        
        // Закрываем окно и чистим поля
        modal.classList.add('hidden');
        titleInput.value = ''; descInput.value = '';
    } catch (e) {
        console.error("Ошибка добавления документа: ", e);
        alert("Ошибка! Проверь, создал ли ты Firestore Database в Test Mode.");
    }
});

// ФУНКЦИЯ: Загрузить все сохраненные точки из базы при входе
async function loadPlaces() {
    try {
        const querySnapshot = await getDocs(collection(db, "places"));
        querySnapshot.forEach((doc) => {
            const data = doc.data();
            addMarkerToMap(data.lat, data.lng, data.title, data.desc, data.category);
        });
    } catch (e) {
        console.log("Пока нет сохраненных мест или ошибка загрузки: ", e);
    }
}

// --- ЛОГИКА ТАЙМЕРА ---
const meetingDate = new Date('2026-06-23T06:00:00'); 
const timerElement = document.getElementById('timer');
const enterBtn = document.getElementById('enter-btn');
const overlay = document.getElementById('countdown');

function updateTimer() {
    const now = new Date();
    const diff = meetingDate - now;
    if (diff <= 0) { timerElement.innerText = "Мы вместе! 💖"; return; }
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diff / (1000 * 60 * 60)) % 24);
    timerElement.innerText = `${days} дней и ${hours} часов`;
}
setInterval(updateTimer, 1000); updateTimer();

// Кнопка Входа
enterBtn.addEventListener('click', () => {
    overlay.classList.add('hidden');
    setTimeout(() => map.invalidateSize(), 500); 
    // ЗАГРУЖАЕМ ТОЧКИ ИЗ БАЗЫ КОГДА ВОШЛИ НА КАРТУ
    loadPlaces(); 
});
