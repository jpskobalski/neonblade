/* cyberbara.core.js
   Cyberbara (streetlight lo-fi) — Core Runtime
   Purpose: shared foundations (DOM wiring, canvas scaling, input, storage, audio, timing helpers).
   This file intentionally does NOT define:
     - map / world data
     - rendering functions
     - UI panels/dialog/inventory logic
   Those belong in separate files (cyberbara.world.js, cyberbara.render.js, cyberbara.ui.js, cyberbara.boot.js).

   Loading order (no modules; Neocities-friendly):
     <script src="./cyberbara.core.js"></script>
     <script src="./cyberbara.world.js"></script>
     <script src="./cyberbara.render.js"></script>
     <script src="./cyberbara.ui.js"></script>
     <script src="./cyberbara.boot.js"></script>
*/

(() => {
  "use strict";

  // Namespace
  const CB = (window.Cyberbara = window.Cyberbara || {});

  /* =========================
     Core constants (tweakable)
     ========================= */

  CB.CONFIG = {
    STORAGE_KEY: "cyberbara_save_v1",

    // Canvas / perf
    DPR_CAP: 2,
    MIN_CSS_W: 320,
    MIN_CSS_H: 320,

    // Fixed timestep loop
    FIXED_DT: 1 / 60,
    MAX_FRAME_SEC: 0.05,

    // Input buffer windows (ms)
    TAP_INTERACT_MS: 160,
    TAP_INVENTORY_MS: 220,
    TAP_PAUSE_MS: 220,

    // Inventory scroll repeat
    INV_SCROLL_MS: 110,
  };

  /* =========================
     Small utilities
     ========================= */

  CB.util = {
    clamp(v, a, b) { return Math.max(a, Math.min(b, v)); },
    lerp(a, b, t) { return a + (b - a) * t; },
    approach(v, target, delta) {
      if (v < target) return Math.min(target, v + delta);
      if (v > target) return Math.max(target, v - delta);
      return target;
    },
    nowMs() { return (performance?.now?.() ?? Date.now()); },
    safeGet(id) { return document.getElementById(id); },

    // Camera clamp that centers the world if the viewport is larger than the world.
    // Requires caller to provide min/max, where max may be < min.
    clampCam(value, min, max) {
      if (max < min) return (min + max) * 0.5;
      return CB.util.clamp(value, min, max);
    },

    // Stable PRNG (LCG)
    makeRng(seed = 0x12345678) {
      let s = seed >>> 0;
      return () => {
        s = (s * 1664525 + 1013904223) >>> 0;
        return s / 4294967296;
      };
    },
  };

  /* =========================
     DOM wiring (shared IDs)
     ========================= */

  CB.dom = (() => {
    const $ = CB.util.safeGet;

    // Only canvas is strictly required.
    const canvas = $("game");
    if (!canvas) {
      console.error("[cyberbara] missing canvas#game");
      return { canvas: null, ctx: null };
    }

    const ctx = canvas.getContext("2d", { alpha: false, desynchronized: true });

    return {
      canvas,
      ctx,

      // panels / modals
      start: $("start"),
      pause: $("pause"),
      dialog: $("dialog"),
      inv: $("inv"),

      // buttons
      btnStart: $("btnStart"),
      btnMute: $("btnMute"),
      btnResume: $("btnResume"),
      btnRestart: $("btnRestart"),
      btnMenu: $("btnMenu"),
      btnCloseDialog: $("btnCloseDialog"),
      btnCloseInv: $("btnCloseInv"),

      // HUD
      zone: $("zone"),
      memCount: $("memCount"),
      memTotal: $("memTotal"),
      clock: $("clock"),

      // dialog
      dialogTitle: $("dialogTitle"),
      dialogBody: $("dialogBody"),

      // inventory
      invList: $("invList"),
      invCount: $("invCount"),

      // footer/status/hints
      statusLine: $("statusLine"),
      hintLine: $("hintLine"),
      bootLine: $("bootLine"),

      // optional touch controls
      touch: $("touch"),
      tLeft: $("tLeft"),
      tRight: $("tRight"),
      tJump: $("tJump"),
      tPause: $("tPause"),
    };
  })();

  CB.ui = {
    show(el) {
      if (!el) return;
      el.classList.remove("panel--hidden", "dialog--hidden", "inv--hidden");
    },
    hide(el) {
      if (!el) return;
      el.classList.add(
        el.id === "dialog" ? "dialog--hidden" :
        el.id === "inv" ? "inv--hidden" :
        "panel--hidden"
      );
    },
    setText(el, v) { if (el) el.textContent = String(v); },
    status(msg) { CB.ui.setText(CB.dom.statusLine, msg); },
    hint(msg) { CB.ui.setText(CB.dom.hintLine, msg); },
  };

  /* =========================
     Storage (localStorage)
     ========================= */

  CB.storage = {
    save(obj) {
      try {
        localStorage.setItem(CB.CONFIG.STORAGE_KEY, JSON.stringify(obj));
        return true;
      } catch (_) {
        return false;
      }
    },
    load() {
      try {
        const raw = localStorage.getItem(CB.CONFIG.STORAGE_KEY);
        if (!raw) return null;
        const parsed = JSON.parse(raw);
        return parsed && typeof parsed === "object" ? parsed : null;
      } catch (_) {
        return null;
      }
    },
    clear() {
      try {
        localStorage.removeItem(CB.CONFIG.STORAGE_KEY);
        return true;
      } catch (_) {
        return false;
      }
    },
  };

  /* =========================
     Optional procedural audio
     ========================= */

  class AudioLoFi {
    constructor() {
      this.ctx = null;
      this.master = null;
      this.muted = false;
      this._started = false;
    }

    ensure() {
      if (this.ctx) return true;
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return false;
      try {
        this.ctx = new AC();
        this.master = this.ctx.createGain();
        this.master.gain.value = 0.65;
        this.master.connect(this.ctx.destination);
        return true;
      } catch (_) {
        return false;
      }
    }

    start() {
      if (this._started) return;
      if (!this.ensure()) return;

      const t = this.ctx.currentTime;

      const osc = this.ctx.createOscillator();
      osc.type = "triangle";
      osc.frequency.setValueAtTime(110, t);

      const filter = this.ctx.createBiquadFilter();
      filter.type = "lowpass";
      filter.frequency.setValueAtTime(650, t);
      filter.Q.setValueAtTime(0.7, t);

      const gain = this.ctx.createGain();
      gain.gain.setValueAtTime(0.0001, t);
      gain.gain.exponentialRampToValueAtTime(0.12, t + 0.4);

      const lfo = this.ctx.createOscillator();
      lfo.type = "sine";
      lfo.frequency.setValueAtTime(0.10, t);

      const lfoGain = this.ctx.createGain();
      lfoGain.gain.setValueAtTime(220, t);

      lfo.connect(lfoGain);
      lfoGain.connect(filter.frequency);

      osc.connect(filter);
      filter.connect(gain);
      gain.connect(this.master);

      osc.start(t);
      lfo.start(t);

      this._started = true;
      this.applyMute();
    }

    resumeIfNeeded() {
      if (!this.ctx) return;
      if (this.ctx.state === "suspended") this.ctx.resume().catch(() => {});
    }

    applyMute() {
      if (!this.master) return;
      this.master.gain.value = this.muted ? 0 : 0.65;
    }

    toggleMute() {
      this.muted = !this.muted;
      this.applyMute();
      return this.muted;
    }

    // Tiny one-shot sound (collect, UI tick, etc.)
    blip(kind = "mem") {
      if (!this.ensure()) return;
      this.resumeIfNeeded();

      const t = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const g = this.ctx.createGain();

      osc.type = "sine";
      osc.frequency.setValueAtTime(kind === "mem" ? 520 : 240, t);
      osc.frequency.exponentialRampToValueAtTime(kind === "mem" ? 780 : 140, t + 0.08);

      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(kind === "mem" ? 0.10 : 0.08, t + 0.01);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.10);

      osc.connect(g);
      g.connect(this.master);

      osc.start(t);
      osc.stop(t + 0.12);
    }
  }

  CB.audio = new AudioLoFi();

  /* =========================
     Input (keyboard + optional touch)
     ========================= */

  class Input {
    constructor() {
      this.left = false;
      this.right = false;
      this.up = false;
      this.down = false;

      // buffered taps
      this._pressedInteractAt = -1;
      this._pressedInvAt = -1;
      this._pressedPauseAt = -1;

      this._bindKeyboard();
      this._bindTouch();

      // prevent scroll on arrows/space
      window.addEventListener(
        "keydown",
        (e) => {
          if (["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", " "].includes(e.key)) e.preventDefault();
        },
        { passive: false }
      );
    }

    _bindKeyboard() {
      const onKey = (e, down) => {
        const k = e.key;
        const handled = [
          "ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown",
          "Enter", "i", "I", "p", "P", "m", "M", "Escape"
        ];
        if (handled.includes(k)) e.preventDefault();

        if (k === "ArrowLeft") this.left = down;
        if (k === "ArrowRight") this.right = down;
        if (k === "ArrowUp") this.up = down;
        if (k === "ArrowDown") this.down = down;

        if (k === "Enter" && down) this._pressedInteractAt = CB.util.nowMs();
        if ((k === "i" || k === "I") && down) this._pressedInvAt = CB.util.nowMs();
        if ((k === "p" || k === "P") && down) this._pressedPauseAt = CB.util.nowMs();

        // Mute toggle
        if ((k === "m" || k === "M") && down) {
          CB.audio.start();
          CB.audio.resumeIfNeeded();
          const muted = CB.audio.toggleMute();
          if (CB.dom.btnMute) CB.dom.btnMute.textContent = muted ? "unmute" : "mute";
        }
      };

      window.addEventListener("keydown", (e) => onKey(e, true), { passive: false });
      window.addEventListener("keyup", (e) => onKey(e, false), { passive: false });

      // click-to-focus for better keyboard flow
      CB.dom.canvas?.addEventListener("pointerdown", () => CB.dom.canvas.focus());
    }

    _bindTouch() {
      const hasTouch = ("ontouchstart" in window) || (navigator.maxTouchPoints > 0);
      if (!hasTouch || !CB.dom.touch) return;

      CB.dom.touch.classList.remove("touch--hidden");

      const bindHold = (btn, onDown, onUp) => {
        if (!btn) return;
        const d = (e) => { e.preventDefault(); onDown(); };
        const u = (e) => { e.preventDefault(); onUp(); };
        btn.addEventListener("pointerdown", d, { passive: false });
        btn.addEventListener("pointerup", u, { passive: false });
        btn.addEventListener("pointercancel", u, { passive: false });
        btn.addEventListener("pointerleave", u, { passive: false });
      };

      // Left/right for movement; "jump" becomes interact tap; pause tap
      bindHold(CB.dom.tLeft, () => { this.left = true; }, () => { this.left = false; });
      bindHold(CB.dom.tRight, () => { this.right = true; }, () => { this.right = false; });
      bindHold(CB.dom.tJump, () => { this._pressedInteractAt = CB.util.nowMs(); }, () => {});
      bindHold(CB.dom.tPause, () => { this._pressedPauseAt = CB.util.nowMs(); }, () => {});
    }

    consumeInteract(ms = CB.CONFIG.TAP_INTERACT_MS) {
      const t = CB.util.nowMs();
      if (this._pressedInteractAt > 0 && (t - this._pressedInteractAt) <= ms) {
        this._pressedInteractAt = -1;
        return true;
      }
      return false;
    }

    consumeInventory(ms = CB.CONFIG.TAP_INVENTORY_MS) {
      const t = CB.util.nowMs();
      if (this._pressedInvAt > 0 && (t - this._pressedInvAt) <= ms) {
        this._pressedInvAt = -1;
        return true;
      }
      return false;
    }

    consumePause(ms = CB.CONFIG.TAP_PAUSE_MS) {
      const t = CB.util.nowMs();
      if (this._pressedPauseAt > 0 && (t - this._pressedPauseAt) <= ms) {
        this._pressedPauseAt = -1;
        return true;
      }
      return false;
    }

    isMoving() {
      return this.left || this.right || this.up || this.down;
    }
  }

  CB.input = new Input();

  /* =========================
     Canvas scaling / view
     ========================= */

  CB.view = {
    w: 0,
    h: 0,
    dpr: 1,
    camX: 0,
    camY: 0,
  };

  CB.canvas = {
    resize() {
      const { clamp } = CB.util;
      const { DPR_CAP, MIN_CSS_W, MIN_CSS_H } = CB.CONFIG;
      const { canvas, ctx } = CB.dom;
      if (!canvas || !ctx) return;

      const dpr = clamp(window.devicePixelRatio || 1, 1, DPR_CAP);
      const cssW = Math.max(MIN_CSS_W, canvas.clientWidth || window.innerWidth);
      const cssH = Math.max(MIN_CSS_H, canvas.clientHeight || window.innerHeight);

      canvas.width = (cssW * dpr) | 0;
      canvas.height = (cssH * dpr) | 0;

      CB.view.w = canvas.width;
      CB.view.h = canvas.height;
      CB.view.dpr = dpr;

      // draw in device pixels; world renderer handles transforms explicitly
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.imageSmoothingEnabled = false;
    },
  };

  window.addEventListener("resize", () => CB.canvas.resize());
  CB.canvas.resize();

  /* =========================
     Engine loop (fixed timestep)
     ========================= */

  class Engine {
    constructor() {
      this._acc = 0;
      this._last = CB.util.nowMs();
      this._dt = CB.CONFIG.FIXED_DT;

      // These should be set by cyberbara.boot.js
      this.update = null; // (dt, tMs) => void
      this.draw = null;   // (tMs) => void

      // optional hooks
      this.onError = null;
    }

    tick = () => {
      try {
        const t = CB.util.nowMs();
        let frame = (t - this._last) / 1000;
        this._last = t;

        frame = CB.util.clamp(frame, 0, CB.CONFIG.MAX_FRAME_SEC);
        this._acc += frame;

        while (this._acc >= this._dt) {
          if (typeof this.update === "function") this.update(this._dt, t);
          this._acc -= this._dt;
        }

        if (typeof this.draw === "function") this.draw(t);

        requestAnimationFrame(this.tick);
      } catch (err) {
        console.error("[cyberbara] engine tick error:", err);
        if (typeof this.onError === "function") this.onError(err);
      }
    };
  }

  CB.Engine = Engine;

  /* =========================
     Audio unlock helper
     ========================= */

  CB.audioUnlock = (() => {
    let armed = false;
    const arm = () => {
      if (armed) return;
      armed = true;

      const gesture = () => {
        CB.audio.ensure();
        CB.audio.resumeIfNeeded();
        window.removeEventListener("pointerdown", gesture);
        window.removeEventListener("keydown", gesture);
      };

      window.addEventListener("pointerdown", gesture, { passive: true });
      window.addEventListener("keydown", gesture, { passive: true });
    };
    return { arm };
  })();

  // Arm audio unlock by default (safe no-op if unsupported)
  CB.audioUnlock.arm();

  /* =========================
     Minimal core wiring for mute button
     ========================= */

  if (CB.dom.btnMute) {
    CB.dom.btnMute.addEventListener("click", () => {
      CB.audio.start();
      CB.audio.resumeIfNeeded();
      const muted = CB.audio.toggleMute();
      CB.dom.btnMute.textContent = muted ? "unmute" : "mute";
    });
  }

  // Expose a small version tag for sanity checks
  CB.VERSION = "core-v1";
})();
