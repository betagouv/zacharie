import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const dataDir = path.join(here, '..', 'src', 'data', 'anomalies');
const photosDir = path.join(here, '..', 'public', 'anomalies');

const csvPath = process.argv[2];
if (!csvPath) {
  console.error('Usage : node scripts/generate-anomalies-referentiel.mjs <chemin-du-csv>');
  process.exit(1);
}

function parseCsv(text) {
  const rows = [];
  let row = [];
  let cur = '';
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          cur += '"';
          i++;
        } else {
          quoted = false;
        }
      } else {
        cur += c;
      }
      continue;
    }
    if (c === '"') quoted = true;
    else if (c === ',') {
      row.push(cur);
      cur = '';
    } else if (c === '\n') {
      row.push(cur);
      rows.push(row);
      row = [];
      cur = '';
    } else if (c !== '\r') cur += c;
  }
  if (cur || row.length) {
    row.push(cur);
    rows.push(row);
  }
  return rows;
}

const clean = (value) => (value ?? '').trim().replace(/\s+/g, ' ');

const FAMILLES_CORRIGEES = {
  'Système circulation (cœur)': 'Système circulatoire (cœur)',
  'Système digestif (foie, intestins': 'Système digestif (foie, intestins)',
};
const famille = (value) => {
  const normalized = clean(value);
  return FAMILLES_CORRIGEES[normalized] ?? normalized;
};

function photos(value) {
  const numeros = [...clean(value).matchAll(/\d+/g)].map((m) => m[0]);
  return [...new Set(numeros)].map((n) => `Image${n}.webp`);
}

const raw = fs.readFileSync(csvPath, 'utf8').replace(/^﻿/, '');
const rows = parseCsv(raw).slice(1);

const sections = [];
const sectionsByKey = new Map();
const photosManquantes = new Set();

for (const row of rows) {
  if (!row.some((cell) => cell.trim())) continue;
  const [categorie, anomalie, infobulle, famille_, message, niveau, photo] = row;
  const groupe = clean(categorie);
  const site = famille(famille_);
  const intitule = clean(anomalie);
  if (!groupe || !intitule) continue;

  const key = `${groupe}|||${site}`;
  let section = sectionsByKey.get(key);
  if (!section) {
    section = { groupe, site: site || null, anomalies: [], champ_libre: null };
    sectionsByKey.set(key, section);
    sections.push(section);
  }

  if (intitule.startsWith('Champ libre :')) {
    section.champ_libre = clean(intitule.slice('Champ libre :'.length));
    continue;
  }

  const fichiers = photos(photo);
  for (const fichier of fichiers) {
    if (!fs.existsSync(path.join(photosDir, fichier))) photosManquantes.add(fichier);
  }

  section.anomalies.push({
    intitule,
    infobulle: clean(infobulle) || null,
    message: clean(message) || null,
    alert_level: /^\d+$/.test(clean(niveau)) ? Number(clean(niveau)) : null,
    photos: fichiers,
  });
}

if (photosManquantes.size > 0) {
  console.error(
    `Photos référencées mais absentes de public/anomalies/ : ${[...photosManquantes].join(', ')}`
  );
  process.exit(1);
}

const grosPath = path.join(dataDir, 'gros.json');
fs.writeFileSync(grosPath, `${JSON.stringify(sections, null, 2)}\n`);

const petitPath = path.join(dataDir, 'petit.json');
const petit = JSON.parse(fs.readFileSync(petitPath, 'utf8')).map((section) => ({
  groupe: section.groupe,
  site: section.site,
  anomalies: section.anomalies.map((anomalie) => ({
    intitule: anomalie.intitule,
    infobulle: anomalie.infobulle,
    message: anomalie.message,
    alert_level: anomalie.alert_level ?? null,
    photos: anomalie.photos,
  })),
  champ_libre: section.champ_libre ?? null,
}));
fs.writeFileSync(petitPath, `${JSON.stringify(petit, null, 2)}\n`);

const nbAnomalies = sections.reduce((total, s) => total + s.anomalies.length, 0);
const nbNiveaux = sections.reduce(
  (total, s) => total + s.anomalies.filter((a) => a.alert_level !== null).length,
  0
);
const nbChampsLibres = sections.filter((s) => s.champ_libre).length;
console.log(
  `gros.json : ${sections.length} familles, ${nbAnomalies} anomalies, ${nbNiveaux} avec niveau, ${nbChampsLibres} champs libres`
);
