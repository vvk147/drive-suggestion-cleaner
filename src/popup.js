const DEFAULTS = {
  maxItems: 500,
  delayMs: 700,
  autoViewMore: true,
  stopOnStall: true
};

const el = {
  pageState: document.getElementById("pageState"),
  maxItems: document.getElementById("maxItems"),
  delayMs: document.getElementById("delayMs"),
  autoViewMore: document.getElementById("autoViewMore"),
  stopOnStall: document.getElementById("stopOnStall"),
  runButton: document.getElementById("runButton"),
  stopButton: document.getElementById("stopButton"),
  clearedCount: document.getElementById("clearedCount"),
  statusText: document.getElementById("statusText"),
  log: document.getElementById("log")
};

const log = (message) => {
  const line = `[${new Date().toLocaleTimeString()}] ${message}`;
  el.log.textContent = `${line}\n${el.log.textContent}`.slice(0, 5000);
};

const getActiveTab = async () => {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return tab;
};

const isDriveHome = (tab) => /^https:\/\/drive\.google\.com\/drive\/home/.test(tab?.url || "");

const readOptions = () => ({
  maxItems: Math.max(1, Number(el.maxItems.value || DEFAULTS.maxItems)),
  delayMs: Math.max(200, Number(el.delayMs.value || DEFAULTS.delayMs)),
  autoViewMore: el.autoViewMore.checked,
  stopOnStall: el.stopOnStall.checked
});

const saveOptions = async () => {
  await chrome.storage.local.set(readOptions());
};

const loadOptions = async () => {
  const stored = await chrome.storage.local.get(DEFAULTS);
  el.maxItems.value = stored.maxItems;
  el.delayMs.value = String(stored.delayMs);
  el.autoViewMore.checked = Boolean(stored.autoViewMore);
  el.stopOnStall.checked = Boolean(stored.stopOnStall);
};

const sendMessage = async (type, payload = {}) => {
  const tab = await getActiveTab();
  if (!isDriveHome(tab)) {
    throw new Error("Open Google Drive Home first.");
  }

  await chrome.scripting.executeScript({
    target: { tabId: tab.id },
    files: ["src/cleaner.js"]
  });

  return chrome.tabs.sendMessage(tab.id, { type, ...payload });
};

const refreshPageState = async () => {
  const tab = await getActiveTab();
  const ok = isDriveHome(tab);
  el.pageState.textContent = ok ? "Ready on Google Drive Home." : "Open Google Drive Home to run.";
  el.runButton.disabled = !ok;
  el.stopButton.disabled = !ok;
};

chrome.runtime.onMessage.addListener((message) => {
  if (message?.source !== "drive-suggestion-cleaner") return;

  if (message.type === "progress") {
    el.clearedCount.textContent = String(message.cleared || 0);
    el.statusText.textContent = message.status || "Running";
    if (message.detail) log(message.detail);
  }

  if (message.type === "done") {
    el.clearedCount.textContent = String(message.cleared || 0);
    el.statusText.textContent = message.status || "Done";
    log(message.detail || "Finished.");
  }
});

el.runButton.addEventListener("click", async () => {
  try {
    await saveOptions();
    el.statusText.textContent = "Starting";
    log("Starting cleanup.");
    await sendMessage("start", { options: readOptions() });
  } catch (error) {
    el.statusText.textContent = "Error";
    log(error.message);
  }
});

el.stopButton.addEventListener("click", async () => {
  try {
    await sendMessage("stop");
    el.statusText.textContent = "Stopping";
    log("Stop requested.");
  } catch (error) {
    el.statusText.textContent = "Error";
    log(error.message);
  }
});

for (const input of [el.maxItems, el.delayMs, el.autoViewMore, el.stopOnStall]) {
  input.addEventListener("change", saveOptions);
}

loadOptions().then(refreshPageState);
