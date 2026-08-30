/* ============================================================================
   ticket.js — le bulletin de pari, dessiné en canvas
   ----------------------------------------------------------------------------
   Ce que l'invité voit à l'écran EST l'image partagée : on dessine une fois,
   et le bouton de partage envoie ce même canvas. Aucune conversion, aucune
   dépendance externe, et rien ne tourne côté serveur.
   ============================================================================ */

var TK = {
  L: 720,            // largeur de dessin ; la hauteur s'adapte au contenu
  marge: 44,
  paper: '#FCFDFB',
  ink: '#17251F',
  soft: '#5F6E66',
  rule: '#CBD5C7',
  accent: '#D9A31E',
  fille: '#A8497A',
  garcon: '#2E7D74'
};

function dessinerTicket(canvas, cfg, pseudo, prono, questions) {
  var dpr = Math.min(window.devicePixelRatio || 1, 3);
  var lignes = questions.filter(function (q) { return (prono.mises[q.cle] || 0) > 0; });
  var H = 210 + lignes.length * 46 + 140;

  canvas.width = TK.L * dpr;
  canvas.height = H * dpr;
  canvas.style.aspectRatio = TK.L + ' / ' + H;

  var c = canvas.getContext('2d');
  c.scale(dpr, dpr);

  var M = TK.marge, y;

  /* --- fond et cadre --- */
  c.fillStyle = TK.paper;
  c.fillRect(0, 0, TK.L, H);
  c.strokeStyle = TK.rule;
  c.lineWidth = 2;
  c.strokeRect(1, 1, TK.L - 2, H - 2);

  /* --- en-tête --- */
  c.fillStyle = TK.soft;
  c.font = '500 15px "DM Mono", monospace';
  c.fillText('BULLETIN DE PRONOSTIC', M, 56);

  c.fillStyle = TK.ink;
  c.font = '600 54px Fraunces, Georgia, serif';
  c.fillText('Steevie', M, 108);

  c.fillStyle = TK.soft;
  c.font = '400 19px Karla, sans-serif';
  c.textAlign = 'right';
  c.fillText(pseudo, TK.L - M, 108);
  c.textAlign = 'left';

  trait(c, M, 136);

  /* --- lignes de pari --- */
  y = 176;
  c.font = '500 13px "DM Mono", monospace';
  c.fillStyle = TK.soft;
  c.fillText('PARI', M, y - 22);
  c.textAlign = 'right';
  c.fillText('COTE', TK.L - M - 190, y - 22);
  c.fillText('MISE', TK.L - M - 100, y - 22);
  c.fillText('GAIN', TK.L - M, y - 22);
  c.textAlign = 'left';

  var total = 0;

  lignes.forEach(function (q) {
    var mise = prono.mises[q.cle] || 0;
    var cote = prono.cotes[q.cle] || 0;
    var gain = Math.round(mise * cote);
    total += gain;

    c.fillStyle = TK.ink;
    c.font = '400 20px Karla, sans-serif';
    c.fillText(tronque(c, libelleReponse(cfg, q.cle, prono.reponses[q.cle]), 300), M, y);

    c.fillStyle = TK.soft;
    c.font = '400 14px Karla, sans-serif';
    c.fillText(q.titre.length > 34 ? q.titre.slice(0, 33) + '…' : q.titre, M, y + 19);

    c.textAlign = 'right';
    c.font = '400 18px "DM Mono", monospace';
    c.fillStyle = TK.soft;
    c.fillText(stvFmtCote(cote), TK.L - M - 190, y);
    c.fillText(mise + '', TK.L - M - 100, y);
    c.fillStyle = TK.ink;
    c.fillText(gain + ' pts', TK.L - M, y);
    c.textAlign = 'left';

    y += 46;
  });

  /* --- total --- */
  trait(c, M, y - 6);
  y += 40;

  c.fillStyle = TK.soft;
  c.font = '500 15px "DM Mono", monospace';
  c.fillText('GAIN MAXIMUM SI TOUT TOMBE', M, y);

  c.fillStyle = TK.ink;
  c.font = '600 46px Fraunces, Georgia, serif';
  c.textAlign = 'right';
  c.fillText(total.toLocaleString('fr-FR') + ' pts', TK.L - M, y + 8);
  c.textAlign = 'left';

  /* --- pied --- */
  c.fillStyle = TK.accent;
  c.fillRect(M, y + 42, TK.L - M * 2, 3);

  c.fillStyle = TK.soft;
  c.font = '400 15px Karla, sans-serif';
  c.fillText('Terme le ' + frDate(cfg.terme_affiche) + ' · pronostics clos le ' + frDate(cfg.cloture),
             M, y + 76);
}

function trait(c, M, y) {
  c.strokeStyle = TK.rule;
  c.lineWidth = 1;
  c.beginPath();
  c.moveTo(M, y);
  c.lineTo(TK.L - M, y);
  c.stroke();
}

function tronque(c, txt, max) {
  if (c.measureText(txt).width <= max) return txt;
  while (txt.length > 3 && c.measureText(txt + '…').width > max) txt = txt.slice(0, -1);
  return txt + '…';
}

/* Traduit une valeur brute en libellé lisible sur le ticket. */
function libelleReponse(cfg, cle, v) {
  if (!v) return '—';
  if (cle === 'sexe')    return v === 'F' ? 'Une fille' : 'Un garçon';
  if (cle === 'date')    return frDate(v);
  if (cle === 'top100')  return v === 'oui' ? 'Prénom du top 100' : 'Prénom hors top 100';
  if (cle === 'chevelu') {
    for (var i = 0; i < STV_CHEVELU.length; i++) {
      if (STV_CHEVELU[i].cle === v) return STV_CHEVELU[i].libelle;
    }
  }
  if (cle === 'poids')  return chercheLibelle(stvTranchesPoids(cfg), v);
  if (cle === 'taille') return chercheLibelle(stvTranchesTaille(cfg), v);
  if (cle === 'lettre') return 'Un prénom en ' + v;
  if (cle === 'heure')  return 'Entre ' + v.replace('-', ' et ');
  return String(v);
}

function chercheLibelle(tranches, cle) {
  for (var i = 0; i < tranches.length; i++) {
    if (tranches[i].cle === cle) return tranches[i].libelle;
  }
  return String(cle);
}

function frDate(iso) {
  if (!iso) return '';
  var m = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet',
           'août', 'septembre', 'octobre', 'novembre', 'décembre'];
  var p = String(iso).split('-');
  return Number(p[2]) + ' ' + m[Number(p[1]) - 1];
}


/* ============================================================================
   Partage
   ----------------------------------------------------------------------------
   Sur téléphone, le sélecteur natif s'ouvre avec WhatsApp dedans.
   Sur ordinateur, l'image se télécharge : ce navigateur ne sait pas partager.
   ============================================================================ */

function partagerTicket(canvas, pseudo) {
  canvas.toBlob(function (blob) {
    var nom = 'steevie-' + (pseudo || 'pronostic').toLowerCase().replace(/[^a-z0-9]+/g, '-') + '.png';
    var fichier = new File([blob], nom, { type: 'image/png' });

    if (navigator.canShare && navigator.canShare({ files: [fichier] })) {
      navigator.share({
        files: [fichier],
        title: 'Mon pronostic pour Steevie',
        text: 'Voilà mes paris pour la naissance de Steevie.'
      }).catch(function () { /* partage annulé, rien à signaler */ });
      return;
    }

    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = nom;
    a.click();
    setTimeout(function () { URL.revokeObjectURL(a.href); }, 4000);
  }, 'image/png');
}
