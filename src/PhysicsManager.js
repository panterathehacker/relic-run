import RAPIER from "@dimforge/rapier3d-compat";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";

export class PhysicsManager {
  constructor() {
    this.world = null;
    this.colliderHandles = [];
    this.debugMeshData = []; // { vertices: Float32Array, indices: Uint32Array }
    this.playerBody = null;
    this.gltfLoader = new GLTFLoader();
  }

  async init() {
    await RAPIER.init();
    this.world = new RAPIER.World({ x: 0, y: -9.81, z: 0 });
    console.log("Rapier physics initialized");
  }

  async setColliderMesh(colliderUrl) {
    for (const handle of this.colliderHandles) {
      this.world.removeCollider(handle, true);
    }
    this.colliderHandles = [];
    this.debugMeshData = [];

    let gltf;
    try {
      gltf = await this.gltfLoader.loadAsync(colliderUrl);
    } catch (e) {
      console.warn(`Collider mesh not found at ${colliderUrl}, using fallback ground plane`);
      this._addFallbackGround();
      return;
    }

    gltf.scene.traverse((child) => {
      if (!child.isMesh) return;
      const geo = child.geometry;
      if (!geo.index) {
        console.warn("Collider mesh has no index buffer, skipping", child.name);
        return;
      }

      child.updateWorldMatrix(true, false);
      const posAttr = geo.attributes.position;
      const vertices = new Float32Array(posAttr.array.length);

      for (let i = 0; i < posAttr.count; i++) {
        const x = posAttr.getX(i);
        const y = posAttr.getY(i);
        const z = posAttr.getZ(i);
        const wm = child.matrixWorld;
        vertices[i * 3 + 0] = wm.elements[0] * x + wm.elements[4] * y + wm.elements[8]  * z + wm.elements[12];
        vertices[i * 3 + 1] = wm.elements[1] * x + wm.elements[5] * y + wm.elements[9]  * z + wm.elements[13];
        vertices[i * 3 + 2] = wm.elements[2] * x + wm.elements[6] * y + wm.elements[10] * z + wm.elements[14];
      }

      // Flip Y and Z to match the SplatMesh rotation.x = Math.PI applied in WorldManager
      for (let i = 0; i < posAttr.count; i++) {
        vertices[i * 3 + 1] *= -1;
        vertices[i * 3 + 2] *= -1;
      }

      const indices = new Uint32Array(geo.index.array);
      this.debugMeshData.push({ vertices: vertices.slice(), indices: new Uint32Array(indices) });
      const colliderDesc = RAPIER.ColliderDesc.trimesh(vertices, indices)
        .setRestitution(0.15)
        .setFriction(0.8);
      const handle = this.world.createCollider(colliderDesc);
      this.colliderHandles.push(handle);
    });

    console.log(`Physics colliders loaded from ${colliderUrl} (${this.colliderHandles.length} meshes)`);
    this._addFallbackGround();
  }

  _addFallbackGround() {
    const groundDesc = RAPIER.ColliderDesc.cuboid(200, 0.1, 200)
      .setTranslation(0, -20, 0)
      .setRestitution(0.1)
      .setFriction(0.9);
    const handle = this.world.createCollider(groundDesc);
    this.colliderHandles.push(handle);
  }

  createPlayerBody(spawnPoint) {
    if (this.playerBody) {
      this.world.removeRigidBody(this.playerBody);
    }
    const bodyDesc = RAPIER.RigidBodyDesc.kinematicPositionBased()
      .setTranslation(spawnPoint.x, spawnPoint.y, spawnPoint.z);
    this.playerBody = this.world.createRigidBody(bodyDesc);

    const colliderDesc = RAPIER.ColliderDesc.capsule(0.5, 0.3);
    this.world.createCollider(colliderDesc, this.playerBody);
  }

  updatePlayerPosition(position) {
    if (!this.playerBody) return;
    this.playerBody.setTranslation({ x: position.x, y: position.y, z: position.z }, true);
  }

  // Returns time-of-impact (distance) to first hit, or null if no hit.
  castRay(origin, direction, maxDistance) {
    if (!this.world) return null;
    const ray = new RAPIER.Ray(
      { x: origin.x,    y: origin.y,    z: origin.z },
      { x: direction.x, y: direction.y, z: direction.z },
    );
    const hit = this.world.castRay(ray, maxDistance, false);
    return hit ? hit.timeOfImpact : null;
  }

  step(dt) {
    if (!this.world) return;
    this.world.timestep = Math.min(dt, 1 / 30);
    this.world.step();
  }
}
