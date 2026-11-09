// Sprites pixel-art de Spaced Bambutition: heroe por niveles y monstruos diarios.
// Cada sprite se define con media fila (izquierda) y se refleja para hacerlo simetrico.
(function () {
  const OUTLINE = "#172126";

  function mirror(rows) {
    return rows.map((half) => half + half.split("").reverse().join(""));
  }

  // --- Heroe (20 x 21) ---
  const heroBody = mirror([
    "..........",
    "..........",
    "......kkkk",
    ".....khhhh",
    ".....khhhh",
    ".....khsss",
    ".....ksess",
    ".....ksess",
    ".....kssss",
    "......kssd",
    "...kkkkkss",
    "...kakuuuu",
    "...kakuuuu",
    "...kakuuuu",
    "...kakbbbb",
    "...ksklllll".slice(0, 10),
    ".....kllll",
    "......kggk",
    "......kggk",
    ".....kfffk",
    ".....kkkkk",
  ]);

  const heroCape = (() => {
    const rows = Array.from({ length: 21 }, () => ".".repeat(20));
    return rows.map((row, y) => (y >= 11 && y <= 19 ? ".cc" + ".".repeat(14) + "cc." : row));
  })();

  const heroCrown = [
    ".......Y.YY.Y.......",
    ".......YYYYYY.......",
  ];

  function overlay(points) {
    const rows = Array.from({ length: 21 }, () => Array(20).fill("."));
    points.forEach(([x, y, c]) => {
      if (rows[y] && x >= 0 && x < 20) rows[y][x] = c;
    });
    return rows.map((row) => row.join(""));
  }

  function column(x, from, to, c) {
    const points = [];
    for (let y = from; y <= to; y += 1) points.push([x, y, c]);
    return points;
  }

  const weapons = {
    stick: overlay([...column(2, 5, 18, "W"), [2, 5, "k"]]),
    dagger: overlay([[2, 10, "L"], ...column(2, 11, 13, "M"), [1, 14, "G"], [2, 14, "G"], [3, 14, "G"], ...column(2, 15, 16, "W")]),
    shortsword: overlay([[2, 7, "L"], ...column(2, 8, 13, "M"), ...column(1, 9, 13, "L"), [0, 14, "G"], [1, 14, "G"], [2, 14, "G"], [3, 14, "G"], ...column(2, 15, 17, "W")]),
    sword: overlay([[2, 3, "L"], ...column(2, 4, 13, "M"), ...column(1, 5, 13, "L"), [0, 14, "G"], [1, 14, "G"], [2, 14, "G"], [3, 14, "G"], ...column(2, 15, 17, "W")]),
    glowsword: overlay([[2, 2, "Z"], ...column(2, 3, 13, "Y"), ...column(1, 4, 13, "Z"), [0, 14, "G"], [1, 14, "G"], [2, 14, "G"], [3, 14, "G"], ...column(2, 15, 17, "W"), [0, 3, "Z"], [3, 6, "Z"], [0, 9, "Z"]]),
  };

  const shield = overlay([
    [16, 11, "k"], [17, 11, "k"], [18, 11, "k"],
    [15, 12, "k"], [16, 12, "w"], [17, 12, "w"], [18, 12, "w"], [19, 12, "k"],
    [15, 13, "k"], [16, 13, "w"], [17, 13, "B"], [18, 13, "w"], [19, 13, "k"],
    [15, 14, "k"], [16, 14, "w"], [17, 14, "w"], [18, 14, "w"], [19, 14, "k"],
    [15, 15, "k"], [16, 15, "w"], [17, 15, "w"], [18, 15, "w"], [19, 15, "k"],
    [16, 16, "k"], [17, 16, "k"], [18, 16, "k"],
  ]);

  const skin = "#f2c29b";
  const baseHero = { k: OUTLINE, h: "#4a2e1f", s: skin, e: OUTLINE, d: "#b5654d", u: skin, a: skin, b: "#8a5a2b", l: "#8a5a2b", g: skin, f: skin };
  const wood = { W: "#8a5a2b" };
  const steel = { L: "#eef3f6", M: "#b8c4cc", G: "#8a5a2b", W: "#5a3a1e" };

  const heroTiers = [
    { name: "Aprendiz en taparrabos", palette: {}, weapon: null },
    { name: "Aprendiz con palo", palette: {}, weapon: "stick", weaponPalette: wood },
    { name: "Aprendiz con daga", palette: {}, weapon: "dagger", weaponPalette: steel },
    { name: "Viajero con daga", palette: { u: "#3f8f5e", b: "#5a3a1e", l: "#6b4a2b", g: "#6b4a2b", f: "#4a3220" }, weapon: "dagger", weaponPalette: steel },
    { name: "Viajero con espada corta", palette: { u: "#3f8f5e", b: "#5a3a1e", l: "#6b4a2b", g: "#6b4a2b", f: "#4a3220" }, weapon: "shortsword", weaponPalette: steel },
    { name: "Explorador de cuero", palette: { u: "#9a6232", a: "#b07a45", b: "#3b2717", l: "#5a3d24", g: "#5a3d24", f: "#3b2717" }, weapon: "sword", weaponPalette: steel, shield: { w: "#a0703f", B: "#d9b56a", k: OUTLINE } },
    { name: "Guerrero de malla", palette: { u: "#9aa7b0", a: "#9aa7b0", b: "#5a3d24", l: "#5c6670", g: "#5c6670", f: "#3b4148" }, weapon: "sword", weaponPalette: steel, shield: { w: "#8795a0", B: "#eef3f6", k: OUTLINE } },
    { name: "Caballero con capa", palette: { u: "#d5dee4", a: "#c4ced5", b: "#8795a0", l: "#8795a0", g: "#8795a0", f: "#4d5761", c: "#c8402f" }, weapon: "sword", weaponPalette: steel, shield: { w: "#c8402f", B: "#f4bf4f", k: OUTLINE }, cape: true },
    { name: "Paladín dorado", palette: { u: "#f4c95d", a: "#e8b84a", b: "#9c6f1c", l: "#b8862b", g: "#b8862b", f: "#6b4a12", c: "#6d3fb3" }, weapon: "sword", weaponPalette: { ...steel, G: "#f4bf4f" }, shield: { w: "#f4c95d", B: "#6d3fb3", k: OUTLINE }, cape: true },
    { name: "Leyenda del temario", palette: { u: "#f4c95d", a: "#e8b84a", b: "#09A5BC", l: "#b8862b", g: "#b8862b", f: "#6b4a12", c: "#09A5BC" }, weapon: "glowsword", weaponPalette: { Y: "#fff3b0", Z: "#7fe3f0", G: "#f4bf4f", W: "#5a3a1e" }, shield: { w: "#f4c95d", B: "#09A5BC", k: OUTLINE }, cape: true, crown: true },
  ];

  function heroLayers(tierIndex) {
    const tier = heroTiers[Math.max(0, Math.min(heroTiers.length - 1, tierIndex))];
    const palette = { ...baseHero, ...tier.palette, Y: "#f4bf4f" };
    const layers = [];
    if (tier.cape) layers.push({ rows: heroCape, palette });
    layers.push({ rows: heroBody, palette });
    if (tier.shield) layers.push({ rows: shield, palette: tier.shield });
    if (tier.weapon) layers.push({ rows: weapons[tier.weapon], palette: { k: OUTLINE, ...tier.weaponPalette } });
    if (tier.crown) layers.push({ rows: heroCrown, palette: { Y: "#f4bf4f" } });
    return layers;
  }

  // --- Monstruos (20 de ancho) ---
  const monsters = [
    {
      id: "slime",
      name: "Slime",
      rows: mirror([
        "..........", ".......kkk", ".....kkggg", "....kggggg", "...kgwgggg", "..kggggggg", "..kgggeegg",
        "..kgggeegg", ".kgggggggg", ".kggggggmm", ".kGggggggg", ".kGGgggggg", "..kGGGGGGG", "...kkkkkkk",
      ]),
      variants: [
        { label: "de la Pereza", palette: { g: "#7ad37a", G: "#4fa65a", w: "#e8ffe8", e: OUTLINE, m: OUTLINE } },
        { label: "del Despiste", palette: { g: "#6ec4f0", G: "#3f8fc2", w: "#e6f7ff", e: OUTLINE, m: OUTLINE } },
        { label: "de la Duda", palette: { g: "#c39bef", G: "#8d63c4", w: "#f6eeff", e: OUTLINE, m: OUTLINE } },
      ],
    },
    {
      id: "bat",
      name: "Murciélago",
      rows: mirror([
        "..........", "........k.", "kk.....kbk", "kbk....kbb", "kbbk..kbbb", "kbbbkkbbbb",
        "kbbbbbbrbb", "kbkbbkbbbb", "k.k.kbbbtb", ".....kbbbb", "......kkkk",
      ]),
      variants: [
        { label: "Insomne", palette: { b: "#6b4c9a", r: "#f4bf4f", t: "#ffffff" } },
        { label: "de la Distracción", palette: { b: "#4b5563", r: "#e0533b", t: "#ffffff" } },
        { label: "Nocturno", palette: { b: "#2f3e63", r: "#7fe3f0", t: "#ffffff" } },
      ],
    },
    {
      id: "goblin",
      name: "Goblin",
      rows: mirror([
        "..........", "......kkkk", ".....kgggg", "kk..kggggg", "kgkkgggggg", ".kggggyegg", "..kkgggggg",
        "....kgmtmt", ".....kgggg", "....kccccc", "...kgkcccc", "...kgkcccc", "....kkcccc", ".....kggk.", "....kkkkk.",
      ]),
      variants: [
        { label: "del Temario", palette: { g: "#7fb04a", y: "#f4bf4f", e: OUTLINE, m: "#3b1f1f", t: "#ffffff", c: "#8a5a2b" } },
        { label: "Procrastinador", palette: { g: "#a3a84a", y: "#ffffff", e: "#e0533b", m: "#3b1f1f", t: "#ffffff", c: "#5c6670" } },
        { label: "de los Plazos", palette: { g: "#c2674a", y: "#f4bf4f", e: OUTLINE, m: "#3b1f1f", t: "#ffffff", c: "#3f5f8f" } },
      ],
    },
    {
      id: "skeleton",
      name: "Esqueleto",
      rows: mirror([
        "..........", "......kkkk", ".....kwwww", "....kwwwww", "....kweeww", "....kweeww", "....kwwwwe",
        ".....kwkwk", "......kkkk", "...kwkwwww", "...kwk.kkw", "...kwkwwww", "...kwk.kkw", "......kwww",
        "......kwk.", "......kwk.", ".....kwwk.", ".....kkkk.",
      ]),
      variants: [
        { label: "del Olvido", palette: { w: "#f1efe6", e: OUTLINE } },
        { label: "Rencoroso", palette: { w: "#e8dcb5", e: "#e0533b" } },
        { label: "Espectral", palette: { w: "#cfeef3", e: "#09A5BC" } },
      ],
    },
    {
      id: "orc",
      name: "Orco",
      rows: mirror([
        "..........", "k....kkkkk", "kwk.kmmmmm", ".kwkkmmmmm", "...koooooo", "...kooreoo", "...koooooo",
        "...kootkkk", "....kooooo", "..kkkaaaaa", ".kookaaaaa", ".kookaaaaa", ".kookaaaaa", ".kkkkbbbbb",
        "....kook..", "....kook..", "...kkkkk..",
      ]),
      variants: [
        { label: "del Bloqueo", palette: { m: "#6b7280", w: "#f1efe6", o: "#6f9b5a", r: "#e0533b", e: OUTLINE, t: "#ffffff", a: "#7a4f2a", b: "#3b2717" } },
        { label: "Rompeplanes", palette: { m: "#3f4a5a", w: "#f1efe6", o: "#8d8f5a", r: "#f4bf4f", e: OUTLINE, t: "#ffffff", a: "#5c6670", b: "#2b2f36" } },
        { label: "Ceniza", palette: { m: "#8a3a2a", w: "#f1efe6", o: "#9b8b7a", r: "#e0533b", e: OUTLINE, t: "#ffffff", a: "#4b3a5a", b: "#2b1f36" } },
      ],
    },
    {
      id: "dragon",
      name: "Dragón",
      rows: mirror([
        "........k.", ".......kwk", "k.....krrr", "kk...krrrr", "krk..kryer", "krrk.krrrr", "krrrkkrrrr",
        "krrrrkrrnr", "krrrkrkkkk", "krrkrrbbbb", "krk.krbbbb", "kk..krbbbb", "k...krbbbb", ".....krbbb",
        ".....krkrr", "....kwkk..", "....kkk...",
      ]),
      variants: [
        { label: "del Examen", palette: { r: "#d0453a", w: "#f1efe6", y: "#f4bf4f", e: OUTLINE, n: OUTLINE, b: "#f1b26b" } },
        { label: "Esmeralda", palette: { r: "#2f8f5e", w: "#f1efe6", y: "#f4bf4f", e: OUTLINE, n: OUTLINE, b: "#b9df7a" } },
        { label: "del Caos", palette: { r: "#3b2f5c", w: "#f1efe6", y: "#e0533b", e: OUTLINE, n: OUTLINE, b: "#8d63c4" } },
      ],
    },
  ];

  function svgFromLayers(layers, label, className = "sprite") {
    const height = Math.max(...layers.map((layer) => layer.rows.length));
    const width = Math.max(...layers.map((layer) => Math.max(...layer.rows.map((row) => row.length))));
    let rects = "";
    layers.forEach(({ rows, palette }) => {
      rows.forEach((row, y) => {
        for (let x = 0; x < row.length; x += 1) {
          const char = row[x];
          if (char === ".") continue;
          const fill = palette[char] || (char === "k" ? OUTLINE : null);
          if (!fill) continue;
          rects += `<rect x="${x}" y="${y}" width="1.02" height="1.02" fill="${fill}"/>`;
        }
      });
    });
    return `<svg class="${className}" viewBox="0 0 ${width} ${height}" role="img" aria-label="${label}" shape-rendering="crispEdges" xmlns="http://www.w3.org/2000/svg">${rects}</svg>`;
  }

  window.BambuSprites = {
    heroTiers,
    heroSVG(tierIndex) {
      const tier = heroTiers[Math.max(0, Math.min(heroTiers.length - 1, tierIndex))];
      return svgFromLayers(heroLayers(tierIndex), tier.name, "sprite hero-sprite");
    },
    monsters,
    monsterSVG(monsterIndex, variantIndex) {
      const monster = monsters[monsterIndex];
      const variant = monster.variants[variantIndex % monster.variants.length];
      return svgFromLayers([{ rows: monster.rows, palette: { k: OUTLINE, ...variant.palette } }], `${monster.name} ${variant.label}`, "sprite monster-sprite");
    },
  };
})();
