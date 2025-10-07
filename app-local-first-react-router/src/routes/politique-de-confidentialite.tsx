import { useEffect } from 'react';
export default function PolitiqueDeConfidentialite() {
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
            Politique de confidentialité | Zacharie | Ministère de l'Agriculture et de la Souveraineté
            Alimentaire
          </title>
          <h1 className="mt-0 mb-3 text-2xl font-bold">Politique de confidentialité de « Zacharie »</h1>

          <p>Dernière mise à jour : Octobre 2025</p>

          <h2 className="mt-6 mb-2 text-xl font-semibold">1. Introduction</h2>
          <p>
            La Direction générale de l'Alimentation (DGAL) du ministère de l'Agriculture, de la Souveraineté
            alimentaire et de la Forêt (MASAF) s'engage à protéger la vie privée des utilisateurs de la
            plateforme Zacharie. Cette politique de confidentialité explique comment nous collectons,
            utilisons et protégeons vos données personnelles conformément au Règlement Général sur la
            Protection des Données (RGPD) et à la loi Informatique et Libertés.
          </p>

          <h2 className="mt-6 mb-2 text-xl font-semibold">2. Responsable du traitement</h2>
          <p>
            Le responsable du traitement des données est la Direction générale de l'Alimentation (DGAL) du
            ministère de l'Agriculture, de la Souveraineté alimentaire et de la Forêt.
          </p>

          <h2 className="mt-6 mb-2 text-xl font-semibold">3. Données collectées</h2>
          <p>Nous collectons les données suivantes :</p>
          <ul className="mt-2 list-disc pl-6">
            <li>Données d'identification : nom, prénom</li>
            <li>Coordonnées : adresse email, numéro de téléphone, adresse postale</li>
            <li>
              Données professionnelles :
              <ul className="mt-1 list-disc pl-6">
                <li>Numéro de formateur référent ou de personne formée (pour les Examinateurs initiaux)</li>
                <li>Numéro SIRET (pour les Collecteurs professionnels et Établissements de traitement)</li>
                <li>Numéro d'agrément sanitaire (pour les Établissements de traitement)</li>
                <li>Affiliation DDPP (pour les Services vétérinaires d'inspection)</li>
              </ul>
            </li>
            <li>Données de connexion : logs de connexion, adresse IP</li>
            <li>Données d'utilisation : fiches d'accompagnement créées, modifications apportées</li>
          </ul>

          <h2 className="mt-6 mb-2 text-xl font-semibold">4. Finalités du traitement</h2>
          <p>Vos données sont collectées et traitées pour les finalités suivantes :</p>
          <ul className="mt-2 list-disc pl-6">
            <li>Gestion des comptes utilisateurs et authentification</li>
            <li>Traçabilité des actions sur les fiches d'accompagnement du gibier sauvage</li>
            <li>Communication entre les différents acteurs de la filière</li>
            <li>Respect des obligations légales en matière de sécurité sanitaire des aliments</li>
            <li>Amélioration du service et statistiques d'utilisation</li>
          </ul>

          <h2 className="mt-6 mb-2 text-xl font-semibold">5. Base légale du traitement</h2>
          <p>Le traitement de vos données repose sur :</p>
          <ul className="mt-2 list-disc pl-6">
            <li>L'exécution d'une mission d'intérêt public relative à la sécurité sanitaire des aliments</li>
            <li>Le respect des obligations légales en matière de traçabilité des denrées alimentaires</li>
            <li>Votre consentement pour certaines fonctionnalités optionnelles (notifications)</li>
          </ul>

          <h2 className="mt-6 mb-2 text-xl font-semibold">6. Destinataires des données</h2>
          <p>Vos données sont accessibles :</p>
          <ul className="mt-2 list-disc pl-6">
            <li>Aux agents habilités de la DGAL</li>
            <li>Aux agents des Directions Départementales en charge de la Protection des Populations</li>
            <li>
              Aux autres utilisateurs de la plateforme, uniquement pour les données nécessaires à la
              traçabilité des carcasses (dans le cadre de leurs attributions respectives)
            </li>
          </ul>

          <h2 className="mt-6 mb-2 text-xl font-semibold">7. Durée de conservation</h2>
          <p>Nous conservons vos données selon les durées suivantes :</p>
          <ul className="mt-2 list-disc pl-6">
            <li>
              Données du compte utilisateur : pendant la durée d'utilisation du service et jusqu'à 3 ans après
              la dernière utilisation
            </li>
            <li>
              Fiches d'accompagnement et données de traçabilité : 5 ans conformément aux obligations légales
            </li>
            <li>Logs de connexion : 1 an</li>
          </ul>

          <h2 className="mt-6 mb-2 text-xl font-semibold">8. Sécurité des données</h2>
          <p>
            Nous mettons en œuvre les mesures techniques et organisationnelles appropriées pour assurer la
            sécurité de vos données, notamment :
          </p>
          <ul className="mt-2 list-disc pl-6">
            <li>Chiffrement des données en transit et au repos</li>
            <li>Authentification sécurisée des utilisateurs</li>
            <li>Contrôle des accès aux données</li>
            <li>Journalisation des accès et des actions</li>
            <li>Sauvegarde régulière des données</li>
          </ul>

          <h2 className="mt-6 mb-2 text-xl font-semibold">9. Vos droits</h2>
          <p>
            Conformément au RGPD et à la loi Informatique et Libertés, vous disposez des droits suivants :
          </p>
          <ul className="mt-2 list-disc pl-6">
            <li>Droit d'accès à vos données</li>
            <li>Droit de rectification des données inexactes</li>
            <li>Droit à l'effacement (dans les limites des obligations légales de conservation)</li>
            <li>Droit à la limitation du traitement</li>
            <li>Droit à la portabilité de vos données</li>
            <li>Droit d'opposition au traitement de vos données</li>
          </ul>

          <h2 className="mt-6 mb-2 text-xl font-semibold">10. Exercice de vos droits</h2>
          <p>
            Pour exercer vos droits ou pour toute question sur le traitement de vos données, vous pouvez
            contacter :
          </p>
          <p className="mt-2">
            Le Délégué à la Protection des Données du ministère de l'Agriculture :<br />
            Par email : [Adresse email du DPO]
            <br />
            Par courrier : Ministère de l'Agriculture et de la Souveraineté alimentaire
            <br />
            À l'attention du Délégué à la Protection des Données
            <br />
            78 rue de Varenne
            <br />
            75007 Paris
          </p>

          <h2 className="mt-6 mb-2 text-xl font-semibold">
            11. Modifications de la politique de confidentialité
          </h2>
          <p>
            La présente politique de confidentialité peut être mise à jour à tout moment. En cas de
            modification substantielle, nous vous en informerons par email ou via la plateforme. La date de
            dernière mise à jour en haut de cette politique sera également actualisée.
          </p>
        </div>
      </div>
    </article>
  );
}
