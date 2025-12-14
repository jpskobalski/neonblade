/* cyberbara.render.js
   Cyberbara — Rendering (updated for 5-zone world + richer tile IDs)

   Key changes vs render-v1:
   - DO NOT cache world constants at load time (they change when zone switches).
   - DO NOT cache deco/interactables at load time (they are zone-dependent).
   - Adds drawing support for the expanded tile set from cyberbara.world.js (T.*).
   - Lighting now derives from:
       - portal tiles (strong neon beacons)
       - neon floor tiles (subtle glow)
       - interactables (soft presence glow)
     (still cheap, no heavy post-processing)

   Depends on:
     - cyberbara.core.js (window.Cyberbara, util, view, dom)
     - cyberbara.world.js (world constants, tileAt, T, deco, interactables)
*/

(() => {
  "use strict";

  const CB = (window.Cyberbara = window.Cyberbara || {});
  if (!CB.util || !CB.dom?.ctx || !CB.world?.constants) {
    console.error("[cyberbara.render] missing deps (core/world must load first)");
    return;
  }

  const { clamp } = CB.util;
  const { ctx } = CB.dom;
  const view = CB.view;

  /* =========================
     Helpers
     ========================= */

  function roundRect(g, x, y, w, h, r) {
    if (g.roundRect) { g.beginPath(); g.roundRect(x, y, w, h, r); return; }
    r = Math.max(0, Math.min(r, Math.min(w, h) / 2));
    g.beginPath();
    g.moveTo(x + r, y);
    g.arcTo(x + w, y, x + w, y + h, r);
    g.arcTo(x + w, y + h, x, y + h, r);
    g.arcTo(x, y + h, x, y, r);
    g.arcTo(x, y, x + w, y, r);
    g.closePath();
  }

  function drawScanlines(g) {
    g.save();
    g.globalAlpha = 0.085;
    g.fillStyle = "rgba(255,255,255,0.05)";
    const step = 6 * view.dpr;
    for (let y = 0; y < view.h; y += step) g.fillRect(0, y, view.w, 1);
    g.restore();
  }

  function nHash(x, y) {
    // small deterministic noise (0..1) for texture specks
    const s = Math.sin(x * 127.1 + y * 311.7) * 43758.5453123;
    return s - Math.floor(s);
  }

  function withAlpha(g, a, fn) {
    g.save();
    g.globalAlpha = a;
    fn();
    g.restore();
  }

  /* =========================
     Tiles (expanded set)
     ========================= */

  function drawTile(g, id, x, y, timeMs, TS, T) {
    const t = timeMs * 0.001;

    // Boundary / walls
    if (id === T.SOLID_WALL) {
      g.fillStyle = "rgba(14,16,40,0.98)";
      g.fillRect(x, y, TS, TS);

      // neon structural grid
      withAlpha(g, 0.16, () => {
        g.fillStyle = "rgba(53,246,255,0.12)";
        g.fillRect(x, y + TS * 0.50, TS, 1);
        g.fillRect(x + TS * 0.50, y, 1, TS);
      });

      // subtle edge highlight
      withAlpha(g, 0.22, () => {
        g.strokeStyle = "rgba(255,59,245,0.10)";
        g.strokeRect(x + 1, y + 1, TS - 2, TS - 2);
      });
      return;
    }

    // Portals (walkable triggers) — make them pop even before you redo lighting
    if (id === T.PORTAL_N || id === T.PORTAL_S || id === T.PORTAL_W || id === T.PORTAL_E) {
      // base neon pad
      g.fillStyle = "rgba(12,12,32,0.95)";
      g.fillRect(x, y, TS, TS);

      const pulse = 0.55 + 0.35 * Math.sin(t * 3.4 + (x + y) * 0.002);
      withAlpha(g, 0.55 + 0.25 * pulse, () => {
        g.fillStyle = "rgba(255,59,245,0.30)";
        g.fillRect(x + TS * 0.10, y + TS * 0.10, TS * 0.80, TS * 0.80);
      });

      withAlpha(g, 0.85, () => {
        g.strokeStyle = "rgba(53,246,255,0.70)";
        g.lineWidth = 2;
        g.strokeRect(x + TS * 0.12, y + TS * 0.12, TS * 0.76, TS * 0.76);
      });

      // arrow hint
      withAlpha(g, 0.55 + 0.25 * pulse, () => {
        g.strokeStyle = "rgba(215,217,255,0.55)";
        g.lineWidth = 2;
        g.beginPath();
        if (id === T.PORTAL_N) { g.moveTo(x + TS * 0.50, y + TS * 0.20); g.lineTo(x + TS * 0.50, y + TS * 0.75); }
        if (id === T.PORTAL_S) { g.moveTo(x + TS * 0.50, y + TS * 0.80); g.lineTo(x + TS * 0.50, y + TS * 0.25); }
        if (id === T.PORTAL_W) { g.moveTo(x + TS * 0.20, y + TS * 0.50); g.lineTo(x + TS * 0.75, y + TS * 0.50); }
        if (id === T.PORTAL_E) { g.moveTo(x + TS * 0.80, y + TS * 0.50); g.lineTo(x + TS * 0.25, y + TS * 0.50); }
        g.stroke();
      });

      return;
    }

    // Liquids / hazards
    if (id === T.WATER_RIVER) {
      g.fillStyle = "rgba(6,10,30,0.98)";
      g.fillRect(x, y, TS, TS);

      const wave = 0.12 + 0.08 * Math.sin(t * 2.6 + (x * 0.01) + (y * 0.02));
      withAlpha(g, wave, () => {
        g.fillStyle = "rgba(53,246,255,0.35)";
        g.fillRect(x + TS * 0.12, y + TS * 0.30, TS * 0.76, TS * 0.12);
        g.fillRect(x + TS * 0.18, y + TS * 0.58, TS * 0.62, TS * 0.08);
      });

      withAlpha(g, 0.10, () => {
        g.strokeStyle = "rgba(255,59,245,0.18)";
        g.strokeRect(x + 2, y + 2, TS - 4, TS - 4);
      });
      return;
    }

    if (id === T.NEON_FLUID) {
      g.fillStyle = "rgba(10,10,24,0.98)";
      g.fillRect(x, y, TS, TS);

      const pulse = 0.16 + 0.12 * Math.sin(t * 4.0 + (x + y) * 0.01);
      withAlpha(g, 0.55, () => {
        g.fillStyle = "rgba(255,59,245,0.22)";
        g.fillRect(x, y, TS, TS);
      });

      withAlpha(g, pulse + 0.10, () => {
        g.fillStyle = "rgba(53,246,255,0.40)";
        g.fillRect(x + TS * 0.18, y + TS * 0.38, TS * 0.64, TS * 0.12);
      });

      withAlpha(g, 0.12, () => {
        g.strokeStyle = "rgba(215,217,255,0.20)";
        g.strokeRect(x + 2, y + 2, TS - 4, TS - 4);
      });
      return;
    }

    // Obstacles (solid-ish) – render as “object tiles”
    if (
      id === T.TREE_TRUNK || id === T.ROOT_CABLE || id === T.SERVER_RACK ||
      id === T.MACHINE || id === T.CONVEYOR || id === T.CUBICLE_WALL ||
      id === T.GLASS_SHARD || id === T.DEBRIS || id === T.SCRAP_PILE ||
      id === T.TECH_JUNK
    ) {
      // base underlay
      g.fillStyle = "rgba(8,10,26,0.92)";
      g.fillRect(x, y, TS, TS);

      // distinct per obstacle
      if (id === T.TREE_TRUNK) {
        g.fillStyle = "rgba(18,24,18,0.95)";
        g.fillRect(x + TS * 0.20, y + TS * 0.12, TS * 0.60, TS * 0.84);

        withAlpha(g, 0.25, () => {
          g.strokeStyle = "rgba(53,246,255,0.18)";
          g.strokeRect(x + TS * 0.18, y + TS * 0.10, TS * 0.64, TS * 0.88);
        });
        return;
      }

      if (id === T.ROOT_CABLE) {
        g.fillStyle = "rgba(12,12,26,0.96)";
        g.fillRect(x, y, TS, TS);

        withAlpha(g, 0.65, () => {
          g.strokeStyle = "rgba(53,246,255,0.55)";
          g.lineWidth = 2;
          g.beginPath();
          g.moveTo(x + TS * 0.15, y + TS * 0.70);
          g.lineTo(x + TS * 0.40, y + TS * 0.45);
          g.lineTo(x + TS * 0.70, y + TS * 0.60);
          g.stroke();
        });

        withAlpha(g, 0.35, () => {
          g.strokeStyle = "rgba(255,59,245,0.35)";
          g.lineWidth = 2;
          g.beginPath();
          g.moveTo(x + TS * 0.20, y + TS * 0.35);
          g.lineTo(x + TS * 0.55, y + TS * 0.30);
          g.stroke();
        });
        return;
      }

      if (id === T.SERVER_RACK) {
        g.fillStyle = "rgba(16,18,38,0.96)";
        g.fillRect(x + TS * 0.18, y + TS * 0.10, TS * 0.64, TS * 0.80);

        withAlpha(g, 0.50, () => {
          g.strokeStyle = "rgba(215,217,255,0.18)";
          g.strokeRect(x + TS * 0.18, y + TS * 0.10, TS * 0.64, TS * 0.80);
        });

        withAlpha(g, 0.35, () => {
          g.fillStyle = "rgba(255,59,245,0.25)";
          g.fillRect(x + TS * 0.26, y + TS * 0.22, 3, 3);
          g.fillStyle = "rgba(53,246,255,0.25)";
          g.fillRect(x + TS * 0.26, y + TS * 0.32, 3, 3);
          g.fillRect(x + TS * 0.26, y + TS * 0.42, 3, 3);
        });
        return;
      }

      if (id === T.CUBICLE_WALL) {
        g.fillStyle = "rgba(14,16,34,0.98)";
        g.fillRect(x, y, TS, TS);
        withAlpha(g, 0.22, () => {
          g.strokeStyle = "rgba(53,246,255,0.18)";
          g.strokeRect(x + 2, y + 2, TS - 4, TS - 4);
          g.fillStyle = "rgba(215,217,255,0.10)";
          g.fillRect(x + TS * 0.10, y + TS * 0.55, TS * 0.80, 2);
        });
        return;
      }

      if (id === T.GLASS_SHARD) {
        g.fillStyle = "rgba(10,12,28,0.96)";
        g.fillRect(x, y, TS, TS);
        withAlpha(g, 0.25, () => {
          g.strokeStyle = "rgba(53,246,255,0.25)";
          g.beginPath();
          g.moveTo(x + TS * 0.20, y + TS * 0.75);
          g.lineTo(x + TS * 0.55, y + TS * 0.20);
          g.lineTo(x + TS * 0.80, y + TS * 0.60);
          g.closePath();
          g.stroke();
        });
        return;
      }

      // generic tech debris / machines / junk
      g.fillStyle = "rgba(12,14,30,0.98)";
      g.fillRect(x, y, TS, TS);
      withAlpha(g, 0.18, () => {
        g.strokeStyle = "rgba(255,59,245,0.22)";
        g.strokeRect(x + TS * 0.14, y + TS * 0.14, TS * 0.72, TS * 0.72);
      });
      withAlpha(g, 0.22, () => {
        g.fillStyle = "rgba(53,246,255,0.18)";
        g.fillRect(x + TS * 0.25, y + TS * 0.25, TS * 0.18, TS * 0.18);
      });
      return;
    }

    // Floors
    if (id === T.FLOOR_DIRT || id === T.VOID) {
      g.fillStyle = "rgba(7,10,24,0.92)";
      g.fillRect(x, y, TS, TS);

      withAlpha(g, 0.07, () => {
        g.fillStyle = "rgba(215,217,255,0.20)";
        const s = 1 + (nHash(x, y) > 0.85 ? 1 : 0);
        g.fillRect(x + TS * 0.20, y + TS * 0.35, s, s);
        g.fillRect(x + TS * 0.70, y + TS * 0.60, 1, 1);
      });

      withAlpha(g, 0.05, () => {
        g.fillStyle = "rgba(215,217,255,0.12)";
        g.fillRect(x + TS * 0.85, y, 1, TS);
        g.fillRect(x, y + TS * 0.85, TS, 1);
      });
      return;
    }

    if (id === T.FLOOR_GRASS) {
      g.fillStyle = "rgba(6,12,18,0.92)";
      g.fillRect(x, y, TS, TS);

      const glow = 0.08 + 0.06 * Math.sin(t * 2.0 + (x + y) * 0.004);
      withAlpha(g, 0.20 + glow, () => {
        g.fillStyle = "rgba(53,246,255,0.12)";
        g.fillRect(x + TS * 0.10, y + TS * 0.20, TS * 0.30, 1);
        g.fillRect(x + TS * 0.55, y + TS * 0.55, TS * 0.20, 1);
        g.fillStyle = "rgba(255,59,245,0.10)";
        g.fillRect(x + TS * 0.35, y + TS * 0.70, TS * 0.25, 1);
      });
      return;
    }

    if (id === T.FLOOR_NEON) {
      g.fillStyle = "rgba(8,8,22,0.92)";
      g.fillRect(x, y, TS, TS);

      const pulse = 0.14 + 0.10 * Math.sin(t * 3.2 + (x * 0.01));
      withAlpha(g, 0.30, () => {
        g.fillStyle = "rgba(255,59,245,0.12)";
        g.fillRect(x, y, TS, TS);
      });

      withAlpha(g, 0.35 + pulse, () => {
        g.strokeStyle = "rgba(53,246,255,0.35)";
        g.strokeRect(x + 2, y + 2, TS - 4, TS - 4);
      });

      withAlpha(g, 0.25 + pulse * 0.6, () => {
        g.fillStyle = "rgba(53,246,255,0.20)";
        g.fillRect(x + TS * 0.20, y + TS * 0.50, TS * 0.60, 1);
      });
      return;
    }

    if (id === T.FLOOR_METAL) {
      g.fillStyle = "rgba(8,10,26,0.92)";
      g.fillRect(x, y, TS, TS);

      withAlpha(g, 0.10, () => {
        g.strokeStyle = "rgba(215,217,255,0.16)";
        g.beginPath();
        g.moveTo(x + TS * 0.15, y + TS * 0.20);
        g.lineTo(x + TS * 0.85, y + TS * 0.20);
        g.moveTo(x + TS * 0.15, y + TS * 0.55);
        g.lineTo(x + TS * 0.85, y + TS * 0.55);
        g.stroke();
      });

      withAlpha(g, 0.08, () => {
        g.fillStyle = "rgba(53,246,255,0.14)";
        g.fillRect(x + TS * 0.78, y + TS * 0.12, 2, 2);
      });
      return;
    }

    if (id === T.FLOOR_OFFICE) {
      g.fillStyle = "rgba(8,10,24,0.92)";
      g.fillRect(x, y, TS, TS);

      withAlpha(g, 0.08, () => {
        g.fillStyle = "rgba(215,217,255,0.12)";
        g.fillRect(x + TS * 0.18, y + TS * 0.18, TS * 0.64, 1);
        g.fillRect(x + TS * 0.18, y + TS * 0.50, TS * 0.64, 1);
        g.fillRect(x + TS * 0.18, y + TS * 0.82, TS * 0.64, 1);
      });

      // emergency red speck
      withAlpha(g, 0.10, () => {
        g.fillStyle = "rgba(255,59,245,0.12)";
        g.fillRect(x + TS * 0.70, y + TS * 0.30, 1, 1);
      });
      return;
    }

    if (id === T.FLOOR_WOOD) {
      g.fillStyle = "rgba(10,10,22,0.92)";
      g.fillRect(x, y, TS, TS);

      withAlpha(g, 0.18, () => {
        g.strokeStyle = "rgba(255,59,245,0.10)";
        g.beginPath();
        g.moveTo(x + TS * 0.12, y + TS * 0.25);
        g.lineTo(x + TS * 0.88, y + TS * 0.25);
        g.moveTo(x + TS * 0.12, y + TS * 0.55);
        g.lineTo(x + TS * 0.88, y + TS * 0.55);
        g.stroke();
      });

      withAlpha(g, 0.10, () => {
        g.fillStyle = "rgba(53,246,255,0.12)";
        g.fillRect(x + TS * 0.22, y + TS * 0.22, 2, 2);
      });
      return;
    }

    if (id === T.WIRE_MESH) {
      g.fillStyle = "rgba(8,10,22,0.94)";
      g.fillRect(x, y, TS, TS);
      withAlpha(g, 0.16, () => {
        g.strokeStyle = "rgba(53,246,255,0.22)";
        g.beginPath();
        for (let i = 0; i < 4; i++) {
          const px = x + (i + 1) * (TS / 5);
          g.moveTo(px, y + TS * 0.15);
          g.lineTo(px, y + TS * 0.85);
          const py = y + (i + 1) * (TS / 5);
          g.moveTo(x + TS * 0.15, py);
          g.lineTo(x + TS * 0.85, py);
        }
        g.stroke();
      });
      return;
    }

    if (id === T.MUD) {
      g.fillStyle = "rgba(7,9,18,0.94)";
      g.fillRect(x, y, TS, TS);
      withAlpha(g, 0.08, () => {
        g.fillStyle = "rgba(215,217,255,0.10)";
        g.fillRect(x + TS * 0.30, y + TS * 0.60, TS * 0.25, 2);
      });
      withAlpha(g, 0.10, () => {
        g.fillStyle = "rgba(255,59,245,0.08)";
        g.fillRect(x + TS * 0.58, y + TS * 0.35, 1, 1);
      });
      return;
    }

    // Fallback floor
    g.fillStyle = "rgba(8,10,26,0.92)";
    g.fillRect(x, y, TS, TS);
  }

  /* =========================
     Deco (unchanged; still works)
     ========================= */

  function drawDeco(g, d, x, y, timeMs, TS) {
    if (d.kind === "neon") {
      g.save();
      g.globalAlpha = 0.12;
      g.fillStyle = "rgba(255,59,245,0.50)";
      g.fillRect(x, y, TS, TS);

      g.globalAlpha = 0.65;
      g.strokeStyle = "rgba(53,246,255,0.45)";
      g.strokeRect(x + 2, y + 2, TS - 4, TS - 4);

      const t = timeMs * 0.001;
      g.globalAlpha = 0.55 + 0.15 * Math.sin(t * 5 + d.tx);
      g.fillStyle = "rgba(53,246,255,0.70)";
      g.fillRect(x + TS * 0.35, y + TS * 0.35, TS * 0.30, 2);
      g.restore();
      return;
    }

    if (d.kind === "fence") {
      g.save();
      g.fillStyle = "rgba(20,22,52,0.92)";
      g.fillRect(x, y + TS * 0.25, TS, TS * 0.75);

      g.globalAlpha = 0.25;
      g.strokeStyle = "rgba(215,217,255,0.25)";
      g.beginPath();
      g.moveTo(x + TS * 0.25, y + TS * 0.25);
      g.lineTo(x + TS * 0.25, y + TS);
      g.moveTo(x + TS * 0.75, y + TS * 0.25);
      g.lineTo(x + TS * 0.75, y + TS);
      g.stroke();

      g.restore();
      return;
    }
  }

  /* =========================
     Interactable icons (same as before)
     ========================= */

  function drawProp(g, o, x, y, timeMs, TS, memoriesSet) {
    const collected = o.memory ? memoriesSet?.has(o.memory.id) : false;
    const t = timeMs * 0.001;
    const pulse = 0.70 + 0.30 * Math.sin(t * 3.0 + o.tx * 0.4);

    const cx = x + TS * 0.5;
    const cy = y + TS * 0.5;
    const s = TS;

    // presence glow behind object
    g.save();
    g.globalAlpha = collected ? 0.10 : (0.14 + 0.10 * pulse);
    const bg = g.createRadialGradient(cx, cy, 0, cx, cy, TS * 0.55);
    bg.addColorStop(0, "rgba(255,59,245,0.35)");
    bg.addColorStop(1, "rgba(0,0,0,0)");
    g.fillStyle = bg;
    g.beginPath();
    g.arc(cx, cy, TS * 0.55, 0, Math.PI * 2);
    g.fill();
    g.restore();

    // icon style
    g.save();
    g.globalAlpha = collected ? 0.45 : 0.92;
    g.strokeStyle = "rgba(53,246,255,0.78)";
    g.fillStyle = "rgba(215,217,255,0.14)";
    g.lineWidth = 2;
    g.lineJoin = "round";

    const ix = cx - s * 0.20;
    const iy = cy - s * 0.22;

    switch (o.id) {
      case "streetlight": {
        g.beginPath();
        g.moveTo(cx, cy + s * 0.22);
        g.lineTo(cx, cy - s * 0.10);
        g.stroke();

        g.beginPath();
        g.roundRect(cx - s * 0.14, cy - s * 0.20, s * 0.28, s * 0.16, 6);
        g.fill(); g.stroke();

        g.globalAlpha *= 0.75;
        g.fillStyle = "rgba(255,59,245,0.35)";
        g.beginPath();
        g.arc(cx, cy - s * 0.12, 2.6, 0, Math.PI * 2);
        g.fill();
        break;
      }

      case "payphone": {
        g.beginPath();
        g.roundRect(cx - s * 0.16, cy - s * 0.22, s * 0.32, s * 0.44, 8);
        g.fill(); g.stroke();
        g.globalAlpha *= 0.70;
        g.fillStyle = "rgba(255,59,245,0.30)";
        g.fillRect(cx - s * 0.08, cy - s * 0.03, s * 0.16, s * 0.08);
        break;
      }

      case "vending": {
        g.beginPath();
        g.roundRect(cx - s * 0.18, cy - s * 0.24, s * 0.36, s * 0.48, 8);
        g.fill(); g.stroke();
        g.globalAlpha *= 0.65;
        g.strokeStyle = "rgba(215,217,255,0.22)";
        g.beginPath();
        g.moveTo(cx - s * 0.07, cy - s * 0.18);
        g.lineTo(cx - s * 0.07, cy + s * 0.18);
        g.moveTo(cx + s * 0.07, cy - s * 0.18);
        g.lineTo(cx + s * 0.07, cy + s * 0.18);
        g.stroke();
        break;
      }

      case "bench": {
        g.beginPath();
        g.roundRect(cx - s * 0.22, cy - s * 0.02, s * 0.44, s * 0.14, 7);
        g.fill(); g.stroke();
        g.beginPath();
        g.moveTo(cx - s * 0.16, cy + s * 0.12);
        g.lineTo(cx - s * 0.16, cy + s * 0.22);
        g.moveTo(cx + s * 0.16, cy + s * 0.12);
        g.lineTo(cx + s * 0.16, cy + s * 0.22);
        g.stroke();
        break;
      }

      case "dumpster": {
        g.beginPath();
        g.roundRect(cx - s * 0.22, cy - s * 0.16, s * 0.44, s * 0.30, 8);
        g.fill(); g.stroke();
        g.globalAlpha *= 0.70;
        g.strokeStyle = "rgba(215,217,255,0.22)";
        g.beginPath();
        g.moveTo(cx - s * 0.18, cy - s * 0.05);
        g.lineTo(cx + s * 0.18, cy - s * 0.05);
        g.stroke();
        break;
      }

      case "graffiti": {
        g.globalAlpha *= 0.80;
        g.strokeStyle = "rgba(255,59,245,0.55)";
        g.beginPath();
        g.moveTo(cx - s * 0.22, cy - s * 0.10);
        g.lineTo(cx + s * 0.18, cy - s * 0.14);
        g.lineTo(cx - s * 0.10, cy + s * 0.14);
        g.lineTo(cx + s * 0.22, cy + s * 0.08);
        g.stroke();
        break;
      }

      case "puddle": {
        g.globalAlpha *= 0.85;
        g.strokeStyle = "rgba(53,246,255,0.60)";
        g.beginPath();
        g.ellipse(cx, cy + s * 0.10, s * 0.20, s * 0.10, 0, 0, Math.PI * 2);
        g.stroke();
        g.globalAlpha *= 0.65;
        g.fillStyle = "rgba(53,246,255,0.18)";
        g.beginPath();
        g.ellipse(cx - s * 0.05, cy + s * 0.08, s * 0.10, s * 0.05, 0, 0, Math.PI * 2);
        g.fill();
        break;
      }

      case "neon_sign":
      default: {
        g.beginPath();
        g.roundRect(ix, iy, s * 0.40, s * 0.32, 8);
        g.fill(); g.stroke();
        g.globalAlpha *= 0.70;
        g.fillStyle = "rgba(255,59,245,0.28)";
        g.fillRect(ix + s * 0.06, iy + s * 0.14, s * 0.28, 3);
        break;
      }
    }

    g.restore();

    if (!collected) {
      g.save();
      g.globalAlpha = 0.12;
      g.strokeStyle = "rgba(215,217,255,0.35)";
      g.lineWidth = 1;
      g.beginPath();
      g.moveTo(cx, cy + TS * 0.18);
      g.lineTo(cx, cy + TS * 0.40);
      g.stroke();
      g.restore();
    }
  }

  /* =========================
     Lighting pass (zone-aware + tile-aware)
     ========================= */

  function drawLighting(g, timeMs, TS, WORLD_W, WORLD_H, tileAt, T, interactables) {
    const t = timeMs * 0.001;

    g.save();

    // darken base
    g.globalCompositeOperation = "multiply";
    g.fillStyle = `rgba(0,0,0,${0.30 + 0.06 * Math.sin(t * 0.15)})`;
    g.fillRect(0, 0, WORLD_W, WORLD_H);

    // additive glow
    g.globalCompositeOperation = "screen";

    // derive portal lights (strong)
    const portalLights = [];
    // quick scan around visible area only (cheap enough)
    const pad = 2;
    const minTx = Math.floor(view.camX / TS) - pad;
    const minTy = Math.floor(view.camY / TS) - pad;
    const maxTx = Math.floor((view.camX + view.w) / TS) + pad;
    const maxTy = Math.floor((view.camY + view.h) / TS) + pad;

    for (let ty = minTy; ty <= maxTy; ty++) {
      for (let tx = minTx; tx <= maxTx; tx++) {
        const id = tileAt(tx, ty);
        if (id === T.PORTAL_N || id === T.PORTAL_S || id === T.PORTAL_W || id === T.PORTAL_E) {
          portalLights.push({ tx, ty });
        }
      }
    }

    for (const p of portalLights) {
      const cx = p.tx * TS + TS * 0.5;
      const cy = p.ty * TS + TS * 0.5;
      const rr = TS * (5.8 + 0.25 * Math.sin(t * 2.2 + p.tx));
      const grad = g.createRadialGradient(cx, cy, 0, cx, cy, rr);
      grad.addColorStop(0, "rgba(255,59,245,0.20)");
      grad.addColorStop(0.45, "rgba(53,246,255,0.12)");
      grad.addColorStop(1, "rgba(0,0,0,0)");
      g.fillStyle = grad;
      g.beginPath();
      g.arc(cx, cy, rr, 0, Math.PI * 2);
      g.fill();
    }

    // interactable lights (soft)
    for (const o of interactables) {
      const cx = o.tx * TS + TS * 0.5;
      const cy = o.ty * TS + TS * 0.5;
      const rr = TS * (3.8 + 0.18 * Math.sin(t * 2.0 + o.tx));
      const grad = g.createRadialGradient(cx, cy, 0, cx, cy, rr);
      grad.addColorStop(0, "rgba(53,246,255,0.10)");
      grad.addColorStop(1, "rgba(0,0,0,0)");
      g.fillStyle = grad;
      g.beginPath();
      g.arc(cx, cy, rr, 0, Math.PI * 2);
      g.fill();
    }

    // ambient “neon road” banding (subtle, still cheap)
    // sample a few points across the visible tiles, glow where FLOOR_NEON appears
    const step = 4; // coarse sampling
    for (let ty = minTy; ty <= maxTy; ty += step) {
      for (let tx = minTx; tx <= maxTx; tx += step) {
        const id = tileAt(tx, ty);
        if (id !== T.FLOOR_NEON) continue;
        const cx = tx * TS + TS * 0.5;
        const cy = ty * TS + TS * 0.5;
        const rr = TS * 2.8;
        const grad = g.createRadialGradient(cx, cy, 0, cx, cy, rr);
        grad.addColorStop(0, "rgba(255,59,245,0.05)");
        grad.addColorStop(1, "rgba(0,0,0,0)");
        g.fillStyle = grad;
        g.beginPath();
        g.arc(cx, cy, rr, 0, Math.PI * 2);
        g.fill();
      }
    }

    g.restore();
  }

  /* =========================
     Player rendering
     ========================= */

  function drawPlayer(g, player, timeMs, glow = 1, SCALE) {
    const bob = Math.sin(player.walkT || 0) * (2 * SCALE);
    const x = Math.round(player.x);
    const y = Math.round(player.y + bob);

    const bodyW = player.w;
    const bodyH = player.h;

    g.save();
    g.globalAlpha = 0.18;
    g.fillStyle = "#000";
    g.beginPath();
    g.ellipse(x, y + bodyH * 0.10, bodyW * 0.40, bodyH * 0.18, 0, 0, Math.PI * 2);
    g.fill();
    g.restore();

    g.save();
    g.globalAlpha = 0.18 * glow;
    g.strokeStyle = "rgba(53,246,255,0.9)";
    g.lineWidth = 10;
    g.lineJoin = "round";
    roundRect(g, x - bodyW * 0.5, y - bodyH * 0.85, bodyW, bodyH, 10);
    g.stroke();
    g.restore();

    g.save();
    g.globalAlpha = 0.92;
    g.fillStyle = "rgba(215,217,255,0.88)";
    g.strokeStyle = "rgba(53,246,255,0.75)";
    g.lineWidth = 2;
    roundRect(g, x - bodyW * 0.5, y - bodyH * 0.85, bodyW, bodyH, 10);
    g.fill(); g.stroke();

    g.globalAlpha = 0.9;
    g.fillStyle = "rgba(215,217,255,0.80)";
    const snoutW = bodyW * 0.22;
    const snoutH = bodyH * 0.28;
    const sx = x + (player.face || 1) * bodyW * 0.26 - snoutW / 2;
    const sy = y - bodyH * 0.62;
    roundRect(g, sx, sy, snoutW, snoutH, 8);
    g.fill(); g.stroke();

    g.globalAlpha = 0.85;
    g.fillStyle = "rgba(255,59,245,0.75)";
    g.beginPath();
    g.arc(x + (player.face || 1) * bodyW * 0.18, y - bodyH * 0.58, 2.2, 0, Math.PI * 2);
    g.fill();

    g.restore();
  }

  /* =========================
     Interaction bracket
     ========================= */

  function drawInteractBracket(g, cx, cy, timeMs, TS, SCALE) {
    const t = timeMs * 0.001;
    const a = 0.40 + 0.25 * Math.sin(t * 4.2);
    const r = TS * 0.42;
    const c = 10 * SCALE;

    g.save();
    g.globalAlpha = a;
    g.strokeStyle = "rgba(53,246,255,0.85)";
    g.lineWidth = 2;

    g.beginPath();
    g.moveTo(cx - r, cy - r + c);
    g.lineTo(cx - r, cy - r);
    g.lineTo(cx - r + c, cy - r);

    g.moveTo(cx + r - c, cy - r);
    g.lineTo(cx + r, cy - r);
    g.lineTo(cx + r, cy - r + c);

    g.moveTo(cx + r, cy + r - c);
    g.lineTo(cx + r, cy + r);
    g.lineTo(cx + r - c, cy + r);

    g.moveTo(cx - r + c, cy + r);
    g.lineTo(cx - r, cy + r);
    g.lineTo(cx - r, cy + r - c);

    g.stroke();
    g.restore();
  }

  /* =========================
     World draw entrypoint
     ========================= */

  function drawWorld(timeMs, state) {
    // Important: pull current constants each frame (zone switches)
    const W = CB.world;
    const C = W.constants;
    const T = W.T;

    const TS = C.TS;
    const WORLD_W = C.WORLD_W;
    const WORLD_H = C.WORLD_H;
    const SCALE = C.SCALE;

    const tileAt = W.tileAt;

    // IMPORTANT: do not cache these globally (zone changes)
    const deco = W.deco || [];
    const interactables = W.interactables || [];

    // screen clear
    ctx.fillStyle = "#060714";
    ctx.fillRect(0, 0, view.w, view.h);

    // vibrant background gradient (screen space)
    const grd = ctx.createLinearGradient(0, 0, 0, view.h);
    grd.addColorStop(0, "rgba(12,8,28,1)");
    grd.addColorStop(0.55, "rgba(6,8,18,1)");
    grd.addColorStop(1, "rgba(3,5,12,1)");
    ctx.fillStyle = grd;
    ctx.fillRect(0, 0, view.w, view.h);

    ctx.save();
    ctx.translate(-view.camX, -view.camY);

    // visible tile range
    const pad = 2;
    const minTx = Math.floor(view.camX / TS) - pad;
    const minTy = Math.floor(view.camY / TS) - pad;
    const maxTx = Math.floor((view.camX + view.w) / TS) + pad;
    const maxTy = Math.floor((view.camY + view.h) / TS) + pad;

    for (let ty = minTy; ty <= maxTy; ty++) {
      for (let tx = minTx; tx <= maxTx; tx++) {
        const id = tileAt(tx, ty);
        drawTile(ctx, id, tx * TS, ty * TS, timeMs, TS, T);
      }
    }

    for (const d of deco) drawDeco(ctx, d, d.tx * TS, d.ty * TS, timeMs, TS);

    const memSet = state?.memories;
    for (const o of interactables) {
      drawProp(ctx, o, o.tx * TS, o.ty * TS, timeMs, TS, memSet);
    }

    drawLighting(ctx, timeMs, TS, WORLD_W, WORLD_H, tileAt, T, interactables);

    ctx.restore();

    drawScanlines(ctx);
  }

  /* =========================
     Export API
     ========================= */

  CB.render = CB.render || {};
  CB.render.drawWorld = drawWorld;
  CB.render.drawPlayer = (player, timeMs, glow) => {
    const C = CB.world.constants;
    drawPlayer(ctx, player, timeMs, glow, C.SCALE);
  };
  CB.render.drawInteractBracket = (cx, cy, timeMs) => {
    const C = CB.world.constants;
    drawInteractBracket(ctx, cx, cy, timeMs, C.TS, C.SCALE);
  };

  CB.render.VERSION = "render-v2-zone-tiles";
})();
