/* ============================================================================
   nav.js — la barre de navigation, commune aux pages du jeu
   ----------------------------------------------------------------------------
   La barre n'apparaît qu'une fois les indices terminés. Avant la validation
   des pronostics, les onglets 3 à 6 restent verrouillés. Chaque page appelle
   stvNav(onglet actif) ; le niveau atteint est mémorisé par app.js.
   ============================================================================ */

function stvNav(actif) {
  var cible = document.getElementById('nav');
  if (!cible) return;

  var t = new URLSearchParams(location.search).get('t') || '';
  if (!t) { cible.innerHTML = ''; return; }

  var niveau = '';
  try { niveau = localStorage.getItem('steevie-niveau-' + t) || ''; } catch (e) {}

  // Pas de navigation tant que les indices ne sont pas faits.
  if (niveau !== 'pronos' && niveau !== 'fini') { cible.innerHTML = ''; return; }

  var q = '?t=' + encodeURIComponent(t);
  var fini = (niveau === 'fini');

  var onglets = [
    { id: 'regles', n: 1, l: 'Les règles du jeu',        h: 'index.html' + q + '&vue=regles', ouvert: true },
    { id: 'pronos', n: 2, l: 'Mon formulaire de pronos', h: 'index.html' + q + '&vue=pronos', ouvert: true },
    { id: 'ticket', n: 3, l: 'Ticket récap Steevamax',   h: 'index.html' + q + '&vue=ticket', ouvert: fini },
    { id: 'autres', n: 4, l: 'Pronos des autres',        h: 'pronos.html' + q,                ouvert: fini },
    { id: 'mots',   n: 5, l: 'Un petit mot pour nous',   h: 'mots.html' + q,                  ouvert: fini },
    { id: 'liste',  n: 6, l: 'Liste de naissance',       h: 'liste.html' + q,                 ouvert: fini }
  ];

  cible.innerHTML = '<nav class="barre"><div class="barre-in">'
    + onglets.map(function (o) {
        var cls = 'onglet' + (o.id === actif ? ' actif' : '') + (o.ouvert ? '' : ' verrou');
        var titre = o.ouvert ? '' : ' title="Valide d\'abord tes pronostics"';
        return o.ouvert
          ? '<a class="' + cls + '" href="' + o.h + '"><span class="n">' + o.n + '</span>' + o.l + '</a>'
          : '<span class="' + cls + '"' + titre + '><span class="n">' + o.n + '</span>' + o.l + '</span>';
      }).join('')
    + '</div></nav>';
}
