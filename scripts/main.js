import { ChmBrowser } from "./chm-browser.js";

// 实例化
const chmBrowser = new ChmBrowser();

// 智能开关函数：如果已打开则置顶，否则渲染
const toggleBrowser = () => {
    if (chmBrowser.rendered) {
        chmBrowser.bringToFront();
    } else {
        chmBrowser.render({ force: true });
    }
};

// 注册快捷键 Alt + B
Hooks.once('init', () => {
    game.keybindings.register('5e-chm-in-fvtt', 'openBrowser', {
        name: '打开5e不全书',
        hint: '按下快捷键直接打开窗口',
        editable: [ { key: "KeyB", modifiers: ["Alt"] } ],
        onDown: toggleBrowser,
        restricted: false,
        precedence: CONST.KEYBINDING_PRECEDENCE.NORMAL
    });
});

// 添加到左侧笔记栏
Hooks.on("getSceneControlButtons", (controls) => {
    // 适配 V14: controls 可能变为对象而不是数组
    let noteLayer;
    if (Array.isArray(controls)) {
        noteLayer = controls.find(c => c.name === "notes");
    } else if (typeof controls === "object") {
         // V14 早期开发版可能将 controls 更改为对象结构
        noteLayer = controls.notes;
    }

    if (noteLayer) {
        if (!noteLayer.tools) noteLayer.tools = []; // 确保 tools 数组存在
        
        // 防止重复添加
        if (!noteLayer.tools.some(t => t.name === "open-5e-chm")) {
            noteLayer.tools.push({
                name: "open-5e-chm",
                title: "5e不全书",
                icon: "fas fa-book-atlas",
                visible: true,
                onClick: toggleBrowser,
                button: true
            });
        }
    } else {
        console.warn("5e-chm-in-fvtt | Could not find 'notes' layer in controls", controls);
    }
});

// 添加到右侧日志栏
Hooks.on("renderJournalDirectory", (app, html, data) => {
    // 兼容 jQuery 和原生 DOM (V13/V14 可能移除 jQuery)
    // 如果 html 是 jQuery 对象，取第一个元素；如果 是 HTMLElement，直接使用
    const element = (html.jquery) ? html[0] : html;

    const actionButtons = element.querySelector(".header-actions");
    if (!actionButtons) return;

    // 创建按钮
    const button = document.createElement("button");
    button.className = "create-entry";
    button.style.minWidth = "96px";
    button.style.flex = "0";
    button.innerHTML = `<i class="fas fa-book-atlas"></i> 5e不全书`;
    
    // 绑定点击事件
    button.addEventListener("click", (ev) => {
        ev.preventDefault();
        chmBrowser.render({ force: true });
    });

    // 插入按钮 (prepend)
    actionButtons.prepend(button);
});

console.log("5e不全书FVTT部署版已上线 (Main V3)");
