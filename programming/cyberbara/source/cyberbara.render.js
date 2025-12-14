/* cyberbara.render.js
   Cyberbara (streetlight lo-fi) — Rendering
   Version: High Detail + Depth
*/

(() => {
  "use strict";

  const CB = (window.Cyberbara = window.Cyberbara || {});
  if (!CB.util || !CB.dom?.ctx || !CB.world?.constants) return;

  const { clamp } = CB.util;
  const { ctx } = CB.dom;
  const view = CB.view;

  const { TS, MAP_W, MAP_H, WORLD_W, WORLD_H, SCALE } = CB.world.constants;
  const tileAt = CB.world.tileAt;
  const interactables = CB.world.interactables;

  // --- Helpers ---

  function roundRect(g, x, y, w, h, r) {
    g.beginPath();
    g.roundRect(x, y, w, h, r);
    g.closePath();
  }

  // --- The New Tile Renderer ---

  function drawTile(g, id, x, y, timeMs) {
    const t = timeMs * 0.001;
    
    // 0: Floor
    if (id === 0) {
      g.fillStyle = "#0c0e1e"; // Deep blue-grey
      g.fillRect(x, y, TS, TS);
      
      // Noise texture
      if ((x + y) % 3 === 0) {
        g.fillStyle = "rgba(255,255,255,0.03)";
        g.fillRect(x + 2, y + 2, 2, 2);
      }
      return;
    }

    // 1: Wall (Building) - "Pseudo 3D"
    if (id === 1) {
      // 1. The "Roof" (Top sliver)
      const roofH = TS * 0.3;
      g.fillStyle = "#1a1d3a"; // Lighter top
      g.fillRect(x, y, TS, roofH);

      // 2. The "Face" (Front wall)
      g.fillStyle = "#080914"; // Darker front
      g.fillRect(x, y + roofH, TS, TS - roofH);

      // 3. Edge Highlight
      g.fillStyle = "rgba(53,246,255,0.1)";
      g.fillRect(x, y + roofH, TS, 1);
      return;
    }

    // 2: Street
    if (id === 2) {
      g.fillStyle = "#151726"; // Slightly lighter than floor
      g.fillRect(x, y, TS, TS);
      
      // Road markings (subtle)
      g.fillStyle = "rgba(0,0,0,0.2)";
      g.fillRect(x, y, 1, TS); 
      return;
    }

    // 3: Puddle
    if (id === 3) {
      g.fillStyle = "#05060f";
      g.fillRect(x, y, TS, TS);
      
      // Reflection
      const sheen = 0.15 + 0.1 * Math.sin(t * 2 + x * 0.1);
      g.globalAlpha = sheen;
      g.fillStyle = "#35f6ff";
      g.beginPath();
      g.ellipse(x + TS/2, y + TS/2, TS * 0.3, TS * 0.15, 0, 0, Math.PI * 2);
      g.fill();
      g.globalAlpha = 1;
      return;
    }

    // 4: Neon Wall (New!)
    if (id === 4) {
      // Base wall
      g.fillStyle = "#080914";
      g.fillRect(x, y, TS, TS);

      // Neon strip
      const pulse = 0.5 + 0.5 * Math.sin(t * 5 + y);
      g.shadowBlur = 10;
      g.shadowColor = "rgba(255, 59, 245, 0.8)";
      g.fillStyle = `rgba(255, 59, 245, ${0.4 + pulse * 0.4})`;
      g.fillRect(x + TS * 0.4, y, TS * 0.2, TS);
      g.shadowBlur = 0;
      return;
    }

    // 5: Fence (New!)
    if (id === 5) {
      g.fillStyle = "#0b0d1c";
      g.fillRect(x, y, TS, TS);
      
      g.strokeStyle = "#2a2d45";
      g.lineWidth = 1;
      g.beginPath();
      // Cross hatch
      g.moveTo(x, y); g.lineTo(x + TS, y + TS);
      g.moveTo(x + TS, y); g.lineTo(x, y + TS);
      g.stroke();
      
      // Top bar
      g.fillStyle = "#1a1d3a";
      g.fillRect(x, y + 2, TS, 2);
      return;
    }
  }

  // --- Props & Interactables ---

  function drawProp(g, o, x, y, timeMs, memoriesSet) {
    const collected = o.memory ? memoriesSet?.has(o.memory.id) : false;
    const t = timeMs * 0.001;
    const cx = x + TS * 0.5;
    const cy = y + TS * 0.5;

    // Draw a glow if not collected
    if (!collected && o.pages) {
      const pulse = 0.5 + 0.5 * Math.sin(t * 3);
      g.globalAlpha = 0.1 + pulse * 0.1;
      g.fillStyle = "#35f6ff";
      g.beginPath();
      g.arc(cx, cy, TS * 0.6, 0, Math.PI * 2);
      g.fill();
      g.globalAlpha = 1;
    }

    // Simple icons based on ID
    g.strokeStyle = collected ? "#444" : "#fff";
    g.lineWidth = 2;
    g.beginPath();

    if (o.id === "streetlight") {
      g.moveTo(cx, cy + 8); g.lineTo(cx, cy - 8);
      g.arc(cx, cy - 8, 3, 0, Math.PI, true);
    } else if (o.id === "vending") {
      g.rect(cx - 6, cy - 10, 12, 20);
    } else if (o.id === "bench") {
      g.moveTo(cx - 8, cy + 5); g.lineTo(cx + 8, cy + 5);
      g.moveTo(cx - 6, cy + 5); g.lineTo(cx - 6, cy - 2);
    } else {
      // Default dot
      g.arc(cx, cy, 2, 0, Math.PI * 2);
    }
    
    g.stroke();
  }

  function drawLighting(g, timeMs) {
    const t = timeMs * 0.001;
    
    // Global darkness
    g.globalCompositeOperation = "multiply";
    g.fillStyle = "rgba(0,0,0,0.5)";
    g.fillRect(0, 0, WORLD_W, WORLD_H);

    // Light sources (Iterate map for neon tiles + interactables)
    g.globalCompositeOperation = "screen";
    
    // Helper to draw light
    const castLight = (lx, ly, radius, color) => {
      const grad = g.createRadialGradient(lx, ly, 0, lx, ly, radius);
      grad.addColorStop(0, color);
      grad.addColorStop(1, "rgba(0,0,0,0)");
      g.fillStyle = grad;
      g.beginPath();
      g.arc(lx, ly, radius, 0, Math.PI * 2);
      g.fill();
    };

    // 1. Streetlights (from interactables)
    for (const o of interactables) {
      if (o.id === "streetlight") {
         castLight(o.tx * TS + TS/2, o.ty * TS + TS/2, TS * 5, "rgba(53,246,255,0.2)");
      } else if (o.id === "neon_sign" || o.id === "vending") {
         castLight(o.tx * TS + TS/2, o.ty * TS + TS/2, TS * 3, "rgba(255,59,245,0.15)");
      }
    }

    // 2. Neon Walls (Scan the view range ideally, but map is small enough to loop)
    // Optimization: In a real game, don't loop entire map every frame.
    // Here we just do it for effect simplicity.
    const flicker = 0.9 + 0.1 * Math.random();
    for(let y=0; y<MAP_H; y++) {
      for(let x=0; x<MAP_W; x++) {
        if (tileAt(x, y) === 4) { // Neon Wall
          castLight(x*TS + TS/2, y*TS + TS/2, TS * 2, `rgba(255,59,245,${0.05 * flicker})`);
        }
      }
    }
    
    g.globalCompositeOperation = "source-over";
  }

  // --- Main Draw Loop ---

  function drawWorld(timeMs, state) {
    // Fill BG
    ctx.fillStyle = "#04050e";
    ctx.fillRect(0, 0, view.w, view.h);

    ctx.save();
    ctx.translate(-view.camX, -view.camY);

    // Culling
    const pad = 1;
    const minTx = Math.floor(view.camX / TS) - pad;
    const minTy = Math.floor(view.camY / TS) - pad;
    const maxTx = Math.floor((view.camX + view.w) / TS) + pad;
    const maxTy = Math.floor((view.camY + view.h) / TS) + pad;

    // Draw Map
    for (let ty = minTy; ty <= maxTy; ty++) {
      for (let tx = minTx; tx <= maxTx; tx++) {
        drawTile(ctx, tileAt(tx, ty), tx * TS, ty * TS, timeMs);
      }
    }

    // Draw Props
    const memSet = state?.memories;
    for (const o of interactables) {
      drawProp(ctx, o, o.tx * TS, o.ty * TS, timeMs, memSet);
    }

    // Lighting
    drawLighting(ctx, timeMs);

    ctx.restore();
    
    // Scanlines
    ctx.fillStyle = "rgba(0,0,0,0.1)";
    for(let i=0; i<view.h; i+=4) ctx.fillRect(0, i, view.w, 2);
  }

  // Exports
  CB.render = CB.render || {};
  CB.render.drawWorld = drawWorld;
  // Keep existing player/bracket renderers from previous version or minimal stubs
  CB.render.drawPlayer = (player, timeMs) => {
      const x = player.x - view.camX;
      const y = player.y - view.camY;
      ctx.fillStyle = "#fff"; 
      ctx.fillRect(x - player.w/2, y - player.h, player.w, player.h); // Simple fallback
  };
  CB.render.drawInteractBracket = (cx, cy, timeMs) => {
      // (Keep your previous logic here or assume it's handled)
      ctx.save();
      ctx.translate(-view.camX, -view.camY);
      ctx.strokeStyle = "#fff";
      ctx.strokeRect(cx - 10, cy - 10, 20, 20);
      ctx.restore();
  };

})();