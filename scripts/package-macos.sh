#!/bin/zsh
set -euo pipefail

ROOT="${0:A:h:h}"
cd "$ROOT"

VERSION="$(node -p "require('./package.json').version")"
ARCH="$(uname -m)"
PRODUCT="ChatMonJA"
BUNDLE_ID="com.jimmyqja.chatmonja"
OUT="$ROOT/out"
APP_DIR="$OUT/${PRODUCT}-darwin-${ARCH}"
APP="$APP_DIR/${PRODUCT}.app"
SOURCE_APP="$ROOT/node_modules/electron/dist/Electron.app"
STAGE="$OUT/dmg-stage"
SIGN_IDENTITY="${APPLE_SIGNING_IDENTITY:--}"
PLIST_BUDDY="/usr/libexec/PlistBuddy"

if [[ ! -d "$SOURCE_APP" ]]; then
  echo "Electron runtime not found. Run npm install first."
  exit 1
fi

rm -rf "$APP_DIR" "$STAGE"
mkdir -p "$APP_DIR" "$APP/Contents/Resources/app/node_modules" "$STAGE"
ditto "$SOURCE_APP" "$APP"

MAIN_PLIST="$APP/Contents/Info.plist"
mv "$APP/Contents/MacOS/Electron" "$APP/Contents/MacOS/$PRODUCT"

function set_plist() {
  local plist="$1" key="$2" value="$3"
  "$PLIST_BUDDY" -c "Set :$key $value" "$plist" 2>/dev/null || \
    "$PLIST_BUDDY" -c "Add :$key string $value" "$plist"
}

set_plist "$MAIN_PLIST" CFBundleName "$PRODUCT"
set_plist "$MAIN_PLIST" CFBundleDisplayName "$PRODUCT"
set_plist "$MAIN_PLIST" CFBundleExecutable "$PRODUCT"
set_plist "$MAIN_PLIST" CFBundleIdentifier "$BUNDLE_ID"
set_plist "$MAIN_PLIST" CFBundleShortVersionString "$VERSION"
set_plist "$MAIN_PLIST" CFBundleVersion "$VERSION"
set_plist "$MAIN_PLIST" CFBundleIconFile "icon.icns"
set_plist "$MAIN_PLIST" LSApplicationCategoryType "public.app-category.social-networking"
set_plist "$MAIN_PLIST" NSHumanReadableCopyright "Copyright © 2026 Elmore 'JimmyQ' Jamieson"
"$PLIST_BUDDY" -c "Delete :ElectronAsarIntegrity" "$MAIN_PLIST" 2>/dev/null || true
"$PLIST_BUDDY" -c "Delete :NSAppTransportSecurity" "$MAIN_PLIST" 2>/dev/null || true
for permission_key in \
  NSCameraUsageDescription \
  NSMicrophoneUsageDescription \
  NSAudioCaptureUsageDescription \
  NSBluetoothAlwaysUsageDescription \
  NSBluetoothPeripheralUsageDescription; do
  "$PLIST_BUDDY" -c "Delete :$permission_key" "$MAIN_PLIST" 2>/dev/null || true
done

for suffix in "" " (Renderer)" " (GPU)" " (Plugin)"; do
  OLD_NAME="Electron Helper${suffix}"
  NEW_NAME="${PRODUCT} Helper${suffix}"
  OLD_APP="$APP/Contents/Frameworks/${OLD_NAME}.app"
  NEW_APP="$APP/Contents/Frameworks/${NEW_NAME}.app"
  [[ -d "$OLD_APP" ]] || continue
  mv "$OLD_APP" "$NEW_APP"
  mv "$NEW_APP/Contents/MacOS/$OLD_NAME" "$NEW_APP/Contents/MacOS/$NEW_NAME"
  HELPER_PLIST="$NEW_APP/Contents/Info.plist"
  set_plist "$HELPER_PLIST" CFBundleName "$NEW_NAME"
  set_plist "$HELPER_PLIST" CFBundleDisplayName "$NEW_NAME"
  set_plist "$HELPER_PLIST" CFBundleExecutable "$NEW_NAME"
  case "$suffix" in
    "") identifier="$BUNDLE_ID.helper" ;;
    " (Renderer)") identifier="$BUNDLE_ID.helper.renderer" ;;
    " (GPU)") identifier="$BUNDLE_ID.helper.gpu" ;;
    " (Plugin)") identifier="$BUNDLE_ID.helper.plugin" ;;
  esac
  set_plist "$HELPER_PLIST" CFBundleIdentifier "$identifier"
done

rm -f "$APP/Contents/Resources/default_app.asar" "$APP/Contents/Resources/electron.icns"
cp "$ROOT/build/icon.icns" "$APP/Contents/Resources/icon.icns"

APP_RESOURCES="$APP/Contents/Resources/app"
cp "$ROOT/main.js" "$ROOT/preload.js" "$ROOT/index.html" "$ROOT/package.json" "$APP_RESOURCES/"
ditto "$ROOT/lib" "$APP_RESOURCES/lib"
ditto "$ROOT/assets" "$APP_RESOURCES/assets"
for dependency in tmi.js node-fetch whatwg-url tr46 webidl-conversions ws; do
  ditto "$ROOT/node_modules/$dependency" "$APP_RESOURCES/node_modules/$dependency"
done

node "$ROOT/scripts/verify-package.js" "$APP_RESOURCES"

xattr -cr "$APP"

if [[ "$SIGN_IDENTITY" == "-" ]]; then
  codesign --force --deep --sign - --entitlements "$ROOT/build/entitlements.mac.plist" "$APP"
  SIGNING_LABEL="unsigned"
else
  codesign --force --deep --timestamp --options runtime \
    --sign "$SIGN_IDENTITY" \
    --entitlements "$ROOT/build/entitlements.mac.plist" \
    "$APP"
  SIGNING_LABEL="signed"
fi

codesign --verify --deep --strict --verbose=2 "$APP"
plutil -lint "$MAIN_PLIST" >/dev/null

ditto "$APP" "$STAGE/$PRODUCT.app"
ln -s /Applications "$STAGE/Applications"
DMG="$OUT/${PRODUCT}-${VERSION}-mac-${ARCH}-${SIGNING_LABEL}.dmg"
rm -f "$DMG"
if ! hdiutil create -volname "$PRODUCT $VERSION" -srcfolder "$STAGE" -ov -format UDZO "$DMG" >/dev/null 2>&1; then
  HYBRID="$OUT/.${PRODUCT}-${VERSION}-hybrid.dmg"
  rm -f "$HYBRID"
  hdiutil makehybrid -hfs -hfs-volume-name "$PRODUCT $VERSION" -o "$HYBRID" "$STAGE" >/dev/null
  hdiutil convert "$HYBRID" -format UDZO -o "$DMG" >/dev/null
  rm -f "$HYBRID"
fi
rm -rf "$STAGE"

echo "Created $DMG"
if [[ "$SIGN_IDENTITY" == "-" ]]; then
  echo "This build is ad-hoc signed for local testing, not public distribution."
fi
