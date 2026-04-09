// serial.js

window.startSerial = startSerial;

function startSerial() 
{
    // /* [LOG_TRACE] */  tracelog();

    if (navigator.serial) 
    {
        navigator.serial.requestPort()
            .then(port => 
            {
                serialPort = port;
                return serialPort.open({ baudRate: 115200 });
            })
            .then(() => 
            {
                const reader = serialPort.readable.getReader();
                readLoop(reader);
            })
            .catch(error => 
            {
                alert(`シリアル接続に失敗: ${error.message}`);
                console.error("シリアル接続エラー", error);
            });
    } 
    else 
    {
        alert("このブラウザはシリアル通信をサポートしていません。");
    }
}

async function readLoop(reader) 
{
    // /* [LOG_TRACE] */  tracelog();

    const decoder = new TextDecoder();
    let buffer = "";

    while (true) 
    {
        const { value, done } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });

        let newLineIndex;
        while ((newLineIndex = buffer.indexOf('\n')) >= 0) 
        {
            const line = buffer.slice(0, newLineIndex);
            buffer = buffer.slice(newLineIndex + 1);
            processData(line);
        }
    }
}
