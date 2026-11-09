// Vérifie les calculs du simulateur : node relativite/test-calculs.js
// Le code testé est extrait tel quel de index.html (bloc <script id="calculs">).
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const html = fs.readFileSync(path.join(__dirname, 'index.html'), 'utf8');
const bloc = html.match(/<script id="calculs">([\s\S]*?)<\/script>/);
if (!bloc) { console.error('Bloc <script id="calculs"> introuvable'); process.exit(1); }
const { CONSTANTES: K, Physique: P, Format: F } = vm.runInNewContext(bloc[1] + '\n;({ CONSTANTES, Physique, Format })', { Intl });
const sp = (t) => t.replace(/\u00a0/g, ' ');   // espaces insécables → espaces, pour comparer

let echecs = 0;
function verifie(nom, obtenu, attendu, tol, affiche) {
  const ok = Math.abs(obtenu - attendu) <= tol;
  if (!ok) echecs++;
  console.log(`${ok ? 'OK  ' : 'ÉCHEC'}  ${nom.padEnd(38)} ${String(affiche).padEnd(16)} (attendu ≈ ${attendu})`);
}
function egal(nom, obtenu, attendu) {
  obtenu = sp(obtenu);
  const ok = obtenu === attendu;
  if (!ok) echecs++;
  console.log(`${ok ? 'OK  ' : 'ÉCHEC'}  ${nom.padEnd(38)} « ${obtenu} »${ok ? '' : ` ≠ « ${attendu} »`}`);
}

console.log('— Vitesse (γ = 1/√(1 − v²/c²))');
for (const [pct, attendu] of [[87, 2.03], [99, 7.09], [99.99, 70.7]]) {
  const e = Number((100 - pct).toFixed(2)) / 100;          // comme dans l'interface : on part de 1 − β
  const g = P.gamma(pct / 100, e);
  verifie(`γ(${pct} % c)`, g, attendu, 0.005 * attendu, g.toFixed(4));
}

console.log('— Gravité');
const soleil = P.gravite(P.compacite(K.masseSoleil, K.rayonSoleil));
verifie('Surface du Soleil : retard par an (s)', soleil.deficit * K.an, 67, 0.5, (soleil.deficit * K.an).toFixed(2) + ' s');
const ns = P.gravite(P.compacite(K.masseEtoileNeutrons, K.rayonEtoileNeutrons));
verifie('Étoile à neutrons : facteur', ns.facteur, 0.81, 0.005, ns.facteur.toFixed(4));
const h1000 = P.avanceAltitude(1000) * K.jour * 1e9;
verifie('Altitude 1 000 m (ns/jour)', h1000, 9.4, 0.05, '+' + h1000.toFixed(3));

console.log('— Satellites (µs/jour, par rapport au sol)');
const iss = P.satellite(400e3), gps = P.satellite(20200e3);
verifie('ISS : gravité', iss.graviteUsJour, 3.5, 0.06, '+' + iss.graviteUsJour.toFixed(3));
verifie('ISS : vitesse', -iss.vitesseUsJour, -28, 0.5, (-iss.vitesseUsJour).toFixed(3));
verifie('ISS : total', iss.totalUsJour, -25, 0.5, iss.totalUsJour.toFixed(3));
verifie('GPS : gravité', gps.graviteUsJour, 45.7, 0.05, '+' + gps.graviteUsJour.toFixed(3));
verifie('GPS : vitesse', -gps.vitesseUsJour, -7.2, 0.05, (-gps.vitesseUsJour).toFixed(3));
verifie('GPS : total', gps.totalUsJour, 38.5, 0.05, '+' + gps.totalUsJour.toFixed(3));
verifie('GPS : erreur de position (km/jour)', gps.erreurMetresJour / 1000, 11.5, 0.5, (gps.erreurMetresJour / 1000).toFixed(2) + ' km');

console.log('— Cohérence interne');
// total calculé sans soustraction = gravité − vitesse
for (const h of [400e3, 3e6, 20200e3, 35786e3]) {
  const s = P.satellite(h);
  verifie(`total = gravité − vitesse (${h / 1e3} km)`, s.totalUsJour - (s.graviteUsJour - s.vitesseUsJour), 0, 1e-12, (s.totalUsJour - (s.graviteUsJour - s.vitesseUsJour)).toExponential(1));
}
// altitude d'équilibre : retrouvée par dichotomie sur gravité − vitesse
let a = 400e3, b = 40000e3;
for (let i = 0; i < 100; i++) { const m = (a + b) / 2; const s = P.satellite(m); (s.graviteUsJour - s.vitesseUsJour < 0 ? (a = m) : (b = m)); }
verifie('Altitude d\'équilibre (km), dichotomie', a / 1e3, P.altitudeEquilibre / 1e3, 0.001, (P.altitudeEquilibre / 1e3).toFixed(1) + ' km');
// périodes orbitales connues (vérifie G·M de la Terre)
verifie('Période GPS (h)', gps.periode / 3600, 11.97, 0.02, (gps.periode / 3600).toFixed(3) + ' h');
verifie('Période géostationnaire (h)', P.satellite(35786e3).periode / 3600, 23.93, 0.02, (P.satellite(35786e3).periode / 3600).toFixed(3) + ' h');
// stabilité numérique : petit x, formule directe en précision étendue (série) vs formule stable
const xT = P.compacite(K.masseTerre, K.rayonTerre);
const serie = xT / 2 + xT * xT / 8 + xT ** 3 / 16;
verifie('Terre : 1 − √(1−x) stable vs série', P.gravite(xT).deficit / serie - 1, 0, 1e-14, (P.gravite(xT).deficit / serie - 1).toExponential(1));
const naif = 1 - Math.sqrt(1 - xT);
console.log(`      (pour info, calcul naïf 1 − √(1−x) : erreur relative ${(naif / serie - 1).toExponential(1)})`);
// γ − 1 à faible vitesse (1 % de c) : β²γ²/(γ+1) vs série β²/2 + 3β⁴/8
const gm1 = P.gammaMoins1(0.01, 0.99);
verifie('γ − 1 à 1 % de c, stable vs série', gm1 / (0.01 ** 2 / 2 + 3 * 0.01 ** 4 / 8 + 5 * 0.01 ** 6 / 16) - 1, 0, 1e-12, gm1.toExponential(6));
// trou noir : près de l'horizon
const tn = P.graviteTrouNoir(0.001);
verifie('Trou noir à 1,001 rs : facteur', tn.facteur, Math.sqrt(0.001 / 1.001), 1e-15, tn.facteur.toFixed(5));

console.log('— Horloges « grossies » : l\'ordre réel des astres est conservé');
const astres = [
  ['Terre', P.gravite(P.compacite(K.masseTerre, K.rayonTerre)).deficit],
  ['Soleil', soleil.deficit],
  ['Naine blanche', P.gravite(P.compacite(K.masseNaineBlanche, K.rayonNaineBlanche)).deficit],
  ['Trou noir à 10 rs', P.graviteTrouNoir(9).deficit],
  ['Étoile à neutrons', ns.deficit],
];
const visibles = astres.map(([n, d]) => [n, d * F.grossissement(d), F.grossissement(d)]);
visibles.forEach(([n, v, g]) => console.log(`      ${n.padEnd(20)} écart affiché ${(100 * v).toFixed(2).padStart(6)} %  (grossi ×${g})`));
const ordre = visibles.every((x, i) => i === 0 || x[1] > visibles[i - 1][1]);
verifie('Ordre Terre < Soleil < naine < TN 10 rs < NS', ordre ? 1 : 0, 1, 0, ordre ? 'respecté' : 'NON');

console.log('— Affichage (tel que dans la page)');
egal('γ(87 %)', F.sig(P.gamma(0.87, 0.13), 3), '2,03');
egal('γ(99 %)', F.sig(P.gamma(0.99, 0.01), 3), '7,09');
egal('γ(99,99 %)', F.sig(P.gamma(0.9999, 0.0001), 3), '70,7');
egal('Soleil : retard par an', F.duree(soleil.deficit * K.an), '67 s');
egal('Étoile à neutrons : facteur', F.facteur(ns.facteur, ns.deficit), '0,810');
egal('Terre : facteur', F.facteur(P.gravite(xT).facteur, P.gravite(xT).deficit), '0,999 999 999 30');
egal('Terre : 1 h ici =', F.uneHeure(P.gravite(xT).facteur, P.gravite(xT).deficit), '1 h + 2,51 µs');
egal('Altitude 1 000 m : par jour', F.duree(P.avanceAltitude(1000) * K.jour), '9,43 ns');
egal('GPS : erreur', F.distanceMetres(gps.erreurMetresJour), '11,5 km');
egal('Durée 1 h 14 min', F.duree(4446.7), '1 h 14 min');
egal('Pas de « −0 »', F.fixe(-0.001, 2, true), '0,00');

console.log(echecs ? `\n${echecs} échec(s).` : '\nTous les calculs sont conformes.');
process.exit(echecs ? 1 : 0);
