/* ============================================================================
   app.js — l'orchestration de la page
   ============================================================================ */

var API = 'https://script.google.com/macros/s/AKfycbyBXnXpeNue6dRV0qfl2egpbkUmIYx3z-52B_bfSv-XsfOOH-JZ6vXlzE93I8ehTBRufA/exec';

var TOKEN = new URLSearchParams(location.search).get('t') || '';

var CFG = null;          // paramètres venus de l'onglet Config
var MOI = null;          // { prenom, pseudo }
var PHASE = 'open';
var R = {};              // mes réponses
var MISES = {};          // mes mises en jetons
var CALC = null;         // lois + cotes courantes

var QUESTIONS = [
  { cle: 'sexe',      titre: 'Fille ou garçon',            indice: '' },
  { cle: 'date',      titre: 'Le jour de la naissance',    indice: '' },
  { cle: 'poids',     titre: 'Le poids',                   indice: 'Les cotes changent selon le sexe que tu as choisi.' },
  { cle: 'taille',    titre: 'La taille',                  indice: '' },
  { cle: 'lettre',    titre: 'La première lettre du prénom', indice: '' },
  { cle: 'top100',    titre: 'Le prénom sera-t-il dans le top 100 de l\'INSEE ?', indice: '' },
  { cle: 'heure',     titre: 'Le créneau horaire',         indice: '' },
  { cle: 'ascendant', titre: 'L\'ascendant',               indice: '' },
  { cle: 'chevelu',   titre: 'La chevelure',               indice: 'C\'est subjectif, les parents trancheront à l\'arrivée. Photo à l\'appui.' }
];

var $ = function (id) { return document.getElementById(id); };
var show = function (id, on) { $(id).classList.toggle('hidden', !on); };


/* ============================================================================
   Démarrage
   ============================================================================ */

if (!TOKEN) {
  show('s-load', false);
  show('s-lost', true);
} else {
  fetch(API + '?action=me&t=' + encodeURIComponent(TOKEN))
    .then(function (r) { return r.json(); })
    .then(demarrer)
    .catch(function () { show('s-load', false); show('s-lost', true); });
}

function demarrer(d) {
  show('s-load', false);
  if (!d.ok) { show('s-lost', true); return; }

  CFG = d.config;
  PHASE = d.phase;
  MOI = { prenom: d.prenom, pseudo: d.pseudo || '' };

  $('terme').innerHTML = 'Terme selon les organisateurs : ' + jolieDate(CFG.terme_affiche)
    + '<br>Selon la police : ' + jolieDate(CFG.terme);

  $('mes-papa').textContent = CFG.papa_poids + ' g · ' + CFG.papa_taille + ' cm';
  $('mes-maman').textContent = CFG.maman_poids + ' g · ' + CFG.maman_taille + ' cm';

  if (d.prono) {
    R = d.prono.reponses;
    MISES = d.prono.mises;
  }

  $('hello').textContent = 'Bonjour ' + d.prenom;

  if (!MOI.pseudo) { show('s-pseudo', true); return; }
  apresPseudo();
}

function apresPseudo() {
  if (localStorage.getItem('steevie-quiz') === 'fait' || Object.keys(R).length) {
    devoilerParents();
    ouvrirFormulaire();
  } else {
    show('s-quiz', true);
    construireQuiz();
  }
  chargerBoard();
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
   Quiz des parents
   ============================================================================ */

var quizFaits = 0;

function construireQuiz() {
  var qs = [
    { t: 'Combien pesait papa à sa naissance ?',
      opts: melange([CFG.papa_poids, CFG.papa_poids - 500, CFG.papa_poids + 600]).map(function (v) {
        return { v: v, l: (v / 1000).toFixed(2).replace('.', ',') + ' kg' }; }),
      bon: CFG.papa_poids },
    { t: 'Et maman, combien mesurait-elle ?',
      opts: melange([CFG.maman_taille, CFG.maman_taille + 3, CFG.maman_taille - 2]).map(function (v) {
        return { v: v, l: v + ' cm' }; }),
      bon: CFG.maman_taille },
    { t: 'Lequel des deux est né le plus tôt ?',
      opts: [{ v: 'papa', l: 'Papa' }, { v: 'maman', l: 'Maman' }],
      bon: CFG.quiz_ne_plus_tot }
  ];

  var box = $('quiz-questions');
  box.innerHTML = '';

  qs.forEach(function (q, i) {
    var d = document.createElement('div');
    d.className = 'quizq';
    d.innerHTML = '<label class="q">' + q.t + '</label><div class="chips"></div>'
                + '<div class="verdict"></div>';
    var chips = d.querySelector('.chips');

    q.opts.forEach(function (o) {
      var b = document.createElement('button');
      b.className = 'chip';
      b.style.paddingBottom = '10px';
      b.textContent = o.l;
      b.onclick = function () {
        if (d.dataset.repondu) return;
        d.dataset.repondu = '1';
        var bon = String(o.v) === String(q.bon);
        var v = d.querySelector('.verdict');
        v.className = 'verdict ' + (bon ? 'bon' : 'faux');
        v.textContent = bon ? 'Bien vu.' : 'Raté, c\'était ' + libelleBon(q);
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
   Formulaire
   ============================================================================ */

function ouvrirFormulaire() {
  if (PHASE !== 'open') { montrerTicketSiPossible(); return; }
  show('s-form', true);
  show('solde', true);
  construireQuestions();
  rafraichir();
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
      + (q.indice ? '<p class="qhint">' + q.indice + '</p>' : '')
      + '<div class="chips ' + (q.cle === 'lettre' ? 'lettres' : '') + '"></div>'
      + '<div class="extra qhint" style="margin-top:10px"></div>'
      + '<div class="mise">'
      +   '<button data-d="-5">−</button>'
      +   '<span class="val">0</span>'
      +   '<button data-d="5">+</button>'
      +   '<span class="gain"></span>'
      + '</div>';

    d.querySelectorAll('.mise button').forEach(function (b) {
      b.onclick = function () { bouger(q.cle, Number(b.dataset.d)); };
    });
    box.appendChild(d);
  });
}

/* Les options de chaque question, reconstruites à chaque changement puisque
   certaines dépendent des réponses précédentes. */
function optionsDe(cle) {
  var i, out = [];
  if (cle === 'sexe') return [{ v: 'F', l: 'Une fille' }, { v: 'G', l: 'Un garçon' }];

  if (cle === 'date') {
    for (i = CFG.date_min; i <= CFG.date_max; i++) {
      var iso = stvJourVersDate(CFG, i);
      out.push({ v: String(i), l: courteDate(iso) });
    }
    return out;
  }
  if (cle === 'poids')  return stvTranchesPoids(CFG).map(function (t) { return { v: t.cle, l: t.libelle }; });
  if (cle === 'taille') return stvTranchesTaille(CFG).map(function (t) { return { v: t.cle, l: t.libelle }; });
  if (cle === 'lettre') {
    for (i = 65; i <= 90; i++) out.push({ v: String.fromCharCode(i), l: String.fromCharCode(i) });
    return out;
  }
  if (cle === 'top100') return [{ v: 'oui', l: 'Oui, un classique' }, { v: 'non', l: 'Non, plus rare' }];
  if (cle === 'heure')  return STV_CRENEAUX.map(function (c) { return { v: c.cle, l: c.cle }; });
  if (cle === 'ascendant') return STV_SIGNES.map(function (s) { return { v: s, l: s }; });
  if (cle === 'chevelu') return STV_CHEVELU.map(function (c) { return { v: c.cle, l: c.libelle }; });
  return out;
}

function rafraichir() {
  CALC = stvCalculer(CFG, R);

  QUESTIONS.forEach(function (q) {
    var d = $('q-' + q.cle);
    if (!d) return;
    var chips = d.querySelector('.chips');
    var loi = CALC.lois[q.cle];
    var cotes = stvCotesOptions(CFG, loi);
    var choisi = q.cle === 'date' ? (R.date ? String(stvDateVersJour(CFG, R.date)) : null) : R[q.cle];

    chips.innerHTML = '';
    optionsDe(q.cle).forEach(function (o) {
      var b = document.createElement('button');
      var impossible = (loi[o.v] === undefined || loi[o.v] < 1e-9);
      b.className = 'chip' + (impossible ? ' off' : '');
      b.dataset.v = o.v;
      b.innerHTML = '<span>' + o.l + '</span>'
                  + '<span class="cote">' + (impossible ? '—' : stvFmtCote(cotes[o.v])) + '</span>';
      if (String(choisi) === String(o.v)) b.setAttribute('aria-pressed', 'true');

      b.onclick = function () {
        if (impossible) { expliquerImpossible(q.cle, d); return; }
        if (q.cle === 'date') R.date = stvJourVersDate(CFG, Number(o.v));
        else R[q.cle] = o.v;
        rafraichir();
      };
      chips.appendChild(b);
    });

    // Textes contextuels
    var extra = d.querySelector('.extra');
    extra.textContent = '';
    if (q.cle === 'date' && R.date) {
      extra.textContent = 'Ton pronostic donne un ' + stvSigneSolaire(R.date)
        + '. Et de toute façon, un Cheval de Feu : l\'année court jusqu\'au 5 février 2027, '
        + 'et elle ne revient que tous les soixante ans.';
    }
    if (q.cle === 'ascendant') {
      var possibles = Object.keys(loi).filter(function (k) { return loi[k] > 1e-9; });
      extra.textContent = R.heure
        ? 'L\'ascendant change toutes les deux heures. Ton créneau de ' + R.heure
          + ' ne peut donner que : ' + possibles.join(', ') + '. Les autres sont grisés.'
        : 'Choisis d\'abord un créneau horaire : il détermine les ascendants possibles.';
    }

    // Mise
    var mise = MISES[q.cle] || 0;
    d.querySelector('.val').textContent = mise + ' jeton' + (mise > 1 ? 's' : '');
    var cote = CALC.cotes[q.cle];
    d.querySelector('.gain').textContent = (mise && cote)
      ? 'rapporte ' + Math.round(mise * cote) + ' pts' : '';
    d.querySelector('[data-d="-5"]').disabled = mise <= 0;
    d.querySelector('[data-d="5"]').disabled = restant() <= 0 || !R[q.cle];
  });

  majSolde();
}

function expliquerImpossible(cle, d) {
  if (cle !== 'ascendant') return;
  var e = d.querySelector('.extra');
  e.style.color = '#A33';
  e.textContent = 'Cet ascendant est impossible avec le créneau que tu as choisi. '
    + 'L\'ascendant est le signe qui se lève à l\'horizon au moment de la naissance : '
    + 'il tourne avec la Terre et change toutes les deux heures environ. '
    + 'Pour le prendre, change de créneau horaire.';
  setTimeout(function () { e.style.color = ''; rafraichir(); }, 6000);
}

function bouger(cle, d) {
  var v = (MISES[cle] || 0) + d;
  if (v < 0) v = 0;
  if (d > 0 && restant() <= 0) return;
  MISES[cle] = v;
  rafraichir();
}

function totalMise() {
  var s = 0;
  for (var k in MISES) s += MISES[k];
  return s;
}

function restant() { return CFG.jetons - totalMise(); }

function majSolde() {
  var r = restant(), complet = (r === 0) && toutesRepondues();
  $('solde-txt').textContent = r === 0
    ? (toutesRepondues() ? 'Tous les jetons placés' : 'Jetons placés, mais il manque des réponses')
    : r + ' jeton' + (r > 1 ? 's' : '') + ' à placer';
  $('solde').classList.toggle('plein', complet);
  $('btn-save').disabled = !complet;
}

function toutesRepondues() {
  for (var i = 0; i < QUESTIONS.length; i++) {
    var c = QUESTIONS[i].cle;
    if ((MISES[c] || 0) > 0 && !R[c]) return false;
  }
  return true;
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
      R = d.prono.reponses; MISES = d.prono.mises;
      show('s-form', false);
      show('solde', false);
      montrerTicket(d.prono);
      chargerBoard();
    })
    .catch(function () {
      $('btn-save').textContent = 'Valider';
      $('btn-save').disabled = false;
      $('form-err').textContent = 'Connexion impossible. Réessaie.';
      show('form-err', true);
    });
};

function montrerTicketSiPossible() {
  if (Object.keys(R).length) montrerTicket({ reponses: R, mises: MISES, cotes: (CALC || stvCalculer(CFG, R)).cotes });
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
   Vue collective
   ============================================================================ */

function chargerBoard() {
  fetch(API + '?action=board')
    .then(function (r) { return r.json(); })
    .then(function (d) {
      if (!d.ok || !d.entries.length) return;
      PHASE = d.phase;
      show('s-board', true);
      $('board-sub').textContent = d.entries.length + ' pronostic'
        + (d.entries.length > 1 ? 's' : '') + ' enregistré'
        + (d.entries.length > 1 ? 's' : '') + '. '
        + (d.phase === 'revealed' ? 'Tout est ouvert.' : 'Touche une barre pour voir qui a parié là.');

      dessinerDistributions(d.entries);

      if (d.phase === 'revealed' && d.resultat) montrerResultat(d);
    })
    .catch(function () {});
}

function dessinerDistributions(entries) {
  var box = $('distributions');
  box.innerHTML = '';

  QUESTIONS.forEach(function (q) {
    var opts = optionsDe(q.cle);
    var comptes = {}, quiOu = {};
    entries.forEach(function (e) {
      var v = e.reponses[q.cle];
      if (!v) return;
      if (q.cle === 'date') v = String(stvDateVersJour(CFG, v));
      comptes[v] = (comptes[v] || 0) + 1;
      (quiOu[v] = quiOu[v] || []).push(e.pseudo);
    });

    var max = 0;
    for (var k in comptes) max = Math.max(max, comptes[k]);
    if (!max) return;

    var d = document.createElement('div');
    d.className = 'dist';

    var top = null;
    for (var k2 in comptes) if (!top || comptes[k2] > comptes[top]) top = k2;
    var libTop = '';
    opts.forEach(function (o) { if (String(o.v) === String(top)) libTop = o.l; });

    d.innerHTML = '<h3>' + q.titre + '</h3>'
      + '<p class="tendance">La famille penche pour : <strong>' + libTop + '</strong></p>';

    var monChoix = q.cle === 'date'
      ? (R.date ? String(stvDateVersJour(CFG, R.date)) : null)
      : R[q.cle];

    opts.forEach(function (o) {
      var n = comptes[o.v] || 0;
      if (!n) return;
      var b = document.createElement('div');
      b.className = 'bar'
        + (String(monChoix) === String(o.v) ? ' moi' : '')
        + (q.cle === 'sexe' ? (o.v === 'F' ? ' f' : ' m') : '');
      b.innerHTML = '<span class="lab">' + o.l + '</span>'
        + '<span class="track"><span class="fill" style="width:' + (n / max * 100) + '%"></span></span>'
        + '<span class="n">' + n + '</span>'
        + '<span class="qui">' + (quiOu[o.v] || []).join(', ') + '</span>';
      b.onclick = function () { b.classList.toggle('ouvert'); };
      d.appendChild(b);
    });

    box.appendChild(d);
  });
}

function montrerResultat(d) {
  show('s-result', true);
  var r = d.resultat;
  $('result-title').textContent = r.prenom || 'Steevie est là';
  $('result-line').textContent = 'Né' + (r.sexe === 'F' ? 'e' : '') + ' le ' + jolieDate(r.date) + '.';

  var lignes = d.entries.map(function (e) {
    return { pseudo: e.pseudo, total: e.score || 0 };
  }).sort(function (a, b) { return b.total - a.total; });

  var t = '<table style="width:100%;border-collapse:collapse;margin-top:10px">';
  lignes.forEach(function (l, i) {
    t += '<tr><td style="padding:9px 4px;border-bottom:1px solid var(--rule)">'
      + (i + 1) + '. ' + l.pseudo + '</td>'
      + '<td style="padding:9px 4px;border-bottom:1px solid var(--rule);text-align:right;font-family:var(--mono)">'
      + l.total + ' pts</td></tr>';
  });
  $('classement').innerHTML = t + '</table>';
}


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
      $('resend-msg').textContent = 'Si cette adresse est sur la liste, le lien vient de partir. Pense au dossier spam.';
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
