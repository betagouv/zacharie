import {
  Document,
  Paragraph,
  Table,
  TableRow,
  TableCell,
  TextRun,
  AlignmentType,
  Footer,
  PageNumber,
  UnderlineType,
  Packer,
  BorderStyle,
} from 'docx';
import { generateHeaderDocx } from './get-header-docx';
import { CarcasseCertificat, CarcasseCertificatType, CarcasseType } from '@prisma/client';
import lesions from '../assets/lesions.json';

function getMotivationDroit(motif: string, carcasseType: CarcasseType) {
  return lesions[carcasseType]
    .map((l) => {
      return {
        ...l,
        'MOTIVATION EN FAIT (CERTIFICAT) + CODE ZACHARIE': `${l['CODE ZACHARIE']}. ${l['MOTIVATION EN FAIT (CERTIFICAT)']}`,
      };
    })
    .find((l) => {
      if (l['MOTIVATION EN FAIT (CERTIFICAT) + CODE ZACHARIE'] === motif) return true;
      if (l['MOTIVATION EN FAIT (CERTIFICAT)'] === motif) return true;
      return false;
    })?.['MOTIVATION EN DROIT (CERTIFICAT)'];
}

export async function generateSaisieDocx(data: CarcasseCertificat): Promise<Buffer> {
  const doc = new Document({
    styles: {
      paragraphStyles: [
        {
          id: 'footer',
          name: 'Footer',
          run: {
            font: {
              name: 'Marianne',
            },
          },
        },
      ],
    },
    sections: [
      {
        properties: {
          page: {
            margin: {
              top: 567,
              bottom: 567,
              left: 567,
              right: 567,
            },
          },
        },
        headers: {
          default: await generateHeaderDocx(data),
        },
        children: [
          // notification de consigne
          new Paragraph({
            children: [
              new TextRun({
                text: `CERTIFICAT DE ${
                  data.type === CarcasseCertificatType.CSP ? 'SAISIE PARTIELLE' : 'SAISIE TOTALE'
                } : ${data.certificat_id}`,
                bold: true,
                size: 24,
                underline: {
                  type: UnderlineType.SINGLE,
                },
                font: 'Marianne',
              }),
            ],
            alignment: AlignmentType.CENTER,
          }),
          // annule et remplace la notification
          data.remplace_certificat_id
            ? new Paragraph({
                children: [
                  new TextRun({
                    text: `ANNULE ET REMPLACE LE CERTIFICAT N° : ${data.remplace_certificat_id}`,
                    bold: true,
                    size: 24,
                    underline: {
                      type: UnderlineType.SINGLE,
                    },
                    font: 'Marianne',
                  }),
                ],
                alignment: AlignmentType.CENTER,
              })
            : new Paragraph(''),
          // Legal texts
          new Paragraph({
            children: [
              'Vu le Règlement (CE) n°1069/2009 du Parlement européen et du Conseil du 21 octobre 2009.',
              'Vu le règlement (UE) 2017/625 du Parlement européen et du Conseil du 15 mars 2017.',
              'Vu le règlement d’exécution (UE) 2019/627 de la Commission du 15 mars 2019.',
              'Vu les articles L 231-1, L 231-2 et R 231-7 du Code rural et de la pêche maritime.',
              "Vu l’arrêté du 18 décembre 2009 relatif aux règles sanitaires applicables aux produits d'origine animale et aux denrées alimentaires en contenant.",
            ].map((text) => new TextRun({ text, break: 1, font: 'Marianne' })),
          }),
          // L'agent des services vétérinaires soussigné certifie que les denrées désignées ci-dessous sont consignées, en l'attente d'informations complémentaires :
          new Paragraph({
            children: [
              new TextRun({
                text: `Considérant la décision de consigne N° ${data.numero_decision_ipm1}`,
                font: 'Marianne',
                break: 3,
              }),
              new TextRun({
                text: 'Le vétérinaire officiel soussigné certifie que les denrées désignées ci-dessous sont retirées de la consommation :',
                font: 'Marianne',
                break: 1,
              }),
            ],
          }),
          // Premier tableau: Le vétérinaire officiel soussigné certifie que les denrées désignées ci-dessous sont retirées de la consommation :
          new Table({
            columnWidths: [5250, 5250],
            margins: {
              top: 50,
            },
            rows: [
              new TableRow({
                children: [
                  new TableCell({
                    children: [
                      new Paragraph({
                        children: [
                          new TextRun({
                            text: `Date de consigne : ${data.date_consigne}`,
                            font: 'Marianne',
                          }),
                        ],
                      }),
                    ],
                  }),
                  new TableCell({
                    children: [
                      new Paragraph({
                        children: [
                          new TextRun({
                            text: `Lieu de consigne : ${data.lieu_consigne}`,
                            font: 'Marianne',
                          }),
                        ],
                      }),
                    ],
                  }),
                ],
              }),
              new TableRow({
                children: [
                  new TableCell({
                    columnSpan: 2,
                    children: [
                      new Paragraph({
                        children: [
                          new TextRun({
                            text: `Détenteur des denrées au moment de la consigne : ${data.nom_etg_personne_physique}`,
                            font: 'Marianne',
                          }),
                        ],
                      }),
                    ],
                  }),
                ],
              }),
            ],
          }),
          // Signalement de la carcasse ou du lot de carcasses :
          new Paragraph({
            children: [
              new TextRun({
                text: 'Signalement de la carcasse ou du lot de carcasses :',
                font: 'Marianne',
                bold: true,
                break: 3,
              }),
            ],
          }),
          // Deuxième tableau: Signalement de la carcasse ou du lot de carcasses
          new Table({
            columnWidths: [4000, 3500, 3000],
            margins: {
              top: 50,
            },
            rows: [
              new TableRow({
                children: [
                  new TableCell({
                    columnSpan: 3,
                    children: [
                      new Paragraph({
                        children: [
                          new TextRun({
                            text: `Numéro de la fiche d’accompagnement du gibier sauvage : ${data.fei_numero}`,
                            font: 'Marianne',
                          }),
                        ],
                      }),
                    ],
                  }),
                ],
              }),
              new TableRow({
                children: [
                  new TableCell({
                    children: [
                      new Paragraph({
                        children: [
                          new TextRun({
                            text: `Numéro d'identification : ${data.numero_bracelet}`,
                            font: 'Marianne',
                          }),
                        ],
                      }),
                    ],
                  }),
                  new TableCell({
                    columnSpan: data.nombre_d_animaux! > 0 ? 1 : 2,
                    children: [
                      new Paragraph({
                        children: [
                          new TextRun({
                            text: `Espèce : ${data.lieu_consigne}`,
                            font: 'Marianne',
                          }),
                        ],
                      }),
                    ],
                  }),
                  data.nombre_d_animaux! > 0
                    ? new TableCell({
                        // columnSpan: 2,
                        children: [
                          new Paragraph({
                            children: [
                              new TextRun({
                                text: `Nombre d’animaux : ${data.nombre_d_animaux}`,
                                font: 'Marianne',
                              }),
                            ],
                          }),
                        ],
                      })
                    : null,
                ].filter((cell) => cell !== null),
              }),
              new TableRow({
                children: [
                  new TableCell({
                    columnSpan: 1,
                    children: [
                      new Paragraph({
                        children: [
                          new TextRun({
                            text: `Date de mise à mort : ${data.date_mise_a_mort}`,
                            font: 'Marianne',
                          }),
                        ],
                      }),
                    ],
                  }),
                  new TableCell({
                    columnSpan: 2,
                    children: [
                      new Paragraph({
                        children: [
                          new TextRun({
                            text: `Commune de mise à mort : ${data.commune_mise_a_mort}`,
                            font: 'Marianne',
                          }),
                        ],
                      }),
                    ],
                  }),
                ],
              }),
              new TableRow({
                children: [
                  new TableCell({
                    columnSpan: 3,
                    children: [
                      new Paragraph({
                        children: [
                          new TextRun({
                            text: `Examinateur initial : ${data.examinateur_initial}`,
                            font: 'Marianne',
                          }),
                        ],
                      }),
                    ],
                  }),
                ],
              }),
              new TableRow({
                children: [
                  new TableCell({
                    columnSpan: 3,
                    children: [
                      new Paragraph({
                        children: [
                          new TextRun({
                            text: `1er détenteur : ${data.premier_detenteur}`,
                            font: 'Marianne',
                          }),
                        ],
                      }),
                    ],
                  }),
                ],
              }),
              new TableRow({
                children: [
                  new TableCell({
                    columnSpan: 3,
                    children: [
                      new Paragraph({
                        children: [
                          new TextRun({
                            text: `Collecteur professionnel : ${data.collecteur_pro}`,
                            font: 'Marianne',
                          }),
                        ],
                      }),
                    ],
                  }),
                ],
              }),
              new TableRow({
                children: [
                  new TableCell({
                    columnSpan: 3,
                    children: [
                      new Paragraph({
                        children: [
                          new TextRun({
                            text: `Destinataire déclaré : ${data.nom_etg_personne_morale}`,
                            font: 'Marianne',
                          }),
                        ],
                      }),
                    ],
                  }),
                ],
              }),
            ],
          }),
          // Référence de la décision de saisie
          new Paragraph({
            children: [
              new TextRun({
                text: `Référence de la décision de saisie : ${data.numero_decision}`,
                font: 'Marianne',
              }),
            ],
          }),
          // Désignation des denrées consignées
          new Paragraph({
            children: [
              new TextRun({
                text: 'Désignation des pièces et des motifs de saisie :',
                font: 'Marianne',
                bold: true,
                break: 3,
              }),
            ],
          }),
          // Troisième tableau: Désignation des denrées consignées
          new Table({
            columnWidths:
              data.type === CarcasseCertificatType.CSP ? [1500, 1500, 3500, 4000] : [1500, 3500, 5500],
            margins: {
              top: 50,
            },
            rows: [
              new TableRow({
                height: {
                  value: 200,
                  rule: 'atLeast',
                },
                children: [
                  data.type === CarcasseCertificatType.CSP
                    ? new TableCell({
                        columnSpan: 1,
                        children: [
                          new Paragraph({
                            children: [
                              new TextRun({
                                text: `Denrées`,
                                font: 'Marianne',
                              }),
                            ],
                          }),
                        ],
                      })
                    : null,
                  new TableCell({
                    columnSpan: 1,
                    children: [
                      new Paragraph({
                        children: [
                          new TextRun({
                            text: `Destination autorisée`,
                            font: 'Marianne',
                          }),
                        ],
                      }),
                    ],
                  }),
                  new TableCell({
                    columnSpan: 2,
                    children: [
                      new Paragraph({
                        children: [
                          new TextRun({
                            text: `Motifs`,
                            font: 'Marianne',
                          }),
                        ],
                      }),
                    ],
                  }),
                ].filter((cell) => cell !== null),
              }),
              new TableRow({
                children: [
                  data.type === CarcasseCertificatType.CSP
                    ? new TableCell({
                        columnSpan: 1,
                        rowSpan: data.motifs.length,
                        children: [
                          new Paragraph({
                            children: [
                              new TextRun({
                                text: data.pieces.join('\n'),
                                font: 'Marianne',
                              }),
                            ],
                          }),
                        ],
                      })
                    : null,
                  new TableCell({
                    columnSpan: 1,
                    rowSpan: data.motifs.length,
                    children: [
                      new Paragraph({
                        children: [
                          new TextRun({
                            text: '',
                            font: 'Marianne',
                          }),
                        ],
                      }),
                    ],
                  }),
                  new TableCell({
                    columnSpan: 1,
                    children: [
                      new Paragraph({
                        children: [
                          new TextRun({
                            text: data.motifs[0],
                            font: 'Marianne',
                          }),
                        ],
                      }),
                    ],
                  }),
                  new TableCell({
                    columnSpan: 1,
                    children: [
                      new Paragraph({
                        children: [
                          new TextRun({
                            text: getMotivationDroit(data.motifs[0], data.carcasse_type),
                            font: 'Marianne',
                          }),
                        ],
                      }),
                    ],
                  }),
                ].filter((cell) => cell !== null),
              }),
              ...data.motifs.slice(1).map((motif) => {
                return new TableRow({
                  cantSplit: true,
                  children: [
                    new TableCell({
                      columnSpan: 1,
                      children: [
                        new Paragraph({
                          children: [
                            new TextRun({
                              text: motif,
                              font: 'Marianne',
                            }),
                          ],
                        }),
                      ],
                    }),
                    new TableCell({
                      columnSpan: 1,
                      children: [
                        new Paragraph({
                          children: [
                            new TextRun({
                              text: getMotivationDroit(motif, data.carcasse_type),
                              font: 'Marianne',
                            }),
                          ],
                        }),
                      ],
                    }),
                  ],
                });
              }),
              new TableRow({
                children: [
                  new TableCell({
                    columnSpan: 3,
                    children: [
                      new Paragraph({
                        children: [
                          new TextRun({
                            text: `Informations complémentaires : ${data.commentaire || ''}`,
                            font: 'Marianne',
                          }),
                        ],
                      }),
                    ],
                  }),
                ],
              }),
              data.poids
                ? new TableRow({
                    children: [
                      new TableCell({
                        columnSpan: 3,
                        children: [
                          new Paragraph({
                            children: [
                              new TextRun({
                                text: `Poids total (en kg): ${data.poids}`,
                                font: 'Marianne',
                              }),
                            ],
                          }),
                        ],
                      }),
                    ],
                  })
                : null,
            ].filter((row) => row !== null),
          }),
          // Espacement
          new Paragraph({
            children: [
              new TextRun({
                text: '',
                font: 'Marianne',
                break: 3,
              }),
            ],
          }),
          // Signature et cachet
          new Table({
            columnWidths: [5500, 5500],
            margins: {
              top: 150,
              bottom: 500,
            },
            rows: [
              new TableRow({
                cantSplit: true,
                children: [
                  new TableCell({
                    columnSpan: 1,
                    children: [
                      new Paragraph({
                        children: [
                          new TextRun({
                            text: `Reçu le ................................. à ......h......`,
                            font: 'Marianne',
                          }),
                          new TextRun({
                            break: 2,
                            text: `Par M..................................
Se déclarant détenteur-propriétaire (1) ou son mandataire, responsable de la déclaration de provenance`,
                            font: 'Marianne',
                          }),
                        ],
                      }),
                      new Paragraph({
                        alignment: AlignmentType.CENTER,
                        children: [
                          new TextRun({
                            break: 3,
                            text: '(Signature)',
                            font: 'Marianne',
                            color: '#B3B3B3',
                            italics: true,
                          }),
                        ],
                      }),
                    ],
                  }),
                  new TableCell({
                    columnSpan: 1,
                    children: [
                      new Paragraph({
                        alignment: AlignmentType.CENTER,
                        children: [
                          new TextRun({
                            text: `Fait à ............................................., le ...............................`,
                            font: 'Marianne',
                          }),
                          new TextRun({
                            break: 1,
                            text: 'Le vétérinaire officiel',
                            font: 'Marianne',
                          }),
                          new TextRun({
                            break: 3,
                            text: '(Signature et cachet)',
                            font: 'Marianne',
                            color: '#B3B3B3',
                            italics: true,
                          }),
                        ],
                      }),
                    ],
                  }),
                ],
              }),
            ],
          }),
          // Rayer les mentions inutiles
          new Paragraph({
            children: [
              new TextRun({
                text: '(1) Rayer les mentions inutiles',
                font: 'Marianne',
                size: 12,
              }),
            ],
          }),
          // Explication de la consigne
          new Paragraph({
            children: [
              new TextRun({
                text: 'La présente décision peut faire l’objet, dans un délai de deux mois à compter de sa notification, d’un recours contentieux par courrier adressé au tribunal administratif territorialement compétent, ou par l’application Télérecours citoyens accessible à partir du site www.telerecours.fr.',
                font: 'Marianne',
                break: 3,
              }),
            ],
          }),
        ],
        footers: {
          default: new Footer({
            children: [
              new Table({
                columnWidths: [3000, 5000, 3000],
                borders: {
                  top: { style: BorderStyle.NONE },
                  bottom: { style: BorderStyle.NONE },
                  left: { style: BorderStyle.NONE },
                  right: { style: BorderStyle.NONE },
                  insideHorizontal: { style: BorderStyle.NONE },
                  insideVertical: { style: BorderStyle.NONE },
                },
                rows: [
                  new TableRow({
                    children: [
                      new TableCell({
                        children: [
                          new Paragraph({
                            alignment: AlignmentType.LEFT,
                            children: [],
                          }),
                        ],
                      }),
                      new TableCell({
                        children: [
                          new Paragraph({
                            alignment: AlignmentType.CENTER,
                            children: [new TextRun({ text: data.certificat_id, font: 'Marianne' })],
                          }),
                        ],
                      }),
                      new TableCell({
                        children: [
                          new Paragraph({
                            alignment: AlignmentType.RIGHT,
                            style: 'footer',
                            children: [
                              new TextRun({
                                children: ['Page ', PageNumber.CURRENT, ' of ', PageNumber.TOTAL_PAGES],
                              }),
                            ],
                          }),
                        ],
                      }),
                    ],
                  }),
                ],
              }),
            ],
          }),
        },
      },
    ],
  });

  return await Packer.toBuffer(doc);
}
