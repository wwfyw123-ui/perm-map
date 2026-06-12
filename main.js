// Координаты Перми
const permCoords = [58.0105, 56.2502];

// Инициализируем карту
const map = L.map('map').setView(permCoords, 13);

// Загружаем саму карту (тайлы) от OpenStreetMap
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: '© OpenStreetMap'
}).addTo(map);

// Ставим маркер-приветствие
L.marker(permCoords).addTo(map)
    .bindPopup('<b>Привет!</b><br>Скоро мы будем здесь. 💖')
    .openPopup();

// Отслеживаем клики по карте (пригодится на следующем этапе)
map.on('click', function(e) {
    console.log(`Клик на: Широта ${e.latlng.lat}, Долгота ${e.latlng.lng}`);
});

// --- ЛОГИКА ТАЙМЕРА ---
// ВАЖНО: Замени дату на реальную дату вашего свидания! (Год-Месяц-День T Часы:Минуты)
const meetingDate = new Date('2024-12-31T12:00:00'); 
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
    timerElement.innerText = `${days} дней и ${hours} часов`;
}

setInterval(updateTimer, 1000);
updateTimer();

// Кнопка входа на карту
enterBtn.addEventListener('click', () => {
    overlay.classList.add('hidden');
    // Обновляем карту после скрытия таймера, чтобы избежать багов с отображением
    setTimeout(() => map.invalidateSize(), 500); 
});
