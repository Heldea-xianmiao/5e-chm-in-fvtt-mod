$root = $PSScriptRoot

Write-Host "Applying comprehensive fixes to 5e-chm-in-fvtt module..." -ForegroundColor Cyan

# ==========================================
# 1. Update scripts/main.js (V14 Compatibility)
# ==========================================
$mainJsPath = Join-Path $root "scripts\main.js"
$mainJsContent = @"
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
    // 如果 html 是 jQuery 对象，取第一个元素；如果是 HTMLElement，直接使用
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

console.log("5e不全书FVTT部署版已上线");
"@
Set-Content -Path $mainJsPath -Value $mainJsContent -Encoding UTF8
Write-Host "Updated scripts/main.js" -ForegroundColor Green

# ==========================================
# 2. Update scripts/chm-browser.js (Core Logic)
# ==========================================
$chmBrowserJsPath = Join-Path $root "scripts\chm-browser.js"
$chmBrowserJsContent = @"
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
        // 使用记忆的路径 (this.lastSrc) 而不是写死的 basePath
        const targetPath = this.lastSrc || "modules/5e-chm-in-fvtt/chm/index.html"; // 增加默认值保护
        const localUrl = foundry.utils.getRoute ? foundry.utils.getRoute(targetPath) : targetPath;

        const wrapper = document.createElement("div");
        wrapper.classList.add("chm-browser-wrapper");

        const iframe = document.createElement("iframe");
        iframe.src = localUrl;
        iframe.classList.add("chm-browser-iframe");
        iframe.allow = "clipboard-write";

        // 监听 iframe 加载完成事件
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
                        content: `<h3>5e不全书引用</h3><div class="chm-quote" style="background: rgba(0,0,0,0.05); padding: 5px; border-left: 3px solid #666; margin-bottom: 5px; overflow-x: auto; max-width: 100%;">${selectionHtml}</div><p style="font-size: 0.8em; color: #666; text-align: right;">— ${win.document.title}</p>`
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
"@
Set-Content -Path $chmBrowserJsPath -Value $chmBrowserJsContent -Encoding UTF8
Write-Host "Updated scripts/chm-browser.js" -ForegroundColor Green

# ==========================================
# 3. Update chm/webhelpcontents.htm (Nav Logic)
# ==========================================
$contentsPath = Join-Path $root "chm\webhelpcontents.htm"
if (Test-Path $contentsPath) {
    Write-Host "Reading file: $contentsPath"
    $content = Get-Content $contentsPath -Raw -Encoding UTF8

    $fixedJs = @'
<SCRIPT LANGUAGE="JavaScript">
		<!--
		var cl,pn,pm,bl;
		var path = 'icons/';
		var pos = 0;
		var icon;
		var tar = 'content';
		var display;
		var imgi;
		var AutoCollapse;
		var LastSelected = -1;
		var loaded = false;
		var max;
		var divlist;

		function SetEnv(v,a){
			if(v==0){
				pn = [['daplus.gif','daminus.gif'],['tplus.gif','tminus.gif'],['uaplus.gif','uaminus.gif'],['splus.gif','sminus.gif']];  
				PreloadImg('downangle.gif','tshaped.gif','upangle.gif','sline.gif','daplus.gif','daminus.gif','tplus.gif','tminus.gif','uaplus.gif','uaminus.gif','splus.gif','sminus.gif','blank.gif','line.gif');
			}else{
				pn = [['plus.gif','minus.gif']];
				PreloadImg('plus.gif','minus.gif','blank.gif');
			}
			AutoCollapse = a;
		}

		function PreloadImg(){
			if (document.images) {
				var imgs = PreloadImg.arguments;
				var pload = new Array();
				for (var i=0; i<imgs.length; i++) {
					pload[i] = new Image;
					pload[i].src = path + imgs[i];
				}
			}
		}

		function get(o){
			var x;
			if(document.all) x=document.all[o];
			if(document.getElementById) x=document.getElementById(o);
			return x;
		}

		function pnImg(img){
			var i,j;
			for(i=0;i<=3;i++){
				for(j=0;j<=1;j++){
					if(img.substr(img.lastIndexOf('/') + 1)== pn[i][j]){
						return i;
					}
				}
			}
		}

		function icon(img){
			var f;
			f = img.substr(img.lastIndexOf('/') + 1);
			if( f=='1.gif' || f=='2.gif'){
				return ['1.gif','2.gif'];
			}
			if( f=='3.gif' || f=='4.gif'){
				return ['3.gif','4.gif'];
			}
			if( f=='5.gif' || f=='6.gif'){
				return ['5.gif','6.gif'];
			}
			if( f=='7.gif' || f=='8.gif'){
				return ['7.gif','8.gif'];
			}
			return [f,f];
		}

		function show(id){
			get('d' + id).style.display='block';
			if(get('imgn' + id )) get('imgn' + id ).src= path + pn[pnImg(get('imgn' + id ).src)][1];
			get('img' + id ).src= path + icon(get('img' + id ).src)[1];
		}

		function collapse(id){
			get('d' + id ).style.display='none';
			if(get('imgn' + id )) get('imgn' + id ).src= path + pn[pnImg(get('imgn' + id ).src)][0];
			get('img' + id ).src= path + icon(get('img' + id ).src)[0];
		}

		function collapseAll(){
			var i;
			var o;
			for(i=0;i<=divlist.length-1;i++){
				if(o=get('d' + divlist[i])){
					if(o.style.display!='none'){
						collapse(divlist[i]);
					}
				}
			}
		}

		function showAll(){
			var i;
			var o;
			for(i=0;i<=divlist.length-1;i++){
				if(o=get('d' + divlist[i])){
					if(o.style.display!='block'){
						show(divlist[i]);
					}
				}
			}
		}

		function unselectAll(){
			var i=0;
			while(get("l" + i)){
				get("l" + i).className = "unselected";
				i++;
			}
		}

		function clickNode(index){
			var e;
			e = get("l" + index);
			if(e==null) return;
			e = e.parentNode;
			if(e.nodeName == 'A'){
				if(e.href!= window.location.href + '#'){
					// Fix for Foundry VTT
					try {
						var contentFrame = null;
						if (parent.parent && parent.parent.frames && parent.parent.frames['content']) {
							contentFrame = parent.parent.frames['content'];
						} else if (parent.parent && parent.parent.content) {
							contentFrame = parent.parent.content;
						} else {
							var w = window;
							while (w !== w.parent && !contentFrame) {
								w = w.parent;
								try { if (w.frames['content']) contentFrame = w.frames['content']; } catch(e){}
							}
						}
						if (contentFrame) contentFrame.location.href = e.href;
					} catch(err) { }
				}else{
					selectNode(index);
				}
				e.onclick;
			}
		}

		function showParent(ele){
			var e;
			e = ele.parentNode;
			if(e==null) return;
			if(e.nodeName == 'DIV'){
				if(e.id!='') show(e.id.substring(1,e.id.length ));
			}else if(e.nodeName == 'A'){
			}
			showParent(e);
		}

		function showNode(index){
			showParent(get("l" + index));
			LinkClick(index);
		}

		function selectNode(index){
			if(LastSelected!=index){
				//collapseAll();
				showParent(get("l" + index));
				LinkClick(index, false, false, true);
				get('l' + index).scrollIntoView(true);
				window.scrollTo(0,document.body.scrollTop);
			}
		}

		function NodeClick(id){
			if(get('d' + id ).style.display=='none'){
				show(id);
			}else{
				collapse(id);
			}
			return false;
		}

		function LinkDblClick(id){
			if(!AutoCollapse){
				if(get('d' + id ).style.display=='none'){
					show(id);
				}else{
					collapse(id);
				}
			}
			return false;
		}

		function LinkClick(index,hasChild,r,noNav){
			if(AutoCollapse && hasChild){
				if(get('d' + index ).style.display=='none'){
					collapseAll()
					showParent(get('l' + index));
					show(index);
				}else{
					collapseAll()
					showParent(get('l' + index));
					collapse(index);
				}
			}
			if(LastSelected!=-1){
				get('l' + LastSelected).className = "unselected";
			}
			get('l' + index).className = "selected";
			LastSelected = index;

			// Fix for Foundry VTT: Robust frame finding
			var link = get('l' + index).parentNode;
			// Use getAttribute to get raw relative path, avoiding encoding/absolute path issues
			var rawHref = link ? link.getAttribute('href') : null;
			
			if (!noNav && link && rawHref && rawHref.indexOf('#') === -1) {
				try {
					var contentFrame = null;
					// Standard frame hierarchy: tree -> nav -> main -> content
					if (parent.parent && parent.parent.frames && parent.parent.frames['content']) {
						contentFrame = parent.parent.frames['content'];
					} else if (parent.parent && parent.parent.content) {
						contentFrame = parent.parent.content;
					}
					
					if (contentFrame) {
						console.log("5e-chm | Navigating to:", rawHref);
						contentFrame.location.href = rawHref;
					} else {
						console.log("5e-chm | Content frame not found.");
					}
				} catch(e) {
					console.log("5e-chm | Navigation error", e);
				}
				return false; // Prevent default behavior
			}
			return r;
		}

		window.defaultStatus = '';

		function body_onload() {
			get('loading').style.display = 'none';
			loaded = true;
			try {
				if (parent.parent.content.document.readyState) {
					if (parent.parent.content.document.readyState == 'complete') {
						try { parent.parent.content.syn(); } catch (e) { };
					}
				} else {
					if (parent.parent.contentLoaded) {
						try { parent.parent.content.syn(); } catch (e) { };
					}
				}
			} catch(e) {}
		}
		//-->
		</SCRIPT>
'@
    # Regex to replace the Script block
    $pattern = '(?s)<SCRIPT LANGUAGE="JavaScript">.*?</SCRIPT>'
    if ($content -match $pattern) {
        $newContent = $content -replace $pattern, $fixedJs
        
        # Remove broken onmousemove
        if ($newContent -match 'onmousemove="body_onmousemove\(event\);"') {
            $newContent = $newContent -replace 'onmousemove="body_onmousemove\(event\);"', ''
        }

        Set-Content -Path $contentsPath -Value $newContent -Encoding UTF8
        Write-Host "Success! Fixed chm/webhelpcontents.htm" -ForegroundColor Green
    } else {
        Write-Warning "Target JS block not found in webhelpcontents.htm"
    }
}

# ==========================================
# 4. Global DOCTYPE Fix (Quirks Mode)
# ==========================================
Write-Host "Checking DOCTYPEs in HTML files..." -ForegroundColor Cyan
Get-ChildItem -Path (Join-Path $root "chm") -Recurse -Filter "*.htm*" | ForEach-Object {
    $c = Get-Content $_.FullName -Raw -Encoding UTF8
    $isHtml5 = $c -match '<!DOCTYPE html>'
    if (-not $isHtml5) {
        if ($c -match '(?i)<!DOCTYPE.*?>') {
             $c = $c -replace '(?i)<!DOCTYPE.*?>', '<!DOCTYPE html>'
             Set-Content -Path $_.FullName -Value $c -Encoding UTF8
             Write-Host "Updated DOCTYPE: $($_.Name)" -ForegroundColor Gray
        } else {
             # Insert at top if no doctype
             $c = "<!DOCTYPE html>`n" + $c
             Set-Content -Path $_.FullName -Value $c -Encoding UTF8
             Write-Host "Added DOCTYPE: $($_.Name)" -ForegroundColor Gray
        }
    }
}

Write-Host "All fixes applied successfully." -ForegroundColor Green
