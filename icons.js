// チェックポイントのアイコン候補（絵文字ベース）。マップ側・設定画面side両方から参照する。
const CHECKPOINT_ICONS = {
    pin: { emoji: '📍', label: '標準ピン' },
    car: { emoji: '🚗', label: '車' },
    'fire-truck': { emoji: '🚒', label: '消防車' },
    train: { emoji: '🚃', label: '電車' },
    bus: { emoji: '🚌', label: 'バス' },
    station: { emoji: '🚉', label: '駅' },
    shrine: { emoji: '⛩️', label: '神社' },
    park: { emoji: '🌳', label: '公園' },
    flag: { emoji: '🚩', label: '旗' },
    star: { emoji: '⭐', label: 'スター' }
};

function createCheckpointIcon(iconKey) {
    const preset = CHECKPOINT_ICONS[iconKey];
    if (!preset) {
        return null; // 標準のLeafletピンを使う
    }
    return L.divIcon({
        className: 'checkpoint-emoji-icon',
        html: `<span>${preset.emoji}</span>`,
        iconSize: [40, 40],
        iconAnchor: [20, 20],
        popupAnchor: [0, -20]
    });
}
