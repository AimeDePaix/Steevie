/* ============================================================================
   mots.js — deux messages, une seule fois, et personne d'autre ne les lit
   ============================================================================ */

var TOKEN = new URLSearchParams(location.search).get('t') || '';
stvNav('mots');
var MIENS = {};

var $ = function (id) { return document.getElementById(id); };
var show = function (id, on) { $(id).classList.toggle('hidden', !on); };

var DESTINATAIRES = [
  { cle: 'steevie', bloc: 'bloc-steevie', section: 's-steevie',
    invite: 'Cher Steevie…',
    aide: 'Il le lira quand il saura lire. Prends ton temps.' },
  { cle: 'parents', bloc: 'bloc-parents', section: 's-parents',
    invite: 'Eve-Ma, Max…',
    aide: 'Un encouragement, un conseil, ou juste un mot gentil.' }
];

fetch(API + '?action=mots&t=' + encodeURIComponent(TOKEN))
  .then(function (r) { return r.json(); })
  .then(function (d) {
    show('s-load', false);
    if (!d.ok) {
      show('s-intro', true);
      $('s-intro').innerHTML = '<h2>Pas encore</h2><p class="sub">Cette page s\'ouvre '
        + 'une fois tes pronostics validés.</p>';
      return;
    }
    MIENS = d.miens || {};
    show('s-intro', true);
    DESTINATAIRES.forEach(dessiner);
  })
  .catch(function () {
    show('s-load', false);
    show('s-intro', true);
    $('s-intro').innerHTML = '<h2>Connexion impossible</h2><p class="sub">Réessaie '
      + 'dans un instant.</p>';
  });


function dessiner(d) {
  show(d.section, true);
  var deja = MIENS[d.cle];

  if (deja) {
    $(d.bloc).innerHTML = '<div class="mot depose">'
      + '<div class="mot-texte">' + echappe(deja.texte).replace(/\n/g, '<br>') + '</div>'
      + '<div class="mot-sign">déposé le ' + echappe(deja.date) + '</div>'
      + '</div>'
      + '<p class="note">C\'est gravé. On n\'y touche plus.</p>';
    return;
  }

  $(d.bloc).innerHTML =
      '<p class="sub">' + d.aide + '</p>'
    + '<textarea id="t-' + d.cle + '" maxlength="600" rows="5" placeholder="'
    +   d.invite + '"></textarea>'
    + '<div class="compteur" id="c-' + d.cle + '">600 caractères restants</div>'
    + '<button class="cta" id="b-' + d.cle + '">Déposer définitivement</button>'
    + '<p class="error hidden" id="e-' + d.cle + '"></p>';

  $('t-' + d.cle).oninput = function () {
    var r = 600 - $('t-' + d.cle).value.length;
    $('c-' + d.cle).textContent = r + ' caractère' + (r > 1 ? 's' : '') + ' restant'
      + (r > 1 ? 's' : '');
  };

  $('b-' + d.cle).onclick = function () {
    var t = $('t-' + d.cle).value.trim();
    show('e-' + d.cle, false);
    if (t.length < 3) {
      $('e-' + d.cle).textContent = 'Écris au moins quelques mots.';
      show('e-' + d.cle, true);
      return;
    }
    if (!confirm('Ce message ne pourra plus être modifié. On le dépose ?')) return;

    $('b-' + d.cle).disabled = true;
    $('b-' + d.cle).textContent = 'Envoi…';

    fetch(API, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({ action: 'mot', token: TOKEN, pour: d.cle, texte: t })
    })
      .then(function (r) { return r.json(); })
      .then(function (rep) {
        if (!rep.ok) {
          $('b-' + d.cle).disabled = false;
          $('b-' + d.cle).textContent = 'Déposer définitivement';
          $('e-' + d.cle).textContent = rep.error;
          show('e-' + d.cle, true);
          return;
        }
        MIENS = rep.miens || {};
        dessiner(d);
      })
      .catch(function () {
        $('b-' + d.cle).disabled = false;
        $('b-' + d.cle).textContent = 'Déposer définitivement';
        $('e-' + d.cle).textContent = 'Connexion impossible.';
        show('e-' + d.cle, true);
      });
  };
}

function echappe(t) {
  return String(t == null ? '' : t)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
