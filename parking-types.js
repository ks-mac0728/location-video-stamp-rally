// 駐車場・駐輪場の状態を表す固定の型。ブラウザ（script.js）とビルドスクリプト（scripts/build.js）の両方から参照する。
// カード上での表記を毎回同じパターンに固定するため、自由記述ではなくこの列挙値で持つ。
// short: カードのチップ用（短い表記）、label: 詳細ページ用（正式な表記）
const PARKING_TYPES = {
    unknown: { short: '不明', label: '不明（未確認）' },
    none: { short: 'なし', label: 'なし' },
    'onsite-free': { short: 'あり（無料）', label: 'あり（無料の専用駐車場）' },
    'onsite-paid': { short: 'あり（有料）', label: 'あり（有料の専用駐車場）' },
    'nearby-free': { short: '近隣（無料）', label: 'あり（無料の近隣駐車場）' },
    'nearby-paid': { short: '近隣（有料）', label: 'あり（有料の近隣駐車場）' }
};

if (typeof module !== 'undefined' && module.exports) {
    module.exports = PARKING_TYPES;
}
