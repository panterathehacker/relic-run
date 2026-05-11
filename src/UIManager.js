export class UIManager {
  constructor() {
    this._fadeOverlay = null;
    this._worldName = null;
    this._loadingScreen = null;
    this._lanternCounter = null;
    this._objectiveHint = null;
    this._interactionPrompt = null;
    this._notification = null;
    this._notifTimer = null;
    this._controls = null;
    this._coords = null;
    this._coordsVisible = false;
    this._endScreen = null;

    this._build();
  }

  _build() {
    // Fade overlay for world transitions
    this._fadeOverlay = document.createElement("div");
    Object.assign(this._fadeOverlay.style, {
      position: "fixed", inset: "0", background: "black",
      opacity: "0", pointerEvents: "none", zIndex: "200",
      transition: "opacity 0.4s ease",
    });
    document.body.appendChild(this._fadeOverlay);

    // World name (top-left, subtle)
    this._worldName = document.createElement("div");
    Object.assign(this._worldName.style, {
      position: "fixed", top: "20px", left: "20px",
      color: "rgba(255,255,255,0.6)", font: "14px Georgia, serif",
      letterSpacing: "0.08em",
      textShadow: "0 0 8px rgba(0,0,0,0.9)",
      pointerEvents: "none", zIndex: "100",
    });
    document.body.appendChild(this._worldName);

    // HUD container — bottom-right, stacks counter + objective with consistent gap
    const hudContainer = document.createElement("div");
    Object.assign(hudContainer.style, {
      position: "fixed", bottom: "60px", right: "60px",
      display: "flex", flexDirection: "column", alignItems: "flex-end",
      gap: "18px",
      pointerEvents: "none", zIndex: "100",
    });
    document.body.appendChild(hudContainer);

    this._lanternCounter = document.createElement("div");
    Object.assign(this._lanternCounter.style, {
      color: "rgba(255,220,120,0.95)", font: "bold 48px Georgia, serif",
      letterSpacing: "0.06em", lineHeight: "1",
      textShadow: "0 0 20px rgba(255,180,50,0.7), 0 0 6px rgba(0,0,0,1)",
      display: "none",
    });
    hudContainer.appendChild(this._lanternCounter);

    this._objectiveHint = document.createElement("div");
    Object.assign(this._objectiveHint.style, {
      color: "rgba(255,255,255,0.6)", font: "20px Georgia, serif",
      letterSpacing: "0.04em",
      textShadow: "0 0 8px rgba(0,0,0,1)",
      display: "none", textAlign: "right",
    });
    this._objectiveHint.textContent = "Find all relics to unlock the portal";
    hudContainer.appendChild(this._objectiveHint);

    // Interaction prompt (center, above crosshair)
    this._interactionPrompt = document.createElement("div");
    Object.assign(this._interactionPrompt.style, {
      position: "fixed", top: "58%", left: "50%",
      transform: "translateX(-50%)",
      color: "rgba(255,255,255,0.95)", font: "20px Georgia, serif",
      letterSpacing: "0.12em",
      textShadow: "0 0 12px rgba(0,0,0,1), 0 0 4px rgba(0,0,0,1)",
      pointerEvents: "none", zIndex: "100",
      display: "none",
    });
    document.body.appendChild(this._interactionPrompt);

    // Crosshair dot
    const crosshair = document.createElement("div");
    Object.assign(crosshair.style, {
      position: "fixed", top: "50%", left: "50%",
      width: "4px", height: "4px",
      background: "rgba(255,255,255,0.6)", borderRadius: "50%",
      transform: "translate(-50%, -50%)",
      pointerEvents: "none", zIndex: "100",
    });
    document.body.appendChild(crosshair);

    // Loading screen
    this._loadingScreen = document.createElement("div");
    Object.assign(this._loadingScreen.style, {
      position: "fixed", inset: "0", background: "rgba(0,0,0,0.92)",
      display: "none", flexDirection: "column",
      alignItems: "center", justifyContent: "center",
      zIndex: "300", color: "white",
    });
    this._loadingScreen.innerHTML = `
      <div style="font:18px Georgia,serif;letter-spacing:0.12em;margin-bottom:16px;opacity:0.8" id="lk-loading-title">Entering...</div>
      <div style="width:200px;height:2px;background:rgba(255,255,255,0.15);border-radius:1px;overflow:hidden">
        <div id="lk-loading-bar" style="height:100%;width:0%;background:rgba(255,200,120,0.7);transition:width 0.15s ease"></div>
      </div>
    `;
    document.body.appendChild(this._loadingScreen);

    // End screen (hidden until world 3 portal entered)
    this._endScreen = document.createElement("div");
    Object.assign(this._endScreen.style, {
      position: "fixed", inset: "0", background: "rgba(0,0,0,0.95)",
      display: "none", flexDirection: "column",
      alignItems: "center", justifyContent: "center", gap: "12px",
      zIndex: "400", color: "white", textAlign: "center",
    });
    this._endScreen.innerHTML = `
      <div style="font:22px Georgia,serif;letter-spacing:0.18em;opacity:0.5;margin-bottom:6px">You found the treasure.</div>
      <div style="font:48px Georgia,serif;letter-spacing:0.22em;margin-bottom:8px">Relic Run</div>
      <div style="font:13px Georgia,serif;opacity:0.35;letter-spacing:0.08em">Worlds generated with Marble by World Labs</div>
      <div style="font:12px Georgia,serif;opacity:0.25;margin-bottom:24px">Built for the World Jam, May 2026</div>
      <button id="lk-play-again" style="
        padding: 10px 28px; border: 1px solid rgba(255,255,255,0.3);
        background: transparent; color: rgba(255,255,255,0.8);
        font: 14px Georgia,serif; letter-spacing: 0.1em;
        cursor: pointer; border-radius: 2px;
      ">Play Again</button>
    `;
    document.body.appendChild(this._endScreen);

    // Controls hint (bottom-center)
    this._controls = document.createElement("div");
    Object.assign(this._controls.style, {
      position: "fixed", bottom: "40px", left: "50%",
      transform: "translateX(-50%)",
      color: "rgba(255,255,255,0.35)", font: "13px Georgia, serif",
      letterSpacing: "0.05em",
      pointerEvents: "none", zIndex: "100", textAlign: "center",
    });
    this._controls.textContent = "WASD to move  |  Shift to run  |  Space to jump  |  E to interact  |  Click to shoot  |  Right click to aim";
    document.body.appendChild(this._controls);

    // Coordinate debug overlay — bottom-LEFT to avoid colliding with HUD
    this._coords = document.createElement("div");
    Object.assign(this._coords.style, {
      position: "fixed", bottom: "16px", left: "16px",
      color: "rgba(255,255,0,0.9)", font: "bold 12px monospace",
      textShadow: "0 0 6px rgba(0,0,0,1)",
      pointerEvents: "none", zIndex: "100", display: "none",
    });
    document.body.appendChild(this._coords);

    document.addEventListener("keydown", (e) => {
      if (e.code === "Tab") {
        e.preventDefault();
        this._coordsVisible = !this._coordsVisible;
        this._coords.style.display = this._coordsVisible ? "block" : "none";
      }
    });
  }

  setWorldName(name) {
    if (this._worldName) this._worldName.textContent = name;
  }

  showLoading(worldName) {
    const title = document.getElementById("lk-loading-title");
    if (title) title.textContent = `Entering ${worldName}...`;
    this.setLoadingProgress(0);
    if (this._loadingScreen) this._loadingScreen.style.display = "flex";
  }

  hideLoading() {
    if (this._loadingScreen) this._loadingScreen.style.display = "none";
  }

  setLoadingProgress(p) {
    const bar = document.getElementById("lk-loading-bar");
    if (bar) bar.style.width = `${Math.round(p * 100)}%`;
  }

  fadeOut() {
    return new Promise((resolve) => {
      if (!this._fadeOverlay) { resolve(); return; }
      this._fadeOverlay.style.opacity = "1";
      setTimeout(resolve, 450);
    });
  }

  fadeIn() {
    return new Promise((resolve) => {
      if (!this._fadeOverlay) { resolve(); return; }
      this._fadeOverlay.style.opacity = "0";
      setTimeout(resolve, 450);
    });
  }

  updateCoords(x, y, z) {
    if (!this._coordsVisible) return;
    this._coords.textContent = `x: ${x.toFixed(2)}  y: ${y.toFixed(2)}  z: ${z.toFixed(2)}`;
  }

  // ── Lantern counter ─────────────────────────────────────────────────

  showLanternCounter(current = 0, total = 3) {
    if (!this._lanternCounter) return;
    this._lanternCounter.textContent = `${current} / ${total}`;
    this._lanternCounter.style.display = "block";
    if (this._objectiveHint) this._objectiveHint.style.display = "block";
  }

  updateLanternCount(current, total = 3) {
    if (!this._lanternCounter) return;
    this._lanternCounter.textContent = `${current} / ${total}`;
  }

  // ── Interaction prompt ──────────────────────────────────────────────

  showInteractionPrompt(text = "Press E to light") {
    if (!this._interactionPrompt) return;
    this._interactionPrompt.textContent = text;
    this._interactionPrompt.style.display = "block";
  }

  hideInteractionPrompt() {
    if (!this._interactionPrompt) this._interactionPrompt.style.display = "none";
    else this._interactionPrompt.style.display = "none";
  }

  // ── Notification flash ──────────────────────────────────────────────

  showNotification(text, duration = 3000) {
    if (!this._notification) {
      this._notification = document.createElement("div");
      Object.assign(this._notification.style, {
        position: "fixed", top: "38%", left: "50%",
        transform: "translateX(-50%)",
        color: "rgba(255,220,100,0.95)",
        font: "24px Georgia, serif",
        letterSpacing: "0.12em",
        textShadow: "0 0 20px rgba(255,180,50,0.9), 0 0 6px rgba(0,0,0,1)",
        pointerEvents: "none", zIndex: "150",
        display: "none",
        transition: "opacity 0.5s ease",
      });
      document.body.appendChild(this._notification);
    }
    this._notification.textContent = text;
    this._notification.style.opacity = "1";
    this._notification.style.display = "block";
    clearTimeout(this._notifTimer);
    this._notifTimer = setTimeout(() => {
      this._notification.style.opacity = "0";
      setTimeout(() => { this._notification.style.display = "none"; }, 500);
    }, duration);
  }

  // ── End screen ──────────────────────────────────────────────────────

  showEndScreen(onPlayAgain) {
    if (!this._endScreen) return;
    document.exitPointerLock();
    this._endScreen.style.display = "flex";
    const btn = document.getElementById("lk-play-again");
    if (btn) btn.onclick = () => {
      this._endScreen.style.display = "none";
      if (onPlayAgain) onPlayAgain();
    };
  }

  hideControls() {
    if (this._controls) this._controls.style.display = "none";
  }

  // ── Title screen ────────────────────────────────────────────────────

  showTitleScreen(preloadPromise, onBegin) {
    const screen = document.createElement("div");
    Object.assign(screen.style, {
      position: "fixed", inset: "0",
      background: "black",
      display: "flex", flexDirection: "column",
      alignItems: "center", justifyContent: "center", gap: "0",
      zIndex: "500", color: "white", textAlign: "center",
      transition: "opacity 0.7s ease",
    });
    screen.innerHTML = `
      <div style="font:72px Georgia,serif;letter-spacing:0.28em;margin-bottom:12px">Relic Run</div>
      <div style="font:14px Georgia,serif;opacity:0.35;letter-spacing:0.14em;margin-bottom:52px">Three worlds. Five relics each. One treasure.</div>
      <button id="lk-begin-btn" disabled style="
        padding:13px 44px;
        border:1px solid rgba(255,255,255,0.2);
        background:transparent; color:rgba(255,255,255,0.35);
        font:14px Georgia,serif; letter-spacing:0.18em;
        border-radius:2px; cursor:default;
        transition:color 0.4s ease, border-color 0.4s ease;
      ">Loading…</button>
      <div style="font:11px Georgia,serif;opacity:0.18;letter-spacing:0.06em;margin-top:48px">Built for the World Jam · May 2026</div>
    `;
    document.body.appendChild(screen);

    const btn = document.getElementById("lk-begin-btn");

    Promise.resolve(preloadPromise).then(() => {
      btn.textContent = "Begin";
      btn.disabled = false;
      Object.assign(btn.style, {
        color: "rgba(255,255,255,0.85)",
        borderColor: "rgba(255,255,255,0.4)",
        cursor: "pointer",
      });
    });

    btn.addEventListener("click", () => {
      if (btn.disabled) return;
      screen.style.opacity = "0";
      setTimeout(() => {
        screen.remove();
        if (onBegin) onBegin();
      }, 720);
    });
  }
}
