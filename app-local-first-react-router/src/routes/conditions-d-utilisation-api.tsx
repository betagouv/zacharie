import { useEffect } from 'react';

const h2 = 'mt-8 mb-2 text-xl font-semibold';
const h3 = 'mt-6 mb-2 text-lg font-semibold';
const ul = 'mt-2 list-disc pl-12';
const DOC_TIERCES_PARTIES = 'https://api.zacharie.beta.gouv.fr/v1/docs/tierces-parties/';
const DOC_CLE_DEDIEE = 'https://api.zacharie.beta.gouv.fr/v1/docs/cle-dediee/';

function DocLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
    >
      {children}
    </a>
  );
}

const table =
  'mt-2 w-full border-collapse text-sm [&_td]:border [&_td]:p-2 [&_td]:align-top [&_th]:border [&_th]:p-2 [&_th]:text-left';

export default function ConditionsDUtilisationApi() {
  useEffect(() => {
    window.scrollTo({
      top: 0,
      behavior: 'instant',
    });
  }, []);

  return (
    <article className="fr-container fr-container--fluid fr-my-md-14v">
      <div className="fr-grid-row fr-grid-row-gutters fr-grid-row--center">
        <div className="[&>p]:pl-6">
          <title>
            Conditions d'utilisation de l'API | Zacharie | Ministère de l'Agriculture et de la Souveraineté
            Alimentaire
          </title>
          <h1 className="mt-0 mb-3 text-2xl font-bold">
            Conditions générales d'utilisation de l'API Zacharie
          </h1>
          {/* ===================== TITRE I ===================== */}
          <h2 className={h2}>Titre I — Dispositions générales</h2>

          <h3 className={h3}>Article 1 — Objet</h3>
          <p>
            Zacharie est le service numérique de la Direction générale de l'alimentation (DGAL) du ministère
            de l'Agriculture, de la Souveraineté alimentaire et de la Forêt, qui dématérialise la fiche
            d'accompagnement du gibier sauvage et assure la traçabilité des carcasses de la mise à mort
            jusqu'à l'inspection sanitaire.
          </p>
          <p>
            Les présentes conditions fixent les règles d'accès et d'utilisation de l'interface de
            programmation (« API ») de Zacharie par des logiciels tiers. Elles s'ajoutent aux{' '}
            <a href="/modalites-d-utilisation">modalités d'utilisation</a> et à la{' '}
            <a href="/politique-de-confidentialite">politique de confidentialité</a> de Zacharie, qui restent
            applicables aux utilisateurs.
          </p>

          <h3 className={h3}>Article 2 — Définitions</h3>
          <ul className={ul}>
            <li>
              <strong>Éditeur</strong>&nbsp;: la DGAL, qui édite et opère Zacharie.
            </li>
            <li>
              <strong>Partenaire</strong>&nbsp;: toute personne morale qui obtient une clé API pour connecter
              son logiciel à Zacharie.
            </li>
            <li>
              <strong>Utilisateur</strong>&nbsp;: toute personne qui dispose d'un compte Zacharie (chasseur,
              examinateur initial, premier détenteur, collecteur, ETG, commerce de détail, service vétérinaire
              d'inspection…).
            </li>
            <li>
              <strong>Fiche</strong>&nbsp;: la fiche d'accompagnement du gibier sauvage (ou fiche d'examen
              initial), identifiée par un numéro unique, qui regroupe une ou plusieurs carcasses.
            </li>
            <li>
              <strong>Carcasse</strong>&nbsp;: un animal ou un lot de petit gibier, identifié par un numéro de
              bracelet, avec ses données sanitaires et de traçabilité.
            </li>
            <li>
              <strong>Clé API</strong>&nbsp;: l'identifiant secret remis au Partenaire, qui l'authentifie
              auprès de l'API. Elle est soit « tierce partie » (accès aux données de plusieurs Utilisateurs
              avec leur accord), soit « dédiée » à une entité professionnelle.
            </li>
            <li>
              <strong>Accord de partage</strong>&nbsp;: l'autorisation que l'Utilisateur donne, dans son
              espace Zacharie, au Partenaire d'accéder à ses données. Il peut la retirer à tout moment.
            </li>
            <li>
              <strong>Webhook</strong>&nbsp;: un message que Zacharie envoie automatiquement au serveur du
              Partenaire lorsqu'un événement survient sur une fiche ou une carcasse.
            </li>
            <li>
              <strong>Interface Zacharie</strong>&nbsp;: l'application web Zacharie (
              <a href="https://zacharie.beta.gouv.fr">zacharie.beta.gouv.fr</a>) et ses applications mobiles.
            </li>
          </ul>

          <h3 className={h3}>Article 3 — Acceptation et opposabilité</h3>
          <p>
            L'utilisation de l'API vaut acceptation sans réserve des présentes conditions. Le Partenaire les
            accepte au moment de sa demande de clé, par une personne habilitée à l'engager.
          </p>
          <h3 className={h3}>Article 4 — Obtention d'une clé API</h3>
          <p>
            4.1. Le Partenaire fait sa demande par le <a href="/contact">formulaire de contact</a> de
            Zacharie. Il indique&nbsp;: son identité et son numéro SIRET, le logiciel concerné, la finalité de
            l'accès, et le cas échéant l'adresse de son webhook et les domaines qui afficheront l'Interface
            Zacharie en iframe.
          </p>
          <p>
            4.2. L'Éditeur examine la demande et peut la refuser, notamment si la finalité ne correspond pas à
            l'objet de Zacharie ou si le Partenaire ne présente pas de garanties suffisantes de protection des
            données.
          </p>
          <p>
            4.3. La clé est remise par un lien à usage unique. Après une première ouverture, le lien n'est
            plus valide. Une clé perdue est remplacée sur demande, l'ancienne étant révoquée.
          </p>
          <p>
            4.4. Chaque clé reçoit des droits limités (« scopes ») qui correspondent à la finalité déclarée.
            Une clé peut avoir une date d'expiration. Les droits et les routes de chaque type de clé sont
            décrits dans la{' '}
            <DocLink href={DOC_TIERCES_PARTIES}>documentation pour les logiciels tiers</DocLink> et dans la{' '}
            <DocLink href={DOC_CLE_DEDIEE}>documentation pour les clés dédiées</DocLink>.
          </p>
          <p>4.5. L'accès à l'API est gratuit.</p>

          {/* ===================== TITRE II ===================== */}
          <h2 className={h2}>Titre II — Accès en lecture pour les logiciels des chasseurs</h2>

          <h3 className={h3}>Article 5 — Accès en lecture</h3>
          <p>
            5.1. <strong>Bénéficiaires.</strong> L'accès s'adresse aux éditeurs de logiciels utilisés par les
            chasseurs&nbsp;: carnets de chasse, outils de gestion de territoire, de plan de chasse ou
            d'association de chasse.
          </p>
          <p>
            5.2. <strong>Accord préalable de l'Utilisateur.</strong> Le Partenaire n'accède aux données d'un
            Utilisateur qu'après l'Accord de partage de celui-ci, selon le parcours suivant&nbsp;:
          </p>
          <ol className="mt-2 list-decimal pl-12">
            <li>L'Utilisateur demande, dans le logiciel du Partenaire, à relier son compte Zacharie.</li>
            <li>
              Le Partenaire transmet à Zacharie l'adresse email de l'Utilisateur. Zacharie enregistre une
              demande d'accès « en attente ».
            </li>
            <li>
              L'Utilisateur se connecte à Zacharie et ouvre « Paramètres » puis « Partage de mes données ». Il
              accepte ou refuse la demande.
            </li>
            <li>
              Le Partenaire est informé de la réponse par webhook. Tant que l'accord n'est pas donné, il n'a
              accès à aucune fiche ni carcasse.
            </li>
          </ol>
          <p>
            5.3. <strong>Retrait.</strong> L'Utilisateur peut retirer son accord à tout moment depuis la même
            page. Le retrait prend effet immédiatement&nbsp;: l'API cesse de renvoyer ses données et les
            webhooks cessent.
          </p>
          <p>
            5.4. <strong>Périmètre.</strong> Le Partenaire accède aux fiches et carcasses que l'Utilisateur
            peut consulter dans Zacharie, dans la limite des champs listés en annexe A. Il n'accède pas aux
            autres données du compte (téléphone, adresse, numéro de formation…).
          </p>
          <p>
            5.5. <strong>Finalité.</strong> Le Partenaire utilise ces données uniquement pour rendre à
            l'Utilisateur le service qu'il a demandé (par exemple&nbsp;: afficher l'état de ses carcasses dans
            son carnet de chasse). Toute autre utilisation est interdite, notamment la revente, la prospection
            commerciale, la publicité ciblée, le profilage et la constitution de bases de données sur des
            personnes autres que l'Utilisateur.
          </p>

          <h3 className={h3}>Article 6 — Création des fiches dans l'interface Zacharie</h3>
          <p>
            6.1. <strong>Principe.</strong> La création d'une fiche, l'examen initial des carcasses et la
            transmission au détenteur suivant se font <strong>exclusivement dans l'Interface Zacharie</strong>
            . L'API ne permet pas de créer ni de modifier une fiche.
          </p>
          <p>
            6.2. <strong>Raison.</strong> L'examinateur initial engage sa responsabilité personnelle en
            attestant l'examen des carcasses et en approuvant leur mise sur le marché. L'Éditeur doit garantir
            que cet engagement est pris par l'examinateur lui-même, dans un écran dont il maîtrise le contenu,
            les mentions et les contrôles.
          </p>
          <p>
            6.3. <strong>Modes d'intégration autorisés.</strong> Le Partenaire peut ouvrir l'Interface
            Zacharie depuis son logiciel&nbsp;:
          </p>
          <ul className={ul}>
            <li>dans une nouvelle fenêtre ou un nouvel onglet ;</li>
            <li>
              dans une iframe, uniquement depuis les domaines que le Partenaire a déclarés et que l'Éditeur a
              autorisés. Zacharie refuse techniquement l'affichage en iframe sur tout autre domaine.
            </li>
          </ul>
          <p>
            Pour éviter une nouvelle saisie du mot de passe, le Partenaire peut obtenir un jeton de connexion
            à usage unique, valable 5 minutes, pour un Utilisateur qui a donné son accord. Ce jeton connecte
            l'Utilisateur à son propre compte et à aucun autre (voir la{' '}
            <DocLink href={DOC_TIERCES_PARTIES}>documentation</DocLink>).
          </p>
          <p>
            6.4. <strong>Interdictions.</strong> Le Partenaire s'interdit&nbsp;:
          </p>
          <ul className={ul}>
            <li>de reproduire, d'imiter ou de simuler tout ou partie de l'Interface Zacharie ;</li>
            <li>
              de masquer, recouvrir, rogner ou modifier l'iframe, ses mentions ou ses boutons, ou d'y
              superposer un élément ;
            </li>
            <li>de lire, d'enregistrer ou d'automatiser les saisies faites dans l'iframe ;</li>
            <li>d'effectuer une action dans Zacharie à la place de l'Utilisateur ;</li>
            <li>de laisser croire que la fiche est créée ou validée par son propre logiciel.</li>
          </ul>
          <p>
            6.5. Chaque fiche créée depuis le logiciel d'un Partenaire porte un identifiant de contexte de
            création, visible dans les données de la fiche, qui permet de connaître son origine.
          </p>

          <h3 className={h3}>Article 7 — Webhooks</h3>
          <p>
            7.1. Le Partenaire peut déclarer une adresse de webhook. Zacharie y envoie un message à chaque
            événement listé en annexe B, uniquement pour les Utilisateurs qui ont donné leur accord. Le format
            des messages est décrit dans la <DocLink href={DOC_TIERCES_PARTIES}>documentation</DocLink>.
          </p>
          <p>
            7.2. L'adresse doit utiliser le protocole HTTPS. Le message contient les données de la fiche et
            des carcasses concernées, dans le même format que l'API, et un en-tête d'authentification qui
            permet au Partenaire de vérifier qu'il provient de Zacharie.
          </p>
          <p>
            7.3. Les webhooks sont un service d'information. Zacharie ne garantit ni leur délivrance, ni leur
            ordre, ni l'absence de doublon. Un message sans réponse dans les 10 secondes n'est pas renvoyé. Le
            Partenaire qui a besoin d'un état exact interroge l'API. En cas de divergence, les données de
            Zacharie font foi.
          </p>

          <h3 className={h3}>Article 8 — Accès de l'Éditeur au logiciel du Partenaire</h3>
          <p>
            8.1. Le Partenaire met à la disposition de l'Éditeur, en permanence et gratuitement, un accès à
            son logiciel pour un administrateur de Zacharie.
          </p>
          <p>
            8.2. Cet accès permet à l'Éditeur de constater en temps réel l'utilisation réelle de l'API&nbsp;:
            l'intégration de l'Interface Zacharie (iframe ou fenêtre), les données issues de Zacharie qui sont
            affichées et l'usage qui en est fait.
          </p>
          <p>
            8.3. Le Partenaire remet les identifiants de cet accès à la mise en service de sa clé et les
            maintient valides pendant toute la durée de son accès à l'API. L'absence ou l'indisponibilité de
            cet accès peut entraîner la suspension de la clé (article 15.1).
          </p>

          {/* ===================== TITRE III ===================== */}
          <h2 className={h2}>Titre III — Données personnelles, sécurité, exploitation</h2>

          <h3 className={h3}>Article 9 — Protection des données personnelles</h3>
          <p>
            9.1. <strong>Rôles.</strong> La DGAL est responsable du traitement des données dans Zacharie. Le
            Partenaire est responsable des traitements qu'il fait des données reçues par l'API, pour ses
            propres finalités. Il n'agit pas comme sous-traitant de la DGAL.
          </p>
          <p>
            9.2. <strong>Transmission de l'adresse email.</strong> Pour demander l'accès, le Partenaire
            transmet à Zacharie l'adresse email de l'Utilisateur. Le Partenaire garantit&nbsp;:
          </p>
          <ul className={ul}>
            <li>que l'Utilisateur lui a lui-même demandé de relier son compte Zacharie ;</li>
            <li>
              qu'il a informé l'Utilisateur de cette transmission et de ce qui suit, avant de la faire ;
            </li>
            <li>
              qu'il ne transmet pas d'adresse en masse ni d'adresse d'une personne qui ne l'a pas demandé.
            </li>
          </ul>
          <p>
            Zacharie utilise cette adresse uniquement pour retrouver le compte et créer la demande d'accès.
          </p>
          <p>
            9.3. <strong>Base légale du partage.</strong> Le partage des données d'un Utilisateur vers le
            Partenaire repose sur l'accord de l'Utilisateur, donné de façon libre, spécifique et éclairée dans
            Zacharie, et révocable à tout moment (art. 6.1.a du RGPD).
          </p>
          <p>
            9.4. <strong>Obligations du Partenaire.</strong> Le Partenaire s'engage à&nbsp;:
          </p>
          <ul className={ul}>
            <li>ne traiter les données que pour la finalité déclarée à l'article 4.1 ;</li>
            <li>ne collecter que les données nécessaires à cette finalité ;</li>
            <li>
              ne pas transmettre les données à des tiers, sauf à ses propres sous-traitants techniques liés
              par un contrat conforme à l'article 28 du RGPD ;
            </li>
            <li>
              héberger les données dans l'Union européenne, ou à défaut appliquer les garanties du chapitre V
              du RGPD ;
            </li>
            <li>
              mentionner Zacharie et l'origine des données dans sa propre politique de confidentialité ;
            </li>
            <li>
              répondre lui-même aux demandes d'exercice de droits sur ses traitements, et transmettre à
              l'Éditeur celles qui concernent Zacharie ;
            </li>
            <li>
              prévenir l'Éditeur dans les 48 heures de toute violation de données qui touche des données
              issues de Zacharie.
            </li>
          </ul>
          <p>
            9.5. <strong>Données de tiers.</strong> Les noms d'autres acteurs présents dans les fiches
            (examinateur initial, premier détenteur, intermédiaires) sont transmis uniquement pour l'affichage
            à l'Utilisateur. Le Partenaire ne les exploite pas pour un autre usage.
          </p>
          <p>
            9.6. <strong>Conservation.</strong> Lorsque l'Utilisateur retire son accord, ou à la fin de
            l'accès du Partenaire, celui-ci cesse toute collecte et supprime les données issues de Zacharie
            dans un délai de 30 jours, sauf si l'Utilisateur lui a demandé de les conserver dans son propre
            compte.
          </p>
          <p>
            9.7. <strong>Information des Utilisateurs.</strong> La politique de confidentialité de Zacharie
            mentionne les Partenaires comme destinataires possibles des données, sur accord de l'Utilisateur.
            La page « Partage de mes données » liste les Partenaires autorisés.
          </p>

          <h3 className={h3}>Article 10 — Sécurité</h3>
          <p>
            10.1. La clé API est secrète. Le Partenaire la conserve sur ses serveurs et ne l'expose jamais
            dans une application mobile, un navigateur ou un dépôt de code.
          </p>
          <p>
            10.2. Le Partenaire prévient l'Éditeur sans délai s'il soupçonne une compromission de la clé.
            L'Éditeur révoque alors la clé et en délivre une nouvelle.
          </p>
          <p>
            10.3. Le Partenaire met en œuvre des mesures de sécurité adaptées&nbsp;: chiffrement des échanges,
            contrôle des accès, journalisation, mises à jour de sécurité.
          </p>
          <p>
            10.4. Le Partenaire ne tente pas d'accéder à des données hors de ses droits, de contourner les
            limites d'usage ou de tester la sécurité de Zacharie sans accord écrit préalable. Toute faille
            découverte est signalée à l'Éditeur.
          </p>

          <h3 className={h3}>Article 11 — Limites d'usage et journalisation</h3>
          <p>11.1. Chaque clé est limitée à 10 requêtes par seconde. Au-delà, les requêtes sont refusées.</p>
          <p>
            11.2. Zacharie enregistre chaque utilisation de la clé&nbsp;: date, adresse IP, logiciel client,
            adresse appelée. Ces journaux servent à la sécurité, au support et au contrôle du respect des
            présentes conditions.
          </p>

          <h3 className={h3}>Article 12 — Disponibilité et évolutions</h3>
          <p>
            12.1. Zacharie est un service public numérique en phase de construction (programme{' '}
            <a
              href="https://beta.gouv.fr"
              target="_blank"
              rel="noopener noreferrer"
            >
              beta.gouv.fr
            </a>
            ). L'API est fournie sans garantie de disponibilité ni de délai de réponse. L'Éditeur peut
            l'interrompre pour maintenance, si possible après information préalable.
          </p>
          <p>
            12.2. L'API est versionnée (<code>/v1</code>). Une modification qui rend incompatible une
            intégration existante est annoncée au moins 3 mois à l'avance, sauf urgence de sécurité ou
            évolution réglementaire.
          </p>
          <p>
            12.3. La documentation de référence est publiée aux adresses suivantes&nbsp;:{' '}
            <DocLink href={DOC_TIERCES_PARTIES}>documentation pour les logiciels tiers</DocLink> et{' '}
            <DocLink href={DOC_CLE_DEDIEE}>documentation pour les clés dédiées</DocLink>.
          </p>

          <h3 className={h3}>Article 13 — Responsabilités</h3>
          <p>
            13.1. Le Partenaire est seul responsable de son logiciel, de l'usage qu'il fait des données et du
            respect de la réglementation qui lui est applicable.
          </p>
          <p>
            13.2. Les données de Zacharie font foi. Un affichage dans le logiciel du Partenaire ne remplace
            pas la fiche officielle, ni pour le chasseur, ni pour les contrôles.
          </p>
          <p>
            13.3. L'Éditeur n'est pas responsable des dommages qui résultent d'une indisponibilité de l'API,
            d'un webhook non reçu, ou d'un usage de l'API contraire aux présentes conditions.
          </p>

          <h3 className={h3}>Article 14 — Nom, marque et communication</h3>
          <p>
            Le Partenaire peut indiquer que son logiciel est « connecté à Zacharie ». Il ne peut pas utiliser
            le logo de la République française ni laisser croire que son logiciel est agréé, certifié ou
            recommandé par l'État. Toute communication qui cite Zacharie au-delà de cette mention est soumise
            à l'accord préalable de l'Éditeur.
          </p>

          <h3 className={h3}>Article 15 — Suspension et fin de l'accès</h3>
          <p>
            15.1. L'Éditeur peut suspendre ou révoquer une clé sans préavis en cas de manquement aux présentes
            conditions, de risque pour la sécurité ou pour les données, ou à la demande d'une autorité.
          </p>
          <p>15.2. En dehors de ces cas, l'Éditeur peut mettre fin à un accès avec un préavis d'un mois.</p>
          <p>15.3. Le Partenaire peut mettre fin à son accès à tout moment, par simple demande.</p>
          <p>15.4. À la fin de l'accès, l'article 9.6 s'applique.</p>

          <h3 className={h3}>Article 16 — Modification des conditions</h3>
          <p>
            L'Éditeur peut modifier les présentes conditions. Il informe les Partenaires par email au moins 30
            jours avant l'entrée en vigueur. La poursuite de l'utilisation de l'API après cette date vaut
            acceptation.
          </p>

          <h3 className={h3}>Article 17 — Droit applicable et litiges</h3>
          <p>
            Les présentes conditions sont soumises au droit français. Les parties recherchent une solution
            amiable avant toute action. À défaut, le litige est porté devant la juridiction compétente.
          </p>

          {/* ===================== ANNEXES ===================== */}
          <h2 className={h2}>Annexe A — Données transmises par l'API</h2>
          <p>
            Le détail des champs est décrit dans la{' '}
            <DocLink href={DOC_TIERCES_PARTIES}>documentation pour les logiciels tiers</DocLink>.
          </p>
          <div className="overflow-x-auto">
            <table className={table}>
              <thead>
                <tr>
                  <th>Objet</th>
                  <th>Données</th>
                  <th>Données personnelles</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>Fiche</td>
                  <td>
                    Numéro, contexte de création, date et commune de mise à mort, heures de mise à mort et
                    d'éviscération, approbation de mise sur le marché et sa date, dates de création et de
                    modification
                  </td>
                  <td>Nom de l'examinateur initial ; nom ou raison sociale du premier détenteur</td>
                </tr>
                <tr>
                  <td>Carcasse</td>
                  <td>
                    Numéro de bracelet, espèce, type, nombre d'animaux, anomalies relevées à l'examen initial
                    et commentaire, dépôt et transport, motif de refus ou carcasse manquante, dates de prise
                    en charge, statut final, résultats de l'inspection vétérinaire (lésions, décision, pièces)
                  </td>
                  <td>
                    Nom de l'examinateur initial ; nom ou raison sociale du premier détenteur ; commentaires
                    libres
                  </td>
                </tr>
                <tr>
                  <td>Demande d'accès</td>
                  <td>
                    Statut (en attente, acceptée, refusée) ; indication si l'Utilisateur est examinateur
                    initial habilité
                  </td>
                  <td>Adresse email transmise par le Partenaire</td>
                </tr>
              </tbody>
            </table>
          </div>

          <h2 className={h2}>Annexe B — Événements des webhooks</h2>
          <div className="overflow-x-auto">
            <table className={table}>
              <thead>
                <tr>
                  <th>Événement</th>
                  <th>Déclencheur</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>
                    <code>USER_APPROVED_ACCESS</code>
                  </td>
                  <td>L'Utilisateur a accepté la demande d'accès</td>
                </tr>
                <tr>
                  <td>
                    <code>USER_REJECTED_ACCESS</code>
                  </td>
                  <td>L'Utilisateur a refusé la demande d'accès</td>
                </tr>
                <tr>
                  <td>
                    <code>FEI_APPROBATION_MISE_SUR_LE_MARCHE</code>
                  </td>
                  <td>L'examinateur initial a approuvé la mise sur le marché</td>
                </tr>
                <tr>
                  <td>
                    <code>CARCASSE_ASSIGNEE_AU_PROCHAIN_DETENTEUR</code>
                  </td>
                  <td>Une carcasse a été transmise au détenteur suivant</td>
                </tr>
                <tr>
                  <td>
                    <code>CARCASSE_ASSIGNEE_AU_SVI</code>
                  </td>
                  <td>Une carcasse a été transmise au service vétérinaire d'inspection</td>
                </tr>
                <tr>
                  <td>
                    <code>CARCASSE_CLOTUREE</code>
                  </td>
                  <td>Le traitement d'une carcasse est terminé</td>
                </tr>
                <tr>
                  <td>
                    <code>FEI_CLOTUREE</code>
                  </td>
                  <td>La fiche est clôturée</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </article>
  );
}
