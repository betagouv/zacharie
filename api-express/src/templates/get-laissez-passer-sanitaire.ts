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
import { CarcasseCertificat, User } from '@prisma/client';
import etablissements from '../assets/etablissements-traitement-sanitaire.json';
import dayjs from 'dayjs';

export async function generateLaissezPasserSanitaireDocx(
  data: CarcasseCertificat,
  user: User,
): Promise<Buffer> {
  const etablissementDeTraitementAssainissant = etablissements.data.find(
    (e) => e['Numéro agrément/Approval number'] === data.traitement_assainissant_etablissement,
  );
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
        {
          id: 'subtitle-before-table',
          name: 'Subtitle before table',
          run: {
            font: {
              name: 'Marianne',
            },
            bold: true,
            color: 'FFFFFF', // White text color
          },
          paragraph: {
            spacing: {
              before: 480, // 12pt spacing before (240 twips = 12pt)
              after: 240, // 12pt spacing after
            },
            alignment: AlignmentType.CENTER, // Center text
            shading: {
              type: 'solid',
              color: '7B7B7B', // Gray background
            },
            border: {
              top: {
                color: '000000', // Black border
                style: 'single',
                size: 1,
              },
              bottom: {
                color: '000000',
                style: 'single',
                size: 1,
              },
              left: {
                color: '000000',
                style: 'single',
                size: 1,
              },
              right: {
                color: '000000',
                style: 'single',
                size: 1,
              },
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
                text: `LAISSEZ-PASSER SANITAIRE : ${data.certificat_id}`,
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
              "Vu le règlement d'exécution (UE) 2019/627 de la Commission du 15 mars 2019.",
              'Vu les articles L 231-1, L 231-2 et R 231-7 du Code rural et de la pêche maritime.',
              "Vu l'arrêté du 18 décembre 2009 relatif aux règles sanitaires applicables aux produits d'origine animale et aux denrées alimentaires en contenant.",
            ].map((text) => new TextRun({ text, break: 1, font: 'Marianne' })),
          }),
          // L'agent des services vétérinaires soussigné certifie que les denrées désignées ci-dessous sont consignées, en l'attente d'informations complémentaires :
          new Paragraph({
            children: [
              data.numero_decision_ipm1
                ? new TextRun({
                    text: `Considérant la décision de consigne N° ${data.numero_decision_ipm1}`,
                    font: 'Marianne',
                    break: 1,
                  })
                : null,
              new TextRun({
                text: "Le vétérinaire officiel soussigné certifie que les denrées désignées ci-dessous doivent faire l'objet d'un traitement assainissant obligatoire dans les conditions détaillées dans la présente notification :",
                font: 'Marianne',
                break: 1,
              }),
            ].filter((textRun) => textRun !== null),
          }),
          // Premier tableau: Le vétérinaire officiel soussigné certifie que les denrées désignées ci-dessous doivent faire l'objet d'un traitement assainissant obligatoire dans les conditions détaillées dans la présente notification :
          new Paragraph({
            style: 'subtitle-before-table',
            children: [
              new TextRun({
                text: 'ÉTABLISSEMENT DE TRAITEMENT DU GIBIER SAUVAGE',
                font: 'Marianne',
              }),
            ],
          }),
          new Table({
            columnWidths: [10500],
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
                            text: `Détenteur des denrées : ${data.nom_etg_personne_physique}`,
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
                            text: `Raison sociale : ${data.nom_etg_personne_morale}`,
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
                            text: `Adresse de l'établissement : ${data.lieu_consigne}`,
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
                            text: `Numéro SIRET : ${data.siret_etg}`,
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
                break: 1,
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
                            text: `Numéro de la fiche d'accompagnement du gibier sauvage : ${data.fei_numero}`,
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
                            text: `Espèce : ${data.espece}`,
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
                                text: `Nombre d'animaux : ${data.nombre_d_animaux}`,
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
              data.collecteur_pro
                ? new TableRow({
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
                  })
                : null,
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
            ].filter((row) => row !== null),
          }),
          // Référence de la décision de saisie
          new Paragraph({
            children: [
              new TextRun({
                text: `Référence de la décision de réalisation d'un traitement assainissant : : ${data.numero_decision}`,
                font: 'Marianne',
              }),
            ],
          }),
          // Désignation des denrées consignées
          new Paragraph({
            children: [
              new TextRun({
                text: 'Désignation des pièces et des motifs pour lesquels un traitement assainissant est obligatoire :',
                font: 'Marianne',
                bold: true,
                break: 1,
              }),
            ],
          }),
          // Troisième tableau: Désignation des denrées consignées
          new Table({
            columnWidths: [2500, 8000],
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
                  new TableCell({
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
                  }),
                  new TableCell({
                    columnSpan: 1,
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
                  new TableCell({
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
                  ],
                });
              }),
              data.commentaire
                ? new TableRow({
                    children: [
                      new TableCell({
                        columnSpan: 3,
                        children: [
                          new Paragraph({
                            children: [
                              new TextRun({
                                text: `Informations complémentaires : ${data.commentaire}`,
                                font: 'Marianne',
                              }),
                            ],
                          }),
                        ],
                      }),
                    ],
                  })
                : null,
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
          // Établissement destinataire
          new Paragraph({
            style: 'subtitle-before-table',
            children: [
              new TextRun({
                text: 'ÉTABLISSEMENT DESTINATAIRE',
                font: 'Marianne',
              }),
            ],
          }),
          // Quatrième tableau: Établissement destinataire
          new Table({
            columnWidths: [10500],
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
                            text: `Raison sociale : ${
                              etablissementDeTraitementAssainissant?.[
                                'Raison SOCIALE - Enseigne commerciale/Name'
                              ] || ''
                            }`,
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
                            text: `Adresse de l'établissement : ${
                              etablissementDeTraitementAssainissant?.['Adresse/Adress'] || ''
                            }`,
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
                            text: `Numéro SIRET : ${etablissementDeTraitementAssainissant?.['SIRET'] || ''}`,
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
                            text: `Numéro agrément : ${
                              etablissementDeTraitementAssainissant?.['Numéro agrément/Approval number'] || ''
                            }`,
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
          // Traitement assainissant
          new Paragraph({
            style: 'subtitle-before-table',
            children: [
              new TextRun({
                text: 'TRAITEMENT ASSAINISSANT À APPLIQUER',
                font: 'Marianne',
              }),
            ],
          }),
          // Cinquième tableau: Traitement assainissant
          new Table({
            columnWidths: [10500],
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
                            text: `Type de traitement : ${data.traitement_type}`,
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
                            text: `Paramètres de traitement : ${data.traitement_parametre}`,
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
          // Espacement
          new Paragraph({
            children: [
              new TextRun({
                text: '',
                font: 'Marianne',
                break: 1,
              }),
            ],
          }),
          // Signature et cachet
          new Table({
            columnWidths: [11000],
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
                        alignment: AlignmentType.CENTER,
                        children: [
                          new TextRun({
                            text: "Le vétérinaire officiel autorise le mouvement des produits décrits dans le présent document entre l'établissement expéditeur et l'établissement destinataire identifiés dans le document pour la réalisation d'un traitement assainissant.",
                            font: 'Marianne',
                            bold: true,
                          }),
                          new TextRun({
                            text: `Fait à ${user.ville}, le ${dayjs().format('DD/MM/YYYY')}`,
                            font: 'Marianne',
                            break: 3,
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
          // Explication de la consigne
          new Paragraph({
            children: [
              new TextRun({
                text: "La présente décision peut faire l'objet, dans un délai de deux mois à compter de sa notification, d'un recours contentieux par courrier adressé au tribunal administratif territorialement compétent, ou par l'application Télérecours citoyens accessible à partir du site www.telerecours.fr.",
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
