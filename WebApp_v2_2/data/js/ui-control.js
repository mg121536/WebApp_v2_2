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
    
    // ★ 追加：起動時にURLのIPアドレスを見て製品を自動判定・設定する
    autoDetectProductByIP();
    
    // START/STOPボタン初期化
    initStartButton();
});

// ■ ★ 新規追加：IPアドレスによる自動判定機能
function autoDetectProductByIP() {
    const currentIP = window.location.hostname;
    const productSelect = document.getElementById("product");
    
    // 判定ロジック (IPS_Wifi.h で設定したIPに合わせてください)
    // 192.168.10.x なら IPS、192.168.20.x なら VIR とする例
    if (currentIP.includes("192.168.10.")) {
        productSelect.value = "IPS2550";
    } else if (currentIP.includes("192.168.20.")) {
        productSelect.value = "RAA2P3500";
    } else {
        // どちらでもない場合（テスト環境など）はデフォルトのまま
    }
    
    // 判定結果をもとに画面のタイトル等を更新
    updateApplication();
}


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
    else // "IPS2550" または デフォルト
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
    if (button) { // DOMが存在するかチェック
        button.textContent = "START";
        button.style.backgroundColor = "green";
    }
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
