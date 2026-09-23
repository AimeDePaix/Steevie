/* ============================================================================
   app.js — le parcours du joueur, étape par étape
   ----------------------------------------------------------------------------
   1. le mot des parents   2. le pseudo   3. les règles   4. les indices
   5. le formulaire        puis le ticket, qui déverrouille tout le reste.

   Chaque étape franchie est enregistrée côté serveur : en rouvrant son lien,
   on revient exactement là où on s'était arrêté, sur n'importe quel appareil.
   Les réponses non validées sont gardées en brouillon sur l'appareil.
   ============================================================================ */

var PARAMS = new URLSearchParams(location.search);
var TOKEN = PARAMS.get('t') || '';
var VUE = PARAMS.get('vue') || '';

var CFG = null, MOI = null, PHASE = 'open';
var R = {}, MISES = {}, CALC = null;
var NIVEAU = '';               // '', 'regles', 'indices', 'pronos', 'fini'
var ORDRE = ['', 'regles', 'indices', 'pronos', 'fini'];

var QUESTIONS = [
  { cle: 'sexe',      type: 'chips',   titre: 'Fille ou garçon',              court: 'le sexe' },
  { cle: 'date',      type: 'chips',   titre: 'Le jour de la naissance',      court: 'le jour' },
  { cle: 'poids',     type: 'jaugeH',  titre: 'Le poids',                     court: 'le poids' },
  { cle: 'taille',    type: 'jaugeV',  titre: 'La taille',                    court: 'la taille' },
  { cle: 'lettre',    type: 'chips',   titre: 'La première lettre du prénom', court: 'la première lettre' },
  { cle: 'heure',     type: 'horloge', titre: 'Le créneau horaire',           court: 'le créneau horaire' },
  { cle: 'ascendant', type: 'chips',   titre: 'L\'ascendant',                 court: 'l\'ascendant' },
  { cle: 'chevelu',   type: 'chips',   titre: 'La coupe',                     court: 'la coupe' }
];

var ETAPES = [
  { id: 's-bienvenue', n: 1, nom: 'Le mot des parents' },
  { id: 's-pseudo',    n: 2, nom: 'Ton pseudo' },
  { id: 's-regles',    n: 3, nom: 'Les règles du jeu' },
  { id: 's-quiz',      n: 4, nom: 'Les indices' },
  { id: 's-form',      n: 5, nom: 'Tes pronostics' }
];

var $ = function (id) { return document.getElementById(id); };
var show = function (id, on) { var e = $(id); if (e) e.classList.toggle('hidden', !on); };


/* ============================================================================
   Démarrage et aiguillage
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

  document.title = 'Steevie — pronostics';
  show('entete', true);
  show('pied', true);

  CFG = d.config;
  PHASE = d.phase;
  MOI = { prenom: d.prenom, pseudo: d.pseudo || '' };

  $('hello').textContent = 'Bonjour ' + d.prenom;
  $('mes-papa').innerHTML = enKg(CFG.papa_poids) + ' · ' + CFG.papa_taille + ' cm<br>né à ' + CFG.papa_heure;
  $('mes-maman').innerHTML = enKg(CFG.maman_poids) + ' · ' + CFG.maman_taille + ' cm<br>née à ' + CFG.maman_heure;
  $('regles-cloture').textContent = 'Tu peux revenir modifier tes réponses autant que tu veux '
    + 'jusqu\'au ' + jolieDate(CFG.cloture) + ' au soir. Ensuite, tout se fige.';

  if (d.prono) {
    R = d.prono.reponses; MISES = d.prono.mises;
    NIVEAU = 'fini';
  } else {
    NIVEAU = d.progression || (MOI.pseudo ? 'regles' : '');
    chargerBrouillon();
  }
  memoriserNiveau();
  aiguiller();
}

/* Où envoyer la personne : la vue demandée par la barre si elle y a droit,
   sinon l'étape où elle s'était arrêtée. */
function aiguiller() {
  var n = ORDRE.indexOf(NIVEAU);

  if (VUE === 'regles' && n >= 3) return allerRegles();
  if (VUE === 'pronos' && n >= 3) return allerFormulaire();
  if (VUE === 'ticket' && NIVEAU === 'fini') return allerTicket();

  if (NIVEAU === 'fini')    return allerTicket();
  if (NIVEAU === 'pronos')  return allerFormulaire();
  if (NIVEAU === 'indices') return allerQuiz();
  if (NIVEAU === 'regles')  return allerRegles();
  if (MOI.pseudo)           return allerRegles();
  return etape('s-bienvenue');
}

/* Une seule section visible à la fois, avec la progression en tête. */
function etape(id, onglet) {
  ['s-accueil', 's-bienvenue', 's-pseudo', 's-regles', 's-quiz', 's-form', 's-ticket']
    .forEach(function (x) { show(x, x === id); });
  show('solde', id === 's-form' && PHASE === 'open');

  var e = ETAPES.filter(function (x) { return x.id === id; })[0];
  if (e && NIVEAU !== 'fini') {
    $('progression').innerHTML = '<span class="prog-n">Étape ' + e.n + ' sur 5</span>'
      + '<span class="prog-nom">' + e.nom + '</span>'
      + '<span class="prog-barre"><i style="width:' + (e.n / 5 * 100) + '%"></i></span>';
    show('progression', true);
  } else {
    show('progression', false);
  }

  stvNav(onglet || '');
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

/* Enregistre qu'une étape est franchie. On n'avance jamais à reculons. */
function avancer(nouveau) {
  if (ORDRE.indexOf(nouveau) <= ORDRE.indexOf(NIVEAU)) return;
  NIVEAU = nouveau;
  memoriserNiveau();
  if (nouveau !== 'fini') envoyer({ action: 'etape', etape: nouveau }).catch(function () {});
}

function memoriserNiveau() {
  try { localStorage.setItem('steevie-niveau-' + TOKEN, NIVEAU); } catch (e) {}
}


/* ============================================================================
   Étapes 1 et 2 : le mot des parents, le pseudo
   ============================================================================ */

$('btn-bienvenue').onclick = function () { etape('s-pseudo'); };

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
      avancer('regles');
      allerRegles();
    })
    .catch(function () { $('btn-pseudo').disabled = false; err('Connexion impossible.'); });
};


/* ============================================================================
   Étape 3 : les règles
   ============================================================================ */

function allerRegles() {
  var dejaPasse = ORDRE.indexOf(NIVEAU) >= 3;
  $('btn-regles').textContent = dejaPasse
    ? (NIVEAU === 'fini' ? 'Retour à mon ticket' : 'Retour à mon formulaire')
    : 'Compris, passons aux indices';
  etape('s-regles', 'regles');
}

$('btn-regles').onclick = function () {
  if (NIVEAU === 'fini') return allerTicket();
  if (NIVEAU === 'pronos') return allerFormulaire();
  avancer('indices');
  allerQuiz();
};


/* ============================================================================
   Étape 4 : les indices
   ============================================================================ */

var quizFaits = 0;

function allerQuiz() {
  quizFaits = 0;
  $('parents').classList.add('voilees');
  $('parent-papa').classList.add('cache');
  $('parent-maman').classList.add('cache');
  show('btn-quiz-suite', false);
  construireQuiz();
  etape('s-quiz');
}

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
      apres: 'À une heure d\'écart : papa à ' + CFG.papa_heure + ' et maman à ' + CFG.maman_heure + '.' }
  ];

  var box = $('quiz-questions');
  box.innerHTML = '';

  qs.forEach(function (q) {
    var d = document.createElement('div');
    d.className = 'quizq';
    d.innerHTML = '<label class="q">' + q.t + '</label><div class="chips"></div><div class="verdict"></div>';
    var chips = d.querySelector('.chips');
    var bonLib = q.opts.filter(function (o) { return String(o.v) === String(q.bon); })[0];
    bonLib = bonLib ? bonLib.l : '';

    q.opts.forEach(function (o) {
      var b = document.createElement('button');
      b.className = 'chip plat';
      b.textContent = o.l;
      b.onclick = function () {
        if (d.dataset.repondu) return;
        d.dataset.repondu = '1';
        var bon = String(o.v) === String(q.bon);
        var v = d.querySelector('.verdict');
        v.className = 'verdict ' + (bon ? 'bon' : 'faux');
        v.textContent = (bon ? 'Bien vu.' : 'Raté, c\'était ' + bonLib + '.') + (q.apres ? ' ' + q.apres : '');
        chips.querySelectorAll('.chip').forEach(function (c) {
          if (c.textContent === bonLib) c.setAttribute('aria-pressed', 'true');
          else c.classList.add('off');
        });
        quizFaits++;
        if (quizFaits === qs.length) finQuiz();
      };
      chips.appendChild(b);
    });
    box.appendChild(d);
  });
}

function finQuiz() {
  $('parents').classList.remove('voilees');
  $('parent-papa').classList.remove('cache');
  $('parent-maman').classList.remove('cache');
  show('btn-quiz-suite', true);
  $('parents').scrollIntoView({ behavior: 'smooth', block: 'center' });
}

$('btn-quiz-suite').onclick = function () {
  avancer('pronos');
  allerFormulaire();
};


/* ============================================================================
   Étape 5 : le formulaire
   ============================================================================ */

function allerFormulaire() {
  if (PHASE !== 'open') return montrerFerme();
  $('form-sub').innerHTML = 'Huit questions, ' + CFG.jetons + ' jetons. Tant que tu n\'as pas '
    + 'validé, tes réponses restent en brouillon sur cet appareil : tu peux fermer la '
    + 'page et revenir plus tard avec ton lien. Modifiable jusqu\'au '
    + jolieDate(CFG.cloture) + '.';
  show('bandeau-clos', false);
  show('manques', false);
  construireQuestions();
  rafraichir();
  etape('s-form', 'pronos');
}

function montrerFerme() {
  $('bandeau-clos').textContent = PHASE === 'revealed'
    ? 'Les pronostics sont clos et les résultats sont tombés.'
    : 'Les pronostics ont fermé le ' + jolieDate(CFG.cloture) + ' au soir. Plus aucune modification n\'est possible.';
  $('questions').innerHTML = '';
  show('bandeau-clos', true);
  etape('s-form', 'pronos');
}

function construireQuestions() {
  var box = $('questions');
  box.innerHTML = '';

  QUESTIONS.forEach(function (q) {
    var d = document.createElement('div');
    d.className = 'qcard';
    d.id = 'q-' + q.cle;
    d.innerHTML = '<div class="qhead"><span class="qtitle">' + q.titre + '</span></div>'
      + '<div class="chapo"></div><div class="zone"></div><div class="extra qhint"></div>'
      + '<div class="mise"><button data-d="-5">−</button><span class="val">0</span>'
      + '<button data-d="5">+</button><span class="gain"></span></div>';
    d.querySelectorAll('.mise button').forEach(function (b) {
      b.onclick = function () { bouger(q.cle, Number(b.dataset.d)); };
    });
    box.appendChild(d);
  });

  $('q-ascendant').querySelector('.chapo').innerHTML =
    '<p class="qhint">Pour les plus superstitieux d\'entre nous. L\'ascendant n\'est pas '
    + 'le signe du zodiaque : c\'est la constellation qui se levait à l\'horizon Est à la '
    + 'minute de la naissance. Il tourne avec la Terre et change toutes les deux heures '
    + 'environ, ce qui explique qu\'il dépende du créneau horaire choisi juste au-dessus.</p>';
}

function optionsDe(cle) {
  var i, out = [];
  if (cle === 'sexe') return [
    { v: 'F', l: 'Une fille' }, { v: 'G', l: 'Un garçon' }, { v: 'P', l: 'Une pomme de terre' }
  ];
  if (cle === 'date') {
    out.push({ v: 'avant', l: 'Avant le ' + courteDate(stvJourVersDate(CFG, CFG.date_min)) });
    for (i = CFG.date_min; i <= CFG.date_max; i++) {
      out.push({ v: String(i), l: courteDate(stvJourVersDate(CFG, i)) });
    }
    out.push({ v: 'apres', l: courteDate(stvJourVersDate(CFG, CFG.date_max + 1)) + ' ou après' });
    return out;
  }
  if (cle === 'poids')  return stvTranchesPoids(CFG).map(function (t) { return { v: t.cle, l: t.libelle }; });
  if (cle === 'taille') return stvTranchesTaille(CFG).map(function (t) { return { v: t.cle, l: t.libelle, valeur: t.valeur }; });
  if (cle === 'lettre') {
    for (i = 65; i <= 90; i++) out.push({ v: String.fromCharCode(i), l: String.fromCharCode(i) });
    return out;
  }
  if (cle === 'heure')     return STV_CRENEAUX.map(function (c) { return { v: c.cle, l: c.libelle }; });
  if (cle === 'ascendant') return STV_SIGNES.map(function (s) { return { v: s, l: s }; });
  if (cle === 'chevelu')   return STV_COUPE.map(function (c) { return { v: c.cle, l: c.libelle }; });
  return out;
}

function choisiDe(cle) {
  return cle === 'date' ? stvCleDate(CFG, R.date) : (R[cle] || null);
}

function rafraichir() {
  CALC = stvCalculer(CFG, R);

  QUESTIONS.forEach(function (q) {
    var d = $('q-' + q.cle);
    if (!d) return;
    d.classList.toggle('bloque', CALC.patate && q.cle !== 'sexe');

    var zone = d.querySelector('.zone');
    var loi = CALC.lois[q.cle];
    var cotes = stvCotesOptions(CFG, loi);
    var choisi = choisiDe(q.cle);

    zone.innerHTML = '';
    if (q.type === 'jaugeH')       jaugePoids(zone, cotes, choisi);
    else if (q.type === 'jaugeV')  jaugeTaille(zone, cotes, choisi);
    else if (q.type === 'horloge') horloge(zone, cotes, choisi);
    else                           pastilles(zone, q, loi, cotes, choisi);

    if (choisi) d.classList.remove('manque');
    contexte(d, q, loi);
    majMise(d, q);
  });

  majSolde();
  sauverBrouillon();
}

function choisir(cle, v) {
  if (cle === 'date') R.date = (v === 'avant' || v === 'apres') ? v : stvJourVersDate(CFG, Number(v));
  else R[cle] = v;

  // Choisir la pomme de terre grise le formulaire mais n'efface rien : en
  // revenant à fille ou garçon, on retrouve toutes ses réponses.
  show('manques', false);
  rafraichir();
}


/* --------------------------------------------------------------------------
   Les widgets
   -------------------------------------------------------------------------- */

/* Pastilles, cote inscrite en petit dans chaque cadre. La pomme de terre
   n'existe QUE sur la question du sexe : sans ce test, la lettre P héritait
   de sa cote à 10 000. */
function pastilles(zone, q, loi, cotes, choisi) {
  var box = document.createElement('div');
  box.className = 'chips' + (q.cle === 'lettre' ? ' lettres' : '') + (q.cle === 'date' ? ' dates' : '');

  optionsDe(q.cle).forEach(function (o) {
    var patate = (q.cle === 'sexe' && o.v === 'P');
    var impossible = !patate && (loi[o.v] === undefined || loi[o.v] < 1e-9);
    var b = document.createElement('button');
    b.className = 'chip' + (impossible ? ' off' : '') + (patate ? ' patate' : '')
      + ((o.v === 'avant' || o.v === 'apres') ? ' balai' : '');
    b.dataset.v = o.v;
    b.innerHTML = '<span class="lbl">' + o.l + '</span><span class="cote">'
      + (impossible ? '—' : stvFmtCote(patate ? STV_COTE_PATATE : cotes[o.v])) + '</span>';
    if (String(choisi) === String(o.v)) b.setAttribute('aria-pressed', 'true');
    b.onclick = function () {
      if (impossible) return expliquerImpossible(q.cle);
      choisir(q.cle, o.v);
    };
    box.appendChild(b);
  });
  zone.appendChild(box);
}

/* Jauge du poids : la pastille se pose au MILIEU de sa tranche, les
   graduations marquent les bornes entre tranches. */
function jaugePoids(zone, cotes, choisi) {
  var opts = optionsDe('poids');
  var i = indexDe(opts, choisi);
  var pose = (i >= 0);
  if (!pose) i = Math.floor(opts.length / 2);

  zone.innerHTML =
      '<div class="curseur poids' + (pose ? '' : ' vierge') + '">'
    +   '<div class="piste"><div class="pastille-c" style="left:' + centre(i, opts.length) + '%"></div></div>'
    +   '<input type="range" min="0" max="' + (opts.length - 1) + '" step="1" value="' + i + '" aria-label="Poids">'
    + '</div>'
    + bornesPoids(opts.length)
    + '<div class="jauge-bornes"><span>🫛 petit poids</span><span>pilier du Stade Toulousain 🏉</span></div>'
    + '<div class="choix-ligne avec-icone">'
    +   '<span class="icone-poids" style="--p:' + echelle(i, opts.length) + '">' + poidsSVG() + '</span>'
    +   '<span class="choix-val">' + (pose ? opts[i].l : 'Fais glisser le curseur') + '</span>'
    +   (pose ? '<span class="choix-cote">cote ' + stvFmtCote(cotes[opts[i].v]) + '</span>' : '')
    + '</div>'
    + '<p class="qhint regle-borne">Le poids annoncé est arrondi à la centaine de grammes la '
    +   'plus proche, puis on regarde la tranche. 3 250 g devient 3,3 kg et tombe donc dans '
    +   '« 3,2 kg – 3,3 kg ».</p>';

  brancherCurseur(zone, opts, 'poids', false);
}

function bornesPoids(n) {
  var h = '<div class="gradus">';
  stvBornes(CFG.poids_bornes).forEach(function (g, j) {
    h += '<span class="gradu" style="left:' + (((j + 1) / n) * 100).toFixed(2) + '%"><i></i>'
       + '<em>' + (g / 1000).toFixed(1).replace('.', ',') + '</em></span>';
  });
  return h + '</div>';
}

/* Jauge verticale de la taille, avec le bébé qui grandit à côté. */
function jaugeTaille(zone, cotes, choisi) {
  var opts = optionsDe('taille');
  var i = indexDe(opts, choisi);
  var pose = (i >= 0);
  if (!pose) i = Math.floor(opts.length / 2);

  var bt = stvBornes(CFG.taille_bornes);
  var bas = bt[0] - 2, haut = bt[bt.length - 1] + 2;
  var k = (0.58 + (opts[i].valeur - bas) / (haut - bas) * 0.60).toFixed(3);

  var gradus = '';
  opts.forEach(function (o, j) {
    var lab = o.v === 'lt' ? '–' : o.v === 'gt' ? '+' : String(o.v);
    gradus += '<span class="gradu-v" style="bottom:' + centre(j, opts.length) + '%"><i></i><em>' + lab + '</em></span>';
  });

  zone.innerHTML =
      '<div class="taille-legende">déjà grand ↑</div>'
    + '<div class="taille-wrap">'
    +   '<div class="curseur-v' + (pose ? '' : ' vierge') + '">'
    +     '<div class="gradus-v">' + gradus + '</div>'
    +     '<div class="piste-v"><div class="pastille-c" style="bottom:' + centre(i, opts.length) + '%"></div></div>'
    +     '<input type="range" min="0" max="' + (opts.length - 1) + '" step="1" value="' + i + '" aria-label="Taille">'
    +   '</div>'
    +   '<div class="bebe-box"><div class="bebe" style="--k:' + k + '">' + bebeSVG(R.sexe) + '</div></div>'
    + '</div>'
    + '<div class="taille-legende">format Paolini ↓</div>'
    + '<div class="choix-ligne">'
    +   '<span class="choix-val">' + (pose ? opts[i].l : 'Fais glisser le curseur') + '</span>'
    +   (pose ? '<span class="choix-cote">cote ' + stvFmtCote(cotes[opts[i].v]) + '</span>' : '')
    + '</div>';

  brancherCurseur(zone, opts, 'taille', true);
}

function brancherCurseur(zone, opts, cle, vertical) {
  var input = zone.querySelector('input[type=range]');
  var pastille = zone.querySelector('.pastille-c');
  var val = zone.querySelector('.choix-val');
  var cadre = zone.querySelector(vertical ? '.curseur-v' : '.curseur');

  input.oninput = function () {
    var j = Number(input.value);
    pastille.style[vertical ? 'bottom' : 'left'] = centre(j, opts.length) + '%';
    val.textContent = opts[j].l;
    cadre.classList.remove('vierge');
  };
  input.onchange = function () { choisir(cle, opts[Number(input.value)].v); };
}

/* Horloge de 24 heures. Les heures pleines sont posées sur le pourtour, comme
   un cadran ; chaque quartier ne porte que sa cote ; le créneau choisi
   s'affiche en entier au centre, sur deux lignes pour tenir dans le cercle. */
function horloge(zone, cotes, choisi) {
  var R0 = 58, R1 = 100, cx = 130, cy = 130, s = '';

  // Le quartier choisi est dessiné en dernier, pour que son contour passe
  // par-dessus ceux de ses voisins.
  var ordre = STV_CRENEAUX.filter(function (c) { return c.cle !== choisi; })
    .concat(STV_CRENEAUX.filter(function (c) { return c.cle === choisi; }));

  ordre.forEach(function (c) {
    var a0 = c.debut / 24 * 360 - 90, a1 = c.fin / 24 * 360 - 90;
    s += '<path class="quartier' + (choisi === c.cle ? ' sel' : '') + '" data-v="' + c.cle
       + '" d="' + arc(cx, cy, R0, R1, a0, a1) + '" fill="' + c.couleur + '"></path>';
    var am = (a0 + a1) / 2 * Math.PI / 180, rm = (R0 + R1) / 2;
    s += '<text class="q-cote' + (c.nuit ? ' clair' : '') + '" x="' + (cx + rm * Math.cos(am)).toFixed(1)
       + '" y="' + (cy + rm * Math.sin(am) + 5).toFixed(1) + '">' + stvFmtCote(cotes[c.cle]) + '</text>';

    // l'heure pleine, à l'extérieur, au début de chaque quartier
    var ab = a0 * Math.PI / 180, re = R1 + 15;
    s += '<text class="h-rim" x="' + (cx + re * Math.cos(ab)).toFixed(1) + '" y="'
       + (cy + re * Math.sin(ab) + 4).toFixed(1) + '">' + c.debut + 'h</text>';
  });

  var centreTxt;
  if (choisi) {
    var cr = STV_CRENEAUX.filter(function (x) { return x.cle === choisi; })[0];
    var fin = (cr.fin - 1) + 'h59';
    centreTxt = '<text class="h-petit" x="130" y="111">de</text>'
      + '<text class="h-centre" x="130" y="133">' + cr.debut + 'h à ' + fin + '</text>'
      + '<text class="h-petit" x="130" y="153">ton pari</text>';
  } else {
    centreTxt = '<text class="h-petit" x="130" y="126">choisis</text>'
      + '<text class="h-petit" x="130" y="142">un quartier</text>';
  }

  zone.innerHTML = '<div class="horloge"><svg viewBox="0 0 260 260">' + s
    + '<circle cx="130" cy="130" r="' + (R0 - 2) + '" fill="var(--card)"/>' + centreTxt
    + '</svg></div>';

  zone.querySelectorAll('.quartier').forEach(function (p) {
    p.onclick = function () { choisir('heure', p.dataset.v); };
  });
}

function arc(cx, cy, r0, r1, a0, a1) {
  var d = Math.PI / 180;
  var p = function (r, a) { return (cx + r * Math.cos(a * d)) + ' ' + (cy + r * Math.sin(a * d)); };
  var g = (a1 - a0) > 180 ? 1 : 0;
  return 'M' + p(r1, a0) + 'A' + r1 + ' ' + r1 + ' 0 ' + g + ' 1 ' + p(r1, a1)
       + 'L' + p(r0, a1) + 'A' + r0 + ' ' + r0 + ' 0 ' + g + ' 0 ' + p(r0, a0) + 'Z';
}

function libelleCreneau(cle) {
  var c = STV_CRENEAUX.filter(function (x) { return x.cle === cle; })[0];
  return c ? c.libelle : (cle || '');
}

/* Le bébé prend la couleur du pari : rose, bleu, ou ambre avant le choix. */
function bebeSVG(sexe) {
  var couleur = sexe === 'F' ? '#E5578C' : sexe === 'G' ? '#2F7FD4' : '#D9A31E';
  var coiffe = sexe === 'F'
    ? '<path d="M62 22c5-6 15-5 16 3 1 6-5 10-11 8" fill="none" stroke="#E5578C" stroke-width="4" stroke-linecap="round"/>'
    : sexe === 'G'
      ? '<path d="M44 22c4-11 14-9 16-3" fill="none" stroke="#5A4033" stroke-width="4" stroke-linecap="round"/>'
      : '';
  return '<svg viewBox="0 0 90 150" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">'
    + '<ellipse cx="45" cy="144" rx="30" ry="5" fill="#17251F" opacity=".10"/>'
    + '<path d="M20 140c0-38 8-62 25-62s25 24 25 62z" fill="' + couleur + '" opacity=".85"/>'
    + '<circle cx="45" cy="52" r="27" fill="#F2D7BE"/>'
    + '<path d="M21 42c5-15 15-22 24-22s19 7 24 22c-8-6-16-5-24-5s-16-1-24 5z" fill="#5A4033"/>'
    + coiffe
    + '<circle cx="35" cy="53" r="3" fill="#17251F"/><circle cx="55" cy="53" r="3" fill="#17251F"/>'
    + '<circle cx="26" cy="61" r="4.5" fill="#E39A9A" opacity=".5"/><circle cx="64" cy="61" r="4.5" fill="#E39A9A" opacity=".5"/>'
    + '<path d="M38 65q7 6 14 0" stroke="#17251F" stroke-width="2.4" fill="none" stroke-linecap="round"/>'
    + '</svg>';
}

/* Un poids de balance à l'ancienne, qui grossit avec la tranche. */
function poidsSVG() {
  return '<svg viewBox="0 0 60 72" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">'
    + '<path d="M13 26h34a4 4 0 0 1 4 4v32a5 5 0 0 1-5 5H14a5 5 0 0 1-5-5V30a4 4 0 0 1 4-4z" fill="none" stroke="currentColor" stroke-width="4"/>'
    + '<ellipse cx="30" cy="25" rx="21" ry="6" fill="none" stroke="currentColor" stroke-width="4"/>'
    + '<ellipse cx="30" cy="19" rx="14" ry="5" fill="none" stroke="currentColor" stroke-width="4"/>'
    + '</svg>';
}

function echelle(i, n) { return (0.46 + (i / (n - 1)) * 0.74).toFixed(3); }
function centre(i, n)  { return (((i + 0.5) / n) * 100).toFixed(2); }

function indexDe(opts, v) {
  if (v === null || v === undefined) return -1;
  for (var i = 0; i < opts.length; i++) if (String(opts[i].v) === String(v)) return i;
  return -1;
}


/* --------------------------------------------------------------------------
   Textes contextuels et mises
   -------------------------------------------------------------------------- */

function contexte(d, q, loi) {
  var e = d.querySelector('.extra');
  e.textContent = '';

  if (q.cle === 'sexe' && R.sexe === 'P') {
    e.textContent = 'Bien tenté, mais l\'échographie est formelle : Steevie n\'est pas un '
      + 'tubercule. Choisis entre fille ou garçon pour poursuivre le jeu.';
  }
  if (q.cle === 'date' && R.date) {
    var signe = stvSigneSolaire(stvDateReelle(CFG, R.date));
    e.textContent = 'Ton pronostic donne un ' + signe
      + '. Et s\'il ou elle était né à Singapour, ce serait un Cheval de Feu !';
  }
  if (q.cle === 'ascendant') {
    var possibles = Object.keys(loi).filter(function (k) { return loi[k] > 1e-9; });
    if (!R.heure) e.textContent = 'Choisis d\'abord un créneau horaire : il détermine les ascendants possibles.';
    else if (R.ascendant) e.innerHTML = '<strong>' + R.ascendant + '</strong> — ' + STV_CARACTERES[R.ascendant]
      + '. Avec ton créneau, seuls ' + possibles.join(', ') + ' sont possibles ; les autres sont grisés.';
    else e.textContent = 'Ton créneau de ' + libelleCreneau(R.heure) + ' ne peut donner que : '
      + possibles.join(', ') + '. Les autres sont grisés.';
  }
}

function expliquerImpossible(cle) {
  if (cle !== 'ascendant') return;
  var e = $('q-ascendant').querySelector('.extra');
  e.classList.add('rouge');
  e.textContent = 'Impossible avec ton créneau : à cette heure-là, ce signe n\'est pas à '
    + 'l\'horizon. Change de créneau horaire pour le rendre accessible.';
  setTimeout(function () { e.classList.remove('rouge'); rafraichir(); }, 6000);
}

function majMise(d, q) {
  var mise = MISES[q.cle] || 0;
  var patate = CALC.patate;
  d.querySelector('.val').textContent = mise + ' jeton' + (mise > 1 ? 's' : '');
  var cote = CALC.cotes[q.cle];
  d.querySelector('.gain').textContent = (mise && cote)
    ? 'rapporte ' + Math.round(mise * cote).toLocaleString('fr-FR') + ' pts' : '';
  d.querySelector('[data-d="-5"]').disabled = mise <= 0 || patate;
  d.querySelector('[data-d="5"]').disabled = restant() <= 0 || !choisiDe(q.cle) || patate;
}

function bouger(cle, dv) {
  if (CALC && CALC.patate) return;
  var v = Math.max(0, (MISES[cle] || 0) + dv);
  if (dv > 0 && restant() <= 0) return;
  MISES[cle] = v;
  show('manques', false);
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

function majSolde() {
  if (R.sexe === 'P') {
    $('solde-jetons').textContent = 'Choisis fille ou garçon pour continuer';
    $('solde-gain').textContent = 'Le tubercule n\'est pas une option';
    $('solde').classList.remove('plein');
    return;
  }
  var r = restant(), manque = manquantes();
  $('solde-jetons').textContent = manque.length
    ? manque.length + ' réponse' + (manque.length > 1 ? 's' : '') + ' à donner'
      + (r > 0 ? ', ' + r + ' jetons à placer' : '')
    : (r > 0 ? r + ' jeton' + (r > 1 ? 's' : '') + ' à placer' : 'Tout est prêt');
  var g = gainMaximum();
  $('solde-gain').textContent = g ? 'Gain maximum : ' + g.toLocaleString('fr-FR') + ' pts' : 'Place tes jetons pour voir ton gain';
  $('solde').classList.toggle('plein', !manque.length && r === 0);
}


/* --------------------------------------------------------------------------
   Contrôle avant validation
   -------------------------------------------------------------------------- */

/* Les questions sans réponse. */
function manquantes() {
  return QUESTIONS.filter(function (q) { return !choisiDe(q.cle); });
}

function listeFr(mots) {
  if (mots.length <= 1) return mots.join('');
  return mots.slice(0, -1).join(', ') + ' et ' + mots[mots.length - 1];
}

function verifier() {
  QUESTIONS.forEach(function (q) { $('q-' + q.cle).classList.remove('manque'); });

  if (R.sexe === 'P') {
    $('manques').innerHTML = '<p>Bien tenté, mais l\'échographie est formelle : Steevie n\'est '
      + 'pas un tubercule. Choisis entre fille ou garçon pour poursuivre le jeu.</p>';
    show('manques', true);
    $('q-sexe').classList.add('manque');
    $('q-sexe').scrollIntoView({ behavior: 'smooth', block: 'center' });
    return false;
  }

  var manque = manquantes(), r = restant(), lignes = [];

  QUESTIONS.forEach(function (q) { $('q-' + q.cle).classList.remove('manque'); });

  if (manque.length) {
    lignes.push('Il te manque ' + (manque.length === 1 ? 'une réponse' : manque.length + ' réponses')
      + ' : ' + listeFr(manque.map(function (q) { return q.court; })) + '.');
    manque.forEach(function (q) { $('q-' + q.cle).classList.add('manque'); });
  }
  if (r > 0) lignes.push('Il te reste ' + r + ' jeton' + (r > 1 ? 's' : '') + ' à placer.');

  if (!lignes.length) { show('manques', false); return true; }

  $('manques').innerHTML = lignes.map(function (l) { return '<p>' + l + '</p>'; }).join('');
  show('manques', true);
  var cible = manque.length ? $('q-' + manque[0].cle) : $('manques');
  cible.scrollIntoView({ behavior: 'smooth', block: 'center' });
  return false;
}


/* ============================================================================
   Brouillon : les réponses non validées survivent à la fermeture de la page
   ============================================================================ */

function sauverBrouillon() {
  if (NIVEAU === 'fini') return;
  try { localStorage.setItem('steevie-brouillon-' + TOKEN, JSON.stringify({ R: R, M: MISES })); } catch (e) {}
}

function chargerBrouillon() {
  try {
    var b = JSON.parse(localStorage.getItem('steevie-brouillon-' + TOKEN) || 'null');
    if (b) { R = b.R || {}; MISES = b.M || {}; }
  } catch (e) {}
}


/* ============================================================================
   Enregistrement et ticket
   ============================================================================ */

$('btn-save').onclick = function () {
  if (!verifier()) return;

  $('btn-save').disabled = true;
  $('btn-save').textContent = '…';

  envoyer({ action: 'prono', reponses: R, mises: MISES })
    .then(function (d) {
      $('btn-save').disabled = false;
      $('btn-save').textContent = 'Valider';
      if (!d.ok) {
        $('manques').innerHTML = '<p>' + d.error + '</p>';
        show('manques', true);
        return;
      }
      R = d.prono.reponses; MISES = d.prono.mises;
      try { localStorage.removeItem('steevie-brouillon-' + TOKEN); } catch (e) {}
      avancer('fini');
      montrerTicket(d.prono);
    })
    .catch(function () {
      $('btn-save').disabled = false;
      $('btn-save').textContent = 'Valider';
      $('manques').innerHTML = '<p>Connexion impossible. Réessaie.</p>';
      show('manques', true);
    });
};

function allerTicket() {
  montrerTicket({ reponses: R, mises: MISES, cotes: (CALC || stvCalculer(CFG, R)).cotes });
}

function montrerTicket(prono) {
  etape('s-ticket', 'ticket');
  dessinerTicket($('ticket-canvas'), CFG, MOI.pseudo, prono, QUESTIONS);
  show('btn-edit', PHASE === 'open');
}

$('btn-edit').onclick = function () { allerFormulaire(); };
$('btn-share').onclick = function () { partagerTicket($('ticket-canvas'), MOI.pseudo); };


/* ============================================================================
   Renvoi du lien
   ============================================================================ */

$('btn-resend').onclick = function () {
  var mail = $('email').value.trim();
  if (!mail) { $('resend-msg').textContent = 'Saisis une adresse.'; return; }
  $('btn-resend').disabled = true;
  fetch(API + '?action=resend&email=' + encodeURIComponent(mail))
    .then(function (r) { return r.json(); })
    .then(function () { $('resend-msg').textContent = 'Si cette adresse est connue, le lien vient de partir. Pense aux spams.'; })
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
  var p = String(iso).split('-'), j = Number(p[2]);
  return (j === 1 ? '1er' : j) + ' ' + MOIS[Number(p[1]) - 1] + ' ' + p[0];
}

var MOIS_COURTS = ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.',
                   'août', 'sept.', 'oct.', 'nov.', 'déc.'];

function courteDate(iso) {
  var p = String(iso).split('-'), j = Number(p[2]);
  return (j === 1 ? '1er' : j) + ' ' + MOIS_COURTS[Number(p[1]) - 1];
}
