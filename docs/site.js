(() => {
  function initDownloadCounter() {
    const counter = document.querySelector("[data-release-counter]");

    if (!counter) {
      return;
    }

    const countElement = document.getElementById("download-count");
    const labelElement = document.getElementById("download-count-label");
    const releaseApiUrl = "https://api.github.com/repos/jimmyqja/ChatMonJa/releases/tags/v1.3.4";
    const installerNames = new Set([
      "ChatMonJA-1.3.4-mac-arm64-unsigned.dmg",
      "ChatMonJA-1.3.4-windows-x64-unsigned.zip"
    ]);
    const cacheKey = "chatmonja-v1.3.4-download-count";
    const cacheLifetimeMs = 60 * 60 * 1000;

    function showCount(total, cached = false) {
      countElement.textContent = Number(total).toLocaleString();
      labelElement.textContent = "total downloads";
      counter.title = cached ? "Recently updated from GitHub" : "Updated from GitHub";
    }

    function readCache() {
      try {
        return JSON.parse(localStorage.getItem(cacheKey));
      } catch {
        return null;
      }
    }

    async function updateDownloadCount() {
      const cached = readCache();

      if (cached && Number.isFinite(cached.total) && Date.now() - cached.savedAt < cacheLifetimeMs) {
        showCount(cached.total, true);
        return;
      }

      try {
        const response = await fetch(releaseApiUrl, {
          headers: { Accept: "application/vnd.github+json" }
        });

        if (!response.ok) {
          throw new Error("GitHub download count unavailable");
        }

        const release = await response.json();
        const total = release.assets
          .filter((asset) => installerNames.has(asset.name))
          .reduce((sum, asset) => sum + Number(asset.download_count || 0), 0);

        localStorage.setItem(cacheKey, JSON.stringify({ total, savedAt: Date.now() }));
        showCount(total);
      } catch {
        if (cached && Number.isFinite(cached.total)) {
          showCount(cached.total, true);
        } else {
          countElement.textContent = "—";
          labelElement.textContent = "download count temporarily unavailable";
        }
      }
    }

    updateDownloadCount();
  }

  function initContactForm() {
    const form = document.querySelector("[data-contact-form]");

    if (!form) {
      return;
    }

    const output = document.querySelector("[data-contact-output]");
    const outputText = document.querySelector("[data-contact-output-text]");
    const copyButton = document.querySelector("[data-copy-contact]");
    const copyStatus = document.querySelector("[data-copy-status]");

    function getValue(name) {
      return String(new FormData(form).get(name) || "").trim();
    }

    form.addEventListener("submit", (event) => {
      event.preventDefault();

      const name = getValue("name") || "Not provided";
      const reply = getValue("reply") || "Not provided";
      const topic = getValue("topic") || "Other";
      const message = getValue("message");

      if (!message) {
        return;
      }

      outputText.value = [
        "ChatMonJA tester feedback",
        `Topic: ${topic}`,
        `Name or channel: ${name}`,
        `Best way to reply: ${reply}`,
        "",
        message
      ].join("\n");
      output.hidden = false;
      output.scrollIntoView({ behavior: "smooth", block: "nearest" });
    });

    copyButton.addEventListener("click", async () => {
      try {
        await navigator.clipboard.writeText(outputText.value);
        copyStatus.textContent = "Copied.";
      } catch {
        outputText.focus();
        outputText.select();
        copyStatus.textContent = "Select the text above and copy it manually.";
      }
    });
  }

  initDownloadCounter();
  initContactForm();
})();
