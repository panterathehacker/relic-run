import * as THREE from "three";
import RAPIER from "@dimforge/rapier3d-compat";
import { FBXLoader } from "three/addons/loaders/FBXLoader.js";

const WALK_SPEED = 2.0;
const RUN_SPEED  = 3.8;
const JUMP_SPEED = 4.0;
const GRAVITY    = -9.81;

// Mixamo FBX: strip armature prefix, remove root-motion position channel, trim duplicate last frame.
function normalizeMixamoClip(clip) {
  clip.tracks.forEach((track) => {
    track.name = track.name.replace(/^[^|]*\|/, "");
  });
  clip.tracks = clip.tracks.filter(t => !t.name.endsWith("Hips.position"));
  if (clip.tracks.length > 0) {
    const times = clip.tracks[0].times;
    if (times.length > 1) clip.duration = times[times.length - 2];
  }
  return clip;
}

export class CharacterController {
  constructor(scene, physicsManager, { onJump } = {}) {
    this.scene    = scene;
    this.physics  = physicsManager;
    this.position = new THREE.Vector3();
    this.isLoaded = false;
    this._onJump  = onJump ?? null;

    this._mesh    = null;
    this._mixer   = null;
    this._actions = {};
    this._current = null;

    this._body     = null;
    this._collider = null;
    this._kcc      = null;

    this._verticalVelocity = 0;
    this._grounded         = false;
    this._meshYaw          = Math.PI;
    this._keys             = {};
    this._jumpPending      = false;
    this._jumpTimer        = 0;
    this._isShooting       = false;


    document.addEventListener("keydown", (e) => {
      this._keys[e.code] = true;
      if (e.code === "Space" && !e.repeat) this._jumpPending = true;
    });
    document.addEventListener("keyup", (e) => { this._keys[e.code] = false; });
  }

  async load() {
    const loader = new FBXLoader();

    const idleFbx = await loader.loadAsync("./character/idle.fbx");
    idleFbx.scale.setScalar(0.007);
    idleFbx.traverse((child) => {
      if (child.isMesh) child.frustumCulled = false;
    });
    this._mesh  = idleFbx;
    this._mixer = new THREE.AnimationMixer(idleFbx);

    const [walkFbx, runFbx, jumpFbx] = await Promise.all([
      loader.loadAsync("./character/walk.fbx"),
      loader.loadAsync("./character/run.fbx"),
      loader.loadAsync("./character/Jumping.fbx"),
    ]);

    this._actions.idle = this._mixer.clipAction(normalizeMixamoClip(idleFbx.animations[0]));
    this._actions.walk = this._mixer.clipAction(normalizeMixamoClip(walkFbx.animations[0]));
    this._actions.run  = this._mixer.clipAction(normalizeMixamoClip(runFbx.animations[0]));
    const jumpClip = normalizeMixamoClip(jumpFbx.animations[0]);
    jumpClip.duration = Math.min(jumpClip.duration, 50 / 30); // clamp to first 50 frames at 30fps
    this._actions.jump = this._mixer.clipAction(jumpClip);

    for (const action of [this._actions.idle, this._actions.walk, this._actions.run]) {
      action.setLoop(THREE.LoopRepeat, Infinity);
    }
    this._actions.jump.setLoop(THREE.LoopOnce, 1);
    this._actions.jump.clampWhenFinished = true;

    // Shooting animation — optional, loads gracefully if file missing
    try {
      const shootFbx = await loader.loadAsync("./character/shooting.fbx");
      this._actions.shoot = this._mixer.clipAction(normalizeMixamoClip(shootFbx.animations[0]));
      this._actions.shoot.setLoop(THREE.LoopOnce, 1);
      this._actions.shoot.clampWhenFinished = true;
    } catch {
      console.warn("[CharacterController] shooting.fbx not found — shoot anim disabled");
    }

    this._actions.idle.play();
    this._current = this._actions.idle;

    this.scene.add(this._mesh);
    this.isLoaded = true;
  }

  get meshYaw() { return this._meshYaw; }

  setMeshVisible(v) { if (this._mesh) this._mesh.visible = v; }

  triggerShoot() {
    if (!this._actions.shoot) return;
    if (this._isShooting) return;
    this._isShooting = true;
    this._current.fadeOut(0.1);
    this._actions.shoot.reset().setEffectiveTimeScale(1).setEffectiveWeight(1).fadeIn(0.1).play();
    this._current = this._actions.shoot;
  }

  spawn(spawnPoint) {
    this._buildPhysicsBody(spawnPoint);
    this._verticalVelocity = 0;
    this._grounded         = false;
    this._syncMesh(spawnPoint.yaw ?? Math.PI);
  }

  _buildPhysicsBody(spawn) {
    const world = this.physics.world;
    if (this._kcc)  { world.removeCharacterController(this._kcc); this._kcc  = null; }
    if (this._body) { world.removeRigidBody(this._body);          this._body = null; }

    this._kcc = world.createCharacterController(0.01);
    this._kcc.setMaxSlopeClimbAngle(45 * Math.PI / 180);
    this._kcc.setMinSlopeSlideAngle(60 * Math.PI / 180);
    this._kcc.enableAutostep(0.5, 0.3, true);
    this._kcc.enableSnapToGround(0.5);
    this._kcc.setApplyImpulsesToDynamicBodies(true);

    const bodyDesc = RAPIER.RigidBodyDesc.kinematicPositionBased()
      .setTranslation(spawn.x, spawn.y + 0.8, spawn.z);
    this._body = world.createRigidBody(bodyDesc);

    const collDesc = RAPIER.ColliderDesc.capsule(0.5, 0.3).setFriction(0.0);
    this._collider = world.createCollider(collDesc, this._body);
  }

  update(dt, cameraYaw) {
    if (!this._body || !this._kcc) return;

    // ── Input ────────────────────────────────────────────────────────
    let mx = 0, mz = 0;
    if (this._keys["KeyW"] || this._keys["ArrowUp"])    mz -= 1;
    if (this._keys["KeyS"] || this._keys["ArrowDown"])  mz += 1;
    if (this._keys["KeyD"] || this._keys["ArrowRight"]) mx += 1;
    if (this._keys["KeyA"] || this._keys["ArrowLeft"])  mx -= 1;

    const sprinting = this._keys["ShiftLeft"] || this._keys["ShiftRight"];
    const speed     = sprinting ? RUN_SPEED : WALK_SPEED;
    const hasInput  = mx !== 0 || mz !== 0;

    const cosY = Math.cos(cameraYaw), sinY = Math.sin(cameraYaw);
    const worldX = mx * cosY + mz * sinY;
    const worldZ = -mx * sinY + mz * cosY;

    // ── Vertical velocity ────────────────────────────────────────────
    let jumpFired = false;
    if (this._grounded) {
      this._verticalVelocity = 0;
      if (this._jumpPending) { this._verticalVelocity = JUMP_SPEED; jumpFired = true; }
    } else {
      this._verticalVelocity += GRAVITY * dt;
    }
    this._jumpPending = false;

    // ── KCC ──────────────────────────────────────────────────────────
    const desired = { x: worldX * speed * dt, y: this._verticalVelocity * dt, z: worldZ * speed * dt };
    this._kcc.computeColliderMovement(this._collider, desired);
    const corrected = this._kcc.computedMovement();
    this._grounded  = this._kcc.computedGrounded();

    const cur = this._body.translation();
    this._body.setNextKinematicTranslation({
      x: cur.x + corrected.x,
      y: cur.y + corrected.y,
      z: cur.z + corrected.z,
    });

    // ── Sync visuals ─────────────────────────────────────────────────
    const p = this._body.translation();
    this.position.set(p.x, p.y - 0.8, p.z);

    if (this._mesh) {
      this._mesh.position.copy(this.position);
      if (hasInput) {
        const targetYaw = Math.atan2(worldX, worldZ);
        let diff = targetYaw - this._meshYaw;
        while (diff >  Math.PI) diff -= 2 * Math.PI;
        while (diff < -Math.PI) diff += 2 * Math.PI;
        this._meshYaw += diff * Math.min(1, 10 * dt);
        this._mesh.rotation.y = this._meshYaw;
      }
    }

    // ── Animation state machine ──────────────────────────────────────
    if (this._mixer) {
      this._mixer.update(dt);

      if (this._isShooting && this._current === this._actions.shoot) {
        if (!this._actions.shoot.isRunning()) {
          this._isShooting = false;
          const next = !hasInput ? this._actions.idle : sprinting ? this._actions.run : this._actions.walk;
          this._current.fadeOut(0.15);
          next.reset().setEffectiveTimeScale(1).setEffectiveWeight(1).fadeIn(0.15).play();
          this._current = next;
        }
      } else if (jumpFired) {
        this._onJump?.();
        this._jumpTimer = 0;
        this._current.fadeOut(0.1);
        this._actions.jump.reset()
          .setEffectiveTimeScale(1.0)
          .setEffectiveWeight(1)
          .fadeIn(0.1)
          .play();
        this._current = this._actions.jump;
      } else if (this._current === this._actions.jump) {
        this._jumpTimer += dt;
        // Exit when physically landed (after 0.3s guard past snap-to-ground window) or clip done
        const landed  = this._grounded && this._jumpTimer > 0.3;
        const clipDone = !this._actions.jump.isRunning();
        if (landed || clipDone) {
          const landing = !hasInput ? this._actions.idle : sprinting ? this._actions.run : this._actions.walk;
          this._current.fadeOut(0.15);
          landing.reset().setEffectiveTimeScale(1).setEffectiveWeight(1).fadeIn(0.15).play();
          this._current = landing;
        }
      } else {
        // Ground locomotion
        const next = !hasInput ? this._actions.idle : sprinting ? this._actions.run : this._actions.walk;
        if (next !== this._current) {
          this._current.fadeOut(0.2);
          next.reset().setEffectiveTimeScale(1).setEffectiveWeight(1).fadeIn(0.2).play();
          this._current = next;
        }
      }
    }
  }

  _syncMesh(yaw) {
    if (!this._mesh) return;
    const p = this._body.translation();
    this.position.set(p.x, p.y - 0.8, p.z);
    this._mesh.position.copy(this.position);
    this._meshYaw        = yaw;
    this._mesh.rotation.y = yaw;
  }

  dispose() {
    const w = this.physics.world;
    if (this._kcc)  w.removeCharacterController(this._kcc);
    if (this._body) w.removeRigidBody(this._body);
    if (this._mesh) this.scene.remove(this._mesh);
  }
}
