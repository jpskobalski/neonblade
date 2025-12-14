/* cyberbara.ui.js
   Cyberbara (streetlight lo-fi) — UI layer (HUD, Dialog, Inventory, Panels)
   Depends on:
     - cyberbara.core.js (window.Cyberbara: dom/ui/audio/storage/util)
     - cyberbara.world.js (MEM_TOTAL)

   Provides:
     - CB.uiLayer.updateHUD({ zone, memCount, memTotal, clockMin })
     - CB.uiLayer.Dialog (class)
     - CB.uiLayer.InventoryUI (class)
     - CB.uiLayer.Mode (enum)
*/

(() => {
  "use strict";

  const CB = (window.Cyberbara = window.Cyberbara || {});
  if (!CB.dom || !CB.ui || !CB.util) {
    console.error("[cyberbara.ui] missing core (cyberbara.core.js must load first)");
    return;
  }

  const dom = CB.dom;
  const ui = CB.ui;

  const MEM_TOTAL = CB.world?.MEM_TOTAL ?? 0;

  /* =========================
     Modes
     ========================= */

  const Mode = Object.freeze({
    START: "start",
    RUN: "run",
    PAUSE: "pause",
    DIALOG: "dialog",
    INV: "inv",
  });

  /* =========================
     HUD helpers
     ========================= */

  function formatClock(clockMin) {
    const total = ((clockMin % (24 * 60)) + (24 * 60)) % (24 * 60);
    const hh = Math.floor(total / 60);
    const mm = Math.floor(total % 60);
    return `${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}`;
  }

  function updateHUD({ zone, memCount, memTotal, clockMin }) {
    if (typeof zone === "string") ui.setText(dom.zone, zone);
    if (typeof memCount === "number") ui.setText(dom.memCount, memCount);
    ui.setText(dom.memTotal, typeof memTotal === "number" ? memTotal : MEM_TOTAL);
    if (typeof clockMin === "number") ui.setText(dom.clock, formatClock(clockMin));
  }

  /* =========================
     Dialog
     ========================= */

  class Dialog {
    constructor() {
      this.open = false;
      this.pages = [];
      this.index = 0;
      this.onClose = null;
    }

    show(title, pages, onClose) {
      this.open = true;
      this.pages = Array.isArray(pages) ? pages.slice() : [];
      this.index = 0;
      this.onClose = typeof onClose === "function" ? onClose : null;

      ui.setText(dom.dialogTitle, title ?? "");
      ui.setText(dom.dialogBody, this.pages[0] ?? "");
      ui.show(dom.dialog);

      ui.hint("[enter] next · [esc] close");
    }

    nextOrClose() {
      if (!this.open) return;
      if (this.index < this.pages.length - 1) {
        this.index++;
        ui.setText(dom.dialogBody, this.pages[this.index] ?? "");
      } else {
        this.close();
      }
    }

    close() {
      if (!this.open) return;
      this.open = false;

      ui.hide(dom.dialog);
      ui.hint("[enter] interact · [i] inventory · [esc] close");

      if (this.onClose) {
        const cb = this.onClose;
        this.onClose = null;
        cb();
      }
    }
  }

  /* =========================
     Inventory
     ========================= */

  class InventoryUI {
    constructor() {
      this.open = false;
      this.cursor = 0;
      this.items = [];
    }

    show(items) {
      this.open = true;
      this.items = Array.isArray(items) ? items.slice() : [];
      this.cursor = 0;

      this.render();

      ui.show(dom.inv);
      ui.hint("[esc] close · browse with ↑/↓");
    }

    render() {
      if (!dom.invList) return;
      dom.invList.innerHTML = "";

      if (!this.items.length) {
        const li = document.createElement("li");
        li.textContent = "(no memories yet)";
        dom.invList.appendChild(li);
        ui.setText(dom.invCount, 0);
        return;
      }

      for (let i = 0; i < this.items.length; i++) {
        const it = this.items[i];
        const li = document.createElement("li");
        li.textContent = `${it.title}: ${it.text}`;
        if (i === this.cursor) li.style.color = "rgba(53,246,255,0.88)";
        dom.invList.appendChild(li);
      }

      ui.setText(dom.invCount, this.items.length);
    }

    moveCursor(dir) {
      if (!this.open || !this.items.length) return;
      this.cursor = CB.util.clamp(this.cursor + dir, 0, this.items.length - 1);
      this.render();
    }

    close() {
      if (!this.open) return;
      this.open = false;
      ui.hide(dom.inv);
      ui.hint("[enter] interact · [i] inventory · [esc] close");
    }
  }

  /* =========================
     Panel helpers
     ========================= */

  function showStart() { ui.show(dom.start); }
  function hideStart() { ui.hide(dom.start); }
  function showPause() { ui.show(dom.pause); }
  function hidePause() { ui.hide(dom.pause); }

  /* =========================
     Export API
     ========================= */

  CB.uiLayer = CB.uiLayer || {};
  CB.uiLayer.Mode = Mode;
  CB.uiLayer.updateHUD = updateHUD;
  CB.uiLayer.formatClock = formatClock;

  CB.uiLayer.Dialog = Dialog;
  CB.uiLayer.InventoryUI = InventoryUI;

  CB.uiLayer.panels = { showStart, hideStart, showPause, hidePause };

  CB.uiLayer.VERSION = "ui-v1";
})();
