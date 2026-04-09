// ui-control.js

window.openSettings = openSettings;
let isWifiOn = false;
let button;

document.addEventListener('DOMContentLoaded', () => 
{
    // /* [LOG_TRACE] */  tracelog();

    const reloadBtn = document.getElementById('reloadButton');
    const settingsBtn = document.getElementById('settingsIconButton');

    reloadBtn.addEventListener('click', () => 
    {
        location.reload();
    });

    settingsBtn.addEventListener('click', () => 
    {
        window.openSettings();
    });
    // キーボードフォーカス時のスタイルを明示的に管理したい場合はここに追記可能
});

// ■ 設定モーダル操作
function openSettings() 
{
    // /* [LOG_TRACE] */  tracelog();

    document.getElementById('settingsModal').style.display = "block";
}

// ■ ページタイトル変更
function updateApplication() 
{
    // /* [LOG_TRACE] */  tracelog();

    const product = document.getElementById("product").value;
    const titleElement = document.querySelector("title");
    const h1Element = document.querySelector("header h1");

    if (product === "RAA2P3500") 
    {
        titleElement.textContent = "VIRアプリケーション";
        h1Element.textContent = "VIRアプリケーション";
        enableABZDisplay(true);
    } 
    else 
    {
        titleElement.textContent = "IPSアプリケーション";
        h1Element.textContent = "IPSアプリケーション";
        enableABZDisplay(false);
    }
}

// ■ 
function closeSettings(event) 
{
    // /* [LOG_TRACE] */  tracelog();

    if (event) event.stopPropagation();
    document.getElementById('settingsModal').style.display = "none";
}

// ■ 
function enableABZDisplay(enable) 
{
    // /* [LOG_TRACE] */  tracelog();

    const display = document.getElementById('abzDisplay');
    if (display) 
    {
        display.style.display = enable ? 'block' : 'none';
    }
}

// ■ チェックボックスの状態を取得
function toggleGraph() 
{
    // /* [LOG_TRACE] */  tracelog();

    const showSin = document.getElementById('sinCheckbox').checked;
    const showCos = document.getElementById('cosCheckbox').checked;
    const showSinN = document.getElementById('sinNCheckbox').checked;
    const showCosN = document.getElementById('cosNCheckbox').checked;

    window.clearWaveData();

    // 状態に応じてグラフを更新
    window.updateGraph(showSin, showCos, showSinN, showCosN);
}

// ■ START/STOPボタン初期化
function initStartButton() 
{
    // /* [LOG_TRACE] */  tracelog();

    button = document.getElementById('control_start');
    button.textContent = "START";
    button.style.backgroundColor = "green";
}

// ■ START/STOPボタン切替
function toggleStartButton() 
{
    // /* [LOG_TRACE] */  tracelog();

    if (isWifiOn) 
    {
        window.stopWifi();
        button.textContent = "START";
        button.style.backgroundColor = "green";
    } 
    else 
    {
        window.startWifi();
        button.textContent = "STOP";
        button.style.backgroundColor = "red";
    }
    isWifiOn = !isWifiOn;
}

window.addEventListener('DOMContentLoaded', initStartButton);
