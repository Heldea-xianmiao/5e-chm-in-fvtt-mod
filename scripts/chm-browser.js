const { ApplicationV2 } = foundry.applications.api;

/**
 * 定义嵌入浏览器的窗口类 (ApplicationV2)
 * Version: V4.2 (Cloud Native + GET Probe)
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

    /**
     * 渲染 HTML 内容
     */
    async _renderHTML(context, options) {
        console.log("5e-chm | [V4.2] 云端兼容模式初始化...");
        
        // 1. 获取当前脚本的根目录信息
        const scriptUrl = new URL(import.meta.url);
        // 去除脚本文件名，得到 scripts 目录
        const scriptFolder = scriptUrl.pathname.substring(0, scriptUrl.pathname.lastIndexOf('/')); 
        // 去除 scripts 目录，得到模块根目录 (例如 /modules/5e-chm-in-fvtt/)
        const rootFolder = scriptFolder.substring(0, scriptFolder.lastIndexOf('/')) + "/";
        
        console.log("5e-chm | 模块根目录:", rootFolder);

        // 2. 构建候选列表
        const candidates = [
            { type: "自动推导(HTML)", path: "chm/index.html" },
            { type: "自动推导(HTM)", path: "chm/index.htm" },
            { type: "大写兼容(CHM)", path: "CHM/index.html" },
            // Linux 常见大小写陷阱
            { type: "根目录文件", path: "index.html" }
        ];

        let validSrc = null;

        // 3. 探测循环 (使用 GET 以获得最大兼容性)
        for (const c of candidates) {
            let target = "";
            if (c.url) {
                target = c.url;
            } else {
                target = new URL(c.path, new URL(rootFolder, window.location.href)).href;
            }

            // --- 核心修复: 强制转换为根相对路径 ---
            // 这解决了 "Connection Refused" 问题
            // http://cloud-ip:30000/modules/x -> /modules/x
            try {
                const u = new URL(target, window.location.href);
                target = u.pathname + u.search + u.hash;
            } catch(e) {}

            try {
                // 改用 GET，避免部分服务器拦截 HEAD
                // mode: 'same-origin' 避免跨域噪音
                const resp = await fetch(target, { method: "GET", mode: "same-origin", cache: "no-store" });
                if (resp.ok) {
                    console.log(`5e-chm | ✅ 路径确认有效 [${c.type}]: ${target}`);
                    validSrc = target;
                    break;
                }
            } catch(e) {
                console.warn(`5e-chm | 路径探测跳过 [${c.type}]: ${target} (${e.message})`);
            }
        }

        // 4. 最终回退 (死马当活马医)
        if (!validSrc) {
            console.warn("5e-chm | ⚠️ 所有自动探测均失败，尝试使用默认推导路径强行加载...");
            validSrc = rootFolder + "chm/index.html";
        }

        // --- 构建界面 ---
        const wrapper = document.createElement("div");
        wrapper.classList.add("chm-browser-wrapper");
        wrapper.style.height = "100%";
        wrapper.style.display = "flex";
        wrapper.style.flexDirection = "column";

        const iframe = document.createElement("iframe");
        iframe.src = validSrc;
        iframe.classList.add("chm-browser-iframe");
        iframe.style.flex = "1";
        iframe.style.border = "none";
        iframe.allow = "clipboard-write";

        // 调试信息
        console.log(`5e-chm | 最终加载 URL: ${validSrc}`);

        iframe.onload = () => {
            console.log("5e-chm | Iframe 加载事件触发");
            this._attachFrameListeners(iframe);
        };

        wrapper.appendChild(iframe);
        return wrapper;
    }

    _replaceHTML(result, content, options) {
        content.replaceChildren(result);
    }

    _attachFrameListeners(iframe) {
        const attach = () => {
            try {
                const cw = iframe.contentWindow;
                if (!cw) return;

                // 安全访问 document
                let doc;
                try {
                    doc = cw.document;
                    if (!doc || cw.location.href === "about:blank") return;
                } catch(e) { return; }

                if (cw._chmBound) return;

                console.log("5e-chm | 激活交互功能...");
                const onMouseUp = (ev) => this._handleSelection(ev);
                cw.removeEventListener("mouseup", onMouseUp, true);
                cw.addEventListener("mouseup", onMouseUp, true);
                cw.addEventListener("click", (e) => this._handleLinkClick(e, cw), true);
                
                if (doc.title) {
                     try {
                        const titleEl = this.element.querySelector('.window-title');
                        if (titleEl) titleEl.innerText = `5e不全书 - ${doc.title}`;
                     } catch(e) {}
                }
                cw._chmBound = true;
            } catch(e) {}
        };

        attach();
        if (this._pollInterval) clearInterval(this._pollInterval);
        this._pollInterval = setInterval(attach, 1000);

        // --- 5. Cloud Bridge 消息监听 (V4.2 Addon) ---
        // 即使跨域，也能通过 postMessage 接收选区数据
        if (!this._messageHandler) {
            this._messageHandler = (event) => {
                // 安全检查: 确保消息来自我们的 iframe
                // 注意: event.source 可能是跨域的 WindowProxy，不能直接比较
                // 所以我们通过消息类型来过滤
                if (event.data && event.data.type === "CHM_SELECTION") {
                    console.log("5e-chm | 收到 Cloud Bridge 消息:", event.data);
                    this._handleCloudSelection(event.data);
                }
            };
            window.addEventListener("message", this._messageHandler);
        }
    }

    _handleCloudSelection(data) {
        const { html, text, title } = data;
        let finalHtml = html;
        if (!finalHtml && text) finalHtml = text.replace(/\n/g, "<br>");

        if (finalHtml) {
            ChatMessage.create({
                content: `<h3>5e不全书引用</h3><div class="chm-quote" style="background: rgba(0,0,0,0.05); padding: 5px; border-left: 3px solid #666; margin-bottom: 5px; overflow-x: auto; max-width: 100%;">${finalHtml}</div><p style="font-size: 0.8em; color: #666; text-align: right;">— ${title || "Unknown"}</p>`
            });
            ui.notifications.info("已引用到聊天栏 (via Bridge)");
        }
    }

    _handleSelection(ev) {
        const win = ev.view;
        let html = "";
        let text = "";
        try {
            const sel = win.getSelection();
            if (sel && !sel.isCollapsed) {
                text = sel.toString();
                if (sel.rangeCount > 0) {
                    const div = win.document.createElement("div");
                    for (let i=0; i<sel.rangeCount; i++) div.appendChild(sel.getRangeAt(i).cloneContents());
                    html = div.innerHTML;
                }
            }
        } catch(e) {}

        if (!html && text) html = text.replace(/\n/g, "<br>");
        const isAction = ev.altKey || ev.ctrlKey;
        if (html && isAction) {
            ChatMessage.create({
                content: `<h3>5e不全书引用</h3><div class="chm-quote" style="background: rgba(0,0,0,0.05); padding: 5px; border-left: 3px solid #666; margin-bottom: 5px; overflow-x: auto; max-width: 100%;">${html}</div><p style="font-size: 0.8em; color: #666; text-align: right;">— ${win.document.title}</p>`
            });
            ui.notifications.info("已引用到聊天栏");
        }
    }

    async _handleLinkClick(e, win) {
        const link = e.target.closest('a');
        if (!link) return;
        const href = link.getAttribute('href');
        if (!href || href.match(/^(#|javascript:|mailto:|http)/)) return;
        if (!win.location.href.includes('/topics/')) return;
        e.preventDefault();
        e.stopPropagation();

        const currentUrl = win.location.href;
        const defaultResolution = new URL(href, currentUrl).href;
        const topicsIndex = currentUrl.indexOf('/topics/');
        const rootBase = currentUrl.substring(0, topicsIndex + '/topics/'.length);
        const rootedResolution = new URL(href, rootBase).href;

        const checkUrl = async (url) => {
            try { return (await fetch(url, { method: 'HEAD' })).ok; } catch { return false; }
        };

        if (await checkUrl(defaultResolution)) win.location.href = defaultResolution;
        else if (await checkUrl(rootedResolution)) win.location.href = rootedResolution;
        else win.location.href = defaultResolution;
    }
    
    close(options) {
        if (this._pollInterval) clearInterval(this._pollInterval);
        
        // 移除消息监听
        if (this._messageHandler) {
            window.removeEventListener("message", this._messageHandler);
            this._messageHandler = null;
        }
        
        return super.close(options);
    }
}
