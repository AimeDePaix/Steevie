/* ============================================================================
   admin.js — la console des parents
   ----------------------------------------------------------------------------
   La clé voyage dans l'URL ou dans le champ, et le serveur la vérifie à
   chaque appel. Ce n'est pas une authentification : c'est un secret partagé.
   Garde le lien privé, et mets une clé longue dans l'onglet Config.
   ============================================================================ */

var CLE = new URLSearchParams(location.search).get('k') || '';
var ETAT = null;

var $ = function (id) { return document.getElementById(id); };
var show = function (id, on) { $(id).classList.toggle('hidden', !on); };

var CHAMPS = [
  { cle: 'prenom',    label: 'Le prénom',        type: 'texte' },
  { cle: 'sexe',      label: 'Fille ou garçon',  type: 'choix', opts: [['F', 'Fille'], ['G', 'Garçon']] },
  { cle: 'date',      label: 'Le jour',          type: 'date' },
  { cle: 'poids',     label: 'Le poids en grammes', type: 'nombre', ph: '3400' },
  { cle: 'taille',    label: 'La taille en cm',  type: 'nombre', ph: '50' },
  { cle: 'lettre',    label: 'Première lettre',  type: 'texte', ph: 'L' },
  { cle: 'heure',     label: 'Le créneau',       type: 'choix', opts: [] },
  { cle: 'ascendant', label: 'L\'ascendant',     type: 'choix', opts: [] },
  { cle: 'coupe',     label: 'La coupe',         type: 'choix', opts: [] }
];

if (CLE) entrer(); else show('s-cle', true);

$('btn-cle').onclick = function () { CLE = $('cle').value.trim(); entrer(); };

function entrer() {
  show('cle-err', false);
  fetch(API + '?action=admin_etat&k=' + encodeURIComponent(CLE))
    .then(function (r) { return r.json(); })
    .then(function (d) {
      if (!d.ok) {
        show('s-cle', true);
        $('cle-err').textContent = 'Clé refusée.';
        show('cle-err', true);
        return;
      }
      ETAT = d;
      show('s-cle', false);
      ['s-etat', 's-resultat', 's-bilan', 's-gens', 's-messages', 's-envoi']
        .forEach(function (i) { show(i, true); });
      dessinerEtat();
      dessinerChamps();
      dessinerGens();
      dessinerMessages();
    })
    .catch(function () {
      show('s-cle', true);
      $('cle-err').textContent = 'Connexion impossible.';
      show('cle-err', true);
    });
}

function dessinerEtat() {
  $('stats').innerHTML =
      bloc(ETAT.joueurs, 'joueurs ont validé')
    + bloc(ETAT.invites, 'invités au total')
    + bloc(ETAT.mots, 'mots dans le livre d\'or')
    + bloc(ETAT.phase, 'phase en cours');

  var phases = [['open', 'Ouvert'], ['closed', 'Fermé'], ['revealed', 'Révélé']];
  $('phases').innerHTML = phases.map(function (p) {
    return '<button class="chip plat" data-p="' + p[0] + '"'
      + (ETAT.phase === p[0] ? ' aria-pressed="true"' : '') + '>' + p[1] + '</button>';
  }).join('');

  $('phase-note').textContent = ETAT.phase === 'revealed'
    ? 'Tout est public : pronostics, résultat et classement.'
    : ETAT.phase === 'closed'
      ? 'Plus personne ne peut modifier ses pronostics.'
      : 'Les paris sont ouverts jusqu\'au ' + ETAT.cloture + ', puis se ferment tout seuls.';

  document.querySelectorAll('#phases .chip').forEach(function (b) {
    b.onclick = function () {
      if (b.dataset.p === 'revealed' &&
          !confirm('Passer en « révélé » publie le résultat et le classement pour tout le monde. Confirmer ?')) return;
      poster({ action: 'admin_phase', phase: b.dataset.p }, function (d) {
        ETAT.phase = d.phase;
        dessinerEtat();
      });
    };
  });
}

function bloc(v, t) {
  return '<div class="stat"><span class="stat-v">' + v + '</span>'
       + '<span class="stat-t">' + t + '</span></div>';
}

function dessinerGens() {
  $('gens').innerHTML = (ETAT.gens || []).map(function (g) {
    return '<div class="ligne-gens">'
      + '<div class="gens-id"><strong>' + g.nom + '</strong><span>' + g.email + '</span></div>'
      + '<input type="text" maxlength="14" value="' + (g.pseudo || '') + '" data-t="'
      +   g.token + '" placeholder="sans pseudo">'
      + '<button class="cadeau-btn" data-t="' + g.token + '">OK</button>'
      + '</div>';
  }).join('') || '<p class="sub">Personne n\'est encore inscrit.</p>';

  document.querySelectorAll('#gens button').forEach(function (b) {
    b.onclick = function () {
      var champ = document.querySelector('#gens input[data-t="' + b.dataset.t + '"]');
      poster({ action: 'admin_pseudo', token: b.dataset.t, pseudo: champ.value },
        function () { b.textContent = '✓'; setTimeout(function () { b.textContent = 'OK'; }, 1500); });
    };
  });
}

function dessinerMessages() {
  var m = ETAT.messages || [];
  $('messages-sub').textContent = m.length
    ? m.length + ' message' + (m.length > 1 ? 's' : '') + ' déposé'
      + (m.length > 1 ? 's' : '') + '. Personne d\'autre que vous ne les voit.'
    : 'Aucun message pour l\'instant.';
  $('messages').innerHTML = m.map(function (x) {
    return '<div class="mot"><div class="mot-texte">' + x.texte.replace(/\n/g, '<br>')
      + '</div><div class="mot-sign">— ' + x.pseudo + ', pour '
      + (x.pour === 'parents' ? 'les parents' : 'Steevie')
      + '<span class="mot-date">' + x.date + '</span></div></div>';
  }).join('');
}

function dessinerChamps() {
  CHAMPS.forEach(function (c) {
    if (c.cle === 'heure') c.opts = STV_CRENEAUX.map(function (x) { return [x.cle, x.libelle]; });
    if (c.cle === 'ascendant') c.opts = STV_SIGNES.map(function (x) { return [x, x]; });
    if (c.cle === 'coupe') c.opts = STV_COUPE.map(function (x) { return [x.cle, x.libelle]; });
  });

  $('champs-resultat').innerHTML = CHAMPS.map(function (c) {
    var v = ETAT.resultat[c.cle] || '';
    var champ;
    if (c.type === 'choix') {
      champ = '<select id="r-' + c.cle + '"><option value="">—</option>'
        + c.opts.map(function (o) {
            return '<option value="' + o[0] + '"' + (v === o[0] ? ' selected' : '') + '>'
              + o[1] + '</option>';
          }).join('') + '</select>';
    } else {
      var t = c.type === 'date' ? 'date' : c.type === 'nombre' ? 'number' : 'text';
      champ = '<input type="' + t + '" id="r-' + c.cle + '" value="' + v + '"'
        + (c.ph ? ' placeholder="' + c.ph + '"' : '') + '>';
    }
    return '<div class="champ-admin"><label class="q">' + c.label + '</label>' + champ + '</div>';
  }).join('');
}

$('btn-resultat').onclick = function () {
  var r = {};
  CHAMPS.forEach(function (c) { r[c.cle] = $('r-' + c.cle).value.trim(); });
  poster({ action: 'admin_resultat', resultat: r }, function (d) {
    ETAT.resultat = d.resultat;
    $('resultat-msg').textContent = 'Enregistré. Tu peux calculer le classement.';
  });
};

$('btn-bilan').onclick = function () {
  fetch(API + '?action=admin_bilan&k=' + encodeURIComponent(CLE))
    .then(function (r) { return r.json(); })
    .then(function (d) {
      if (!d.ok) { $('bilan-sub').textContent = d.error; return; }
      if (!d.classement.length) { $('bilan-sub').textContent = 'Aucun pronostic à départager.'; return; }

      $('bilan-sub').textContent = d.classement.length + ' joueurs, '
        + d.moyenne + ' points de moyenne.';

      var h = '<table class="suivi" style="margin-top:14px"><thead><tr>'
            + '<th>Rang</th><th>Qui</th><th>Trouvé</th><th>Points</th></tr></thead><tbody>';
      d.classement.forEach(function (j, i) {
        h += '<tr' + (i === 0 ? ' class="moi"' : '') + '>'
          + '<td class="num">' + (i + 1) + '</td>'
          + '<td class="pseudo">' + j.pseudo + '</td>'
          + '<td class="num">' + (j.trouves.join(', ') || '—') + '</td>'
          + '<td class="num" style="text-align:right">' + j.score.toLocaleString('fr-FR') + '</td>'
          + '</tr>';
      });
      h += '</tbody></table>';

      h += '<h3 class="sstitre">Réussite par question</h3><div>';
      d.parQuestion.forEach(function (q) {
        h += '<div class="bar"><span class="lab">' + q.nom + '</span>'
          + '<span class="track"><span class="fill" style="width:' + q.pct + '%"></span></span>'
          + '<span class="n">' + q.n + '</span></div>';
      });
      $('bilan').innerHTML = h + '</div>';
    });
};

$('btn-test').onclick = function () {
  poster({ action: 'admin_mail', test: true }, function (d) { $('envoi-msg').textContent = d.message; });
};

$('btn-tous').onclick = function () {
  if (!confirm('Envoyer le faire-part définitif à tous les joueurs ? Cette action ne s\'annule pas.')) return;
  poster({ action: 'admin_mail', test: false }, function (d) { $('envoi-msg').textContent = d.message; });
};

function poster(payload, ok) {
  payload.k = CLE;
  fetch(API, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify(payload)
  })
    .then(function (r) { return r.json(); })
    .then(function (d) {
      if (!d.ok) { alert(d.error || 'Refusé.'); return; }
      ok(d);
    })
    .catch(function () { alert('Connexion impossible.'); });
}
