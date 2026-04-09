// log.js

// 設定: 
// LOG_DEBUG = true にすると log() によるログ出力を有効。
// LOG_TRACE = true にすると trace() によるログ出力を有効。
// LOG_SETTINGSで各ログレベルの出力を有効/無効。
const LOG_DEBUG = false;
const LOG_TRACE = false;
const LOG_SETTINGS = 
{
    debug: false,
    info : false,
    warn : false,
    error: false
};
let traceCount;

window.currentMode = null;

// ■ ログ出力
// 使用方法: 
// log('debug' | 'info' | 'warn' | 'error', メッセージ);
window.log = LOG_DEBUG
    ? function(level, msg) 
    {
        if (!LOG_SETTINGS[level]) return;
        if (!console[level]) level = 'log';

        const timestamp = new Date().toISOString();
        const upperLevel = level.toUpperCase();
        console[level](`[${timestamp}] [${upperLevel}] ${msg}`);
    }
    : function() {};

// ■ トレースログ出力
// 使用方法: 
// tracelog();
window.tracelog = LOG_TRACE
    ? function() 
    {
        traceCount++;

        const stack = new Error().stack;

        const stackLines = stack.split('\n');
        const callerLine = stackLines[2] || '';

        const match = callerLine.match(/at\s+(.*?)\s+\((.*?):(\d+):(\d+)\)/) ||
                      callerLine.match(/at\s+(.*?):(\d+):(\d+)/) ||
                      callerLine.match(/(.*?):(\d+):(\d+)/);

        let functionName = 'anonymous';
        let fileName = 'unknown';
        let lineNumber = '0';

        if (match) 
        {
            if (match.length === 5) 
            {
                functionName = match[1];
                fileName = match[2];
                lineNumber = match[3];
            } 
            else if (match.length === 4) 
            {
                fileName = match[1];
                lineNumber = match[2];
            }
        }
        const timestamp = new Date().toISOString();
        console.log(`[${timestamp}] [TRACE ${traceCount}] Function: ${functionName}, File: ${fileName}, Line: ${lineNumber}`);
    }
    : function() {};

function customLog(level, message) 
{
    if (window.currentMode !== 'console') return;

    const timestamp = new Date().toISOString();
    const upperLevel = level.toUpperCase();
    const formatted = `[${timestamp}] [${upperLevel}] ${message}`;

    const logContainer = document.getElementById('consoleContainer');
    const logEl = document.getElementById('consoleLog');

    if (logContainer) logContainer.style.display = 'block';
    if (logEl) 
    {
        const lines = logEl.textContent.split('\n').filter(line => line.trim() !== '');
        lines.push(formatted);

        const MAX_LINES = 100;
        const trimmed = lines.slice(-MAX_LINES);  // 最新100件だけ残す

        logEl.textContent = trimmed.join('\n') + '\n';
        logEl.scrollTop = logEl.scrollHeight;
    }
}
