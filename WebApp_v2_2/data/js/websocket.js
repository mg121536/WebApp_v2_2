// websocket.js

let ws;

// ■ WebSocket接続・通信開始
window.startWifi = function startWifi() 
{
    /* [LOG_TRACE] */
    // tracelog();

    if (!ws || ws.readyState === WebSocket.CLOSED || ws.readyState === WebSocket.CLOSING)
    {
        log('info', "WebSocket 接続開始");
  
        ws = new WebSocket(`ws://${window.location.hostname}:81`);
        ws.binaryType = "arraybuffer";
  
        ws.onopen = () => {};
  
        ws.onmessage = (event) => 
        {
            if (event.data instanceof ArrayBuffer) 
            {
                const view = new DataView(event.data);
                const POINT_SIZE = 12; 
                const pointCount = view.byteLength / POINT_SIZE;
                
                // ★改善: ループの外で1回だけアクティブタブを取得し、無駄な処理を減らす
                const activeTab = getActiveTab();

                for (let i = 0; i < pointCount; i++) {
                    const offset = i * POINT_SIZE;

                    // ★改善: readFloat32関数を経由せず、直接読み出す（関数コールコストをゼロに）
                    const A = view.getUint16(offset + 0, false);
                    const B = view.getUint16(offset + 2, false);
                    const C = view.getUint16(offset + 4, false);
                    const D = view.getUint16(offset + 6, false);
                    const angle = view.getFloat32(offset + 8, true);

                    if (i < pointCount - 1) {
                        updateData(A_vals, A);
                        updateData(B_vals, B);
                        updateData(C_vals, C);
                        updateData(D_vals, D);
                        Angle = angle;
                    } else {
                        updateActiveCanvas(A, B, C, D, angle);
                        
                        // コンソールタブが開かれている時のみ、文字列結合処理を実行する
                        if (activeTab === 'console') {
                            customLog(
                                'debug',
                                `Sin=${String(A.toFixed(0)).padStart(5)}  ` +
                                `Cos=${String(B.toFixed(0)).padStart(5)}  ` +
                                `SinN=${String(C.toFixed(0)).padStart(5)}  ` +
                                `CosN=${String(D.toFixed(0)).padStart(5)}  ` +
                                `Angle=${String(angle.toFixed(1)).padStart(6)}`
                            );
                        }
                    }
                }
            }
            else if (typeof event.data === "string") 
            {
                processData(event.data.trim());
            } 
        };
  
        ws.onerror = (error) => {};
        ws.onclose = () => {};
    } 
}

// ■ WebSocket切断処理 (STOPボタン用)
window.stopWifi = function stopWifi() 
{
    if (ws && (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING)) 
    {
        ws.close();
        console.log("WebSocket 通信を停止しました");
    }
}

// ■ テキストデータ読み取り処理 (レガシー対応)
function processData(data) 
{
    /* [LOG_TRACE] */
    //tracelog();

    const match = data.match(/A:(\d+).*B:(\d+).*C:(\d+).*D:(\d+)/);
    if (match) 
    {
        let A_val = parseInt(match[1]);
        let B_val = parseInt(match[2]);
        let C_val = parseInt(match[3]);
        let D_val = parseInt(match[4]);

        updateActiveCanvas(A_val, B_val, C_val, D_val, 0);
    } 
}
