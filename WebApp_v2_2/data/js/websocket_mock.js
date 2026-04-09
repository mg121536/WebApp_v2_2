// websocket_mock.js


const MOCK_MAX_INTERVAL_MS = 1000 / 30; // 約30fps
const MOCK_MAX_SMOOTH_LEN = 5;
const mock_smoothBuffer = { A: [], B: [], C: [], D: [] };

// ■ モックWebSocketデータ生成・通信開始
window.startWifi = function startMockWifi() 
{
	/* [LOG_TRACE] */
	tracelog();

	if (window.mockInterval) clearInterval(window.mockInterval);

    window.mockInterval = setInterval(() => 
    {
        const t = Date.now() / 300;

        // 波形データの生成・スムース処理
        window.A = smooth(2048 + 2048 * Math.sin(t), 'A');
        window.B = smooth(2048 + 2048 * Math.cos(t), 'B');
        window.C = smooth(2048 + 2048 * -Math.sin(t), 'C');
        window.D = smooth(2048 + 2048 * -Math.cos(t), 'D');

        if (window.A === null || window.B === null || window.C === null || window.D === null) return;

        // 角度データの生成
        window.angle = (Math.atan2(Math.sin(t), Math.cos(t)) * 180) / Math.PI;

        // 描画更新
        updateActiveCanvas(window.A, window.B, window.C, window.D, window.angle);

        const activeTab = getActiveTab();
        if (activeTab === 'console') 
        {
           log('info', `MockData → Sin:${window.A.toFixed(0)}, 
                               Cos:${window.B.toFixed(0)}, 
                               SinN:${window.C.toFixed(0)}, 
                               CosN:${window.D.toFixed(0)}, 
                               Angle:${window.angle.toFixed(1)}°`);
            customLog(
                        'debug',
                        `Sin=${String(A.toFixed(0)).padStart(5)}  ` +
                        `Cos=${String(B.toFixed(0)).padStart(5)}  ` +
                        `SinN=${String(C.toFixed(0)).padStart(5)}  ` +
                        `CosN=${String(D.toFixed(0)).padStart(5)}  ` +
                        `Angle=${String(angle.toFixed(1)).padStart(6)}`
                    );
        }
    }, MOCK_MAX_INTERVAL_MS);
};

// ■ モックWi-Fiのデータ生成を停止
window.stopWifi = function stopMockWifi() 
{
	/* [LOG_TRACE] */
	//tracelog();

	if (window.mockInterval) 
	{
		clearInterval(window.mockInterval);
		window.mockInterval = null;
	}
};

// ■ スムース処理
function smooth(value, key) 
{
	/* [LOG_TRACE] */
	//tracelog();

	const buf = mock_smoothBuffer[key];
	buf.push(value);
	if (buf.length > MOCK_MAX_SMOOTH_LEN) buf.shift();
    if (buf.length < MOCK_MAX_SMOOTH_LEN) return null;

	return buf.reduce((a, b) => a + b, 0) / buf.length;
}
