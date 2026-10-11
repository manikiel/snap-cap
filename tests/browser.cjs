/* Real production UI tests. Camera and microphone are mocked; no physical iPhone claims. */
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
const out = path.resolve("test-results");
const mime = {
  ".html": "text/html",
  ".js": "application/javascript",
  ".css": "text/css",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".webmanifest": "application/manifest+json",
};
async function server() {
  const app = http.createServer(async (req, res) => {
    try {
      let name = decodeURIComponent(new URL(req.url, "http://local").pathname);
      if (!name.startsWith("/snap-cap/")) {
        res.writeHead(404);
        res.end();
        return;
      }
      name = name.slice("/snap-cap/".length) || "index.html";
      const file = path.resolve(root, name);
      if (!file.startsWith(root + path.sep)) {
        res.writeHead(403);
        res.end();
        return;
      }
      const bytes = await fs.readFile(file);
      res.writeHead(200, {
        "Content-Type": mime[path.extname(file)] || "application/octet-stream",
        "Cache-Control": "no-cache",
      });
      res.end(bytes);
    } catch {
      res.writeHead(404);
      res.end();
    }
  });
  await new Promise((r) => app.listen(0, "127.0.0.1", r));
  return { app, url: `http://127.0.0.1:${app.address().port}/snap-cap/` };
}
async function visible(page, selector) {
  await page.locator(selector).waitFor({ state: "visible" });
}
async function cameraMock(page) {
  await page.addInitScript(() => {
    const canvas = document.createElement("canvas");
    canvas.width = 640;
    canvas.height = 960;
    const ctx = canvas.getContext("2d");
    function paint() {
      const gradient = ctx.createLinearGradient(0, 0, 0, 960);
      gradient.addColorStop(0, "#7cbac3");
      gradient.addColorStop(1, "#eecdaa");
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, 640, 960);
      ctx.fillStyle = "#fff";
      ctx.beginPath();
      ctx.arc(440, 230, 70, 0, Math.PI * 2);
      ctx.fill();
    }
    paint();
    setInterval(paint, 80);
    Object.defineProperty(navigator.mediaDevices, "getUserMedia", {
      configurable: true,
      value: async (c) => {
        if (c.video) {
          if (!canvas.captureStream)
            throw new DOMException("No capture stream", "NotSupportedError");
          return canvas.captureStream(15);
        }
        const audio = new (window.AudioContext || window.webkitAudioContext)();
        const oscillator = audio.createOscillator();
        const destination = audio.createMediaStreamDestination();
        oscillator.connect(destination);
        oscillator.start();
        return destination.stream;
      },
    });
  });
}
async function onboard(
  page,
  name = "Alex",
  username = "alex.local",
  demo = true,
) {
  await page
    .getByRole("button", { name: "Create local profile", exact: true })
    .click();
  await page.getByLabel("Display name", { exact: true }).fill(name);
  await page.getByLabel("Username", { exact: true }).fill(username);
  if (!demo)
    await page
      .getByText("Start with fictional friends and conversations")
      .click();
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  await page.getByRole("button", { name: "Looks like me" }).click();
  await page.getByRole("button", { name: "Open camera", exact: true }).click();
  await visible(page, ".camera-screen");
}
async function overflow(page) {
  const problems = await page.evaluate(() =>
    [
      ...document.querySelectorAll(
        "main,.page,.header,.composer,.bottom-nav,.conversation-head,.sheet-body",
      ),
    ]
      .filter((e) => {
        const r = e.getBoundingClientRect();
        return r.width > 0 && (r.right > innerWidth + 1 || r.left < -1);
      })
      .map((e) => ({
        class: e.className,
        rect: e.getBoundingClientRect().toJSON(),
        innerWidth,
      })),
  );
  assert.deepEqual(problems, [], "Mobile containers should not overflow");
}
async function screenshot(page, name) {
  await page.waitForTimeout(250);
  await page.screenshot({ path: path.join(out, name + ".png") });
}
async function suite(name, browserType) {
  const { app, url } = await server();
  let browser;
  let page;
  const failures = [];
  try {
    const options = { headless: true };
    if (name === "chromium" && process.env.CHROMIUM_EXECUTABLE)
      options.executablePath = process.env.CHROMIUM_EXECUTABLE;
    browser = await browserType.launch(options);
    const context = await browser.newContext({
      viewport: { width: 390, height: 844 },
      deviceScaleFactor: 2,
      isMobile: true,
      hasTouch: true,
      acceptDownloads: true,
    });
    page = await context.newPage();
    await page.addInitScript(() => {
      window.testNotices = [];
      addEventListener("DOMContentLoaded", () =>
        new MutationObserver(() => {
          const text = document.querySelector(".toast")?.textContent;
          if (text && !window.testNotices.includes(text))
            window.testNotices.push(text);
        }).observe(document.body, { childList: true, subtree: true }),
      );
    });
    page.on("pageerror", (e) => failures.push(e.message));
    await page.addInitScript(() => {
      if (navigator.mediaDevices)
        Object.defineProperty(navigator.mediaDevices, "getUserMedia", {
          configurable: true,
          value: async () => {
            throw new DOMException("Camera denied for test", "NotAllowedError");
          },
        });
    });
    await page.goto(url);
    await onboard(page);
    await page
      .getByRole("button", { name: "Enable camera", exact: true })
      .click();
    await page
      .getByText("Camera access was denied.", { exact: false })
      .waitFor();
    await screenshot(page, `${name}-camera-denied`);
    console.log(name + ": onboarding and camera permission rejection passed");
    await page.getByRole("button", { name: "Chat", exact: true }).click();
    await screenshot(page, `${name}-inbox`);
    await page
      .locator(".chat-row-main")
      .filter({ hasText: "Maya Chen" })
      .click();
    await page
      .getByRole("textbox", { name: "Send a Chat", exact: true })
      .fill("Coffee tomorrow?");
    await page
      .getByRole("button", { name: "Send message", exact: true })
      .click();
    await page.getByText("Coffee tomorrow?", { exact: true }).waitFor();
    await page.waitForFunction(() =>
      [...document.querySelectorAll(".message-content p")].some((p) =>
        /Absolutely|coffee and a long walk|still thinking about those cookies/.test(
          p.textContent,
        ),
      ),
    );
    await page
      .getByRole("button", { name: "Message actions: Coffee tomorrow?" })
      .click();
    await page.getByRole("button", { name: "React ❤️", exact: true }).click();
    await page.locator(".reaction").filter({ hasText: "❤️" }).waitFor();
    await screenshot(page, `${name}-conversation`);
    console.log(name + ": text, local simulation and emoji reactions passed");
    await page.getByRole("button", { name: "Back to chats" }).click();
    await page
      .locator(".chat-row-main")
      .filter({ hasText: "Leo Brooks" })
      .click();
    await page.getByRole("button", { name: "Tap to view Snap" }).click();
    await page.getByRole("dialog").waitFor();
    await page.locator(".snap-view img").waitFor();
    await page.getByRole("button", { name: "Close", exact: true }).click();
    await page.getByText("Snap opened", { exact: true }).waitFor();
    await page.getByRole("button", { name: "Back to chats" }).click();
    console.log(name + ": snap viewing and opened expiration passed");
    await page.getByRole("button", { name: "Stories", exact: true }).click();
    await screenshot(page, `${name}-stories`);
    await page.locator(".friend-story").first().click();
    await page.locator(".story-image img").waitFor();
    await page.getByRole("button", { name: "Pause Story" }).click();
    await screenshot(page, `${name}-story-viewer`);
    await page.getByRole("button", { name: "Close Story" }).click();
    await page.getByRole("button", { name: "My profile", exact: true }).click();
    await page
      .getByRole("button", { name: "My Friends", exact: false })
      .click();
    await page.getByRole("button", { name: "Requests", exact: false }).click();
    await page.getByRole("button", { name: "Accept", exact: true }).click();
    await page.getByRole("button", { name: "My Friends", exact: true }).click();
    await page
      .locator(".friend-row-info")
      .filter({ hasText: "Evie Morgan" })
      .waitFor();
    await page
      .locator(".friend-row-info")
      .filter({ hasText: "Maya Chen" })
      .click();
    await page.getByRole("button", { name: "Block fictional friend" }).click();
    await page
      .getByRole("button", { name: "Block friend", exact: true })
      .click();
    await page.getByRole("button", { name: "Unblock and request" }).waitFor();
    await page.getByRole("button", { name: "Unblock and request" }).click();
    await page.getByRole("button", { name: "Accept local friendship" }).click();
    console.log(name + ": friend requests, blocking and unblocking passed");
    await page.getByRole("button", { name: "Back", exact: true }).click();
    await page.getByRole("button", { name: "Back", exact: true }).click();
    await page.getByRole("button", { name: "Settings", exact: true }).click();
    await page.getByLabel("App theme").selectOption("dark");
    await page.waitForFunction(
      () => document.documentElement.dataset.theme === "dark",
    );
    await page.getByLabel("Text size").selectOption("1.5");
    await page.waitForFunction(
      () => getComputedStyle(document.documentElement).fontSize === "24px",
    );
    await page.setViewportSize({ width: 320, height: 568 });
    await page.waitForTimeout(250);
    await overflow(page);
    await screenshot(page, `${name}-settings-large-small`);
    await page.getByLabel("Text size").selectOption("1");
    await page.waitForFunction(
      () => getComputedStyle(document.documentElement).fontSize === "16px",
    );
    await page.setViewportSize({ width: 390, height: 844 });
    await page.getByLabel("App theme").selectOption("light");
    await page.waitForFunction(
      () => document.documentElement.dataset.theme === "light",
    );
    const downloadPromise = page.waitForEvent("download");
    await page
      .getByRole("button", { name: "Export complete JSON backup" })
      .click();
    const download = await downloadPromise;
    const backupPath = path.join(out, `${name}-backup.json`);
    await download.saveAs(backupPath);
    const backup = JSON.parse(await fs.readFile(backupPath, "utf8"));
    assert.equal(backup.format, "snap-cap");
    await page
      .getByLabel("Import backup", { exact: true })
      .setInputFiles(backupPath);
    await page
      .getByRole("button", { name: "Restore as new local profiles" })
      .click();
    await page.locator(".camera-screen").waitFor();
    await page.getByRole("button", { name: "My profile", exact: true }).click();
    await page.getByRole("heading", { name: "Alex · restored" }).waitFor();
    console.log(
      name +
        ": theme, large text, small layout and non-destructive backup restore passed",
    );
    await page
      .getByRole("button", { name: "Switch local profile", exact: false })
      .click();
    await page.getByRole("button", { name: /Alex alex.local$/ }).click();
    await page.locator(".camera-screen").waitFor();
    await page.getByRole("button", { name: "My profile", exact: true }).click();
    await page
      .getByRole("button", { name: "Switch local profile", exact: false })
      .click();
    await page
      .getByRole("button", { name: "Create local profile", exact: true })
      .click();
    await onboard(page, "Robin", "robin.local", false);
    await page.getByRole("button", { name: "Chat", exact: true }).click();
    await page.getByRole("heading", { name: "Say your first hello" }).waitFor();
    await page.getByRole("button", { name: "My profile", exact: true }).click();
    await page
      .getByRole("button", { name: "Switch local profile", exact: false })
      .click();
    await page.getByRole("button", { name: /Alex alex.local$/ }).click();
    console.log(name + ": separate account creation and switching passed");
    // Real browser canvas/MediaRecorder paths with mocked hardware, Chromium only.
    if (name === "chromium") {
      await cameraMock(page);
      await page.reload();
      await page
        .getByRole("button", { name: "Enable camera", exact: true })
        .click();
      await page
        .getByRole("button", { name: "Capture photo; hold for video" })
        .waitFor({ state: "visible" });
      await page.waitForFunction(
        () => !document.querySelector(".capture-button").disabled,
      );
      await page
        .getByRole("button", { name: "Capture photo; hold for video" })
        .click();
      await page.locator(".snap-preview img").waitFor();
      await page.getByRole("button", { name: "Save", exact: true }).click();
      await page.getByRole("button", { name: "Send To", exact: true }).click();
      await page.locator(".recipient").filter({ hasText: "Maya Chen" }).click();
      await page.getByRole("button", { name: "Send (1)", exact: true }).click();
      await page.locator(".conversation").waitFor();
      await page.getByRole("button", { name: "Record voice message" }).click();
      await page.getByRole("button", { name: "Send voice message" }).waitFor();
      await page.waitForTimeout(700);
      await page.getByRole("button", { name: "Send voice message" }).click();
      await page.locator(".voice-player").waitFor();
      await page.getByRole("button", { name: "Back to chats" }).click();
      await page.getByRole("button", { name: "Camera", exact: true }).click();
      await page.waitForFunction(
        () => !document.querySelector(".capture-button").disabled,
      );
      const capture = page.getByRole("button", {
        name: "Capture photo; hold for video",
      });
      await capture.hover();
      await page.mouse.down();
      await page.waitForTimeout(1500);
      await page.mouse.up();
      await page.locator(".snap-preview video").waitFor();
      await page.getByRole("button", { name: "Save", exact: true }).click();
      await page.getByRole("button", { name: "Close snap" }).click();
      await page.getByRole("button", { name: "Memories", exact: true }).click();
      await page.locator(".memory-cell").first().waitFor();
      await screenshot(page, `${name}-memories`);
      await page.locator(".memory-select").first().click();
      await page
        .getByRole("button", { name: "Add to Story", exact: true })
        .click();
      await page
        .getByRole("button", { name: "Publish locally", exact: true })
        .click();
      await page.locator(".memory-cell>button:first-child").last().click();
      await page.locator(".detail-actions .secondary").nth(1).click();
      await page.getByLabel("Create PIN").fill("12345678");
      await page.getByLabel("Confirm PIN").fill("12345678");
      await page.getByRole("button", { name: "Set up My Eyes Only" }).click();
      await page
        .getByRole("button", { name: "Move to My Eyes Only", exact: true })
        .click();
      await page
        .getByRole("heading", { name: "My Eyes Only", exact: true })
        .waitFor();
      await page.getByRole("button", { name: "Back", exact: true }).click();
      await page
        .getByRole("button", { name: "My Eyes Only", exact: true })
        .click();
      await page.getByRole("button", { name: "Lock", exact: true }).click();
      await page.getByLabel("Your PIN").fill("87654321");
      await page.getByRole("button", { name: "Unlock", exact: true }).click();
      await page.getByText("Incorrect PIN.", { exact: false }).waitFor();
      await page.getByLabel("Your PIN").fill("12345678");
      await page.getByRole("button", { name: "Unlock", exact: true }).click();
      await page.locator(".memory-cell img").waitFor();
      console.log(
        name +
          ": mocked photo/video, audio, Memories, Story publication and encrypted vault passed",
      );
    }
    await page.reload();
    await page.locator(".camera-screen").waitFor();
    await page.getByRole("button", { name: "Chat", exact: true }).click();
    await page
      .locator(".chat-row-main")
      .filter({ hasText: "Maya Chen" })
      .waitFor();
    assert.equal(
      failures.length,
      0,
      "No uncaught UI errors: " + failures.join("; "),
    );
    for (const width of [320, 375, 390]) {
      await page.setViewportSize({ width, height: width === 320 ? 568 : 844 });
      await overflow(page);
      await screenshot(page, `${name}-chat-${width}`);
    }
    await page.getByRole("button", { name: "Chat", exact: true }).click();
    await page
      .locator(".chat-row-main")
      .filter({ hasText: "Maya Chen" })
      .click();
    await page.evaluate(() => {
      window.lateMicStops = 0;
      Object.defineProperty(navigator.mediaDevices, "getUserMedia", {
        configurable: true,
        value: () =>
          new Promise((resolve) => {
            window.releaseLateMic = () =>
              resolve({
                getTracks: () => [{ stop: () => window.lateMicStops++ }],
              });
          }),
      });
    });
    await page
      .getByRole("button", { name: "Record voice message", exact: true })
      .click();
    await page.waitForFunction(() => !!window.releaseLateMic);
    await page.getByRole("button", { name: "Back to chats" }).click();
    await page.evaluate(() => window.releaseLateMic());
    await page.waitForFunction(() => window.lateMicStops === 1);
    console.log(
      name + ": microphone granted after leaving chat is stopped safely",
    );
    await page.evaluate(async () => {
      await navigator.serviceWorker.ready;
    });
    await page.reload();
    await page.waitForFunction(() => !!navigator.serviceWorker.controller);
    await app.closeAllConnections();
    await new Promise((r) => app.close(r));
    await page.reload();
    await page.locator(".camera-screen").waitFor();
    await page.getByRole("button", { name: "Chat", exact: true }).click();
    await page
      .locator(".chat-row-main")
      .filter({ hasText: "Maya Chen" })
      .click();
    await page
      .getByRole("textbox", { name: "Send a Chat", exact: true })
      .fill("Offline hello");
    await page
      .getByRole("button", { name: "Send message", exact: true })
      .click();
    await page.getByText("Offline hello", { exact: true }).waitFor();
    console.log(name + ": persistence and offline reload/messaging passed");
  } catch (error) {
    if (page) {
      await screenshot(page, `${name}-failure`).catch(() => {});
      console.error(
        (
          await page
            .locator("body")
            .innerText()
            .catch(() => "")
        ).slice(-4500),
      );
    }
    console.error(
      "Notices:",
      await page?.evaluate(() => window.testNotices).catch(() => []),
    );
    throw error;
  } finally {
    if (browser) await browser.close();
    app.closeAllConnections();
    app.close();
  }
}
(async () => {
  await fs.mkdir(out, { recursive: true });
  const engines = (process.env.TEST_ENGINES || "chromium,webkit").split(",");
  for (const name of engines) await suite(name, playwright[name]);
  console.log("Production browser suites passed: " + engines.join(", "));
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
