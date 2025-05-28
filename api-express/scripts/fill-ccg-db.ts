import fs from 'fs-extra';
import path from 'path';
import { parse } from 'csv-parse';
import { EntityRelationType, EntityTypes, Prisma, UserRoles } from '@prisma/client';
import prisma from '~/prisma';

// le fichier est un export Excel de l'administration - non public
// on le transforme en CSV d'abord
//

function insertCCGsDéclarésInDB() {
  const sourcePath = path.resolve('../../ccgs.csv');

  // Check if file exists
  if (!fs.existsSync(sourcePath)) {
    console.error(`CSV file not found at: ${sourcePath}`);
    return;
  }

  // Read and parse CSV file
  fs.createReadStream(sourcePath)
    .pipe(
      parse({
        columns: true, // Use first row as column headers
        skip_empty_lines: true,
      }),
    )
    .on('data', async (row) => {
      // |CCG:82-CCG-2|LIBRE:82-CCG-02| -> 82-CCG-2
      const rawNumeroDdecpp = row[' Unité Activité (UA) :\nIdentifier métier (Type : Valorisation)'];
      const numeroDdecpp = rawNumeroDdecpp.split('|')[1].split(':')[1];

      const cleanRow: Prisma.EntityUncheckedCreateInput = {
        type: EntityTypes.CCG,
        siret: row['Établissement :\nSIRET/NUMAGRIT'],
        nom_d_usage: row['Établissement :\nEnseigne usuelle\n(RESYTAL)'],
        raison_sociale: row['Établissement :\nEnseigne usuelle\n(RESYTAL)'],
        numero_ddecpp: numeroDdecpp,
        address_ligne_1:
          row[
            ' Unité Activité (UA) :\nAdresse de localisation :\nConcaténations des lignes adresses 1, 2 & 3'
          ]?.trim(),
        code_postal: row["Unité d'Activité (UA) :\nCode postal\n(Adresse de localisation)"],
        ville: row[' Unité Activité (UA) :\nAdresse de localisation :\nCommune Nom'],
        ccg_status: 'Déclaré',
      };
      if (!numeroDdecpp) {
        // console.log('No numeroDdecpp found for row:', row);
        return;
      }
      const existingEntity = await prisma.entity.findFirst({
        where: {
          numero_ddecpp: numeroDdecpp,
        },
      });
      if (!existingEntity) {
        console.log('Creating entity:', numeroDdecpp);
        await prisma.entity.create({
          data: cleanRow,
        });
        return;
      }
      console.log('Updating entity:', numeroDdecpp);
      await prisma.entity.update({
        where: { id: existingEntity.id },
        data: cleanRow,
      });
    })
    .on('error', (err) => {
      console.error('Error reading CSV:', err);
    })
    .on('end', () => {
      console.log('Finished reading CSV file');
    });
}

// Call the function
insertCCGsDéclarésInDB();
