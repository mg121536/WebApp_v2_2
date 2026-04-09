// resize.js

// ■ ビューポートサイズを取得（iPad Safari 対応）
function getViewportSize() {
    if (window.visualViewport) {
        return {
            width: window.visualViewport.width,
            height: window.visualViewport.height
        };
    } else {
        return {
            width: window.innerWidth,
            height: window.innerHeight
        };
    }
}

// ■ 指定Canvasをリサイズ
function resizeCanvas(canvas) {
    const dpr = window.devicePixelRatio || 1;

    // 実際の表示サイズに合わせる
    const displayWidth = Math.round(canvas.clientWidth * dpr);
    const displayHeight = Math.round(canvas.clientHeight * dpr);

    const needResize = canvas.width !== displayWidth || canvas.height !== displayHeight;
    if (needResize) {
        canvas.width = displayWidth;
        canvas.height = displayHeight;

        // 高 DPI 描画対応
        const ctx = canvas.getContext('2d');
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }
    return needResize;
}

// ■ アクティブタブのキャンバスをリサイズ・再描画
function resizeAndRedrawActiveCanvas() {
    const activeTab = document.querySelector('#canvasTabs .active')?.id.replace('tab_', '');
    if (!activeTab) return;

    // アクティブなタブに対応するキャンバスを取得
    const canvas = document.getElementById(`canvas${activeTab.charAt(0).toUpperCase()}${activeTab.slice(1)}`);
    if (!canvas) return;

    // キャンバスがリサイズされたか確認
    const resized = resizeCanvas(canvas);

    if (resized && window.updateActiveCanvas) {
        const lastA = window.A_vals?.[window.A_vals.length - 1] ?? 0;
        const lastB = window.B_vals?.[window.B_vals.length - 1] ?? 0;
        const lastC = window.C_vals?.[window.C_vals.length - 1] ?? 0;
        const lastD = window.D_vals?.[window.D_vals.length - 1] ?? 0;
        const angle = window.Angle ?? 0;

        requestAnimationFrame(() => {
            window.updateActiveCanvas(lastA, lastB, lastC, lastD, angle);
        });
    }
}

// ■ Canvasグループの高さを調整
function adjustCanvasHeight() {
  const canvasGroup = document.querySelector('.canvas-group');
    if (!canvasGroup) return;

    const headerHeight = document.querySelector('header')?.offsetHeight || 0;
    const tabHeight = document.getElementById('canvasTabs')?.offsetHeight || 0;
    const controlsHeight = document.getElementById('controls')?.offsetHeight || 0;

    const viewportHeight = window.visualViewport?.height || window.innerHeight;

    canvasGroup.style.height = `${viewportHeight - (headerHeight + tabHeight + controlsHeight)}px`;
}

// ■ イベントリスナー登録
window.addEventListener('load', () => {
    adjustCanvasHeight();
    resizeAndRedrawActiveCanvas();
});

window.addEventListener('resize', () => {
    adjustCanvasHeight();
    resizeAndRedrawActiveCanvas();
});
