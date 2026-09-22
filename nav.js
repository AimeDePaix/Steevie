/* ============================================================================
   nav.js — la barre de navigation, commune à toutes les pages
   ----------------------------------------------------------------------------
   Chaque page pose un <div id="nav"></div> et charge ce fichier. Le jeton
   voyage d'une page à l'autre pour que personne n'ait à le retaper.
   ============================================================================ */

(function () {
  var t = new URLSearchParams(location.search).get('t') || '';
  var q = t ? '?t=' + encodeURIComponent(t) : '';
  var page = (location.pathname.split('/').pop() || 'index.html');
  var vue = new URLSearchParams(location.search).get('vue') || '';

  var liens = [
    { l: 'Les règles',    h: 'index.html' + (t ? q + '&vue=regles' : '?vue=regles'), a: page === 'index.html' && vue === 'regles' },
    { l: 'Mes pronos',    h: 'index.html' + (t ? q + '&vue=pronos' : ''),            a: page === 'index.html' && vue !== 'regles' && vue !== 'ticket' },
    { l: 'Mon ticket',    h: 'index.html' + (t ? q + '&vue=ticket' : ''),            a: page === 'index.html' && vue === 'ticket' },
    { l: 'Les autres',    h: 'pronos.html' + q,                                      a: page === 'pronos.html' },
    { l: 'Un mot',        h: 'mots.html' + q,                                        a: page === 'mots.html' },
    { l: 'Liste de naissance', h: 'liste.html' + q,                                  a: page === 'liste.html' }
  ];

  var cible = document.getElementById('nav');
  if (!cible) return;
  if (!t) return;   // sans jeton, aucune navigation n'est proposée

  cible.innerHTML = '<nav class="barre"><div class="barre-in">'
    + liens.map(function (x) {
        return '<a class="onglet' + (x.a ? ' actif' : '') + '" href="' + x.h + '">' + x.l + '</a>';
      }).join('')
    + '</div></nav>';
})();
