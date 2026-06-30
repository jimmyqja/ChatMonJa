const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");

test("download website has current Mac and Windows links", () => {
  const html = fs.readFileSync("docs/index.html", "utf8");
  const css = fs.readFileSync("docs/styles.css", "utf8");
  const script = fs.readFileSync("docs/site.js", "utf8");

  assert.match(html, /ChatMonJA — Twitch Chat Welcome Bot/);
  assert.match(html, /Current version: <strong>1\.3\.4<\/strong>/);
  assert.match(html, /releases\/download\/v1\.3\.4\/ChatMonJA-1\.3\.4-mac-arm64-unsigned\.dmg/);
  assert.match(html, /releases\/download\/v1\.3\.4\/ChatMonJA-1\.3\.4-windows-x64-unsigned\.zip/);
  assert.doesNotMatch(html, /releases\/latest\/download/);
  assert.match(html, /ChatMonJA-1\.3\.4-mac-arm64-unsigned\.dmg/);
  assert.match(html, /ChatMonJA-1\.3\.4-windows-x64-unsigned\.zip/);
  assert.match(html, /Elmore “JimmyQ” Jamieson/);
  assert.doesNotMatch(html, /mailto:/);
  assert.doesNotMatch(html, /support@chatmonja\.com/);
  assert.match(html, /href="privacy\.html">Read the full privacy policy/);
  assert.match(html, /free preview release/);
  assert.doesNotMatch(html, /tester release/i);
  assert.match(html, /assets\/chatmonja-icon\.png/);
  assert.match(html, /data-release-counter/);
  assert.match(html, /src="site\.js"/);
  assert.ok(fs.existsSync("docs/assets/chatmonja-icon.png"));
  assert.match(css, /\.button\.primary/);
  assert.match(css, /\.download-stat/);
  assert.match(script, /api\.github\.com\/repos\/jimmyqja\/ChatMonJa\/releases\/tags\/v1\.3\.4/);
  assert.match(script, /download_count/);
  assert.match(script, /ChatMonJA-1\.3\.4-mac-arm64-unsigned\.dmg/);
  assert.match(script, /ChatMonJA-1\.3\.4-windows-x64-unsigned\.zip/);
  assert.match(script, /data-contact-form/);
});

test("website includes privacy, FAQ, terms, and contact pages", () => {
  const privacy = fs.readFileSync("docs/privacy.html", "utf8");
  const faq = fs.readFileSync("docs/faq.html", "utf8");
  const terms = fs.readFileSync("docs/terms.html", "utf8");
  const contact = fs.readFileSync("docs/contact.html", "utf8");

  assert.match(privacy, /What ChatMonJA stores/);
  assert.match(privacy, /does not use analytics, advertising, telemetry, or remote crash reporting/);
  assert.match(privacy, /formats messages locally in your browser/);
  assert.match(faq, /Is ChatMonJA free\?/);
  assert.match(faq, /Twitch’s device login flow/);
  assert.match(terms, /provided “as is”/);
  assert.match(terms, /responsible for following Twitch’s/);
  assert.match(contact, /data-contact-form/);
  assert.match(contact, /Nothing is uploaded/);
  assert.match(contact, /instagram\.com\/jimmyqja/);

  for (const page of [privacy, faq, terms, contact]) {
    assert.match(page, /assets\/chatmonja-icon\.png/);
    assert.match(page, /href="index\.html">/);
    assert.doesNotMatch(page, /mailto:/);
    assert.doesNotMatch(page, /support@chatmonja\.com/);
    assert.match(page, /class="contact-bubble"/);
  }
});

test("website does not expose support addresses", () => {
  const pageNames = ["index.html", "privacy.html", "faq.html", "terms.html", "contact.html"];

  for (const pageName of pageNames) {
    const html = fs.readFileSync(`docs/${pageName}`, "utf8");

    assert.doesNotMatch(html, /mailto:/, `${pageName} includes a mail link`);
    assert.doesNotMatch(html, /support@/i, `${pageName} includes a support address`);
    assert.doesNotMatch(html, /jimmyqpromo/i, `${pageName} includes the old address`);
  }
});

test("every internal website page link points to an included file", () => {
  const pageNames = ["index.html", "privacy.html", "faq.html", "terms.html", "contact.html"];

  for (const pageName of pageNames) {
    const html = fs.readFileSync(`docs/${pageName}`, "utf8");
    const localLinks = [...html.matchAll(/href="([^"#]+\.html)(?:#[^"]*)?"/g)].map((match) => match[1]);

    for (const link of localLinks) {
      assert.ok(fs.existsSync(`docs/${link}`), `${pageName} links to missing ${link}`);
    }
  }
});
