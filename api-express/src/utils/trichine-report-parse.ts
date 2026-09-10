import { TrichineResultatAnalyse } from '@prisma/client';
import { normalizeLimsValue } from '~/utils/lims-mapping';

/**
 * Lecture du verdict dans le texte d'un rapport COFRAC (cf utils/pdf-text.ts pour l'extraction).
 *
 * Objectif : éviter au laboratoire de ressaisir dans Zacharie ce qu'il a déjà écrit dans son
 * rapport. On ne conclut que sur un verdict **non ambigu** : un rapport qui cite plusieurs
 * résultats (légende « négatif / douteux / positif », phrase type « en cas de résultat non
 * négatif… ») ne donne rien, et la saisie manuelle reste le chemin.
 *
 * Priorité au libellé de résultat (« Résultat : négatif », « Commentaires : … ») ; à défaut, le
 * texte entier, à condition qu'il ne porte qu'un seul verdict. Cette priorité est ce qui sauve les
 * rapports réels : ils portent tous une légende des codes (« neg = négatif, NON_NEG = non
 * négatif, QI = quantité insuffisante… ») qui, lue seule, rend le document ambigu.
 */

export type TrichineReportSource = 'LIBELLE_RESULTAT' | 'TEXTE_COMPLET';

export type ParsedTrichineReport = {
  resultat: TrichineResultatAnalyse | null;
  // Ce qui a été lu (texte normalisé), conservé pour diagnostiquer une lecture douteuse
  extrait: string | null;
  source: TrichineReportSource | null;
  // Plusieurs verdicts contradictoires dans le rapport : on ne conclut pas
  ambigu: boolean;
  parasite_identifie?: string;
  reference_labo?: string;
};

/**
 * Ordre significatif : « non négatif » doit être reconnu avant « négatif », et la règle NEGATIF
 * refuse explicitement un « négatif » précédé de « non ».
 */
const VERDICT_RULES: Array<{ resultat: TrichineResultatAnalyse; pattern: RegExp }> = [
  { resultat: TrichineResultatAnalyse.NON_NEGATIF, pattern: /non[- ]negati(f|ve|fs|ves)\b/ },
  { resultat: TrichineResultatAnalyse.PRESENCE_PARASITE_NON_IDENTIFIE, pattern: /parasite non identifie/ },
  {
    resultat: TrichineResultatAnalyse.POSITIF,
    pattern:
      /\bpositi(f|ve|fs|ves)\b|presence de (larve|trichine|trichinella)|(?<!non )larves? detectees?|(?<!non )detectees?\b/,
  },
  { resultat: TrichineResultatAnalyse.DOUTEUX, pattern: /\bdouteu(x|se|ses)\b/ },
  {
    resultat: TrichineResultatAnalyse.ANALYSE_IMPOSSIBLE,
    pattern:
      /analyse impossible|non analysable|echantillons? non conformes?|quantite insuffisante|ininterpretable/,
  },
  {
    resultat: TrichineResultatAnalyse.NEGATIF,
    pattern: /(?<!non[- ])\bnegati(f|ve|fs|ves)\b|absence de (larve|trichine|trichinella)|non detectees?\b/,
  },
];

/**
 * « Résultat : … », « Conclusion : … », « Commentaires : … » — on lit jusqu'à la fin de la phrase.
 * Les astérisques et underscores sont tolérés autour du libellé : l'OCR rend le gras en markdown
 * (« **Commentaires** : … »).
 * `Commentaires` porte la conclusion de synthèse dans les rapports réels (« analyse libératoire
 * négative pour les 5 échantillons »), là où le tableau d'échantillons n'a pas de libellé.
 */
const LABEL_PATTERN =
  /(?:resultats?|conclusions?|interpretation|commentaires?)[*_\s]*(?:\s*(?:de|d)\s*l\s*analyse)?[*_\s]*[:\-–]\s*([^.;|]{1,120})/g;

const PARASITE_PATTERN =
  /parasite\s*(?:identifie)?\s*[:\-–]?\s*(trichinella\s+[a-z]+)|\b(trichinella\s+[a-z]+)/;
const REFERENCE_LABO_PATTERN =
  /(?:reference|ref\.?|n°|numero)\s*(?:labo(?:ratoire)?|interne|dossier|rapport|echantillon)\s*[:\-–]?\s*([a-z0-9][a-z0-9\/_-]{2,29})/;

function verdictsIn(text: string): Array<{ resultat: TrichineResultatAnalyse; extrait: string }> {
  const found: Array<{ resultat: TrichineResultatAnalyse; extrait: string }> = [];
  for (const rule of VERDICT_RULES) {
    const match = text.match(rule.pattern);
    if (match) found.push({ resultat: rule.resultat, extrait: match[0] });
  }
  return found;
}

export function findResultSegments(normalized: string): string[] {
  return [...normalized.matchAll(LABEL_PATTERN)].map((match) => match[1].trim()).filter(Boolean);
}

export function parseTrichineReport(text: string): ParsedTrichineReport {
  const normalized = normalizeLimsValue(text);
  const base: ParsedTrichineReport = { resultat: null, extrait: null, source: null, ambigu: false };

  const parasiteMatch = normalized.match(PARASITE_PATTERN);
  const referenceMatch = normalized.match(REFERENCE_LABO_PATTERN);
  const details = {
    parasite_identifie: parasiteMatch ? (parasiteMatch[1] ?? parasiteMatch[2]) : undefined,
    reference_labo: referenceMatch ? referenceMatch[1] : undefined,
  };

  for (const source of ['LIBELLE_RESULTAT', 'TEXTE_COMPLET'] as const) {
    const zones = source === 'LIBELLE_RESULTAT' ? findResultSegments(normalized) : [normalized];
    const verdicts = new Map<TrichineResultatAnalyse, string>();
    for (const zone of zones) {
      for (const verdict of verdictsIn(zone)) {
        if (!verdicts.has(verdict.resultat)) verdicts.set(verdict.resultat, zone.trim());
      }
    }
    if (verdicts.size === 1) {
      const [resultat, extrait] = [...verdicts.entries()][0];
      return { ...base, ...details, resultat, extrait: extrait.slice(0, 200), source };
    }
    // Verdicts contradictoires dans le libellé : inutile d'élargir au texte entier, il n'aura pas
    // moins de bruit. On s'arrête là et la saisie reste manuelle.
    if (verdicts.size > 1) {
      return { ...base, ...details, ambigu: true, source };
    }
  }

  return { ...base, ...details };
}

/**
 * Traduit le verdict tel que l'écrit le laboratoire vers le vocabulaire Zacharie.
 *
 * Les rapports de LVD écrivent « non négatif » (leur légende : « NON_NEG = non négatif ») quand
 * ils ont détecté une larve. Or dans Zacharie ce constat s'appelle `DOUTEUX` — cf doc/trichine.md
 * §2 : « Résultat douteux : LVD a détecté une larve, confirmation LNR obligatoire », tandis que
 * `NON_NEGATIF` est réservé au LNR (« identifie une larve autre que trichine »).
 *
 * Un LVD ne conclut donc jamais que NEGATIF ou DOUTEUX : tout constat non négatif de sa part,
 * quels que soient ses mots, vaut DOUTEUX et déclenche la confirmation par le LNR.
 */
export function traduireVerdictLaboratoire(
  resultat: TrichineResultatAnalyse,
  isLnr: boolean
): TrichineResultatAnalyse {
  if (isLnr) return resultat;
  const constatsNonNegatifs: TrichineResultatAnalyse[] = [
    TrichineResultatAnalyse.NON_NEGATIF,
    TrichineResultatAnalyse.PRESENCE_PARASITE_NON_IDENTIFIE,
    TrichineResultatAnalyse.POSITIF,
  ];
  return constatsNonNegatifs.includes(resultat) ? TrichineResultatAnalyse.DOUTEUX : resultat;
}
