// 設備タグの定義。ブラウザ（script.js）とビルドスクリプト（scripts/build.js）の両方から参照する。
const AMENITIES = {
    toilet: 'トイレ',
    diaper: 'オムツ替え台',
    nursing: '授乳室',
    'hot-water': 'ミルク用のお湯',
    vending: '自販機',
    'drinking-water': '水飲み場',
    'bike-parking': '駐輪場',
    'nearby-convenience': '徒歩圏にコンビニ・ドラッグストア'
};

if (typeof module !== 'undefined' && module.exports) {
    module.exports = AMENITIES;
}
