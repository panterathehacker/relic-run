import * as THREE from "three";
import RAPIER from "@dimforge/rapier3d-compat";

export class ShootingSystem {
  static BALL_RADIUS   = 0.025;
  static RESTITUTION   = 0.25;
  static FRICTION      = 0.9;
  static DENSITY       = 1.5;
  static LAUNCH_SPEED  = 18;    // m/s — set via setLinvel for predictable speed
  static LIFETIME      = 8000;  // ms
  static MAX_PROJECTILES = 20;

  constructor(scene, physicsWorld) {
    this.scene        = scene;
    this.physicsWorld = physicsWorld;
    this.projectiles  = [];

    this._geo = new THREE.SphereGeometry(ShootingSystem.BALL_RADIUS, 12, 12);
    this._mat = new THREE.MeshStandardMaterial({
      color: 0xff3333,
      roughness: 0.3,
      metalness: 0.7,
      emissive: new THREE.Color(0xff1111),
      emissiveIntensity: 0.4,
    });
  }

  // muzzlePos: THREE.Vector3 — where the ball spawns (character's hand area)
  // aimDir:    THREE.Vector3 — unit vector toward crosshair aim point
  shoot(muzzlePos, aimDir) {
    if (this.projectiles.length >= ShootingSystem.MAX_PROJECTILES) {
      this._remove(0);
    }

    const mesh = new THREE.Mesh(this._geo, this._mat);
    mesh.position.copy(muzzlePos);
    this.scene.add(mesh);

    const bodyDesc = RAPIER.RigidBodyDesc.dynamic()
      .setTranslation(muzzlePos.x, muzzlePos.y, muzzlePos.z)
      .setLinearDamping(0.1)
      .setAngularDamping(0.6)
      .setCcdEnabled(true);
    const body = this.physicsWorld.createRigidBody(bodyDesc);

    const collDesc = RAPIER.ColliderDesc.ball(ShootingSystem.BALL_RADIUS)
      .setRestitution(ShootingSystem.RESTITUTION)
      .setFriction(ShootingSystem.FRICTION)
      .setDensity(ShootingSystem.DENSITY);
    this.physicsWorld.createCollider(collDesc, body);

    const s = ShootingSystem.LAUNCH_SPEED;
    body.setLinvel({ x: aimDir.x * s, y: aimDir.y * s, z: aimDir.z * s }, true);

    this.projectiles.push({ mesh, body, createdAt: performance.now() });
  }

  update() {
    const now = performance.now();
    for (let i = this.projectiles.length - 1; i >= 0; i--) {
      const p = this.projectiles[i];
      const pos = p.body.translation();
      const rot = p.body.rotation();
      p.mesh.position.set(pos.x, pos.y, pos.z);
      p.mesh.quaternion.set(rot.x, rot.y, rot.z, rot.w);
      if (now - p.createdAt > ShootingSystem.LIFETIME) this._remove(i);
    }
  }

  removeAt(i) { this._remove(i); }

  _remove(i) {
    const p = this.projectiles[i];
    this.scene.remove(p.mesh);
    this.physicsWorld.removeRigidBody(p.body);
    this.projectiles.splice(i, 1);
  }

  clearAll() {
    while (this.projectiles.length) this._remove(0);
  }

  dispose() {
    this.clearAll();
    this._geo.dispose();
    this._mat.dispose();
  }
}
