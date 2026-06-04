import { useCallback } from 'react';
import { useNavigate } from 'react-router';
import { createModal } from '@codegouvfr/react-dsfr/Modal';
import { Alert } from '@codegouvfr/react-dsfr/Alert';
import { createNewFei } from '@app/utils/create-new-fei';
import { useMostFreshUser } from '@app/utils-offline/get-most-fresh-user';

// ----------------------------------------------------------------------------
// Compte chasseur en attente de validation
// Tant que l'admin n'a pas activé le compte (user.activated === false), le
// backend rejette /sync. Le front doit donc empêcher toute création ou
// transmission de fiche et expliquer pourquoi. Wording aligné sur
// chasseur-deactivated.tsx.
// ----------------------------------------------------------------------------

export const compteEnAttenteModal = createModal({
  isOpenedByDefault: false,
  id: 'compte-en-attente-validation',
});

const ContactInfos = () => (
  <>
    <p className="fr-text--sm fr-mb-2w">Des questions ? Contactez-nous :</p>
    <ul className="fr-text--sm mb-0 list-inside list-disc">
      <li>
        par mail : <a href="mailto:contact@zacharie.beta.gouv.fr">contact@zacharie.beta.gouv.fr</a>
      </li>
      <li>
        par téléphone : <a href="tel:+33189316640">01 89 31 66 40</a>
      </li>
    </ul>
  </>
);

export function CompteEnAttenteValidationModal() {
  return (
    <compteEnAttenteModal.Component title="Merci pour votre inscription à Zacharie&nbsp;!">
      <p className="fr-text--sm fr-mb-3w">
        Pour créer ou transmettre une fiche, votre compte doit d’abord être validé.
        <br />
        Nous vérifions les informations que vous avez renseignées et vous enverrons un mail pour confirmer
        l’activation de votre compte ou vous demander des informations complémentaires.
      </p>
      <ContactInfos />
    </compteEnAttenteModal.Component>
  );
}

// Affiché en ligne sur les écrans de transmission (examinateur → premier détenteur,
// prise en charge) lorsque le compte n'est pas encore activé.
export function CompteEnAttenteValidationAlert() {
  return (
    <Alert
      severity="info"
      className="my-4 bg-white"
      title="Compte en attente de validation"
      description="Pour transmettre une fiche, votre compte doit d’abord être validé. Nous vous enverrons un mail dès qu’il sera activé."
    />
  );
}

// Handler partagé pour tous les boutons « Nouvelle fiche » / « Créer une fiche ».
// Si le compte n'est pas activé, on ouvre la modale d'explication au lieu de créer.
export function useOnNewFiche() {
  const user = useMostFreshUser('useOnNewFiche');
  const navigate = useNavigate();
  return useCallback(async () => {
    if (!user?.activated) {
      compteEnAttenteModal.open();
      return;
    }
    const newFei = await createNewFei();
    navigate(`/app/chasseur/fei/${newFei.numero}`);
  }, [user?.activated, navigate]);
}
