import { UserConnexionResponse } from '@api/src/types/responses';
import Chargement from '@app/components/Chargement';
import API from '@app/services/api';
import { capture } from '@app/services/sentry';
import { createNewFei } from '@app/utils/create-new-fei';
import { createNewCarcasse } from '@app/utils/create-new-carcasse';
import useZustandStore from '@app/zustand/store';
import useUser from '@app/zustand/user';
import Button from '@codegouvfr/react-dsfr/Button';
import dayjs from 'dayjs';
import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router';
import { z } from 'zod';
import grandGibier from '@app/data/grand-gibier.json';
import petitGibier from '@app/data/petit-gibier.json';

// All valid species from both petit and grand gibier
const allSpecies: string[] = [...grandGibier.especes, ...petitGibier.especes];

// Zod schema for individual carcasse
const carcasseSchema = z.object({
  numero_bracelet: z.string().min(1, 'Numéro de bracelet requis'),
  espece: z.enum(allSpecies as [string, ...string[]], {
    message: 'Espèce invalide',
  }),
  nombre_d_animaux: z.string(),
});

// Zod schema for search params validation
const searchParamsSchema = z.object({
  access_token: z.string().min(1, 'Access token requis'),
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
      // Handle both single string and array of strings (for multiple carcasse params)
      const values = Array.isArray(val) ? val : [val];
      return values.map((carcasseString) => {
        const parts = carcasseString.split(',');
        if (parts.length < 2) {
          throw new Error(
            'Format invalide pour carcasse, attendu: numero_bracelet,espece[,nombre_d_animaux]',
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
  const [searchParams] = useSearchParams();
  const [error, setError] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);

  useEffect(() => {
    // Convert URLSearchParams to plain object for Zod validation
    const searchParamsObject = Object.fromEntries(searchParams.entries());

    // Validate search params with Zod
    const validationResult = searchParamsSchema.safeParse(searchParamsObject);

    if (!validationResult.success) {
      const errorMessages = validationResult.error.issues
        .map((err) => `${err.path.join('.')}: ${err.message}`)
        .join(', ');
      setValidationError(`Paramètres invalides: ${errorMessages}`);
      setError(true);
      return;
    }

    const validatedParams: SearchParams = validationResult.data;

    API.post({
      path: 'user/access-token',
      body: {
        accessToken: validatedParams.access_token,
      },
    })
      .then((response) => response as UserConnexionResponse)
      .then(async (response) => {
        if (response.ok && response.data?.user?.id) {
          const user = response.data.user;
          useUser.setState({ user });
          useZustandStore.setState((state) => ({ users: { ...state.users, [user.id]: user } }));

          const newFei = await createNewFei({
            date_mise_a_mort: validatedParams.date_mise_a_mort
              ? dayjs(validatedParams.date_mise_a_mort).toDate()
              : undefined,
            commune_mise_a_mort: validatedParams.commune_mise_a_mort ?? undefined,
            heure_mise_a_mort_premiere_carcasse:
              validatedParams.heure_mise_a_mort_premiere_carcasse ?? undefined,
            heure_evisceration_derniere_carcasse:
              validatedParams.heure_evisceration_derniere_carcasse ?? undefined,
          });

          // Create carcasses if provided
          if (validatedParams.carcasse && validatedParams.carcasse.length > 0) {
            for (const carcasseData of validatedParams.carcasse) {
              const zacharieCarcasseId = `${newFei.numero}-${carcasseData.numero_bracelet}`;
              try {
                await createNewCarcasse({
                  zacharieCarcasseId,
                  numeroBracelet: carcasseData.numero_bracelet,
                  espece: carcasseData.espece,
                  nombreDAnimaux: carcasseData.nombre_d_animaux,
                  fei: newFei,
                });
              } catch (carcasseError) {
                capture(carcasseError as Error, { extra: { access_token: validatedParams.access_token } });
                // Continue with other carcasses even if one fails
                setError(true);
              }
            }
          }

          navigate(`/app/tableau-de-bord/fei/${newFei.numero}`);
        } else {
          useUser.setState({ user: null });
          setError(true);
          return {
            ok: false,
            data: { user: null },
            message: 'Service momentanément indisponible, veuillez réessayer ultérieurement',
            error: 'Erreur inconnue',
          };
        }
      })
      .catch((error) => {
        capture(error, { extra: { access_token: validatedParams.access_token } });
        setError(true);
        return {
          ok: false,
          data: { user: null },
          message: 'Service momentanément indisponible, veuillez réessayer ultérieurement',
          error: 'Erreur inconnue',
        };
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (error) {
    return <CantCreateNewFiche validationError={validationError} />;
  }
  return <Chargement />;
}

function CantCreateNewFiche({ validationError }: { validationError?: string | null }) {
  return (
    <main role="main" id="content">
      <div className="fr-container">
        <div className="fr-my-7w fr-mt-md-12w fr-mb-md-10w fr-grid-row fr-grid-row--gutters fr-grid-row--middle fr-grid-row--center">
          <div className="fr-py-0 fr-col-12 fr-col-md-6">
            <h1 className="fr-h1">Vous ne pouvez pas créer une nouvelle fiche</h1>
            <p className="fr-text--lead fr-mb-3w">
              {validationError
                ? `Paramètres invalides: ${validationError}`
                : "Il semble que l'URL fournie est invalide. Veuillez contacter l'administrateur de votre service."}
            </p>
            <p className="fr-text--lead fr-mb-3w">
              Vous pouvez aussi vous connecter avec votre compte et créer une nouvelle fiche.
            </p>
            <Button
              linkProps={{
                to: `/app/connexion?type=compte-existant`,
              }}
            >
              Me connecter
            </Button>
          </div>
        </div>
      </div>
    </main>
  );
}
