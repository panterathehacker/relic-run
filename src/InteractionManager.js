import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";

const INTERACT_RADIUS = 2.5;
const BOB_SPEED       = 1.5;
const BOB_AMOUNT      = 0.12;
const SPIN_SPEED      = 0.8;
const FADE_SPEED      = 5.0;
const ORB_SCALE       = 0.25;
const ORB_Y_OFFSET    = -0.3;
const DISSOLVE_SPEED  = 1.1;  // full dissolve in ~0.9s

// Injected into every orb material — noise-based discard with gold edge glow
const DISSOLVE_VERTEX_COMMON = `
varying vec3 vWorldPos;
`;
const DISSOLVE_VERTEX_BEGIN = `
vWorldPos = (modelMatrix * vec4(position, 1.0)).xyz;
`;
const DISSOLVE_FRAGMENT_COMMON = `
varying vec3 vWorldPos;
uniform float uDissolve;

float _dh(vec3 p) {
  p = fract(p * vec3(443.897,397.297,491.187));
  p += dot(p.zxy, p.yxz + 19.19);
  return fract(p.x * p.y * p.z);
}
float _dn(vec3 x) {
  vec3 i = floor(x); vec3 f = fract(x);
  f = f*f*(3.0-2.0*f);
  return mix(
    mix(mix(_dh(i),            _dh(i+vec3(1,0,0)),f.x),
        mix(_dh(i+vec3(0,1,0)),_dh(i+vec3(1,1,0)),f.x),f.y),
    mix(mix(_dh(i+vec3(0,0,1)),_dh(i+vec3(1,0,1)),f.x),
        mix(_dh(i+vec3(0,1,1)),_dh(i+vec3(1,1,1)),f.x),f.y),f.z);
}
`;
const DISSOLVE_FRAGMENT_END = `
{
  float _n = _dn(vWorldPos * 12.0) * 0.6 + _dn(vWorldPos * 30.0) * 0.4;
  if (_n < uDissolve) discard;
  float _edge = 0.09;
  if (_n < uDissolve + _edge) {
    float _t = 1.0 - (_n - uDissolve) / _edge;
    gl_FragColor.rgb = mix(gl_FragColor.rgb, vec3(1.0, 0.6, 0.05), _t * _t);
    gl_FragColor.a   = max(gl_FragColor.a, _t * 0.8);
  }
}
`;

function applyDissolve(mat) {
  mat.transparent = true;
  const uDissolve = { value: -0.1 };
  mat.userData.uDissolve = uDissolve;
  mat.onBeforeCompile = (shader) => {
    shader.uniforms.uDissolve = uDissolve;
    shader.vertexShader = shader.vertexShader
      .replace("#include <common>",       "#include <common>"       + DISSOLVE_VERTEX_COMMON)
      .replace("#include <begin_vertex>", "#include <begin_vertex>" + DISSOLVE_VERTEX_BEGIN);
    shader.fragmentShader = shader.fragmentShader
      .replace("#include <common>",            "#include <common>"            + DISSOLVE_FRAGMENT_COMMON)
      .replace("#include <dithering_fragment>", "#include <dithering_fragment>" + DISSOLVE_FRAGMENT_END);
  };
  mat.needsUpdate = true;
}

export class InteractionManager {
  constructor(scene, ui) {
    this.scene = scene;
    this.ui    = ui;

    this._orbTemplate = null;
    this._items       = [];
    this._found       = 0;
    this._total       = 0;
    this._nearItem    = null;
    this._onComplete  = null;
    this._time        = 0;
    this._allFound    = false;

    new GLTFLoader().load(
      "./time_orb.glb",
      (gltf) => { this._orbTemplate = gltf.scene; },
      undefined,
      (err) => console.warn("[InteractionManager] time_orb.glb failed:", err)
    );
  }

  init(positions, onComplete) {
    this.dispose();
    this._found      = 0;
    this._total      = positions.length;
    this._onComplete = onComplete;
    this._time       = 0;
    this._allFound   = false;
    this._items      = positions.map((p, i) => {
      const pos           = p.isVector3 ? p : p.pos;
      const alwaysVisible = p.alwaysVisible ?? false;
      return this._createItem(pos, i, alwaysVisible);
    });
    this.ui.showLanternCounter(0, this._total);
  }

  _createItem(position, index, alwaysVisible = false) {
    const adjustedY = position.y + ORB_Y_OFFSET;
    const group = new THREE.Group();
    group.position.set(position.x, adjustedY, position.z);
    group.visible = alwaysVisible;

    const meshes = [];

    if (this._orbTemplate) {
      const clone = this._orbTemplate.clone(true);
      clone.scale.setScalar(ORB_SCALE);
      clone.traverse((child) => {
        if (!child.isMesh) return;
        child.material = child.material.clone();
        child.material.opacity = alwaysVisible ? 1 : 0;
        child.material.emissive = new THREE.Color(0xFFAA33);
        child.material.emissiveIntensity = 3.0;
        applyDissolve(child.material);
        meshes.push(child);
      });
      group.add(clone);
    } else {
      const geo = new THREE.SphereGeometry(0.3, 16, 16);
      const mat = new THREE.MeshStandardMaterial({
        color: 0xFFD700, emissive: 0xFFAA00, emissiveIntensity: 1.5,
        metalness: 0.8, roughness: 0.2, opacity: 0,
      });
      applyDissolve(mat);
      const mesh = new THREE.Mesh(geo, mat);
      group.add(mesh);
      meshes.push(mesh);
    }

    this.scene.add(group);

    return {
      group,
      meshes,
      baseY:            adjustedY,
      phaseOffset:      index * (Math.PI * 2 / 3),
      collected:        false,
      dissolving:       false,
      dissolveProgress: 0,
      opacity:          alwaysVisible ? 1 : 0,
      alwaysVisible,
    };
  }

  update(dt, characterPosition) {
    this._time    += dt;
    this._nearItem = null;

    for (const item of this._items) {
      if (item.dissolving) {
        item.dissolveProgress = Math.min(1, item.dissolveProgress + dt * DISSOLVE_SPEED);
        for (const mesh of item.meshes) {
          if (mesh.material.userData.uDissolve)
            mesh.material.userData.uDissolve.value = item.dissolveProgress;
        }
        if (item.dissolveProgress >= 1) {
          item.dissolving = false;
          this._freeItem(item);
        }
        continue;
      }

      if (item.collected) continue;

      item.group.position.y  = item.baseY + Math.sin(this._time * BOB_SPEED + item.phaseOffset) * BOB_AMOUNT;
      item.group.rotation.y += SPIN_SPEED * dt;

      const inRange = characterPosition.distanceTo(item.group.position) < INTERACT_RADIUS;
      if (inRange) this._nearItem = item;

      if (item.alwaysVisible) {
        item.group.visible = true;
      } else {
        const target = inRange ? 1 : 0;
        item.opacity = THREE.MathUtils.clamp(
          item.opacity + (target - item.opacity) * Math.min(1, FADE_SPEED * dt),
          0, 1
        );
        for (const mesh of item.meshes) mesh.material.opacity = item.opacity;
        item.group.visible = item.opacity > 0.01;
      }
    }

    if (this._nearItem) {
      this.ui.showInteractionPrompt("Press E to recover relic");
    } else {
      this.ui.hideInteractionPrompt();
    }
  }

  _freeItem(item) {
    this.scene.remove(item.group);
    for (const mesh of item.meshes) {
      if (mesh.geometry) mesh.geometry.dispose();
      mesh.material.dispose();
    }
  }

  // Returns distance to nearest uncollected orb, or Infinity if none remain
  getNearestOrbDist(characterPosition) {
    let min = Infinity;
    for (const item of this._items) {
      if (item.collected) continue;
      const d = characterPosition.distanceTo(item.group.position);
      if (d < min) min = d;
    }
    return min;
  }

  tryCollect() {
    if (!this._nearItem) return false;
    this._collectItem(this._nearItem);
    this._nearItem = null;
    this.ui.hideInteractionPrompt();
    return true;
  }

  // Collect whichever orb (collected or not, visible or not) is within radius of worldPos.
  tryHitAt(worldPos, radius = 0.6) {
    for (const item of this._items) {
      if (item.collected) continue;
      if (worldPos.distanceTo(item.group.position) <= radius) {
        if (item === this._nearItem) this._nearItem = null;
        this._collectItem(item);
        this.ui.hideInteractionPrompt();
        return true;
      }
    }
    return false;
  }

  _collectItem(item) {
    item.collected = true;
    item.dissolving = true;
    item.dissolveProgress = 0;

    for (const mesh of item.meshes) {
      mesh.material.opacity = 1;
      if (mesh.material.userData.uDissolve)
        mesh.material.userData.uDissolve.value = 0;
    }
    item.group.visible = true;

    this._found++;
    this.ui.updateLanternCount(this._found, this._total);

    if (this._found >= this._total) this._allFound = true;
    if (this._found >= this._total && this._onComplete) {
      this._onComplete();
    }
  }

  completeAll() {
    for (const item of this._items) {
      if (item.collected) continue;
      item.collected = true;
      this._freeItem(item);
    }
    this._found    = this._total;
    this._nearItem = null;
    this.ui.hideInteractionPrompt();
    this.ui.updateLanternCount(this._found, this._total);
    if (this._onComplete) this._onComplete();
  }

  dispose() {
    for (const item of this._items) {
      if (!item.collected || item.dissolving) this._freeItem(item);
    }
    this._items    = [];
    this._nearItem = null;
    this.ui.hideInteractionPrompt();
  }
}
