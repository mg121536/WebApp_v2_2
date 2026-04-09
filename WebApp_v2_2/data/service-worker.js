// service-worker.js

// Service Worker 設定
const CACHE_NAME = 'ips-app-cache-v1';
const urlsToCache = [
    '/',
    //'service-worker.js',
    //'register-sw.js',
    'manifest.json',
    'index.html',
    'offline.html',
    'portal.html',
    'css/style.css',
    'js/log.js',
    'js/ui-control.js',
    'js/resize.js',
    'js/graph.js',
    'js/calibration.js',
    'js/websocket.js',
    //'js/websocket_mock.js',
    'js/init.js',
    //'js/script.js',
    'img/Nmb.png',
    'img/NmbIcon.png',
];

// インストール処理
self.addEventListener('install', event => {
    event.waitUntil(
        caches.open(CACHE_NAME).then(cache => {
            console.log('Service Worker: キャッシュ作成');
            return cache.addAll(urlsToCache).catch(error => {
                console.error('キャッシュの追加に失敗しました:', error);
            });
        })
    );
});

// フェッチ処理
self.addEventListener('fetch', event => {
    event.respondWith(
        caches.match(event.request).then(response => {
            if (response) {
                return response; // キャッシュからリソースを返す
            }

            // キャッシュにない場合、ネットワークから取得
            return fetch(event.request).catch(() => {
                // オフライン時にオフラインページを返す
                return caches.match('/offline.html');
            });
        })
    );
});

// アクティベート処理
self.addEventListener('activate', event => {
    const cacheWhitelist = [CACHE_NAME];

    event.waitUntil(
        caches.keys().then(keyList => {
            return Promise.all(
                keyList.map(key => {
                    if (!cacheWhitelist.includes(key)) {
                        return caches.delete(key); // 不要なキャッシュ削除
                    }
                })
            );
        })
    );
});
