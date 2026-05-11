// tools/download-world.js
// Download SPZ splat + GLB collider for a generated world.
//
// Usage:
//   node tools/download-world.js --world world1
//   node tools/download-world.js --world all
//
// Requires world-assets.json (produced by generate-world.js).
// Downloads to: public/worlds/{key}/splat.spz and collider.glb

import fs from "fs";
import path from "path";

const assetsFile = "world-assets.json";

if (!fs.existsSync(assetsFile)) {
  console.error("world-assets.json not found. Run generate-world.js first.");
  process.exit(1);
}

const assets = JSON.parse(fs.readFileSync(assetsFile, "utf-8"));

const args      = process.argv.slice(2);
const WORLD_ARG = args.includes("--world") ? args[args.indexOf("--world") + 1] : null;

if (!WORLD_ARG) {
  console.error("Usage: node tools/download-world.js --world <world1|world2|world3|all>");
  process.exit(1);
}

const keys = WORLD_ARG === "all" ? Object.keys(assets) : [WORLD_ARG];

async function download(url, filepath) {
  if (!url) { console.warn(`  Skipping (no URL) -> ${filepath}`); return; }

  const dir = path.dirname(filepath);
  fs.mkdirSync(dir, { recursive: true });

  if (fs.existsSync(filepath)) {
    const size = fs.statSync(filepath).size;
    if (size > 1024) {
      console.log(`  Already exists: ${filepath} (${(size / 1024 / 1024).toFixed(1)} MB)`);
      return;
    }
  }

  console.log(`  Downloading -> ${filepath}`);
  const res = await fetch(url);
  if (!res.ok) { console.error(`  Failed: HTTP ${res.status} for ${url.substring(0, 80)}`); return; }
  const buffer = Buffer.from(await res.arrayBuffer());
  fs.writeFileSync(filepath, buffer);
  console.log(`  Saved (${(buffer.length / 1024 / 1024).toFixed(1)} MB)`);
}

function findSplatUrl(world) {
  const spzUrls = world.assets?.splats?.spz_urls;
  if (spzUrls) {
    return spzUrls.full_res || spzUrls["1000k"] || spzUrls["500k"] || spzUrls["100k"]
        || Object.values(spzUrls).find((u) => typeof u === "string");
  }
  function searchSpz(obj, depth = 0) {
    if (depth > 4 || !obj || typeof obj !== "object") return null;
    for (const val of Object.values(obj)) {
      if (typeof val === "string" && val.includes(".spz")) return val;
      const found = searchSpz(val, depth + 1);
      if (found) return found;
    }
    return null;
  }
  return searchSpz(world);
}

function findColliderUrl(world) {
  if (world.assets?.mesh?.collider_mesh_url) return world.assets.mesh.collider_mesh_url;
  function searchGlb(obj, depth = 0) {
    if (depth > 4 || !obj || typeof obj !== "object") return null;
    for (const val of Object.values(obj)) {
      if (typeof val === "string" && val.includes(".glb")) return val;
      const found = searchGlb(val, depth + 1);
      if (found) return found;
    }
    return null;
  }
  return searchGlb(world);
}

async function main() {
  for (const key of keys) {
    const world = assets[key];
    if (!world) {
      console.error(`[${key}] Not found in world-assets.json. Run generate-world.js --world ${key} first.`);
      continue;
    }

    console.log(`\n[${key}]`);
    const splatUrl   = findSplatUrl(world);
    const colliderUrl = findColliderUrl(world);

    console.log(`  Splat:    ${splatUrl   ? "found" : "NOT FOUND"}`);
    console.log(`  Collider: ${colliderUrl ? "found" : "NOT FOUND"}`);

    if (splatUrl)    await download(splatUrl,    `public/worlds/${key}/splat.spz`);
    else             console.error(`  ERROR: No .spz URL for ${key}`);

    if (colliderUrl) await download(colliderUrl, `public/worlds/${key}/collider.glb`);
    else             console.warn(`  WARNING: No collider for ${key} — will use fallback ground`);
  }
  console.log("\nDownload complete.");
}

main().catch((e) => { console.error("Fatal:", e); process.exit(1); });
