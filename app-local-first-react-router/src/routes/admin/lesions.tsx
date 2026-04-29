import { useMemo, useState } from 'react';
import { Table } from '@codegouvfr/react-dsfr/Table';
import { Tabs, type TabsProps } from '@codegouvfr/react-dsfr/Tabs';
import { Input } from '@codegouvfr/react-dsfr/Input';
import { Button } from '@codegouvfr/react-dsfr/Button';
import { Badge } from '@codegouvfr/react-dsfr/Badge';
import { Checkbox } from '@codegouvfr/react-dsfr/Checkbox';
import { CarcasseType } from '@prisma/client';
import lesions from '@app/data/svi/lesions.json';

// Doit rester aligné avec api-express/src/controllers/stats.ts (BPH_PATTERNS).
// Le backend matche en lowercase sur `svi_ipm2_lesions_ou_motifs`, qui contient
// la valeur `MOTIVATION EN FAIT (CERTIFICAT)` (cf. utils/lesions.ts → lesionsList).
const BPH_PATTERNS = [
  "souillures d'origine digestive",
  'souillures telluriques',
  'odeur anormale',
  'putréfaction superficielle',
  'putréfaction profonde',
  'moisissures',
  'œufs ou larves de mouche',
  'morsure de chien',
  'viande à évolution anormale',
  'conditions de préparation des viandes par le producteur primaire',
  "souillures d’origine digestive liées à une balle d'abdomen",
  'souillures d’origine digestive',
];

function isBphMotif(item: { 'MOTIVATION EN FAIT (CERTIFICAT)': string }) {
  const motif = item['MOTIVATION EN FAIT (CERTIFICAT)'].toLowerCase();
  return BPH_PATTERNS.some((p) => motif.includes(p.toLowerCase()));
}

type LesionItem = {
  'CODE ZACHARIE': string;
  "COMPLEMENTS D'INFORMATION POUR 1ER DETENTEUR ET EXAMINATEUR INITIAL": string;
  'DESTINATION AUTORISEE': string;
  'FAMILLES DE LESIONS': string;
  'MOTIVATION EN DROIT (CERTIFICAT)': string;
  'MOTIVATION EN FAIT (CERTIFICAT)': string;
  'VULGARISATION POUR PREMIER DÉTENTEUR ET EXAMINATEUR INITIAL': string;
};

const allLesions = lesions as Record<CarcasseType, LesionItem[]>;

function naturalCodeKey(code: string) {
  const match = code.match(/^([A-Za-z]+)(\d+)$/);
  if (!match) return [code, 0] as const;
  return [match[1], Number(match[2])] as const;
}

function sortLesions(items: LesionItem[]) {
  return [...items].sort((a, b) => {
    const famCmp = a['FAMILLES DE LESIONS'].localeCompare(b['FAMILLES DE LESIONS'], 'fr');
    if (famCmp !== 0) return famCmp;
    const [aPrefix, aNum] = naturalCodeKey(a['CODE ZACHARIE']);
    const [bPrefix, bNum] = naturalCodeKey(b['CODE ZACHARIE']);
    if (aPrefix !== bPrefix) return aPrefix.localeCompare(bPrefix, 'fr');
    return aNum - bNum;
  });
}

const CSV_COLUMNS: Array<keyof LesionItem> = [
  'CODE ZACHARIE',
  'FAMILLES DE LESIONS',
  'MOTIVATION EN FAIT (CERTIFICAT)',
  'VULGARISATION POUR PREMIER DÉTENTEUR ET EXAMINATEUR INITIAL',
  'DESTINATION AUTORISEE',
  "COMPLEMENTS D'INFORMATION POUR 1ER DETENTEUR ET EXAMINATEUR INITIAL",
  'MOTIVATION EN DROIT (CERTIFICAT)',
];

function csvEscape(value: string) {
  if (value == null) return '';
  const needsQuoting = /[",;\r\n]/.test(value);
  const escaped = value.replace(/"/g, '""');
  return needsQuoting ? `"${escaped}"` : escaped;
}

function buildCsv(type: CarcasseType, items: LesionItem[]) {
  const header = ['TYPE_GIBIER', ...CSV_COLUMNS, 'INCLUS_DANS_SCORE_BPH'].map(csvEscape).join(';');
  const rows = items.map((item) =>
    [type, ...CSV_COLUMNS.map((col) => item[col] ?? ''), isBphMotif(item) ? 'oui' : 'non']
      .map(csvEscape)
      .join(';')
  );
  return [header, ...rows].join('\r\n');
}

function downloadCsv(filename: string, csv: string) {
  // BOM ﻿ pour qu'Excel ouvre l'UTF-8 correctement
  const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

function matchesSearch(item: LesionItem, needle: string) {
  if (!needle) return true;
  const haystack = [
    item['CODE ZACHARIE'],
    item['FAMILLES DE LESIONS'],
    item['MOTIVATION EN FAIT (CERTIFICAT)'],
    item['VULGARISATION POUR PREMIER DÉTENTEUR ET EXAMINATEUR INITIAL'],
    item['DESTINATION AUTORISEE'],
    item["COMPLEMENTS D'INFORMATION POUR 1ER DETENTEUR ET EXAMINATEUR INITIAL"],
  ]
    .join(' ')
    .toLowerCase();
  return haystack.includes(needle.toLowerCase());
}

export default function AdminLesions() {
  const [selectedTabId, setSelectedTabId] = useState<CarcasseType>(CarcasseType.GROS_GIBIER);
  const [search, setSearch] = useState('');
  const [onlyBph, setOnlyBph] = useState(false);

  const tabs: TabsProps['tabs'] = [
    {
      tabId: CarcasseType.GROS_GIBIER,
      label: `Gros gibier (${allLesions.GROS_GIBIER.length})`,
    },
    {
      tabId: CarcasseType.PETIT_GIBIER,
      label: `Petit gibier (${allLesions.PETIT_GIBIER.length})`,
    },
  ];

  const filtered = useMemo(() => {
    const items = allLesions[selectedTabId] ?? [];
    return sortLesions(
      items.filter((item) => matchesSearch(item, search)).filter((item) => !onlyBph || isBphMotif(item))
    );
  }, [selectedTabId, search, onlyBph]);

  const totalForTab = allLesions[selectedTabId]?.length ?? 0;
  const bphCountForTab = useMemo(
    () => (allLesions[selectedTabId] ?? []).filter(isBphMotif).length,
    [selectedTabId]
  );

  const handleExportTab = () => {
    const csv = buildCsv(selectedTabId, sortLesions(allLesions[selectedTabId] ?? []));
    downloadCsv(`zacharie-motifs-saisies-${selectedTabId.toLowerCase()}.csv`, csv);
  };

  const handleExportAll = () => {
    const all = (Object.keys(allLesions) as CarcasseType[]).flatMap((type) =>
      sortLesions(allLesions[type]).map((item) => ({ type, item }))
    );
    const header = ['TYPE_GIBIER', ...CSV_COLUMNS].map(csvEscape).join(';');
    const rows = all.map(({ type, item }) =>
      [type, ...CSV_COLUMNS.map((col) => item[col] ?? '')].map(csvEscape).join(';')
    );
    downloadCsv('zacharie-motifs-saisies.csv', [header, ...rows].join('\r\n'));
  };

  return (
    <div className="p-2 md:p-4">
      <title>
        Motifs de saisies | Admin | Zacharie | Ministère de l'Agriculture et de la Souveraineté Alimentaire
      </title>
      <div className="mb-4 flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="fr-h3 mb-1">Motifs de saisies</h1>
          <p className="text-sm text-gray-600">
            Référentiel statique des lésions et motifs de saisies utilisés dans Zacharie.
          </p>
        </div>
        <div className="flex shrink-0 gap-2">
          <Button
            size="small"
            priority="secondary"
            iconId="fr-icon-download-line"
            onClick={handleExportTab}
          >
            Exporter cet onglet (CSV)
          </Button>
          <Button
            size="small"
            iconId="fr-icon-download-line"
            onClick={handleExportAll}
          >
            Tout exporter (CSV)
          </Button>
        </div>
      </div>
      <section className="mb-4 bg-white md:shadow-sm">
        <Tabs
          selectedTabId={selectedTabId}
          tabs={tabs}
          onTabChange={(tabId) => setSelectedTabId(tabId as CarcasseType)}
          className="[&_.fr-tabs\_\_list]:bg-alt-blue-france! mb-6 bg-white md:shadow-sm [&_.fr-tabs\_\_list]:shadow-none!"
        >
          <div className="p-4 md:p-8 md:pb-0">
            <div className="mb-2 flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
              <Input
                label="Rechercher"
                hintText="Code, famille, motivation en fait, vulgarisation, destination, compléments…"
                nativeInputProps={{
                  type: 'search',
                  value: search,
                  onChange: (e) => setSearch(e.target.value),
                  placeholder: 'ex. abcès, G12, C2…',
                }}
                className="grow"
              />
              <p className="text-sm text-gray-600 md:pb-4">
                {filtered.length} motif{filtered.length > 1 ? 's' : ''} affiché
                {filtered.length > 1 ? 's' : ''} sur {totalForTab}
              </p>
            </div>
            <Checkbox
              className="mb-4"
              options={[
                {
                  label: (
                    <span className="text-sm">
                      Afficher uniquement les motifs inclus dans le score BPH
                      <Badge
                        small
                        severity="warning"
                        className="ml-2 align-middle"
                      >
                        BPH ({bphCountForTab})
                      </Badge>
                    </span>
                  ),
                  hintText:
                    "Bonnes Pratiques d'Hygiène — sous-ensemble des motifs IPM2 utilisé dans le calcul du score d'hygiène.",
                  nativeInputProps: {
                    checked: onlyBph,
                    onChange: (e) => setOnlyBph(e.target.checked),
                  },
                },
              ]}
            />
            <Table
              fixed
              noCaption
              className="[&_td]:align-top [&_th]:align-top [&_tr]:hover:bg-blue-50"
              headers={[
                'Famille',
                'Motivation en fait',
                'Vulgarisation',
                'Destination',
                'Compléments',
                'Motivation en droit',
              ]}
              data={filtered.map((item) => {
                const bph = isBphMotif(item);
                return [
                  <div key="famille">
                    {item['FAMILLES DE LESIONS']}
                    {bph && (
                      <Badge
                        small
                        severity="warning"
                        className="w-fit"
                      >
                        BPH
                      </Badge>
                    )}
                  </div>,
                  item['MOTIVATION EN FAIT (CERTIFICAT)'],
                  item['VULGARISATION POUR PREMIER DÉTENTEUR ET EXAMINATEUR INITIAL'],
                  <span
                    key="dest"
                    className="font-mono whitespace-nowrap"
                  >
                    {item['DESTINATION AUTORISEE']}
                  </span>,
                  item["COMPLEMENTS D'INFORMATION POUR 1ER DETENTEUR ET EXAMINATEUR INITIAL"] || (
                    <span className="text-gray-400">—</span>
                  ),
                  <details key="droit">
                    <summary className="cursor-pointer text-sm text-gray-700">Voir le texte</summary>
                    <p className="mt-2 text-xs whitespace-pre-line text-gray-700">
                      {item['MOTIVATION EN DROIT (CERTIFICAT)']}
                    </p>
                  </details>,
                ];
              })}
            />
            {filtered.length === 0 && (
              <p className="py-8 text-center text-sm text-gray-500">
                Aucun motif ne correspond à la recherche.
              </p>
            )}
          </div>
        </Tabs>
      </section>
    </div>
  );
}
