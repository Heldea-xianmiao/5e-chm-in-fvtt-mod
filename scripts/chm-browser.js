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
            title: "5e不全书 (本地版)",
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

    /**
     * 渲染 HTML 内容
     * @param {ApplicationRenderContext} context
     * @param {RenderOptions} options
     * @returns {Promise<HTMLElement>}
     */
    async _renderHTML(context, options) {
        // 读取云端配置
        const cloudUrl = game.settings.get('5e-chm-in-fvtt', 'cloudUrl');
        
        // 使用记忆的路径 (this.lastSrc) 
        // 如果 lastSrc 还是默认的本地路径，且配置了云端路径，则替换为云端路径
        let targetPath = this.lastSrc || "modules/5e-chm-in-fvtt/chm/index.html"; 
        
        if (cloudUrl && cloudUrl.startsWith("http") && targetPath.includes("modules/5e-chm-in-fvtt/chm/index.html")) {
            targetPath = cloudUrl;
            this.lastSrc = cloudUrl; // 更新记忆
        }

        const localUrl = targetPath.startsWith("http") ? targetPath : (foundry.utils.getRoute ? foundry.utils.getRoute(targetPath) : targetPath);

        const wrapper = document.createElement("div");
        wrapper.classList.add("chm-browser-wrapper");

        const iframe = document.createElement("iframe");
        iframe.src = localUrl;
        iframe.classList.add("chm-browser-iframe");
        iframe.allow = "clipboard-write";

        // -------------------------------------------------------------
        // 1. Cloud Bridge Mode (If loaded from Cloud/GitHub Pages)
        // -------------------------------------------------------------
        // Always listen for messages, regardless of load state
        const messageHandler = (event) => {
             // Verify origin if needed, or check message structure
             const data = event.data;
             if (!data || typeof data.type !== 'string' || !data.type.startsWith('5echm:')) return;
             
             const msgType = data.type.replace('5echm:', '');
             // console.log("5e-chm | Received Cloud Message:", msgType, data);

             // Handle Navigation (Title Update / History)
             if (msgType === 'nav') {
                 if (data.title && this.window && this.window.title) {
                     this.window.title.innerText = `5e不全书 - ${data.title}`;
                 }
                 // Update lastSrc purely for restoring next time
                 if (data.href) {
                      // Optionally save state
                 }
             }
             
             // Handle Quote (Alt+Click selection from bridge)
             if (msgType === 'quote') {
                 const selectionHtml = data.html || data.text.replace(/\n/g, "<br>");
                 const docTitle = data.title || "5e不全书";
                 
                 ChatMessage.create({
                    content: `<h3>5e不全书引用</h3><div class="chm-quote" style="background: rgba(0,0,0,0.05); padding: 5px; border-left: 3px solid #666; margin-bottom: 5px; overflow-x: auto; max-width: 100%;">${selectionHtml}</div><p style="font-size: 0.8em; color: #666; text-align: right;">—— ${docTitle}</p>`
                });
                if (ui.notifications) ui.notifications.info("已引用到聊天栏");
             }
        };

        // Remove old listener to prevent duplicates if re-rendering within same session (though unlikely for ApplicationV2 in this way)
        window.removeEventListener('message', this._boundMessageHandler); 
        this._boundMessageHandler = messageHandler;
        window.addEventListener('message', this._boundMessageHandler);

        // 监听 iframe 加载完成事件
        iframe.onload = () => {
             // console.log("5e-chm | Iframe Wrapper Loaded (onload fired)");

             /* Removed redundant message listener setup inside onload */

             // -------------------------------------------------------------
             // 2. Local Mode (Same Origin)
             // -------------------------------------------------------------
             // If local, we can access contentWindow. We keep the old logic for backward compatibility
             // or for local files that haven't been "bridged" yet.
             
            const onMouseUp = (ev) => {
                const win = ev.view;
                let selectionText = "";
                let selectionHtml = "";
                
                try {
                     const sel = win.getSelection();
                     if (sel) {
                         selectionText = sel.toString();
                         
                         // 提取带标签的 HTML 用于保持分段和格式
                         if (sel.rangeCount > 0) {
                             const container = win.document.createElement("div");
                             for (let i = 0; i < sel.rangeCount; i++) {
                                 container.appendChild(sel.getRangeAt(i).cloneContents());
                             }
                             selectionHtml = container.innerHTML;
                         }
                     }
                } catch(e) {}
                
                // Fallback: 如果 HTML 提取失败，使用纯文本
                if (!selectionHtml && selectionText) selectionHtml = selectionText.replace(/\n/g, "<br>");

                // V14 兼容性增强：检测按键
                const isAlt = ev.altKey || (game.keyboard && game.keyboard.isModifierActive && game.keyboard.isModifierActive(KeyboardManager.MODIFIER_KEYS.ALT));
                const isCtrl = ev.ctrlKey || (game.keyboard && game.keyboard.isModifierActive && game.keyboard.isModifierActive(KeyboardManager.MODIFIER_KEYS.CONTROL));
                
                console.log(`5e-chm | MouseUp Detected. Select: "${selectionText.substring(0, 20)}..." | Alt: ${isAlt} | Ctrl: ${isCtrl} | CapturePhase`);
                
                if (selectionHtml && (isAlt || isCtrl)) { // CHECK HTML CONTENT NOT TEXT
                    console.log("5e-chm | Sending selection to chat");
                    ChatMessage.create({
                        content: `<h3>5e不全书引用</h3><div class="chm-quote" style="background: rgba(0,0,0,0.05); padding: 5px; border-left: 3px solid #666; margin-bottom: 5px; overflow-x: auto; max-width: 100%;">${selectionHtml}</div><p style="font-size: 0.8em; color: #666; text-align: right;">—— ${win.document.title}</p>`
                    });
                    if (ui.notifications) ui.notifications.info("已引用到聊天栏");
                }
            };

            const bindDoc = (win) => {
                try {
                    if (!win || !win.document) return false;
                    
                    // Prevention: If this specific window instance is already bound, skip
                    if (win._chmBound) return true;

                    // 使用 Capture 阶段 (true) 来捕获事件，防止被页面原有脚本阻止冒泡
                    win.removeEventListener("mouseup", onMouseUp, true);
                    win.addEventListener("mouseup", onMouseUp, true);
                    
                    // Mark this window instance as bound
                    win._chmBound = true;
                    
                    console.log(`5e-chm | Listeners bound to content frame: ${win.location.href}`);
                    
                    // Update Title
                     if (win.document && this.window && this.window.title) {
                        this.window.title.innerText = `5e不全书 - ${win.document.title}`;
                     }
                    
                    // --- Link Fixer for Broken Relative Paths ---
                    // Many CHM files use relative paths assuming a flat structure or specific base, 
                    // which breaks when files are nested (e.g., inside "topics/速查/法术速查/").
                    // We intercept clicks to check if the link is broken (404) and try to fix it by rebasing to 'topics/'.
                    win.document.addEventListener('click', async (e) => {
                        const link = e.target.closest('a');
                        if (!link) return;
                        
                        const href = link.getAttribute('href');
                        // Skip anchors, javascript, absolute HTTP, or mailto
                        if (!href || href.startsWith('#') || href.startsWith('javascript:') || href.startsWith('mailto:') || href.match(/^[a-z]+:\/\//)) return;

                        // Only apply this heuristic if we are inside 'topics/' and not at the root of it
                        if (!win.location.href.includes('/topics/') || win.location.href.endsWith('/topics/')) return;

                        // We allow default if it looks simple, but we intercept to safeguard 404s
                         // Actually, we should only intervene if we suspect it might fail, OR we intervene on all relative links.
                         // Prudent approach: Check existence? No, that's slow (HEAD request).
                         // BUT, current logic does a HEAD request.

                        e.preventDefault();
                        e.stopPropagation();

                        const currentUrl = win.location.href;
                        // 1. The browser's default resolution (often broken in these files)
                        const defaultResolution = new URL(href, currentUrl).href;
                        
                        // 2. The "Rooted" resolution (assuming href is meant to be from 'topics/' root)
                        const topicsIndex = currentUrl.indexOf('/topics/');
                        const rootBase = currentUrl.substring(0, topicsIndex + '/topics/'.length);
                        const rootedResolution = new URL(href, rootBase).href;

                        // Function to check if a URL exists
                        const checkUrl = async (url) => {
                            try {
                                const res = await fetch(url, { method: 'HEAD' });
                                return res.ok;
                            } catch { return false; }
                        };

                        console.log(`5e-chm | Link clicked. Checking: ${href}`);
                        
                        if (await checkUrl(defaultResolution)) {
                            // console.log("5e-chm | Default path valid.");
                            win.location.href = defaultResolution;
                        } else {
                            console.warn(`5e-chm | Default path 404: ${defaultResolution}. Trying rooted path...`);
                            if (await checkUrl(rootedResolution)) {
                                console.log(`5e-chm | Rooted path found: ${rootedResolution}`);
                                win.location.href = rootedResolution;
                            } else {
                                console.error("5e-chm | Link dead in both locations.");
                                // Fallback to default behavior (letting user see the 404 or whatever)
                                win.location.href = defaultResolution;
                            }
                        }
                    }, true); // Capture phase to ensure we control navigation

                    return true;
                } catch (err) {
                    // Suppress security errors for cross-origin frames if present
                    // console.warn("5e-chm | Bind error:", err);
                    return false;
                }
            };

            const attachListeners = () => {
                try {
                    const topWin = iframe.contentWindow;
                    if (!topWin) return;

                    const mainWin = topWin.frames["main"];
                    if (!mainWin) return;
                    
                    const contentWin = mainWin.frames["content"];
                    if (!contentWin) return;

                    // Attempt bind (idempotent due to _chmBound check)
                    bindDoc(contentWin);

                } catch (err) {
                    // console.warn("5e-chm | Frame access error:", err);
                }
            };

            // 启动永久轮询 (1s)，以处理页面跳转和重新加载
            if (this._pollInterval) clearInterval(this._pollInterval);
            this._pollInterval = setInterval(attachListeners, 1000);
            
            // 移除超时停止逻辑，只要窗口开着就一直轮询检测导航
        };

        wrapper.appendChild(iframe);
        return wrapper;
    }

    /**
     * 将渲染结果插入到窗口内容中
     * @param {HTMLElement} result - _renderHTML 返回的元素
     * @param {HTMLElement} content - 窗口的内容容器
     * @param {RenderOptions} options
     */
    _replaceHTML(result, content, options) {
        content.replaceChildren(result);
    }
}
