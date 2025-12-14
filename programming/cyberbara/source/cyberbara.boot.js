/* cyberbara.boot.js
   Cyberbara (streetlight lo-fi) — Game assembly + main loop
   Depends on (load in this order):
     1) cyberbara.core.js
     2) cyberbara.world.js
     3) cyberbara.render.js
     4) cyberbara.ui.js
     5) cyberbara.boot.js (this)

   This file:
     - defines Player + collision
     - defines Game state machine
     - wires buttons + keyboard escape handling
     - starts the Engine
*/

(() => {
  "use strict";

  const CB = (window.Cyberbara = window.Cyberbara || {});
  if (!CB.Engine || !CB.world || !CB.render || !CB.uiLayer) {
    console.error("[cyberbara.boot] missing deps. verify script load order.");
    return;
  }

  const { clamp, lerp, approach, clampCam, nowMs } = CB.util;
  const dom = CB.dom;
  const ui = CB.ui;
  const input = CB.input;
  const audio = CB.audio;

  const Mode = CB.uiLayer.Mode;
  const dialog = new CB.uiLayer.Dialog();
  const invUI = new CB.uiLayer.InventoryUI();

  const W = CB.world;
  const {
    TS, WORLD_W, WORLD_H, SCALE,
  } = W.constants;

  /* =========================
     Collision
     ========================= */

  function collidesAABB(aabb) {
    const minTx = Math.floor(aabb.x / TS);
    const minTy = Math.floor(aabb.y / TS);
    const maxTx = Math.floor((aabb.x + aabb.w) / TS);
    const maxTy = Math.floor((aabb.y + aabb.h) / TS);

    for (let ty = minTy; ty <= maxTy; ty++) {
      for (let tx = minTx; tx <= maxTx; tx++) {
        const id = W.tileAt(tx, ty);
        if (!W.isWalkableTile(id)) return true;
        if (W.isDecoSolidAt(tx, ty)) return true;
      }
    }
    return false;
  }

  function collideMove(player, nx, ny) {
    const aabb = player.getAABB(nx, ny);
    if (!collidesAABB(aabb)) return { x: nx, y: ny, vx: player.vx, vy: player.vy };

    const ox = player.x;
    const oy = player.y;

    let lo = 0, hi = 1;
    for (let i = 0; i < 10; i++) {
      const mid = (lo + hi) / 2;
      const tx = lerp(ox, nx, mid);
      const ty = lerp(oy, ny, mid);
      const test = player.getAABB(tx, ty);
      if (collidesAABB(test)) hi = mid;
      else lo = mid;
    }

    const fx = lerp(ox, nx, lo);
    const fy = lerp(oy, ny, lo);

    let vx = player.vx;
    let vy = player.vy;

    // stop the dominant axis
    if (Math.abs(nx - ox) > Math.abs(ny - oy)) vx = 0;
    else vy = 0;

    return { x: fx, y: fy, vx, vy };
  }

  /* =========================
     Player
     ========================= */

  class Player {
    constructor() { this.reset(); }

    reset() {
      this.x = (3.5 * TS);
      this.y = (14.5 * TS);
      this.vx = 0;
      this.vy = 0;

      this.speed = 120;
      this.accel = 900;
      this.friction = 1100;

      this.w = TS * 0.55;
      this.h = TS * 0.60;

      this.face = 1;
      this.walkT = 0;
    }

    getAABB(nx = this.x, ny = this.y) {
      return { x: nx - this.w * 0.5, y: ny - this.h * 0.85, w: this.w, h: this.h };
    }

    update(dt) {
      let ix = 0, iy = 0;
      if (input.left) ix -= 1;
      if (input.right) ix += 1;
      if (input.up) iy -= 1;
      if (input.down) iy += 1;

      if (ix !== 0 && iy !== 0) { ix *= 0.7071; iy *= 0.7071; }
      if (ix !== 0) this.face = ix < 0 ? -1 : 1;

      const tvx = ix * this.speed;
      const tvy = iy * this.speed;

      this.vx = approach(this.vx, tvx, this.accel * dt);
      this.vy = approach(this.vy, tvy, this.accel * dt);

      if (ix === 0) this.vx = approach(this.vx, 0, this.friction * dt);
      if (iy === 0) this.vy = approach(this.vy, 0, this.friction * dt);

      const nx = this.x + this.vx * dt;
      const ny = this.y + this.vy * dt;

      const resX = collideMove(this, nx, this.y);
      this.x = resX.x; this.vx = resX.vx;

      const resY = collideMove(this, this.x, ny);
      this.y = resY.y; this.vy = resY.vy;

      const moving = Math.abs(this.vx) + Math.abs(this.vy) > 8;
      if (moving) this.walkT += dt * 10.0;
      else this.walkT = approach(this.walkT, 0, dt * 14.0);
    }
  }

  /* =========================
     Game
     ========================= */

  class Game {
    constructor() {
      this.mode = Mode.START;
      this.player = new Player();

      this.memories = new Set();
      this.memoryData = [];
      this.zone = "alley";

      this.clockMin = 21 * 60 + 10;
      this.clockSpeed = 0.25;

      this.interactCooldown = 0;

      // initialize HUD totals
      CB.uiLayer.updateHUD({
        zone: this.zone,
        memCount: 0,
        memTotal: W.MEM_TOTAL,
        clockMin: this.clockMin,
      });

      this._wireButtons();
      this._wireEscape();
      this._loadOrInit();

      ui.status("tip: explore slowly. interact twice with the same object.");
      ui.hint("[enter] interact · [i] inventory · [esc] close");

      // Show panels to match START state
      CB.uiLayer.panels.showStart();
      CB.uiLayer.panels.hidePause();
      CB.ui.hide(dom.dialog);
      CB.ui.hide(dom.inv);
    }

    _wireButtons() {
      dom.btnStart?.addEventListener("click", () => this.start());
      dom.btnResume?.addEventListener("click", () => this.resume());
      dom.btnRestart?.addEventListener("click", () => this.restart());
      dom.btnMenu?.addEventListener("click", () => this.toStart());
      dom.btnCloseDialog?.addEventListener("click", () => this.closeDialog());
      dom.btnCloseInv?.addEventListener("click", () => this.closeInv());

      // Ensure audio starts on first user gesture
      const gesture = () => {
        audio.start();
        audio.resumeIfNeeded();
        window.removeEventListener("pointerdown", gesture);
        window.removeEventListener("keydown", gesture);
      };
      window.addEventListener("pointerdown", gesture, { passive: true });
      window.addEventListener("keydown", gesture, { passive: true });
    }

    _wireEscape() {
      window.addEventListener("keydown", (e) => {
        if (e.key !== "Escape") return;
        if (this.mode === Mode.DIALOG) this.closeDialog();
        else if (this.mode === Mode.INV) this.closeInv();
        else if (this.mode === Mode.PAUSE) this.resume();
      }, { passive: false });

      // Start from keyboard
      window.addEventListener("keydown", (e) => {
        if (e.key !== "Enter") return;
        if (this.mode === Mode.START) this.start();
      }, { passive: false });
    }

    _save() {
      CB.storage.save({
        v: 1,
        px: this.player.x,
        py: this.player.y,
        mem: Array.from(this.memories),
        memData: this.memoryData,
        clockMin: this.clockMin | 0,
      });
    }

    _loadOrInit() {
      const saved = CB.storage.load();
      if (!saved) return;

      if (saved.v === 1) {
        if (typeof saved.px === "number" && typeof saved.py === "number") {
          this.player.x = saved.px;
          this.player.y = saved.py;
        }
        if (Array.isArray(saved.mem)) for (const m of saved.mem) this.memories.add(m);
        if (Array.isArray(saved.memData)) this.memoryData = saved.memData.filter(x => x && x.id && x.title);
        if (typeof saved.clockMin === "number") this.clockMin = saved.clockMin | 0;
      }

      ui.status("save loaded. continue where you left off.");
      if (dom.bootLine) ui.setText(dom.bootLine, "save loaded.");

      this._updateHUD();
    }

    _updateHUD() {
      this.zone = W.computeZone(this.player.x, this.player.y);

      CB.uiLayer.updateHUD({
        zone: this.zone,
        memCount: this.memories.size,
        memTotal: W.MEM_TOTAL,
        clockMin: this.clockMin,
      });
    }

    start() {
      audio.start();
      audio.resumeIfNeeded();

      this.mode = Mode.RUN;
      CB.uiLayer.panels.hideStart();
      CB.uiLayer.panels.hidePause();
      dom.canvas?.focus();

      ui.status("connected. walk slowly. listen.");
    }

    toStart() {
      this.mode = Mode.START;
      CB.uiLayer.panels.showStart();
      CB.uiLayer.panels.hidePause();
      this.closeDialog(true);
      this.closeInv(true);

      ui.status("ready.");
    }

    pause() {
      if (this.mode !== Mode.RUN) return;
      this.mode = Mode.PAUSE;
      CB.uiLayer.panels.showPause();
      ui.status("paused.");
    }

    resume() {
      if (this.mode !== Mode.PAUSE) return;
      this.mode = Mode.RUN;
      CB.uiLayer.panels.hidePause();
      ui.status("resumed.");
      dom.canvas?.focus();
    }

    restart() {
      this.player.reset();
      this.clockMin = 21 * 60 + 10;

      this.mode = Mode.RUN;
      CB.uiLayer.panels.hideStart();
      CB.uiLayer.panels.hidePause();

      this.closeDialog(true);
      this.closeInv(true);

      this._save();
      this._updateHUD();

      ui.status("restarted at the alley entrance.");
      dom.canvas?.focus();
    }

    openDialog(obj) {
      if (!obj) return;
      this.mode = Mode.DIALOG;

      const hasMem = obj.memory && this.memories.has(obj.memory.id);
      const pages = hasMem && obj.repeat ? obj.repeat : obj.pages;

      dialog.show(obj.name, pages, () => {
        this.mode = Mode.RUN;
        this._save();
        this._updateHUD();
        ui.status("...");
      });

      if (obj.memory && !this.memories.has(obj.memory.id)) {
        this.memories.add(obj.memory.id);
        this.memoryData.push({ ...obj.memory });
        audio.blip("mem");
        ui.status(`memory acquired: ${obj.memory.title}`);
        this._updateHUD();
      }
    }

    closeDialog(force = false) {
      if (force && dialog.open) dialog.onClose = null;
      dialog.close();
      if (this.mode === Mode.DIALOG) this.mode = Mode.RUN;
    }

    openInv() {
      this.mode = Mode.INV;
      invUI.show(this.memoryData);
      ui.status("inventory open.");
    }

    closeInv(force = false) {
      invUI.close();
      if (this.mode === Mode.INV) this.mode = Mode.RUN;
      ui.status("...");
    }

    update(dt, timeMs) {
      // pause toggle
      if (input.consumePause()) {
        if (this.mode === Mode.RUN) this.pause();
        else if (this.mode === Mode.PAUSE) this.resume();
      }

      // global clock tick (only while running)
      if (this.mode === Mode.RUN) {
        this.clockMin = (this.clockMin + dt * this.clockSpeed) % (24 * 60);
      }

      // dialog + inventory modes handle only UI input
      if (this.mode === Mode.DIALOG) {
        this._updateHUD();
        if (input.consumeInteract()) dialog.nextOrClose();
        return;
      }

      if (this.mode === Mode.INV) {
        this._updateHUD();
        return;
      }

      if (this.mode === Mode.PAUSE || this.mode === Mode.START) {
        this._updateHUD();
        return;
      }

      // RUN
      this.player.update(dt);

      // camera follow (center if world smaller than view)
      const minCamX = 0;
      const maxCamX = WORLD_W - CB.view.w;
      const minCamY = 0;
      const maxCamY = WORLD_H - CB.view.h;

      const targetCamX = clampCam(this.player.x - CB.view.w * 0.5, minCamX, maxCamX);
      const targetCamY = clampCam(this.player.y - CB.view.h * 0.55, minCamY, maxCamY);

      CB.view.camX = lerp(CB.view.camX, targetCamX, 1 - Math.exp(-dt * 6.5));
      CB.view.camY = lerp(CB.view.camY, targetCamY, 1 - Math.exp(-dt * 6.5));

      this.interactCooldown = Math.max(0, this.interactCooldown - dt);

      // inventory toggle
      if (input.consumeInventory()) {
        this.openInv();
        return;
      }

      // detect nearby interactable
      const pTx = Math.floor(this.player.x / TS);
      const pTy = Math.floor(this.player.y / TS);
      const nearby = W.interactableNearTile(pTx, pTy);

      ui.hint(nearby ? `[enter] interact: ${nearby.name} · [i] inventory` : "[enter] interact · [i] inventory · [esc] close");

      if (nearby && this.interactCooldown <= 0 && input.consumeInteract()) {
        this.interactCooldown = 0.18;
        this.openDialog(nearby);
      }

      // periodic autosave
      if ((timeMs | 0) % 1200 < 16) this._save();

      this._updateHUD();
    }

    draw(timeMs) {
      // world pass
      CB.render.drawWorld(timeMs, this);

      // player + bracket in world space
      const ctx = CB.dom.ctx;
      ctx.save();
      ctx.translate(-CB.view.camX, -CB.view.camY);

      const glow = 0.8 + 0.2 * Math.sin(timeMs * 0.002);
      CB.render.drawPlayer(this.player, timeMs, glow);

      const pTx = Math.floor(this.player.x / TS);
      const pTy = Math.floor(this.player.y / TS);
      const nearby = W.interactableNearTile(pTx, pTy);

      if (nearby && this.mode === Mode.RUN) {
        CB.render.drawInteractBracket(
          nearby.tx * TS + TS * 0.5,
          nearby.ty * TS + TS * 0.5,
          timeMs
        );
      }

      ctx.restore();
    }
  }

  /* =========================
     Inventory cursor scrolling (↑/↓)
     ========================= */

  let invScrollCooldown = 0;

  setInterval(() => {
    if (!CB.__game) return;
    if (CB.__game.mode !== Mode.INV) { invScrollCooldown = 0; return; }

    const t = nowMs();
    if (invScrollCooldown > t) return;

    if (input.up) { invUI.moveCursor(-1); invScrollCooldown = t + CB.CONFIG.INV_SCROLL_MS; }
    else if (input.down) { invUI.moveCursor(1); invScrollCooldown = t + CB.CONFIG.INV_SCROLL_MS; }
  }, 25);

  /* =========================
     Launch
     ========================= */

  // Ensure canvas is sized correctly at boot
  CB.canvas.resize();

  // Create game + engine
  const game = new Game();
  CB.__game = game;

  const engine = new CB.Engine();
  engine.update = (dt, tMs) => game.update(dt, tMs);
  engine.draw = (tMs) => game.draw(tMs);

  engine.onError = () => {
    ui.status("runtime error. check console.");
  };

  // Ensure mute button label matches current state
  if (dom.btnMute) dom.btnMute.textContent = audio.muted ? "unmute" : "mute";

  // Start loop
  engine.tick();
})();
