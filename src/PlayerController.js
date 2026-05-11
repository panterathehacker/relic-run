import * as THREE from "three";

// Placeholder first-person controller for Phase 1 / M1 verification.
// This gets replaced by CharacterController + CameraRig in Phase 3.
export class PlayerController {
  constructor(camera, canvas) {
    this.camera = camera;
    this.canvas = canvas;
    this.moveSpeed = 2.5;
    this.mouseSensitivity = 0.0015;
    this.position = new THREE.Vector3(0, 1.6, 0);
    this.euler = new THREE.Euler(0, 0, 0, "YXZ");
    this.velocity = new THREE.Vector3();
    this.keys = {};
    this.isLocked = false;

    this._onMouseMove = this._onMouseMove.bind(this);
    this._onLockChange = this._onLockChange.bind(this);
    this._onKeyDown = this._onKeyDown.bind(this);
    this._onKeyUp = this._onKeyUp.bind(this);

    this._setupPointerLock();
    this._setupKeyboard();
  }

  _setupPointerLock() {
    this.canvas.addEventListener("click", () => {
      if (!this.isLocked) this.canvas.requestPointerLock();
    });
    document.addEventListener("pointerlockchange", this._onLockChange);
    document.addEventListener("mousemove", this._onMouseMove);
  }

  _onLockChange() {
    this.isLocked = document.pointerLockElement === this.canvas;
  }

  _onMouseMove(e) {
    if (!this.isLocked) return;
    this.euler.y -= e.movementX * this.mouseSensitivity;
    this.euler.x -= e.movementY * this.mouseSensitivity;
    this.euler.x = Math.max(-Math.PI / 2 + 0.01, Math.min(Math.PI / 2 - 0.01, this.euler.x));
    this.camera.quaternion.setFromEuler(this.euler);
  }

  _setupKeyboard() {
    document.addEventListener("keydown", this._onKeyDown);
    document.addEventListener("keyup", this._onKeyUp);
  }

  _onKeyDown(e) { this.keys[e.code] = true; }
  _onKeyUp(e)   { this.keys[e.code] = false; }

  update(dt) {
    if (!this.isLocked) return;

    const forward = new THREE.Vector3();
    this.camera.getWorldDirection(forward);
    forward.y = 0;
    forward.normalize();

    const right = new THREE.Vector3().crossVectors(forward, new THREE.Vector3(0, 1, 0));

    this.velocity.set(0, 0, 0);
    if (this.keys["KeyW"] || this.keys["ArrowUp"])    this.velocity.add(forward);
    if (this.keys["KeyS"] || this.keys["ArrowDown"])  this.velocity.sub(forward);
    if (this.keys["KeyD"] || this.keys["ArrowRight"]) this.velocity.add(right);
    if (this.keys["KeyA"] || this.keys["ArrowLeft"])  this.velocity.sub(right);
    if (this.keys["Space"])                           this.velocity.y += 1;
    if (this.keys["ShiftLeft"] || this.keys["ShiftRight"]) this.velocity.y -= 1;

    if (this.velocity.lengthSq() > 0) {
      this.velocity.normalize();
      this.velocity.multiplyScalar(this.moveSpeed * dt);
      this.position.add(this.velocity);
    }

    this.camera.position.copy(this.position);
  }

  teleport(point) {
    this.position.set(point.x, point.y, point.z);
    this.camera.position.copy(this.position);
    if (point.yaw !== undefined) {
      this.euler.y = point.yaw;
      this.euler.x = 0;
      this.camera.quaternion.setFromEuler(this.euler);
    }
  }

  dispose() {
    document.removeEventListener("pointerlockchange", this._onLockChange);
    document.removeEventListener("mousemove", this._onMouseMove);
    document.removeEventListener("keydown", this._onKeyDown);
    document.removeEventListener("keyup", this._onKeyUp);
  }
}
