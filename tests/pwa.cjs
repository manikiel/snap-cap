/* Exercise two real service-worker generations without modifying build files. */
const fs = require("node:fs/promises");
const path = require("node:path");
const http = require("node:http");
const assert = require("node:assert/strict");
let playwright;
try {
  playwright = require("playwright");
} catch {
  playwright = require(
    process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES + "/playwright",
  );
}
const root = path.resolve("dist");
const mime = {
  ".html": "text/html",
  ".js": "application/javascript",
  ".css": "text/css",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".webmanifest": "application/manifest+json",
};
async function suite(name) {
  let version = "first",
    broken = false,
    browser;
  const app = http.createServer(async (req, res) => {
    const pathname = new URL(req.url, "http://localhost").pathname;
    try {
      if (!pathname.startsWith("/snap-cap/")) throw Error("outside scope");
      const file = path.resolve(root, pathname.slice(10) || "index.html");
      if (!file.startsWith(root + path.sep)) throw Error("outside root");
      if (broken && pathname.includes("/assets/"))
        throw Error("interrupted update");
      let bytes = await fs.readFile(file);
      if (pathname.endsWith("/sw.js"))
        bytes = Buffer.from(
          bytes
            .toString()
            .replace(/snap-cap-shell-[a-f0-9]+/, "snap-cap-shell-" + version),
        );
      if (path.basename(file) === "index.html")
        bytes = Buffer.from(
          bytes
            .toString()
            .replace(
              "<head>",
              '<head><meta name="test-release" content="' + version + '">',
            ),
        );
      res.writeHead(200, {
        "Content-Type": mime[path.extname(file)] || "application/octet-stream",
        "Cache-Control": "no-store",
      });
      res.end(bytes);
    } catch {
      res.writeHead(404);
      res.end();
    }
  });
  await new Promise((r) => app.listen(0, "127.0.0.1", r));
  const url = `http://127.0.0.1:${app.address().port}/snap-cap/`;
  try {
    browser = await playwright[name].launch({
      headless: true,
      ...(name === "chromium" && process.env.CHROMIUM_EXECUTABLE
        ? { executablePath: process.env.CHROMIUM_EXECUTABLE }
        : {}),
    });
    const page = await browser.newPage({
      viewport: { width: 390, height: 844 },
    });
    await page.goto(url);
    await page
      .getByRole("button", { name: "Create local profile", exact: true })
      .click();
    await page.getByLabel("Display name", { exact: true }).fill("Update Test");
    await page.getByLabel("Username", { exact: true }).fill("update.local");
    await page.getByRole("button", { name: "Continue", exact: true }).click();
    await page.getByRole("button", { name: "Looks like me" }).click();
    await page
      .getByRole("button", { name: "Open camera", exact: true })
      .click();
    await page.locator(".camera-screen").waitFor();
    await page.evaluate(() => navigator.serviceWorker.ready);
    await page.waitForFunction(() => !!navigator.serviceWorker.controller);
    const profile = await page.evaluate(() =>
      localStorage.getItem("snap-cap-active-profile"),
    );
    assert.ok(profile);
    await page.evaluate(async () => {
      await caches.open("unrelated-cache");
    });
    // An interrupted install must leave the existing offline shell intact.
    version = "second";
    broken = true;
    await page.evaluate(async () => {
      const r = await navigator.serviceWorker.getRegistration();
      await r.update();
      const worker = r.installing;
      if (worker && worker.state !== "redundant")
        await new Promise((resolve) =>
          worker.addEventListener("statechange", () => {
            if (worker.state === "redundant") resolve();
          }),
        );
    });
    assert.equal(
      await page.evaluate(
        async () => !!(await navigator.serviceWorker.getRegistration()).waiting,
      ),
      false,
    );
    await page.reload();
    assert.equal(
      await page.locator('meta[name="test-release"]').getAttribute("content"),
      "first",
    );
    broken = false;
    await page.evaluate(async () => {
      await (await navigator.serviceWorker.getRegistration()).update();
    });
    await page.locator(".update-notice").waitFor();
    await page.reload();
    await page.locator(".update-notice").waitFor();
    assert.equal(
      await page.locator('meta[name="test-release"]').getAttribute("content"),
      "first",
      "Waiting update must not mix new HTML with old assets",
    );
    await page.locator(".update-notice button").click();
    await page.waitForFunction(
      () =>
        document.querySelector('meta[name="test-release"]')?.content ===
        "second",
    );
    await page.locator(".camera-screen").waitFor();
    assert.equal(
      await page.evaluate(() =>
        localStorage.getItem("snap-cap-active-profile"),
      ),
      profile,
    );
    const names = await page.evaluate(() => caches.keys());
    assert.deepEqual(
      names.filter((n) => n.startsWith("snap-cap-shell-")),
      ["snap-cap-shell-second"],
    );
    assert.ok(names.includes("unrelated-cache"));
    app.closeAllConnections();
    await new Promise((r) => app.close(r));
    await page.goto(url + "chat");
    await page.locator(".camera-screen").waitFor();
    assert.equal(
      await page.locator('meta[name="test-release"]').getAttribute("content"),
      "second",
    );
    await page.reload();
    await page.locator(".camera-screen").waitFor();
    assert.equal(
      await page.evaluate(() =>
        localStorage.getItem("snap-cap-active-profile"),
      ),
      profile,
    );
    console.log(
      name +
        ": failed-update recovery, waiting version consistency, update activation, cache cleanup, profile preservation and offline subpath refresh passed",
    );
  } finally {
    if (browser) await browser.close();
    app.closeAllConnections();
    app.close();
  }
}
(async () => {
  for (const name of (process.env.TEST_ENGINES || "chromium,webkit").split(","))
    await suite(name);
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
