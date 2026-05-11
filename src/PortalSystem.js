import * as THREE from "three";
import { portalVertexShader, portalFragmentShader } from "./portalShader.js";
import { WORLD_CONFIG } from "./config.js";

const RADIUS = 1.0;   // m — 2m diameter circle, character fits through comfortably

class Portal {
  constructor({ position, rotation, targetWorld, targetSpawn, color }) {
    this.targetWorld = targetWorld;
    this.targetSpawn = targetSpawn;
    // Portals start inactive — PortalSystem.activatePortal() adds them to scene.
    // During Phase 1 testing activateAll() is called immediately after world load.
    this._active = false;

    const portalColor = color instanceof THREE.Color ? color : new THREE.Color(color || 0x4444ff);
    const meshPos = position.clone();

    this.mesh = new THREE.Mesh(
      new THREE.CircleGeometry(RADIUS, 64),
      new THREE.ShaderMaterial({
        uniforms: {
          uTime:  { value: 0 },
          uColor: { value: portalColor.clone() },
        },
        vertexShader: portalVertexShader,
        fragmentShader: portalFragmentShader,
        transparent: true,
        side: THREE.DoubleSide,
        depthWrite: false,
      })
    );
    this.mesh.renderOrder = 10;
    this.mesh.frustumCulled = false;
    this.mesh.position.copy(meshPos);
    if (rotation) this.mesh.rotation.copy(rotation);

    // Glowing ring stroke around the portal
    this.ring = new THREE.Mesh(
      new THREE.TorusGeometry(RADIUS + 0.04, 0.06, 16, 64),
      new THREE.MeshStandardMaterial({
        color: portalColor,
        emissive: portalColor,
        emissiveIntensity: 2.5,
        metalness: 0.2,
        roughness: 0.3,
      })
    );
    this.ring.renderOrder = 11;
    this.ring.frustumCulled = false;
    this.ring.position.copy(meshPos);
    if (rotation) this.ring.rotation.copy(rotation);

    this.light = new THREE.PointLight(portalColor.getHex(), 3, 8);
    this.light.position.copy(meshPos);

    this.triggerBox = new THREE.Box3().setFromCenterAndSize(
      meshPos.clone(),
      new THREE.Vector3(RADIUS * 2 + 0.4, RADIUS * 2 + 0.4, 1.2)
    );
  }

  update(time) {
    this.mesh.material.uniforms.uTime.value = time;
  }

  checkPlayerCollision(playerPosition) {
    if (!this._active) return false;
    return this.triggerBox.containsPoint(playerPosition);
  }

  addToScene(scene) {
    this._active = true;
    scene.add(this.mesh);
    scene.add(this.ring);
    scene.add(this.light);
  }

  removeFromScene(scene) {
    this._active = false;
    scene.remove(this.mesh);
    scene.remove(this.ring);
    scene.remove(this.light);
  }

  dispose() {
    this.mesh.geometry.dispose();
    this.mesh.material.dispose();
    this.ring.geometry.dispose();
    this.ring.material.dispose();
  }
}

export class PortalSystem {
  constructor(scene) {
    this.scene = scene;
    this.portals = [];
    this._cooldown = false;
  }

  // Creates portal objects but does NOT add them to scene.
  // Call activateAll() or activatePortal() to make them visible/traversable.
  setupPortals(worldKey) {
    this.clearPortals();
    const config = WORLD_CONFIG[worldKey];
    if (!config) return;
    for (const cfg of config.portals) {
      const portal = new Portal(cfg);
      this.portals.push(portal);
    }
  }

  // Activate all portals for current world (used in Phase 1 before lantern system exists).
  activateAll() {
    console.log(`[Portals] activateAll — ${this.portals.length} portal(s)`);
    for (const portal of this.portals) {
      if (!portal._active) {
        portal.addToScene(this.scene);
        const p = portal.mesh.position;
        console.log(`[Portals] activated portal → ${portal.targetWorld} at x:${p.x.toFixed(2)} y:${p.y.toFixed(2)} z:${p.z.toFixed(2)}`);
      }
    }
  }

  // Activate a specific portal by index (used by LanternManager in Phase 4+).
  activatePortal(index = 0) {
    const portal = this.portals[index];
    if (portal && !portal._active) portal.addToScene(this.scene);
  }

  clearPortals() {
    for (const portal of this.portals) {
      portal.removeFromScene(this.scene);
      portal.dispose();
    }
    this.portals = [];
    this._cooldown = false;
  }

  update(time) {
    for (const portal of this.portals) portal.update(time);
  }

  checkCollisions(playerPosition) {
    if (this._cooldown) return null;
    for (const portal of this.portals) {
      if (portal.checkPlayerCollision(playerPosition)) {
        this._cooldown = true;
        setTimeout(() => { this._cooldown = false; }, 2000);
        return portal;
      }
    }
    return null;
  }
}
