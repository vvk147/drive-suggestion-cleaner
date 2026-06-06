(() => {
  if (window.__driveSuggestionCleanerLoaded) return;
  window.__driveSuggestionCleanerLoaded = true;

  const SOURCE = "drive-suggestion-cleaner";

  const send = (type, payload = {}) => {
    chrome.runtime.sendMessage({ source: SOURCE, type, ...payload }).catch(() => {});
  };

  const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
  const clean = (value) => (value || "").replace(/\s+/g, " ").trim();
  const text = (element) => clean(element?.innerText || element?.textContent || "");

  const visible = (element) => {
    if (!element) return false;
    const rect = element.getBoundingClientRect();
    const style = getComputedStyle(element);
    return rect.width > 0 && rect.height > 0 && style.display !== "none" && style.visibility !== "hidden";
  };

  const clickCenter = async (element) => {
    element.scrollIntoView({ block: "center", inline: "center" });
    await sleep(150);

    const rect = element.getBoundingClientRect();
    const x = rect.left + rect.width / 2;
    const y = rect.top + rect.height / 2;
    const target = document.elementFromPoint(x, y) || element;
    const clickable = target.closest?.('[role="menuitem"], button, [role="button"]') || target;

    for (const type of ["pointerdown", "mousedown", "pointerup", "mouseup", "click"]) {
      clickable.dispatchEvent(new MouseEvent(type, {
        bubbles: true,
        cancelable: true,
        view: window,
        clientX: x,
        clientY: y
      }));
    }

    clickable.click?.();
    await sleep(500);
  };

  const escapeMenus = async () => {
    document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", code: "Escape", bubbles: true }));
    document.dispatchEvent(new KeyboardEvent("keyup", { key: "Escape", code: "Escape", bubbles: true }));
    await sleep(250);
  };

  const suggestedBounds = () => {
    const heading = [...document.querySelectorAll("button, div, span")]
      .filter(visible)
      .find((element) => text(element) === "Suggested files");

    if (!heading) return null;

    const headingRect = heading.getBoundingClientRect();
    const viewMore = [...document.querySelectorAll("button, div, span")]
      .filter(visible)
      .find((element) => {
        const rect = element.getBoundingClientRect();
        return rect.top > headingRect.bottom && /^View more$/i.test(text(element));
      });

    return {
      top: headingRect.bottom,
      bottom: viewMore ? viewMore.getBoundingClientRect().top : window.innerHeight,
      viewMore
    };
  };

  const fileMenus = () => {
    const bounds = suggestedBounds();
    if (!bounds) return [];

    return [...document.querySelectorAll('button, [role="button"]')]
      .filter(visible)
      .filter((element) => {
        const label = clean(element.getAttribute("aria-label") || text(element));
        const rect = element.getBoundingClientRect();
        return /^More actions(?: \(Alt\+A\))?$/.test(label) && rect.top > bounds.top && rect.top < bounds.bottom;
      })
      .sort((a, b) => a.getBoundingClientRect().top - b.getBoundingClientRect().top);
  };

  const nameNear = (menu) => {
    const rect = menu.getBoundingClientRect();
    const centerY = rect.top + rect.height / 2;

    return [...document.querySelectorAll("div, span, strong")]
      .filter(visible)
      .filter((element) => {
        const elementRect = element.getBoundingClientRect();
        return elementRect.left < rect.left && Math.abs(elementRect.top + elementRect.height / 2 - centerY) < 32;
      })
      .map(text)
      .find((candidate) => /\.[a-z0-9]{2,5}$/i.test(candidate)) || "(suggested file)";
  };

  const firstVisibleName = () => {
    const menu = fileMenus()[0];
    return menu ? nameNear(menu) : null;
  };

  const notHelpful = () => {
    const menus = [...document.querySelectorAll('[role="menu"]')].filter(visible);
    const scope = menus.at(-1) || document;

    return [...scope.querySelectorAll('[role="menuitem"], div, span')]
      .filter(visible)
      .map((element) => element.closest?.('[role="menuitem"]') || element)
      .find((element) => text(element) === "Not a helpful suggestion");
  };

  const waitUntilFirstRowChanges = async (oldName, delayMs, stopOnStall) => {
    if (!stopOnStall) {
      await sleep(delayMs);
      return true;
    }

    for (let i = 0; i < 20; i += 1) {
      await sleep(300);
      const now = firstVisibleName();
      if (!now || now !== oldName) return true;
    }

    return false;
  };

  const maybeClickViewMore = async (autoViewMore) => {
    if (!autoViewMore || fileMenus().length > 0) return false;
    const bounds = suggestedBounds();
    if (!bounds?.viewMore) return false;
    await clickCenter(bounds.viewMore);
    await sleep(1200);
    return true;
  };

  const run = async (options) => {
    if (window.__driveSuggestionCleanerRunning) {
      send("progress", { status: "Running", detail: "Cleaner is already running on this tab." });
      return;
    }

    window.__driveSuggestionCleanerRunning = true;
    const maxItems = Math.max(1, Number(options.maxItems || 500));
    const delayMs = Math.max(200, Number(options.delayMs || 700));
    const autoViewMore = options.autoViewMore !== false;
    const stopOnStall = options.stopOnStall !== false;

    window.__driveSuggestionCleanerStop = false;
    let cleared = 0;

    send("progress", { cleared, status: "Running", detail: "Started." });

    for (let i = 0; i < maxItems && !window.__driveSuggestionCleanerStop; i += 1) {
      await escapeMenus();
      await maybeClickViewMore(autoViewMore);

      const menu = fileMenus()[0];
      if (!menu) {
        send("done", { cleared, status: "Done", detail: `No suggested file menus found. Cleared ${cleared}.` });
        window.__driveSuggestionCleanerRunning = false;
        return;
      }

      const oldName = nameNear(menu);
      await clickCenter(menu);

      let item = notHelpful();
      if (!item) {
        await sleep(700);
        item = notHelpful();
      }

      if (!item) {
        send("done", { cleared, status: "Stopped", detail: `Could not find "Not a helpful suggestion" for ${oldName}.` });
        window.__driveSuggestionCleanerRunning = false;
        return;
      }

      await clickCenter(item);

      const changed = await waitUntilFirstRowChanges(oldName, delayMs, stopOnStall);
      if (!changed) {
        send("done", { cleared, status: "Stopped", detail: `Clicked, but the visible first row did not change: ${oldName}.` });
        window.__driveSuggestionCleanerRunning = false;
        return;
      }

      cleared += 1;
      send("progress", { cleared, status: "Running", detail: `Marked not helpful: ${oldName}` });
      await sleep(delayMs);
    }

    const status = window.__driveSuggestionCleanerStop ? "Stopped" : "Done";
    send("done", { cleared, status, detail: `${status}. Cleared ${cleared}.` });
    window.__driveSuggestionCleanerRunning = false;
  };

  chrome.runtime.onMessage.addListener((message) => {
    if (message?.type === "start") {
      run(message.options || {});
    }

    if (message?.type === "stop") {
      window.__driveSuggestionCleanerStop = true;
      send("progress", { status: "Stopping", detail: "Stop requested." });
    }
  });
})();
