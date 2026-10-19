import fs from 'fs';
import path from 'path';

// Transforme le référentiel brut des communes ({ code_postal, ville }) vers le format compact
// stocké dans villes.json : clés abrégées (c = code postal, v = ville) et écriture sans
// indentation, car le fichier est importé dans le bundle (~39 000 communes, chaque caractère
// compte). `code_postal_ville` n'est pas stocké : utils/search-ville.ts le recompose à la lecture.
const filePath = path.join('./villes.json');
const jsonData = JSON.parse(fs.readFileSync(filePath, 'utf8'));

const modifiedData = jsonData.map((item) => ({
  c: item.code_postal.toString().padStart(5, '0'),
  v: item.ville,
}));

fs.writeFileSync(filePath, JSON.stringify(modifiedData));

console.log('File updated successfully');
