import path from 'path';
import fs from 'fs/promises';
import {
  Paragraph,
  Table,
  TableRow,
  TableCell,
  TextRun,
  AlignmentType,
  Header,
  ImageRun,
  WidthType,
  BorderStyle,
} from 'docx';
import { CarcasseCertificat } from '@prisma/client';

export async function generateHeaderDocx(data: CarcasseCertificat) {
  const header = new Header({
    children: [
      new Table({
        columnWidths: [2000, 8000],
        rows: [
          new TableRow({
            children: [
              new TableCell({
                width: {
                  size: 2000,
                  type: WidthType.DXA,
                },
                children: [
                  new Paragraph({
                    children: [
                      new ImageRun({
                        data: await fs.readFile(path.join(process.cwd(), 'src/assets/logo_rf.png')),
                        type: 'png',
                        transformation: {
                          width: 120,
                          height: 100,
                        },
                      }),
                    ],
                  }),
                ],
              }),
              new TableCell({
                width: {
                  size: 8000,
                  type: WidthType.DXA,
                },
                children: [
                  new Paragraph({
                    alignment: AlignmentType.LEFT,
                    children: [
                      new TextRun({
                        text: data.prefecture_svi,
                        bold: true,
                        size: 24,
                        // allCaps: true,
                        font: 'Marianne',
                      }),
                    ],
                  }),
                  new Paragraph({
                    alignment: AlignmentType.LEFT,
                    children: [
                      new TextRun({
                        text: `Service vétérinaire d'inspection de l'établissement de traitement du gibier sauvage de ${data.commune_etg}`,
                        bold: true,
                        size: 24, // measured in half-points
                        // allCaps: true,
                        font: 'Marianne',
                      }),
                    ],
                  }),
                ],
              }),
            ],
          }),
        ],
        borders: {
          top: { style: BorderStyle.NONE },
          bottom: { style: BorderStyle.NONE },
          left: { style: BorderStyle.NONE },
          right: { style: BorderStyle.NONE },
          insideHorizontal: { style: BorderStyle.NONE },
          insideVertical: { style: BorderStyle.NONE },
        },
      }),
    ],
  });

  return header;
}
