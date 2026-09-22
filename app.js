/* ============================================================================
   app.js — l'orchestration de la page de pronostics
   ============================================================================ */

var TOKEN = new URLSearchParams(location.search).get('t') || '';
var VUE = new URLSearchParams(location.search).get('vue') || '';

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
  document.title = 'Accès personnel';
} else {
  fetch(API + '?action=me&t=' + encodeURIComponent(TOKEN))
    .then(function (r) { return r.json(); })
    .then(demarrer)
    .catch(function () { show('s-load', false); show('s-accueil', true); });
}

function demarrer(d) {
  show('s-load', false);
  if (!d.ok) { show('s-accueil', true); return; }

  show('entete', true);
  show('pied', true);
  CFG = d.config;
  PHASE = d.phase;
  MOI = { prenom: d.prenom, pseudo: d.pseudo || '' };

  $('mes-papa').innerHTML = enKg(CFG.papa_poids) + ' · ' + CFG.papa_taille + ' cm'
    + '<br>né à ' + CFG.papa_heure;
  $('mes-maman').innerHTML = enKg(CFG.maman_poids) + ' · ' + CFG.maman_taille + ' cm'
    + '<br>née à ' + CFG.maman_heure;

  $('form-sub').textContent = 'Huit questions, ' + CFG.jetons + ' jetons à '
    + 'répartir. Tu peux tout modifier jusqu\'au ' + jolieDate(CFG.cloture) + '.';

  $('lien-pronos').href = 'pronos.html?t=' + encodeURIComponent(TOKEN);
  $('lien-liste').href = 'liste.html?t=' + encodeURIComponent(TOKEN);
  $('lien-mots').href = 'mots.html?t=' + encodeURIComponent(TOKEN);
  show('lien-liste', String(CFG.liste_active) === 'oui');

  if (d.prono) {
    R = d.prono.reponses;
    MISES = d.prono.mises;
    DEJA_VALIDE = true;
  }

  $('hello').textContent = 'Bonjour ' + d.prenom;
  if (!MOI.pseudo) { show('s-pseudo', true); return; }
  apresPseudo();
}

/* Trois étapes qui s'enchaînent, une seule visible à la fois : les règles,
   puis les indices, puis les pronostics. Seul quelqu'un qui a déjà validé
   saute directement à son ticket. */
function etape(nom) {
  ['s-accueil', 's-pseudo', 's-regles', 's-quiz', 's-form', 's-ticket']
    .forEach(function (id) { show(id, id === nom); });
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function apresPseudo() {
  // La barre de navigation peut demander une vue précise.
  if (VUE === 'regles') { construireRegles(); etape('s-regles'); return; }
  if (VUE === 'ticket' && DEJA_VALIDE) { montrerTicketSiPossible(); return; }
  if (VUE === 'pronos') { ouvrirFormulaire(); return; }

  if (DEJA_VALIDE) { montrerTicketSiPossible(); return; }
  construireRegles();
  etape('s-regles');
}

/* Les indices ne se jouent qu'une fois. On retient l'info dans le navigateur,
   pour que quelqu'un qui rouvre son lien sans avoir validé n'ait pas à refaire
   le quiz, mais qu'un nouveau venu le voie bien passer. */
function quizDejaFait() {
  try { return localStorage.getItem('steevie-indices') === 'fait'; }
  catch (e) { return false; }
}

function noterQuizFait() {
  try { localStorage.setItem('steevie-indices', 'fait'); } catch (e) {}
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
  $('regles-cloture').textContent = 'Tu peux revenir modifier tes réponses '
    + 'autant que tu veux jusqu\'au ' + jolieDate(CFG.cloture) + ' au soir. '
    + 'Ensuite, tout se fige.';
}

$('btn-regles').onclick = function () {
  if (quizDejaFait()) { ouvrirFormulaire(); return; }
  construireQuiz();
  etape('s-quiz');
};

$('btn-revoir').onclick = function () {
  construireRegles();
  etape('s-regles');
  $('btn-regles').textContent = 'Retour à mes pronostics';
  $('btn-regles').onclick = function () { ouvrirFormulaire(); };
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

}

function libelleBon(q) {
  for (var i = 0; i < q.opts.length; i++) {
    if (String(q.opts[i].v) === String(q.bon)) return q.opts[i].l;
  }
  return '';
}

function finQuiz() {
  noterQuizFait();
  devoilerParents();
  show('btn-quiz-suite', true);
  $('parents').scrollIntoView({ behavior: 'smooth', block: 'center' });
}

function devoilerParents() {
  $('parents').classList.remove('voilees');
  $('parent-papa').classList.remove('cache');
  $('parent-maman').classList.remove('cache');
}

$('btn-quiz-suite').onclick = function () { ouvrirFormulaire(); };


/* ============================================================================
   Le formulaire
   ============================================================================ */

function ouvrirFormulaire() {
  if (PHASE !== 'open') { montrerFerme(); return; }
  etape('s-form');
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
    + 'à l\'horizon Est à la minute de la naissance. Il tourne avec la Terre et '
    + 'change toutes les deux heures environ, ce qui explique qu\'il dépende du '
    + 'créneau horaire choisi juste au-dessus.</p>';
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
  if (cle === 'heure') return STV_CRENEAUX.map(function (c) { return { v: c.cle, l: c.libelle }; });
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
    // La pomme de terre n'existe QUE sur la question du sexe. Sans ce test,
    // la lettre P héritait de sa cote à 10 000.
    var patate = (q.cle === 'sexe' && o.v === 'P');
    var impossible = !patate && (loi[o.v] === undefined || loi[o.v] < 1e-9);
    var b = document.createElement('button');
    b.className = 'chip' + (impossible ? ' off' : '') + (patate ? ' patate' : '');
    b.dataset.v = o.v;
    b.innerHTML = '<span class="lbl">' + o.l + '</span>'
      + '<span class="cote">' + (impossible ? '—'
          : stvFmtCote(patate ? STV_COTE_PATATE : cotes[o.v])) + '</span>';
    if (String(choisi) === String(o.v)) b.setAttribute('aria-pressed', 'true');
    b.onclick = function () {
      if (impossible) return expliquerImpossible(q.cle);
      choisir(q.cle, o.v);
    };
    box.appendChild(b);
  });
  zone.appendChild(box);
}

/* Jauge glissante du poids. La pastille se pose au MILIEU de la tranche, et
   les graduations marquent les bornes : on voit ainsi que 3,7 kg se situe
   entre 3,6 et 3,8, sans confusion possible. */
function jaugePoids(zone, q, loi, cotes, choisi) {
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
    + '<div class="jauge-bornes"><span>🦐 une crevette</span>'
    +   '<span>pilier du Stade Toulousain 🏉</span></div>'
    + '<div class="choix-ligne avec-icone">'
    +   '<span class="icone-poids" style="--p:' + echelle(i, opts.length) + '">' + poidsSVG() + '</span>'
    +   '<span class="choix-val">' + (pose ? opts[i].l : 'Fais glisser le curseur') + '</span>'
    +   (pose ? '<span class="choix-cote">cote ' + stvFmtCote(cotes[opts[i].v]) + '</span>' : '')
    + '</div>'
    + '<p class="qhint regle-borne">Le poids annoncé est arrondi à la centaine de '
    +   'grammes la plus proche, puis on regarde la tranche. 3 250 g devient 3,3 kg '
    +   'et tombe donc dans « 3,3 kg – 3,5 kg ».</p>';

  brancherCurseur(zone, opts, 'poids');
}

/* Les graduations tombent sur les bornes entre tranches, pas sur les tranches :
   la pastille se voit ainsi toujours à l'intérieur de sa tranche. */
function bornesPoids(n) {
  var b = stvBornes(CFG.poids_bornes);
  var h = '<div class="gradus">';
  b.forEach(function (g, j) {
    var x = ((j + 1) / n) * 100;
    h += '<span class="gradu" style="left:' + x.toFixed(2) + '%"><i></i>'
       + '<em>' + (g / 1000).toFixed(1).replace('.', ',') + '</em></span>';
  });
  return h + '</div>';
}

/* Jauge VERTICALE pour la taille, un bébé qui grandit à côté. L'input est
   pivoté d'un quart de tour : on garde le glissement et le clavier natifs. */
function jaugeTaille(zone, q, loi, cotes, choisi) {
  var opts = optionsDe('taille');
  var i = indexDe(opts, choisi);
  var pose = (i >= 0);
  if (!pose) i = indexDe(opts, String(Math.round(CFG['taille_moyenne_' + CALC.sexeUtilise])));
  if (i < 0) i = Math.floor(opts.length / 2);

  var bt = stvBornes(CFG.taille_bornes);
  var bas = bt[0] - 2, haut = bt[bt.length - 1] + 2;
  var cm = opts[i].valeur;
  var k = (0.58 + (cm - bas) / (haut - bas) * 0.60).toFixed(3);

  var gradus = '';
  opts.forEach(function (o, j) {
    var lab = o.cle === 'lt' ? '–' : o.cle === 'gt' ? '+' : String(o.cle);
    gradus += '<span class="gradu-v" style="bottom:' + centre(j, opts.length) + '%">'
            + '<i></i><em>' + lab + '</em></span>';
  });

  zone.innerHTML =
      '<div class="taille-wrap">'
    +   '<div class="curseur-v' + (pose ? '' : ' vierge') + '">'
    +     '<div class="piste-v"><div class="pastille-c" style="bottom:' + centre(i, opts.length) + '%"></div></div>'
    +     '<div class="gradus-v">' + gradus + '</div>'
    +     '<input type="range" min="0" max="' + (opts.length - 1) + '" step="1" value="' + i + '" aria-label="Taille">'
    +   '</div>'
    +   '<div class="bebe-box"><div class="bebe" style="--k:' + k + '">'
    +     bebeSVG(R.sexe) + '</div></div>'
    +   '<div class="taille-legende">'
    +     '<div class="borne-haut">déjà grand</div>'
    +     '<div class="borne-bas">tout petit</div>'
    +   '</div>'
    + '</div>'
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
  var piste = zone.querySelector(vertical ? '.curseur-v' : '.curseur');

  // Aperçu immédiat pendant le glissement, sans reconstruire toute la page.
  input.oninput = function () {
    var j = Number(input.value);
    pastille.style[vertical ? 'bottom' : 'left'] = centre(j, opts.length) + '%';
    val.textContent = opts[j].l;
    piste.classList.remove('vierge');
  };
  // Le vrai choix n'est enregistré qu'au relâchement.
  input.onchange = function () { choisir(cle, opts[Number(input.value)].v); };
}

/* Le centre de la tranche numéro i, en pourcentage de la piste. */
function centre(i, n) { return (((i + 0.5) / n) * 100).toFixed(2); }

function indexDe(opts, v) {
  if (v === null || v === undefined) return -1;
  for (var i = 0; i < opts.length; i++) if (String(opts[i].v) === String(v)) return i;
  return -1;
}

/* Le bébé prend la couleur du pari : rose, bleu, ou ambre tant que le sexe
   n'est pas choisi. La fille reçoit un nœud, le garçon une mèche rebelle. */
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
       + '" y="' + (cy + rm * Math.sin(am) - 4).toFixed(1) + '">' + c.libelle.replace(/ /g, '') + '</text>';
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

function libelleCreneau(cle) {
  for (var i = 0; i < STV_CRENEAUX.length; i++) {
    if (STV_CRENEAUX[i].cle === cle) return STV_CRENEAUX[i].libelle;
  }
  return cle || '';
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
    e.innerHTML = 'Bien tenté, mais l\'échographie est formelle : Steevie n\'est '
      + 'pas un tubercule. Choisis entre fille ou garçon pour poursuivre le jeu.';
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
  etape('s-ticket');
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
