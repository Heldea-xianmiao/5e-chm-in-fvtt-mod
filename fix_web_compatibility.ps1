# fix_web_compatibility.ps1
# 此脚本专门用于修复在 GitHub Pages 等 Web 环境下出现的 404 问题
# 1. 修复 HTML 中的反斜杠路径 (win -> web)
# 2. 对包含中文的 href 路径进行标准的 URI 编码 (避免浏览器/服务器编码歧义)
# 3. 修复 href 中的 %23 编码为 # (WinCHM 锚点编码问题)

$root = $PSScriptRoot
$targetDir = Join-Path $root "chm"

Write-Host "开始修复 Web 兼容性问题..." -ForegroundColor Cyan

# 需要扫描的文件类型
$files = Get-ChildItem -Path $targetDir -Include *.htm,*.html -Recurse

# 计数器
$fixedBackslash = 0
$encodedChinese = 0
$fixedAnchor = 0

foreach ($file in $files) {
    $content = Get-Content -Path $file.FullName -Raw -Encoding UTF8
    $newContent = $content
    $changed = $false
    
    # ---------------------------------------------------------
    # 1. 修复反斜杠 (Backslash)
    # ---------------------------------------------------------
    # 查找 href="..." 或 src="..." 中包含反斜杠的情况
    # 这里的正则匹配 pattern: href="[^"]*\[^"]*"
    
    if ($newContent -match 'href="[^"]*\\[^"]*"|src="[^"]*\\[^"]*"') {
        # 简单粗暴的替换策略：
        # 我们假设所有在该 HTML 里出现的 href/src 引用都是相对路径，且不应该包含反斜杠
        # 为了避免误伤 JS 里的转义符，我们尽量只替换属性值里的
        
        # 使用正则回调替换太复杂，我们分步处理
        # 先用正则找出所有带 href/src 的字符串，确认里面有 \ 才替换
        
        $newContent = [Regex]::Replace($newContent, '(href|src)="([^"]*)"', {
            param($match)
            $attr = $match.Groups[1].Value
            $val = $match.Groups[2].Value
            
            # 如果包含反斜杠，替换为正斜杠
            if ($val -match '\\') {
                $fixedVal = $val -replace '\\', '/'
                return "$attr=`"$fixedVal`""
            }
            return $match.Value
        })
        
        if ($newContent -ne $content) {
            $fixedBackslash++
            $changed = $true
        }
    }
    
    # ---------------------------------------------------------
    # 2. URI 编码中文路径 (Percent Encoding)
    # ---------------------------------------------------------
    # 很多 Web 服务器对 URL 中的非 ASCII 字符处理不一致。
    # 标准做法是将其转换为 %XX 格式。
    # 我们只对 href/src 里的内容进行编码。
    
    # 注意：不要重复编码！如果已经是 %E4... 就不要再编了。
    
    # 定义编码函数
    # $EncodeUrl = { param($url) ... } 
    # 由于 PowerShell 回调闭包复杂，我们在循环里直接处理
    
    $newContent = [Regex]::Replace($newContent, '(href|src)="([^"]*)"', {
        param($match)
        $attr = $match.Groups[1].Value
        $val = $match.Groups[2].Value
        
        # 跳过空值、锚点、javascript、http绝对路径
        if ([string]::IsNullOrWhiteSpace($val) -or $val.StartsWith("#") -or $val.StartsWith("javascript:") -or $val.StartsWith("http") -or $val.StartsWith("mailto:")) {
            return $match.Value
        }

        # 检查是否包含非 ASCII 字符 (中文等)
        if ($val -match '[^\x00-\x7F]') {
            # 这是一个相对路径，包含中文。我们需要对其进行编码。
            # 注意保留 / 符号，不要把 / 编码成 %2F
            
            # 分割路径
            $parts = $val -split '/'
            $encodedParts = $parts | ForEach-Object {
                if ($_ -match '[^\x00-\x7F]') {
                    # URL Encode
                    [System.Web.HttpUtility]::UrlEncode($_)
                } else {
                    $_
                }
            }
            $newVal = $encodedParts -join '/'
            
            # 只有当确实发生了变化才返回新值
            if ($newVal -ne $val) {
                return "$attr=`"$newVal`""
            }
        }
        return $match.Value
    })
    
    if ($newContent -ne $content) {
        # 如果上一步没有 flagging changed，这里检测一下
        if (-not $changed) {
            $encodedChinese++
            $changed = $true
        }
    }
    
    # ---------------------------------------------------------
    # 3. 修复 %23 编码问题 (Anchor Links)
    # ---------------------------------------------------------
    # WinCHM 生成 HTML 时将锚点分隔符 # 过度编码为 %23，
    # 导致浏览器将其视为路径的一部分而非 fragment separator，所有锚点链接 404。
    # 在 href 属性中将 %23 替换为 #
    
    $contentBeforeAnchorFix = $newContent
    $newContent = [Regex]::Replace($newContent, '(href)="([^"]*%23[^"]*)"', {
        param($match)
        $attr = $match.Groups[1].Value
        $val = $match.Groups[2].Value
        $fixedVal = $val -replace '%23', '#'
        return "$attr=`"$fixedVal`""
    })
    
    if ($newContent -ne $contentBeforeAnchorFix) {
        $fixedAnchor++
        $changed = $true
    }
    
    if ($changed) {
        Set-Content -Path $file.FullName -Value $newContent -Encoding UTF8
        Write-Host "Fixed: $($file.Name)" -ForegroundColor Gray
    }
}

Write-Host "------------------------------------------------"
Write-Host "Fix Completed!" -ForegroundColor Green
Write-Host "  - Fixed backslashes: $fixedBackslash files"
Write-Host "  - Encoded paths:     $encodedChinese files"
Write-Host "  - Fixed anchors:     $fixedAnchor files"
Write-Host "Suggestion: Please push to GitHub again and wait for Pages build to complete (approx 1-2 mins)." -ForegroundColor Yellow
