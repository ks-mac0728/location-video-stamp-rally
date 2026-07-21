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

    const [spotsRes, eventsRes] = await Promise.all([
        fetch('spots.json', { cache: 'no-store' }),
        fetch('events.json', { cache: 'no-store' })
    ]);
    const spots = await spotsRes.json();
    const activeEvents = await eventsRes.json();

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
                ${spot.activeCampaign ? `<span class="popup-campaign">🎉 ${spot.activeCampaign.name}</span>` : ''}
                <p class="popup-name">${spot.name}</p>
                <p class="popup-address">${spot.address}</p>
            </div>
        `;
        const marker = L.marker([spot.lat, spot.lng], { icon }).addTo(map).bindPopup(popupContent);
        markersById[spot.id] = marker;
    });

    // 期間中の独立イベントを地図に表示（緯度経度があるもののみ）
    activeEvents.filter(event => event.lat && event.lng).forEach(event => {
        const icon = L.divIcon({
            className: 'category-emoji-icon-wrapper',
            html: `<span class="category-emoji-icon">🎉</span>`,
            iconSize: [36, 36],
            iconAnchor: [18, 18],
            popupAnchor: [0, -18]
        });
        const popupContent = `
            ${event.photo_url ? `<img class="popup-photo" src="${event.photo_url}" alt="${event.name}">` : ''}
            <div class="popup-body">
                <p class="popup-name">${event.name}</p>
                <p class="popup-address">${event.start_date} 〜 ${event.end_date}</p>
            </div>
        `;
        L.marker([event.lat, event.lng], { icon }).addTo(map).bindPopup(popupContent);
    });

    // 天気の判定結果・現在地は「現在地から探す」「おまかせ」の両方から使うので、
    // スコープの上位で共有する
    let weatherSuggestedTags = [];
    let userLocation = null;

    function getDistanceKm(lat1, lon1, lat2, lon2) {
        const R = 6371;
        const dLat = (lat2 - lat1) * Math.PI / 180;
        const dLon = (lon2 - lon1) * Math.PI / 180;
        const a =
            Math.sin(dLat / 2) ** 2 +
            Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon / 2) ** 2;
        return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    }

    // 地域検索（駅名・住所を入力すると地図が移動する。GSIの住所検索API、APIキー不要）
    const areaSearchInput = document.getElementById('area-search-input');
    const areaSearchButton = document.getElementById('area-search-button');
    const areaSearchStatus = document.getElementById('area-search-status');

    async function searchArea() {
        const query = areaSearchInput.value.trim();
        if (!query) return;
        areaSearchStatus.textContent = '検索しています…';
        try {
            const res = await fetch(`https://msearch.gsi.go.jp/address-search/AddressSearch?q=${encodeURIComponent(query)}`);
            const results = await res.json();
            if (!results.length) {
                areaSearchStatus.textContent = `「${query}」が見つかりませんでした。`;
                return;
            }
            // クエリと完全に一致する地名・駅名があればそれを優先する
            const exact = results.find(r => r.properties.title === query);
            const best = exact || results[0];
            const [lng, lat] = best.geometry.coordinates;
            map.setView([lat, lng], 15);
            areaSearchStatus.textContent = `「${best.properties.title}」に移動しました。`;
        } catch (err) {
            console.warn('地域検索に失敗しました', err);
            areaSearchStatus.textContent = '検索に失敗しました。';
        }
    }

    areaSearchButton.addEventListener('click', searchArea);
    areaSearchInput.addEventListener('keydown', e => {
        if (e.key === 'Enter') searchArea();
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

    // 現在地から探す（距離順に並び替え）
    const nearbyButton = document.getElementById('nearby-button');
    const nearbyStatus = document.getElementById('nearby-status');
    let currentLocationMarker = null;

    nearbyButton.addEventListener('click', () => {
        if (!navigator.geolocation) {
            nearbyStatus.textContent = 'お使いのブラウザは位置情報取得に対応していません。';
            return;
        }
        nearbyStatus.textContent = '現在地を取得しています…';
        navigator.geolocation.getCurrentPosition(
            position => {
                const userLat = position.coords.latitude;
                const userLng = position.coords.longitude;
                userLocation = { lat: userLat, lng: userLng };

                if (currentLocationMarker) {
                    currentLocationMarker.setLatLng([userLat, userLng]);
                } else {
                    currentLocationMarker = L.circleMarker([userLat, userLng], {
                        radius: 8,
                        color: '#1a73e8',
                        fillColor: '#1a73e8',
                        fillOpacity: 0.9
                    }).addTo(map).bindPopup('現在地');
                }
                map.setView([userLat, userLng], 14);
                nearbyButton.classList.add('active');
                nearbyStatus.textContent = '現在地から近い順に並び替えました。';

                const cards = Array.from(spotListEl.children);
                cards.forEach(card => {
                    const spot = spots.find(s => s.id === card.dataset.id);
                    if (!spot) return;
                    const distanceKm = getDistanceKm(userLat, userLng, spot.lat, spot.lng);
                    card.dataset.distanceKm = distanceKm;
                    const distanceEl = card.querySelector('.spot-card__distance');
                    distanceEl.textContent = `現在地から約${distanceKm < 1 ? Math.round(distanceKm * 1000) + 'm' : distanceKm.toFixed(1) + 'km'}`;
                    distanceEl.style.display = '';
                });

                cards
                    .sort((a, b) => parseFloat(a.dataset.distanceKm) - parseFloat(b.dataset.distanceKm))
                    .forEach(card => spotListEl.appendChild(card));
            },
            () => {
                nearbyStatus.textContent = '位置情報を取得できませんでした。';
            }
        );
    });

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

        weatherSuggestedTags = suggestedTags;
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

    // おまかせ機能: 天気条件と現在地（分かれば）から1件だけ提案する
    const omakaseButton = document.getElementById('omakase-button');
    const omakaseResult = document.getElementById('omakase-result');
    let lastOmakaseSpotId = null;

    function pickOmakaseSpot() {
        const candidates = weatherSuggestedTags.length === 0
            ? spots
            : spots.filter(s => weatherSuggestedTags.some(tag => s[tag]));
        const pool = candidates.length > 0 ? candidates : spots;

        let chosen;
        if (userLocation) {
            const withDistance = pool
                .map(s => ({ spot: s, distanceKm: getDistanceKm(userLocation.lat, userLocation.lng, s.lat, s.lng) }))
                .sort((a, b) => a.distanceKm - b.distanceKm);
            const nearest = withDistance.slice(0, Math.min(3, withDistance.length));
            const retry = nearest.filter(item => item.spot.id !== lastOmakaseSpotId);
            const picked = (retry.length > 0 ? retry : nearest)[Math.floor(Math.random() * (retry.length > 0 ? retry.length : nearest.length))];
            chosen = { spot: picked.spot, distanceKm: picked.distanceKm };
        } else {
            const retryPool = pool.filter(s => s.id !== lastOmakaseSpotId);
            const finalPool = retryPool.length > 0 ? retryPool : pool;
            chosen = { spot: finalPool[Math.floor(Math.random() * finalPool.length)], distanceKm: null };
        }
        return chosen;
    }

    function renderOmakaseResult() {
        const { spot, distanceKm } = pickOmakaseSpot();
        lastOmakaseSpotId = spot.id;
        const cat = CATEGORIES[spot.category];

        omakaseResult.innerHTML = `
            <a class="spot-card" href="spots/${spot.id}/">
                ${spot.photo_url ? `<img class="spot-card__photo" src="${spot.photo_url}" alt="${spot.name}">` : '<div class="spot-card__photo spot-card__photo--placeholder"></div>'}
                <div class="spot-card__body">
                    <span class="spot-card__category">${cat ? cat.emoji + ' ' + cat.label : ''}</span>
                    ${spot.activeCampaign ? `<span class="spot-card__campaign">🎉 ${spot.activeCampaign.name}</span>` : ''}
                    <h3 class="spot-card__name">${spot.name}</h3>
                    <p class="spot-card__address">${spot.address}${distanceKm !== null ? `（現在地から約${distanceKm < 1 ? Math.round(distanceKm * 1000) + 'm' : distanceKm.toFixed(1) + 'km'}）` : ''}</p>
                    <p class="spot-card__desc">${spot.description}</p>
                </div>
            </a>
            <button type="button" class="omakase-result__reroll" id="omakase-reroll">🔄 もう一度選び直す</button>
        `;
        omakaseResult.style.display = '';
        document.getElementById('omakase-reroll').addEventListener('click', renderOmakaseResult);
    }

    omakaseButton.addEventListener('click', renderOmakaseResult);
});
