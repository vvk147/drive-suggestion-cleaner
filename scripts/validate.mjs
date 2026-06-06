import { readFile } from "node:fs/promises";

const requiredFiles = [
  "manifest.json",
  "src/popup.html",
  "src/popup.css",
  "src/popup.js",
  "src/cleaner.js",
  "README.md",
  "LICENSE"
];

for (const file of requiredFiles) {
  await readFile(new URL(`../${file}`, import.meta.url), "utf8");
}

const manifest = JSON.parse(await readFile(new URL("../manifest.json", import.meta.url), "utf8"));

const requiredPermissions = ["activeTab", "scripting", "storage"];
for (const permission of requiredPermissions) {
  if (!manifest.permissions?.includes(permission)) {
    throw new Error(`Missing permission: ${permission}`);
  }
}

if (!manifest.host_permissions?.includes("https://drive.google.com/*")) {
  throw new Error("Missing Google Drive host permission");
}

console.log("Extension manifest and source files are valid.");
