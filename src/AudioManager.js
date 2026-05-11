import { Howl } from "howler";

const MAX_DIST   = 8;    // beyond this → baseline volume
const FULL_DIST  = 2.5;  // at interact radius → full volume
const MIN_VOL    = 0.12; // always audible
const VOL_SMOOTH = 2.0;  // lerp speed per second

export class AudioManager {
  constructor() {
    this._howl    = null;
    this._url     = null;
    this._current = 0;
    this._target  = 0;

    // Preload all SFX up front
    this._sfx = {
      orbCollect: new Howl({ src: ["./audio/sfx/rescopicsound-sci-fi-weapon-projectile-flyby-plasma-03-233857.mp3"], volume: 1.0 }),
      portalOpen: new Howl({ src: ["./audio/sfx/yodguard-warp-magic-2-382390.mp3"],                                  volume: 1.0 }),
      portalJump: new Howl({ src: ["./audio/sfx/dragon-studio-sci-fi-portal-jump-05-416165.mp3"],                    volume: 1.0 }),
      jump:       new Howl({ src: ["./audio/sfx/freesound_community-grunt-85990.mp3"],                                volume: 0.7 }),
    };
  }

  // ── Ambient track ────────────────────────────────────────────────

  setTrack(url) {
    if (url === this._url) return;

    if (this._howl) {
      const dying = this._howl;
      dying.fade(dying.volume(), 0, 800);
      setTimeout(() => dying.unload(), 900);
    }

    this._url     = url ?? null;
    this._howl    = null;
    this._current = 0;
    this._target  = 0;

    if (!url) return;

    this._howl = new Howl({ src: [url], loop: true, volume: 0 });
    this._howl.play();
  }

  // nearestDist: distance to nearest uncollected orb (Infinity if none)
  // allCollected: locks volume at 1 once all orbs found
  update(dt, nearestDist, allCollected) {
    if (!this._howl) return;

    if (allCollected) {
      this._target = 1.0;
    } else if (!isFinite(nearestDist) || nearestDist > MAX_DIST) {
      this._target = MIN_VOL;
    } else {
      const t = Math.max(0, Math.min(1, (MAX_DIST - nearestDist) / (MAX_DIST - FULL_DIST)));
      this._target = MIN_VOL + (1 - MIN_VOL) * t * t * t * t;
    }

    const diff = this._target - this._current;
    this._current += Math.sign(diff) * Math.min(Math.abs(diff), VOL_SMOOTH * dt);
    this._howl.volume(this._current);
  }

  // ── SFX ──────────────────────────────────────────────────────────

  playOrbCollect() {
    const id = this._sfx.orbCollect.play();
    this._sfx.orbCollect.seek(3, id);
  }
  playPortalOpen()  { this._sfx.portalOpen.play(); }
  playPortalJump()  { this._sfx.portalJump.play(); }
  playJump()        { this._sfx.jump.play(); }

  stop() {
    if (this._howl) {
      const h = this._howl;
      h.fade(h.volume(), 0, 600);
      setTimeout(() => h.unload(), 700);
      this._howl = null;
    }
    this._url = null;
  }
}
