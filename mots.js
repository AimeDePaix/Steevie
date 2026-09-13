/* ============================================================================
   mots.js — le livre d'or
   ============================================================================ */

var TOKEN = new URLSearchParams(location.search).get('t') || '';
var MOI = '';

var $ = function (id) { return document.getElementById(id); };
var show = function (id, on) { $(id).classList.toggle('hidden', !on); };

$('retour').href = 'index.html' + (TOKEN ? '?t=' + encodeURIComponent(TOKEN) : '');

charger();

function charger() {
  fetch(API + '?action=mots&t=' + encodeURIComponent(TOKEN))
    .then(function (r) { return r.json(); })
    .then(function (d) {
      show('s-load', false);
      if (!d.ok) {
        show('s-mots', true);
        $('mots-sub').textContent = 'Il te faut ton lien personnel pour écrire ici.';
        return;
      }
      MOI = d.moi || '';
      show('s-ecrire', true);
      afficher(d.mots || []);
    })
    .catch(function () {
      show('s-load', false);
      show('s-mots', true);
      $('mots-sub').textContent = 'Connexion impossible. Réessaie dans un instant.';
    });
}

function afficher(mots) {
  show('s-mots', true);
  $('mots-sub').textContent = mots.length
    ? mots.length + ' message' + (mots.length > 1 ? 's' : '') + ' déposé'
      + (mots.length > 1 ? 's' : '') + '.'
    : 'Personne n\'a encore écrit. À toi l\'honneur.';

  $('liste-mots').innerHTML = mots.map(function (m) {
    return '<div class="mot' + (m.pseudo === MOI ? ' moi' : '') + '">'
      + '<div class="mot-texte">' + echappe(m.texte).replace(/\n/g, '<br>') + '</div>'
      + '<div class="mot-sign">— ' + echappe(m.pseudo) + '<span class="mot-date">'
      + echappe(m.date) + '</span></div>'
      + '</div>';
  }).join('');
}

$('mot').oninput = function () {
  var reste = 600 - $('mot').value.length;
  $('compteur').textContent = reste + ' caractère' + (reste > 1 ? 's' : '') + ' restant'
    + (reste > 1 ? 's' : '');
};

$('btn-envoyer').onclick = function () {
  var t = $('mot').value.trim();
  show('err', false);
  if (t.length < 3) { $('err').textContent = 'Écris au moins quelques mots.'; show('err', true); return; }

  $('btn-envoyer').disabled = true;
  $('btn-envoyer').textContent = 'Envoi…';

  fetch(API, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify({ action: 'mot', token: TOKEN, texte: t })
  })
    .then(function (r) { return r.json(); })
    .then(function (d) {
      $('btn-envoyer').disabled = false;
      $('btn-envoyer').textContent = 'Déposer mon mot';
      if (!d.ok) { $('err').textContent = d.error; show('err', true); return; }
      $('mot').value = '';
      $('compteur').textContent = '600 caractères restants';
      afficher(d.mots || []);
      $('s-mots').scrollIntoView({ behavior: 'smooth' });
    })
    .catch(function () {
      $('btn-envoyer').disabled = false;
      $('btn-envoyer').textContent = 'Déposer mon mot';
      $('err').textContent = 'Connexion impossible.';
      show('err', true);
    });
};

function echappe(t) {
  return String(t == null ? '' : t)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
