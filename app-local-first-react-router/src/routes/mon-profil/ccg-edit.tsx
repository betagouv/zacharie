import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router';
import { Button } from '@codegouvfr/react-dsfr/Button';
import { Input } from '@codegouvfr/react-dsfr/Input';
import { Prisma, Entity } from '@prisma/client';
import InputVille from '@app/components/InputVille';
import API from '@app/services/api';

interface CCGResponse {
  ok: boolean;
  data: { entity: Entity };
  error: string;
}

export default function CCGEdit() {
  const { entityId } = useParams<{ entityId: string }>();
  const navigate = useNavigate();
  const [ccg, setCcg] = useState<Entity | null>(null);
  const [loading, setLoading] = useState(true);
  const [postalCode, setPostalCode] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    window.scrollTo(0, 0);
    API.get({ path: `/entite/ccg/${entityId}` })
      .then((res) => res as CCGResponse)
      .then((res) => {
        if (res.ok) {
          setCcg(res.data.entity);
          setPostalCode(res.data.entity.code_postal || '');
        } else {
          setError(res.error || 'Erreur lors du chargement du CCG');
        }
        setLoading(false);
      });
  }, [entityId]);

  const handleSubmit = useCallback(
    async (event: React.FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      const formData = new FormData(event.currentTarget);
      const body: Record<string, string> = {};
      for (const [key, value] of formData.entries()) {
        body[key] = value as string;
      }
      const response = await API.put({
        path: `/entite/ccg/${entityId}`,
        body,
      }).then((res) => res as CCGResponse);
      if (response.ok) {
        navigate('/app/tableau-de-bord/mon-profil/mes-ccgs');
      } else {
        setError(response.error || 'Erreur lors de la mise à jour');
      }
    },
    [entityId, navigate],
  );

  if (loading) {
    return (
      <div className="mb-6 bg-white md:shadow-sm">
        <div className="p-4 md:p-8">Chargement...</div>
      </div>
    );
  }

  if (!ccg) {
    return (
      <div className="mb-6 bg-white md:shadow-sm">
        <div className="p-4 md:p-8">
          <p>{error || 'CCG introuvable'}</p>
          <Button
            type="button"
            priority="tertiary"
            className="mt-4"
            nativeButtonProps={{
              onClick: () => navigate('/app/tableau-de-bord/mon-profil/mes-ccgs'),
            }}
          >
            Retour
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="mb-6 bg-white md:shadow-sm">
      <div className="p-4 md:p-8">
        <Button
          type="button"
          priority="tertiary no outline"
          size="small"
          iconId="fr-icon-arrow-left-line"
          className="mb-4"
          nativeButtonProps={{
            onClick: () => navigate('/app/tableau-de-bord/mon-profil/mes-ccgs'),
          }}
        >
          Retour aux chambres froides
        </Button>
        <h3 className="text-lg font-semibold text-gray-900">Modifier la chambre froide (CCG)</h3>
        <p className="mb-5 text-sm text-gray-500">
          * Les champs marqués d'un astérisque (*) sont obligatoires.
        </p>
        {error && <p className="mb-4 text-sm text-red-600">{error}</p>}
        <form method="POST" onSubmit={handleSubmit}>
          <Input
            label="Nom usuel *"
            nativeInputProps={{
              id: Prisma.EntityScalarFieldEnum.nom_d_usage,
              name: Prisma.EntityScalarFieldEnum.nom_d_usage,
              autoComplete: 'off',
              required: true,
              defaultValue: ccg.nom_d_usage || '',
            }}
          />
          <Input
            label="SIRET"
            hintText="Si vous n'en n'avez pas, laissez vide."
            nativeInputProps={{
              id: Prisma.EntityScalarFieldEnum.siret,
              name: Prisma.EntityScalarFieldEnum.siret,
              autoComplete: 'off',
              defaultValue: ccg.siret || '',
            }}
          />
          <Input
            label="Numéro d'identification du CCG"
            hintText="De la forme 03-CCG-123, ou encore 03.564.345. Remplissez-le si vous le connaissez."
            nativeInputProps={{
              id: Prisma.EntityScalarFieldEnum.numero_ddecpp,
              name: Prisma.EntityScalarFieldEnum.numero_ddecpp,
              autoComplete: 'off',
              defaultValue: ccg.numero_ddecpp || '',
            }}
          />
          <Input
            label="Adresse *"
            hintText="Indication : numéro et voie"
            nativeInputProps={{
              id: Prisma.EntityScalarFieldEnum.address_ligne_1,
              name: Prisma.EntityScalarFieldEnum.address_ligne_1,
              autoComplete: 'off',
              required: true,
              defaultValue: ccg.address_ligne_1 || '',
            }}
          />
          <Input
            label="Complément d'adresse (optionnel)"
            hintText="Indication : bâtiment, immeuble, escalier et numéro d'appartement"
            nativeInputProps={{
              id: Prisma.EntityScalarFieldEnum.address_ligne_2,
              name: Prisma.EntityScalarFieldEnum.address_ligne_2,
              autoComplete: 'off',
              defaultValue: ccg.address_ligne_2 || '',
            }}
          />

          <div className="flex w-full flex-col gap-x-4 md:flex-row">
            <Input
              label="Code postal *"
              hintText="5 chiffres"
              className="shrink-0 md:basis-1/5"
              nativeInputProps={{
                id: Prisma.EntityScalarFieldEnum.code_postal,
                name: Prisma.EntityScalarFieldEnum.code_postal,
                autoComplete: 'off',
                required: true,
                value: postalCode,
                onChange: (e) => {
                  setPostalCode(e.currentTarget.value);
                },
              }}
            />
            <div className="basis-4/5">
              <InputVille
                postCode={postalCode}
                trimPostCode
                label="Ville ou commune *"
                hintText="Exemple : Montpellier"
                nativeInputProps={{
                  id: Prisma.EntityScalarFieldEnum.ville,
                  name: Prisma.EntityScalarFieldEnum.ville,
                  autoComplete: 'off',
                  required: true,
                  defaultValue: ccg.ville || '',
                }}
              />
            </div>
          </div>
          <Button type="submit">Enregistrer les modifications</Button>
        </form>
      </div>
    </div>
  );
}
