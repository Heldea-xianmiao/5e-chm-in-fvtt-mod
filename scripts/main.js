import { ChmBrowser } from "./chm-browser.js";

// 瀹炰緥鍖?
const chmBrowser = new ChmBrowser();

// 鏅鸿兘寮€鍏冲嚱鏁帮細濡傛灉宸叉墦寮€鍒欑疆椤讹紝鍚﹀垯娓叉煋
const toggleBrowser = () => {
    if (chmBrowser.rendered) {
        chmBrowser.bringToFront();
    } else {
        chmBrowser.render({ force: true });
    }
};

// 娉ㄥ唽蹇嵎閿?Alt + B
Hooks.once('init', () => {
    game.keybindings.register('5e-chm-in-fvtt', 'openBrowser', {
        name: '鎵撳紑5e涓嶅叏涔?,
        hint: '鎸変笅蹇嵎閿洿鎺ユ墦寮€绐楀彛',
        editable: [ { key: "KeyB", modifiers: ["Alt"] } ],
        onDown: toggleBrowser,
        restricted: false,
        precedence: CONST.KEYBINDING_PRECEDENCE.NORMAL
    });
});

// 娣诲姞鍒板乏渚х瑪璁版爮
Hooks.on("getSceneControlButtons", (controls) => {
    // 閫傞厤 V14: controls 鍙兘鍙樹负瀵硅薄鑰屼笉鏄暟缁?
    let noteLayer;
    if (Array.isArray(controls)) {
        noteLayer = controls.find(c => c.name === "notes");
    } else if (typeof controls === "object") {
         // V14 鏃╂湡寮€鍙戠増鍙兘灏?controls 鏇存敼涓哄璞＄粨鏋?
        noteLayer = controls.notes;
    }

    if (noteLayer) {
        if (!noteLayer.tools) noteLayer.tools = []; // 纭繚 tools 鏁扮粍瀛樺湪
        
        // 闃叉閲嶅娣诲姞
        if (!noteLayer.tools.some(t => t.name === "open-5e-chm")) {
            noteLayer.tools.push({
                name: "open-5e-chm",
                title: "5e涓嶅叏涔?,
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

// 娣诲姞鍒板彸渚ф棩蹇楁爮
Hooks.on("renderJournalDirectory", (app, html, data) => {
    // 鍏煎 jQuery 鍜屽師鐢?DOM (V13/V14 鍙兘绉婚櫎 jQuery)
    // 濡傛灉 html 鏄?jQuery 瀵硅薄锛屽彇绗竴涓厓绱狅紱濡傛灉鏄?HTMLElement锛岀洿鎺ヤ娇鐢?
    const element = (html.jquery) ? html[0] : html;

    const actionButtons = element.querySelector(".header-actions");
    if (!actionButtons) return;

    // 鍒涘缓鎸夐挳
    const button = document.createElement("button");
    button.className = "create-entry";
    button.style.minWidth = "96px";
    button.style.flex = "0";
    button.innerHTML = <i class="fas fa-book-atlas"></i> 5e涓嶅叏涔;
    
    // 缁戝畾鐐瑰嚮浜嬩欢
    button.addEventListener("click", (ev) => {
        ev.preventDefault();
        chmBrowser.render({ force: true });
    });

    // 鎻掑叆鎸夐挳 (prepend)
    actionButtons.prepend(button);
});

console.log("5e涓嶅叏涔VTT閮ㄧ讲鐗堝凡涓婄嚎");
