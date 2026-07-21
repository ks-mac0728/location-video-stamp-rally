// スポットのカテゴリ定義。ブラウザ（script.js）とビルドスクリプト（scripts/build.js）の両方から参照する。
const CATEGORIES = {
    pool: { emoji: '🏊', label: 'プール' },
    'children-center': { emoji: '🧸', label: '児童館' },
    library: { emoji: '📚', label: '図書館' },
    'kids-space': { emoji: '🎠', label: 'キッズスペース' },
    'water-play': { emoji: '💦', label: '水遊び場' },
    park: { emoji: '🌳', label: '公園' }
};

if (typeof module !== 'undefined' && module.exports) {
    module.exports = CATEGORIES;
}
