// スプレッドシート（CSV）からサイトを静的生成するビルドスクリプト。
// ローカルの data/spots.csv, data/events.csv を既定の情報源とし、
// data/source-config.json があれば、そこに書かれた公開CSV URLを優先して使う。
const fs = require('fs');
const path = require('path');
const { parse } = require('csv-parse/sync');
const {
    SITE_URL,
    renderIndexPage,
    renderSpotPage,
    renderEventPage
} = require('./templates.js');

const ROOT = path.join(__dirname, '..');
const DATA_DIR = path.join(ROOT, 'data');
const SOURCE_CONFIG_PATH = path.join(DATA_DIR, 'source-config.json');

function loadSourceConfig() {
    if (fs.existsSync(SOURCE_CONFIG_PATH)) {
        return JSON.parse(fs.readFileSync(SOURCE_CONFIG_PATH, 'utf-8'));
    }
    return {};
}

async function fetchText(url) {
    const res = await fetch(url);
    if (!res.ok) {
        throw new Error(`Failed to fetch ${url}: ${res.status}`);
    }
    return res.text();
}

async function loadCsv(kind, config) {
    const localPath = path.join(DATA_DIR, `${kind}.csv`);
    const url = config[`${kind}CsvUrl`];
    const text = url ? await fetchText(url) : fs.readFileSync(localPath, 'utf-8');
    return parse(text, { columns: true, skip_empty_lines: true, trim: true });
}

function toBool(value) {
    return String(value).trim().toLowerCase() === 'yes' || String(value).trim() === 'true';
}

function normalizeSpot(row) {
    return {
        id: row.id,
        name: row.name,
        address: row.address,
        lat: parseFloat(row.lat),
        lng: parseFloat(row.lng),
        category: row.category,
        indoor: toBool(row.indoor),
        shade: toBool(row.shade),
        water: toBool(row.water),
        photo_url: row.photo_url || '',
        description: row.description || '',
        fee: row.fee || '',
        parking: row.parking || '',
        hours: row.hours || '',
        official_url: row.official_url || '',
        amenities: (row.amenities || '').split('|').map(s => s.trim()).filter(Boolean),
        last_verified: row.last_verified || '',
        added_date: row.added_date || ''
    };
}

function normalizeEvent(row) {
    return {
        id: row.id,
        name: row.name,
        related_spot_id: row.related_spot_id || '',
        start_date: row.start_date || '',
        end_date: row.end_date || '',
        description: row.description || '',
        photo_url: row.photo_url || '',
        link: row.link || '',
        added_date: row.added_date || ''
    };
}

function writeFile(relPath, content) {
    const fullPath = path.join(ROOT, relPath);
    fs.mkdirSync(path.dirname(fullPath), { recursive: true });
    fs.writeFileSync(fullPath, content);
}

function buildSitemap(spots, events) {
    const urls = [
        `${SITE_URL}/`,
        ...spots.map(s => `${SITE_URL}/spots/${s.id}/`),
        ...events.map(e => `${SITE_URL}/events/${e.id}/`)
    ];
    const body = urls.map(u => `  <url><loc>${u}</loc></url>`).join('\n');
    return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${body}\n</urlset>\n`;
}

async function main() {
    const config = loadSourceConfig();
    const spotRows = await loadCsv('spots', config);
    const eventRows = await loadCsv('events', config);

    const spots = spotRows.map(normalizeSpot).filter(s => s.id);
    const events = eventRows.map(normalizeEvent).filter(e => e.id);

    // 新着（スポット・イベントを追加日順で混ぜて上位5件）
    const newArrivals = [
        ...spots.map(s => ({ ...s, type: 'spot' })),
        ...events.map(e => ({ ...e, type: 'event' }))
    ]
        .filter(item => item.added_date)
        .sort((a, b) => (a.added_date < b.added_date ? 1 : -1))
        .slice(0, 5);

    // トップページ
    writeFile('index.html', renderIndexPage({ spots, events, newArrivals }));

    // スポット個別ページ
    spots.forEach(spot => {
        writeFile(`spots/${spot.id}/index.html`, renderSpotPage(spot));
    });

    // イベント個別ページ
    events.forEach(event => {
        writeFile(`events/${event.id}/index.html`, renderEventPage(event));
    });

    // クライアント側（地図・フィルター）用データ
    writeFile('spots.json', JSON.stringify(spots, null, 2));
    writeFile('events.json', JSON.stringify(events, null, 2));

    // SEO関連
    writeFile('sitemap.xml', buildSitemap(spots, events));
    writeFile('robots.txt', `User-agent: *\nAllow: /\nSitemap: ${SITE_URL}/sitemap.xml\n`);

    console.log(`ビルド完了: スポット${spots.length}件、イベント${events.length}件`);
}

main().catch(err => {
    console.error(err);
    process.exit(1);
});
