import { readdir, readFile, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
async function walk(dir) {
  const files = [];
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    if (entry.isDirectory())
      files.push(...(await walk(`${dir}/${entry.name}`)));
    else if (entry.name !== "sw.js") files.push(`${dir}/${entry.name}`);
  }
  return files;
}
const index = await readFile("dist/index.html", "utf8");
await writeFile(
  "dist/index.html",
  index.replace(
    "<head>",
    '<head><meta http-equiv="Content-Security-Policy" content="default-src &apos;self&apos;; script-src &apos;self&apos;; style-src &apos;self&apos; &apos;unsafe-inline&apos;; img-src &apos;self&apos; blob: data:; media-src &apos;self&apos; blob:; connect-src &apos;self&apos;; object-src &apos;none&apos;; base-uri &apos;self&apos;; frame-src &apos;none&apos;; worker-src &apos;self&apos; blob:"/>',
  ),
);
const files = await walk("dist");
const hash = createHash("sha256");
for (const file of files) hash.update(await readFile(file));
const cache = `snap-cap-shell-${hash.digest("hex").slice(0, 12)}`;
const paths = files.map((f) => "/snap-cap/" + f.slice(5));
await writeFile(
  "dist/sw.js",
  `const CACHE=${JSON.stringify(cache)};const SHELL=${JSON.stringify(paths)};const INDEX='/snap-cap/index.html';
self.addEventListener('install',e=>e.waitUntil(caches.open(CACHE).then(c=>c.addAll(SHELL))));
self.addEventListener('activate',e=>e.waitUntil((async()=>{for(const name of await caches.keys())if(name.startsWith('snap-cap-shell-')&&name!==CACHE)await caches.delete(name);await self.clients.claim();})()));
self.addEventListener('message',e=>{if(e.data?.type==='SKIP_WAITING')self.skipWaiting();if(e.data?.type==='RECACHE')e.waitUntil(caches.open(CACHE).then(c=>c.addAll(SHELL)));});
self.addEventListener('fetch',e=>{const u=new URL(e.request.url);if(e.request.method!=='GET'||u.origin!==location.origin||!u.pathname.startsWith('/snap-cap/'))return;e.respondWith((async()=>{const cache=await caches.open(CACHE);if(e.request.mode==='navigate'){const shell=await cache.match(INDEX);if(shell)return shell;try{const response=await fetch(INDEX);if(response.ok)await cache.put(INDEX,response.clone());return response;}catch{return Response.error();}}const saved=await cache.match(e.request);if(saved)return saved;const response=await fetch(e.request);if(response.ok&&SHELL.includes(u.pathname))await cache.put(e.request,response.clone());return response;})());});`,
);
console.log(`Offline app shell: ${paths.length} assets (${cache})`);
