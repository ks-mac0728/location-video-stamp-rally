// チェックポイントの設定画面（settings.html）から使う、静的配信＋簡易API付きのローカルサーバー。
// GET  /api/checkpoints  … checkpoints.json を返す
// POST /api/checkpoints  … checkpoints.json を書き換える
// POST /api/upload       … 動画・画像ファイルを movie/ または assets/ に保存する
const http = require('http');
const fs = require('fs');
const path = require('path');
const { execFile } = require('child_process');
const { formidable } = require('formidable');
const serveHandler = require('serve-handler');

const ROOT = __dirname;
const CHECKPOINTS_JSON = path.join(ROOT, 'checkpoints.json');
const PORT = process.env.PORT || 8000;

function setCors(res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
}

function readBody(req) {
    return new Promise((resolve, reject) => {
        let body = '';
        req.on('data', chunk => { body += chunk; });
        req.on('end', () => resolve(body));
        req.on('error', reject);
    });
}

async function handleGetCheckpoints(req, res) {
    const data = fs.readFileSync(CHECKPOINTS_JSON, 'utf-8');
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader('Cache-Control', 'no-store');
    res.end(data);
}

async function handleSaveCheckpoints(req, res) {
    try {
        const body = await readBody(req);
        const checkpoints = JSON.parse(body);
        if (!Array.isArray(checkpoints)) {
            throw new Error('checkpoints must be an array');
        }
        fs.writeFileSync(CHECKPOINTS_JSON, JSON.stringify(checkpoints, null, 2) + '\n');
        res.setHeader('Content-Type', 'application/json; charset=utf-8');
        res.end(JSON.stringify({ ok: true }));
    } catch (err) {
        res.statusCode = 400;
        res.setHeader('Content-Type', 'application/json; charset=utf-8');
        res.end(JSON.stringify({ ok: false, error: err.message }));
    }
}

function generateVideoThumbnail(videoPath, assetsDir, baseName) {
    return new Promise((resolve) => {
        const thumbName = `${baseName}-thumb.jpg`;
        const thumbPath = path.join(assetsDir, thumbName);
        execFile('ffmpeg', [
            '-y', '-i', videoPath, '-ss', '00:00:00', '-vframes', '1', '-q:v', '3', thumbPath
        ], (err) => {
            if (err) {
                resolve(null); // ffmpegが無い環境でもアップロード自体は失敗させない
            } else {
                resolve(`assets/${thumbName}`);
            }
        });
    });
}

async function handleUpload(req, res) {
    try {
        const kind = (new URL(req.url, 'http://localhost')).searchParams.get('kind');
        const destDir = kind === 'video' ? path.join(ROOT, 'movie') : path.join(ROOT, 'assets');
        fs.mkdirSync(destDir, { recursive: true });

        const form = formidable({
            uploadDir: destDir,
            keepExtensions: true,
            maxFileSize: 200 * 1024 * 1024 // 200MB
        });
        const [, files] = await form.parse(req);
        const fileField = files.file && files.file[0];
        if (!fileField) {
            throw new Error('ファイルが見つかりません');
        }

        // 元のファイル名（拡張子付き）で保存し直す。同名があれば連番を付ける。
        const originalName = fileField.originalFilename || path.basename(fileField.filepath);
        let finalName = originalName;
        let counter = 1;
        while (fs.existsSync(path.join(destDir, finalName))) {
            const ext = path.extname(originalName);
            const base = path.basename(originalName, ext);
            finalName = `${base}-${counter}${ext}`;
            counter += 1;
        }
        fs.renameSync(fileField.filepath, path.join(destDir, finalName));

        const relativePath = `${kind === 'video' ? 'movie' : 'assets'}/${finalName}`;
        let thumbnailPath = null;
        if (kind === 'video') {
            const assetsDir = path.join(ROOT, 'assets');
            fs.mkdirSync(assetsDir, { recursive: true });
            const baseName = path.basename(finalName, path.extname(finalName));
            // 動画の0秒時点のフレームを写真欄用のアイキャッチとして自動生成する
            thumbnailPath = await generateVideoThumbnail(path.join(destDir, finalName), assetsDir, baseName);
        }

        res.setHeader('Content-Type', 'application/json; charset=utf-8');
        res.end(JSON.stringify({ ok: true, path: relativePath, thumbnailPath }));
    } catch (err) {
        res.statusCode = 400;
        res.setHeader('Content-Type', 'application/json; charset=utf-8');
        res.end(JSON.stringify({ ok: false, error: err.message }));
    }
}

const server = http.createServer(async (req, res) => {
    setCors(res);
    if (req.method === 'OPTIONS') {
        res.writeHead(204);
        res.end();
        return;
    }

    const url = req.url.split('?')[0];

    if (url === '/api/checkpoints' && req.method === 'GET') {
        return handleGetCheckpoints(req, res);
    }
    if (url === '/api/checkpoints' && req.method === 'POST') {
        return handleSaveCheckpoints(req, res);
    }
    if (url === '/api/upload' && req.method === 'POST') {
        return handleUpload(req, res);
    }

    // それ以外は静的ファイル配信（動画のRangeリクエストにも対応）
    return serveHandler(req, res, {
        public: ROOT,
        headers: [
            { source: '**/*', headers: [{ key: 'Cache-Control', value: 'no-cache' }] }
        ]
    });
});

server.listen(PORT, () => {
    console.log(`server running: http://localhost:${PORT}`);
});
