// スプレッドシート（CSV）からサイトを静的生成するビルドスクリプト。
// ローカルの data/spots.csv, data/events.csv を既定の情報源とし、
// data/source-config.json があれば、そこに書かれた公開CSV URLを優先して使う。
const fs = require('fs');
const path = require('path');
const { parse } = require('csv-parse/sync');
const matter = require('gray-matter');
const { marked } = require('marked');
const {
    SITE_URL,
    renderIndexPage,
    renderSpotPage,
    renderEventPage,
    renderArticlePage
} = require('./templates.js');

const ROOT = path.join(__dirname, '..');
const DATA_DIR = path.join(ROOT, 'data');
const ARTICLES_DIR = path.join(ROOT, 'content', 'articles');
const SOURCE_CONFIG_PATH = path.join(DATA_DIR, 'source-config.json');

// content/articles/*.md を読み込み、フロントマター＋本文HTMLに変換する
function loadArticles() {
    if (!fs.existsSync(ARTICLES_DIR)) return [];
    return fs.readdirSync(ARTICLES_DIR)
        .filter(f => f.endsWith('.md'))
        .map(f => {
            const slug = f.replace(/\.md$/, '');
            const raw = fs.readFileSync(path.join(ARTICLES_DIR, f), 'utf-8');
            const { data, content } = matter(raw);
            // フロントマターの日付はYAMLの仕様上Dateオブジェクトに自動変換されることがあるため、
            // 文字列でなければYYYY-MM-DD形式に変換し直す
            const publishedDate = data.published_date instanceof Date
                ? data.published_date.toISOString().slice(0, 10)
                : (data.published_date || '');
            return {
                slug,
                title: data.title || slug,
                description: data.description || '',
                related_spots: data.related_spots || [],
                published_date: publishedDate,
                html: marked.parse(content)
            };
        })
        .sort((a, b) => (a.published_date < b.published_date ? 1 : -1));
}

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
        gallery: (row.gallery || '').split('|').map(s => s.trim()).filter(Boolean),
        description: row.description || '',
        fee: row.fee || '',
        parking: row.parking || '',
        hours: row.hours || '',
        official_url: row.official_url || '',
        amenities: (row.amenities || '').split('|').map(s => s.trim()).filter(Boolean),
        target_age: row.target_age || '',
        duration: row.duration || '',
        recommended_time: row.recommended_time || '',
        last_verified: row.last_verified || '',
        added_date: row.added_date || ''
    };
}

function normalizeReview(row) {
    return {
        id: row.id,
        spot_id: row.spot_id,
        reviewer_name: row.reviewer_name || '',
        comment: row.comment || '',
        rating: row.rating || '',
        submitted_date: row.submitted_date || ''
    };
}

// ANTHROPIC_API_KEYが設定されている場合のみ、スポットページ全体（基本情報＋口コミ）から
// AI要約を生成する。口コミ単体の要約ではなく、ページ全体の概要をまとめるもの。
// 未設定の場合は何もせず、既存のai_summaryをそのまま使う（優雅にスキップ）。
async function summarizeSpotPage(spot) {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
        return spot.ai_summary || '';
    }

    const facts = [
        `名称: ${spot.name}`,
        `カテゴリ: ${spot.category}`,
        `説明: ${spot.description}`,
        spot.fee && `料金: ${spot.fee}`,
        spot.parking && `駐車場: ${spot.parking}`,
        spot.hours && `営業時間・定休日: ${spot.hours}`,
        spot.amenities.length && `設備: ${spot.amenities.join('・')}`,
        spot.target_age && `対象年齢: ${spot.target_age}`,
        spot.duration && `所要時間の目安: ${spot.duration}`,
        spot.recommended_time && `おすすめの時間帯: ${spot.recommended_time}`
    ].filter(Boolean).join('\n');

    const reviewText = (spot.reviews || []).map(r => `- ${r.comment}`).join('\n');

    const prompt = `以下は「${spot.name}」という子供の遊び場についての情報です。子育て中の親が、実際に行くかどうかを判断しやすいように、これらの情報（基本情報と口コミ）を総合して2〜4文で要約してください。誇張せず、書かれている内容だけをまとめてください。\n\n【基本情報】\n${facts}\n\n【口コミ】\n${reviewText || '(まだ口コミはありません)'}`;

    const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'x-api-key': apiKey,
            'anthropic-version': '2023-06-01'
        },
        body: JSON.stringify({
            model: 'claude-haiku-4-5-20251001',
            max_tokens: 300,
            messages: [{ role: 'user', content: prompt }]
        })
    });

    if (!res.ok) {
        console.warn(`AI要約の生成に失敗しました(${spot.id}): ${res.status}`);
        return spot.ai_summary || '';
    }
    const data = await res.json();
    return data.content?.[0]?.text?.trim() || spot.ai_summary || '';
}

function normalizeEvent(row) {
    return {
        id: row.id,
        name: row.name,
        related_spot_id: row.related_spot_id || '',
        lat: row.lat ? parseFloat(row.lat) : null,
        lng: row.lng ? parseFloat(row.lng) : null,
        start_date: row.start_date || '',
        end_date: row.end_date || '',
        description: row.description || '',
        photo_url: row.photo_url || '',
        link: row.link || '',
        added_date: row.added_date || ''
    };
}

// 今日が開始日〜終了日の範囲内かどうか（両端を含む）
function isEventActive(event, today) {
    if (!event.start_date || !event.end_date) return false;
    return event.start_date <= today && today <= event.end_date;
}

function writeFile(relPath, content) {
    const fullPath = path.join(ROOT, relPath);
    fs.mkdirSync(path.dirname(fullPath), { recursive: true });
    fs.writeFileSync(fullPath, content);
}

function buildSitemap(spots, events, articles) {
    const urls = [
        `${SITE_URL}/`,
        ...spots.map(s => `${SITE_URL}/spots/${s.id}/`),
        ...events.map(e => `${SITE_URL}/events/${e.id}/`),
        ...articles.map(a => `${SITE_URL}/articles/${a.slug}/`)
    ];
    const body = urls.map(u => `  <url><loc>${u}</loc></url>`).join('\n');
    return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${body}\n</urlset>\n`;
}

async function main() {
    // 前回のビルドで生成した個別ページを一旦削除する（シートから削除された
    // スポット・イベントの古いページが残り続けるのを防ぐため）
    fs.rmSync(path.join(ROOT, 'spots'), { recursive: true, force: true });
    fs.rmSync(path.join(ROOT, 'events'), { recursive: true, force: true });
    fs.rmSync(path.join(ROOT, 'articles'), { recursive: true, force: true });

    const config = loadSourceConfig();
    const spotRows = await loadCsv('spots', config);
    const eventRows = await loadCsv('events', config);
    const reviewRows = await loadCsv('reviews', config);

    const spots = spotRows.map(normalizeSpot).filter(s => s.id);
    const events = eventRows.map(normalizeEvent).filter(e => e.id);
    const reviews = reviewRows.map(normalizeReview).filter(r => r.id);

    const today = new Date().toISOString().slice(0, 10);
    events.forEach(event => {
        event.isActive = isEventActive(event, today);
    });

    // 独立イベント（related_spot_idなし）と、スポット紐付きキャンペーン（related_spot_idあり）に分ける
    const standaloneEvents = events.filter(e => !e.related_spot_id);
    const spotCampaigns = events.filter(e => e.related_spot_id);

    // スポットごとに口コミを紐付け、ページ全体のAI要約を生成（APIキー未設定時はスキップ）。
    // 期間中のキャンペーンがあれば、別ピンにせずスポット自体にバッジとして付与する。
    for (const spot of spots) {
        spot.reviews = reviews.filter(r => r.spot_id === spot.id);
        spot.ai_summary = await summarizeSpotPage(spot);
        spot.activeCampaign = spotCampaigns.find(e => e.related_spot_id === spot.id && e.isActive) || null;
    }

    // 新着（スポット・期間中の独立イベントを追加日順で混ぜて上位5件）
    const newArrivals = [
        ...spots.map(s => ({ ...s, type: 'spot' })),
        ...standaloneEvents.filter(e => e.isActive).map(e => ({ ...e, type: 'event' }))
    ]
        .filter(item => item.added_date)
        .sort((a, b) => (a.added_date < b.added_date ? 1 : -1))
        .slice(0, 5);

    const articles = loadArticles();

    // トップページ
    writeFile('index.html', renderIndexPage({ spots, events, newArrivals, articles }));

    // スポット個別ページ
    spots.forEach(spot => {
        writeFile(`spots/${spot.id}/index.html`, renderSpotPage(spot));
    });

    // イベント個別ページ
    events.forEach(event => {
        writeFile(`events/${event.id}/index.html`, renderEventPage(event));
    });

    // まとめ記事ページ
    articles.forEach(article => {
        writeFile(`articles/${article.slug}/index.html`, renderArticlePage(article, article.html));
    });

    // クライアント側（地図・フィルター）用データ。
    // spots.jsonにはreviews/ai_summary等の重い項目を含めず、地図・カードに必要な項目のみ渡す。
    // イベントは「期間中の独立イベント」のみを地図に載せる（スポット紐付きキャンペーンは
    // 対象スポット側のactiveCampaignとしてすでに表現されているため、別ピンにはしない）。
    const spotsForClient = spots.map(({ reviews, ai_summary, ...rest }) => rest);
    writeFile('spots.json', JSON.stringify(spotsForClient, null, 2));
    writeFile('events.json', JSON.stringify(standaloneEvents.filter(e => e.isActive), null, 2));

    // SEO関連
    writeFile('sitemap.xml', buildSitemap(spots, events, articles));
    writeFile('robots.txt', `User-agent: *\nAllow: /\nSitemap: ${SITE_URL}/sitemap.xml\n`);

    console.log(`ビルド完了: スポット${spots.length}件、イベント${events.length}件、記事${articles.length}件`);
}

main().catch(err => {
    console.error(err);
    process.exit(1);
});
