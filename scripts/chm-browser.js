const { ApplicationV2 } = foundry.applications.api;

/**
 * 瀹氫箟宓屽叆娴忚鍣ㄧ殑绐楀彛绫?(ApplicationV2)
 */
export class ChmBrowser extends ApplicationV2 {
    static DEFAULT_OPTIONS = {
        id: "chm-browser-window",
        tag: "div",
        classes: ["chm-browser-app"],
        window: {
            title: "5e涓嶅叏涔?(鏈湴鐗?",
            resizable: true,
            minimizable: true,
            icon: "fas fa-book-atlas"
        },
        position: {
            width: 1000,
            height: 800
        }
    };

    // 璁板綍鏈€鍚庤闂殑椤甸潰鍦板潃
    lastSrc = "modules/5e-chm-in-fvtt/chm/index.html";

    /**
     * 娓叉煋 HTML 鍐呭
     * @param {ApplicationRenderContext} context
     * @param {RenderOptions} options
     * @returns {Promise<HTMLElement>}
     */
    async _renderHTML(context, options) {
        // 浣跨敤璁板繂鐨勮矾寰?(this.lastSrc) 鑰屼笉鏄啓姝荤殑 basePath
        const targetPath = this.lastSrc || "modules/5e-chm-in-fvtt/chm/index.html"; // 澧炲姞榛樿鍊间繚鎶?
        const localUrl = foundry.utils.getRoute ? foundry.utils.getRoute(targetPath) : targetPath;

        const wrapper = document.createElement("div");
        wrapper.classList.add("chm-browser-wrapper");

        const iframe = document.createElement("iframe");
        iframe.src = localUrl;
        iframe.classList.add("chm-browser-iframe");
        iframe.allow = "clipboard-write";

        // 鐩戝惉 iframe 鍔犺浇瀹屾垚浜嬩欢
        iframe.onload = () => {
            // console.log("5e-chm | Iframe Wrapper Loaded (onload fired)");

            const onMouseUp = (ev) => {
                const win = ev.view;
                let selectionText = "";
                let selectionHtml = "";
                
                try {
                     const sel = win.getSelection();
                     if (sel) {
                         selectionText = sel.toString();
                         
                         // 鎻愬彇甯︽爣绛剧殑 HTML 鐢ㄤ簬淇濇寔鍒嗘鍜屾牸寮?
                         if (sel.rangeCount > 0) {
                             const container = win.document.createElement("div");
                             for (let i = 0; i < sel.rangeCount; i++) {
                                 container.appendChild(sel.getRangeAt(i).cloneContents());
                             }
                             selectionHtml = container.innerHTML;
                         }
                     }
                } catch(e) {}
                
                // Fallback: 濡傛灉 HTML 鎻愬彇澶辫触锛屼娇鐢ㄧ函鏂囨湰
                if (!selectionHtml && selectionText) selectionHtml = selectionText.replace(/\n/g, "<br>");

                // V14 鍏煎鎬у寮猴細妫€娴嬫寜閿?
                const isAlt = ev.altKey || (game.keyboard && game.keyboard.isModifierActive && game.keyboard.isModifierActive(KeyboardManager.MODIFIER_KEYS.ALT));
                const isCtrl = ev.ctrlKey || (game.keyboard && game.keyboard.isModifierActive && game.keyboard.isModifierActive(KeyboardManager.MODIFIER_KEYS.CONTROL));
                
                console.log(5e-chm | MouseUp Detected. Select: "..." | Alt:  | Ctrl:  | CapturePhase);
                
                if (selectionHtml && (isAlt || isCtrl)) { // CHECK HTML CONTENT NOT TEXT
                    console.log("5e-chm | Sending selection to chat");
                    ChatMessage.create({
                        content: <h3>5e涓嶅叏涔﹀紩鐢?/h3><div class="chm-quote" style="background: rgba(0,0,0,0.05); padding: 5px; border-left: 3px solid #666; margin-bottom: 5px; overflow-x: auto; max-width: 100%;"></div><p style="font-size: 0.8em; color: #666; text-align: right;">鈥?</p>
                    });
                    if (ui.notifications) ui.notifications.info("宸插紩鐢ㄥ埌鑱婂ぉ鏍?);
                }
            };

            const bindDoc = (win) => {
                try {
                    if (!win || !win.document) return false;
                    
                    // Prevention: If this specific window instance is already bound, skip
                    if (win._chmBound) return true;

                    // 浣跨敤 Capture 闃舵 (true) 鏉ユ崟鑾蜂簨浠讹紝闃叉琚〉闈㈠師鏈夎剼鏈樆姝㈠啋娉?
                    win.removeEventListener("mouseup", onMouseUp, true);
                    win.addEventListener("mouseup", onMouseUp, true);
                    
                    // Mark this window instance as bound
                    win._chmBound = true;
                    
                    console.log(5e-chm | Listeners bound to content frame: );
                    
                    // Update Title
                     if (win.document && this.window && this.window.title) {
                        this.window.title.innerText = 5e涓嶅叏涔?- ;
                     }
                    
                    // --- Link Fixer for Broken Relative Paths ---
                    // Many CHM files use relative paths assuming a flat structure or specific base, 
                    // which breaks when files are nested (e.g., inside "topics/閫熸煡/娉曟湳閫熸煡/").
                    // We intercept clicks to check if the link is broken (404) and try to fix it by rebasing to 'topics/'.
                    win.document.addEventListener('click', async (e) => {
                        const link = e.target.closest('a');
                        if (!link) return;
                        
                        const href = link.getAttribute('href');
                        // Skip anchors, javascript, absolute HTTP, or mailto
                        if (!href || href.startsWith('#') || href.startsWith('javascript:') || href.startsWith('mailto:') || href.match(/^[a-z]+:\/\//)) return;

                        // Only apply this heuristic if we are inside 'topics/' and not at the root of it
                        if (!win.location.href.includes('/topics/') || win.location.href.endsWith('/topics/')) return;

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

                        // Logic: If default works, go there. If not, try rooted.
                        // Optimization: If the path clearly goes deeper (e.g. "BookName/...") but we are already deep, prefer rooted check first?
                        // No, let's be safe. Check Default first.
                        
                        console.log(5e-chm | Link clicked. Checking: );
                        
                        if (await checkUrl(defaultResolution)) {
                            // console.log("5e-chm | Default path valid.");
                            win.location.href = defaultResolution;
                        } else {
                            console.warn(5e-chm | Default path 404: . Trying rooted path...);
                            if (await checkUrl(rootedResolution)) {
                                console.log(5e-chm | Rooted path found: );
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

            // 鍚姩姘镐箙杞 (1s)锛屼互澶勭悊椤甸潰璺宠浆鍜岄噸鏂板姞杞?
            if (this._pollInterval) clearInterval(this._pollInterval);
            this._pollInterval = setInterval(attachListeners, 1000);
            
            // 绉婚櫎瓒呮椂鍋滄閫昏緫锛屽彧瑕佺獥鍙ｅ紑鐫€灏变竴鐩磋疆璇㈡娴嬪鑸?
        };

        wrapper.appendChild(iframe);
        return wrapper;
    }

    /**
     * 灏嗘覆鏌撶粨鏋滄彃鍏ュ埌绐楀彛鍐呭涓?
     * @param {HTMLElement} result - _renderHTML 杩斿洖鐨勫厓绱?
     * @param {HTMLElement} content - 绐楀彛鐨勫唴瀹瑰鍣?
     * @param {RenderOptions} options
     */
    _replaceHTML(result, content, options) {
        content.replaceChildren(result);
    }
}
