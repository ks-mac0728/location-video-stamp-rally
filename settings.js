document.addEventListener('DOMContentLoaded', async () => {
    const listEl = document.getElementById('checkpoint-list');
    const addButton = document.getElementById('add-checkpoint');
    const saveButton = document.getElementById('save-checkpoints');
    const messageEl = document.getElementById('settings-message');

    const pickerOverlay = document.getElementById('map-picker-overlay');
    const pickerCancel = document.getElementById('map-picker-cancel');
    const pickerConfirm = document.getElementById('map-picker-confirm');
    let pickerMap = null;
    let pickerMarker = null;
    let pickerTargetCard = null;

    const response = await fetch('checkpoints.json', { cache: 'no-store' });
    const checkpoints = await response.json();

    function iconOptionsHtml(selected) {
        return Object.keys(CHECKPOINT_ICONS).map(key => {
            const preset = CHECKPOINT_ICONS[key];
            const isSelected = key === selected ? 'selected' : '';
            return `<option value="${key}" ${isSelected}>${preset.emoji} ${preset.label}</option>`;
        }).join('');
    }

    function renderCard(checkpoint, index) {
        const card = document.createElement('div');
        card.className = 'checkpoint-card';
        card.dataset.index = String(index);
        card.innerHTML = `
            <div class="checkpoint-card__row">
                <label>名称</label>
                <input type="text" class="field-name" value="${escapeAttr(checkpoint.name || '')}">
            </div>
            <div class="checkpoint-card__row">
                <label>住所</label>
                <input type="text" class="field-address" value="${escapeAttr(checkpoint.address || '')}">
            </div>
            <div class="checkpoint-card__row checkpoint-card__latlng">
                <div>
                    <label>緯度</label>
                    <input type="number" step="any" class="field-lat" value="${checkpoint.lat ?? ''}">
                </div>
                <div>
                    <label>経度</label>
                    <input type="number" step="any" class="field-lng" value="${checkpoint.lng ?? ''}">
                </div>
                <button type="button" class="settings-button settings-button--secondary field-pick-map" style="width:auto; white-space:nowrap; margin-top:0;">地図で選択</button>
            </div>
            <div class="checkpoint-card__row">
                <label>チェックイン半径（km）</label>
                <input type="number" step="any" class="field-radius" value="${checkpoint.radius ?? 0.1}">
            </div>
            <div class="checkpoint-card__row">
                <label>アイコン</label>
                <select class="field-icon">${iconOptionsHtml(checkpoint.icon)}</select>
            </div>
            <div class="checkpoint-card__row">
                <label>写真</label>
                <input type="file" accept="image/*" class="field-photo-file">
                <div class="checkpoint-card__media-preview">
                    <img class="field-photo-preview" src="${checkpoint.photo || ''}" onerror="this.style.display='none'">
                    <span class="field-photo-path">${escapeAttr(checkpoint.photo || '未設定')}</span>
                </div>
            </div>
            <div class="checkpoint-card__row">
                <label>動画</label>
                <input type="file" accept="video/*" class="field-video-file">
                <div class="checkpoint-card__media-preview">
                    <span class="field-video-path">${escapeAttr(checkpoint.video || '未設定')}</span>
                </div>
            </div>
            <div class="checkpoint-card__row">
                <label>説明</label>
                <textarea class="field-description">${escapeHtml(checkpoint.description || '')}</textarea>
            </div>
            <button type="button" class="checkpoint-card__delete">このチェックポイントを削除</button>
        `;

        card._data = Object.assign({}, checkpoint);

        card.querySelector('.checkpoint-card__delete').addEventListener('click', () => {
            card.remove();
        });

        card.querySelector('.field-pick-map').addEventListener('click', () => {
            openMapPicker(card);
        });

        card.querySelector('.field-photo-file').addEventListener('change', async (e) => {
            const file = e.target.files[0];
            if (!file) return;
            const path = await uploadFile(file, 'photo');
            if (path) {
                card._data.photo = path;
                card.querySelector('.field-photo-preview').src = path;
                card.querySelector('.field-photo-preview').style.display = '';
                card.querySelector('.field-photo-path').textContent = path;
            }
        });

        card.querySelector('.field-video-file').addEventListener('change', async (e) => {
            const file = e.target.files[0];
            if (!file) return;
            const path = await uploadFile(file, 'video');
            if (path) {
                card._data.video = path;
                card.querySelector('.field-video-path').textContent = path;
            }
        });

        return card;
    }

    async function uploadFile(file, kind) {
        messageEl.textContent = `${file.name} をアップロード中…`;
        const formData = new FormData();
        formData.append('file', file);
        try {
            const res = await fetch(`/api/upload?kind=${kind}`, { method: 'POST', body: formData });
            const data = await res.json();
            if (!data.ok) throw new Error(data.error || 'アップロードに失敗しました');
            messageEl.textContent = `${file.name} をアップロードしました`;
            return data.path;
        } catch (err) {
            messageEl.textContent = `アップロード失敗: ${err.message}`;
            return null;
        }
    }

    function openMapPicker(card) {
        pickerTargetCard = card;
        pickerOverlay.style.display = 'flex';

        const currentLat = parseFloat(card.querySelector('.field-lat').value) || 34.8;
        const currentLng = parseFloat(card.querySelector('.field-lng').value) || 135.35;

        if (!pickerMap) {
            pickerMap = L.map('map-picker').setView([currentLat, currentLng], 16);
            L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
                subdomains: 'abcd',
                maxZoom: 20
            }).addTo(pickerMap);
            pickerMarker = L.marker([currentLat, currentLng]).addTo(pickerMap);
            pickerMap.on('click', (e) => {
                pickerMarker.setLatLng(e.latlng);
            });
        } else {
            pickerMap.setView([currentLat, currentLng], 16);
            pickerMarker.setLatLng([currentLat, currentLng]);
            setTimeout(() => pickerMap.invalidateSize(), 0);
        }
    }

    pickerCancel.addEventListener('click', () => {
        pickerOverlay.style.display = 'none';
        pickerTargetCard = null;
    });

    pickerConfirm.addEventListener('click', () => {
        if (pickerTargetCard && pickerMarker) {
            const latlng = pickerMarker.getLatLng();
            pickerTargetCard.querySelector('.field-lat').value = latlng.lat.toFixed(6);
            pickerTargetCard.querySelector('.field-lng').value = latlng.lng.toFixed(6);
        }
        pickerOverlay.style.display = 'none';
        pickerTargetCard = null;
    });

    function renderAll() {
        listEl.innerHTML = '';
        checkpoints.forEach((checkpoint, index) => {
            listEl.appendChild(renderCard(checkpoint, index));
        });
    }

    addButton.addEventListener('click', () => {
        const newCheckpoint = {
            id: `checkpoint-${Date.now()}`,
            name: '',
            address: '',
            lat: 34.8,
            lng: 135.35,
            radius: 0.1,
            icon: 'pin',
            photo: '',
            video: '',
            description: ''
        };
        listEl.appendChild(renderCard(newCheckpoint, listEl.children.length));
    });

    saveButton.addEventListener('click', async () => {
        const cards = Array.from(listEl.querySelectorAll('.checkpoint-card'));
        const updated = cards.map(card => {
            const data = card._data;
            return {
                id: data.id,
                name: card.querySelector('.field-name').value,
                address: card.querySelector('.field-address').value,
                lat: parseFloat(card.querySelector('.field-lat').value),
                lng: parseFloat(card.querySelector('.field-lng').value),
                radius: parseFloat(card.querySelector('.field-radius').value),
                icon: card.querySelector('.field-icon').value,
                photo: data.photo || '',
                video: data.video || '',
                description: card.querySelector('.field-description').value
            };
        });

        messageEl.textContent = '保存しています…';
        try {
            const res = await fetch('/api/checkpoints', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(updated)
            });
            const data = await res.json();
            if (!data.ok) throw new Error(data.error || '保存に失敗しました');
            messageEl.textContent = '保存しました！トップ画面に戻ると反映されています。';
        } catch (err) {
            messageEl.textContent = `保存失敗: ${err.message}`;
        }
    });

    function escapeHtml(str) {
        return String(str)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;');
    }

    function escapeAttr(str) {
        return escapeHtml(str).replace(/"/g, '&quot;');
    }

    renderAll();
});
