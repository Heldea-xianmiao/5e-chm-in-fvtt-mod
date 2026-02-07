# cleanup_mod.ps1
# 此脚本用于清理 5e-chm-in-fvtt 模组中不必要的工程文件和开发工具，以减小体积。

$baseDir = $PSScriptRoot

Write-Host "正在清理模组目录..." -ForegroundColor Cyan

# 定义要删除的文件和文件夹列表 relative to module root
$itemsToRemove = @(
    "chm/CNAME",
    "chm/README.md",
    "chm/.gitattributes",
    "chm/.gitignore",
    "chm/topics/.gitattributes",
    "chm/topics/.gitignore",
    "chm/topics/README.md",
    "chm/topics/LICENSE",
    "chm/topics/格式转换工具包",
    "chm/topics/空白页模板",
    "fix_encoding.py"
    # 如果用户不再需要通过 update.bat 更新，也可以清理 update.bat 和 apply_fixes.ps1，但通常保留作为维护工具
    # ".git" # 只有当这是一个 git 仓库时才存在
)

foreach ($item in $itemsToRemove) {
    $path = Join-Path $baseDir $item
    if (Test-Path $path) {
        Write-Host "删除: $item" -ForegroundColor Yellow
        Remove-Item -Path $path -Recurse -Force -ErrorAction SilentlyContinue
    }
}

# 深度清理 .chm 工程文件 (如果有 .wcp, .hhp, .hhc, .hhk)
# 这些是 WinCHM 的工程文件，不需要在 Web 运行
$extensionsToRemove = @("*.wcp", "*.hhp", "*.hhc", "*.hhk", "*.log")
Get-ChildItem -Path $baseDir -Include $extensionsToRemove -Recurse | ForEach-Object {
    Write-Host "删除工程文件: $($_.Name)" -ForegroundColor Yellow
    Remove-Item -Path $_.FullName -Force
}

Write-Host "清理完成！" -ForegroundColor Green
Write-Host "提示：'编译后的文件' (CHM文件) 无法直接被 Web 浏览器读取，因此保留解包后的 HTML 文件夹是必须的。" -ForegroundColor Gray
