import fs from 'fs';
import path from 'path';

const filePath = path.join('./villes.json');
const jsonData = JSON.parse(fs.readFileSync(filePath, 'utf8'));

const modifiedData = jsonData.map((item) => ({
  c: item.code_postal.toString().padStart(5, '0'),
  v: item.ville,
}));

fs.writeFileSync(filePath, JSON.stringify(modifiedData));

console.log('File updated successfully');
