/* ============================================================================
   pronos.js — la page collective, verrouillée tant qu'on n'a pas joué
   ============================================================================ */

var TOKEN = new URLSearchParams(location.search).get('t') || '';
stvNav('autres');
var CFG = null, MOI = '';

var $ = function (id) { return document.getElementById(id); };
var show = function (id, on) { $(id).classList.toggle('hidden', !on); };

var retour = 'index.html' + (TOKEN ? '?t=' + encodeURIComponent(TOKEN) : '');
$('lien-retour').href = retour;
$('lien-retour2').href = retour;

fetch(API + '?action=board&t=' + encodeURIComponent(TOKEN))
  .then(function (r) { return r.json(); })
  .then(afficher)
  .catch(function () { show('s-load', false); show('s-verrou', true); });


function afficher(d) {
  show('s-load', false);

  if (!d.ok || d.verrouille) { show('s-verrou', true); return; }

  CFG = d.config;
  MOI = d.moi || '';

  show('s-table', true);
  $('table-sub').textContent = d.entries.length + ' participant'
    + (d.entries.length > 1 ? 's' : '') + ' ont déjà joué.';

  tableau(d.entries, d.phase === 'revealed');

  if (d.phase === 'revealed' && d.resultat) resultat(d);
}


/* Le tableau public : le sexe, le jour et les points en jeu. Les parents
   ne montrent que leurs points en jeu, le serveur ne transmet rien d'autre. */
function tableau(entries, revele) {
  var lignes = entries.slice().sort(function (a, b) {
    return (b.enjeu || 0) - (a.enjeu || 0) || (a.pseudo || '').localeCompare(b.pseudo || '');
  });

  var h = '<div class="tableau-wrap"><table class="suivi public"><thead><tr>'
        + '<th>Qui</th><th>Sexe</th><th>Le jour</th><th class="droite">En jeu</th>'
        + '</tr></thead><tbody>';

  lignes.forEach(function (e) {
    var r = e.reponses || {};
    var cache = e.parent && !revele;
    h += '<tr' + (e.pseudo === MOI ? ' class="moi"' : '') + '>'
      + '<td class="pseudo">' + echappe(e.pseudo)
      +   (e.parent ? ' <span class="tag-parent">parent</span>' : '') + '</td>'
      + '<td>' + (cache ? '<span class="secret">secret</span>' : pastilleSexe(r.sexe)) + '</td>'
      + '<td class="num">' + (cache ? '<span class="secret">secret</span>' : jourLisible(r.date)) + '</td>'
      + '<td class="num droite">' + (e.enjeu ? e.enjeu.toLocaleString('fr-FR') + ' pts' : '—') + '</td>'
      + '</tr>';
  });

  $('tableau').innerHTML = h + '</tbody></table></div>'
    + '<p class="note">« En jeu » : ce que chacun empocherait avec un sans-faute. Les parents '
    + 'gardent leurs pronostics secrets, pour ne pas vous influencer.</p>';
}

function jourLisible(v) {
  if (!v) return '—';
  if (v === 'avant') return 'avant le ' + courteDate(stvJourVersDate(CFG, CFG.date_min));
  if (v === 'apres') return courteDate(stvJourVersDate(CFG, CFG.date_max + 1)) + ' ou après';
  return courteDate(v);
}

function pastilleSexe(v) {
  if (v === 'F') return '<span class="pastille f">Fille</span>';
  if (v === 'G') return '<span class="pastille m">Garçon</span>';
  if (v === 'P') return '<span class="pastille p">Patate</span>';
  return '—';
}


function resultat(d) {
  show('s-result', true);
  var r = d.resultat;
  $('result-title').textContent = r.prenom || 'Steevie est là';
  $('result-line').textContent = 'Né' + (r.sexe === 'F' ? 'e' : '') + ' le '
    + jolieDate(r.date) + '.';

  // Les parents restent à leur place au score, sans numéro : hors concours.
  var lignes = d.entries.slice().sort(function (a, b) {
    return (b.score || 0) - (a.score || 0) || (a.rang || 99) - (b.rang || 99);
  });

  var t = '<table class="suivi" style="margin-top:12px"><tbody>';
  lignes.forEach(function (l) {
    t += '<tr' + (l.pseudo === MOI ? ' class="moi"' : '') + '>'
      + '<td class="pseudo">' + (l.parent ? '' : l.rang + '. ') + echappe(l.pseudo)
      + (l.parent ? ' <span class="tag-parent">hors concours</span>' : '') + '</td>'
      + '<td class="num" style="text-align:right">' + (l.score || 0).toLocaleString('fr-FR')
      + ' pts</td></tr>';
  });
  $('classement').innerHTML = t + '</tbody></table>';
}


function echappe(t) {
  return String(t == null ? '' : t)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

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
