/* BioVoley Lab — Química de la bebida deportiva
   Composición de ingredientes, masas molares y cálculo estequiométrico:
   moles, concentraciones, osmolaridad, hidrólisis de la sacarosa y oxidación de la glucosa.
   Metas: ACSM (2007) — carbohidratos 5–10%, sodio 20–30 mmol/L, potasio 2–5 mmol/L;
   Thomas, Erdman y Burke (2016) — 30–60 g de carbohidratos por hora en esfuerzos de más de 1 h. */
(function (BV) {
  'use strict';
  // masas molares (g/mol)
  const M = { sac: 342.30, glu: 180.16, fru: 180.16, mal: 1200, cit: 192.12, nacl: 58.44, kcl: 74.55, Na: 22.99, K: 39.10, Cl: 35.45, Mg: 24.31, Ca: 40.08, H2O: 18.015, CO2: 44.01, O2: 32.00, unidadGlucosa: 162.14 };
  const DH_GLU = 2803; // kJ liberados por mol de glucosa oxidada (C6H12O6 + 6 O2 → 6 CO2 + 6 H2O)
  const R = 0.08206, T_CUERPO = 310.15; // L·atm/(mol·K), 37 °C

  /* composición por "per" unidades: solutos en gramos, minerales naturales en mg */
  const ING = {
    azucar: { name: 'White sugar (sucrose)', unit: 'g', per: 1, comp: { sac: 1 }, med: [['cucharada', 12.5], ['cucharadita', 4]] },
    panela: { name: 'Grated panela (raw cane sugar)', unit: 'g', per: 100, comp: { sac: 80, glu: 4, fru: 4, k: 400, ca: 80, mg: 70, na: 30 }, med: [['cucharada', 12]], nota: 'Approximate composition: varies by mill. Provides potassium, calcium and magnesium.' },
    miel: { name: 'Honey', unit: 'g', per: 100, comp: { fru: 38, glu: 31, sac: 1, k: 52, na: 4 }, med: [['cucharada', 21]] },
    glucosa: { name: 'Glucose (dextrose) powder', unit: 'g', per: 1, comp: { glu: 1 }, med: [['cucharada', 10]] },
    malto: { name: 'Maltodextrin', unit: 'g', per: 1, comp: { mal: 1 }, med: [['cucharada', 8]], nota: 'Glucose chains: energy with almost no rise in osmolarity.' },
    sal: { name: 'Table salt (NaCl)', unit: 'g', per: 1, comp: { nacl: 1 }, med: [['cucharadita', 6], ['pizca', 0.4]] },
    kcl: { name: 'Potassium chloride (diet salt)', unit: 'g', per: 1, comp: { kcl: 1 }, med: [['cucharadita', 5], ['pizca', 0.4]], nota: 'Do not use with a kidney condition without medical advice.' },
    limon: { name: 'Lemon juice', unit: 'mL', per: 100, comp: { cit: 5, glu: 1, fru: 1, k: 100 }, med: [['lemon', 30]] },
    naranja: { name: 'Fresh orange juice', unit: 'mL', per: 100, comp: { sac: 4.2, glu: 2.0, fru: 2.2, cit: 0.9, k: 200, na: 1 }, med: [['vaso', 250], ['naranja', 80]], nota: 'Provides vitamin C, which helps absorb iron.' },
    coco: { name: 'Coconut water', unit: 'mL', per: 100, comp: { glu: 1.3, fru: 1.3, k: 250, na: 105, mg: 25, ca: 24 }, med: [['vaso', 250]], nota: 'Natural and rich in potassium, but low in carbohydrates.' },
    gaseosa: { name: 'Soda (for comparison only)', unit: 'mL', per: 100, comp: { fru: 5.6, glu: 5.0, na: 4 }, med: [['lata', 355]], nota: 'Not recommended: hypertonic, fizzy and acidic.' },
  };

  const PRESETS = {
    casera: { name: 'Homemade: sugar, salt and lemon', water: 1000, items: [{ id: 'azucar', q: 60 }, { id: 'sal', q: 1.3 }, { id: 'limon', q: 30 }] },
    panela: { name: 'Panela water with lemon and salt', water: 1000, items: [{ id: 'panela', q: 70 }, { id: 'limon', q: 40 }, { id: 'sal', q: 1.2 }] },
    coco: { name: 'Coconut water with panela', water: 700, items: [{ id: 'coco', q: 300 }, { id: 'panela', q: 55 }, { id: 'sal', q: 0.8 }] },
    naranja: { name: 'Diluted orange juice with salt', water: 600, items: [{ id: 'naranja', q: 400 }, { id: 'azucar', q: 20 }, { id: 'sal', q: 1.2 }] },
    agua: { name: 'Water only', water: 1000, items: [] },
    gaseosa: { name: 'Soda (comparison)', water: 0, items: [{ id: 'gaseosa', q: 1000 }] },
  };

  /** equivalencia casera de una cantidad (ej.: 60 g de azúcar ≈ 4,8 cucharadas) */
  function casera(id, q) {
    const ing = ING[id];
    if (!ing || !ing.med || !q) return '';
    const [n, per] = ing.med.find(([, v]) => q / v >= 0.2) || ing.med[ing.med.length - 1];
    const k = q / per;
    if (k < 0.9) { // fracciones de la medida casera
      const F = [[0.25, '¼'], [1 / 3, '⅓'], [0.5, '½'], [2 / 3, '⅔'], [0.75, '¾']];
      const [, f] = F.reduce((a, b) => (Math.abs(b[0] - k) < Math.abs(a[0] - k) ? b : a));
      return `≈ ${f} of ${n}`;
    }
    const plural = k > 1.05 ? (n.endsWith('n') ? n.replace(/ón$/, 'ones') : n + 's') : n;
    return `≈ ${BV.fmt(k, Math.abs(k - Math.round(k)) < 0.1 || k >= 3 ? 0 : 1)} ${plural}`;
  }

  /** Cálculo completo de una receta { water, items: [{id, q}] } */
  function compute(recipe) {
    const t = { sac: 0, glu: 0, fru: 0, mal: 0, cit: 0, nacl: 0, kcl: 0, na: 0, k: 0, mg: 0, ca: 0 };
    let V = recipe.water || 0; // mL
    (recipe.items || []).forEach(({ id, q }) => {
      const ing = ING[id];
      if (!ing || !(q > 0)) return;
      if (ing.unit === 'mL') V += q;
      Object.entries(ing.comp).forEach(([k, v]) => { t[k] += (v * q) / ing.per; });
    });
    const VL = V / 1000;
    const r = { V, VL, t };
    if (!(VL > 0)) return r;
    // moles de cada soluto
    const n = {
      sac: t.sac / M.sac, glu: t.glu / M.glu, fru: t.fru / M.fru, mal: t.mal / M.mal, cit: t.cit / M.cit,
      nacl: t.nacl / M.nacl, kcl: t.kcl / M.kcl,
    };
    r.n = n;
    r.cho = t.sac + t.glu + t.fru + t.mal;                    // g de carbohidratos
    r.choPct = (r.cho / V) * 100;                             // g por 100 mL (% m/v)
    r.naMg = t.na + n.nacl * M.Na * 1000;                     // mg de sodio
    r.kMg = t.k + n.kcl * M.K * 1000;
    r.clMg = (n.nacl + n.kcl) * M.Cl * 1000;
    r.naMmolL = r.naMg / M.Na / VL;
    r.kMmolL = r.kMg / M.K / VL;
    r.naMgL = r.naMg / VL;
    // osmolaridad: cada partícula disuelta cuenta (NaCl → Na⁺ + Cl⁻ = 2 partículas)
    const osmNat = (t.na / M.Na + t.k / M.K) * 2 + (t.mg / M.Mg + t.ca / M.Ca) * 3; // mmol, con sus aniones acompañantes (estimado)
    r.osmParts = {
      azucares: (n.sac + n.glu + n.fru + n.mal) * 1000,
      acido: n.cit * 1000,
      sales: (n.nacl + n.kcl) * 2 * 1000,
      minerales: osmNat,
    };
    r.osm = (r.osmParts.azucares + r.osmParts.acido + r.osmParts.sales + r.osmParts.minerales) / VL;
    r.tipo = r.osm < 270 ? 'Hypotonic' : r.osm <= 330 ? 'Isotonic' : 'Hypertonic';
    // digestión y metabolismo
    r.nHex = 2 * n.sac + n.glu + n.fru + t.mal / M.unidadGlucosa; // mol de monosacáridos absorbibles
    r.kJ = r.nHex * DH_GLU;
    r.kcal = r.kJ / 4.184;
    r.o2Mol = 6 * r.nHex;
    r.o2L = (r.o2Mol * R * T_CUERPO) / 1;                     // PV = nRT a 1 atm y 37 °C
    r.co2Mol = 6 * r.nHex;
    r.co2g = r.co2Mol * M.CO2;
    r.h2oMet = 6 * r.nHex * M.H2O;                            // agua producida por el metabolismo
    // evaluación frente a las metas
    const ev = {};
    ev.cho = r.cho === 0 ? ['na', 'No carbohydrates: enough for sessions under 60 min']
      : r.choPct >= 5 && r.choPct <= 8 ? ['ok', 'Ideal carbohydrate concentration (5–8%)']
      : r.choPct < 5 ? ['warn', 'Low energy: raise to 5–8%'] : r.choPct <= 10 ? ['warn', 'Somewhat concentrated: lower to 5–8%'] : ['crit', 'Very concentrated: absorbed slowly'];
    ev.na = r.cho === 0 && r.naMg === 0 ? ['na', 'Water only: no electrolytes']
      : r.naMmolL >= 20 && r.naMmolL <= 30 ? ['ok', 'Ideal sodium (20–30 mmol/L)']
      : r.naMmolL < 10 ? ['crit', 'Almost no sodium'] : r.naMmolL < 20 ? ['warn', 'Low sodium'] : r.naMmolL <= 50 ? ['warn', 'High sodium: salty taste'] : ['crit', 'Too salty'];
    ev.k = r.kMmolL >= 2 && r.kMmolL <= 5 ? ['ok', 'Potassium like a sports drink (2–5 mmol/L)']
      : r.kMmolL < 2 ? ['warn', 'Low potassium: replaced with food'] : ['na', 'More potassium than a sports drink (normal in natural juices)'];
    ev.osm = r.osm <= 330 ? ['ok', `${r.tipo}: absorbed quickly`] : r.osm <= 400 ? ['warn', 'Hypertonic: leaves the stomach more slowly'] : ['crit', 'Very hypertonic: may cause discomfort and dehydrate the gut'];
    r.ev = ev;
    return r;
  }

  BV.bebida = { M, ING, PRESETS, compute, casera, DH_GLU, R, T_CUERPO };
})(window.BV);
