import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { clone as skeletonClone } from "three/addons/utils/SkeletonUtils.js";
import { GLTFSpecularGlossinessPlugin } from "./GLTFSpecularGlossinessPlugin.js";

const FADE_DURATION  = 0.4;  // cross-fade between cycle clips
const MIN_HOLD_TIME  = 2.0;  // minimum seconds per clip (handles zero-duration pose clips)

function makeLoader() {
  const loader = new GLTFLoader();
  loader.register(parser => new GLTFSpecularGlossinessPlugin(parser));
  return loader;
}

export class AnimalManager {
  constructor(scene) {
    this.scene      = scene;
    this._animals   = [];
    this._templates = {};
  }

  async loadTemplates(urls) {
    const loader = makeLoader();
    await Promise.all(urls.map(url =>
      loader.loadAsync(url)
        .then(gltf => {
          console.log(`[Animals] ${url.split("/").pop()} — clips:`,
            gltf.animations.map(a => a.name));
          this._templates[url] = gltf;
        })
        .catch(err => console.warn("[Animals] failed:", url, err))
    ));
  }

  init(defs) {
    this.dispose();
    for (const def of defs) {
      const gltf = this._templates[def.url];
      if (!gltf) { console.warn("[Animals] template not ready:", def.url); continue; }

      const instance = skeletonClone(gltf.scene);
      instance.scale.setScalar(def.scale ?? 1.0);
      instance.position.set(def.x, def.y, def.z);
      if (def.yaw !== undefined) instance.rotation.y = def.yaw;
      this.scene.add(instance);

      const mixer = new THREE.AnimationMixer(instance);
      const clips = gltf.animations;
      const patrol = def.patrol ?? true;

      // Resolve clip list
      let clipList = [];
      if (def.cycleAnims?.length) {
        clipList = def.cycleAnims.map(n => clips.find(c => c.name === n)).filter(Boolean);
      } else if (def.animName) {
        const c = clips.find(c => c.name === def.animName);
        if (c) clipList = [c];
      } else if (def.preferAnims?.length) {
        const c = clips.find(a => def.preferAnims.some(p => a.name.toLowerCase().includes(p)));
        if (c) clipList = [c];
      }
      if (!clipList.length) {
        const c = clips.find(a => /walk|run/i.test(a.name)) ?? clips[0];
        if (c) clipList = [c];
      }

      const isCycling = clipList.length > 1;

      // All clips use LoopRepeat — weights are cross-faded by timer, no clamping issues
      const actions = clipList.map((clip, i) => {
        const a = mixer.clipAction(clip);
        a.setLoop(THREE.LoopRepeat);
        a.setEffectiveWeight(i === 0 ? 1 : 0);
        a.play();
        return a;
      });

      const firstHold = Math.max(clipList[0].duration, MIN_HOLD_TIME);

      this._animals.push({
        instance, mixer,
        spawnX: def.x, spawnZ: def.z, groundY: def.y,
        radius: patrol ? (def.radius ?? 0.5) : 0,
        speed: def.speed ?? 0.4,
        angle: Math.random() * Math.PI * 2,
        patrol,
        isCycling,
        actions,
        clipList,
        currentIdx: 0,
        cycleTimer: isCycling ? firstHold : Infinity,
      });
    }
  }

  update(dt) {
    for (const a of this._animals) {
      a.mixer.update(dt);

      // Advance animation cycle by timer (weight cross-fade, no reset)
      if (a.isCycling) {
        a.cycleTimer -= dt;
        if (a.cycleTimer <= 0) {
          a.actions[a.currentIdx].fadeOut(FADE_DURATION);
          a.currentIdx = (a.currentIdx + 1) % a.actions.length;
          a.actions[a.currentIdx].fadeIn(FADE_DURATION);
          a.cycleTimer = Math.max(a.clipList[a.currentIdx].duration, MIN_HOLD_TIME);
        }
      }

      // Patrol movement
      if (!a.patrol || a.radius === 0) continue;

      a.angle += a.speed * dt;
      const px = a.spawnX + Math.cos(a.angle) * a.radius;
      const pz = a.spawnZ + Math.sin(a.angle) * a.radius;
      const prevX = a.instance.position.x;
      const prevZ = a.instance.position.z;

      a.instance.position.set(px, a.groundY, pz);
      const dx = px - prevX, dz = pz - prevZ;
      if (Math.hypot(dx, dz) > 0.0001)
        a.instance.rotation.y = Math.atan2(dx, dz);
    }
  }

  dispose() {
    for (const a of this._animals) {
      this.scene.remove(a.instance);
      a.mixer.stopAllAction();
    }
    this._animals = [];
  }
}
