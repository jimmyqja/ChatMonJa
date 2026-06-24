# ChatMonJA website

This folder is a static website for ChatMonJA.

Included pages:

- `index.html` — product page and downloads
- `privacy.html` — privacy policy and data handling
- `faq.html` — common installation and usage questions
- `terms.html` — terms of use
- `contact.html` — support email and Instagram

Recommended GitHub Pages setup:

1. Upload the current release files to a GitHub Release:
   - `ChatMonJA-1.3.3-mac-arm64-unsigned.dmg`
   - `ChatMonJA-1.3.3-windows-x64-unsigned.zip`
2. In the GitHub repository, open **Settings → Pages**.
3. Set the source to the `main` branch and the `/docs` folder.
4. Share the generated GitHub Pages URL.

The download buttons use the exact GitHub release tag (`releases/download/v1.3.3/...`). GitHub’s `releases/latest/download/...` route does not include releases marked as pre-release. Update the tag, asset names, and displayed version together for each future release.
