const { ApplicationV2 } = foundry.applications.api;

/**
 * 定义嵌入浏览器的窗口类 (ApplicationV2)
 */
export class ChmBrowser extends ApplicationV2 {
    static DEFAULT_OPTIONS = {
        id: "chm-browser-window",
        tag: "div",
        classes: ["chm-browser-app"],
        window: {
            title: "5e不全书 (fvtt版)",
            resizable: true,
            minimizable: true,
            icon: "fas fa-book-atlas"
        },
        position: {
            width: 1000,
            height: 800
        }
    };

    // 记录最后访问的页面地址
    lastSrc = "modules/5e-chm-in-fvtt/chm/index.html";

    constructor(options) {
        super(options);
        this._onMessage = this._onMessage.bind(this);
    }

    // 处理跨域消息
    _onMessage(event) {
        if (!event.data || typeof event.data !== 'object') return;
        
        const msg = event.data;
        const type = msg.type;

        // 1. 处理引用请求 (Cloud Mode & Local Mode with Bridge)
        if (type === '5echm:quote') {
            this._handleSelectionCompat(msg.html, msg.text, msg.title);
        }
        
        // 2. 处理导航更新 (Cloud Mode)
        if (type === '5echm:nav') {
            if (this.window && this.window.title && msg.title) {
                this.window.title.innerText = `5e不全书 - ${msg.title}`;
            }
        }
    }

    // 防抖变量
    _lastQuoteTime = 0;
    _lastQuoteText = "";

    /**
     * 统一处理引用逻辑 (Chat Output)
     */
    _handleSelectionCompat(htmlPart, textPart, docTitle) {
        if (!htmlPart && !textPart) return;
        
        // 防抖 logic: 防止本地模式下 CloudBridge 和 Native Listener 同时触发
        const now = Date.now();
        if (this._lastQuoteText === textPart && (now - this._lastQuoteTime < 1000)) {
            // console.log("5e-chm | Duplicate quote ignored.");
            return;
        }
        this._lastQuoteTime = now;
        this._lastQuoteText = textPart;
        
        const finalHtml = htmlPart || textPart.replace(/\n/g, "<br>");
        
        console.log(`5e-chm | Receive Quote: "${textPart.substring(0, 20)}..."`);
        ChatMessage.create({
            content: `<h3>5e不全书引用</h3><div class="chm-quote" style="background: rgba(0,0,0,0.05); padding: 5px; border-left: 3px solid #666; margin-bottom: 5px; overflow-x: auto; max-width: 100%;">${finalHtml}</div><p style="font-size: 0.8em; color: #666; text-align: right;">— ${docTitle}</p>`
        });
        if (ui.notifications) ui.notifications.info("已引用到聊天栏");
    }

    async close(options) {
        window.removeEventListener("message", this._onMessage);
        return super.close(options);
    }

    /**
     * 渲染 HTML 内容
     */
    async _renderHTML(context, options) {
        // 注册监听器 (去重)
        window.removeEventListener("message", this._onMessage);
        window.addEventListener("message", this._onMessage);

        // 读取配置：判断是本地还是云端
        const settingUrl = game.settings.get("5e-chm-in-fvtt", "sourceUrl");
        let targetSrc = "";
        let isRemote = false;

        if (settingUrl && (settingUrl.startsWith("http://") || settingUrl.startsWith("https://"))) {
            targetSrc = settingUrl;
            isRemote = true;
            if (this.window && this.window.title) this.window.title.innerText = "5e不全书 (云端版)";
        } else {
            // 本地 fallback
            targetSrc = this.lastSrc || "modules/5e-chm-in-fvtt/chm/index.html";
            targetSrc = foundry.utils.getRoute ? foundry.utils.getRoute(targetSrc) : targetSrc;
        }

        const wrapper = document.createElement("div");
        wrapper.classList.add("chm-browser-wrapper");

        const iframe = document.createElement("iframe");
        iframe.src = targetSrc;
        iframe.classList.add("chm-browser-iframe");
        iframe.allow = "clipboard-write";

        // 本地模式监听逻辑 (iframe.onload)
        // 如果是云端模式，onload 里面访问 contentWindow.document 会报错，需要 try-catch 跳过
        iframe.onload = () => {
             // 1. 如果是 Remote 模式，我们依赖 PostMessage，这里做不了太多事情
             if (isRemote) {
                 // console.log("5e-chm | Remote mode loaded. Waiting for postMessage bridge...");
                 return;
             }

            // 2. 本地模式逻辑 (直接 DOM 操作)
            const onMouseUp = (ev) => {
                const win = ev.view;
                let selectionText = "";
                let selectionHtml = "";
                
                try {
                     const sel = win.getSelection();
                     if (sel) {
                         selectionText = sel.toString();
                         if (sel.rangeCount > 0) {
                             const container = win.document.createElement("div");
                             for (let i = 0; i < sel.rangeCount; i++) {
                                 container.appendChild(sel.getRangeAt(i).cloneContents());
                             }
                             selectionHtml = container.innerHTML;
                         }
                     }
                } catch(e) {}
                
                // V14/Keybind Check
                const isAlt = ev.altKey || (game.keyboard?.isModifierActive(KeyboardManager.MODIFIER_KEYS.ALT));
                const isCtrl = ev.ctrlKey || (game.keyboard?.isModifierActive(KeyboardManager.MODIFIER_KEYS.CONTROL));
                
                if ((isAlt || isCtrl) && (selectionHtml || selectionText)) {
                    this._handleSelectionCompat(selectionHtml, selectionText, win.document.title);
                }
            };

            const bindDoc = (win) => {
                try {
                    if (!win || !win.document) return false;
                    if (win._chmBound) return true;

                    win.addEventListener("mouseup", onMouseUp, true);
                    win._chmBound = true;
                    
                    if (win.document && this.window && this.window.title) {
                        this.window.title.innerText = `5e不全书 - ${win.document.title}`;
                    }

                    // 本地路径修复逻辑 (Remote模式下通常不需要，或者由服务器配置决定)
                    win.document.addEventListener('click', async (e) => {
                        const link = e.target.closest('a');
                        if (!link) return;
                        const href = link.getAttribute('href');
                        if (!href || href.startsWith('#') || href.startsWith('javascript:') || href.match(/^[a-z]+:\/\//)) return;

                        if (!win.location.href.includes('/topics/') || win.location.href.endsWith('/topics/')) return;

                        e.preventDefault();
                        e.stopPropagation();

                        const currentUrl = win.location.href;
                        // WinCHM 导出的链接中 # 被编码为 %23，需要还原为 # 以正确分离路径和锚点
                        const cleanedHref = href.replace(/%23/gi, '#');
                        const defaultResolution = new URL(cleanedHref, currentUrl).href;
                        
                        // 简单的本地检查逻辑
                         try {
                                const res = await fetch(defaultResolution, { method: 'HEAD' });
                                if (res.ok) win.location.href = defaultResolution;
                                else {
                                     // Rooted fallback
                                    const topicsIndex = currentUrl.indexOf('/topics/');
                                    const rootBase = currentUrl.substring(0, topicsIndex + '/topics/'.length);
                                    const rootedResolution = new URL(cleanedHref, rootBase).href;
                                    win.location.href = rootedResolution;
                                }
                        } catch { 
                             win.location.href = defaultResolution; 
                        }
                    }, true); 

                    return true;
                } catch (err) {
                    // console.log("5e-chm | Cross-origin access denied (Expected for Cloud Mode)");
                    return false;
                }
            };

            const attachListeners = () => {
                try {
                    const topWin = iframe.contentWindow;
                    if (!topWin) return;
                    // Try recursive frame access (Main/Content frames structure of some CHM exports)
                     try {
                        const mainWin = topWin.frames["main"];
                        if (mainWin) {
                             const contentWin = mainWin.frames["content"];
                             if (contentWin) bindDoc(contentWin);
                             else bindDoc(mainWin);
                        } else {
                            bindDoc(topWin);
                        }
                     } catch(e) { 
                         // Fallback for single frame or cross origin
                     }
                } catch (err) {}
            };
            
            if (this._pollInterval) clearInterval(this._pollInterval);
            this._pollInterval = setInterval(attachListeners, 1000);
        };

        wrapper.appendChild(iframe);
        return wrapper;
    }

    _replaceHTML(result, content, options) {
        content.replaceChildren(result);
    }
}
