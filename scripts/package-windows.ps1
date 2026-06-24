$ErrorActionPreference = "Stop"

$Root = Split-Path -Parent $PSScriptRoot
Set-Location $Root

$Version = node -p "require('./package.json').version"
$Out = Join-Path $Root "out"
$PackageDir = Join-Path $Out "ChatMonJA-win32-x64"
$Zip = Join-Path $Out "ChatMonJA-$Version-windows-x64-unsigned.zip"

if (-not (Test-Path "build/icon.ico")) {
  throw "build/icon.ico is missing. Generate it on macOS and commit it before building Windows."
}

npx --yes @electron/packager@latest . ChatMonJA `
  --platform=win32 `
  --arch=x64 `
  --out=out `
  --overwrite `
  --prune=true `
  --no-asar `
  --icon=build/icon.ico `
  --app-version=$Version `
  --build-version=$Version `
  --win32metadata.CompanyName="Elmore 'JimmyQ' Jamieson" `
  --win32metadata.FileDescription="ChatMonJA Twitch welcome and community bot" `
  --win32metadata.ProductName="ChatMonJA" `
  --ignore="^/(out|outputs|data|backups|test|\.git|ChatMonJA-Release|\.env|auth\.json)($|/)"
if ($LASTEXITCODE -ne 0) { throw "Electron Packager failed with exit code $LASTEXITCODE." }

$ResourcesApp = Join-Path $PackageDir "resources/app"
if (-not (Test-Path $ResourcesApp)) {
  throw "Packaged app resources folder is missing: $ResourcesApp"
}

$PackagedAssets = Join-Path $ResourcesApp "assets"
if (Test-Path $PackagedAssets) { Remove-Item $PackagedAssets -Recurse -Force }
Copy-Item (Join-Path $Root "assets") $PackagedAssets -Recurse -Force

node scripts/verify-package.js $ResourcesApp
if ($LASTEXITCODE -ne 0) { throw "Package verification failed with exit code $LASTEXITCODE." }

if (Test-Path $Zip) { Remove-Item $Zip -Force }
Compress-Archive -Path "$PackageDir/*" -DestinationPath $Zip -CompressionLevel Optimal
Write-Host "Created $Zip"
Write-Host "This Windows build is unsigned and intended for testing."
