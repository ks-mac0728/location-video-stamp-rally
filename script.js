document.addEventListener('DOMContentLoaded', () => {
    const checkinButton = document.getElementById('checkin-button');
    const videoContainer = document.getElementById('video-container');
    const videoClose = document.getElementById('video-close');
    const video = document.getElementById('fire-truck-video');
    const videoTapToPlay = document.getElementById('video-tap-to-play');
    const message = document.getElementById('message');

    // 地図の初期化（チェックポイント群の中心付近を初期表示に）
    const bounds = L.latLngBounds(CHECKPOINTS.map(cp => [cp.lat, cp.lng]));
    const map = L.map('map').fitBounds(bounds, { maxZoom: 16, padding: [40, 40] });

    // 地図タイルの設定（CARTO Voyager：OpenStreetMapベースのシンプルな配色）
    L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
        subdomains: 'abcd',
        maxZoom: 20
    }).addTo(map);

    // 上下のフローティングUIとマーカーが重ならないよう表示位置を調整
    const popupPanOptions = {
        autoPanPaddingTopLeft: L.point(20, 80),
        autoPanPaddingBottomRight: L.point(20, 160)
    };
    map.whenReady(() => {
        map.panBy([0, -90], { animate: false });
    });

    // チェックポイントごとにマーカー・円・情報ウィンドウを作成
    CHECKPOINTS.forEach(checkpoint => {
        checkpoint.completed = false;

        const popupContent = `
            <img class="checkpoint-popup__photo" src="${checkpoint.photo}" alt="${checkpoint.name}">
            <div class="checkpoint-popup__body">
                <p class="checkpoint-popup__name">${checkpoint.name}</p>
                <p class="checkpoint-popup__address">${checkpoint.address}</p>
                <p class="checkpoint-popup__desc">${checkpoint.description}</p>
            </div>
        `;

        L.marker([checkpoint.lat, checkpoint.lng]).addTo(map)
            .bindPopup(popupContent, popupPanOptions);

        checkpoint.circle = L.circle([checkpoint.lat, checkpoint.lng], {
            color: '#ff6d3f',
            fillColor: '#ff6d3f',
            fillOpacity: 0.2,
            radius: checkpoint.radius * 1000 // m単位に変換
        }).addTo(map);
    });

    let currentUserMarker = null;
    let watchId = null;

    // 現在地を追跡
    function startWatching() {
        if (!navigator.geolocation) {
            message.textContent = 'お使いのブラウザは位置情報取得に対応していません。';
            return;
        }
        watchId = navigator.geolocation.watchPosition(updatePosition, error, {
            enableHighAccuracy: true
        });
    }

    function updatePosition(position) {
        const currentCoords = {
            lat: position.coords.latitude,
            lng: position.coords.longitude
        };

        if (!currentUserMarker) {
            // 最初の位置情報取得でマーカーを作成
            currentUserMarker = L.marker([currentCoords.lat, currentCoords.lng]).addTo(map)
                .bindPopup('現在地', popupPanOptions);
        } else {
            // マーカーの位置を更新
            currentUserMarker.setLatLng([currentCoords.lat, currentCoords.lng]);
        }

        const nearest = findNearestCheckpoint(currentCoords.lat, currentCoords.lng);
        if (nearest.checkpoint.completed) {
            message.textContent = `${nearest.checkpoint.name}はチェックイン済みです。`;
        } else {
            message.textContent = `${nearest.checkpoint.name}まで約${(nearest.distance * 1000).toFixed(0)}m`;
        }
    }

    checkinButton.addEventListener('click', () => {
        message.textContent = '位置情報を確認しています...';
        navigator.geolocation.getCurrentPosition(checkin, error);
    });

    videoClose.addEventListener('click', () => {
        video.pause();
        video.currentTime = 0;
        videoContainer.style.display = 'none';
        videoTapToPlay.style.display = 'none';
    });

    // 実際に再生が始まったときだけボタンを隠す（再生に失敗した場合は表示したままにして再試行できるようにする）
    video.addEventListener('playing', () => {
        videoTapToPlay.style.display = 'none';
    });

    video.addEventListener('error', () => {
        message.textContent = '動画の読み込みに失敗しました。';
    });

    videoTapToPlay.addEventListener('click', playVideo);

    // 位置情報コールバック経由だとモバイルブラウザの自動再生制限で再生がブロックされることがあるため、
    // 失敗時は手動タップで再生できるようにする
    function playVideo() {
        const playPromise = video.play();
        if (playPromise && typeof playPromise.catch === 'function') {
            playPromise.catch(() => {
                videoTapToPlay.style.display = 'block';
            });
        }
    }

    function checkin(position) {
        const currentLatitude = position.coords.latitude;
        const currentLongitude = position.coords.longitude;

        const nearest = findNearestCheckpoint(currentLatitude, currentLongitude);
        const { checkpoint, distance } = nearest;

        if (distance <= checkpoint.radius) {
            if (!checkpoint.completed) {
                checkpoint.completed = true;
                checkpoint.circle.setStyle({ color: '#9e9e9e', fillColor: '#9e9e9e' });
                message.textContent = `${checkpoint.name}でチェックイン成功！動画を再生します。`;
            } else {
                message.textContent = `${checkpoint.name}の動画をもう一度再生します。`;
            }
            // チェックポイントは何度でも近づけば動画を見られる（スタンプ済みの記録は残る）
            video.src = checkpoint.video;
            videoContainer.style.display = 'flex';
            playVideo();
        } else {
            message.textContent = `まだ${checkpoint.name}に到着していません。約${(distance * 1000).toFixed(0)}m離れています。`;
        }
    }

    // 現在地から見るべきチェックポイントを探す。
    // 半径内に入っているチェックポイントがあれば（完了済みでも）それを優先し、
    // なければ最寄りの未チェックインのチェックポイント（すべて完了済みなら最寄りのもの）を返す
    function findNearestCheckpoint(lat, lng) {
        const withDistance = CHECKPOINTS.map(checkpoint => ({
            checkpoint,
            distance: getDistance(lat, lng, checkpoint.lat, checkpoint.lng)
        }));

        const withinRadius = withDistance.filter(item => item.distance <= item.checkpoint.radius);
        if (withinRadius.length > 0) {
            return withinRadius.reduce((nearest, item) => item.distance < nearest.distance ? item : nearest);
        }

        const uncompleted = withDistance.filter(item => !item.checkpoint.completed);
        const candidates = uncompleted.length > 0 ? uncompleted : withDistance;
        return candidates.reduce((nearest, item) => item.distance < nearest.distance ? item : nearest);
    }

    function error(err) {
        console.warn(`ERROR(${err.code}): ${err.message}`);
        message.textContent = '位置情報の取得に失敗しました。';
    }

    // 2点間の距離を計算する関数
    function getDistance(lat1, lon1, lat2, lon2) {
        const R = 6371; // 地球の半径 (km)
        const dLat = (lat2 - lat1) * Math.PI / 180;
        const dLon = (lon2 - lon1) * Math.PI / 180;
        const a =
            Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
            Math.sin(dLon / 2) * Math.sin(dLon / 2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        return R * c; // 距離 (km)
    }

    startWatching(); // ページの読み込みと同時に現在地の追跡を開始
});
