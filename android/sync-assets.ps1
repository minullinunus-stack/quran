# Копирует сайт из корня проекта в assets Android-приложения.
# Запускать после правок index.html / data / icons:
#   powershell -ExecutionPolicy Bypass -File .\sync-assets.ps1

$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $PSScriptRoot
$dst = Join-Path $PSScriptRoot "app\src\main\assets\www"

if (Test-Path $dst) { Remove-Item $dst -Recurse -Force }
New-Item -ItemType Directory -Force -Path $dst | Out-Null

Copy-Item (Join-Path $root "index.html") $dst
$page = Join-Path $dst "index.html"
$html = [System.IO.File]::ReadAllText($page)
$html = [regex]::Replace($html, '(?m)^.*<a class="download-app"[^\n]*</a>\r?\n?', '')
[System.IO.File]::WriteAllText($page, $html, [System.Text.UTF8Encoding]::new($false))
Copy-Item (Join-Path $root "privacy.html") $dst
Copy-Item (Join-Path $root "manifest.webmanifest") $dst
Copy-Item (Join-Path $root "sw.js") $dst
Copy-Item (Join-Path $root "icons") $dst -Recurse

Write-Host "Ассеты скопированы в $dst"
