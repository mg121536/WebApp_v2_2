# ESP32

WebApp
├─ data
│  ├─ index.html              ... メインHTML
│  ├─ style.css               ... スタイルシート
│  ├─ manifest.json           ... PWA用マニフェスト
│  ├─ offline.html            ... オフライン用ページ
│  ├─ service-worker.js       ... サービスワーカー本体
│  ├─ register-sw.js          ... サービスワーカー登録
│  ├─ init.js                 ... 初期設定（定数・変数）
│  ├─ utils.js                ... 汎用関数（ログ・UIなど）
│  ├─ settings.js             ... モーダルや設定UI操作
│  ├─ resize.js               ... ウィンドウ・キャンバス調整
│  ├─ graph.js                ... グラフ描画関数
│  ├─ parser.js               ... 受信データ処理関数
│  ├─ serial.js               ... Web Serial通信関係
│  ├─ websocket.js            ... WebSocket通信関係
│  ├─ script.js               ... アプリ起動トリガーだけ
│  └─ img/
│      ├─ Nmb.png             ... ヘッダー用ロゴ画像
│      └─ NmbIcon.png         ... ファビコン用画像
│
└─ src
   ├─ IPS.h　　　　　　              ... 全体ヘッダー定義
   ├─ IPS_Cfg.h　　　　　　          ... 設定定義ファイル
   ├─ IPS_Debug.h                   ... デバック処理
   ├─ IPS_Wifi.h                    ... Wi-Fi通信処理
   └─ src.ino                       ... メインスケッチ（Arduino起点）
