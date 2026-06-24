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
  --icon=build/icon.ico `
  --app-version=$Version `
  --build-version=$Version `
  --win32metadata.CompanyName="Elmore 'JimmyQ' Jamieson" `
  --win32metadata.FileDescription="ChatMonJA Twitch welcome and community bot" `
  --win32metadata.ProductName="ChatMonJA" `
  --ignore="^/(out|outputs|data|backups|test|\.git|ChatMonJA-Release|\.env|auth\.json)($|/)"

node scripts/verify-package.js "$PackageDir/resources/app"

if (Test-Path $Zip) { Remove-Item $Zip -Force }
Compress-Archive -Path "$PackageDir/*" -DestinationPath $Zip -CompressionLevel Optimal
Write-Host "Created $Zip"
Write-Host "This Windows build is unsigned and intended for testing."
