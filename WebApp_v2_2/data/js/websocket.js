// websocket.js

let ws;
const WS_MAX_SMOOTH_LEN = 5;
const ws_smoothBuffer = { A: [], B: [], C: [], D: [] };

// ■ WebSocket接続・通信開始
window.startWifi = function startWifi() 
{
    /* [LOG_TRACE] */
    tracelog();

    if (!ws || ws.readyState === WebSocket.CLOSED || ws.readyState === WebSocket.CLOSING)
    {
        log('info', "WebSocket 接続開始");
  
        ws = new WebSocket('ws://192.168.4.1:81');
        ws.binaryType = "arraybuffer";
  
        ws.onopen = () => 
        {
            log('info', "WebSocket 接続成功");
        };
  
        ws.onmessage = (event) => 
        {
            if (event.data instanceof ArrayBuffer) 
            {
                const view = new DataView(event.data);

                // 波形・角度データ(Sin・Cos・SinN・CosN)
                const A_raw  = view.getUint16(0, false);
                const B_raw  = view.getUint16(2, false);
                const C_raw  = view.getUint16(4, false);
                const D_raw  = view.getUint16(6, false);
                const angle = readFloat32(view, 8, true);

                const A = smooth(A_raw, 'A');
                const B = smooth(B_raw, 'B');
                const C = smooth(C_raw, 'C');
                const D = smooth(D_raw, 'D');

                if (A === null || B === null || C === null || D === null) return;
                //resizeCanvas();
                // 描画更新
                updateActiveCanvas(A, B, C, D, angle);
		        
                log('info', `WebSocket データ受信(Binary) Sin:${A.toFixed(0)}, 
                                    Cos:${B.toFixed(0)}, 
                                    SinN:${C.toFixed(0)}, 
                                    CosN:${D.toFixed(0)}, 
                                    Angle:${angle.toFixed(1)}°`);
                const activeTab = getActiveTab();
                if (activeTab === 'console') 
                {
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
            else if (typeof event.data === "string") 
            {
                log('info', "WebSocket データ受信(string) " + event.data);
                processData(event.data.trim());
            } 
            else 
            {
                log('warn', "WebSocket 受信データ不正");
            }
        };
  
        ws.onerror = (error) => 
        {
            log('error', "WebSocket エラー(詳細不明)");
        };
  
        ws.onclose = () => 
        {
            log('info', "WebSocket 接続切断");
        };
    } 
    else 
    {
        log('info', "WebSocket 接続済み");
    }
    //resizeCanvas();
}

// ■ スムース処理
function smooth(value, key) 
{
    /* [LOG_TRACE] */
    //tracelog();

    const buf = ws_smoothBuffer[key];
    buf.push(value);
    if (buf.length > WS_MAX_SMOOTH_LEN) buf.shift();
    if (buf.length < WS_MAX_SMOOTH_LEN) return null;

    return buf.reduce((a, b) => a + b, 0) / buf.length;
}

// ■ floatデータ読み取り処理
function readFloat32(view, byteOffset, littleEndian = true) 
{
    /* [LOG_TRACE] */
    //tracelog();

    return view.getFloat32(byteOffset, littleEndian);
}

function processData(data) 
{
    /* [LOG_TRACE] */
    //tracelog();

    const match = data.match(/A:(\d+).*B:(\d+).*C:(\d+).*D:(\d+)/);
    if (match) 
    {
        let A_val = parseInt(match[1]);
        let B_val = parseInt(match[2]);
        let C_val = parseInt(match[3])
        let D_val = parseInt(match[4])

        updateActiveCanvas(A_val, B_val, C_val, D_val, 0);
    } 
}

