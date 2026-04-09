// register-sw.js

if ('serviceWorker' in navigator) 
{
    window.addEventListener('load', () => 
    {
        // Service Workerの登録
        navigator.serviceWorker.register('service-worker.js')
            .then(registration => 
            {
                console.log('Service Worker 登録成功:', registration);

                if (registration.waiting) 
                {
                    console.log('新しい Service Worker が待機中です。');
                }

                registration.onupdatefound = () => 
                {
                    const installingWorker = registration.installing;

                    installingWorker.onstatechange = () => 
                    {
                        if (installingWorker.state === 'installed') 
                        {
                            if (navigator.serviceWorker.controller) 
                            {
                                console.log('新しいコンテンツがインストールされました');
                                alert('新しいバージョンのアプリケーションが利用可能です');
                            } 
                            else 
                            {
                                console.log('コンテンツがキャッシュされ、オフラインで利用可能です');
                            }
                        }
                    };
                };
            })
            //.catch(error => 
            //    {
            //    console.error('Service Worker 登録失敗:', error);
            //    alert('サービスワーカーの登録に失敗しました。');
            //});
    });
} else {
    console.log('このブラウザは Service Worker をサポートしていません');
}
