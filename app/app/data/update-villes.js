import fs from "fs";
import path from "path";

// Read the JSON file
const filePath = path.join("./villes.json");
const jsonData = JSON.parse(fs.readFileSync(filePath, "utf8"));

// Modify the data
const modifiedData = jsonData.map((item) => ({
  ...item,
  code_postal: item.code_postal.toString().padStart(5, "0"),
  code_postal_ville: `${item.code_postal.toString().padStart(5, "0")} ${item.ville}`,
}));

// Write the modified data back to the file
fs.writeFileSync(filePath, JSON.stringify(modifiedData, null, 2));

console.log("File updated successfully");
