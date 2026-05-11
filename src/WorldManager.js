import { SplatMesh } from "@sparkjsdev/spark";
import { WORLD_CONFIG } from "./config.js";

export class WorldManager {
  constructor(scene, physicsManager, portalSystem, uiManager) {
    this.scene = scene;
    this.physics = physicsManager;
    this.portals = portalSystem;
    this.ui = uiManager;
    this.cache = new Map();
    this.currentKey = null;
    this.isTransitioning = false;
  }

  async loadWorld(key) {
    if (key === "end") return null;
    if (this.cache.has(key)) return this.cache.get(key);

    const config = WORLD_CONFIG[key];
    if (!config) throw new Error(`Unknown world: ${key}`);

    const splatMesh = new SplatMesh({
      url: config.splatUrl,
      lod: true,
      onProgress: (p) => {
        if (this.ui) this.ui.setLoadingProgress(p);
        console.log(`Loading ${config.name}: ${(p * 100).toFixed(0)}%`);
      },
      onLoad: () => {
        console.log(`${config.name} splat loaded`);
      },
    });

    // Marble splats use Y-down convention; flip to match Three.js Y-up
    splatMesh.rotation.x = Math.PI;

    const worldData = { splatMesh, config };
    this.cache.set(key, worldData);

    await splatMesh.initialized;
    return worldData;
  }

  async switchWorld(targetKey, spawnPoint) {
    if (targetKey === "end") return null;
    if (this.isTransitioning) return null;
    this.isTransitioning = true;

    const config = WORLD_CONFIG[targetKey];
    if (!config) {
      this.isTransitioning = false;
      return null;
    }

    if (this.ui) {
      this.ui.showLoading(config.name);
      await this.ui.fadeOut();
    }

    if (this.currentKey) {
      const current = this.cache.get(this.currentKey);
      if (current) this.scene.remove(current.splatMesh);
      this.portals.clearPortals();
    }

    const world = await this.loadWorld(targetKey);
    this.scene.add(world.splatMesh);

    await this.physics.setColliderMesh(config.colliderUrl);
    this.portals.setupPortals(targetKey);

    this.currentKey = targetKey;
    this.isTransitioning = false;

    if (this.ui) {
      this.ui.setWorldName(config.name);
      this.ui.hideLoading();
      await this.ui.fadeIn();
    }

    return spawnPoint || config.spawnPoint;
  }

  preloadAdjacent() {
    if (!this.currentKey) return;
    const config = WORLD_CONFIG[this.currentKey];
    for (const portal of config.portals) {
      const key = portal.targetWorld;
      if (key === "end" || this.cache.has(key)) continue;
      this.loadWorld(key).catch((e) => console.warn(`Preload ${key} failed:`, e));
    }
  }
}
