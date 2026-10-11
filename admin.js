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
  { cle: 'prenom',       label: 'Le prénom',             type: 'texte' },
  { cle: 'sexe',         label: 'Fille ou garçon',       type: 'choix', opts: [['F', 'Fille'], ['G', 'Garçon']] },
  { cle: 'date',         label: 'Le jour',               type: 'date' },
  { cle: 'heure_exacte', label: 'L\'heure exacte',       type: 'heure' },
  { cle: 'poids',        label: 'Le poids en grammes',   type: 'nombre', ph: '3400' },
  { cle: 'taille',       label: 'La taille en cm',       type: 'nombre', ph: '50' },
  { cle: 'coupe',        label: 'La coupe',              type: 'choix', opts: [] }
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
        $('cle-err').textContent = d.error === 'Action inconnue.'
          ? 'Le serveur ne connaît pas la console : le dernier Code.gs n\'a pas été déployé.'
          : (d.error || 'Clé refusée.');
        show('cle-err', true);
        return;
      }
      ETAT = d;
      show('s-cle', false);
      ['s-etat', 's-inviter', 's-resultat', 's-bilan', 's-gens', 's-messages', 's-photos', 's-envoi', 's-reset']
        .forEach(function (i) { show(i, true); });
      // Les messages d'une action précédente n'ont plus lieu d'être.
      ['resultat-msg', 'photo-msg', 'envoi-msg', 'bilan-sub', 'gens-msg'].forEach(function (i) { $(i).textContent = ''; });
      $('bilan').innerHTML = '';
      dessinerEtat();
      dessinerChamps();
      dessinerGens();
      dessinerMessages();
      dessinerPhotos();
    })
    .catch(function () {
      show('s-cle', true);
      $('cle-err').textContent = 'Le serveur a répondu par une erreur. Vérifie que Code.gs est '
        + 'bien déployé en nouvelle version, et que l\'onglet Config existe.';
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

/* Où en est chacun : 0 en cours, 1 pas commencé, 2 validé (ordre d'affichage). */
var ETAPES = { regles: 'lit les règles', indices: 'fait le quiz', pronos: 'remplit son formulaire' };
function statut(g) {
  if (g.valide) return { rang: 2, cls: 'st-ok', txt: 'validé' };
  if (g.progression) return { rang: 0, cls: 'st-cours', txt: 'en cours : ' + (ETAPES[g.progression] || g.progression) };
  if (g.pseudo) return { rang: 0, cls: 'st-cours', txt: 'en cours : pseudo choisi' };
  return { rang: 1, cls: 'st-rien', txt: 'pas encore commencé' };
}

function dessinerGens() {
  var gens = (ETAT.gens || []).map(function (g) { g.st = statut(g); return g; })
    .sort(function (a, b) { return a.st.rang - b.st.rang || String(a.nom).localeCompare(String(b.nom)); });

  var n = [0, 0, 0];
  gens.forEach(function (g) { n[g.st.rang]++; });
  $('gens-resume').textContent = gens.length
    ? n[2] + ' validé' + (n[2] > 1 ? 's' : '') + ' · ' + n[0] + ' en cours · ' + n[1] + ' pas commencé' + (n[1] > 1 ? 's' : '')
    : '';

  $('gens').innerHTML = gens.map(function (g) {
    return '<div class="ligne-gens">'
      + '<div class="gens-id"><strong>' + echappe(g.nom) + '</strong>'
      +   '<em class="statut ' + g.st.cls + '">' + echappe(g.st.txt) + '</em>'
      +   '<span>' + echappe(g.email) + (g.invite ? ' · invité le ' + echappe(g.invite) : '') + '</span>'
      +   '<button class="link relancer" data-t="' + echappe(g.token) + '">Renvoyer son lien</button></div>'
      + '<input type="text" maxlength="14" value="' + echappe(g.pseudo || '') + '" data-t="'
      +   echappe(g.token) + '" placeholder="sans pseudo">'
      + '<button class="cadeau-btn ok-pseudo" data-t="' + echappe(g.token) + '">OK</button>'
      + '</div>';
  }).join('') || '<p class="sub">Personne n\'est encore invité.</p>';

  document.querySelectorAll('#gens .relancer').forEach(function (b) {
    b.onclick = function () {
      b.disabled = true;
      poster({ action: 'admin_relancer', token: b.dataset.t }, function (d) {
        b.textContent = 'Lien renvoyé ✓';
        $('gens-msg').textContent = d.message;
      });
    };
  });

  document.querySelectorAll('#gens .ok-pseudo').forEach(function (b) {
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
    return '<div class="mot"><div class="mot-texte">' + echappe(x.texte).replace(/\n/g, '<br>')
      + '</div><div class="mot-sign">— ' + echappe(x.pseudo) + ', pour '
      + (x.pour === 'parents' ? 'les parents' : 'Steevie')
      + '<span class="mot-date">' + echappe(x.date) + '</span></div></div>';
  }).join('');
}

function dessinerChamps() {
  CHAMPS.forEach(function (c) {
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
      var t = c.type === 'date' ? 'date' : c.type === 'heure' ? 'time'
            : c.type === 'nombre' ? 'number' : 'text';
      champ = '<input type="' + t + '" id="r-' + c.cle + '" value="' + v + '"'
        + (c.ph ? ' placeholder="' + c.ph + '"' : '') + '>';
    }
    return '<div class="champ-admin"><label class="q">' + c.label + '</label>' + champ + '</div>';
  }).join('')
  + '<div class="deduit" id="deduit"></div>';

  ['r-date', 'r-heure_exacte', 'r-prenom'].forEach(function (id) { $(id).oninput = majDeduit; });
  majDeduit();
}

/* Le créneau et l'ascendant se calculent sous tes yeux, avec la même
   formule que le jeu : rien à deviner, rien à saisir. */
function majDeduit() {
  var d = $('r-date').value, h = $('r-heure_exacte').value, pr = $('r-prenom').value;
  var l = [];

  var ini = initialeDe(pr);
  l.push('Première lettre : <strong>' + (ini || '—') + '</strong>'
    + (ini ? ' <span class="mini-note">(déduite du prénom)</span>' : ''));

  if (d && h) {
    var cr = stvCreneauDe(h);
    var lib = STV_CRENEAUX.filter(function (x) { return x.cle === cr; })[0];
    var asc = stvAscendantNaissance(ETAT.config, d, h);
    l.push('Créneau : <strong>' + (lib ? lib.libelle : '—') + '</strong>');
    l.push('Ascendant : <strong>' + asc + '</strong> — ' + (STV_CARACTERES[asc] || ''));
  } else {
    l.push('<span class="mini-note">Renseigne le jour et l\'heure exacte : le créneau et '
      + 'l\'ascendant se calculeront tout seuls.</span>');
  }
  $('deduit').innerHTML = l.join('<br>');
}

/* Même règle que pour les joueurs : accents ramenés à la lettre nue, et
   prénom composé pris sur son premier élément. */
function initialeDe(prenom) {
  var p = String(prenom || '').trim();
  if (!p) return '';
  var c = p.normalize('NFD').replace(/[\u0300-\u036f]/g, '').charAt(0).toUpperCase();
  return /[A-Z]/.test(c) ? c : '';
}

$('btn-actualiser').onclick = function () { entrer(); };

$('btn-inviter').onclick = function () {
  var nom = $('inv-nom').value.trim(), email = $('inv-email').value.trim();
  $('btn-inviter').disabled = true;
  $('inv-msg').textContent = 'Envoi…';
  fetch(API, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify({ action: 'admin_inviter', nom: nom, email: email, k: CLE })
  })
    .then(function (r) { return r.json(); })
    .then(function (d) {
      $('btn-inviter').disabled = false;
      if (!d.ok) { $('inv-msg').textContent = d.error; return; }
      $('inv-nom').value = ''; $('inv-email').value = '';
      entrer();
      $('inv-msg').textContent = d.message;
    })
    .catch(function () { $('btn-inviter').disabled = false; $('inv-msg').textContent = 'Connexion impossible.'; });
};

$('btn-resultat').onclick = function () {
  var r = {};
  CHAMPS.forEach(function (c) { r[c.cle] = $('r-' + c.cle).value.trim(); });
  poster({ action: 'admin_resultat', resultat: r }, function (d) {
    ETAT.resultat = d.resultat;
    var fermee = d.phase === 'closed' && ETAT.phase === 'open';
    if (d.phase) { ETAT.phase = d.phase; dessinerEtat(); }
    $('resultat-msg').textContent = 'Enregistré. Tu peux calculer le classement.'
      + (fermee ? ' Les paris viennent d\'être fermés automatiquement.' : '');
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
          + '<td class="num">' + (j.rang || '—') + '</td>'
          + '<td class="pseudo">' + echappe(j.pseudo) + '</td>'
          + '<td class="num">' + (j.trouves.join(', ') || '—') + '</td>'
          + '<td class="num" style="text-align:right">' + j.score.toLocaleString('fr-FR') + '</td>'
          + '</tr>';
      });
      h += '</tbody></table>';

      if (d.prix && d.prix.length) {
        h += '<h3 class="sstitre">Le palmarès</h3><div class="palmares">';
        d.prix.forEach(function (x) {
          h += '<div class="lot"><div class="lot-titre">' + x.titre + '</div>'
            + '<div class="lot-txt"><strong>' + x.gagnants.map(echappe).join(', ') + '</strong>'
            + (x.detail ? ' (' + echappe(x.detail) + ')' : '') + '<small>' + x.lot + '</small></div></div>';
        });
        h += '</div>';
      }

      h += '<h3 class="sstitre">Réussite par question</h3><div>';
      d.parQuestion.forEach(function (q) {
        h += '<div class="bar"><span class="lab">' + q.nom + '</span>'
          + '<span class="track"><span class="fill" style="width:' + q.pct + '%"></span></span>'
          + '<span class="n">' + q.n + '</span></div>';
      });
      $('bilan').innerHTML = h + '</div>';
    });
};

$('btn-reset-resultat').onclick = function () {
  if (!confirm('Effacer la naissance saisie et les photos ? Les pronostics sont conservés.')) return;
  poster({ action: 'admin_reset', quoi: 'resultat' }, function (d) {
    $('reset-msg').textContent = d.message;
    entrer();
  });
};

$('btn-reset-tout').onclick = function () {
  if (!confirm('Effacer TOUS les pronostics, les mots et les progressions ? Irréversible.')) return;
  if (!confirm('Vraiment ? Tout le monde devra rejouer depuis le début.')) return;
  poster({ action: 'admin_reset', quoi: 'pronos' }, function (d) {
    $('reset-msg').textContent = d.message;
    entrer();
  });
};

$('btn-test').onclick = function () {
  poster({ action: 'admin_mail', test: true }, function (d) { $('envoi-msg').textContent = d.message; });
};

$('btn-tous').onclick = function () {
  if (!confirm('Envoyer le faire-part définitif à tous les joueurs ? Cette action ne s\'annule pas.')) return;
  envoyerTous(false);
};

/* Un second envoi général demande une confirmation explicite. */
function envoyerTous(force) {
  fetch(API, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify({ action: 'admin_mail', test: false, force: force, k: CLE })
  })
    .then(function (r) { return r.json(); })
    .then(function (d) {
      if (d.ok) { $('envoi-msg').textContent = d.message; return; }
      if (d.deja && confirm(d.error + ' Le renvoyer quand même à tout le monde ?')) return envoyerTous(true);
      $('envoi-msg').textContent = d.error;
    })
    .catch(function () { $('envoi-msg').textContent = 'Connexion impossible.'; });
}

/* ============================================================================
   Les photos : réduites dans le navigateur (1600 px, JPEG) avant l'envoi,
   pour que le mail reste léger et que l'envoi au serveur ne traîne pas.
   ============================================================================ */

function dessinerPhotos() {
  ['bebe', 'famille'].forEach(function (slot) {
    var src = ETAT.photos && ETAT.photos[slot];
    $('cadre-' + slot).innerHTML = src ? '<img src="' + src + '" alt="">' : 'Pas encore de photo';
    show('suppr-' + slot, !!src);

    $('photo-' + slot).onchange = function (e) {
      var f = e.target.files && e.target.files[0];
      if (!f) return;
      $('photo-msg').textContent = 'Préparation de la photo…';
      reduire(f, function (dataUrl) {
        $('cadre-' + slot).innerHTML = '<img src="' + dataUrl + '" alt="">';
        $('photo-msg').textContent = 'Envoi…';
        poster({ action: 'admin_photo', slot: slot, data: dataUrl }, function () {
          ETAT.photos = ETAT.photos || {};
          ETAT.photos[slot] = dataUrl;
          show('suppr-' + slot, true);
          $('photo-msg').textContent = 'Photo enregistrée. Elle partira avec le faire-part.';
        });
      });
    };

    $('suppr-' + slot).onclick = function () {
      poster({ action: 'admin_photo_suppr', slot: slot }, function () {
        ETAT.photos[slot] = null;
        $('cadre-' + slot).innerHTML = 'Pas encore de photo';
        $('photo-' + slot).value = '';
        show('suppr-' + slot, false);
        $('photo-msg').textContent = 'Photo retirée.';
      });
    };
  });
}

function reduire(fichier, fini) {
  var lecteur = new FileReader();
  lecteur.onload = function () {
    var img = new Image();
    img.onload = function () {
      var max = 1600, k = Math.min(1, max / Math.max(img.width, img.height));
      var c = document.createElement('canvas');
      c.width = Math.round(img.width * k);
      c.height = Math.round(img.height * k);
      c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
      fini(c.toDataURL('image/jpeg', 0.85));
    };
    img.onerror = function () { $('photo-msg').textContent = 'Ce fichier n\'est pas une image lisible.'; };
    img.src = lecteur.result;
  };
  lecteur.readAsDataURL(fichier);
}

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


/* Tout ce qui vient des invités (pseudo, nom, message) est affiché comme du
   texte, jamais interprété comme du code. */
function echappe(t) {
  return String(t == null ? '' : t)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}
