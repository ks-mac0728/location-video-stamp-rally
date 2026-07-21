# たからづか あそびばナビ（仮称）

宝塚市および隣接市（川西市など）在住で、未就学児〜小学校低学年の子を持つ親向けに、夏の暑い日・雨の日でも子供と一緒にすぐ行ける近場の遊び場を見つけられる公開サイトです。

## 仕組み

- スポット・イベントのデータはGoogleスプレッドシートで管理し、CSV公開URL経由で取得します（`data/source-config.json`で設定、未設定時は`data/spots.csv`・`data/events.csv`を使用）
- `npm run build` でスポット・イベントごとの静的ページ、トップページ、`spots.json`/`events.json`、`sitemap.xml`を生成します
- GitHub Actions（`.github/workflows/build.yml`）が1日1回自動でビルド・コミットし、GitHub Pagesに反映されます
- トップページの天気バナーはOpen-Meteo（APIキー不要）から取得し、気温33℃以上または降水確率50%以上の場合に屋内・日陰・水遊びスポットをおすすめ表示します

## ローカルでの確認

```
npm install
npm run build
npx http-server -p 8000
```
