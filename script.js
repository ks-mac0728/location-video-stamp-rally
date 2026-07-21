document.addEventListener('DOMContentLoaded', async () => {
    const weatherBanner = document.getElementById('weather-banner');
    const categorySelect = document.getElementById('category-select');
    const filterChips = Array.from(document.querySelectorAll('.filter-chip'));
    const spotListEl = document.getElementById('spot-list');

    // 宝塚市の緯度経度
    const TAKARAZUKA_LAT = 34.7994;
    const TAKARAZUKA_LNG = 135.3603;
    const HOT_THRESHOLD_C = 33;
    const RAIN_PROBABILITY_THRESHOLD = 50;

    const response = await fetch('spots.json', { cache: 'no-store' });
    const spots = await response.json();

    // 地図の初期化
    const bounds = L.latLngBounds(spots.map(s => [s.lat, s.lng]));
    const map = L.map('map').fitBounds(bounds, { maxZoom: 15, padding: [30, 30] });
    L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
        subdomains: 'abcd',
        maxZoom: 20
    }).addTo(map);

    const markersById = {};
    spots.forEach(spot => {
        const cat = CATEGORIES[spot.category];
        const icon = L.divIcon({
            className: 'category-emoji-icon-wrapper',
            html: `<span class="category-emoji-icon">${cat ? cat.emoji : '📍'}</span>`,
            iconSize: [36, 36],
            iconAnchor: [18, 18],
            popupAnchor: [0, -18]
        });
        const popupContent = `
            ${spot.photo_url ? `<img class="popup-photo" src="${spot.photo_url}" alt="${spot.name}">` : ''}
            <div class="popup-body">
                <p class="popup-name">${spot.name}</p>
                <p class="popup-address">${spot.address}</p>
            </div>
        `;
        const marker = L.marker([spot.lat, spot.lng], { icon }).addTo(map).bindPopup(popupContent);
        markersById[spot.id] = marker;
    });

    // フィルター状態
    const activeFilters = new Set();

    function applyFilters() {
        const category = categorySelect.value;
        Array.from(spotListEl.children).forEach(card => {
            const matchesCategory = !category || card.dataset.category === category;
            const matchesWeatherTags = activeFilters.size === 0 ||
                Array.from(activeFilters).some(tag => card.dataset[tag] === 'true');
            const visible = matchesCategory && matchesWeatherTags;
            card.classList.toggle('is-hidden', !visible);

            const marker = markersById[card.dataset.id];
            if (marker) {
                if (visible) {
                    if (!map.hasLayer(marker)) marker.addTo(map);
                } else if (map.hasLayer(marker)) {
                    map.removeLayer(marker);
                }
            }
        });
    }

    filterChips.forEach(chip => {
        chip.addEventListener('click', () => {
            const tag = chip.dataset.filter;
            if (activeFilters.has(tag)) {
                activeFilters.delete(tag);
                chip.classList.remove('active');
            } else {
                activeFilters.add(tag);
                chip.classList.add('active');
            }
            applyFilters();
        });
    });

    categorySelect.addEventListener('change', applyFilters);

    // 天気バナー（Open-Meteo: APIキー不要）
    try {
        const weatherRes = await fetch(
            `https://api.open-meteo.com/v1/forecast?latitude=${TAKARAZUKA_LAT}&longitude=${TAKARAZUKA_LNG}&daily=temperature_2m_max,precipitation_probability_max&timezone=Asia%2FTokyo`
        );
        const weatherData = await weatherRes.json();
        const maxTemp = weatherData.daily.temperature_2m_max[0];
        const rainProb = weatherData.daily.precipitation_probability_max[0];

        const isHot = maxTemp >= HOT_THRESHOLD_C;
        const isRainy = rainProb >= RAIN_PROBABILITY_THRESHOLD;

        let message = `本日の宝塚: ${maxTemp}℃・降水確率${rainProb}%`;
        const suggestedTags = [];

        if (isRainy) {
            message += ' → 雨の日なので屋内スポットがおすすめです';
            suggestedTags.push('indoor');
        } else if (isHot) {
            message += ' → 暑い日なので屋内・日陰・水遊びスポットがおすすめです';
            suggestedTags.push('indoor', 'shade', 'water');
        } else {
            message += ' → おでかけ日和です';
        }

        weatherBanner.textContent = (isHot ? '☀️ ' : isRainy ? '☔ ' : '🙂 ') + message;

        suggestedTags.forEach(tag => {
            activeFilters.add(tag);
            const chip = filterChips.find(c => c.dataset.filter === tag);
            if (chip) chip.classList.add('active');
        });
        applyFilters();
    } catch (err) {
        console.warn('天気情報の取得に失敗しました', err);
        weatherBanner.textContent = '天気情報を取得できませんでした。';
    }
});
