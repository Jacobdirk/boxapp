# Cache buster: sets ?v=<version> on all css/js references in index.html.
# Usage:  .\bump-version.ps1            -> uses a timestamp (yyyyMMddHHmmss)
#         .\bump-version.ps1 -Version 1.2.0
param([string]$Version = (Get-Date -Format 'yyyyMMddHHmmss'))

$index = Join-Path $PSScriptRoot 'index.html'
$html = Get-Content $index -Raw -Encoding UTF8
$updated = [regex]::Replace($html, '((?:href|src)="(?:css|js)/[^"?]+\.(?:css|js))(\?v=[^"]*)?"', "`$1?v=$Version`"")
[System.IO.File]::WriteAllText($index, $updated, (New-Object System.Text.UTF8Encoding $false))
Write-Host "index.html assets set to v=$Version"
