/* ============================================================================
   pronos.js — la page collective, verrouillée tant qu'on n'a pas joué
   ============================================================================ */

var TOKEN = new URLSearchParams(location.search).get('t') || '';
var CFG = null, MOI = '';

var $ = function (id) { return document.getElementById(id); };
var show = function (id, on) { $(id).classList.toggle('hidden', !on); };

var retour = 'index.html' + (TOKEN ? '?t=' + encodeURIComponent(TOKEN) : '');
$('lien-retour').href = retour;
$('lien-retour2').href = retour;
$('lien-liste').href = 'liste.html' + (TOKEN ? '?t=' + encodeURIComponent(TOKEN) : '');

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


function tableau(entries, revele) {
  var trP = stvTranchesPoids(CFG), trT = stvTranchesTaille(CFG);
  var lib = function (l, c) {
    for (var i = 0; i < l.length; i++) if (l[i].cle === c) return l[i].libelle;
    return '—';
  };

  var lignes = entries.slice().sort(function (a, b) {
    return (a.pseudo || '').localeCompare(b.pseudo || '');
  });

  var h = '<div class="tableau-wrap"><table class="suivi"><thead><tr>'
        + '<th>Qui</th><th>Sexe</th><th>Le jour</th><th>Poids</th><th>Taille</th>'
        + '</tr></thead><tbody>';

  lignes.forEach(function (e) {
    var r = e.reponses || {};
    var patate = (r.sexe === 'P');
    h += '<tr' + (e.pseudo === MOI ? ' class="moi"' : '') + '>'
      + '<td class="pseudo">' + echappe(e.pseudo) + '</td>'
      + '<td>' + pastilleSexe(r.sexe) + '</td>'
      + '<td class="num">' + (patate ? '—' : (r.date ? courteDate(r.date) : '—')) + '</td>'
      + '<td class="num">' + (patate ? '—' : (r.poids ? lib(trP, r.poids) : '—')) + '</td>'
      + '<td class="num">' + (patate ? '—' : (r.taille ? lib(trT, r.taille) : '—')) + '</td>'
      + '</tr>';
  });

  $('tableau').innerHTML = h + '</tbody></table></div>';
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

  var lignes = d.entries.map(function (e) {
    return { pseudo: e.pseudo, total: e.score || 0 };
  }).sort(function (a, b) { return b.total - a.total; });

  var t = '<table class="suivi" style="margin-top:12px"><tbody>';
  lignes.forEach(function (l, i) {
    t += '<tr' + (l.pseudo === MOI ? ' class="moi"' : '') + '>'
      + '<td class="pseudo">' + (i + 1) + '. ' + echappe(l.pseudo) + '</td>'
      + '<td class="num" style="text-align:right">' + l.total.toLocaleString('fr-FR')
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
  var p = String(iso).split('-');
  return Number(p[2]) + ' ' + MOIS[Number(p[1]) - 1] + ' ' + p[0];
}

function courteDate(iso) {
  var p = String(iso).split('-');
  return Number(p[2]) + ' ' + MOIS[Number(p[1]) - 1].slice(0, 4);
}
