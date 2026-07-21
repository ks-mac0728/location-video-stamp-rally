// 設備タグの定義。ブラウザ（script.js）とビルドスクリプト（scripts/build.js）の両方から参照する。
const AMENITIES = {
    toilet: { emoji: '🚻', label: 'トイレ' },
    diaper: { emoji: '🚼', label: 'オムツ替え台' },
    nursing: { emoji: '🤱', label: '授乳室' },
    'hot-water': { emoji: '🍼', label: 'ミルク用のお湯' },
    vending: { emoji: '🥤', label: '自販機' },
    'drinking-water': { emoji: '🚰', label: '水飲み場' },
    'nearby-convenience': { emoji: '🏪', label: '徒歩圏にコンビニ・ドラッグストア' }
};

if (typeof module !== 'undefined' && module.exports) {
    module.exports = AMENITIES;
}
