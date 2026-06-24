ChatMonJA Windows 11 build notes

This package is a clean source/build kit for creating the Windows 11 x64 app ZIP.
It does not include local login tokens, backups, chat data, or personal runtime files.

Fastest path on a Windows 11 PC:

1. Install Node.js LTS from https://nodejs.org/
2. Unzip this folder.
3. Double-click BUILD-WINDOWS.bat.
4. When it finishes, send testers the ZIP in the out folder:
   out/ChatMonJA-1.3.3-windows-x64-unsigned.zip

GitHub Actions path:

1. Push this repository to GitHub.
2. Open the Actions tab.
3. Run "Build Windows package".
4. Download the uploaded Windows ZIP artifact.

The Windows package is unsigned, so Windows SmartScreen may warn testers.
That is expected until the app is signed with a code-signing certificate.
