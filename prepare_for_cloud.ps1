# prepare_for_cloud.ps1
# 此脚本用于为 HTML 文件注入“跨域通信代码”，使其支持在 GitHub Pages 等云端托管时仍能与 FVTT 交互。

$targetDir = Join-Path $PSScriptRoot "chm"
$count = 0

Write-Host "开始处理 HTML 文件以支持云端部署..." -ForegroundColor Cyan

# 注入的脚本内容 (最小化版)
$bridgeScript = @"
<script>
/* 5e-chm-bridge */
(function(){
    const post = (type, data) => {
        try { window.parent.postMessage({ type: '5echm:'+type, ...data }, '*'); } catch(e){}
    };
    
    // 1. 报告导航位置 (用于书签记忆)
    post('nav', { href: window.location.href, title: document.title });

    // 2. 监听引用操作 (Alt + 选中文本)
    document.addEventListener('mouseup', (ev) => {
        const isAction = ev.altKey || ev.ctrlKey;
        if (!isAction) return;

        const sel = window.getSelection();
        if (!sel || sel.isCollapsed) return;

        let html = "";
        try {
            if (sel.rangeCount > 0) {
                const div = document.createElement("div");
                for (let i=0; i<sel.rangeCount; i++) div.appendChild(sel.getRangeAt(i).cloneContents());
                html = div.innerHTML;
            }
        } catch(e) {}

        if (html || sel.toString()) {
            post('quote', { 
                html: html || sel.toString(), 
                text: sel.toString(), 
                title: document.title 
            });
        }
    });
})();
</script>
</body>
"@

# 获取所有 htm/html 文件
$files = Get-ChildItem -Path $targetDir -Include *.html,*.htm -Recurse

foreach ($file in $files) {
    try {
        $content = Get-Content -Path $file.FullName -Raw -Encoding UTF8
        
        # 检查是否已注入
        if ($content -match "5e-chm-bridge") {
            continue
        }

        # 在 </body> 前插入脚本
        if ($content -match "</body>") {
            $newContent = $content -replace "</body>", $bridgeScript
            Set-Content -Path $file.FullName -Value $newContent -Encoding UTF8
            $count++
            if ($count % 100 -eq 0) { Write-Host "已处理 $count 个文件..." -ForegroundColor Gray }
        }
    }
    catch {
        Write-Warning "无法处理文件: $($file.Name)"
    }
}

Write-Host "处理完成！共修改了 $count 个文件。" -ForegroundColor Green
Write-Host "现在你可以将 'chm' 文件夹上传到 GitHub Pages，并在模组设置中填写 URL。" -ForegroundColor Yellow
