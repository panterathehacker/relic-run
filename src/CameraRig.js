import * as THREE from "three";

const DISTANCE        = 1.5;    // m behind character
const INITIAL_PITCH   = 0.05;
const HEIGHT          = 1.5;    // m — fixed vertical offset; keep close to LOOK_AT_OFFSET
const SENSITIVITY     = 0.002;
const MIN_PITCH       = -1.2;   // radians — ~69° up
const MAX_PITCH       =  0.9;   // radians — ~52° down
const LOOK_AT_OFFSET  = 0.9;    // m above feet — looks at back of shoulders on smaller character

export class CameraRig {
  constructor(camera, canvas, physicsManager) {
    this.camera   = camera;
    this.canvas   = canvas;
    this.physics  = physicsManager;
    this.yaw          = 0;
    this.pitch        = INITIAL_PITCH;
    this.isLocked     = false;
    this._firstPerson = false;

    this._onMouseMove  = this._onMouseMove.bind(this);
    this._onLockChange = this._onLockChange.bind(this);

    canvas.addEventListener("click", () => {
      if (!this.isLocked) canvas.requestPointerLock();
    });
    document.addEventListener("pointerlockchange", this._onLockChange);
    document.addEventListener("mousemove",         this._onMouseMove);
  }

  _onLockChange() {
    const locked = document.pointerLockElement === this.canvas;
    if (locked && !this.isLocked) {
      // Reset to clean over-shoulder angle every time the player clicks in —
      // prevents accumulated pitch/yaw from previous testing sessions drifting the camera.
      this.pitch = INITIAL_PITCH;
      this.yaw   = 0;
    }
    this.isLocked = locked;
  }

  _onMouseMove(e) {
    if (!this.isLocked) return;
    this.yaw   -= e.movementX * SENSITIVITY;
    this.pitch += e.movementY * SENSITIVITY;
    this.pitch  = Math.max(MIN_PITCH, Math.min(MAX_PITCH, this.pitch));
  }

  get firstPerson() { return this._firstPerson; }

  toggleFirstPerson() { this._firstPerson = !this._firstPerson; }

  update(characterPosition) {
    if (this._firstPerson) {
      const eyeY  = characterPosition.y + 1.55;
      this.camera.position.set(characterPosition.x, eyeY, characterPosition.z);
      const cosP  = Math.cos(this.pitch), sinP = Math.sin(this.pitch);
      const cosY  = Math.cos(this.yaw),   sinY = Math.sin(this.yaw);
      this.camera.lookAt(
        characterPosition.x - cosP * sinY * 10,
        eyeY                - sinP        * 10,
        characterPosition.z - cosP * cosY * 10,
      );
      return;
    }

    const cosP = Math.cos(this.pitch);
    const sinP = Math.sin(this.pitch);
    const cosY = Math.cos(this.yaw);
    const sinY = Math.sin(this.yaw);

    // Look-at point: slightly above character feet
    const lookAt = new THREE.Vector3(
      characterPosition.x,
      characterPosition.y + LOOK_AT_OFFSET,
      characterPosition.z,
    );

    // Ideal camera offset from look-at
    const offsetX =  DISTANCE * cosP * sinY;
    const offsetY =  DISTANCE * sinP + (HEIGHT - LOOK_AT_OFFSET);
    const offsetZ =  DISTANCE * cosP * cosY;
    const idealPos = lookAt.clone().add(new THREE.Vector3(offsetX, offsetY, offsetZ));

    // Ray-cast from look-at to ideal position — pull camera in if occluded.
    // Start 1m past the look-at to avoid the ray immediately hitting the player's
    // own capsule collider (which would clamp finalDist to ~0.5m every frame).
    const dir      = idealPos.clone().sub(lookAt).normalize();
    const dist     = idealPos.distanceTo(lookAt);
    const SKIP     = 1.0;
    const skipPt   = lookAt.clone().addScaledVector(dir, SKIP);
    const checkDist = dist - SKIP;
    const toi      = checkDist > 0 ? this.physics.castRay(skipPt, dir, checkDist) : null;
    const finalDist = toi !== null ? Math.max(0.5, SKIP + toi - 0.15) : dist;

    this.camera.position.copy(lookAt).addScaledVector(dir, finalDist);
    this.camera.lookAt(lookAt);
  }

  dispose() {
    document.removeEventListener("pointerlockchange", this._onLockChange);
    document.removeEventListener("mousemove",         this._onMouseMove);
  }
}
