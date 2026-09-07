/* ============================================================================
   app.js — l'orchestration de la page de pronostics
   ============================================================================ */

var TOKEN = new URLSearchParams(location.search).get('t') || '';

var CFG = null, MOI = null, PHASE = 'open';
var R = {}, MISES = {}, CALC = null;
var DEJA_VALIDE = false;

var QUESTIONS = [
  { cle: 'sexe', type: 'chips', titre: 'Fille ou garçon',
    quoi: 'Deux réponses sérieuses, une chance sur deux. La question qui rapporte le moins et que personne ne saute.' },

  { cle: 'date', type: 'chips', titre: 'Le jour de la naissance',
    quoi: 'Un jour précis dans une fenêtre d\'un mois. Beaucoup de réponses possibles, donc de grosses cotes partout.' },

  { cle: 'poids', type: 'jaugeH', titre: 'Le poids',
    quoi: 'Par tranches de 200 grammes, de la crevette au pilier de rugby.' },

  { cle: 'taille', type: 'jaugeV', titre: 'La taille',
    quoi: 'Au centimètre près. Il faut viser juste, 49 ne paie pas si c\'est 50.' },

  { cle: 'lettre', type: 'chips', titre: 'La première lettre du prénom',
    quoi: 'Juste l\'initiale. Un L ou un A sont fréquents et paient peu, un K ou un Z paient le maximum.' },

  { cle: 'heure', type: 'horloge', titre: 'Le créneau horaire',
    quoi: 'Six tranches de quatre heures sur une horloge de 24 heures. La nuit est légèrement favorisée.' },

  { cle: 'ascendant', type: 'chips', titre: 'L\'ascendant',
    quoi: 'Pour les plus superstitieux d\'entre nous. Il découle du créneau horaire, donc choisis l\'heure d\'abord.' },

  { cle: 'chevelu', type: 'chips', titre: 'La coupe',
    quoi: 'Trois poils, joli duvet ou vraie tignasse. Les parents trancheront photo à l\'appui, sans appel.' }
];

var $ = function (id) { return document.getElementById(id); };
var show = function (id, on) { $(id).classList.toggle('hidden', !on); };


/* ============================================================================
   Démarrage
   ============================================================================ */

if (!TOKEN) {
  show('s-load', false);
  show('s-accueil', true);
} else {
  fetch(API + '?action=me&t=' + encodeURIComponent(TOKEN))
    .then(function (r) { return r.json(); })
    .then(demarrer)
    .catch(function () { show('s-load', false); show('s-accueil', true); });
}

function demarrer(d) {
  show('s-load', false);
  if (!d.ok) { show('s-accueil', true); return; }

  CFG = d.config;
  PHASE = d.phase;
  MOI = { prenom: d.prenom, pseudo: d.pseudo || '' };

  $('terme').textContent = 'Terme prévu le ' + jolieDate(CFG.terme);
  $('mes-papa').innerHTML = enKg(CFG.papa_poids) + ' · ' + CFG.papa_taille + ' cm'
    + '<br>né à ' + CFG.papa_heure;
  $('mes-maman').innerHTML = enKg(CFG.maman_poids) + ' · ' + CFG.maman_taille + ' cm'
    + '<br>née à ' + CFG.maman_heure;

  $('form-sub').textContent = 'Huit questions, ' + CFG.jetons + ' jetons à '
    + 'répartir. Tu peux tout modifier jusqu\'au ' + jolieDate(CFG.cloture) + '.';

  $('lien-pronos').href = 'pronos.html?t=' + encodeURIComponent(TOKEN);

  if (d.prono) {
    R = d.prono.reponses;
    MISES = d.prono.mises;
    DEJA_VALIDE = true;
  }

  $('hello').textContent = 'Bonjour ' + d.prenom;
  if (!MOI.pseudo) { show('s-pseudo', true); return; }
  apresPseudo();
}

function apresPseudo() {
  if (localStorage.getItem('steevie-regles') === 'lues' || DEJA_VALIDE) apresRegles();
  else { construireRegles(); show('s-regles', true); }
}

function apresRegles() {
  if (localStorage.getItem('steevie-quiz') === 'fait' || DEJA_VALIDE) {
    devoilerParents();
    ouvrirFormulaire();
  } else {
    show('s-quiz', true);
    construireQuiz();
  }
}


/* ============================================================================
   Pseudo
   ============================================================================ */

$('btn-pseudo').onclick = function () {
  var v = $('pseudo').value.trim().replace(/\s+/g, ' ');
  var err = function (m) { $('pseudo-err').textContent = m; show('pseudo-err', true); };
  show('pseudo-err', false);
  if (v.length < 2)  return err('Au moins deux caractères.');
  if (v.length > 14) return err('Quatorze caractères maximum.');

  $('btn-pseudo').disabled = true;
  envoyer({ action: 'pseudo', pseudo: v })
    .then(function (d) {
      $('btn-pseudo').disabled = false;
      if (!d.ok) return err(d.error);
      MOI.pseudo = v;
      show('s-pseudo', false);
      apresPseudo();
    })
    .catch(function () { $('btn-pseudo').disabled = false; err('Connexion impossible.'); });
};


/* ============================================================================
   Encart 1 : les règles
   ============================================================================ */

function construireRegles() {
  var box = $('liste-categories');
  box.innerHTML = '';
  QUESTIONS.forEach(function (q) {
    var d = document.createElement('div');
    d.className = 'cat';
    d.innerHTML = '<div class="cat-nom">' + q.titre + '</div>'
                + '<div class="cat-txt">' + q.quoi + '</div>';
    box.appendChild(d);
  });
  $('regles-cloture').textContent = 'Tu peux revenir modifier tes réponses '
    + 'autant que tu veux, mais tout se fige le ' + jolieDate(CFG.cloture)
    + ' au soir. Après, plus personne ne touche à rien : ce serait trop facile '
    + 'de corriger sa date en voyant que le bébé n\'est toujours pas là.';
}

$('btn-regles').onclick = function () {
  localStorage.setItem('steevie-regles', 'lues');
  show('s-regles', false);
  apresRegles();
  window.scrollTo({ top: 0, behavior: 'smooth' });
};

$('btn-revoir').onclick = function () {
  construireRegles();
  show('s-regles', true);
  $('s-regles').scrollIntoView({ behavior: 'smooth' });
};


/* ============================================================================
   Encart 2 : les indices
   ============================================================================ */

var quizFaits = 0;

function construireQuiz() {
  var qs = [
    { t: 'Combien pesait papa à sa naissance ?',
      opts: melange([CFG.papa_poids, CFG.papa_poids - 500, CFG.papa_poids + 600])
              .map(function (v) { return { v: v, l: enKg(v) }; }),
      bon: CFG.papa_poids },
    { t: 'Et maman, combien mesurait-elle ?',
      opts: melange([CFG.maman_taille, CFG.maman_taille + 3, CFG.maman_taille - 2])
              .map(function (v) { return { v: v, l: v + ' cm' }; }),
      bon: CFG.maman_taille },
    { t: 'Qui des deux est né le plus tôt dans la journée ?',
      opts: [{ v: 'papa', l: 'Papa' }, { v: 'maman', l: 'Maman' }],
      bon: CFG.quiz_plus_tot,
      apres: 'À une heure d\'écart : papa à __PH__ et maman à __MH__.' }
  ];

  var box = $('quiz-questions');
  box.innerHTML = '';

  qs.forEach(function (q) {
    var d = document.createElement('div');
    d.className = 'quizq';
    d.innerHTML = '<label class="q">' + q.t + '</label><div class="chips"></div>'
                + '<div class="verdict"></div>';
    var chips = d.querySelector('.chips');

    q.opts.forEach(function (o) {
      var b = document.createElement('button');
      b.className = 'chip plat';
      b.textContent = o.l;
      b.onclick = function () {
        if (d.dataset.repondu) return;
        d.dataset.repondu = '1';
        var bon = String(o.v) === String(q.bon);
        var v = d.querySelector('.verdict');
        var suite = q.apres
          ? ' ' + q.apres.replace('__PH__', CFG.papa_heure).replace('__MH__', CFG.maman_heure)
          : '';
        v.className = 'verdict ' + (bon ? 'bon' : 'faux');
        v.textContent = (bon ? 'Bien vu.' : 'Raté, c\'était ' + libelleBon(q) + '.') + suite;
        chips.querySelectorAll('.chip').forEach(function (c) {
          if (c.textContent === libelleBon(q)) c.setAttribute('aria-pressed', 'true');
          else c.classList.add('off');
        });
        quizFaits++;
        if (quizFaits === 3) finQuiz();
      };
      chips.appendChild(b);
    });
    box.appendChild(d);
  });

  show('btn-quiz-skip', true);
}

function libelleBon(q) {
  for (var i = 0; i < q.opts.length; i++) {
    if (String(q.opts[i].v) === String(q.bon)) return q.opts[i].l;
  }
  return '';
}

function finQuiz() {
  devoilerParents();
  show('btn-quiz-suite', true);
  show('btn-quiz-skip', false);
  localStorage.setItem('steevie-quiz', 'fait');
}

function devoilerParents() {
  $('parent-papa').classList.remove('cache');
  $('parent-maman').classList.remove('cache');
  show('s-quiz', true);
}

$('btn-quiz-suite').onclick = function () {
  show('btn-quiz-suite', false);
  ouvrirFormulaire();
  $('s-form').scrollIntoView({ behavior: 'smooth' });
};

$('btn-quiz-skip').onclick = function () {
  localStorage.setItem('steevie-quiz', 'fait');
  devoilerParents();
  show('btn-quiz-skip', false);
  ouvrirFormulaire();
};


/* ============================================================================
   Le formulaire
   ============================================================================ */

function ouvrirFormulaire() {
  if (PHASE !== 'open') { montrerFerme(); return; }
  show('s-form', true);
  show('solde', true);
  construireQuestions();
  rafraichir();
}

function montrerFerme() {
  show('s-form', true);
  show('solde', false);
  show('bandeau-clos', true);
  $('bandeau-clos').textContent = PHASE === 'revealed'
    ? 'Les pronostics sont clos et les résultats sont tombés.'
    : 'Les pronostics ont fermé le ' + jolieDate(CFG.cloture)
      + ' au soir. Plus aucune modification n\'est possible, pour personne.';
  $('questions').innerHTML = '';
  montrerTicketSiPossible();
}

function construireQuestions() {
  var box = $('questions');
  box.innerHTML = '';

  QUESTIONS.forEach(function (q) {
    var d = document.createElement('div');
    d.className = 'qcard';
    d.id = 'q-' + q.cle;
    d.innerHTML =
      '<div class="qhead"><span class="qtitle">' + q.titre + '</span></div>'
      + '<div class="chapo"></div>'
      + '<div class="zone"></div>'
      + '<div class="extra qhint"></div>'
      + '<div class="mise">'
      +   '<button data-d="-5">−</button><span class="val">0</span>'
      +   '<button data-d="5">+</button><span class="gain"></span>'
      + '</div>';
    d.querySelectorAll('.mise button').forEach(function (b) {
      b.onclick = function () { bouger(q.cle, Number(b.dataset.d)); };
    });
    box.appendChild(d);
  });

  $('q-ascendant').querySelector('.chapo').innerHTML =
    '<p class="qhint">Pour les plus superstitieux d\'entre nous. L\'ascendant '
    + 'n\'est pas le signe du zodiaque : c\'est la constellation qui se levait '
    + 'à l\'horizon est à la minute de la naissance. Il tourne avec la Terre et '
    + 'change toutes les deux heures environ, ce qui explique qu\'il dépende du '
    + 'créneau horaire choisi juste au-dessus.</p>'
    + '<details class="outil"><summary>Tu ne connais pas le tien ? Calcule-le</summary>'
    + '<div class="outil-corps">'
    + '<div class="duo"><input type="date" id="asc-date"><input type="time" id="asc-heure" value="12:00"></div>'
    + '<button class="cta ghost" id="asc-go" style="margin-top:10px">Trouver mon ascendant</button>'
    + '<p class="asc-res" id="asc-res"></p></div></details>';

  $('asc-go').onclick = function () {
    var d = $('asc-date').value, h = $('asc-heure').value;
    if (!d || !h) { $('asc-res').textContent = 'Il faut une date et une heure.'; return; }
    var p = h.split(':');
    var s = stvMonAscendant(d, Number(p[0]), Number(p[1]), CFG.lat, CFG.lon);
    $('asc-res').innerHTML = 'Ascendant <strong>' + s + '</strong> — ' + STV_CARACTERES[s]
      + '.<br><span class="mini-note">Calculé pour la région parisienne. À quelques '
      + 'centaines de kilomètres près, le résultat peut basculer sur le signe voisin.</span>';
  };
}


/* --------------------------------------------------------------------------
   Options par question
   -------------------------------------------------------------------------- */

function optionsDe(cle) {
  var i, out = [];

  if (cle === 'sexe') return [
    { v: 'F', l: 'Une fille' },
    { v: 'G', l: 'Un garçon' },
    { v: 'P', l: 'Une pomme de terre' }
  ];

  if (cle === 'date') {
    for (i = CFG.date_min; i <= CFG.date_max; i++) {
      out.push({ v: String(i), l: courteDate(stvJourVersDate(CFG, i)) });
    }
    return out;
  }
  if (cle === 'poids')  return stvTranchesPoids(CFG).map(function (t) {
    return { v: t.cle, l: t.libelle, court: t.court }; });
  if (cle === 'taille') return stvTranchesTaille(CFG).map(function (t) {
    return { v: t.cle, l: t.libelle, valeur: t.valeur }; });
  if (cle === 'lettre') {
    for (i = 65; i <= 90; i++) out.push({ v: String.fromCharCode(i), l: String.fromCharCode(i) });
    return out;
  }
  if (cle === 'heure') return STV_CRENEAUX.map(function (c) { return { v: c.cle, l: c.cle }; });
  if (cle === 'ascendant') return STV_SIGNES.map(function (s) { return { v: s, l: s }; });
  if (cle === 'chevelu') return STV_COUPE.map(function (c) {
    return { v: c.cle, l: c.libelle, detail: c.detail }; });
  return out;
}


/* --------------------------------------------------------------------------
   Rendu
   -------------------------------------------------------------------------- */

function rafraichir() {
  CALC = stvCalculer(CFG, R);
  var patate = CALC.patate;

  QUESTIONS.forEach(function (q) {
    var d = $('q-' + q.cle);
    if (!d) return;

    var bloque = patate && q.cle !== 'sexe';
    d.classList.toggle('bloque', bloque);

    var zone = d.querySelector('.zone');
    var loi = CALC.lois[q.cle];
    var cotes = stvCotesOptions(CFG, loi);
    var choisi = q.cle === 'date'
      ? (R.date ? String(stvDateVersJour(CFG, R.date)) : null)
      : R[q.cle];

    zone.innerHTML = '';
    if (q.type === 'jaugeH')       jaugePoids(zone, q, loi, cotes, choisi);
    else if (q.type === 'jaugeV')  jaugeTaille(zone, q, loi, cotes, choisi);
    else if (q.type === 'horloge') horloge(zone, q, loi, cotes, choisi);
    else                           pastilles(zone, q, loi, cotes, choisi);

    contexte(d, q, loi);
    majMise(d, q, patate);
  });

  majSolde();
}

function choisir(cle, v) {
  if (cle === 'date') R.date = stvJourVersDate(CFG, Number(v));
  else R[cle] = v;

  if (cle === 'sexe' && v === 'P') {
    MISES = { sexe: CFG.jetons };
    for (var k in R) if (k !== 'sexe') delete R[k];
  } else if (cle === 'sexe' && MISES.sexe === CFG.jetons && CALC && CALC.patate) {
    MISES = {};
  }
  rafraichir();
}

/* Pastilles : la cote est inscrite en petit dans le cadre de chaque option. */
function pastilles(zone, q, loi, cotes, choisi) {
  var box = document.createElement('div');
  box.className = 'chips' + (q.cle === 'lettre' ? ' lettres' : '');

  optionsDe(q.cle).forEach(function (o) {
    var impossible = (o.v !== 'P') && (loi[o.v] === undefined || loi[o.v] < 1e-9);
    var b = document.createElement('button');
    b.className = 'chip' + (impossible ? ' off' : '') + (o.v === 'P' ? ' patate' : '');
    b.dataset.v = o.v;
    b.innerHTML = '<span class="lbl">' + o.l + '</span>'
      + (o.detail ? '<span class="det">' + o.detail + '</span>' : '')
      + '<span class="cote">' + (impossible ? '—'
          : stvFmtCote(o.v === 'P' ? STV_COTE_PATATE : cotes[o.v])) + '</span>';
    if (String(choisi) === String(o.v)) b.setAttribute('aria-pressed', 'true');
    b.onclick = function () {
      if (impossible) return expliquerImpossible(q.cle);
      choisir(q.cle, o.v);
    };
    box.appendChild(b);
  });
  zone.appendChild(box);
}

/* Jauge horizontale du poids, de la crevette au pilier. */
function jaugePoids(zone, q, loi, cotes, choisi) {
  var opts = optionsDe('poids');
  var h = '<div class="jauge-h">';
  opts.forEach(function (o, i) {
    var sel = String(choisi) === String(o.v);
    var t = i / (opts.length - 1);
    h += '<button class="seg' + (sel ? ' sel' : '') + '" data-v="' + o.v + '"'
       + ' style="--t:' + t.toFixed(3) + '">'
       + '<span class="seg-cote">' + stvFmtCote(cotes[o.v]) + '</span></button>';
  });
  h += '</div><div class="jauge-bornes"><span>🦐 une crevette</span>'
     + '<span>pilier du Stade Toulousain 🏉</span></div>'
     + '<div class="jauge-choix">' + (choisi
        ? libelleDe(opts, choisi) : 'Choisis une tranche') + '</div>';
  zone.innerHTML = h;
  zone.querySelectorAll('.seg').forEach(function (b) {
    b.onclick = function () { choisir('poids', b.dataset.v); };
  });
}

/* Jauge verticale de la taille, avec un bébé qui grandit à côté. */
function jaugeTaille(zone, q, loi, cotes, choisi) {
  var opts = optionsDe('taille').slice().reverse();
  var sel = opts.filter(function (o) { return String(o.v) === String(choisi); })[0];
  var cm = sel ? sel.valeur : CFG.taille_moyenne_G;
  var k = (0.62 + (cm - (CFG.taille_bas - 2)) / ((CFG.taille_haut + 2) - (CFG.taille_bas - 2)) * 0.55).toFixed(3);

  var h = '<div class="jauge-v-wrap"><div class="jauge-v">';
  opts.forEach(function (o) {
    h += '<button class="pal' + (String(choisi) === String(o.v) ? ' sel' : '') + '"'
       + ' data-v="' + o.v + '"><span class="pal-lab">' + o.l + '</span>'
       + '<span class="pal-cote">' + stvFmtCote(cotes[o.v]) + '</span></button>';
  });
  h += '</div><div class="bebe-box"><div class="bebe" style="--k:' + k + '">'
     + bebeSVG() + '</div><div class="bebe-lab">'
     + (sel ? sel.libelle : 'à toi de voir') + '</div></div></div>';
  zone.innerHTML = h;
  zone.querySelectorAll('.pal').forEach(function (b) {
    b.onclick = function () { choisir('taille', b.dataset.v); };
  });
}

function bebeSVG() {
  return '<svg viewBox="0 0 90 150" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">'
    + '<ellipse cx="45" cy="144" rx="30" ry="5" fill="#17251F" opacity=".10"/>'
    + '<path d="M20 140c0-38 8-62 25-62s25 24 25 62z" fill="#D9A31E" opacity=".85"/>'
    + '<circle cx="45" cy="52" r="27" fill="#F2D7BE"/>'
    + '<path d="M21 42c5-15 15-22 24-22s19 7 24 22c-8-6-16-5-24-5s-16-1-24 5z" fill="#5A4033"/>'
    + '<circle cx="35" cy="53" r="3" fill="#17251F"/><circle cx="55" cy="53" r="3" fill="#17251F"/>'
    + '<circle cx="26" cy="61" r="4.5" fill="#E39A9A" opacity=".5"/>'
    + '<circle cx="64" cy="61" r="4.5" fill="#E39A9A" opacity=".5"/>'
    + '<path d="M38 65q7 6 14 0" stroke="#17251F" stroke-width="2.4" fill="none" stroke-linecap="round"/>'
    + '</svg>';
}

/* Horloge de 24 heures, six quartiers, du bleu nuit au jaune plein jour. */
function horloge(zone, q, loi, cotes, choisi) {
  var R0 = 52, R1 = 96, cx = 110, cy = 110, s = '';

  STV_CRENEAUX.forEach(function (c) {
    var a0 = c.debut / 24 * 360 - 90, a1 = c.fin / 24 * 360 - 90;
    var sel = (choisi === c.cle);
    s += '<path class="quartier' + (sel ? ' sel' : '') + '" data-v="' + c.cle + '"'
       + ' d="' + arc(cx, cy, R0, R1, a0, a1) + '" fill="' + c.couleur + '"></path>';
    var am = (a0 + a1) / 2 * Math.PI / 180, rm = (R0 + R1) / 2;
    s += '<text class="q-lab' + (c.nuit ? ' clair' : '') + '" x="' + (cx + rm * Math.cos(am)).toFixed(1)
       + '" y="' + (cy + rm * Math.sin(am) - 4).toFixed(1) + '">' + c.cle + '</text>';
    s += '<text class="q-cote' + (c.nuit ? ' clair' : '') + '" x="' + (cx + rm * Math.cos(am)).toFixed(1)
       + '" y="' + (cy + rm * Math.sin(am) + 11).toFixed(1) + '">' + stvFmtCote(cotes[c.cle]) + '</text>';
  });

  zone.innerHTML = '<div class="horloge"><svg viewBox="0 0 220 220">' + s
    + '<circle cx="110" cy="110" r="46" fill="var(--card)"/>'
    + '<text class="h-centre" x="110" y="105">' + (choisi || 'minuit') + '</text>'
    + '<text class="h-sous" x="110" y="124">' + (choisi ? 'ton pari' : 'en haut') + '</text>'
    + '</svg></div>';

  zone.querySelectorAll('.quartier').forEach(function (p) {
    p.onclick = function () { choisir('heure', p.dataset.v); };
  });
}

function arc(cx, cy, r0, r1, a0, a1) {
  var d2r = Math.PI / 180;
  var x0 = cx + r1 * Math.cos(a0 * d2r), y0 = cy + r1 * Math.sin(a0 * d2r);
  var x1 = cx + r1 * Math.cos(a1 * d2r), y1 = cy + r1 * Math.sin(a1 * d2r);
  var x2 = cx + r0 * Math.cos(a1 * d2r), y2 = cy + r0 * Math.sin(a1 * d2r);
  var x3 = cx + r0 * Math.cos(a0 * d2r), y3 = cy + r0 * Math.sin(a0 * d2r);
  var grand = (a1 - a0) > 180 ? 1 : 0;
  return 'M' + x0 + ' ' + y0 + 'A' + r1 + ' ' + r1 + ' 0 ' + grand + ' 1 ' + x1 + ' ' + y1
       + 'L' + x2 + ' ' + y2 + 'A' + r0 + ' ' + r0 + ' 0 ' + grand + ' 0 ' + x3 + ' ' + y3 + 'Z';
}

function libelleDe(opts, v) {
  for (var i = 0; i < opts.length; i++) if (String(opts[i].v) === String(v)) return opts[i].l;
  return '';
}


/* --------------------------------------------------------------------------
   Textes contextuels et mises
   -------------------------------------------------------------------------- */

function contexte(d, q, loi) {
  var e = d.querySelector('.extra');
  e.textContent = '';

  if (q.cle === 'sexe' && R.sexe === 'P') {
    e.innerHTML = '<strong>Tu paries sur une pomme de terre.</strong> Cent jetons, '
      + 'cote 10 000, et le reste du formulaire est bloqué : on ne mise pas sur la '
      + 'taille d\'un tubercule. Un million de points si tu as raison. Reviens sur '
      + 'fille ou garçon pour reprendre une vie normale.';
  }
  if (q.cle === 'date' && R.date) {
    e.textContent = 'Ton pronostic donne un ' + stvSigneSolaire(R.date)
      + '. Et s\'il ou elle était né à Singapour, ce serait un Cheval de Feu !';
  }
  if (q.cle === 'ascendant') {
    var possibles = Object.keys(loi).filter(function (k) { return loi[k] > 1e-9; });
    if (!R.heure) e.textContent = 'Choisis d\'abord un créneau horaire : il détermine les ascendants possibles.';
    else if (R.ascendant) e.innerHTML = '<strong>' + R.ascendant + '</strong> — '
      + STV_CARACTERES[R.ascendant] + '. Avec ton créneau, seuls ' + possibles.join(', ')
      + ' sont possibles ; les autres sont grisés.';
    else e.textContent = 'Ton créneau de ' + R.heure + ' ne peut donner que : '
      + possibles.join(', ') + '. Les autres sont grisés.';
  }
}

function expliquerImpossible(cle) {
  if (cle !== 'ascendant') return;
  var e = $('q-ascendant').querySelector('.extra');
  e.classList.add('rouge');
  e.textContent = 'Impossible avec ton créneau : à cette heure-là, ce signe n\'est '
    + 'pas à l\'horizon. Change de créneau horaire pour le rendre accessible.';
  setTimeout(function () { e.classList.remove('rouge'); rafraichir(); }, 6000);
}

function majMise(d, q, patate) {
  var mise = MISES[q.cle] || 0;
  d.querySelector('.val').textContent = mise + ' jeton' + (mise > 1 ? 's' : '');
  var cote = CALC.cotes[q.cle];
  d.querySelector('.gain').textContent = (mise && cote)
    ? 'rapporte ' + Math.round(mise * cote).toLocaleString('fr-FR') + ' pts' : '';
  var bloque = patate && q.cle !== 'sexe';
  d.querySelector('[data-d="-5"]').disabled = mise <= 0 || patate;
  d.querySelector('[data-d="5"]').disabled = restant() <= 0 || !R[q.cle] || bloque || patate;
}

function bouger(cle, dv) {
  if (CALC && CALC.patate) return;
  var v = (MISES[cle] || 0) + dv;
  if (v < 0) v = 0;
  if (dv > 0 && restant() <= 0) return;
  MISES[cle] = v;
  rafraichir();
}

function totalMise() { var s = 0; for (var k in MISES) s += MISES[k]; return s; }
function restant()   { return CFG.jetons - totalMise(); }

function gainMaximum() {
  var t = 0;
  for (var k in MISES) {
    var c = CALC && CALC.cotes[k];
    if (c && MISES[k]) t += Math.round(MISES[k] * c);
  }
  return t;
}

function toutesRepondues() {
  for (var i = 0; i < QUESTIONS.length; i++) {
    var c = QUESTIONS[i].cle;
    if ((MISES[c] || 0) > 0 && !R[c]) return false;
  }
  return true;
}

function majSolde() {
  var r = restant(), complet = (r === 0) && toutesRepondues();
  $('solde-jetons').textContent = r === 0
    ? (toutesRepondues() ? 'Tous tes jetons sont placés' : 'Il manque des réponses')
    : r + ' jeton' + (r > 1 ? 's' : '') + ' à placer';
  var g = gainMaximum();
  $('solde-gain').textContent = g
    ? 'Gain maximum : ' + g.toLocaleString('fr-FR') + ' pts'
    : 'Place tes jetons pour voir ton gain';
  $('solde').classList.toggle('plein', complet);
  $('btn-save').disabled = !complet;
}


/* ============================================================================
   Enregistrement
   ============================================================================ */

$('btn-save').onclick = function () {
  show('form-err', false);
  $('btn-save').disabled = true;
  $('btn-save').textContent = '…';

  envoyer({ action: 'prono', reponses: R, mises: MISES })
    .then(function (d) {
      $('btn-save').textContent = 'Valider';
      if (!d.ok) {
        $('form-err').textContent = d.error;
        show('form-err', true);
        $('btn-save').disabled = false;
        return;
      }
      R = d.prono.reponses; MISES = d.prono.mises; DEJA_VALIDE = true;
      show('s-form', false); show('s-regles', false);
      show('s-quiz', false); show('solde', false);
      montrerTicket(d.prono);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    })
    .catch(function () {
      $('btn-save').textContent = 'Valider';
      $('btn-save').disabled = false;
      $('form-err').textContent = 'Connexion impossible. Réessaie.';
      show('form-err', true);
    });
};

function montrerTicketSiPossible() {
  if (Object.keys(R).length) {
    montrerTicket({ reponses: R, mises: MISES,
      cotes: (CALC || stvCalculer(CFG, R)).cotes });
  }
}

function montrerTicket(prono) {
  show('s-ticket', true);
  dessinerTicket($('ticket-canvas'), CFG, MOI.pseudo, prono, QUESTIONS);
  $('btn-edit').classList.toggle('hidden', PHASE !== 'open');
}

$('btn-edit').onclick = function () {
  show('s-ticket', false);
  ouvrirFormulaire();
  $('s-form').scrollIntoView({ behavior: 'smooth' });
};

$('btn-share').onclick = function () { partagerTicket($('ticket-canvas'), MOI.pseudo); };


/* ============================================================================
   Renvoi du lien
   ============================================================================ */

$('btn-resend').onclick = function () {
  var mail = $('email').value.trim();
  if (!mail) { $('resend-msg').textContent = 'Entre ton adresse mail.'; return; }
  $('btn-resend').disabled = true;
  fetch(API + '?action=resend&email=' + encodeURIComponent(mail))
    .then(function (r) { return r.json(); })
    .then(function () {
      $('resend-msg').textContent = 'Si cette adresse est sur la liste, le lien '
        + 'vient de partir. Pense au dossier spam.';
    })
    .catch(function () { $('resend-msg').textContent = 'Connexion impossible. Réessaie.'; })
    .finally(function () { $('btn-resend').disabled = false; });
};


/* ============================================================================
   Utilitaires
   ============================================================================ */

function envoyer(payload) {
  payload.token = TOKEN;
  return fetch(API, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify(payload)
  }).then(function (r) { return r.json(); });
}

function melange(a) {
  a = a.slice();
  for (var i = a.length - 1; i > 0; i--) {
    var j = Math.floor(Math.random() * (i + 1));
    var t = a[i]; a[i] = a[j]; a[j] = t;
  }
  return a;
}

function enKg(g) { return (Number(g) / 1000).toFixed(1).replace('.', ',') + ' kg'; }

var MOIS = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet',
            'août', 'septembre', 'octobre', 'novembre', 'décembre'];

function jolieDate(iso) {
  if (!iso) return '';
  var p = String(iso).split('-');
  return Number(p[2]) + ' ' + MOIS[Number(p[1]) - 1] + ' ' + p[0];
}

function courteDate(iso) {
  var p = String(iso).split('-');
  return Number(p[2]) + ' ' + MOIS[Number(p[1]) - 1].slice(0, 4);
}
