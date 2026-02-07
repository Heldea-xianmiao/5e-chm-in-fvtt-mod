# scripts/inject_cloud_bridge.ps1
# 自动注入云端桥接脚本到所有 HTML 文件

param()

$ScriptDir = $PSScriptRoot
$ModuleRoot = Split-Path -Parent $ScriptDir
$ChmDir = Join-Path $ModuleRoot "chm"
$SourceBridge = Join-Path $ScriptDir "cloud-bridge.js"
$DestBridge = Join-Path $ChmDir "cloud-bridge.js"

Write-Host "Starting Cloud Bridge Injection..." -ForegroundColor Cyan

# 检查环境
if (-not (Test-Path $ChmDir)) {
    Write-Warning "CHM directory '$ChmDir' does not exist. Please check your folder structure."
    return
}

if (-not (Test-Path $SourceBridge)) {
    Write-Error "Source bridge script '$SourceBridge' not found."
    return
}

# 复制脚本到 CHM 根目录
Copy-Item -Path $SourceBridge -Destination $DestBridge -Force
Write-Host "Bridge script copied to: $DestBridge" -ForegroundColor Green

# 遍历 HTML 文件
$HtmlFiles = Get-ChildItem -Path $ChmDir -Include *.html,*.htm -Recurse

$CountSrc = 0
$CountSkip = 0

foreach ($File in $HtmlFiles) {
    if ($File.FullName -eq $DestBridge) { continue }
    
    try {
        $Content = [System.IO.File]::ReadAllText($File.FullName)
        
        if ($Content -match "cloud-bridge.js") {
            $CountSkip++
            continue
        }

        # 计算相对路径
        $FileDir = $File.DirectoryName
        $RelPath = ""
        
        if ($FileDir -eq $ChmDir) {
            $RelPath = "cloud-bridge.js"
        } else {
            # 简单计算深度差异
            # 假设路径都是标准的，且 FileDir 在 ChmDir 内部
            $RelPathTarget = $ChmDir.TrimEnd('\').TrimEnd('/')
            $Current = $FileDir.TrimEnd('\').TrimEnd('/')
            
            if ($Current.StartsWith($RelPathTarget)) {
                $SubPath = $Current.Substring($RelPathTarget.Length)
                # 统计分隔符数量
                $Depth = ($SubPath.ToCharArray() | Where-Object { $_ -eq '\' -or $_ -eq '/' }).Count
                # 如果 SubPath 是 "\topics\foo"，Depth 是 2，需要 "../../"
                # 实际上 SubPath starts with slash. "\topics" -> 1.
                if ($SubPath -ne "") {
                     $RelPath = ("../" * $Depth) + "cloud-bridge.js"
                } else {
                     $RelPath = "cloud-bridge.js"
                }
            } else {
                # 路径异常回退
                $RelPath = "cloud-bridge.js"
            }
        }
        
        # 构建标签
        $ScriptTag = "<script src=""$RelPath""></script>"
        
        # 注入逻辑
        $NewContent = $Content
        if ($Content -match "</body>") {
            $NewContent = $Content -replace "</body>", "$ScriptTag`r`n</body>"
        } elseif ($Content -match "</html>") {
            $NewContent = $Content -replace "</html>", "$ScriptTag`r`n</html>"
        } else {
            $NewContent = $Content + "`r`n$ScriptTag"
        }

        # 写入文件 (UTF-8 No BOM)
        $Utf8NoBom = New-Object System.Text.UTF8Encoding $False
        [System.IO.File]::WriteAllText($File.FullName, $NewContent, $Utf8NoBom)
        $CountSrc++
        
    } catch {
        Write-Warning "Failed to process $($File.Name): $_"
    }
}

Write-Host "Injection Complete." -ForegroundColor Cyan
Write-Host "  Injected: $CountSrc files" -ForegroundColor Green
Write-Host "  Skipped:  $CountSkip files" -ForegroundColor Gray
