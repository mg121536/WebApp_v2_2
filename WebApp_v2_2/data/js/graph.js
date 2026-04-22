// graph.js
// ctx   : CanvasRenderingContext2D
// canvas: HTMLCanvasElement

const FONT_FAMILY = '"Noto Sans JP", "Helvetica Neue", "Helvetica", "Arial", sans-serif';
const COLOR_GRID    = 'rgba(255, 255, 255, 0.2)';
const COLOR_SIN     = 'rgba(255, 0, 0, 1)';
const COLOR_COS     = 'rgba(0, 0, 255, 1)';
const COLOR_SINN    = 'rgba(255, 0, 0, 0.7)';
const COLOR_COSN    = 'rgba(0, 0, 255, 0.7)';
const COLOR_WHITE   = 'rgba(255, 255, 255, 1)';
const COLOR_BLACK   = 'rgba(0, 0, 0, 1)';
const COLOR_RED     = 'rgba(255, 0, 0, 1)';

// --- [設定] 電圧スケール切り替え ---
// 5.0 : 従来の5.0V表示
// 3.3 : 3.3V表示
// const DISPLAY_VOLTAGE_MODE = 3.3;
const DISPLAY_VOLTAGE_MODE = 3.3;

const VOLTAGE_REF   = DISPLAY_VOLTAGE_MODE;
const Y_MIN         = 0;
const Y_MAX         = DISPLAY_VOLTAGE_MODE * 1000; // mV単位
const Y_MARGIN      = 0;
const DRAW_Y_MIN    = Y_MIN - (Y_MAX * Y_MARGIN);
const DRAW_Y_MAX    = Y_MAX + (Y_MAX * Y_MARGIN);

const maxDataPoints = 100;
const A_vals = Array(maxDataPoints).fill(0);
const B_vals = Array(maxDataPoints).fill(0);
const C_vals = Array(maxDataPoints).fill(0);
const D_vals = Array(maxDataPoints).fill(0);
let Angle = 0;
let isPageVisible = true;

let G_Checkboxes = {};
let G_Canvases = {};
let G_OffscreenCanvases = {};
let G_Contexts = {};
let G_OffscreenContexts = {};
let G_OffscreenCtx = null;
let G_TabElements = {};
let G_canvasContainer = null;
let G_consoleContainer = null;
let G_settingsView = null;

const MARGIN = 
{
    top: 40,
    right: 40,
    bottom: 120,
    left: 120
};

// ■ Canvasサイズ更新処理 (リサイズ ＆ 再描画)
function updateAllCanvasSizes() {
    // 1. 親コンテナの現在の表示サイズを取得
    const container = G_canvasContainer;
    const width  = container.clientWidth;
    const height = container.clientHeight;

    // 2. 表示用Canvasのサイズを更新 (既存の関数を呼び出す)
    resizeCanvasForHighDPI(G_Canvases.all,   G_Contexts.all,   width, height);
    resizeCanvasForHighDPI(G_Canvases.graph, G_Contexts.graph, width, height);
    resizeCanvasForHighDPI(G_Canvases.angle, G_Contexts.angle, width, height);

    // 3. オフスクリーンCanvasのサイズも同様に更新する
    //    (これを忘れると描画がずれる)
    G_OffscreenCanvases.graph.width  = width;
    G_OffscreenCanvases.graph.height = height;

    G_OffscreenCanvases.angle.width  = width;
    G_OffscreenCanvases.angle.height = height;

    // 'all'タブ用の分割サイズも再計算する
    const leftWidth  = Math.floor(width * 0.65);
    const rightWidth = width - leftWidth;

    G_OffscreenCanvases.allLeft.width  = leftWidth;
    G_OffscreenCanvases.allLeft.height = height;
    G_OffscreenCanvases.allRight.width  = rightWidth;
    G_OffscreenCanvases.allRight.height = height;

    // 4. サイズ変更後に現在のタブを再描画する
    //    (データは最新のものをグローバル変数から取得)
    window.updateActiveCanvas(
        A_vals[A_vals.length - 1],
        B_vals[B_vals.length - 1],
        C_vals[C_vals.length - 1],
        D_vals[D_vals.length - 1],
        Angle
    );
}

// ■ [Event] 初期化
document.addEventListener('DOMContentLoaded', function() {
    // /* [LOG_TRACE] */  tracelog();

    G_Checkboxes = {
        sin:   document.getElementById('sinCheckbox'),
        cos:   document.getElementById('cosCheckbox'),
        sinN:  document.getElementById('sinNCheckbox'),
        cosN:  document.getElementById('cosNCheckbox')
    };

    G_Canvases = {
        all: document.getElementById('canvasAll'),
        graph: document.getElementById('canvasGraph'),
        angle: document.getElementById('canvasAngle')
    };

    G_Contexts = {
        all: G_Canvases.all.getContext('2d'),
        graph: G_Canvases.graph.getContext('2d'),
        angle: G_Canvases.angle.getContext('2d')
    };

    G_OffscreenCanvases = {
        graph: document.createElement('canvas'),
        angle: document.createElement('canvas'),
        allLeft: document.createElement('canvas'),
        allRight: document.createElement('canvas')
    };

    G_OffscreenContexts = {
        graph: G_OffscreenCanvases.graph.getContext('2d'),
        angle: G_OffscreenCanvases.angle.getContext('2d'),
        allLeft: G_OffscreenCanvases.allLeft.getContext('2d'),
        allRight: G_OffscreenCanvases.allRight.getContext('2d')
    };

    G_TabElements = {
        all: document.getElementById('tab_all'),
        graph: document.getElementById('tab_graph'),
        angle: document.getElementById('tab_angle'),
        console: document.getElementById('tab_console'),
        settings: document.getElementById('tab_settings')
    };

    G_canvasContainer = document.getElementById('canvasContainer');
    G_consoleContainer = document.getElementById('consoleContainer');
    G_settingsView = document.getElementById('settings-view');

    // 1. ページ読み込み時に一度、サイズを合わせる
    updateAllCanvasSizes(); 
    
    // 2. ウィンドウ（ブラウザ）サイズが変わったら、再度サイズを合わせる
    //    (iPadの縦横回転、スプリットビューなどで発火)
    window.addEventListener('resize', updateAllCanvasSizes);
    
});

// ■ [Event] タブアクティブ検出
document.addEventListener('visibilitychange', function() {
    // /* [LOG_TRACE] */  tracelog();

    isPageVisible = !document.hidden;
    if (isPageVisible) {

        clearWaveData();

        window.updateActiveCanvas(
            A_vals[A_vals.length - 1],
            B_vals[B_vals.length - 1],
            C_vals[C_vals.length - 1],
            D_vals[D_vals.length - 1],
            Angle
        );
    }
});

// ■ アクティブタブ取得
function getActiveTab() {
    // /* [LOG_TRACE] */  tracelog();

    for (let key in G_TabElements) {
        if (G_TabElements[key].classList.contains('active')) {
            return key;
        }
    }
    return null;
}

// ■ アクティブタブ設定
function setActiveTab(mode) {
    // /* [LOG_TRACE] */  tracelog();

    for (let key in G_Canvases) {
        G_Canvases[key].style.display = 'none';
    }

    clearWaveData();

    for (let key in G_TabElements) {
        G_TabElements[key]?.classList.remove('active');
    }

    G_canvasContainer.style.display = 'none';
    G_consoleContainer.style.display = 'none';
    G_settingsView.style.display = 'none';

    const graphOptions = document.getElementById('graphOptions');
    if (graphOptions) {
        // 波形を表示するタブ（all または graph）の時だけ表示する
        if (mode === 'all' || mode === 'graph') {
            graphOptions.style.display = 'flex'; 
        } else {
            // それ以外のタブ（angle, console, settings）では隠す
            graphOptions.style.display = 'none';
        }
    }

    if (mode === 'console') {
        G_consoleContainer.style.display = 'block';
        G_TabElements.console.classList.add('active');
    } 
    else if (mode === 'settings') {
        G_settingsView.style.display = 'block';
        G_TabElements.settings.classList.add('active');
    } 
    else {
        if (G_Canvases[mode]) {
            G_Canvases[mode].style.display = 'block';
            G_TabElements[mode].classList.add('active');
            G_canvasContainer.style.display = 'block';

            updateAllCanvasSizes();
        }
        if (mode === 'all' || mode === 'graph' || mode === 'angle') {
            window.updateActiveCanvas(
                A_vals[A_vals.length - 1],
                B_vals[B_vals.length - 1],
                C_vals[C_vals.length - 1],
                D_vals[D_vals.length - 1],
                Angle
            );
        }
    }
    window.currentMode = mode;
}

// ■ マージン取得
function getResponsiveMargin(canvas) {
    // /* [LOG_TRACE] */  tracelog();
    const width = canvas.width;
    const height = canvas.height;

    return {
        top: Math.max(height * 0.09, 40),
        right: Math.max(width * 0.05, 15),
        bottom: Math.max(height * 0.10, 30),
        left: Math.max(width * 0.12, 30)
    };
}

// ■ Canvasオフスクリーン
function resizeCanvasForHighDPI(canvas, ctx, logicalWidth, logicalHeight) {
    // /* [LOG_TRACE] */  tracelog();
    canvas.width = logicalWidth;
    canvas.height = logicalHeight;
    canvas.style.width = logicalWidth + "px";
    canvas.style.height = logicalHeight + "px";
}

// ■ 仮想Canvas作成
function createOffscreenCanvas(width, height) {
    // /* [LOG_TRACE] */  tracelog();
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    return { canvas, ctx };
}

// ■ データ更新
function updateData(values, newValue) {
    // /* [LOG_TRACE] */  tracelog();
    values.shift();
    values.push(newValue != null ? newValue : 0);
}

// ■ タイトル描画
function drawTitle(canvas, ctx, title = "タイトル", width, height, textColor = COLOR_WHITE, isGraph = false)  {
    // /* [LOG_TRACE] */  tracelog();

    const fontSize = Math.floor(height * 0.045);
    ctx.font = `bold ${fontSize}px ${FONT_FAMILY}`;
    ctx.fillStyle = textColor;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";

    const metrics = ctx.measureText(title);
    const margin = getResponsiveMargin(canvas);

    const xPos = isGraph ? margin.left + (width - margin.left - margin.right) / 2 : width / 2;
    const yPos = fontSize / 2 + metrics.actualBoundingBoxAscent / 2;

    ctx.fillText(title, xPos, yPos);
}

// ■ XY軸描画
function drawAxes(canvas, ctx, lineColor = COLOR_WHITE) {
    // /* [LOG_TRACE] */  tracelog();
    const margin = getResponsiveMargin(canvas);

    ctx.strokeStyle = lineColor;
    ctx.lineWidth = 1;

    // Y軸
    ctx.beginPath();
    ctx.moveTo(margin.left, canvas.height - margin.bottom); 
    ctx.lineTo(margin.left, 0);
    ctx.stroke();

    // X軸
    ctx.beginPath();
    ctx.moveTo(margin.left, canvas.height - margin.bottom);
    ctx.lineTo(canvas.width, canvas.height - margin.bottom);
    ctx.stroke();
}

// ■ XY軸ラベル描画
function drawAxisNameLabels(canvas, ctx, xLabel = "X", yLabel = "Y", textColor = COLOR_WHITE) {
    // /* [LOG_TRACE] */  tracelog();
    const fontSize = Math.floor(canvas.height * 0.035);
    const margin = getResponsiveMargin(canvas);

    // 先にフォントと色を設定する
    ctx.font = `${fontSize}px ${FONT_FAMILY}`;
    ctx.fillStyle = textColor;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";

    // X軸ラベル (グラフエリアの中央に配置)
    const graphCenterX = margin.left + (canvas.width - margin.left - margin.right) / 2;
    ctx.fillText(xLabel, graphCenterX, canvas.height - margin.bottom + fontSize * 1);

    // Y軸ラベル
    ctx.save();
    ctx.translate(margin.left - fontSize * 3.2, canvas.height / 2);
    ctx.rotate(-Math.PI / 2);
    ctx.fillText(yLabel, 0, 0);
    ctx.restore();
}

// ■ Y軸数値ラベル描画
function drawYAxisLabels(canvas, ctx, isDiff = false) {
    const margin = getResponsiveMargin(canvas);
    
    // 電圧モードに応じて分割数と主要目盛りの間隔を変更
    let ySteps, majorTickStep;
    if (VOLTAGE_REF <= 3.3) {
        ySteps = isDiff ? 22 : 11;
        majorTickStep = 1.1;
    } else {
        ySteps = isDiff ? 20 : 10;
        majorTickStep = 1.0;
    }
    
    const graphHeight = canvas.height - margin.top - margin.bottom;
    const fontSize = Math.floor(canvas.height * 0.028);

    const maxV = isDiff ? VOLTAGE_REF : VOLTAGE_REF;
    const minV = isDiff ? -VOLTAGE_REF : 0.0;
    const vRange = maxV - minV;

    ctx.font = `${fontSize}px ${FONT_FAMILY}`;
    ctx.textAlign = "right";
    ctx.textBaseline = "middle";

    for (let idx = 0; idx <= ySteps; idx++) {
        let voltage = maxV - (vRange / ySteps) * idx;
        const y = margin.top + (graphHeight / ySteps) * idx;

        // 浮動小数点の計算誤差対策
        if (Math.abs(voltage) < 0.01) voltage = 0.0;

        // majorTickStep単位のキリの良い数字か判定
        const remainder = Math.abs(voltage % majorTickStep);
        const isMajor = remainder < 0.01 || Math.abs(remainder - majorTickStep) < 0.01;

        // --- 目盛り線（ティックマーク）の描画 ---
        ctx.beginPath();
        ctx.strokeStyle = COLOR_WHITE;
        ctx.lineWidth = isMajor ? 1.5 : 1.0; 
        
        ctx.moveTo(margin.left, y);
        const tickLength = isMajor ? 12 : 6; 
        ctx.lineTo(margin.left + tickLength, y);
        ctx.stroke();

        // --- 数値ラベルの描画 ---
        if (isMajor) {
            ctx.fillStyle = COLOR_WHITE;
            let label = voltage.toFixed(1);
            
            // Differentialでプラスの値には "+" をつける
            if (isDiff && voltage > 0) label = "+" + label;

            ctx.fillText(label, margin.left - 15, y);
        }
    }
}

// ■ 水平グリッド線描画
function drawHorizontalGridLines(canvas, ctx, steps = 10, isDiff = false) {
    if (steps <= 0) return;

    const margin = getResponsiveMargin(canvas);
    const startX = margin.left;
    const endX = canvas.width - margin.right;
    const height = canvas.height - margin.top - margin.bottom;

    // Y軸の目盛り分割数にグリッド線を合わせる
    let drawSteps;
    if (VOLTAGE_REF <= 3.3) {
        drawSteps = isDiff ? 22 : 11;
    } else {
        drawSteps = isDiff ? 20 : 10;
    }

    for (let idx = 0; idx <= drawSteps; idx++) {
        const y = margin.top + (height / drawSteps) * idx + 0.5;

        ctx.beginPath();
        if (isDiff && idx === drawSteps / 2) {
            ctx.strokeStyle = 'rgba(255, 255, 255, 0.6)';
            ctx.lineWidth = 1.0;
        } else {
            ctx.strokeStyle = COLOR_GRID;
            ctx.lineWidth = 0.5;
        }

        ctx.moveTo(startX, y);
        ctx.lineTo(endX, y);
        ctx.stroke();
    }
}

// ■ 垂直グリッド線描画
function drawVerticalLines(canvas, ctx, steps = 10) {
    // /* [LOG_TRACE] */  tracelog();

    if (steps <= 0) return;

    const margin = getResponsiveMargin(canvas);
    const startY = margin.top;
    const endY = canvas.height - margin.bottom;
    const width = canvas.width - margin.left - margin.right;

    ctx.strokeStyle = COLOR_GRID;
    ctx.lineWidth = 0.5;

    for (let idx = 0; idx <= steps; idx++) {
        const x = margin.left + (width / steps) * idx + 0.5;

        ctx.beginPath();
        ctx.moveTo(x, startY);
        ctx.lineTo(x, endY);
        ctx.stroke();
    }
}

// ■ 目盛り線・角度ラベル描画
function drawProtractor(ctx, centerX, centerY, radius, canvas) {
    // /* [LOG_TRACE] */  tracelog();

    const baseSize = Math.min(canvas.width, canvas.height);
    const majorTickLength = baseSize * 0.06;
    const minorTickLength = baseSize * 0.02;
    const labelOffset = baseSize * 0.1;
    const fontSize = Math.floor(baseSize * 0.03);

    ctx.strokeStyle = COLOR_WHITE;
    ctx.fillStyle = COLOR_WHITE;
    ctx.font = `${fontSize}px ${FONT_FAMILY}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    for (let angle = 0; angle < 360; angle += 5) {
        const rad = (angle - 90) * Math.PI / 180;

        const outerX = centerX + radius * Math.cos(rad);
        const outerY = centerY + radius * Math.sin(rad);

        const isMajor = angle % 30 === 0;
        const tickLength = isMajor ? majorTickLength : minorTickLength;

        const innerX = centerX + (radius - tickLength) * Math.cos(rad);
        const innerY = centerY + (radius - tickLength) * Math.sin(rad);

        ctx.beginPath();
        ctx.moveTo(innerX, innerY);
        ctx.lineTo(outerX, outerY);
        ctx.stroke();

        if (isMajor) {
            const labelRadius = radius - labelOffset;
            const labelX = centerX + labelRadius * Math.cos(rad);
            const labelY = centerY + labelRadius * Math.sin(rad);
            ctx.fillText(`${angle}°`, labelX, labelY);
        }
    }
}

// ■ 波形描画
function drawWave(canvas, ctx, vals, color, isDiff = false) {
    // /* [LOG_TRACE] */  tracelog();

    if (vals.length <= 1) return;

    const margin = getResponsiveMargin(canvas);
    const graphWidth = canvas.width - margin.left - margin.right;
    const graphHeight = canvas.height - margin.top - margin.bottom;
    const xSpacing = graphWidth / (vals.length - 1);

    // 固定値を Y_MAX に変更
    const minVal = isDiff ? -Y_MAX : DRAW_Y_MIN;
    const maxVal = isDiff ?  Y_MAX : DRAW_Y_MAX;
    const valRange = maxVal - minVal;

    ctx.beginPath();
    for (let idx = 0; idx < vals.length; idx++) {
        const val = vals[idx];

        const x = margin.left + idx * xSpacing;
        const y = margin.top + (1 - (val - minVal) / valRange) * graphHeight;

        if (idx === 0) {
            ctx.moveTo(x, y);
        } 
        else 
        {
            ctx.lineTo(x, y);
        }
    }
    ctx.strokeStyle = color;
    ctx.lineWidth = 3;
    ctx.stroke();
}

// ■ 凡例（レジェンド）描画
function drawLegend(canvas, ctx, isDiff = false) {
    // /* [LOG_TRACE] */  tracelog();
    const margin = getResponsiveMargin(canvas);
    
    const fontSize = Math.floor(canvas.height * 0.025); 
    ctx.font = `${fontSize}px ${FONT_FAMILY}`;
    ctx.textAlign = "left";
    ctx.textBaseline = "middle";

    const startX = canvas.width - margin.right - 65; 
    let y = margin.top + 15;

    // チェックボックスの状態を取得
    const isSinOn  = G_Checkboxes.sin?.checked;
    const isCosOn  = G_Checkboxes.cos?.checked;
    const isSinNOn = G_Checkboxes.sinN?.checked;
    const isCosNOn = G_Checkboxes.cosN?.checked;

    // 差動(isDiff=true)の場合は、正相・逆相の「どちらか」がONならカウントする
    const itemsCount = isDiff ? 
        ((isSinOn || isSinNOn ? 1 : 0) + (isCosOn || isCosNOn ? 1 : 0)) :
        ((isSinOn ? 1 : 0) + (isCosOn ? 1 : 0) + (isSinNOn ? 1 : 0) + (isCosNOn ? 1 : 0));
    
    if (itemsCount > 0) {
        const boxWidth = 100;
        const boxHeight = (fontSize * 1.5) * itemsCount + 10;
        ctx.fillStyle = 'rgba(24, 26, 32, 0.75)';
        ctx.fillRect(startX - 45, y - 15, boxWidth, boxHeight);
    }

    const drawItem = (label, color, isDashed) => {
        ctx.beginPath();
        ctx.strokeStyle = color;
        ctx.lineWidth = 2.5; 
        if (isDashed) ctx.setLineDash([4, 4]);
        else ctx.setLineDash([]);
        
        ctx.moveTo(startX - 35, y);
        ctx.lineTo(startX - 10, y);
        ctx.stroke();
        
        ctx.fillStyle = COLOR_WHITE;
        ctx.fillText(label, startX, y);
        y += fontSize * 1.5;
    };

    if (isDiff) {
        // VSin, VCos はどちらかがONなら表示する
        if (isSinOn || isSinNOn) drawItem("VSin", COLOR_SIN, false);
        if (isCosOn || isCosNOn) drawItem("VCos", COLOR_COS, false);
    } else {
        if (isSinOn) drawItem("Sin", COLOR_SIN, false);
        if (isCosOn) drawItem("Cos", COLOR_COS, false);
        if (isSinNOn) drawItem("SinN", COLOR_SINN, true);
        if (isCosNOn) drawItem("CosN", COLOR_COSN, true);
    }
    
    ctx.setLineDash([]); // 点線設定をリセット
}

// ■ 角度描画
function drawAngle(canvas, ctx, width, height, angle) {
    // /* [LOG_TRACE] */  tracelog();

    angle = angle % 360;
    if (angle < 0) angle += 360;

    const baseSize = Math.min(width, height);
    const padding = baseSize * 0.05;
    const labelOffset = baseSize * 0.08;
    const centerX = width / 2;
    const centerY = height / 2;
    const radius = Math.min(centerX, centerY) - padding - labelOffset;

    const angleLineWidth = baseSize * 0.01;
    const arcLineWidth = baseSize * 0.012;
    const fontSize = Math.floor(height * 0.05);

    // ctx.clearRect(0, 0, width, height);

    // 円（外枠）
    ctx.beginPath();
    ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
    ctx.lineWidth = arcLineWidth;
    ctx.strokeStyle = COLOR_BLACK;
    ctx.stroke();

    // 針の根元にピボット（中心の丸）を描画
    ctx.beginPath();
    ctx.arc(centerX, centerY, baseSize * 0.018, 0, Math.PI * 2);
    ctx.fillStyle = COLOR_RED;
    ctx.fill();

    // 分度器（目盛りと角度ラベル）
    drawProtractor(ctx, centerX, centerY, radius, canvas);

    // 角度線
    const angleRad = (angle - 90) * Math.PI / 180;
    const endX = centerX + radius * Math.cos(angleRad);
    const endY = centerY + radius * Math.sin(angleRad);

    ctx.beginPath();
    ctx.moveTo(centerX, centerY);
    ctx.lineTo(endX, endY);
    ctx.lineWidth = angleLineWidth;
    ctx.strokeStyle = COLOR_RED;
    ctx.stroke();

    // 角度ラベル
    ctx.font = `bold ${fontSize}px ${FONT_FAMILY}`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.lineWidth = 1.5;
    ctx.strokeStyle = COLOR_WHITE;
    ctx.fillStyle = COLOR_WHITE;
    const angleLabelY = centerY + radius + labelOffset + 10;
    ctx.strokeText(`${Math.floor(angle)}°`, centerX, angleLabelY);
    ctx.fillText(`${Math.floor(angle)}°`, centerX, angleLabelY);
}

// ■ 波形データクリア
window.clearWaveData = function clearWaveData() {
    // /* [LOG_TRACE] */  tracelog();

    A_vals.fill(0);
    B_vals.fill(0);
    C_vals.fill(0);
    D_vals.fill(0);
    Angle = 0;
}

// ■ アクティブなタブに応じて描画を更新
window.updateActiveCanvas = function updateActiveCanvas(A_val, B_val, C_val, D_val, angle) {
    // /* [LOG_TRACE] */  tracelog();

    const activeTab = getActiveTab();
    if (!activeTab) return;

    if (activeTab === 'all') {
        updateWaveAndAngle(A_val, B_val, C_val, D_val, angle);
    } 
    else if (activeTab === 'graph') {
        updateGraph(A_val, B_val, C_val, D_val);
    } 
    else if (activeTab === 'angle') {
        updateAngle(angle);
    }
}

// ■ 波形描画更新 (Graphタブ: 差動信号用)
window.updateGraph = function updateGraph(A_val, B_val, C_val, D_val) {
    // /* [LOG_TRACE] */  tracelog();

    if (!isPageVisible) return;

    // 履歴データの更新
    updateData(A_vals, A_val);
    updateData(B_vals, B_val);
    updateData(C_vals, C_val);
    updateData(D_vals, D_val);

    // チェックボックスの状態を取得
    const isSinOn  = G_Checkboxes.sin?.checked;
    const isCosOn  = G_Checkboxes.cos?.checked;
    const isSinNOn = G_Checkboxes.sinN?.checked;
    const isCosNOn = G_Checkboxes.cosN?.checked;

    // 差動信号の計算（OFFになっている要素は 0 として扱う）
    const VSin_vals = B_vals.map((sinVal, i) => {
        const s  = isSinOn  ? sinVal : 0;
        const sn = isSinNOn ? D_vals[i] : 0;
        return s - sn; // (Sin) - (SinN)
    });

    const VCos_vals = A_vals.map((cosVal, i) => {
        const c  = isCosOn  ? cosVal : 0;
        const cn = isCosNOn ? C_vals[i] : 0;
        return c - cn; // (Cos) - (CosN)
    });

    const canvas = G_Canvases.graph;
    const ctx = G_Contexts.graph;
    const offCanvas = G_OffscreenCanvases.graph;
    const offCtx = G_OffscreenContexts.graph;

    if (canvas.style.display === 'none' && getActiveTab() === 'graph')
        canvas.style.display = 'block';

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    offCtx.clearRect(0, 0, offCanvas.width, offCanvas.height);

    drawTitle(offCanvas, offCtx, 'Differential Signal (VSin, VCos)', offCanvas.width, offCanvas.height, COLOR_WHITE, true);
    drawAxes(offCanvas, offCtx);
    
    drawYAxisLabels(offCanvas, offCtx, true); 
    drawAxisNameLabels(offCanvas, offCtx, "Time →", "Voltage (V)", COLOR_WHITE);
    drawHorizontalGridLines(offCanvas, offCtx, 10, true);
    drawVerticalLines(offCanvas, offCtx);

    // 正相・逆相の「どちらか」がONであれば波形を描画する
    if (isSinOn || isSinNOn)  drawWave(offCanvas, offCtx, VSin_vals, COLOR_SIN, true);
    if (isCosOn || isCosNOn)  drawWave(offCanvas, offCtx, VCos_vals, COLOR_COS, true);
    
    drawLegend(offCanvas, offCtx, true);

    ctx.drawImage(offCanvas, 0, 0);
};

// ■ 角度描画更新
window.updateAngle = function updateAngle(angle) {
    // /* [LOG_TRACE] */  tracelog();

    if (!isPageVisible) return;

    Angle = angle;

    const canvas = G_Canvases.angle;
    const ctx = G_Contexts.angle;
    const offCanvas = G_OffscreenCanvases.angle;
    const offCtx = G_OffscreenContexts.angle;

    if (canvas.style.display === 'none' && getActiveTab() === 'angle')
        canvas.style.display = 'block';

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    offCtx.clearRect(0, 0, offCanvas.width, offCanvas.height);;

    drawTitle(offCanvas, offCtx, 'Angle', offCanvas.width, offCanvas.height);
    drawAngle(offCanvas, offCtx, offCanvas.width, offCanvas.height, angle);

    ctx.drawImage(offCanvas, 0, 0);
};

// ■ 波形＆角度描画更新
window.updateWaveAndAngle = function updateWaveAndAngle(A_val, B_val, C_val, D_val, angle) {
    // /* [LOG_TRACE] */  tracelog();

    if (!isPageVisible) return;

    updateData(A_vals, A_val);
    updateData(B_vals, B_val);
    updateData(C_vals, C_val);
    updateData(D_vals, D_val);
    Angle = angle;

    const canvas = G_Canvases.all;
    const ctx = G_Contexts.all;
    const leftCanvas = G_OffscreenCanvases.allLeft;
    const rightCanvas = G_OffscreenCanvases.allRight;
    const leftCtx = G_OffscreenContexts.allLeft;
    const rightCtx = G_OffscreenContexts.allRight;

    let leftWidth = leftCanvas.width;
    let rightWidth = rightCanvas.width;

    if (canvas.style.display === 'none' && getActiveTab() === 'all')
        canvas.style.display = 'block';

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    leftCtx.clearRect(0, 0, leftCanvas.width, leftCanvas.height);
    rightCtx.clearRect(0, 0, rightCanvas.width, rightCanvas.height);

    drawTitle(leftCanvas, leftCtx, 'Single-ended Signal (sin, cos, sinN, cosN)', leftWidth, canvas.height, COLOR_WHITE, true);
    drawAxes(leftCanvas, leftCtx);
    drawYAxisLabels(leftCanvas, leftCtx);
    drawAxisNameLabels(leftCanvas, leftCtx, "Time →", "Voltage (V)", COLOR_WHITE);
    drawHorizontalGridLines(leftCanvas, leftCtx);
    drawVerticalLines(leftCanvas, leftCtx);

    if (G_Checkboxes.cos?.checked)   drawWave(leftCanvas, leftCtx, A_vals, COLOR_COS);
    if (G_Checkboxes.sin?.checked)   drawWave(leftCanvas, leftCtx, B_vals, COLOR_SIN);
    leftCtx.setLineDash([5, 5]);
    if (G_Checkboxes.cosN?.checked)  drawWave(leftCanvas, leftCtx, C_vals, COLOR_COSN);
    if (G_Checkboxes.sinN?.checked)  drawWave(leftCanvas, leftCtx, D_vals, COLOR_SINN);
    leftCtx.setLineDash([]);
    drawLegend(leftCanvas, leftCtx, false);

    ctx.drawImage(leftCanvas, 0, 0);

    drawTitle(rightCanvas, rightCtx, 'Angle', rightWidth, canvas.height);
    drawAngle(rightCanvas, rightCtx, rightWidth, canvas.height, angle);
    ctx.drawImage(rightCanvas, leftWidth, 0);
}
