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
  { cle: '0h-4h',   libelle: '0h – 3h59',   debut: 0,  fin: 4,  poids: 19, couleur: '#1B2A4A', nuit: true },
  { cle: '4h-8h',   libelle: '4h – 7h59',   debut: 4,  fin: 8,  poids: 20, couleur: '#456092', nuit: true },
  { cle: '8h-12h',  libelle: '8h – 11h59',  debut: 8,  fin: 12, poids: 17, couleur: '#EFC65C', nuit: false },
  { cle: '12h-16h', libelle: '12h – 15h59', debut: 12, fin: 16, poids: 15, couleur: '#F2D98A', nuit: false },
  { cle: '16h-20h', libelle: '16h – 19h59', debut: 16, fin: 20, poids: 14, couleur: '#C97B37', nuit: false },
  { cle: '20h-0h',  libelle: '20h – 23h59', debut: 20, fin: 24, poids: 15, couleur: '#243761', nuit: true }
];

/* Initiales des prénoms — fichier INSEE, naissances 2021-2025, 3 169 645 cas.
   Trois marchés : G conditionnel aux garçons, F aux filles, X « inconnu »
   (0,5141 × G + 0,4859 × F), utilisé tant que le parieur n'a pas choisi le sexe.
   Initiale prise après normalisation des accents (Éva → E) et sur le premier
   élément des prénoms composés (Jean-Baptiste → J).
   LIMITE : le fichier INSEE exclut les prénoms donnés moins de 20 fois par an,
   soit environ 8 % des naissances. Les initiales rares (X, U, Q, W) sont donc
   sous-estimées et leurs cotes trop généreuses ; le plafond les corrige en partie. */
var STV_LETTRES = {
  G: {
    A:0.139700, B:0.015211, C:0.029643, D:0.017773, E:0.076889, F:0.008123,
    G:0.039103, H:0.022797, I:0.051908, J:0.039174, K:0.031527, L:0.105759,
    M:0.130362, N:0.066217, O:0.015521, P:0.015457, Q:0.001734, R:0.035504,
    S:0.055670, T:0.043645, U:0.002507, V:0.011133, W:0.008497, X:0.000178,
    Y:0.022008, Z:0.013959
  },
  F: {
    A:0.174849, B:0.009560, C:0.060737, D:0.016777, E:0.087554, F:0.012985,
    G:0.017757, H:0.024451, I:0.034268, J:0.053583, K:0.025730, L:0.145318,
    M:0.105276, N:0.047324, O:0.013323, P:0.007713, Q:0.000195, R:0.038397,
    S:0.056134, T:0.023084, U:0.000257, V:0.016374, W:0.001711, X:0.000052,
    Y:0.011693, Z:0.014897
  },
  X: {
    A:0.156780, B:0.012465, C:0.044753, D:0.017289, E:0.082072, F:0.010486,
    G:0.028730, H:0.023601, I:0.043336, J:0.046175, K:0.028710, L:0.124982,
    M:0.118172, N:0.057036, O:0.014453, P:0.011694, Q:0.000986, R:0.036910,
    S:0.055896, T:0.033654, U:0.001414, V:0.013680, W:0.005200, X:0.000117,
    Y:0.016996, Z:0.014415
  }
};

var STV_COUPE = [
  { cle: 'chauve',   libelle: 'Trois poils sur le caillou' },
  { cle: 'duvet',    libelle: 'Un joli duvet' },
  { cle: 'crinière', libelle: 'Une vraie tignasse' }
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
function stvCote(cfg, p, plafond) {
  var max = plafond || cfg.cote_max;
  var v = Math.min(max, Math.max(1.1, 1 / Math.max(p, 1e-6)));
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
  if (!iso || !/^\d{4}-\d{2}-\d{2}$/.test(String(iso))) return null;
  var a = new Date(iso + 'T12:00:00Z'), b = new Date(cfg.terme + 'T12:00:00Z');
  return Math.round((a - b) / 86400000);
}

function stvJourVersDate(cfg, jour) {
  var n = Number(jour);
  if (!isFinite(n)) return cfg.terme;          // garde-fou : jamais de date invalide
  var b = new Date(cfg.terme + 'T12:00:00Z');
  if (isNaN(b.getTime())) return cfg.terme;
  b.setUTCDate(b.getUTCDate() + n);
  return b.toISOString().slice(0, 10);
}


/* ============================================================================
   Tranches
   ============================================================================ */

function stvKg(g) { return (g / 1000).toFixed(1).replace('.', ',') + ' kg'; }

function stvBornes(txt) {
  return String(txt || '').split('|')
    .map(function (v) { return Number(String(v).trim()); })
    .filter(function (v) { return isFinite(v); })
    .sort(function (a, b) { return a - b; });
}

/**
 * Les tranches de poids, définies par leurs bornes dans l'onglet Config.
 *
 * RÈGLE D'ÉTANCHÉITÉ : le poids annoncé est d'abord arrondi à la centaine de
 * grammes la plus proche, puis on cherche sa tranche. 3 250 g devient 3,3 kg
 * et tombe donc dans « 3,3 – 3,5 kg ». Aucun trou, aucun recouvrement, et les
 * libellés affichés sont exactement les valeurs qui gagnent.
 */
function stvTranchesPoids(cfg) {
  var b = stvBornes(cfg.poids_bornes), t = [], i;
  if (b.length < 2) b = [2700, 3000, 3300, 3600, 3900, 4200, 4500];

  t.push({ cle: 'lt', libelle: 'moins de ' + stvKg(b[0]), court: stvKg(b[0]).replace(' kg', '') });
  for (i = 0; i < b.length - 1; i++) {
    var haut = b[i + 1] - 100;
    t.push({
      cle: String(b[i]),
      libelle: (haut > b[i] ? stvKg(b[i]) + ' – ' + stvKg(haut) : stvKg(b[i])),
      court: stvKg(b[i]).replace(' kg', '')
    });
  }
  var d = b[b.length - 1];
  t.push({ cle: 'gt', libelle: stvKg(d) + ' ou plus', court: stvKg(d).replace(' kg', '') });
  return t;
}

/* Même mécanique pour la taille, au centimètre. */
function stvTranchesTaille(cfg) {
  var b = stvBornes(cfg.taille_bornes), t = [], i;
  if (b.length < 2) b = [48, 49, 50, 51, 52, 53, 54];

  t.push({ cle: 'lt', libelle: 'moins de ' + b[0] + ' cm', valeur: b[0] - 1.5 });
  for (i = 0; i < b.length - 1; i++) {
    var haut = b[i + 1] - 1;
    t.push({
      cle: String(b[i]),
      libelle: (haut > b[i] ? b[i] + ' – ' + haut + ' cm' : b[i] + ' cm'),
      valeur: (b[i] + haut) / 2
    });
  }
  var d = b[b.length - 1];
  t.push({ cle: 'gt', libelle: d + ' cm ou plus', valeur: d + 1.5 });
  return t;
}

/* Retrouve la tranche d'une valeur réelle. Sert au dépouillement. */
function stvTrancheDe(bornes, valeur, pas) {
  var v = pas === 100 ? Math.round(Number(valeur) / 100) * 100 : Math.round(Number(valeur));
  if (!isFinite(v)) return '';
  if (v < bornes[0]) return 'lt';
  for (var i = bornes.length - 1; i >= 0; i--) {
    if (v >= bornes[i]) return (i === bornes.length - 1) ? 'gt' : String(bornes[i]);
  }
  return 'lt';
}

/* ============================================================================
   Les lois
   ============================================================================ */

function stvLoiSexe(cfg) {
  return { G: cfg.p_garcon, F: 1 - cfg.p_garcon };
}

/**
 * La date. Trois morceaux :
 *   « avant » : une case unique pour tout ce qui précède la fenêtre (avant 37 SA)
 *   les jours de la fenêtre, un par un, de 37 SA à 41 SA + 6
 *   « apres » : une case unique pour le terme très dépassé (42 SA et plus)
 *
 * Les fréquences viennent des statistiques françaises, par semaine
 * d'aménorrhée, dans l'onglet Config (date_semaines, date_avant, date_apres).
 * Dans la fenêtre, on passe de la semaine au jour par un lissage suivi d'un
 * recalage : la courbe est douce jour par jour, et chaque semaine garde
 * exactement son total d'origine.
 */
function stvSemaines(cfg) {
  var out = [];
  String(cfg.date_semaines || '').split('|').forEach(function (bloc) {
    var p = bloc.split(':');
    if (p.length === 2 && p[0].trim() !== '') {
      out.push({ debut: Number(p[0]), part: Number(p[1]) });
    }
  });
  out.sort(function (a, b) { return a.debut - b.debut; });
  for (var i = 0; i < out.length; i++) {
    out[i].fin = (i + 1 < out.length) ? out[i + 1].debut - 1 : cfg.date_max;
  }
  return out;
}

function stvLisser(p, cfg) {
  var q = {};
  for (var g = cfg.date_min; g <= cfg.date_max; g++) {
    var a = p[g - 1] === undefined ? p[g] : p[g - 1];
    var b = p[g + 1] === undefined ? p[g] : p[g + 1];
    q[g] = (a + 2 * p[g] + b) / 4;
  }
  return q;
}

function stvLoiDate(cfg) {
  var sem = stvSemaines(cfg), p = {}, g, i;

  for (i = 0; i < sem.length; i++) {
    var d0 = Math.max(sem[i].debut, cfg.date_min);
    var d1 = Math.min(sem[i].fin, cfg.date_max);
    if (d1 < d0) continue;
    for (g = d0; g <= d1; g++) p[g] = sem[i].part / (d1 - d0 + 1);
  }
  for (g = cfg.date_min; g <= cfg.date_max; g++) if (p[g] === undefined) p[g] = 0;

  for (i = 0; i < 2; i++) p = stvLisser(p, cfg);

  for (i = 0; i < sem.length; i++) {
    var a = Math.max(sem[i].debut, cfg.date_min);
    var b = Math.min(sem[i].fin, cfg.date_max);
    if (b < a) continue;
    var somme = 0;
    for (g = a; g <= b; g++) somme += p[g];
    if (somme <= 0) continue;
    for (g = a; g <= b; g++) p[g] *= sem[i].part / somme;
  }

  var out = { avant: Number(cfg.date_avant) || 0 };
  for (g = cfg.date_min; g <= cfg.date_max; g++) out[String(g)] = p[g];
  out.apres = Number(cfg.date_apres) || 0;
  return stvNormalise(out);
}

/* La clé d'une réponse de date : « avant », « apres », ou l'écart en jours. */
function stvCleDate(cfg, v) {
  if (!v) return null;
  if (v === 'avant' || v === 'apres') return v;
  var j = stvDateVersJour(cfg, v);
  return (j === null || !isFinite(j)) ? null : String(j);
}

/* Une date réelle, pour l'astronomie, même quand on a parié sur une case balai. */
function stvDateReelle(cfg, v) {
  if (v === 'avant') return stvJourVersDate(cfg, cfg.date_min - 1);
  if (v === 'apres') return stvJourVersDate(cfg, cfg.date_max + 1);
  return v || cfg.terme;
}

function stvLoiPoids(cfg, sexe) {
  var mu = cfg['poids_moyen_' + sexe] + stvBorne(cfg.ajust_poids, cfg.ajust_poids_max);
  var sd = cfg.poids_sd, p = {}, i;
  var b = stvBornes(cfg.poids_bornes);
  if (b.length < 2) b = [2700, 3000, 3300, 3600, 3900, 4200, 4500];

  p.lt = stvCdf(b[0] - 50, mu, sd);
  for (i = 0; i < b.length - 1; i++) {
    p[String(b[i])] = stvBande(b[i] - 50, b[i + 1] - 50, mu, sd);
  }
  p.gt = 1 - stvCdf(b[b.length - 1] - 50, mu, sd);
  return stvNormalise(p);
}

function stvLoiTaille(cfg, sexe) {
  var mu = cfg['taille_moyenne_' + sexe] + stvBorne(cfg.ajust_taille, cfg.ajust_taille_max);
  var sd = cfg.taille_sd, p = {}, i;
  var b = stvBornes(cfg.taille_bornes);
  if (b.length < 2) b = [48, 49, 50, 51, 52, 53, 54];

  p.lt = stvCdf(b[0] - 0.5, mu, sd);
  for (i = 0; i < b.length - 1; i++) {
    p[String(b[i])] = stvBande(b[i] - 0.5, b[i + 1] - 0.5, mu, sd);
  }
  p.gt = 1 - stvCdf(b[b.length - 1] - 0.5, mu, sd);
  return stvNormalise(p);
}

function stvLoiLettre(cfg, sexe) {
  var src = STV_LETTRES[sexe] || STV_LETTRES.X, c = {};
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
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(iso))) return '';
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
    lettre:    stvLoiLettre(cfg, r.sexe === 'F' || r.sexe === 'G' ? r.sexe : 'X'),
    heure:     stvLoiHeure(),
    ascendant: stvLoiAscendant(cfg, stvDateReelle(cfg, r.date), r.heure),
    chevelu:   stvLoiCoupe(cfg)
  };

  var choix = {
    sexe: r.sexe,
    date: stvCleDate(cfg, r.date),
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

function stvCotesOptions(cfg, loi, plafond) {
  var out = {};
  for (var k in loi) out[k] = stvCote(cfg, loi[k], plafond);
  return out;
}

/* Un seul plafond pour tout le jeu, dans l'onglet Config. Il doit rester
   assez haut pour que les réponses rares ne se retrouvent pas toutes à la
   même valeur : avec un plafond à 40, les deux extrêmes du poids cotaient
   40 toutes les deux, ce qui gommait la différence entre « improbable » et
   « très improbable ». */

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
