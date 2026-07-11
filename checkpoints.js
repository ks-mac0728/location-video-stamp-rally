// チェックポイントのマスターデータ
// 新しいチェックポイントを追加する場合はこの配列に要素を追加してください。
// checkpoints.xlsx に同じ内容の一覧があるので、あわせて更新してください。
const CHECKPOINTS = [
    {
        id: 'seikoujin-test',
        name: 'テストチェックポイント：清荒神',
        address: '兵庫県宝塚市清荒神一丁目3-15',
        lat: 34.811108,
        lng: 135.352936,
        radius: 0.1, // チェックイン可能な半径 (km)
        photo: 'assets/checkpoint-photo.svg',
        video: 'movie/train-robot.mp4',
        description: '動作確認用の仮チェックポイントです。ここに近づいてチェックインすると動画が再生されます。'
    },
    {
        id: 'sakaemachi-fire-station',
        name: '宝塚市消防本部 西消防署 栄町出張所',
        address: '兵庫県宝塚市栄町一丁目',
        lat: 34.80783,
        lng: 135.34446,
        radius: 0.1,
        photo: 'assets/checkpoint-photo.svg',
        video: 'movie/fire-engine.mp4',
        description: '消防車と出会えるチェックポイントです。ここに近づいてチェックインすると動画が再生されます。'
    }
];
