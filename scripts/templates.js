const CATEGORIES = require('../categories.js');
const AMENITIES = require('../amenities.js');

const SITE_NAME = 'たからづか あそびばナビ';
const SITE_DESCRIPTION = '宝塚市・川西市周辺の子育て世代が、天気を気にせず週末のお出かけ先に迷わなくなるための、近場の遊び場さがしサイトです。';
const SITE_URL = 'https://ks-mac0728.github.io/location-video-stamp-rally';

function escapeHtml(str) {
    return String(str ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

function categoryBadge(categoryKey) {
    const cat = CATEGORIES[categoryKey];
    if (!cat) return '';
    return `${cat.emoji} ${cat.label}`;
}

function amenityLabels(amenityKeys) {
    return amenityKeys.map(key => AMENITIES[key]).filter(Boolean);
}

function pageShell({ title, description, ogImage, canonicalPath, bodyClass, head = '', body }) {
    const ogImageTag = ogImage ? `<meta property="og:image" content="${escapeHtml(ogImage)}">` : '';
    return `<!DOCTYPE html>
<html lang="ja">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${escapeHtml(title)}</title>
    <meta name="description" content="${escapeHtml(description)}">
    <link rel="canonical" href="${SITE_URL}${canonicalPath}">
    <meta property="og:title" content="${escapeHtml(title)}">
    <meta property="og:description" content="${escapeHtml(description)}">
    <meta property="og:type" content="website">
    <meta property="og:url" content="${SITE_URL}${canonicalPath}">
    ${ogImageTag}
    <meta name="twitter:card" content="summary_large_image">
    <link rel="stylesheet" href="https://unpkg.com/leaflet@1.7.1/dist/leaflet.css" />
    <link rel="stylesheet" href="${canonicalPath === '/' ? '' : '../../'}style.css">
    ${head}
</head>
<body class="${bodyClass || ''}">
${body}
</body>
</html>
`;
}

function renderSpotCard(spot) {
    const amenityText = amenityLabels(spot.amenities).join('・');
    return `<a class="spot-card" href="spots/${spot.id}/" data-id="${spot.id}" data-category="${spot.category}" data-indoor="${spot.indoor}" data-shade="${spot.shade}" data-water="${spot.water}">
    ${spot.photo_url ? `<img class="spot-card__photo" src="${escapeHtml(spot.photo_url)}" alt="${escapeHtml(spot.name)}" loading="lazy">` : '<div class="spot-card__photo spot-card__photo--placeholder"></div>'}
    <div class="spot-card__body">
        <span class="spot-card__category">${categoryBadge(spot.category)}</span>
        <h3 class="spot-card__name">${escapeHtml(spot.name)}</h3>
        <p class="spot-card__address">${escapeHtml(spot.address)}</p>
        <p class="spot-card__distance" style="display:none;"></p>
        <p class="spot-card__desc">${escapeHtml(spot.description)}</p>
        ${amenityText ? `<p class="spot-card__amenities">設備: ${escapeHtml(amenityText)}</p>` : ''}
    </div>
</a>`;
}

function renderEventCard(event) {
    return `<a class="spot-card event-card" href="events/${event.id}/">
    ${event.photo_url ? `<img class="spot-card__photo" src="${escapeHtml(event.photo_url)}" alt="${escapeHtml(event.name)}" loading="lazy">` : '<div class="spot-card__photo spot-card__photo--placeholder"></div>'}
    <div class="spot-card__body">
        <span class="spot-card__category">🎉 イベント</span>
        <h3 class="spot-card__name">${escapeHtml(event.name)}</h3>
        <p class="spot-card__address">${escapeHtml(event.start_date)} 〜 ${escapeHtml(event.end_date)}</p>
        <p class="spot-card__desc">${escapeHtml(event.description)}</p>
    </div>
</a>`;
}

function renderIndexPage({ spots, events, newArrivals }) {
    const categoryOptions = Object.entries(CATEGORIES)
        .map(([key, cat]) => `<option value="${key}">${cat.emoji} ${cat.label}</option>`)
        .join('\n');

    const cardsHtml = spots.map(renderSpotCard).join('\n');
    const newArrivalsHtml = newArrivals.map(item =>
        item.type === 'event' ? renderEventCard(item) : renderSpotCard(item)
    ).join('\n');

    const body = `
    <header class="site-header">
        <h1 class="site-header__title">${SITE_NAME}</h1>
        <p class="site-header__tagline">${SITE_DESCRIPTION}</p>
        <a href="https://docs.google.com/forms/" class="site-header__submit-link" id="submit-form-link">遊び場の情報を教える</a>
    </header>

    <section id="weather-banner" class="weather-banner">今日の天気を確認しています…</section>

    <section class="new-arrivals">
        <h2 class="section-title">新着スポット・イベント</h2>
        <div class="card-grid">
${newArrivalsHtml || '<p class="empty-note">まだ新着はありません。</p>'}
        </div>
    </section>

    <section class="filter-bar">
        <div class="filter-bar__chips">
            <button type="button" class="filter-chip" data-filter="indoor">屋内</button>
            <button type="button" class="filter-chip" data-filter="shade">日陰</button>
            <button type="button" class="filter-chip" data-filter="water">水遊び</button>
        </div>
        <select id="category-select" class="category-select">
            <option value="">すべてのカテゴリ</option>
${categoryOptions}
        </select>
        <button type="button" id="nearby-button" class="nearby-button">📍 現在地から探す</button>
    </section>
    <p id="nearby-status" class="nearby-status"></p>

    <div id="map"></div>

    <section class="spot-list">
        <h2 class="section-title">スポット一覧</h2>
        <div class="card-grid" id="spot-list">
${cardsHtml}
        </div>
    </section>

    <footer class="site-footer">
        <p>${SITE_NAME} — 情報は変更されている場合があります。お出かけ前に公式サイト等でご確認ください。</p>
    </footer>

    <script src="https://unpkg.com/leaflet@1.7.1/dist/leaflet.js"></script>
    <script src="categories.js"></script>
    <script src="script.js"></script>`;

    return pageShell({
        title: `${SITE_NAME}｜宝塚市周辺の子供と行ける遊び場さがし`,
        description: SITE_DESCRIPTION,
        canonicalPath: '/',
        bodyClass: 'index-page',
        body
    });
}

function renderReviewsSection(spot) {
    const reviews = spot.reviews || [];
    const reviewItems = reviews.map(r => `
        <li class="review-item">
            <p class="review-item__comment">${escapeHtml(r.comment)}</p>
            <p class="review-item__meta">${escapeHtml(r.reviewer_name || '匿名')} ・ ${escapeHtml(r.submitted_date || '')}</p>
        </li>`).join('\n');

    return `
        <section class="spot-reviews">
            <h2 class="section-title">口コミ</h2>
            ${reviews.length ? `<ul class="review-list">${reviewItems}</ul>` : '<p class="empty-note">まだ口コミがありません。</p>'}
            <p><a href="https://docs.google.com/forms/" id="review-form-link">この場所の口コミを投稿する</a></p>
        </section>`;
}

function renderSpotPage(spot) {
    const amenityText = amenityLabels(spot.amenities).join('・');
    const body = `
    <header class="site-header site-header--sub">
        <a href="../../" class="back-link">← ${SITE_NAME} トップへ</a>
    </header>
    <main class="spot-detail">
        ${spot.photo_url ? `<img class="spot-detail__photo" src="${escapeHtml(spot.photo_url)}" alt="${escapeHtml(spot.name)}">` : ''}
        <span class="spot-card__category">${categoryBadge(spot.category)}</span>
        <h1 class="spot-detail__name">${escapeHtml(spot.name)}</h1>
        <p class="spot-detail__address">📍 ${escapeHtml(spot.address)}</p>
        <p class="spot-detail__desc">${escapeHtml(spot.description)}</p>
        ${spot.ai_summary ? `<div class="ai-summary"><span class="ai-summary__label">AIによる概要まとめ</span><p>${escapeHtml(spot.ai_summary)}</p></div>` : ''}
        <dl class="spot-detail__facts">
            <dt>料金</dt><dd>${escapeHtml(spot.fee || '不明')}</dd>
            <dt>駐車場</dt><dd>${escapeHtml(spot.parking || '不明')}</dd>
            <dt>営業時間・定休日</dt><dd>${escapeHtml(spot.hours || '不明')}</dd>
            <dt>設備</dt><dd>${escapeHtml(amenityText || '情報なし')}</dd>
            ${spot.recommended_time ? `<dt>おすすめの時間帯</dt><dd>${escapeHtml(spot.recommended_time)}</dd>` : ''}
            <dt>最終確認日</dt><dd>${escapeHtml(spot.last_verified || '不明')}</dd>
        </dl>
        ${spot.official_url ? `<p><a href="${escapeHtml(spot.official_url)}" target="_blank" rel="noopener">公式サイト・SNSはこちら</a></p>` : ''}
        <div id="spot-map" class="spot-detail__map" data-lat="${spot.lat}" data-lng="${spot.lng}" data-name="${escapeHtml(spot.name)}"></div>

        ${renderReviewsSection(spot)}
    </main>
    <script src="https://unpkg.com/leaflet@1.7.1/dist/leaflet.js"></script>
    <script src="../../spot-detail.js"></script>`;

    const jsonLd = `<script type="application/ld+json">${JSON.stringify({
        '@context': 'https://schema.org',
        '@type': 'Place',
        name: spot.name,
        address: spot.address,
        geo: { '@type': 'GeoCoordinates', latitude: spot.lat, longitude: spot.lng },
        description: spot.description
    })}</script>`;

    return pageShell({
        title: `${spot.name}｜${SITE_NAME}`,
        description: spot.description || SITE_DESCRIPTION,
        ogImage: spot.photo_url,
        canonicalPath: `/spots/${spot.id}/`,
        bodyClass: 'spot-page',
        head: jsonLd,
        body
    });
}

function renderEventPage(event) {
    const body = `
    <header class="site-header site-header--sub">
        <a href="../../" class="back-link">← ${SITE_NAME} トップへ</a>
    </header>
    <main class="spot-detail">
        ${event.photo_url ? `<img class="spot-detail__photo" src="${escapeHtml(event.photo_url)}" alt="${escapeHtml(event.name)}">` : ''}
        <span class="spot-card__category">🎉 イベント</span>
        <h1 class="spot-detail__name">${escapeHtml(event.name)}</h1>
        <p class="spot-detail__address">${escapeHtml(event.start_date)} 〜 ${escapeHtml(event.end_date)}</p>
        <p class="spot-detail__desc">${escapeHtml(event.description)}</p>
        ${event.link ? `<p><a href="${escapeHtml(event.link)}" target="_blank" rel="noopener">詳細・公式情報はこちら</a></p>` : ''}
    </main>`;

    return pageShell({
        title: `${event.name}｜${SITE_NAME}`,
        description: event.description || SITE_DESCRIPTION,
        ogImage: event.photo_url,
        canonicalPath: `/events/${event.id}/`,
        bodyClass: 'spot-page',
        body
    });
}

module.exports = {
    SITE_NAME,
    SITE_DESCRIPTION,
    SITE_URL,
    renderIndexPage,
    renderSpotPage,
    renderEventPage,
    escapeHtml
};
