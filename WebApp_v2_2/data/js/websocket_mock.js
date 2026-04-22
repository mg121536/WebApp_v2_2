// websocket_mock.js

const MOCK_MAX_INTERVAL_MS = 1000 / 30; // 約30fps
const MOCK_BATCH_SIZE = 5; // ESP32のバッチ送信をシミュレーションするためのデータ個数

// --- [設定] ICの電源電圧オプション (3.3 または 5.0) ---
const MOCK_VDD = 3.3; 

// データシート(表13)に基づく電圧計算 (単位: mV)
// 最小: GND + 0.4V, 最大: VDD - 0.4V
const MOCK_OFFSET_MV = 400; 
const MOCK_MAX_MV = (MOCK_VDD * 1000) - MOCK_OFFSET_MV;
const MOCK_CENTER_MV = (MOCK_MAX_MV + MOCK_OFFSET_MV) / 2;
const MOCK_AMPLITUDE_MV = (MOCK_MAX_MV - MOCK_OFFSET_MV) / 2;

// 波形の位相（時間経過の代わり）
let mockPhase = 0;
const PHASE_STEP = 0.02; // 波形の進むスピード（値を変えると周波数が変わります）

// ■ モックWebSocketデータ生成・通信開始
window.startWifi = function startMockWifi() 
{
    if (window.mockInterval) clearInterval(window.mockInterval);

    window.mockInterval = setInterval(() => 
    {
        for (let i = 0; i < MOCK_BATCH_SIZE; i++) {
            
            // Date.now()の代わりに固定ステップで位相を進める（波形のカクつきを解消）
            mockPhase += PHASE_STEP;

            // データシート仕様に準拠した振幅とオフセットで計算
            const A = MOCK_CENTER_MV + MOCK_AMPLITUDE_MV * Math.cos(mockPhase);  // Cos
            const B = MOCK_CENTER_MV + MOCK_AMPLITUDE_MV * Math.sin(mockPhase);  // Sin
            const C = MOCK_CENTER_MV + MOCK_AMPLITUDE_MV * -Math.cos(mockPhase); // CosN
            const D = MOCK_CENTER_MV + MOCK_AMPLITUDE_MV * -Math.sin(mockPhase); // SinN

            // 角度データの生成 (0〜360度に補正)
            let angle = (Math.atan2(Math.sin(mockPhase), Math.cos(mockPhase)) * 180) / Math.PI;
            if (angle < 0) {
                angle += 360.0;
            }

            if (i < MOCK_BATCH_SIZE - 1) {
                // ★ 最後の1個"以外"：履歴配列にデータを入れるだけ
                if (typeof updateData === 'function') {
                    updateData(A_vals, A);
                    updateData(B_vals, B);
                    updateData(C_vals, C);
                    updateData(D_vals, D);
                }
                window.Angle = angle; 
            } else {
                // ★ 最後の1個：配列追加＆画面の再描画を行う
                if (typeof updateActiveCanvas === 'function') {
                    updateActiveCanvas(A, B, C, D, angle);
                }

                const activeTab = getActiveTab();
                if (activeTab === 'console') 
                {
                    customLog(
                        'debug',
                        `Sin=${String(B.toFixed(0)).padStart(5)}  ` +
                        `Cos=${String(A.toFixed(0)).padStart(5)}  ` +
                        `SinN=${String(D.toFixed(0)).padStart(5)}  ` +
                        `CosN=${String(C.toFixed(0)).padStart(5)}  ` +
                        `Angle=${String(angle.toFixed(1)).padStart(6)}`
                    );
                }
            }
        }
    }, MOCK_MAX_INTERVAL_MS);
};

// ■ モックWi-Fiのデータ生成を停止
window.stopWifi = function stopMockWifi() 
{
    if (window.mockInterval) 
    {
        clearInterval(window.mockInterval);
        window.mockInterval = null;
    }
};