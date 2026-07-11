// script.js
// このファイルにチェックイン機能や動画再生機能を追加していきます。

document.addEventListener('DOMContentLoaded', () => {
    const checkinButton = document.getElementById('checkin-button');
    const videoContainer = document.getElementById('video-container');
    const video = document.getElementById('fire-truck-video');
    const message = document.getElementById('message');

    // 目標の場所（宝塚市消防本部 西消防署 栄町出張所）
    // 緯度: 34.80783, 経度: 135.34446
    const targetLatitude = 34.80783;
    const targetLongitude = 135.34446;
    const checkinRadius = 0.1; // チェックイン可能な半径 (km)

    checkinButton.addEventListener('click', () => {
        message.textContent = '位置情報を取得しています...';
        if (!navigator.geolocation) {
            message.textContent = 'お使いのブラウザは位置情報取得に対応していません。';
            return;
        }

        navigator.geolocation.getCurrentPosition(success, error);
    });

    function success(position) {
        const currentLatitude = position.coords.latitude;
        const currentLongitude = position.coords.longitude;

        const distance = getDistance(currentLatitude, currentLongitude, targetLatitude, targetLongitude);

        if (distance <= checkinRadius) {
            message.textContent = 'チェックイン成功！動画を再生します。';
            checkinButton.style.display = 'none';
            videoContainer.style.display = 'block';
            // TODO: 'path/to/your/video.mp4' を実際の動画ファイルのパスに置き換える
            video.src = 'movie/fire-engine.mp4'; 
            video.play();
        } else {
            message.textContent = `まだ目的地から約${distance.toFixed(2)}km離れています。`;
        }
    }

    function error() {
        message.textContent = '位置情報の取得に失敗しました。';
    }

    // 2点間の距離を計算する関数（ヒュベニの公式）
    function getDistance(lat1, lon1, lat2, lon2) {
        const R = 6371; // 地球の半径 (km)
        const dLat = (lat2 - lat1) * Math.PI / 180;
        const dLon = (lon2 - lon1) * Math.PI / 180;
        const a =
            Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
            Math.sin(dLon / 2) * Math.sin(dLon / 2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        const distance = R * c;
        return distance;
    }
});
