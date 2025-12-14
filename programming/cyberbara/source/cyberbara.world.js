/* cyberbara.world.js
   Cyberbara — 5-Zone Cross World (Vibrant Cyberpunk)
   Focus: world data/logic, tile generation, zone maps, transitions, spawns.

   IMPORTANT: This version restores compatibility with your current boot/render code:
     - CB.world.deco (array) + CB.world.isDecoSolidAt(tx,ty)
     - CB.world.interactables (array) + CB.world.interactableNearTile(tx,ty)
     - CB.world.MEM_TOTAL (total memories across ALL zones)

   Zones (cross layout):
     - hub (center): cyber forest with Wise Willow in center, 4 roads to edges
     - north: abandoned factory (enter from hub via north road; spawn at center-south)
     - south: junk river (enter from hub via south road; spawn at center-north)
     - west: corporate ruins (enter from hub via west road; spawn at center-east)
     - east: hoarder’s nest (enter from hub via east road; spawn at center-west)

   Compatibility:
     - CB.world.constants has MAP_W/H, WORLD_W/H, TS etc (for *active zone*)
     - CB.world.tileAt(tx,ty) reads from active zone
     - CB.world.isWalkableTile(id) defines collision semantics
*/

(() => {
  "use strict";

  const CB = (window.Cyberbara = window.Cyberbara || {});
  if (!CB.util) {
    console.error("[cyberbara.world] missing core (cyberbara.core.js must load first)");
    return;
  }

  /* =========================
     Tile sizing
     ========================= */

  const TILE = 16;
  const SCALE = 3;
  const TS = TILE * SCALE;

  /* =========================
     Tile IDs (high variety)
     ========================= */

  const T = Object.freeze({
    // base
    VOID: 0,            // fallback / empty (treat as floor-ish)
    SOLID_WALL: 1,      // generic solid wall / boundary
    FLOOR_DIRT: 2,      // forest floor
    FLOOR_GRASS: 3,     // biolum grass (walkable)
    FLOOR_NEON: 4,      // neon pavement (walkable)
    FLOOR_METAL: 5,     // industrial metal (walkable)
    FLOOR_OFFICE: 6,    // office carpet/tiles (walkable)
    FLOOR_WOOD: 7,      // treehouse wood planks (walkable)

    // hazards / liquids
    WATER_RIVER: 20,    // river water (not walkable)
    NEON_FLUID: 21,     // toxic neon pools (not walkable)
    MUD: 22,            // muddy bank (walkable; slow later)

    // obstacles (solid)
    TREE_TRUNK: 40,
    ROOT_CABLE: 41,
    SERVER_RACK: 42,
    MACHINE: 43,
    CONVEYOR: 44,
    CUBICLE_WALL: 45,
    GLASS_SHARD: 46,
    DEBRIS: 47,
    SCRAP_PILE: 48,

    // “platform-like” (optional future semantics)
    TECH_JUNK: 60,      // in-river junk (treat as solid for now)
    WIRE_MESH: 61,      // walkable variant

    // transitions (walkable triggers)
    PORTAL_N: 90,
    PORTAL_S: 91,
    PORTAL_W: 92,
    PORTAL_E: 93,
  });

  /* =========================
     Zone sizing
     ========================= */

  const ZONE_W = 48;
  const ZONE_H = 28;

  function makeTiles(fillId) {
    return new Array(ZONE_W * ZONE_H).fill(fillId);
  }

  function idx(x, y) { return y * ZONE_W + x; }

  function inBounds(x, y) {
    return x >= 0 && y >= 0 && x < ZONE_W && y < ZONE_H;
  }

  function set(tiles, x, y, id) {
    if (!inBounds(x, y)) return;
    tiles[idx(x, y)] = id;
  }

  function get(tiles, x, y) {
    if (!inBounds(x, y)) return T.SOLID_WALL;
    return tiles[idx(x, y)] | 0;
  }

  function fillRect(tiles, x0, y0, w, h, id) {
    for (let y = y0; y < y0 + h; y++) {
      for (let x = x0; x < x0 + w; x++) set(tiles, x, y, id);
    }
  }

  function borderWalls(tiles) {
    for (let x = 0; x < ZONE_W; x++) { set(tiles, x, 0, T.SOLID_WALL); set(tiles, x, ZONE_H - 1, T.SOLID_WALL); }
    for (let y = 0; y < ZONE_H; y++) { set(tiles, 0, y, T.SOLID_WALL); set(tiles, ZONE_W - 1, y, T.SOLID_WALL); }
  }

  // sprinkle helper for “dense world” feel
  function sprinkle(tiles, id, count, x0 = 1, y0 = 1, x1 = ZONE_W - 2, y1 = ZONE_H - 2, avoidFn = null) {
    const makeRng = CB.util.makeRng || ((seed) => {
      // tiny fallback RNG (LCG) if core doesn't provide makeRng (should, but safe)
      let s = (seed >>> 0) || 123456789;
      return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
    });

    const rng = makeRng((count * 2654435761) ^ (id * 97));
    let placed = 0;
    let tries = 0;

    while (placed < count && tries < count * 30) {
      tries++;
      const x = Math.floor(x0 + rng() * (x1 - x0 + 1));
      const y = Math.floor(y0 + rng() * (y1 - y0 + 1));
      if (avoidFn && avoidFn(x, y)) continue;

      const cur = get(tiles, x, y);
      if (cur === T.SOLID_WALL) continue;

      set(tiles, x, y, id);
      placed++;
    }
  }

  function carveRoad(tiles, fromX, fromY, toX, toY, roadId, width = 3) {
    const half = Math.floor(width / 2);

    const stepX = fromX <= toX ? 1 : -1;
    for (let x = fromX; x !== toX + stepX; x += stepX) {
      for (let dy = -half; dy <= half; dy++) set(tiles, x, fromY + dy, roadId);
    }

    const stepY = fromY <= toY ? 1 : -1;
    for (let y = fromY; y !== toY + stepY; y += stepY) {
      for (let dx = -half; dx <= half; dx++) set(tiles, toX + dx, y, roadId);
    }
  }

  /* =========================
     Walkability / collision semantics
     ========================= */

  function isWalkableTile(id) {
    // portals are walkable triggers
    if (id === T.PORTAL_N || id === T.PORTAL_S || id === T.PORTAL_W || id === T.PORTAL_E) return true;

    // liquids are not walkable
    if (id === T.WATER_RIVER || id === T.NEON_FLUID) return false;

    // solids
    if (
      id === T.SOLID_WALL ||
      id === T.TREE_TRUNK ||
      id === T.ROOT_CABLE ||
      id === T.SERVER_RACK ||
      id === T.MACHINE ||
      id === T.CONVEYOR ||
      id === T.CUBICLE_WALL ||
      id === T.GLASS_SHARD ||
      id === T.DEBRIS ||
      id === T.SCRAP_PILE ||
      id === T.TECH_JUNK
    ) return false;

    return true;
  }

  /* =========================
     Zone generators
     ========================= */

  function genHubCyberForest() {
    const tiles = makeTiles(T.FLOOR_DIRT);
    borderWalls(tiles);

    sprinkle(tiles, T.FLOOR_GRASS, 160, 2, 2, ZONE_W - 3, ZONE_H - 3);

    // tech ruins
    fillRect(tiles, 9, 6, 4, 3, T.SERVER_RACK);
    fillRect(tiles, 35, 7, 4, 3, T.SERVER_RACK);
    fillRect(tiles, 14, 18, 4, 3, T.SERVER_RACK);

    const cx = Math.floor(ZONE_W / 2);
    const cy = Math.floor(ZONE_H / 2);

    const avoidCross = (x, y) => {
      const onCross = (Math.abs(x - cx) <= 2) || (Math.abs(y - cy) <= 2);
      const inWillow = (Math.abs(x - cx) <= 3 && Math.abs(y - cy) <= 3);
      return onCross || inWillow;
    };

    // dense forest, keep cross + willow area open
    sprinkle(tiles, T.TREE_TRUNK, 100, 2, 2, ZONE_W - 3, ZONE_H - 3, avoidCross);

    // neon roads to edges
    carveRoad(tiles, cx, cy, cx, 1, T.FLOOR_NEON, 5);
    carveRoad(tiles, cx, cy, cx, ZONE_H - 2, T.FLOOR_NEON, 5);
    carveRoad(tiles, cx, cy, 1, cy, T.FLOOR_NEON, 5);
    carveRoad(tiles, cx, cy, ZONE_W - 2, cy, T.FLOOR_NEON, 5);

    // portals at ends
    set(tiles, cx, 1, T.PORTAL_N);
    set(tiles, cx, ZONE_H - 2, T.PORTAL_S);
    set(tiles, 1, cy, T.PORTAL_W);
    set(tiles, ZONE_W - 2, cy, T.PORTAL_E);

    // wise willow roots (obstacle footprint)
    const rootRadius = 5;
    for (let y = cy - rootRadius; y <= cy + rootRadius; y++) {
      for (let x = cx - rootRadius; x <= cx + rootRadius; x++) {
        const dx = x - cx;
        const dy = y - cy;
        const d2 = dx * dx + dy * dy;
        if (d2 <= 7) set(tiles, x, y, T.ROOT_CABLE);
        else if (d2 <= 18 && get(tiles, x, y) !== T.FLOOR_NEON) set(tiles, x, y, T.FLOOR_GRASS);
      }
    }

    // clearing around willow so movement doesn't feel blocked
    fillRect(tiles, cx - 2, cy - 2, 5, 5, T.FLOOR_GRASS);

    return { tiles };
  }

  function genNorthAbandonedFactory() {
    const tiles = makeTiles(T.FLOOR_METAL);
    borderWalls(tiles);

    const cx = Math.floor(ZONE_W / 2);

    // central lane (hazard vibe later)
    carveRoad(tiles, cx, 1, cx, ZONE_H - 2, T.FLOOR_NEON, 3);

    // machinery + conveyors
    for (let y = 4; y < ZONE_H - 4; y += 4) {
      for (let x = 6; x < ZONE_W - 6; x += 8) {
        fillRect(tiles, x, y, 3, 2, T.MACHINE);
        fillRect(tiles, x + 4, y + 1, 3, 2, T.CONVEYOR);
      }
    }

    // neon fluid pools (avoid the main lane)
    sprinkle(tiles, T.NEON_FLUID, 42, 3, 3, ZONE_W - 4, ZONE_H - 4, (x, y) => Math.abs(x - cx) <= 2);

    // edge debris
    sprinkle(tiles, T.DEBRIS, 70);

    // portal back to hub (south)
    set(tiles, cx, ZONE_H - 2, T.PORTAL_S);

    return { tiles };
  }

  function genSouthJunkRiver() {
    const tiles = makeTiles(T.FLOOR_DIRT);
    borderWalls(tiles);

    sprinkle(tiles, T.FLOOR_GRASS, 140);
    sprinkle(tiles, T.MUD, 110);

    const riverY = Math.floor(ZONE_H / 2);

    // river band
    for (let y = riverY - 2; y <= riverY + 2; y++) {
      for (let x = 1; x <= ZONE_W - 2; x++) set(tiles, x, y, T.WATER_RIVER);
    }

    // wire mesh banks
    for (let x = 2; x <= ZONE_W - 3; x++) {
      set(tiles, x, riverY - 3, T.WIRE_MESH);
      set(tiles, x, riverY + 3, T.WIRE_MESH);
    }

    // tech junk in river
    const makeRng = CB.util.makeRng || ((seed) => {
      let s = (seed >>> 0) || 123456789;
      return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
    });
    const rng = makeRng(0xC0FFEE);

    for (let i = 0; i < 18; i++) {
      const x = 3 + Math.floor(rng() * (ZONE_W - 6));
      const y = riverY - 2 + Math.floor(rng() * 5);
      set(tiles, x, y, T.TECH_JUNK);
    }

    // central ford (walkable mesh)
    const cx = Math.floor(ZONE_W / 2);
    for (let y = 1; y <= ZONE_H - 2; y++) {
      if (Math.abs(y - riverY) <= 2) set(tiles, cx, y, T.WIRE_MESH);
    }

    // portal back to hub (north)
    set(tiles, cx, 1, T.PORTAL_N);

    return { tiles };
  }

  function genWestCorporateRuins() {
    const tiles = makeTiles(T.FLOOR_OFFICE);
    borderWalls(tiles);

    // fill interior with cubicle walls then carve corridors
    fillRect(tiles, 4, 4, ZONE_W - 8, ZONE_H - 8, T.CUBICLE_WALL);

    for (let y = 6; y < ZONE_H - 6; y += 4) fillRect(tiles, 6, y, ZONE_W - 12, 2, T.FLOOR_OFFICE);
    for (let x = 6; x < ZONE_W - 6; x += 6) fillRect(tiles, x, 6, 2, ZONE_H - 12, T.FLOOR_OFFICE);

    // glass fields
    sprinkle(tiles, T.GLASS_SHARD, 55, 2, 2, ZONE_W - 3, ZONE_H - 3, (x, y) => {
      return (x > ZONE_W - 10 && Math.abs(y - Math.floor(ZONE_H / 2)) <= 3);
    });

    // emergency accents
    sprinkle(tiles, T.FLOOR_NEON, 45);

    // portal back to hub (east)
    const cy = Math.floor(ZONE_H / 2);
    set(tiles, ZONE_W - 2, cy, T.PORTAL_E);

    return { tiles };
  }

  function genEastHoardersNest() {
    const tiles = makeTiles(T.FLOOR_DIRT);
    borderWalls(tiles);

    // large treehouse wood mass
    const x0 = Math.floor(ZONE_W * 0.45);
    const y0 = Math.floor(ZONE_H * 0.25);
    const w = Math.floor(ZONE_W * 0.45);
    const h = Math.floor(ZONE_H * 0.55);
    fillRect(tiles, x0, y0, w, h, T.FLOOR_WOOD);

    // cable vines around structure
    for (let i = 0; i < 20; i++) {
      const x = x0 - 2 + (i % 5) * 2;
      const y = y0 - 1 + Math.floor(i / 5) * 2;
      if (inBounds(x, y)) set(tiles, x, y, T.ROOT_CABLE);
    }

    // dense scrap piles (keep entry corridor open)
    sprinkle(tiles, T.SCRAP_PILE, 90, 2, 2, ZONE_W - 3, ZONE_H - 3, (x, y) => {
      return (x < 10 && Math.abs(y - Math.floor(ZONE_H / 2)) <= 3);
    });

    // warm neon pockets
    sprinkle(tiles, T.FLOOR_NEON, 65);

    // some trunks to tie to nature
    sprinkle(tiles, T.TREE_TRUNK, 28);

    // portal back to hub (west)
    const cy = Math.floor(ZONE_H / 2);
    set(tiles, 1, cy, T.PORTAL_W);

    return { tiles };
  }

  /* =========================
     Zone registry (cross layout)
     ========================= */

  function makeZone(name, generator, entrySpawns) {
    const { tiles } = generator();
    return {
      name,
      w: ZONE_W,
      h: ZONE_H,
      tiles,
      entrySpawns,   // entryKey -> {tx,ty}
      deco: [],      // optional per-zone deco objects (non-tile)
      interactables: [], // optional per-zone interactables
    };
  }

  const cx = Math.floor(ZONE_W / 2);
  const cy = Math.floor(ZONE_H / 2);

  const zones = {
    hub: makeZone("hub", genHubCyberForest, {
      fromNorth: { tx: cx, ty: 2 },
      fromSouth: { tx: cx, ty: ZONE_H - 3 },
      fromWest:  { tx: 2,  ty: cy },
      fromEast:  { tx: ZONE_W - 3, ty: cy },
      start:     { tx: cx, ty: cy + 6 },
    }),

    north: makeZone("north", genNorthAbandonedFactory, {
      fromHub: { tx: cx, ty: ZONE_H - 3 },
    }),

    south: makeZone("south", genSouthJunkRiver, {
      fromHub: { tx: cx, ty: 2 },
    }),

    west: makeZone("west", genWestCorporateRuins, {
      fromHub: { tx: ZONE_W - 3, ty: cy },
    }),

    east: makeZone("east", genEastHoardersNest, {
      fromHub: { tx: 2, ty: cy },
    }),
  };

  /* =========================
     Portal / transition logic
     ========================= */

  function checkTransitionAtTile(tx, ty) {
    const z = CB.world.activeZone;
    if (!z) return null;

    const id = tileAt(tx, ty);

    if (z.name === "hub") {
      if (id === T.PORTAL_N) return { toZone: "north", entryKey: "fromHub" };
      if (id === T.PORTAL_S) return { toZone: "south", entryKey: "fromHub" };
      if (id === T.PORTAL_W) return { toZone: "west",  entryKey: "fromHub" };
      if (id === T.PORTAL_E) return { toZone: "east",  entryKey: "fromHub" };
      return null;
    }

    if (z.name === "north" && id === T.PORTAL_S) return { toZone: "hub", entryKey: "fromNorth" };
    if (z.name === "south" && id === T.PORTAL_N) return { toZone: "hub", entryKey: "fromSouth" };
    if (z.name === "west"  && id === T.PORTAL_E) return { toZone: "hub", entryKey: "fromWest" };
    if (z.name === "east"  && id === T.PORTAL_W) return { toZone: "hub", entryKey: "fromEast" };

    return null;
  }

  /* =========================
     Active-zone compatibility layer
     ========================= */

  function tileAt(tx, ty) {
    const z = CB.world.activeZone;
    if (!z) return T.SOLID_WALL;
    if (tx < 0 || ty < 0 || tx >= z.w || ty >= z.h) return T.SOLID_WALL;
    return z.tiles[ty * z.w + tx] | 0;
  }

  // --- Compatibility views (render.js and boot.js expect these at top-level) ---

  function syncActiveZoneViews() {
    const z = CB.world.activeZone;
    CB.world.deco = z?.deco || [];
    CB.world.interactables = z?.interactables || [];
  }

  function isDecoSolidAt(tx, ty) {
    const list = CB.world.deco || [];
    for (const d of list) {
      if (d && d.solid && d.tx === tx && d.ty === ty) return true;
    }
    return false;
  }

  function interactableNearTile(tx, ty) {
    const list = CB.world.interactables || [];
    for (const o of list) {
      if (!o) continue;
      const dx = Math.abs(o.tx - tx);
      const dy = Math.abs(o.ty - ty);
      if (dx + dy <= 1) return o;
    }
    return null;
  }

  function computeMemTotalAllZones() {
    let total = 0;
    for (const k of Object.keys(zones)) {
      const z = zones[k];
      const arr = z?.interactables || [];
      for (const o of arr) if (o && o.memory) total++;
    }
    return total;
  }

  function setActiveZone(zoneName, entryKey = "start") {
    const zone = zones[zoneName];
    if (!zone) throw new Error(`Unknown zone: ${zoneName}`);

    CB.world.activeZone = zone;
    CB.world.zoneName = zone.name;

    // Update compatibility constants for current zone
    CB.world.constants = {
      TILE, SCALE, TS,
      MAP_W: zone.w,
      MAP_H: zone.h,
      WORLD_W: zone.w * TS,
      WORLD_H: zone.h * TS,
      ZONE_W: zone.w,
      ZONE_H: zone.h,
    };

    const spawn =
      zone.entrySpawns?.[entryKey] ||
      zone.entrySpawns?.start ||
      { tx: cx, ty: cy };

    CB.world.spawn = { ...spawn };

    // Keep legacy fields in sync
    syncActiveZoneViews();
    CB.world.MEM_TOTAL = computeMemTotalAllZones();

    return CB.world.spawn;
  }

  /* =========================
     Expose API
     ========================= */

  CB.world = CB.world || {};
  CB.world.T = T;
  CB.world.zones = zones;

  CB.world.setZone = setActiveZone;
  CB.world.tileAt = tileAt;
  CB.world.isWalkableTile = isWalkableTile;
  CB.world.checkTransitionAtTile = checkTransitionAtTile;

  // Legacy APIs expected by your current boot/render:
  CB.world.isDecoSolidAt = isDecoSolidAt;
  CB.world.interactableNearTile = interactableNearTile;

  // Zone label used by HUD (boot.js calls computeZone(playerX, playerY))
  CB.world.computeZone = () => CB.world.zoneName || "hub";

  // Initialize active zone
  setActiveZone("hub", "start");

  CB.world.VERSION = "world-cross-v1-compat";
})();
