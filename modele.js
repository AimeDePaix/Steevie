/* ============================================================================
   modele.js — le cerveau statistique de Steevie
   ============================================================================

   ⚠️ DEUX EXEMPLAIRES IDENTIQUES :
      1. modele.js  — repo GitHub, pour les cotes en direct
      2. Modele.gs  — Apps Script, pour recalculer à l'enregistrement
      Quand tu modifies l'un, remplace l'autre par un copier-coller intégral.

   Huit questions, une loi par question. Deux conditionnements seulement :
   le poids, la taille et la lettre dépendent du sexe ; l'ascendant dépend
   du créneau horaire, parce que c'est de l'astronomie et non de la
   statistique.
   ============================================================================ */

var STV_SIGNES = ['Bélier', 'Taureau', 'Gémeaux', 'Cancer', 'Lion', 'Vierge',
  'Balance', 'Scorpion', 'Sagittaire', 'Capricorne', 'Verseau', 'Poissons'];

var STV_CRENEAUX = [
  { cle: '0h-4h',   debut: 0,  fin: 4,  poids: 19, couleur: '#1B2A4A', nuit: true },
  { cle: '4h-8h',   debut: 4,  fin: 8,  poids: 20, couleur: '#456092', nuit: true },
  { cle: '8h-12h',  debut: 8,  fin: 12, poids: 17, couleur: '#EFC65C', nuit: false },
  { cle: '12h-16h', debut: 12, fin: 16, poids: 15, couleur: '#F2D98A', nuit: false },
  { cle: '16h-20h', debut: 16, fin: 20, poids: 14, couleur: '#C97B37', nuit: false },
  { cle: '20h-0h',  debut: 20, fin: 24, poids: 15, couleur: '#243761', nuit: true }
];

/* PROVISOIRE — à remplacer par le fichier des prénoms de l'INSEE. */
var STV_LETTRES = {
  G: { A:13, B:2, C:4, D:2, E:5, F:1, G:6, H:2, I:2, J:5, K:1, L:14, M:10,
       N:7, O:2, P:2, Q:0.2, R:7, S:4, T:6, U:0.2, V:1, W:0.3, X:0.3, Y:1, Z:1 },
  F: { A:13, B:2, C:6, D:2, E:8, F:1, G:1, H:2, I:4, J:6, K:1, L:13, M:9,
       N:3, O:2, P:1, Q:0.2, R:4, S:5, T:2, U:0.2, V:2, W:0.2, X:0.2, Y:1, Z:2 }
};

var STV_COUPE = [
  { cle: 'chauve',   libelle: 'Trois poils sur le caillou',
    detail: 'comme papa dans quelques années' },
  { cle: 'duvet',    libelle: 'Un joli duvet',
    detail: 'de quoi caresser, pas de quoi coiffer' },
  { cle: 'crinière', libelle: 'Une vraie tignasse',
    detail: 'le coiffeur avant la maternité' }
];

/* La patate : l'option pour rire. Cote absurde, et elle bloque tout le
   reste du formulaire puisqu'on mise alors ses cent jetons dessus. */
var STV_COTE_PATATE = 10000;

var STV_CARACTERES = {
  'Bélier': 'fonce d\'abord, réfléchit ensuite',
  'Taureau': 'obstiné, gourmand, difficile à faire bouger',
  'Gémeaux': 'deux idées à la seconde, aucune terminée',
  'Cancer': 'tendre à l\'intérieur, carapace à l\'extérieur',
  'Lion': 'né pour être regardé, et il le sait',
  'Vierge': 'range les jouets par ordre de taille',
  'Balance': 'ne choisira jamais le restaurant',
  'Scorpion': 'intense en tout, y compris dans les siestes',
  'Sagittaire': 'partira loin, dès qu\'il saura marcher',
  'Capricorne': 'sérieux comme un pape à trois ans',
  'Verseau': 'fera l\'inverse de ce qu\'on attend',
  'Poissons': 'la tête dans les nuages, et c\'est très bien'
};


/* ============================================================================
   Boîte à outils
   ============================================================================ */

function stvNorm(x) { return ((x % 360) + 360) % 360; }

function stvBorne(v, max) { return Math.max(-max, Math.min(max, v)); }

/* Fonction d'erreur, approximation Abramowitz & Stegun 7.1.26 */
function stvErf(x) {
  var s = x < 0 ? -1 : 1;
  x = Math.abs(x);
  var t = 1 / (1 + 0.3275911 * x);
  var y = 1 - ((((1.061405429 * t - 1.453152027) * t + 1.421413741) * t
            - 0.284496736) * t + 0.254829592) * t * Math.exp(-x * x);
  return s * y;
}

function stvCdf(x, mu, sd) { return 0.5 * (1 + stvErf((x - mu) / (sd * Math.SQRT2))); }

function stvBande(a, b, mu, sd) { return stvCdf(b, mu, sd) - stvCdf(a, mu, sd); }

function stvNormalise(o) {
  var s = 0, k;
  for (k in o) s += o[k];
  var r = {};
  for (k in o) r[k] = s > 0 ? o[k] / s : 0;
  return r;
}

/* Cotes lisibles : entières au-dessus de 4, une décimale en dessous. La
   valeur arrondie est celle qui est enregistrée et qui paie, pour que
   l'affichage et le gain ne puissent jamais diverger. */
function stvCote(cfg, p) {
  var v = Math.min(cfg.cote_max, Math.max(1.1, 1 / Math.max(p, 1e-6)));
  return v < 4 ? Math.round(v * 10) / 10 : Math.round(v);
}

function stvFmtCote(v) {
  if (v === null || v === undefined) return '—';
  if (v >= 1000) return String(Math.round(v));
  return String(Math.round(v * 10) / 10).replace('.', ',');
}


/* ============================================================================
   Dates
   ============================================================================ */

function stvDateVersJour(cfg, iso) {
  if (!iso) return null;
  var a = new Date(iso + 'T12:00:00Z'), b = new Date(cfg.terme + 'T12:00:00Z');
  return Math.round((a - b) / 86400000);
}

function stvJourVersDate(cfg, jour) {
  var b = new Date(cfg.terme + 'T12:00:00Z');
  b.setUTCDate(b.getUTCDate() + jour);
  return b.toISOString().slice(0, 10);
}


/* ============================================================================
   Tranches
   ============================================================================ */

function stvKg(g) { return (g / 1000).toFixed(1).replace('.', ',') + ' kg'; }

function stvTranchesPoids(cfg) {
  var t = [{ cle: 'lt', libelle: 'moins de ' + stvKg(cfg.poids_bas), court: '< ' + stvKg(cfg.poids_bas) }];
  for (var g = cfg.poids_bas; g < cfg.poids_haut; g += cfg.poids_pas) {
    t.push({ cle: String(g), min: g, max: g + cfg.poids_pas,
             libelle: stvKg(g) + ' – ' + stvKg(g + cfg.poids_pas),
             court: stvKg(g).replace(' kg', '') });
  }
  t.push({ cle: 'gt', libelle: 'plus de ' + stvKg(cfg.poids_haut), court: '> ' + stvKg(cfg.poids_haut) });
  return t;
}

function stvTranchesTaille(cfg) {
  var t = [{ cle: 'lt', libelle: 'moins de ' + cfg.taille_bas + ' cm', valeur: cfg.taille_bas - 1.5 }];
  for (var c = cfg.taille_bas; c <= cfg.taille_haut; c++) {
    t.push({ cle: String(c), libelle: c + ' cm', valeur: c });
  }
  t.push({ cle: 'gt', libelle: 'plus de ' + cfg.taille_haut + ' cm', valeur: cfg.taille_haut + 1.5 });
  return t;
}


/* ============================================================================
   Les lois
   ============================================================================ */

function stvLoiSexe(cfg) {
  return { G: cfg.p_garcon, F: 1 - cfg.p_garcon };
}

/**
 * La date. Gaussienne ASYMÉTRIQUE autour du terme : l'étalement avant est
 * bien plus large que l'étalement après, parce qu'on peut accoucher trois
 * semaines en avance mais qu'au-delà de quelques jours de dépassement,
 * l'équipe médicale déclenche. Le mode est placé légèrement avant le terme.
 */
function stvLoiDate(cfg) {
  var p = {};
  for (var g = cfg.date_min; g <= cfg.date_max; g++) {
    var sd = (g <= cfg.date_mu) ? cfg.date_sd_avant : cfg.date_sd_apres;
    p[g] = stvBande(g - 0.5, g + 0.5, cfg.date_mu, sd);
  }
  return stvNormalise(p);
}

function stvLoiPoids(cfg, sexe) {
  var mu = cfg['poids_moyen_' + sexe] + stvBorne(cfg.ajust_poids, cfg.ajust_poids_max);
  var sd = cfg.poids_sd, p = {};
  p.lt = stvCdf(cfg.poids_bas, mu, sd);
  for (var g = cfg.poids_bas; g < cfg.poids_haut; g += cfg.poids_pas) {
    p[String(g)] = stvBande(g, g + cfg.poids_pas, mu, sd);
  }
  p.gt = 1 - stvCdf(cfg.poids_haut, mu, sd);
  return stvNormalise(p);
}

function stvLoiTaille(cfg, sexe) {
  var mu = cfg['taille_moyenne_' + sexe] + stvBorne(cfg.ajust_taille, cfg.ajust_taille_max);
  var sd = cfg.taille_sd, p = {};
  p.lt = stvCdf(cfg.taille_bas - 0.5, mu, sd);
  for (var c = cfg.taille_bas; c <= cfg.taille_haut; c++) {
    p[String(c)] = stvBande(c - 0.5, c + 0.5, mu, sd);
  }
  p.gt = 1 - stvCdf(cfg.taille_haut + 0.5, mu, sd);
  return stvNormalise(p);
}

function stvLoiLettre(cfg, sexe) {
  var src = STV_LETTRES[sexe] || STV_LETTRES.G, c = {};
  for (var k in src) c[k] = src[k];
  return stvNormalise(c);
}

function stvLoiHeure() {
  var p = {};
  for (var i = 0; i < STV_CRENEAUX.length; i++) p[STV_CRENEAUX[i].cle] = STV_CRENEAUX[i].poids;
  return stvNormalise(p);
}

/* Les deux parents avaient une tignasse à la naissance : la crinière est
   donc l'issue la plus probable, et celle qui paie le moins. */
function stvLoiCoupe(cfg) {
  return stvNormalise({
    chauve: cfg.coupe_chauve,
    duvet: cfg.coupe_duvet,
    'crinière': cfg.coupe_criniere
  });
}


/* ============================================================================
   Astronomie
   ============================================================================ */

function stvJourJulien(annee, mois, jour, heureUTC) {
  if (mois <= 2) { annee--; mois += 12; }
  var a = Math.floor(annee / 100), b = 2 - a + Math.floor(a / 4);
  return Math.floor(365.25 * (annee + 4716)) + Math.floor(30.6001 * (mois + 1))
       + jour + b - 1524.5 + heureUTC / 24;
}

function stvSigneSolaire(iso) {
  var p = iso.split('-');
  var jd = stvJourJulien(Number(p[0]), Number(p[1]), Number(p[2]), 12);
  var n = jd - 2451545.0;
  var L = stvNorm(280.460 + 0.9856474 * n);
  var g = stvNorm(357.528 + 0.9856003 * n) * Math.PI / 180;
  var lon = stvNorm(L + 1.915 * Math.sin(g) + 0.020 * Math.sin(2 * g));
  return STV_SIGNES[Math.floor(lon / 30)];
}

function stvAscendant(jd, lat, lonEst) {
  var DEG = Math.PI / 180;
  var n = jd - 2451545.0, T = n / 36525;
  var gmst = stvNorm(280.46061837 + 360.98564736629 * n
           + 0.000387933 * T * T - Math.pow(T, 3) / 38710000);
  var ramc = stvNorm(gmst + lonEst) * DEG;
  var eps = (23.439291 - 0.0130042 * T) * DEG;
  var lon = stvNorm(Math.atan2(
    Math.cos(ramc),
    -(Math.sin(ramc) * Math.cos(eps) + Math.tan(lat * DEG) * Math.sin(eps))
  ) / DEG);
  return STV_SIGNES[Math.floor(lon / 30)];
}

/* Calcule l'ascendant d'une personne. Décalage horaire approché : heure
   d'été d'avril à octobre, heure d'hiver le reste de l'année. */
function stvMonAscendant(iso, heure, minute, lat, lonEst) {
  var p = iso.split('-'), mois = Number(p[1]);
  var offset = (mois >= 4 && mois <= 10) ? 2 : 1;
  var jd = stvJourJulien(Number(p[0]), mois, Number(p[2]),
                         heure + minute / 60 - offset);
  return stvAscendant(jd, lat, lonEst);
}

/* À une date et un créneau donnés, seuls trois ou quatre signes peuvent se
   lever à l'horizon. Sans ce conditionnement, parier « 12h-16h » et
   « Bélier » paierait gros pour un événement en réalité très probable. */
function stvLoiAscendant(cfg, iso, creneauCle) {
  var cr = null;
  for (var i = 0; i < STV_CRENEAUX.length; i++) {
    if (STV_CRENEAUX[i].cle === creneauCle) cr = STV_CRENEAUX[i];
  }
  if (!cr) cr = { debut: 0, fin: 24 };

  var d = (iso || cfg.terme).split('-');
  var p = {};
  for (var h = cr.debut; h < cr.fin; h += 1 / 12) {
    var jd = stvJourJulien(Number(d[0]), Number(d[1]), Number(d[2]), h - cfg.utc_offset);
    var s = stvAscendant(jd, cfg.lat, cfg.lon);
    p[s] = (p[s] || 0) + 1;
  }
  return stvNormalise(p);
}


/* ============================================================================
   L'entrée principale
   ============================================================================ */

function stvCalculer(cfg, r) {
  r = r || {};
  var patate = (r.sexe === 'P');
  var sexe = (r.sexe === 'F' || r.sexe === 'G') ? r.sexe : 'G';

  var lois = {
    sexe:      stvLoiSexe(cfg),
    date:      stvLoiDate(cfg),
    poids:     stvLoiPoids(cfg, sexe),
    taille:    stvLoiTaille(cfg, sexe),
    lettre:    stvLoiLettre(cfg, sexe),
    heure:     stvLoiHeure(),
    ascendant: stvLoiAscendant(cfg, r.date || stvJourVersDate(cfg, cfg.date_mu), r.heure),
    chevelu:   stvLoiCoupe(cfg)
  };

  var choix = {
    sexe: r.sexe,
    date: (r.date ? String(stvDateVersJour(cfg, r.date)) : null),
    poids: r.poids, taille: r.taille, lettre: r.lettre,
    heure: r.heure, ascendant: r.ascendant, chevelu: r.chevelu
  };

  var cotes = {};
  for (var q in lois) {
    var c = choix[q];
    cotes[q] = (c && lois[q][c] !== undefined && lois[q][c] > 1e-9)
      ? stvCote(cfg, lois[q][c]) : null;
  }

  if (patate) {
    cotes.sexe = STV_COTE_PATATE;
    cotes.date = cotes.poids = cotes.taille = cotes.lettre = null;
    cotes.heure = cotes.ascendant = cotes.chevelu = null;
  }

  return { lois: lois, cotes: cotes, sexeUtilise: sexe, patate: patate };
}

function stvCotesOptions(cfg, loi) {
  var out = {};
  for (var k in loi) out[k] = stvCote(cfg, loi[k]);
  return out;
}

/* Score final : tout ou rien, la mise multipliée par la cote figée au pari. */
function stvScore(prono, resultat) {
  var total = 0, detail = {};
  for (var q in prono.mises) {
    var gagne = prono.reponses[q] && resultat[q] && prono.reponses[q] === resultat[q];
    var pts = gagne ? Math.round(prono.mises[q] * (prono.cotes[q] || 0)) : 0;
    detail[q] = { gagne: !!gagne, points: pts };
    total += pts;
  }
  return { total: total, detail: detail };
}
