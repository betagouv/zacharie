export default function Accessibility() {
  return (
    <main className="max-w-prose mx-auto px-4 py-8 space-y-8">
      <h1 className="text-3xl font-bold mb-6">Déclaration d'accessibilité</h1>

      <section className="space-y-4">
        <p className="text-gray-700">
          Zacharie s'engage à rendre son site internet, et son application accessibles (y compris en version
          mobile) conformément à l'article 47 de la loi n°2005-102 du 11 février 2005.
        </p>

        <p className="text-gray-700">
          À cette fin, elle met en œuvre la stratégie et les actions suivantes :
        </p>

        <div className="space-y-6">
          <p>
            <strong className="text-gray-900">
              Schéma pluriannuel de mise en accessibilité : en cours d'élaboration.
            </strong>
          </p>

          <div className="space-y-4">
            <h2 className="text-xl font-semibold text-gray-900">Actions réalisées en 2024-2025 :</h2>
            <ul className="list-disc pl-5 space-y-2 text-gray-700">
              <li>Utilisation du DSFR</li>
              <li>Ajout des descriptions textuelles pour les images (balises alt)</li>
            </ul>
          </div>

          <div className="space-y-4">
            <h2 className="text-xl font-semibold text-gray-900">Actions réalisées en 2025 :</h2>
            <ul className="list-disc pl-5 space-y-2 text-gray-700">
              <li>Établissement de la déclaration d'accessibilité</li>
            </ul>
          </div>

          <div className="space-y-4">
            <h2 className="text-xl font-semibold text-gray-900">Plan d'actions 2025-2026 :</h2>
            <ul className="list-disc pl-5 space-y-2 text-gray-700">
              <li>Semestre 1 : lecture audio des titres mise en français, test avec le logiciel NVDA</li>
              <li>
                Semestre 2 : Ajout d'un plan du site vitrine, ajout des liens d'évitements sur l'en-têtre de
                page
              </li>
            </ul>
          </div>

          <div className="space-y-4">
            <h2 className="text-xl font-semibold text-gray-900">Plan d'actions 2026-2027 :</h2>
            <ul className="list-disc pl-5 space-y-2 text-gray-700">
              <li>Nouvel audit</li>
            </ul>
          </div>
        </div>

        <p className="text-gray-700">
          Cette déclaration d'accessibilité s'applique à{' '}
          <a href="http://www.zacharie.beta.gouv.fr" className="text-blue-600 hover:underline">
            www.zacharie.beta.gouv.fr
          </a>
          .
        </p>
      </section>

      <section className="space-y-4">
        <h2 className="text-2xl font-semibold text-gray-900">État de conformité</h2>
        <p className="text-gray-700">
          Zacharie (
          <a href="http://www.zacharie.beta.gouv.fr" className="text-blue-600 hover:underline">
            www.zacharie.beta.gouv.fr
          </a>
          ) est partiellement conforme avec le référentiel général d'amélioration de l'accessibilité (RGAA),
          version 4 en raison des non-conformités et des dérogations énumérées ci-dessous.
        </p>

        <div className="space-y-2">
          <h3 className="text-lg font-semibold text-gray-900">Résultats des tests</h3>
          <p className="text-gray-700">
            L'audit de conformité réalisé par nom de l'entité qui a réalisé l'audit révèle que :
          </p>
          <ul className="list-disc pl-5 text-gray-700">
            <li>50% des critères du RGAA version 4 sont respectés</li>
          </ul>
        </div>
      </section>

      <section className="space-y-4">
        <h2 className="text-2xl font-semibold text-gray-900">Contenus non accessibles</h2>
        <p className="text-gray-700">En lecture audio les titres des blocs de textes sont lus en anglais</p>
        <p className="text-gray-700">Absence des liens d'évitement et du plan du site</p>
        <p className="text-gray-700">Navigation au clavier dans l'application :</p>
        <ul className="list-disc pl-5 text-gray-700">
          <li>certains labels ne sont pas activables au clavier</li>
          <li>certains onglets de fiches ne sont pas activables au clavier</li>
        </ul>
      </section>

      <section className="space-y-4">
        <h2 className="text-2xl font-semibold text-gray-900">
          Établissement de cette déclaration d'accessibilité
        </h2>
        <p className="text-gray-700">Cette déclaration a été établie le 01/02/2025 (première version).</p>

        <div className="space-y-2">
          <h3 className="text-lg font-semibold text-gray-900">
            Technologies utilisées pour la réalisation de Zacharie
          </h3>
          <ul className="list-disc pl-5 text-gray-700">
            <li>HTML5</li>
            <li>CSS</li>
            <li>Javascript</li>
          </ul>
        </div>

        <div className="space-y-2">
          <h3 className="text-lg font-semibold text-gray-900">Environnement de test</h3>
          <p className="text-gray-700">
            Les vérifications de restitution de contenus ont été réalisées sur la base de la combinaison
            fournie par la base de référence du RGAA, avec les versions suivantes :
          </p>
          <ul className="list-disc pl-5 text-gray-700">
            <li>Firefox</li>
            <li>Safari</li>
          </ul>
        </div>

        <div className="space-y-2">
          <h4 className="text-md font-semibold text-gray-900">Outils pour évaluer l'accessibilité</h4>
          <ul className="list-disc pl-5 text-gray-700">
            <li>VoiceOver</li>
            <li>ANDI</li>
            <li>NVDA (prochainement)</li>
          </ul>
        </div>

        <div className="space-y-2">
          <h3 className="text-lg font-semibold text-gray-900">
            Pages du site ayant fait l'objet de la vérification de conformité
          </h3>
          <ul className="list-disc pl-5 text-gray-700">
            <li>
              page d'accueil{' '}
              <a href="http://zacharie.beta.gouv.fr" className="text-blue-600 hover:underline">
                zacharie.beta.gouv.fr
              </a>
            </li>
            <li>
              page création de compte{' '}
              <a href="zacharie.beta.gouv.fr/beta-testeurs" className="text-blue-600 hover:underline">
                zacharie.beta.gouv.fr/beta-testeurs
              </a>
            </li>
            <li>
              page connexion{' '}
              <a href="http://zacharie.beta.gouv.fr/app/connexion" className="text-blue-600 hover:underline">
                zacharie.beta.gouv.fr/app/connexion
              </a>
            </li>
            <li>
              pages internes de l'application et profils utilisateurs{' '}
              <a
                href="http://zacharie.beta.gouv.fr/app/tableau-de-bord"
                className="text-blue-600 hover:underline"
              >
                zacharie.beta.gouv.fr/app/tableau-de-bord
              </a>
            </li>
          </ul>
        </div>
      </section>

      <section className="space-y-4">
        <h2 className="text-2xl font-semibold text-gray-900">Retour d'information et contact</h2>
        <p className="text-gray-700">
          Si vous n'arrivez pas à accéder à un contenu ou à un service, vous pouvez contacter le responsable
          de Zacharie pour être orienté vers une alternative accessible ou obtenir le contenu sous une autre
          forme.
        </p>
        <ul className="space-y-4 text-gray-700">
          <li>
            Envoyer un message à{' '}
            <a href="mailto:contact@zacharie.beta.gouv.fr" className="text-blue-600 hover:underline">
              contact@zacharie.beta.gouv.fr
            </a>
          </li>
          <li className="space-y-1">
            <p>Ou contacter</p>
            <address className="not-italic">
              Ministère de l'Agriculture et de la Souveraineté alimentaire
              <br />
              78, rue de Varenne 75349 Paris 07 SP
              <br />
              01 49 55 49 55
            </address>
          </li>
        </ul>
      </section>

      <section className="space-y-4">
        <h2 className="text-2xl font-semibold text-gray-900">Voies de recours</h2>
        <p className="text-gray-700">
          Si vous constatez un défaut d'accessibilité vous empêchant d'accéder à un contenu ou une
          fonctionnalité du site, que vous nous le signalez et que vous ne parvenez pas à obtenir une réponse
          de notre part, vous êtes en droit de faire parvenir vos doléances ou une demande de saisine au
          Défenseur des droits.
        </p>

        <p className="text-gray-700">Plusieurs moyens sont à votre disposition :</p>
        <ul className="list-disc pl-5 text-gray-700">
          <li>Écrire un message au Défenseur des droits</li>
          <li>Contacter le délégué du Défenseur des droits dans votre région</li>
          <li>
            Envoyer un courrier par la poste (gratuit, ne pas mettre de timbre)
            <br />
            Défenseur des droits
            <br />
            Libre réponse 71120
            <br />
            75342 Paris CEDEX 07
          </li>
        </ul>
      </section>
    </main>
  );
}
