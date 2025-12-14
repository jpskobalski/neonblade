/* cyberbara.boot.js
   Cyberbara — Game assembly + main loop (updated for 5-zone cross world)

   Changes vs your current boot.js:
   - No longer caches TS/WORLD_W/WORLD_H at load time (they change per-zone).
   - Adds zone transitions via portal tiles using:
       CB.world.checkTransitionAtTile(tx,ty)
       CB.world.setZone(toZone, entryKey) -> spawn {tx,ty}
   - Adds transition cooldown to avoid bounce loops.
   - Save format bumped to v2 (backward-compatible with v1):
       stores zoneName + entryKey-ish spawn restore (we restore by zone + px/py).
   - Camera clamp recalculated per-frame from CB.world.constants.
*/

(() => {
  "use strict";

  const CB = (window.Cyberbara = window.Cyberbara || {});
  if (!CB.Engine || !CB.world || !CB.render || !CB.uiLayer) {
    console.error("[cyberbara.boot] missing deps. verify script load order.");
    return;
  }

  const { lerp, approach, clampCam, nowMs } = CB.util;
  const dom = CB.dom;
  const ui = CB.ui;
  const input = CB.input;
  const audio = CB.audio;

  const Mode = CB.uiLayer.Mode;
  const dialog = new CB.uiLayer.Dialog();
  const invUI = new CB.uiLayer.InventoryUI();

  const W = CB.world;

  /* =========================
     World helpers (dynamic constants)
     ========================= */

  function TS() { return W.constants.TS; }
  function WORLD_W() { return W.constants.WORLD_W; }
  function WORLD_H() { return W.constants.WORLD_H; }
  function SCALE() { return W.constants.SCALE; }

  function snapPlayerToSpawn(player, spawn) {
    const ts = TS();
    player.x = (spawn.tx + 0.5) * ts;
    player.y = (spawn.ty + 0.5) * ts;
    player.vx = 0;
    player.vy = 0;
  }

  function forceCameraToPlayer(player) {
    const ww = WORLD_W();
    const wh = WORLD_H();
    const vw = CB.view.w;
    const vh = CB.view.h;

    const minCamX = 0;
    const maxCamX = Math.max(0, ww - vw);
    const minCamY = 0;
    const maxCamY = Math.max(0, wh - vh);

    CB.view.camX = clampCam(player.x - vw * 0.5, minCamX, maxCamX);
    CB.view.camY = clampCam(player.y - vh * 0.55, minCamY, maxCamY);
  }

  /* =========================
     Collision (zone-aware)
     ========================= */

  function collidesAABB(aabb) {
    const ts = TS();

    const minTx = Math.floor(aabb.x / ts);
    const minTy = Math.floor(aabb.y / ts);
    const maxTx = Math.floor((aabb.x + aabb.w) / ts);
    const maxTy = Math.floor((aabb.y + aabb.h) / ts);

    for (let ty = minTy; ty <= maxTy; ty++) {
      for (let tx = minTx; tx <= maxTx; tx++) {
        const id = W.tileAt(tx, ty);
        if (!W.isWalkableTile(id)) return true;
        if (W.isDecoSolidAt && W.isDecoSolidAt(tx, ty)) return true;
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
      const tx = ox + (nx - ox) * mid;
      const ty = oy + (ny - oy) * mid;
      const test = player.getAABB(tx, ty);
      if (collidesAABB(test)) hi = mid;
      else lo = mid;
    }

    const fx = ox + (nx - ox) * lo;
    const fy = oy + (ny - oy) * lo;

    let vx = player.vx;
    let vy = player.vy;

    // stop dominant axis
    if (Math.abs(nx - ox) > Math.abs(ny - oy)) vx = 0;
    else vy = 0;

    return { x: fx, y: fy, vx, vy };
  }

  /* =========================
     Player
     ========================= */

  class Player {
    constructor() { this.resetToZoneStart(); }

    resetToZoneStart() {
      // Ensure hub is active, then place player at hub start spawn
      try { W.setZone("hub", "start"); } catch (_) {}
      const spawn = W.spawn || { tx: 5, ty: 5 };
      snapPlayerToSpawn(this, spawn);

      this.vx = 0;
      this.vy = 0;

      this.speed = 120;
      this.accel = 900;
      this.friction = 1100;

      this.w = TS() * 0.55;
      this.h = TS() * 0.60;

      this.face = 1;
      this.walkT = 0;
    }

    // If TS changes (zone change), keep body size aligned to TS
    refreshSizeFromTS() {
      const ts = TS();
      this.w = ts * 0.55;
      this.h = ts * 0.60;
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

      // HUD zone label comes from world zoneName now
      this.zone = W.zoneName || "hub";

      this.clockMin = 21 * 60 + 10;
      this.clockSpeed = 0.25;

      this.interactCooldown = 0;
      this.zoneCooldown = 0; // prevents portal bounce

      // initialize HUD totals
      CB.uiLayer.updateHUD({
        zone: this.zone,
        memCount: 0,
        memTotal: W.MEM_TOTAL || 0,
        clockMin: this.clockMin,
      });

      this._wireButtons();
      this._wireEscape();
      this._loadOrInit();

      ui.status("tip: explore slowly. interact twice with the same object.");
      ui.hint("[enter] interact · [i] inventory · [esc] close");

      CB.uiLayer.panels.showStart();
      CB.uiLayer.panels.hidePause();
      CB.ui.hide(dom.dialog);
      CB.ui.hide(dom.inv);

      // ensure camera starts sane
      this.player.refreshSizeFromTS();
      forceCameraToPlayer(this.player);
    }

    _wireButtons() {
      dom.btnStart?.addEventListener("click", () => this.start());
      dom.btnResume?.addEventListener("click", () => this.resume());
      dom.btnRestart?.addEventListener("click", () => this.restart());
      dom.btnMenu?.addEventListener("click", () => this.toStart());
      dom.btnCloseDialog?.addEventListener("click", () => this.closeDialog());
      dom.btnCloseInv?.addEventListener("click", () => this.closeInv());

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

      window.addEventListener("keydown", (e) => {
        if (e.key !== "Enter") return;
        if (this.mode === Mode.START) this.start();
      }, { passive: false });
    }

    _save() {
      CB.storage.save({
        v: 2,
        zone: W.zoneName || "hub",
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

      // v1 legacy (no zone)
      if (saved.v === 1) {
        if (typeof saved.px === "number" && typeof saved.py === "number") {
          this.player.x = saved.px;
          this.player.y = saved.py;
        }
        if (Array.isArray(saved.mem)) for (const m of saved.mem) this.memories.add(m);
        if (Array.isArray(saved.memData)) this.memoryData = saved.memData.filter(x => x && x.id && x.title);
        if (typeof saved.clockMin === "number") this.clockMin = saved.clockMin | 0;

        // ensure hub active in v1
        try { W.setZone("hub", "start"); } catch (_) {}
        this.player.refreshSizeFromTS();
        forceCameraToPlayer(this.player);

        ui.status("save loaded. continue where you left off.");
        if (dom.bootLine) ui.setText(dom.bootLine, "save loaded.");
        this._updateHUD();
        return;
      }

      // v2 (zone-aware)
      if (saved.v === 2) {
        const zone = typeof saved.zone === "string" ? saved.zone : "hub";
        try {
          // set zone first so TS/WORLD sizes are correct before applying px/py
          W.setZone(zone, "start");
        } catch (_) {
          W.setZone("hub", "start");
        }

        if (typeof saved.px === "number" && typeof saved.py === "number") {
          this.player.x = saved.px;
          this.player.y = saved.py;
        } else {
          snapPlayerToSpawn(this.player, W.spawn || { tx: 5, ty: 5 });
        }

        if (Array.isArray(saved.mem)) for (const m of saved.mem) this.memories.add(m);
        if (Array.isArray(saved.memData)) this.memoryData = saved.memData.filter(x => x && x.id && x.title);
        if (typeof saved.clockMin === "number") this.clockMin = saved.clockMin | 0;

        this.player.refreshSizeFromTS();
        forceCameraToPlayer(this.player);

        ui.status("save loaded. continue where you left off.");
        if (dom.bootLine) ui.setText(dom.bootLine, "save loaded.");
        this._updateHUD();
      }
    }

    _updateHUD() {
      this.zone = W.computeZone ? W.computeZone(this.player.x, this.player.y) : (W.zoneName || "hub");

      CB.uiLayer.updateHUD({
        zone: this.zone,
        memCount: this.memories.size,
        memTotal: W.MEM_TOTAL || 0,
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
      // hard reset: back to hub, clear motion, keep memories (your current behavior keeps memories)
      // If you want a full wipe, also clear memories + memoryData and storage.
      W.setZone("hub", "start");
      this.player.resetToZoneStart();
      this.player.refreshSizeFromTS();
      forceCameraToPlayer(this.player);

      this.clockMin = 21 * 60 + 10;
      this.zoneCooldown = 0.25;
      this.interactCooldown = 0;

      this.mode = Mode.RUN;
      CB.uiLayer.panels.hideStart();
      CB.uiLayer.panels.hidePause();

      this.closeDialog(true);
      this.closeInv(true);

      this._save();
      this._updateHUD();

      ui.status("restarted at the hub.");
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

    _tryZoneTransition() {
      if (this.zoneCooldown > 0) return false;

      const ts = TS();
      const pTx = Math.floor(this.player.x / ts);
      const pTy = Math.floor(this.player.y / ts);

      const tr = W.checkTransitionAtTile ? W.checkTransitionAtTile(pTx, pTy) : null;
      if (!tr) return false;

      const prev = W.zoneName || "hub";
      const spawn = W.setZone(tr.toZone, tr.entryKey);

      // refresh player size + teleport
      this.player.refreshSizeFromTS();
      snapPlayerToSpawn(this.player, spawn);

      // snap camera immediately so it feels clean
      forceCameraToPlayer(this.player);

      // cooldown so you don't immediately bounce
      this.zoneCooldown = 0.35;

      ui.status(`moved: ${prev} → ${W.zoneName}`);
      this._save();
      this._updateHUD();
      return true;
    }

    update(dt, timeMs) {
      // pause toggle
      if (input.consumePause()) {
        if (this.mode === Mode.RUN) this.pause();
        else if (this.mode === Mode.PAUSE) this.resume();
      }

      // clock tick (only while running)
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
      this.zoneCooldown = Math.max(0, this.zoneCooldown - dt);
      this.interactCooldown = Math.max(0, this.interactCooldown - dt);

      this.player.update(dt);

      // zone transitions (auto when stepping onto portal tile)
      // If you prefer "press Enter to travel", tell me and I'll switch this to gated input.
      this._tryZoneTransition();

      // camera follow (zone-aware bounds)
      const ww = WORLD_W();
      const wh = WORLD_H();
      const vw = CB.view.w;
      const vh = CB.view.h;

      const minCamX = 0;
      const maxCamX = Math.max(0, ww - vw);
      const minCamY = 0;
      const maxCamY = Math.max(0, wh - vh);

      const targetCamX = clampCam(this.player.x - vw * 0.5, minCamX, maxCamX);
      const targetCamY = clampCam(this.player.y - vh * 0.55, minCamY, maxCamY);

      CB.view.camX = lerp(CB.view.camX, targetCamX, 1 - Math.exp(-dt * 6.5));
      CB.view.camY = lerp(CB.view.camY, targetCamY, 1 - Math.exp(-dt * 6.5));

      // inventory toggle
      if (input.consumeInventory()) {
        this.openInv();
        return;
      }

      // nearby interactable (zone-aware TS)
      const ts = TS();
      const pTx = Math.floor(this.player.x / ts);
      const pTy = Math.floor(this.player.y / ts);
      const nearby = W.interactableNearTile ? W.interactableNearTile(pTx, pTy) : null;

      // portal hint (optional UX boost without touching UI.js)
      const onPortal = W.checkTransitionAtTile ? !!W.checkTransitionAtTile(pTx, pTy) : false;
      if (nearby) ui.hint(`[enter] interact: ${nearby.name} · [i] inventory`);
      else if (onPortal) ui.hint("moving zones… follow the neon roads.");
      else ui.hint("[enter] interact · [i] inventory · [esc] close");

      if (nearby && this.interactCooldown <= 0 && input.consumeInteract()) {
        this.interactCooldown = 0.18;
        this.openDialog(nearby);
      }

      // periodic autosave
      if ((timeMs | 0) % 1200 < 16) this._save();

      this._updateHUD();
    }

    draw(timeMs) {
      CB.render.drawWorld(timeMs, this);

      const ctx = CB.dom.ctx;
      const ts = TS();

      ctx.save();
      ctx.translate(-CB.view.camX, -CB.view.camY);

      const glow = 0.8 + 0.2 * Math.sin(timeMs * 0.002);
      CB.render.drawPlayer(this.player, timeMs, glow);

      const pTx = Math.floor(this.player.x / ts);
      const pTy = Math.floor(this.player.y / ts);
      const nearby = W.interactableNearTile ? W.interactableNearTile(pTx, pTy) : null;

      if (nearby && this.mode === Mode.RUN) {
        CB.render.drawInteractBracket(
          nearby.tx * ts + ts * 0.5,
          nearby.ty * ts + ts * 0.5,
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

  CB.canvas.resize();

  const game = new Game();
  CB.__game = game;

  const engine = new CB.Engine();
  engine.update = (dt, tMs) => game.update(dt, tMs);
  engine.draw = (tMs) => game.draw(tMs);

  engine.onError = () => {
    ui.status("runtime error. check console.");
  };

  if (dom.btnMute) dom.btnMute.textContent = audio.muted ? "unmute" : "mute";

  engine.tick();
})();
