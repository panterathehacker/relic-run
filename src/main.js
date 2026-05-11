import * as THREE from "three";
import { SparkRenderer, generators } from "@sparkjsdev/spark";
import { WorldManager } from "./WorldManager.js";
import { PhysicsManager } from "./PhysicsManager.js";
import { PortalSystem } from "./PortalSystem.js";
import { CharacterController } from "./CharacterController.js";
import { CameraRig } from "./CameraRig.js";
import { UIManager } from "./UIManager.js";
import { InteractionManager } from "./InteractionManager.js";
import { AnimalManager } from "./AnimalManager.js";
import { AudioManager } from "./AudioManager.js";
import { ShootingSystem } from "./ShootingSystem.js";
import { WORLD_CONFIG, ANIMAL_URLS } from "./config.js";

async function main() {
  // ── Three.js setup ───────────────────────────────────────────────
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(75, innerWidth / innerHeight, 0.1, 1000);
  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setSize(innerWidth, innerHeight);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.4;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  document.body.appendChild(renderer.domElement);

  // ── Spark setup ──────────────────────────────────────────────────
  const spark = new SparkRenderer({
    renderer,
    enableLod: true,
    lodSplatCount: 10000000,
    outsideFoveate: 0.0,     // no foveation — render full quality everywhere
    behindFoveate: 0.1,      // slight foveation behind camera
    autoUpdate: true,
  });
  scene.add(spark);

  // ── Lighting (character + portals + lanterns only) ───────────────
  scene.add(new THREE.AmbientLight(0xffffff, 1.0));
  const dirLight = new THREE.DirectionalLight(0xffffff, 1.2);
  dirLight.position.set(5, 10, 5);
  scene.add(dirLight);
  scene.add(new THREE.HemisphereLight(0x87CEEB, 0x362d1b, 0.5));

  // ── Systems ──────────────────────────────────────────────────────
  const ui = new UIManager();
  const physics = new PhysicsManager();
  await physics.init();

  const portals       = new PortalSystem(scene);
  const worlds        = new WorldManager(scene, physics, portals, ui);
  const character     = new CharacterController(scene, physics, { onJump: () => audio.playJump() });
  const cameraRig     = new CameraRig(camera, renderer.domElement, physics);
  const interactions  = new InteractionManager(scene, ui);
  const animals       = new AnimalManager(scene);
  const audio         = new AudioManager();
  const shooter       = new ShootingSystem(scene, physics.world);

  // ── Preload animal GLBs ──────────────────────────────────────────
  await animals.loadTemplates(Object.values(ANIMAL_URLS));

  // ── World 1 particles (temple golden motes) ─────────────────────
  // Keep always running so Spark's simulation never cold-starts (avoids the hang-then-fall stutter).
  // Opacity uniform is set to 0 when not in world1.
  const templeParticles = generators.snowBox({
    box: new THREE.Box3(new THREE.Vector3(-8, -3, -8), new THREE.Vector3(8, 5, 8)),
    fallDirection: new THREE.Vector3(0, -1, 0),
    fallVelocity: 0.12,
    wanderScale: 0.02,
    wanderVariance: 0.2,
    density: 4,
    minScale: 0.004,
    maxScale: 0.01,
    color1: new THREE.Color(1.0, 0.85, 0.45),
    color2: new THREE.Color(1.0, 0.65, 0.25),
    opacity: 0,
  });
  scene.add(templeParticles.snow);

  // ── Load character FBX ───────────────────────────────────────────
  await character.load();

  // ── Collider debug (G key) ───────────────────────────────────────
  const debugGroup = new THREE.Group();
  debugGroup.visible = false;
  scene.add(debugGroup);
  const debugMat = new THREE.MeshBasicMaterial({ color: 0x00ff88, wireframe: true, transparent: true, opacity: 0.35 });

  function rebuildColliderDebug() {
    while (debugGroup.children.length) {
      debugGroup.children[0].geometry.dispose();
      debugGroup.remove(debugGroup.children[0]);
    }
    for (const { vertices, indices } of physics.debugMeshData) {
      const geo = new THREE.BufferGeometry();
      geo.setAttribute("position", new THREE.BufferAttribute(vertices, 3));
      geo.setIndex(new THREE.BufferAttribute(indices, 1));
      debugGroup.add(new THREE.Mesh(geo, debugMat));
    }
  }

  window.addEventListener("keydown", (e) => {
    if (e.code === "KeyG") {
      debugGroup.visible = !debugGroup.visible;
      if (debugGroup.visible) rebuildColliderDebug();
    }
    if (e.code === "KeyE") { if (interactions.tryCollect()) audio.playOrbCollect(); }
    if (e.code === "Digit0") interactions.completeAll();
  });

  const _aimDir  = new THREE.Vector3();
  const _camDir  = new THREE.Vector3();

  function fireShot() {
    if (!cameraRig.isLocked || transitioning) return;

    camera.getWorldDirection(_camDir);

    const muzzle = new THREE.Vector3(
      character.position.x,
      character.position.y + 1.2,
      character.position.z,
    );

    // Aim toward crosshair: ray from camera center 100 units out, then direction to that point
    const aimPoint = camera.position.clone().addScaledVector(_camDir, 100);
    _aimDir.subVectors(aimPoint, muzzle).normalize();

    character.triggerShoot();
    shooter.shoot(muzzle, _aimDir);
  }

  window.addEventListener("mousedown", (e) => {
    if (e.button === 0 && !e.ctrlKey) fireShot();
    if (e.button === 2 || (e.button === 0 && e.ctrlKey)) {
      cameraRig.toggleFirstPerson();
      character.setMeshVisible(!cameraRig.firstPerson);
    }
  });

  window.addEventListener("contextmenu", (e) => e.preventDefault());

  window.addEventListener("resize", () => {
    camera.aspect = innerWidth / innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(innerWidth, innerHeight);
  });

  // ── World switch helper ──────────────────────────────────────────
  let transitioning = false;

  async function doWorldSwitch(targetKey, spawnOverride) {
    transitioning = true;
    try {
      const spawnPoint = await worlds.switchWorld(targetKey, spawnOverride);
      if (spawnPoint) character.spawn(spawnPoint);
      renderer.toneMappingExposure = WORLD_CONFIG[targetKey]?.exposure ?? 1.4;
      rebuildColliderDebug();
      worlds.preloadAdjacent();
      // Portal stays hidden until all interactions complete.
      interactions.init(
        WORLD_CONFIG[targetKey]?.interactions ?? [],
        () => {
          portals.activateAll();
          audio.playPortalOpen();
          ui.showNotification("Coordinates unlocked", 4000);
        }
      );
      animals.init(WORLD_CONFIG[targetKey]?.animals ?? []);
      audio.setTrack(WORLD_CONFIG[targetKey]?.audioTrack ?? null);
      shooter.clearAll();
      templeParticles.opacity.value = targetKey === "world1" ? 0.75 : 0;
    } finally {
      transitioning = false;
    }
  }

  // ── Title screen + background preload ───────────────────────────
  const preload = worlds.loadWorld("world1").catch(() => {});
  ui.showTitleScreen(preload, async () => {
    await doWorldSwitch("world1");
    setTimeout(() => worlds.preloadAdjacent(), 3000);
  });

  // ── Game loop ────────────────────────────────────────────────────
  let lastTime = 0;

  function animate(time) {
    requestAnimationFrame(animate);
    const dt = Math.min((time - lastTime) / 1000, 0.05);
    lastTime = time;

    character.update(dt, cameraRig.yaw);
    cameraRig.update(character.position);
    ui.updateCoords(character.position.x, character.position.y, character.position.z);
    physics.step(dt);
    portals.update(time / 1000);
    if (!transitioning) interactions.update(dt, character.position);
    animals.update(dt);
    shooter.update();
    for (let i = shooter.projectiles.length - 1; i >= 0; i--) {
      if (interactions.tryHitAt(shooter.projectiles[i].mesh.position)) {
        audio.playOrbCollect();
        shooter.removeAt(i);
      }
    }
    audio.update(dt, interactions.getNearestOrbDist(character.position), interactions._allFound);

    // Proximity preload
    if (worlds.currentKey && !transitioning) {
      for (const portal of portals.portals) {
        if (!portal._active) continue;
        const dist = character.position.distanceTo(portal.mesh.position);
        if (dist < 15 && portal.targetWorld !== "end" && !worlds.cache.has(portal.targetWorld)) {
          worlds.loadWorld(portal.targetWorld).catch(() => {});
        }
      }
    }

    // Portal collision
    if (!transitioning && cameraRig.isLocked) {
      const hitPortal = portals.checkCollisions(character.position);
      if (hitPortal) {
        audio.playPortalJump();
        if (hitPortal.targetWorld === "end") {
          transitioning = true;
          ui.fadeOut().then(() => {
            ui.showEndScreen(() => {
              transitioning = false;
              doWorldSwitch("world1").then(() => {
                ui.fadeIn();
              });
            });
          });
        } else {
          doWorldSwitch(hitPortal.targetWorld, hitPortal.targetSpawn);
        }
      }
    }

    renderer.render(scene, camera);
  }

  animate(0);
  console.log("Relic Run initialized");
}

main().catch((e) => {
  console.error("Fatal error:", e);
  document.body.innerHTML = `<div style="color:white;padding:40px;font:16px monospace;background:#111;min-height:100vh">
    <h2>Lightkeeper — Fatal Error</h2><pre>${e.stack || e.message}</pre>
  </div>`;
});
