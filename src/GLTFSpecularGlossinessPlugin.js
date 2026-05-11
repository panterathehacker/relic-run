import * as THREE from "three";

// Adds KHR_materials_pbrSpecularGlossiness support to GLTFLoader.
// Three.js r163+ dropped this extension; this plugin restores it.
// Usage: loader.register(parser => new GLTFSpecularGlossinessPlugin(parser))
export class GLTFSpecularGlossinessPlugin {
  constructor(parser) {
    this.parser = parser;
    this.name   = "KHR_materials_pbrSpecularGlossiness";
  }

  getMaterialType(materialIndex) {
    const ext = this._ext(materialIndex);
    if (!ext) return null;
    return THREE.MeshStandardMaterial;
  }

  extendMaterialParams(materialIndex, materialParams) {
    const ext = this._ext(materialIndex);
    if (!ext) return Promise.resolve();

    const pending = [];

    // diffuseFactor → color + opacity
    if (Array.isArray(ext.diffuseFactor)) {
      const [r, g, b, a = 1] = ext.diffuseFactor;
      materialParams.color = new THREE.Color().setRGB(r, g, b, THREE.LinearSRGBColorSpace);
      materialParams.opacity = a;
      if (a < 1) materialParams.transparent = true;
    }

    // diffuseTexture → map (albedo)
    if (ext.diffuseTexture !== undefined) {
      pending.push(
        this.parser.assignTexture(materialParams, "map", ext.diffuseTexture, THREE.SRGBColorSpace)
      );
    }

    // Convert glossiness → roughness (specular-glossiness to metalness-roughness approximation)
    materialParams.metalness = 0;
    materialParams.roughness = ext.glossinessFactor !== undefined ? 1 - ext.glossinessFactor : 0.8;

    return Promise.all(pending);
  }

  _ext(materialIndex) {
    const mat = this.parser.json.materials?.[materialIndex];
    return mat?.extensions?.[this.name] ?? null;
  }
}
