/* cyberbara.world.js
   Cyberbara (streetlight lo-fi) — World Data
   Version: Detail Update
*/

(() => {
  "use strict";

  const CB = (window.Cyberbara = window.Cyberbara || {});
  if (!CB.util) return;

  const TILE = 16;
  const SCALE = 3;
  const TS = TILE * SCALE;

  const MAP_W = 48;
  const MAP_H = 28;

  const WORLD_W = MAP_W * TS;
  const WORLD_H = MAP_H * TS;

  CB.world = CB.world || {};
  CB.world.constants = { TILE, SCALE, TS, MAP_W, MAP_H, WORLD_W, WORLD_H };

  /* =========================
     Map Data
     Legend:
     0 = Floor (Concrete)
     1 = Wall (Building)
     2 = Street (Path)
     3 = Puddle/Water
     4 = Wall + Neon (New!)
     5 = Fence (New!)
     ========================= */

  const map = (() => {
    const rows = [
      "111111111111111111111111111111111111111111111111",
      "100000110000000000111111100000000000001110000001",
      "100000110000000000111111100000000000001110000001",
      "144100110000000000111111100000022200001110000001",
      "100000550000000000444444400000222220005550000001",
      "100000000000000000000000000000222220000000000001",
      "100000000000000000000000000000222220000000000001",
      "111410000000000000000000000000022200000000001111",
      "111110000222222222222222222222222222222000001111",
      "100000000222222222222222222222222222222000000001",
      "100000000220000000000000000000000000222000000001",
      "100000000220000000000000000000000000222000000001",
      "111110000220000000000000000000000000222000444441",
      "111110000220000111111100001111111000222000000001",
      "144410000220000111111100001111111000222000000001",
      "100000000220000111000000000000111000222000000001",
      "100000000220000111000000000000111000222000000001",
      "100000000220000555000000000000555000222000000001",
      "111111555220000000000033330000000000222000000001",
      "100000000220000000000033330000000000222222222001",
      "100000000222222000000033330000000000000000000001",
      "100000000000002000000000000000000000000000000001",
      "100000000000002000000000000000000000000000000001",
      "144111110000002222222222222222222200000011444441",
      "111111110000000000000000000000000000000011111111",
      "100000000000000000000000000000000000000000000001",
      "100000000000000000000000000000000000000000000001",
      "111111111111111111111111111111111111111111111111",
    ];

    const tiles = new Array(MAP_W * MAP_H).fill(0);

    for (let y = 0; y < MAP_H; y++) {
      const row = rows[y];
      for (let x = 0; x < MAP_W; x++) {
        const c = row[x];
        tiles[y * MAP_W + x] = 
          (c === "1") ? 1 : // Wall
          (c === "2") ? 2 : // Street
          (c === "3") ? 3 : // Puddle
          (c === "4") ? 4 : // Neon Wall
          (c === "5") ? 5 : // Fence
          0; // Floor
      }
    }
    return tiles;
  })();

  // Updated to include 4 and 5 in wall/solid logic if needed
  function tileAt(tx, ty) {
    if (tx < 0 || ty < 0 || tx >= MAP_W || ty >= MAP_H) return 1;
    return map[ty * MAP_W + tx] | 0;
  }

  // 0, 2, 3 are walkable. 1 (wall), 4 (neon wall), 5 (fence) are solid.
  function isWalkableTile(id) {
    return id === 0 || id === 2 || id === 3;
  }

  CB.world.map = map;
  CB.world.tileAt = tileAt;
  CB.world.isWalkableTile = isWalkableTile;

  // We rely less on the 'deco' array now that the map has detail, 
  // but we keep it for specific props that aren't tiles.
  CB.world.deco = []; 
  CB.world.isDecoSolidAt = () => false;

  /* =========================
     Interactables (Relocated to fit new map)
     ========================= */

  const interactables = [
    {
      id: "streetlight",
      tx: 10, ty: 8, // Moved to main street intersection
      name: "streetlight",
      pages: [
        "the streetlight hums.\nits neon is tired, but it keeps trying.",
        "you notice a tiny sticker:\n\"stay soft. stay sharp.\"",
      ],
      memory: { id: "m_sticker", title: "sticker", text: "stay soft. stay sharp." },
      repeat: ["it flickers.\nit knows you're here."],
    },
    {
      id: "puddle",
      tx: 24, ty: 20, // Moved to the "courtyard" area
      name: "puddle",
      pages: [
        "a puddle holds the city upside down.\nfor a second, everything looks simpler.",
      ],
      memory: { id: "m_reflection", title: "reflection", text: "the city upside down." },
      repeat: ["a ripple.\nmaybe it was your breath."],
    },
    {
      id: "neon_sign",
      tx: 20, ty: 4, // Near the upper building
      name: "neon sign",
      pages: ["the sign reads: \"OPEN\".\nbut the door behind it is gone."],
      memory: { id: "m_open", title: "open", text: "an OPEN sign for a ghost shop." },
      repeat: ["OPEN.\nOPEN.\nOPEN."],
    },
    {
      id: "payphone",
      tx: 34, ty: 12, // In the nook on the right
      name: "payphone",
      pages: ["a payphone with no receiver.\njust a dangling wire."],
      memory: { id: "m_call", title: "wire", text: "a disconnected line." },
      repeat: ["silence."],
    },
    {
      id: "vending",
      tx: 4, ty: 4, // Near start
      name: "vending machine",
      pages: ["it sells 'silence' for $0.00."],
      memory: { id: "m_silence", title: "silence", text: "you bought silence." },
      repeat: ["sold out."],
    },
    {
      id: "bench",
      tx: 22, ty: 23, // In the southern park area
      name: "bench",
      pages: ["a bench under no tree.\nwarm from a ghost."],
      memory: { id: "m_ghost", title: "warmth", text: "someone was just here." },
      repeat: ["empty."],
    },
    {
      id: "graffiti",
      tx: 42, ty: 12, // Far right wall
      name: "graffiti",
      pages: ["scrawled in white:\n\"where the light forgets\""],
      memory: { id: "m_graffiti", title: "graffiti", text: "where the light forgets." },
      repeat: ["the paint looks wet."],
    },
    {
      id: "dumpster",
      tx: 7, ty: 14, // Alleyway
      name: "dumpster",
      pages: ["locked tight."],
      memory: { id: "m_locked", title: "locked", text: "secrets kept." },
      repeat: ["won't budge."],
    }
  ];

  const MEM_TOTAL = interactables.filter(o => o.memory).length;

  function interactableNearTile(tx, ty) {
    for (const o of interactables) {
      const dx = Math.abs(o.tx - tx);
      const dy = Math.abs(o.ty - ty);
      if (dx + dy <= 1) return o;
    }
    return null;
  }

  CB.world.interactables = interactables;
  CB.world.MEM_TOTAL = MEM_TOTAL;
  CB.world.interactableNearTile = interactableNearTile;

  CB.world.computeZone = (px, py) => "city"; // Simplified for now
  CB.world.VERSION = "world-detail-v1";
})();