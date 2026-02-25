import { Accordion } from '@codegouvfr/react-dsfr/Accordion';
import { CallOut } from '@codegouvfr/react-dsfr/CallOut';
import { Tabs, type TabsProps } from '@codegouvfr/react-dsfr/Tabs';
import { useEffect, useState } from 'react';

function GuideLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <a href={href} target="_blank" rel="noopener noreferrer" className="fr-link">
      {children}
    </a>
  );
}

function GuideList({ guides }: { guides: { href: string; label: string; description?: string }[] }) {
  return (
    <ul className="fr-mt-1w">
      {guides.map((guide) => (
        <li key={guide.href} className="fr-mb-1w">
          <GuideLink href={guide.href}>{guide.label}</GuideLink>
          {guide.description && <span className="fr-text--sm fr-ml-1w text-grey-625">{guide.description}</span>}
        </li>
      ))}
    </ul>
  );
}

export default function Faq() {
  const [selectedTabId, setSelectedTabId] = useState('chasseurs');

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'instant' });
  }, []);

  const tabs: TabsProps['tabs'] = [
    {
      tabId: 'chasseurs',
      label: 'Chasseurs',
    },
    {
      tabId: 'collecteurs-etg',
      label: 'Collecteurs pro / ETG',
    },
    {
      tabId: 'svi',
      label: 'Services vétérinaires (SVI)',
    },
  ];

  return (
    <main role="main" id="content" className="fr-background-alt--blue-france relative min-h-full overflow-auto">
      <div className="fr-container fr-container--fluid fr-my-md-14v">
        <title>
          Mode d'emploi et questions fréquentes | Zacharie | Ministère de l'Agriculture et de la Souveraineté
          Alimentaire
        </title>
        <div className="fr-grid-row fr-grid-row-gutters fr-grid-row--center">
          <div className="fr-col-12 fr-col-md-10 p-4 md:p-0">
            {/* Section 1 : Guides par rôle */}
            <h2 className="fr-h3 fr-mb-2w">Mode d'emploi</h2>
            <Tabs
              selectedTabId={selectedTabId}
              tabs={tabs}
              onTabChange={setSelectedTabId}
              className="mb-6"
            >
              {selectedTabId === 'chasseurs' && <TabChasseurs />}
              {selectedTabId === 'collecteurs-etg' && <TabCollecteurs />}
              {selectedTabId === 'svi' && <TabSVI />}
            </Tabs>

            {/* Section 2 : FAQ Q&A */}
            <h2 className="fr-h3 fr-mb-2w">Questions fréquentes</h2>
            <div className="mb-6 bg-white md:shadow-sm">
              <div className="p-4 md:p-8">
                <Accordion label="Comment créer mon compte ?" titleAs="h3">
                  <p>
                    Pour créer votre compte, rendez-vous sur{' '}
                    <a href="https://zacharie.beta.gouv.fr" className="fr-link">
                      zacharie.beta.gouv.fr
                    </a>{' '}
                    et cliquez sur « Commencer ». Renseignez votre adresse e-mail et suivez les instructions. Un code
                    de connexion vous sera envoyé par e-mail à chaque connexion.
                  </p>
                  <p className="fr-mt-1w">
                    <GuideLink href="https://scribehow.com/shared/Creer_son_compte_sur_Zacharie_sur_ordinateur__z7KxXFXpRwaH7rmc2LLX4g">
                      Voir le guide pas-à-pas (ordinateur)
                    </GuideLink>
                  </p>
                </Accordion>
                <Accordion label="Comment installer l'application sur mon téléphone ?" titleAs="h3">
                  <p>
                    Zacharie est une application web (PWA) qui s'installe directement depuis votre navigateur. Ouvrez{' '}
                    <a href="https://zacharie.beta.gouv.fr" className="fr-link">
                      zacharie.beta.gouv.fr
                    </a>{' '}
                    sur votre téléphone, puis suivez la notification d'installation ou utilisez le menu de votre
                    navigateur pour « Ajouter à l'écran d'accueil ».
                  </p>
                  <p className="fr-mt-1w">
                    <GuideLink href="https://scribehow.com/shared/Installer_lapplication_Zacharie_et_se_connecter_a_son_compte_sur_mobile__MUuKtgMUSDG9DgJ9UBDWgg">
                      Voir le guide d'installation (téléphone)
                    </GuideLink>
                  </p>
                </Accordion>
                <Accordion label="Comment fonctionne Zacharie hors connexion ?" titleAs="h3">
                  <p>
                    Zacharie fonctionne en mode « local-first » : vos données sont enregistrées sur votre appareil même
                    sans connexion internet. Lorsque vous retrouvez une connexion, vos fiches se synchronisent
                    automatiquement avec le serveur. Vous pouvez donc créer et remplir des fiches en pleine nature,
                    même sans réseau.
                  </p>
                </Accordion>
                <Accordion label="Comment transmettre une fiche ?" titleAs="h3">
                  <p>
                    Une fois votre fiche d'accompagnement remplie, cliquez sur « Transmettre » pour l'envoyer au
                    destinataire suivant (collecteur, ETG ou SVI). La fiche sera automatiquement synchronisée dès que
                    vous aurez une connexion internet.
                  </p>
                  <p className="fr-mt-1w">
                    <GuideLink href="https://scribehow.com/shared/Creer_et_remplir_une_fiche_daccompagnement_sur_ordinateur__2eulqOaiTk-6fw5iYJFOnQ">
                      Voir le guide (ordinateur)
                    </GuideLink>
                  </p>
                </Accordion>
                <Accordion label="Comment télécharger mes fiches en Excel ?" titleAs="h3">
                  <p>
                    Depuis votre tableau de bord, sélectionnez les fiches souhaitées puis cliquez sur « Télécharger en
                    Excel ». Vous pouvez aussi exporter l'ensemble de votre registre de carcasses.
                  </p>
                  <p className="fr-mt-1w">
                    <GuideLink href="https://scribehow.com/shared/Telecharger_une_ou_plusieurs_fiches_en_format_Excel__MxMBdZBvSDKWaJoHe6sQJQ">
                      Voir le guide de téléchargement Excel
                    </GuideLink>
                  </p>
                </Accordion>
                <Accordion label="Comment contacter le support ?" titleAs="h3">
                  <p>
                    Vous pouvez nous contacter en nous appelant au{' '}
                    <a href="tel:+33189316644">01 89 31 66 44</a>, en écrivant à{' '}
                    <a href="mailto:contact@zacharie.beta.gouv.fr" className="fr-link">
                      contact@zacharie.beta.gouv.fr
                    </a>{' '}
                    ou via notre{' '}
                    <a href="/contact" className="fr-link">
                      formulaire de contact
                    </a>
                    .
                  </p>
                </Accordion>
              </div>
            </div>

            {/* CallOut contact */}
            <CallOut className="bg-white">
              Besoin d'aide ? Contactez-nous au <a href="tel:+33189316644">01 89 31 66 44</a> ou par e-mail à{' '}
              <a href="mailto:contact@zacharie.beta.gouv.fr">contact@zacharie.beta.gouv.fr</a>. Vous pouvez aussi
              utiliser notre{' '}
              <a href="/contact" className="fr-link">
                formulaire de contact
              </a>
              .
            </CallOut>
          </div>
        </div>
      </div>
    </main>
  );
}

function TabChasseurs() {
  return (
    <div className="p-4 md:p-8">
      <Accordion label="Avant de créer votre première fiche" titleAs="h3" defaultExpanded>
        <GuideList
          guides={[
            {
              href: 'https://scribehow.com/shared/Creer_son_compte_sur_Zacharie_sur_ordinateur__z7KxXFXpRwaH7rmc2LLX4g',
              label: 'Créer son compte (sur ordinateur)',
            },
            {
              href: 'https://scribehow.com/shared/Installer_lapplication_Zacharie_et_se_connecter_a_son_compte_sur_mobile__MUuKtgMUSDG9DgJ9UBDWgg',
              label: "Installer l'application et se connecter (sur téléphone)",
            },
            {
              href: 'https://scribehow.com/page/Configurer_son_compte_Zacharie__sur_ordinateur__yRPiN_xnRqOZbjxRdwSNQQ',
              label: 'Configurer son compte (sur ordinateur)',
            },
          ]}
        />
      </Accordion>
      <Accordion label="Créer et gérer vos fiches" titleAs="h3">
        <GuideList
          guides={[
            {
              href: 'https://scribehow.com/shared/Creer_et_remplir_une_fiche_daccompagnement_sur_ordinateur__2eulqOaiTk-6fw5iYJFOnQ',
              label: "Créer, remplir et transmettre une fiche (sur ordinateur)",
            },
            {
              href: 'https://scribehow.com/shared/Telecharger_une_ou_plusieurs_fiches_en_format_Excel__MxMBdZBvSDKWaJoHe6sQJQ',
              label: 'Télécharger des fiches en format Excel',
            },
          ]}
        />
      </Accordion>
      <p className="fr-mt-2w fr-text--sm">
        <GuideLink href="https://scribehow.com/page/Mode_demploi_de_Zacharie_pour_les_chasseurs__9L2kMCFDQ1GNnAJGHJiJEw">
          Voir tous les guides pour les chasseurs
        </GuideLink>
      </p>
    </div>
  );
}

function TabCollecteurs() {
  return (
    <div className="p-4 md:p-8">
      <Accordion label="Se connecter et configurer son compte" titleAs="h3" defaultExpanded>
        <GuideList
          guides={[
            {
              href: 'https://scribehow.com/shared/Se_connecter_a_Zacharie_sur_ordinateur__JPGpYcSUQki-uB_Avj73Vg',
              label: 'Se connecter (sur ordinateur)',
            },
            {
              href: 'https://scribehow.com/viewer/Gerer_les_comptes_rattaches_a_votre_entreprise_etablissement_de_traitement_collecteur__zRUTQ-lJT-CXO5TAcT3M4Q',
              label: 'Gérer les comptes rattachés à votre entreprise',
            },
          ]}
        />
      </Accordion>
      <Accordion label="Enregistrer des décisions" titleAs="h3">
        <GuideList
          guides={[
            {
              href: 'https://scribehow.com/shared/Prise_en_charge_dune_fiche_par_un_etablissement_de_traitement_sur_ordinateur__7LJ88ubqTFGiBIYfLcR_Dw',
              label: "Prise en charge d'une fiche (sur ordinateur)",
            },
          ]}
        />
      </Accordion>
      <Accordion label="Créer et exporter des listes" titleAs="h3">
        <GuideList
          guides={[
            {
              href: 'https://scribehow.com/shared/Telecharger_une_ou_plusieurs_fiches_en_format_Excel__MxMBdZBvSDKWaJoHe6sQJQ',
              label: 'Télécharger des fiches en format Excel',
            },
            {
              href: 'https://scribehow.com/shared/Consulter_filtrer_et_exporter_un_registre_de_carcasses__0bau1DsjRIifVnevg7Ub3Q',
              label: 'Consulter, filtrer et exporter un registre de carcasses',
            },
          ]}
        />
      </Accordion>
      <p className="fr-mt-2w fr-text--sm">
        <GuideLink href="https://scribehow.com/page/Mode_demploi_de_Zacharie_pour_les_collecteurs_professionnels_et_les_etablissements_de_traitement__5o4qZVE7QBOtRRG-vvca-w">
          Voir tous les guides pour les collecteurs et ETG
        </GuideLink>
      </p>
    </div>
  );
}

function TabSVI() {
  return (
    <div className="p-4 md:p-8">
      <Accordion label="Se connecter et configurer son compte" titleAs="h3" defaultExpanded>
        <GuideList
          guides={[
            {
              href: 'https://scribehow.com/shared/Se_connecter_a_Zacharie_sur_ordinateur__JPGpYcSUQki-uB_Avj73Vg',
              label: 'Se connecter (sur ordinateur)',
            },
            {
              href: 'https://scribehow.com/shared/Installer_lapplication_Zacharie_et_se_connecter_a_son_compte_sur_mobile__MUuKtgMUSDG9DgJ9UBDWgg',
              label: "Installer l'application (sur téléphone)",
            },
            {
              href: 'https://scribehow.com/viewer/Gerer_les_comptes_rattaches_a_votre_service____gI40DjRhuY7FXyqP-Eug',
              label: 'Gérer les comptes rattachés à votre service',
            },
          ]}
        />
      </Accordion>
      <Accordion label="Enregistrer des décisions" titleAs="h3">
        <GuideList
          guides={[
            {
              href: 'https://scribehow.com/shared/Mettre_en_consigne_une_carcasse__DOSbvsLIQpWqJy8mnAz2ug',
              label: 'Mettre en consigne une carcasse',
            },
            {
              href: 'https://scribehow.com/shared/Saisir_une_carcasse_ou_lever_une_consigne__P_nkdBLITLqy4YevISHERA',
              label: 'Saisir une carcasse ou lever une consigne',
            },
            {
              href: 'https://scribehow.com/shared/Valider_une_fiche_par_un_service_veterinaire_dinspection_action_facultative__S2jCongRTOO15d5J0FY0hQ',
              label: 'Valider une fiche (action facultative)',
            },
          ]}
        />
      </Accordion>
      <Accordion label="Créer et exporter des listes" titleAs="h3">
        <GuideList
          guides={[
            {
              href: 'https://scribehow.com/shared/Telecharger_une_ou_plusieurs_fiches_en_format_Excel__MxMBdZBvSDKWaJoHe6sQJQ',
              label: 'Télécharger des fiches en format Excel',
            },
            {
              href: 'https://scribehow.com/shared/Consulter_filtrer_et_exporter_un_registre_de_carcasses__0bau1DsjRIifVnevg7Ub3Q',
              label: 'Consulter, filtrer et exporter un registre de carcasses',
            },
          ]}
        />
      </Accordion>
      <p className="fr-mt-2w fr-text--sm">
        <GuideLink href="https://scribehow.com/page/Mode_demploi_de_Zacharie_pour_les_services_veterinaires_dinspection_SVI__J7sDlZc2SyieQ4OL9pzLng">
          Voir tous les guides pour les services vétérinaires
        </GuideLink>
      </p>
    </div>
  );
}
