// tools/generate-world.js
// Generate a Lightkeeper world via the Marble API.
//
// Usage:
//   node tools/generate-world.js --world world1
//   node tools/generate-world.js --world world2 --draft   (cheap ~30s test)
//   node tools/generate-world.js --world world3
//
// Saves result to world-assets.json (gitignored).
// Run tools/download-world.js afterward to fetch the SPZ + GLB files.

import { readFileSync, writeFileSync, existsSync } from "fs";
import { config } from "dotenv";
config();

const API_BASE = "https://api.worldlabs.ai/marble/v1";
const API_KEY  = process.env.WLT_API_KEY;

if (!API_KEY) {
  console.error("Error: WLT_API_KEY not set. Add it to .env");
  process.exit(1);
}

const args       = process.argv.slice(2);
const USE_DRAFT  = args.includes("--draft");
const WORLD_ARG  = args.includes("--world") ? args[args.indexOf("--world") + 1] : null;
const MODEL      = USE_DRAFT ? "marble-1.0-draft" : "marble-1.1-plus";

const WORLDS = {
  world1: {
    name: "Misty Temple at Dawn",
    prompt: `A serene Japanese temple on a misty mountainside at dawn. Wooden pagoda, stone steps, cherry blossoms, soft golden light through fog.`,
  },
  world2: {
    name: "Gothic Cathedral at Twilight",
    prompt: `The vast interior of an ancient Gothic cathedral at twilight. Towering stone columns, stained glass windows casting blue and purple light across the floor.`,
  },
  world3: {
    name: "Medieval Market Town",
    prompt: `A charming medieval village square at golden hour. Half-timbered buildings, cobblestone streets, colorful market stalls, warm amber light.`,
  },
};

if (!WORLD_ARG || !WORLDS[WORLD_ARG]) {
  console.error(`Usage: node tools/generate-world.js --world <world1|world2|world3> [--draft]`);
  console.error(`Available: ${Object.keys(WORLDS).join(", ")}`);
  process.exit(1);
}

async function apiFetch(path, method = "GET", body = null) {
  const opts = {
    method,
    headers: { "WLT-Api-Key": API_KEY, "Content-Type": "application/json" },
  };
  if (body) opts.body = JSON.stringify(body);
  const url = path.startsWith("http") ? path : `${API_BASE}/${path}`;
  const res = await fetch(url, opts);
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`API ${path}: HTTP ${res.status} — ${text}`);
  }
  return res.json();
}

async function generateWorld(key, cfg) {
  console.log(`\n[${key}] Generating: ${cfg.name}`);
  console.log(`[${key}] Model: ${MODEL}`);
  console.log(`[${key}] Prompt: "${cfg.prompt.substring(0, 80)}..."`);

  const op = await apiFetch("worlds:generate", "POST", {
    world_prompt: { type: "text", text_prompt: cfg.prompt },
    model: MODEL,
    display_name: cfg.name,
  });

  const opId = op.operation_id;
  if (!opId) throw new Error(`No operation_id: ${JSON.stringify(op)}`);
  console.log(`[${key}] Operation ID: ${opId}`);

  while (true) {
    await new Promise((r) => setTimeout(r, 8000));
    const status = await apiFetch(`operations/${opId}`);
    if (status.done) {
      const worldId = status.response?.world_id;
      if (!worldId) throw new Error(`No world_id in response: ${JSON.stringify(status)}`);
      console.log(`\n[${key}] Done! World ID: ${worldId}`);

      const world = await apiFetch(`worlds/${worldId}`);
      return world;
    }
    if (status.error) throw new Error(`Generation failed: ${JSON.stringify(status.error)}`);
    const pct = status.metadata?.progress_percent || 0;
    process.stdout.write(`\r[${key}] ${pct.toFixed(0)}%...`);
  }
}

async function main() {
  let results = {};
  if (existsSync("world-assets.json")) {
    results = JSON.parse(readFileSync("world-assets.json", "utf-8"));
    console.log("Loaded existing world-assets.json");
  }

  if (results[WORLD_ARG] && !args.includes("--force")) {
    console.log(`[${WORLD_ARG}] Already generated. Pass --force to regenerate.`);
    console.log(`[${WORLD_ARG}] World ID: ${results[WORLD_ARG].world_id || "(see world-assets.json)"}`);
    return;
  }

  try {
    results[WORLD_ARG] = await generateWorld(WORLD_ARG, WORLDS[WORLD_ARG]);
    writeFileSync("world-assets.json", JSON.stringify(results, null, 2));
    console.log(`\n[${WORLD_ARG}] Saved to world-assets.json`);
    console.log(`[${WORLD_ARG}] Next: node tools/download-world.js --world ${WORLD_ARG}`);
  } catch (e) {
    console.error(`\n[${WORLD_ARG}] FAILED:`, e.message);
    process.exit(1);
  }
}

main();
