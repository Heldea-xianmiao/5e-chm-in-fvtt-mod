/**
 * 5e-chm-in-fvtt Cloud Bridge Script
 * 
 * 使用说明 / Instructions:
 * 1. 将此文件上传到您的云端数据源（与 HTML 文件同源）。
 *    Upload this file to your cloud storage (same origin as HTML files).
 * 
 * 2. 在您的 CHM 导出模板或 HTML 文件中引入此脚本。
 *    Include this script in your CHM export template or HTML files.
 *    <script src="path/to/cloud-bridge.js"></script>
 * 
 * 功能：
 * 监听 Alt + 选区释放事件，并通过 postMessage 将数据发送回 Foundry VTT 父窗口。
 */

(function() {
    // 防止重复绑定
    if (window._chmCloudBound) return;
    window._chmCloudBound = true;

    console.log("5e-chm-cloud-bridge | Initialized");

    // 监听鼠标释放事件
    window.addEventListener("mouseup", (ev) => {
        // 检测 Alt 或 Ctrl 键
        const isAlt = ev.altKey;
        const isCtrl = ev.ctrlKey;

        // 如果没有按下修饰键，或者不是左键点击，忽略
        if ((!isAlt && !isCtrl) || ev.button !== 0) return;

        // 获取选区
        const sel = window.getSelection();
        if (!sel || sel.isCollapsed) return;

        const text = sel.toString();
        if (!text) return;

        // 获取 HTML 内容
        let html = "";
        try {
            if (sel.rangeCount > 0) {
                const container = document.createElement("div");
                for (let i = 0; i < sel.rangeCount; i++) {
                    container.appendChild(sel.getRangeAt(i).cloneContents());
                }
                html = container.innerHTML;
            }
        } catch (e) {
            console.error("5e-chm-cloud-bridge | Error getting selection HTML:", e);
        }

        console.log("5e-chm-cloud-bridge | Sending quote:", text.substring(0, 20) + "...");

        // 发送消息给父窗口 (Foundry VTT)
        window.parent.postMessage({
            type: '5echm:quote',
            text: text,
            html: html,
            title: document.title || "Unknown Page"
        }, "*");
    });

    // 可选：监听标题变化并同步（如果是单页应用或有特定逻辑）
    // 大部分静态 HTML 页面跳转会刷新 iframe，此脚本会重新加载，所以通常不需要额外的 Observer
})();
