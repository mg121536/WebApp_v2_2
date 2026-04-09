// serial_mock.js

window.startSerial = startMockSerial;

function startMockSerial() 
{
    // /* [LOG_TRACE] */  tracelog();

    const smoothBuffer = { A: [], B: [], C: [], D: [], maxLen: 5 };

    function smooth(value, key) 
    {
        const buf = smoothBuffer[key];
        buf.push(value);
        if (buf.length > smoothBuffer.maxLen) buf.shift();
        return buf.reduce((a, b) => a + b, 0) / buf.length;
    }

    if (window.mockSerialInterval) 
    {
        clearInterval(window.mockSerialInterval);
    }

    window.mockSerialInterval = setInterval(() => 
    {
        const t = Date.now() / 300;

        const A = smooth(2048 + 2048 * Math.sin(t), 'A');
        const B = smooth(2048 + 2048 * Math.cos(t), 'B');
        const C = smooth(2048 + 2048 * -Math.sin(t), 'C');
        const D = smooth(2048 + 2048 * -Math.cos(t), 'D');

        // データを文字列としてフォーマット
        const message = `A: ${A.toFixed(0)}, B: ${B.toFixed(0)}, C: ${C.toFixed(0)}, D: ${D.toFixed(0)}`;

        // 通常の受信処理と同じように扱う
        processData(message);

    }, 33); // 約30fps
}

window.stopMockSerial = function () 
{
    // /* [LOG_TRACE] */  tracelog();

    if (window.mockSerialInterval) 
    {
        clearInterval(window.mockSerialInterval);
        window.mockSerialInterval = null;
    }
};
