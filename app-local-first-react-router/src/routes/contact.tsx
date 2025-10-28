import API from '@app/services/api';
import useUser from '@app/zustand/user';
import { Button } from '@codegouvfr/react-dsfr/Button';
import { CallOut } from '@codegouvfr/react-dsfr/CallOut';
import { Input } from '@codegouvfr/react-dsfr/Input';
import { Select } from '@codegouvfr/react-dsfr/Select';
import { Prisma } from '@prisma/client';
import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router';

export default function Stats() {
  const [searchParams] = useSearchParams();
  const user = useUser((state) => state.user);

  const [sent, setSent] = useState(false);

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'instant' });
  }, []);

  return (
    <main
      role="main"
      id="content"
      className="fr-background-alt--blue-france relative min-h-full overflow-auto"
    >
      <div className="fr-container fr-container--fluid fr-my-md-14v">
        <title>Contact | Zacharie | Ministère de l'Agriculture et de la Souveraineté Alimentaire</title>
        <div className="fr-grid-row fr-grid-row-gutters fr-grid-row--center">
          <div className="fr-col-12 fr-col-md-10 p-4 md:p-0">
            <h1 className="fr-h2 fr-mb-2w">Contact</h1>
            <CallOut className="bg-white">
              {searchParams.get('for-delete-account')
                ? 'Vous souhaitez supprimer votre compte Zacharie ? '
                : ''}
              Vous pouvez nous contacter en nous appelant au <a href="tel:+33189316644">01 89 31 66 44</a>, en
              écrivant à <a href="mailto:contact@zacharie.beta.gouv.fr">contact@zacharie.beta.gouv.fr</a> ou
              en remplissant le formulaire ci-dessous.
            </CallOut>
            <div className="mb-6 bg-white md:shadow-sm">
              <div className="p-4 md:p-8">
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    setSent(true);
                    const formData = new FormData(e.currentTarget);
                    API.post({
                      path: 'contact',
                      body: Object.fromEntries(formData),
                    });
                  }}
                  className="space-y-4"
                >
                  <p className="mb-5 text-sm text-gray-500">
                    * Les champs marqués d'un astérisque (*) sont obligatoires.
                  </p>
                  <Input
                    label="Nom *"
                    nativeInputProps={{
                      id: Prisma.UserScalarFieldEnum.nom_de_famille,
                      name: Prisma.UserScalarFieldEnum.nom_de_famille,
                      autoComplete: 'family-name',
                      required: true,
                      defaultValue: user?.nom_de_famille ?? '',
                    }}
                  />
                  {/* honey pot */}
                  <Input
                    label="Profession *"
                    className="hidden"
                    nativeInputProps={{
                      id: 'job',
                      name: 'job',
                      autoComplete: 'off',
                    }}
                  />
                  <Input
                    label="Prénom *"
                    nativeInputProps={{
                      id: Prisma.UserScalarFieldEnum.prenom,
                      name: Prisma.UserScalarFieldEnum.prenom,
                      autoComplete: 'given-name',
                      required: true,
                      defaultValue: user?.prenom ?? '',
                    }}
                  />
                  <Input
                    label="Email *"
                    nativeInputProps={{
                      id: Prisma.UserScalarFieldEnum.email,
                      name: Prisma.UserScalarFieldEnum.email,
                      required: true,
                      defaultValue: user?.email ?? '',
                    }}
                  />
                  <Input
                    label="Téléphone *"
                    hintText="Format attendu : 01 22 33 44 55"
                    nativeInputProps={{
                      id: Prisma.UserScalarFieldEnum.telephone,
                      name: Prisma.UserScalarFieldEnum.telephone,
                      autoComplete: 'tel',
                      required: true,
                      defaultValue: user?.telephone ?? '',
                    }}
                  />
                  <Select
                    label="Objet"
                    className="group grow"
                    nativeSelectProps={{
                      name: 'object',
                    }}
                  >
                    <option value="">-- Sélectionnez un objet --</option>
                    {/* <hr /> */}
                    <option>Je veux plus d'informations sur Zacharie</option>
                    <option>Je rencontre un problème lors de l'utilisation de Zacharie</option>
                    <option>Je n'arrive pas à me connecter à Zacharie</option>
                    <option>Je souhaite proposer une amélioration</option>
                    <option>Je souhaite supprimer mon compte</option>
                    <option>Autre</option>
                  </Select>
                  <Input
                    label="Message *"
                    textArea
                    nativeTextAreaProps={{
                      name: 'message',
                      required: true,
                      rows: 5,
                    }}
                  />
                  <Button type="submit" disabled={sent}>
                    {sent ? 'Message envoyé, merci !' : 'Envoyer'}
                  </Button>
                </form>
              </div>
            </div>
            <CallOut className="bg-white">
              Les informations que vous avez transmises via les fiches d'examen initial seront toutefois
              conservées pour archive.
            </CallOut>
          </div>
        </div>
      </div>
    </main>
  );
}
