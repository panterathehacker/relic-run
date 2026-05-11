import * as THREE from "three";

export const ANIMAL_URLS = {
  cat:     "./animated_cat__3d_animal_model.glb",
  dog:     "./animated_german_sheperd__3d_animal_model.glb",
  chicken: "./animated_chicken__3d_animal_model.glb",
};

const COLORS = {
  temple:    new THREE.Color(0xFFB088),  // dawn pink/gold
  cathedral: new THREE.Color(0x8866FF),  // twilight purple
  medieval:  new THREE.Color(0xFFCC44),  // warm amber/gold
  red:       new THREE.Color(0xFF2200),  // world2 → world3
  gold:      new THREE.Color(0xFFDD00),  // world3 → end
};

// Interaction positions are placeholder — replace with real coords after walking each world.
// Portal positions: world1 confirmed; world2+world3 need real coords from world walks.
export const WORLD_CONFIG = {
  world1: {
    name: "Misty Temple at Dawn",
    splatUrl: "./worlds/world1/splat.spz",
    colliderUrl: "./worlds/world1/collider.glb",
    spawnPoint: { x: 0, y: 1.6, z: 0, yaw: Math.PI },
    color: COLORS.temple,
    skyColor: 0xE8D4B0,
    exposure: 1.4,
    interactions: [
      { pos: new THREE.Vector3(-0.35, -0.12, -6.79) },
      { pos: new THREE.Vector3(-6.75, -0.26,  0.85) },
      { pos: new THREE.Vector3(-2.70, -0.63, -3.83) },
      { pos: new THREE.Vector3( 2.85,  4.00, -4.79), alwaysVisible: true },
      { pos: new THREE.Vector3( 4.98,  4.00,  0.61), alwaysVisible: true },
    ],
    audioTrack: "./audio/Temple Mist Dawn.mp3",
    animals: [
      { url: "./animated_cat__3d_animal_model.glb", x: -0.22, y: -1.61, z: -3.45, scale: 0.55, patrol: false, preferAnims: ["idle", "sit", "sleep", "rest"] },
    ],
    portals: [
      {
        position:    new THREE.Vector3(-5.53, -0.28, 0.82),
        rotation:    new THREE.Euler(0, Math.PI / 2, 0),
        targetWorld: "world2",
        targetSpawn: { x: 0, y: 1.6, z: 0, yaw: Math.PI },
        color: COLORS.cathedral,
      },
    ],
  },

  world2: {
    name: "Gothic Cathedral at Twilight",
    splatUrl: "./worlds/world2/splat.spz",
    colliderUrl: "./worlds/world2/collider.glb",
    spawnPoint: { x: 0, y: 1.6, z: 0, yaw: Math.PI },
    color: COLORS.cathedral,
    skyColor: 0x1A0A2E,  // deep twilight purple
    exposure: 1.2,
    interactions: [
      { pos: new THREE.Vector3( 0.05, 0.98,  6.26) },
      { pos: new THREE.Vector3(-3.74, 1.04, -2.34) },
      { pos: new THREE.Vector3(-0.18, 1.07, -7.48) },
      { pos: new THREE.Vector3( 4.25,  3.70,  1.78), alwaysVisible: true },
      { pos: new THREE.Vector3(-3.62,  3.70,  4.28), alwaysVisible: true },
    ],
    audioTrack: "./audio/Twilight Nave.mp3",
    animals: [
      { url: "./animated_german_sheperd__3d_animal_model.glb", x: -3.8, y: -0.34, z: 1.43, scale: 0.7, patrol: false, yaw: Math.PI / 2, animName: "SKM_GermanSheperd|SKM_GermanSheperd|GermanShepherd_Lying01" },
    ],
    portals: [
      {
        position:    new THREE.Vector3(0, 0.47, 0),
        rotation:    new THREE.Euler(0, 0, 0),
        targetWorld: "world3",
        targetSpawn: { x: 0, y: 1.6, z: 0, yaw: Math.PI },
        color: COLORS.red,
      },
    ],
  },

  world3: {
    name: "Medieval Market Town",
    splatUrl: "./worlds/world3/splat.spz",
    colliderUrl: "./worlds/world3/collider.glb",
    spawnPoint: { x: 0, y: 1.6, z: 0, yaw: Math.PI },
    color: COLORS.medieval,
    skyColor: 0xFFAA55,
    exposure: 1.5,
    interactions: [
      { pos: new THREE.Vector3(-0.50, 0.71,  5.46) },
      { pos: new THREE.Vector3( 4.55, 0.75, -1.47) },
      { pos: new THREE.Vector3(-2.05, 0.84, -2.41) },
      { pos: new THREE.Vector3( 1.69,  5.00, -4.85), alwaysVisible: true },
      { pos: new THREE.Vector3( 0.74,  5.00,  1.48), alwaysVisible: true },
    ],
    audioTrack: "./audio/Market at Dusk.mp3",
    animals: [
      { url: "./animated_chicken__3d_animal_model.glb",        x:  2.99, y: -0.56, z: -2.74, scale: 0.52, radius: 0.5 },
      { url: "./animated_cat__3d_animal_model.glb",            x:  0.87, y: -0.60, z:  3.68, scale: 0.55, patrol: false, preferAnims: ["idle", "sit", "sleep", "rest"] },
      { url: "./animated_german_sheperd__3d_animal_model.glb", x:  1.54, y: -0.54, z:  0.84, scale: 0.7,  patrol: false, animName: "SKM_GermanSheperd|SKM_GermanSheperd|GermanShepherd_Lying01" },
    ],
    portals: [
      {
        position:    new THREE.Vector3(-0.35, 1.42, -4.92),
        rotation:    new THREE.Euler(0, 0, 0),
        targetWorld: "end",
        targetSpawn: { x: 0, y: 1.6, z: 0, yaw: Math.PI },
        color: COLORS.gold,
      },
    ],
  },
};
