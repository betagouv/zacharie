import Chargement from '@app/components/Chargement';
import { capture } from '@app/services/sentry';
import { track } from '@app/services/matomo';
import { createNewFei } from '@app/utils/create-new-fei';
import { createNewCarcasse } from '@app/utils/create-new-carcasse';
import { syncData } from '@app/utils/sync-data';
import useUser from '@app/zustand/user';
import useZustandStore from '@app/zustand/store';
import Button from '@codegouvfr/react-dsfr/Button';
import { UserRoles } from '@prisma/client';
import dayjs from 'dayjs';
import { useEffect, useRef, useState } from 'react';
import { Navigate, useLocation, useNavigate, useSearchParams } from 'react-router';
import { z } from 'zod';
import grandGibier from '@app/data/grand-gibier.json';
import petitGibier from '@app/data/petit-gibier.json';

const allSpecies: string[] = [...grandGibier.especes, ...petitGibier.especes];

const carcasseSchema = z.object({
  numero_bracelet: z.string().min(1, 'Numéro de marquage requis'),
  espece: z.enum(allSpecies as [string, ...string[]], {
    message: 'Espèce invalide',
  }),
  nombre_d_animaux: z.string(),
});

const searchParamsSchema = z.object({
  contexte: z.string().optional(),
  date_mise_a_mort: z
    .string()
    .optional()
    .refine((val) => !val || dayjs(val).isValid(), {
      message: 'Date invalide, format attendu: YYYY-MM-DD',
    }),
  commune_mise_a_mort: z.string().optional(),
  heure_mise_a_mort_premiere_carcasse: z
    .string()
    .optional()
    .refine((val) => !val || /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/.test(val), {
      message: 'Heure invalide, format attendu: HH:mm',
    }),
  heure_evisceration_derniere_carcasse: z
    .string()
    .optional()
    .refine((val) => !val || /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/.test(val), {
      message: 'Heure invalide, format attendu: HH:mm',
    }),
  carcasse: z
    .string()
    .or(z.array(z.string()))
    .optional()
    .transform((val) => {
      if (!val) return [];
      const values = Array.isArray(val) ? val : [val];
      return values.map((carcasseString) => {
        const parts = carcasseString.split(',');
        if (parts.length < 2) {
          throw new Error(
            'Format invalide pour carcasse, attendu: numero_bracelet,espece[,nombre_d_animaux]'
          );
        }
        const [numero_bracelet, espece, nombre_d_animaux = '1'] = parts;
        return {
          numero_bracelet: numero_bracelet.trim(),
          espece: espece.trim(),
          nombre_d_animaux: nombre_d_animaux.trim(),
        };
      });
    })
    .pipe(z.array(carcasseSchema)),
});

type SearchParams = z.infer<typeof searchParamsSchema>;

export default function NouvelleFiche() {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const user = useUser((state) => state.user);
  const hasHydrated = useZustandStore((state) => state._hasHydrated);
  const isExaminateurInitial = !!user?.roles.includes(UserRoles.CHASSEUR) && !!user?.numero_cfei;
  const [error, setError] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);
  const hasCreatedFei = useRef(false);

  useEffect(() => {
    if (!user || !hasHydrated) return;
    if (!isExaminateurInitial) {
      setError(true);
      return;
    }
    if (hasCreatedFei.current) return;
    hasCreatedFei.current = true;
    const searchParamsObject = {
      ...Object.fromEntries(searchParams.entries()),
      carcasse: searchParams.getAll('carcasse'),
    };

    const validationResult = searchParamsSchema.safeParse(searchParamsObject);

    if (!validationResult.success) {
      const errorMessages = validationResult.error.issues
        .map((err) => `${err.path.join('.')}: ${err.message}`)
        .join(', ');
      setValidationError(errorMessages);
      setError(true);
      return;
    }

    const validatedParams: SearchParams = validationResult.data;

    (async () => {
      const newFei = await createNewFei('lien-direct', {
        contexte: validatedParams.contexte,
        date_mise_a_mort: validatedParams.date_mise_a_mort
          ? dayjs.utc(validatedParams.date_mise_a_mort).startOf('day').toDate()
          : undefined,
        commune_mise_a_mort: validatedParams.commune_mise_a_mort,
        heure_mise_a_mort_premiere_carcasse: validatedParams.heure_mise_a_mort_premiere_carcasse,
        heure_evisceration_derniere_carcasse: validatedParams.heure_evisceration_derniere_carcasse,
      });

      for (const carcasseData of validatedParams.carcasse) {
        try {
          await createNewCarcasse({
            zacharieCarcasseId: `${newFei.numero}-${carcasseData.numero_bracelet}`,
            numeroBracelet: carcasseData.numero_bracelet,
            espece: carcasseData.espece,
            nombreDAnimaux: carcasseData.nombre_d_animaux,
            fei: newFei,
          });
        } catch (carcasseError) {
          capture(carcasseError as Error);
        }
      }

      syncData('nouvelle-fiche');
      navigate(`/app/chasseur/fei/${newFei.numero}`, { replace: true });
    })().catch((error) => {
      capture(error);
      setError(true);
    });
  }, [user, hasHydrated, isExaminateurInitial, searchParams, navigate]);

  useEffect(() => {
    if (error) {
      track('fiche', 'bloquer', 'lien-invalide');
    }
  }, [error]);

  if (!user) {
    return (
      <Navigate
        to={`/app/connexion?redirect=${encodeURIComponent(location.pathname + location.search)}`}
        replace
      />
    );
  }

  return (
    <>
      <title>Nouvelle fiche | Zacharie | Ministère de l'Agriculture et de la Souveraineté Alimentaire</title>
      {error ? (
        <CantCreateNewFiche
          validationError={validationError}
          isExaminateurInitial={isExaminateurInitial}
        />
      ) : (
        <Chargement />
      )}
    </>
  );
}

function CantCreateNewFiche({
  validationError,
  isExaminateurInitial,
}: {
  validationError: string | null;
  isExaminateurInitial: boolean;
}) {
  return (
    <main
      role="main"
      id="content"
    >
      <div className="fr-container">
        <div className="fr-my-7w fr-mt-md-12w fr-mb-md-10w fr-grid-row fr-grid-row--gutters fr-grid-row--middle fr-grid-row--center">
          <div className="fr-py-0 fr-col-12 fr-col-md-6">
            <h1 className="fr-h1">Vous ne pouvez pas créer une nouvelle fiche</h1>
            <p className="fr-text--lead fr-mb-3w">
              {!isExaminateurInitial
                ? 'Seul un chasseur examinateur initial peut créer une fiche. Vérifiez que vous êtes connecté avec le bon compte.'
                : validationError
                  ? `Paramètres invalides : ${validationError}`
                  : "Il semble que l'URL fournie est invalide. Veuillez contacter l'administrateur de votre service."}
            </p>
            <Button
              linkProps={{
                to: '/app/connexion',
              }}
            >
              Retour à mon compte
            </Button>
          </div>
        </div>
      </div>
    </main>
  );
}
