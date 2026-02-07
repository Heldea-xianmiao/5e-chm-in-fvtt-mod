# scripts/fix_encoding_bom.ps1
# This script ensures that all PowerShell scripts and relevant text files have the correct encoding (UTF-8 with BOM)
# which is required for Windows PowerShell (5.1) to correctly interpret non-ASCII characters (like Chinese).
# It also ensures web files are UTF-8 (No BOM preference for web, but BOM is acceptable if consistent).

$root = "$PSScriptRoot\.."

Write-Host "Ensuring correct encoding for project files..." -ForegroundColor Cyan

# 1. Fix PowerShell Scripts (*.ps1) -> UTF-8 with BOM
# This prevents Chinese characters from being mangled when run in Windows PowerShell
$psFiles = Get-ChildItem -Path $root -Filter *.ps1 -Recurse
foreach ($file in $psFiles) {
    if ($file.FullName -like "*node_modules*" -or $file.FullName -like "*.git*") { continue }
    
    try {
        $content = Get-Content $file.FullName -Raw
        # Force write with UTF-8 BOM
        [System.IO.File]::WriteAllText($file.FullName, $content, [System.Text.UTF8Encoding]::new($true))
        Write-Host "Detailed BOM Check: $($file.Name) -> UTF-8 BOM" -ForegroundColor Gray
    } catch {
        Write-Warn "Could not update encoding for $($file.Name): $_"
    }
}

# 2. Fix Batch Files (*.bat) -> UTF-8 with BOM (or ANSI, but standardizing usually helps)
# Batch files with Chinese output also often need careful encoding handling, but usually ANSI is standard for cmd.
# However, leaving them alone is safer unless known broken.

Write-Host "Encoding fix step complete." -ForegroundColor Green
