import { useEffect } from 'react';

export default function MentionsLegales() {
  useEffect(() => {
    window.scrollTo({
      top: 0,
      behavior: 'instant',
    });
  }, []);
  return (
    <article className="fr-container fr-container--fluid fr-my-md-14v">
      <div className="fr-grid-row fr-grid-row-gutters fr-grid-row--center">
        <div>
          <title>
            Mentions Légales | Zacharie | Ministère de l'Agriculture et de la Souveraineté Alimentaire
          </title>
          <h1 className="mb-3 mt-0 text-2xl font-bold">Mentions Légales</h1>

          <div>
            <h2 className="mb-2 mt-6 text-xl font-semibold">Éditeur de la plateforme</h2>
            <p>
              La plateforme “Zacharie” est éditée par la Direction générale de l’alimentation (DGAL) du
              ministère de l’Agriculture, de la Souveraineté alimentaire et de la Forêt, située :{' '}
            </p>
            <p></p>
            <p>251 rue de Vaugirard </p>
            <p>75015 Paris</p>
            <p>France</p>
            <p></p>
            <p>Téléphone : 01 49 55 49 55</p>
            <h2 className="mb-2 mt-6 text-xl font-semibold">Directrice de la publication</h2>
            <p>La directrice de la publication est Madame Maud FAIPOUX, directrice générale de la DGAL.</p>
            <h2 className="mb-2 mt-6 text-xl font-semibold">Hébergement de la lateforme</h2>
            <p>Cette plateforme est hébergée par:</p>
            <p>Clever Cloud SAS</p>
            <p>4 rue Voltaire</p>
            <p>44000 Nantes</p>
            <p>France</p>
            <p>Téléphone : 02 85 52 07 69</p>
            <h2 className="mb-2 mt-6 text-xl font-semibold">Accessibilité</h2>
            <p>
              La conformité aux normes d’accessibilité numérique est un objectif ultérieur mais nous tâchons
              de rendre cette plateforme accessible à toutes et à tous.
            </p>
            <p>
              Pour en savoir plus sur la politique d’accessibilité numérique de l’État :{' '}
              <a href="https://accessibilite.numerique.gouv.fr/">
                {' '}
                https://accessibilite.numerique.gouv.fr/{' '}
              </a>{' '}
            </p>
            <p>
              Pour nous signaler un défaut d’accessibilité vous empêchant d’accéder à un contenu ou une
              fonctionnalité de la plateforme, merci de nous en faire part à l’adresse suivante :{' '}
              <a href="mailto:support-zacharie@beta.gouv.fr">support-zacharie@beta.gouv.fr</a>{' '}
            </p>
            <p>
              Si vous n’obtenez pas de réponse rapide de notre part, vous êtes en droit de faire parvenir vos
              doléances ou une demande de saisine au Défenseur des droits.
            </p>
            <h2 className="mb-2 mt-6 text-xl font-semibold">Sécurité</h2>
            <p>
              La plateforme est protégée par un certificat électronique, matérialisé pour la grande majorité
              des navigateurs par un cadenas. Cette protection participe à la confidentialité des
              échanges.{' '}
            </p>
            <p>
              En aucun cas, les services associés à la plateforme ne seront à l’origine d’envoi de courriels
              pour vous demander la saisie d’informations personnelles.
            </p>
            <h2 className="mb-2 mt-6 text-xl font-semibold">Code source</h2>
            <p>Le code source est ouvert et les contributions sont bienvenues : </p>
            <p>
              <a href="https://github.com/betagouv/zacharie">https://github.com/betagouv/zacharie</a>{' '}
            </p>
          </div>
        </div>
      </div>
    </article>
  );
}
