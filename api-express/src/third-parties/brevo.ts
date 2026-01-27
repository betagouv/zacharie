import * as brevo from '@getbrevo/brevo';
import { Entity, EntityTypes, User, UserEtgRoles, UserRoles } from '@prisma/client';
import parsePhoneNumber from 'libphonenumber-js';
import prisma from '~/prisma';
import { capture } from './sentry';
import { IS_DEV_OR_TEST, ENVIRONMENT } from '~/config';

const DISABLED = ENVIRONMENT === 'test' || IS_DEV_OR_TEST;
// const DISABLED = false;

const API_KEY = process.env.BREVO_API;

type SendEmailProps = {
  emails: Array<string>;
  subject: string;
  html?: string;
  text?: string;
  from?: {
    name: string;
    email: string;
  };
  attachments?: brevo.SendSmtpEmailAttachmentInner[];
};

async function sendEmail(props: SendEmailProps) {
  try {
    if (IS_DEV_OR_TEST) {
      console.log('Sending email in development mode');
      console.log(props);
      return;
    }
    if (!props.html && !props.text) {
      throw new Error('html or text is required');
    }
    const apiInstance = new brevo.TransactionalEmailsApi();
    // Set the API key for transactional emails
    apiInstance.setApiKey(brevo.TransactionalEmailsApiApiKeys.apiKey, API_KEY);

    const sendSmtpEmail = new brevo.SendSmtpEmail();
    sendSmtpEmail.subject = props.subject;
    if (props.html) {
      sendSmtpEmail.htmlContent = props.html;
    } else if (props.text) {
      sendSmtpEmail.textContent = props.text;
    }
    if (props.from) {
      sendSmtpEmail.sender = props.from;
    } else {
      sendSmtpEmail.sender = {
        name: 'Zacharie',
        email: 'contact@zacharie.beta.gouv.fr',
      };
    }
    if (props.attachments) {
      sendSmtpEmail.attachment = props.attachments;
    }
    sendSmtpEmail.to = props.emails.map((email) => ({ email }));
    const result = await apiInstance.sendTransacEmail(sendSmtpEmail);
    // console.log('Email sent successfully:', result);
  } catch (error) {
    capture(error as Error, {
      extra: {
        props,
      },
    });
  }
}

function formatRoles(user: User) {
  const roles = [];
  switch (user.roles.find((role) => role !== UserRoles.ADMIN)) {
    case UserRoles.CHASSEUR:
      if (user.est_forme_a_l_examen_initial) {
        roles.push('Examinateur initial');
      } else {
        roles.push('Premier détenteur');
      }
      break;
    case UserRoles.SVI:
      roles.push('SVI');
      break;
    case UserRoles.COLLECTEUR_PRO:
      roles.push('Collecteur professionnel indépendant');
      break;
    case UserRoles.ETG:
      roles.push('ETG');
      if (user.etg_role === UserEtgRoles.RECEPTION) {
        roles.push('ETG réception');
      } else if (user.etg_role === UserEtgRoles.TRANSPORT) {
        roles.push('ETG transporteur');
      }
      break;
    default:
      roles.push('Partenaire');
      break;
  }
  return roles;
}

interface BrevoContact extends brevo.GetExtendedContactDetails {
  attributes: {
    PRENOM: string;
    NOM: string;
    ROLE: Array<string>;
    LANDLINE_NUMBER: string;
    SMS: string;
    WHATSAPP: string;
    TELEPHONE_PORTABLE: string;
    TELEPHONE_FIXE: string;
    ADRESSE: string;
    NUM_EXAMINATEUR: string;
    EXT_ID: string;
  };
}

async function createBrevoContact(props: User, createdBy: 'ADMIN' | 'USER'): Promise<User> {
  try {
    if (DISABLED) return props;
    if (props.roles.includes(UserRoles.ADMIN)) return props;
    const apiInstance = new brevo.ContactsApi();
    apiInstance.setApiKey(brevo.ContactsApiApiKeys.apiKey, API_KEY);

    try {
      // wrap in try catch for 404
      const getContact = await apiInstance.getContactInfo(props.email);
      const brevoContact = getContact.body as BrevoContact;
      if (brevoContact?.id) {
        if (!props.brevo_contact_id) {
          props = await prisma.user.update({
            where: { id: props.id },
            data: { brevo_contact_id: brevoContact.id },
          });
        }

        if (brevoContact.attributes.EXT_ID !== props.id) {
          const updateContact = new brevo.UpdateContact();
          updateContact.attributes = {
            EXT_ID: props.id,
          };
          await apiInstance.updateContact(props.brevo_contact_id.toString(), updateContact);
        }
        if (createdBy === 'USER') {
          await sendEmail({
            emails: ['contact@zacharie.beta.gouv.fr'],
            subject: `Nouvelle ouverture de compte pour ${props.email}`,
            text: `Un nouveau compte a été ouvert pour ${props.email}`,
          });
        }
        return props;
      }
    } catch (error) {
      // console.log(error);
    }

    const createContact = new brevo.CreateContact();
    createContact.email = props.email;
    createContact.extId = props.id;
    createContact.attributes = {
      CREATED_BY: [createdBy],
      'CREATION DATE': props.created_at.toISOString(),
      ROLE: formatRoles(props),
    };

    const result = await apiInstance.createContact(createContact);

    // console.log(result);
    props = await prisma.user.update({
      where: { id: props.id },
      data: { brevo_contact_id: result.body.id },
    });
    if (createdBy === 'USER') {
      await sendEmail({
        emails: ['contact@zacharie.beta.gouv.fr'],
        subject: `Nouvelle ouverture de compte pour ${props.email}`,
        text: `Un nouveau compte a été ouvert pour ${props.email}`,
      });
    }
    return props;
  } catch (error) {
    capture(error as Error, {
      extra: {
        user: props,
      },
    });
    return props;
  }
}

type ContactForm = {
  nom_de_famille: string;
  prenom: string;
  email: string;
  telephone: string;
  message: string;
};
async function createBrevoContactFromContactForm(props: ContactForm) {
  try {
    if (DISABLED) return;
    const apiInstance = new brevo.ContactsApi();
    apiInstance.setApiKey(brevo.ContactsApiApiKeys.apiKey, API_KEY);

    try {
      // wrap in try catch for 404
      const getContact = await apiInstance.getContactInfo(props.email);
      const brevoContact = getContact.body as BrevoContact;
      if (brevoContact?.id) {
        return;
      }
    } catch (error) {
      // console.log(error);
    }

    // let LANDLINE_NUMBER = '';
    let SMS = '';
    let WHATSAPP = '';
    let TELEPHONE_PORTABLE = '';
    let TELEPHONE_FIXE = '';
    if (props.telephone) {
      const phoneNumber = parsePhoneNumber(props.telephone, 'FR');
      if (phoneNumber?.isPossible()) {
        if (phoneNumber.number.startsWith('+336') || phoneNumber.number.startsWith('+337')) {
          const existingUser = await prisma.user.findFirst({
            where: { telephone: phoneNumber.number },
          });
          if (!existingUser) {
            SMS = phoneNumber.number;
            WHATSAPP = phoneNumber.number;
          }
          TELEPHONE_PORTABLE = phoneNumber.number;
        } else {
          // LANDLINE_NUMBER = phoneNumber.number;
          TELEPHONE_FIXE = phoneNumber.number;
        }
      }
    }

    const createContact = new brevo.CreateContact();
    createContact.email = props.email;
    createContact.attributes = {
      CREATED_BY: ['CONTACT FORM'],
      'CREATION DATE': new Date().toISOString(),
      PRENOM: props.prenom,
      NOM: props.nom_de_famille,
      // LANDLINE_NUMBER: LANDLINE_NUMBER,
      SMS: SMS,
      WHATSAPP: WHATSAPP,
      TELEPHONE_PORTABLE: TELEPHONE_PORTABLE,
      TELEPHONE_FIXE: TELEPHONE_FIXE,
    };

    const result = await apiInstance.createContact(createContact);
  } catch (error) {
    capture(error as Error, {
      extra: {
        user: props,
      },
    });
  }
}

async function updateBrevoContact(props: User): Promise<User> {
  try {
    if (DISABLED) return props;
    if (props.roles.includes(UserRoles.ADMIN)) return props;
    const apiInstance = new brevo.ContactsApi();
    apiInstance.setApiKey(brevo.ContactsApiApiKeys.apiKey, API_KEY);

    if (!props.brevo_contact_id) {
      const getContact = await apiInstance.getContactInfo(props.email);
      const brevoContact = getContact.body as BrevoContact;
      if (!brevoContact?.id) {
        return props;
      }
      props = await prisma.user.update({
        where: { id: props.id },
        data: { brevo_contact_id: brevoContact.id },
      });
    }

    // let LANDLINE_NUMBER = '';
    let SMS = '';
    let WHATSAPP = '';
    let TELEPHONE_PORTABLE = '';
    let TELEPHONE_FIXE = '';
    if (props.telephone) {
      const phoneNumber = parsePhoneNumber(props.telephone, 'FR');
      if (phoneNumber?.isPossible()) {
        if (phoneNumber.number.startsWith('+336') || phoneNumber.number.startsWith('+337')) {
          const existingUsersWithSamePhoneNumber = await prisma.user.findMany({
            where: { telephone: props.telephone },
          });
          if (existingUsersWithSamePhoneNumber.length === 1) {
            SMS = phoneNumber.number;
            WHATSAPP = phoneNumber.number;
          }
          TELEPHONE_PORTABLE = phoneNumber.number;
        } else {
          // LANDLINE_NUMBER = phoneNumber.number;
          TELEPHONE_FIXE = phoneNumber.number;
        }
      }
    }

    let ADRESSE = '';
    if (props.addresse_ligne_1) {
      ADRESSE += props.addresse_ligne_1;
      if (props.addresse_ligne_2) {
        ADRESSE += `\n${props.addresse_ligne_2}`;
      }
      ADRESSE += `\n${props.code_postal} ${props.ville}`;
    }

    const updateContact = new brevo.UpdateContact();
    updateContact.attributes = {
      PRENOM: props.prenom,
      NOM: props.nom_de_famille,
      ROLE: formatRoles(props),
      // LANDLINE_NUMBER: LANDLINE_NUMBER,
      SMS: SMS,
      WHATSAPP: WHATSAPP,
      TELEPHONE_PORTABLE: TELEPHONE_PORTABLE,
      TELEPHONE_FIXE: TELEPHONE_FIXE,
      ADRESSE: ADRESSE ? ADRESSE : '',
      NUM_EXAMINATEUR: props.numero_cfei,
      EXT_ID: props.id,
    };
    console.log(updateContact.attributes);
    const result = await apiInstance.updateContact(props.brevo_contact_id.toString(), updateContact);
    return props;
  } catch (error) {
    capture(error as Error, {
      extra: {
        user: props,
      },
    });
    return props;
  }
}

interface BrevoCompany extends brevo.Company {
  attributes: {
    cat_gorie?: Array<
      'premier_d_tenteur__chasseur' | 'collecteur' | 'etg' | 'svi' | 'partenaire' | 'examinateur_initial'
    >; // Rôle
    created_at?: string; // Création le
    d_partement?: string; // Département
    code_postal?: string; // Code postal
    compte_transporteur_cr?: boolean; // Compte transporteur créé ?
    compte_transporteur_utilis?: boolean; // Compte transporteur utilisé ?
    d_ploiement_zacharie?: Array<
      | 'aucun__change'
      | 'echange__tabli'
      | 'compte_valid'
      | 'utilisateur'
      | 'ancien_utilisateur___a_chang__d_etg'
      | 'refus___avant_utilisation'
      | 'liste_d_attente'
    >; // Déploiement Zacharie
    etg_contr_l_s_par_ce_svi?: Array<
      // ETG contrôlés par ce SVI
      | 'vilette_viandes' // "VILETTE VIANDES"
      | 'jamet_benoit___plume_2_tout' // "JAMET BENOIT - PLUME 2 TOUT"
      | 'presta_pin_s___les_pin_s' // "PRESTA PIN'S - LES PIN'S"
      | 'societe_d_exploitation_des_abattoirs_de_pamiers' // "SOCIETE D'EXPLOITATION DES ABATTOIRS DE PAMIERS -"
      | 'centre_d_abattage_et_de_transformation_du_couseran' // "CENTRE D'ABATTAGE ET DE TRANSFORMATION DU COUSERAN"
      | 'maison_conquet' // "MAISON CONQUET"
      | 'lorraine_de_venaison' // "LORRAINE DE VENAISON"
      | 'guellier_et_fils' // "GUELLIER ET FILS"
      | 'sarl_gibiers_du_sud_ouest___sud_ouest_gibier' // "SARL GIBIERS DU SUD OUEST - SUD OUEST GIBIER"
      | 'eurl_andre_pascal' // "EURL ANDRE PASCAL"
      | 'l_atelier_du_loup' // "L'ATELIER DU LOUP"
      | 'regie_abattoir_municipal' // "REGIE ABATTOIR MUNICIPAL"
      | 'm_a__brochette' // "M.A. BROCHETTE"
      | 'pyragena' // "PYRAGENA"
      | 'la_catalane_d_abattage' // "LA CATALANE D'ABATTAGE"
      | 'abattoir_transfrontalier_cerdagne_capcir' // "ABATTOIR TRANSFRONTALIER CERDAGNE CAPCIR"
      | 'gibier_marchal' // "GIBIER MARCHAL"
      | 'damien_de_jong' // "DAMIEN DE JONG"
      | 'maison_du_gibier' // "MAISON DU GIBIER"
      | 'gibal_ge' // "GIBAL-GE"
      | 'nemrod_alsace' // "NEMROD ALSACE"
      | 'herrscher_michel_production' // "HERRSCHER MICHEL PRODUCTION"
      | 'chez_laurent___boucherie_charcuterie_traiteur_chez' // "CHEZ LAURENT - BOUCHERIE CHARCUTERIE TRAITEUR CHEZ"
      | 'societe_d_abattage_des_vosges_saonoises' // "SOCIETE D'ABATTAGE DES VOSGES SAONOISES"
      | 'federation_departementale_des_chasseurs_de_la_haut' // "FEDERATION DEPARTEMENTALE DES CHASSEURS DE LA HAUT"
      | 'au_gibier_de_france' // "AU GIBIER DE FRANCE"
      | 'nemrod_sologne'
    >; // "NEMROD SOLOGNE"
    last_updated_at?: string;
    linked_contacts?: Array<BrevoContact['id']>;
    mail?: string;
    name?: string;
    next_activity_date?: string;
    nombre_d_etg_pour_cet_svi?: number; // Nombre d'ETG pour ce SVI
    number_of_activities?: number; // Nombre d'activités
    number_of_contacts?: number; // Nombre de contacts
    num_ro_ccg?: string; // Numéro CCG
    num_ro_ccg_v_rifi?: boolean; // Numéro CCG vérifié ?
    number_of_employees?: number; // Nombre d'employés
    owner?: string; // Propriétaire
    owner_assign_date?: string; // Date d'attribution du propriétaire
    phone_number?: string; // Numéro de téléphone
    revenue?: number; // Chiffre d'affaires
  };
}

function getBrevoCategory(type: EntityTypes) {
  switch (type) {
    case EntityTypes.PREMIER_DETENTEUR:
      return 'premier_d_tenteur__chasseur';
    case EntityTypes.COLLECTEUR_PRO:
      return 'collecteur';
    case EntityTypes.ETG:
      return 'etg';
    case EntityTypes.SVI:
      return 'svi';
    default:
      return 'partenaire';
  }
}

async function updateOrCreateBrevoCompany(props: Entity): Promise<Entity> {
  try {
    if (DISABLED) return props;
    const apiInstance = new brevo.CompaniesApi();
    apiInstance.setApiKey(brevo.CompaniesApiApiKeys.apiKey, API_KEY);

    const brevoCompany: BrevoCompany = {
      attributes: {
        name: props.raison_sociale,
        cat_gorie: [getBrevoCategory(props.type)],
        code_postal: props.code_postal || undefined,
        d_partement: props.code_postal?.slice(0, 2) || undefined,
        num_ro_ccg: props.numero_ddecpp || undefined,
      },
    };

    if (!props.brevo_id) {
      console.log('Creating Brevo company');
      const result = await apiInstance.companiesPost({
        name: props.raison_sociale,
        attributes: brevoCompany.attributes,
      });
      const updatedEntity = await prisma.entity.update({
        where: { id: props.id },
        data: { brevo_id: result.body.id },
      });
      return updatedEntity;
    }

    console.log('Updating Brevo company');
    await apiInstance.companiesIdPatch(props.brevo_id, {
      attributes: brevoCompany.attributes,
    });
    return props;
  } catch (error) {
    capture(error as Error, {
      extra: {
        entity: props,
      },
    });
    return props;
  }
}

async function linkBrevoCompanyToContact(entity: Entity, user: User) {
  try {
    if (DISABLED) return;
    const apiInstance = new brevo.CompaniesApi();
    apiInstance.setApiKey(brevo.CompaniesApiApiKeys.apiKey, API_KEY);
    console.log('Linking Brevo company to contact', entity.brevo_id, user.brevo_contact_id);
    await apiInstance.companiesLinkUnlinkIdPatch(entity.brevo_id, {
      linkContactIds: [user.brevo_contact_id],
    });
  } catch (error) {
    capture(error as Error, {
      extra: {
        entity,
        user,
      },
    });
  }
}

async function unlinkBrevoCompanyToContact(entity: Entity, user: User) {
  try {
    if (DISABLED) return;
    const apiInstance = new brevo.CompaniesApi();
    apiInstance.setApiKey(brevo.CompaniesApiApiKeys.apiKey, API_KEY);
    await apiInstance.companiesLinkUnlinkIdPatch(entity.brevo_id, {
      unlinkContactIds: [user.brevo_contact_id],
    });
  } catch (error) {
    capture(error as Error, {
      extra: {
        entity,
        user,
      },
    });
  }
}

interface BrevoDeal extends brevo.Deal {
  attributes: {
    created_at: string;
    d_patement: number;
    deal_name: string;
    deal_owner: string;
    deal_stage: string;
    pipeline: string;
    destinataire_fiche?: Array<string>;
    last_activity_date?: string;
    last_updated_date?: string;
    number_of_activities?: number;
    number_of_contacts?: number;
    stage_updated_at?: string;
  };
}

interface BrevoChasseurPipeline extends brevo.Pipeline {
  pipelineName: 'Chasseurs';
  stages: Array<{
    id: string;
    name:
      | 'Pas de réponse'
      | 'Inscription à valider'
      | "Liste d'attente"
      | 'Recrutement en cours'
      | 'Compte créé'
      | '1ere fiche envoyée'
      | 'Refus';
  }>;
}

interface BrevoSviPipeline extends brevo.Pipeline {
  pipelineName: 'SVI';
  stages: Array<{
    id: string;
    name:
      | 'Pas de réponse'
      | "En attente - pas d'ETG"
      | 'Recrutement en cours'
      | 'Compte créé'
      | '1ère fiche reçue'
      | 'Refus';
  }>;
}

interface BrevoETGPipeline extends brevo.Pipeline {
  pipelineName: 'ETG';
  stages: Array<{
    id: string;
    name:
      | 'Pas de coordonnées'
      | 'Pas de réponse'
      | 'Recrutement en cours'
      | 'Compte créé'
      | 'Chasseurs contactés'
      | '1ère fiche traitée'
      | 'Refus';
  }>;
}

interface BrevoCollecteursPipeline extends brevo.Pipeline {
  pipelineName: 'Collecteurs';
  stages: Array<{
    id: string;
    name:
      | 'Pas de coordonnées'
      | 'Pas de réponse'
      | 'Inscription à valider'
      | 'Recrutement en cours'
      | '1ère fiche traitée'
      | 'Refus';
  }>;
}

type BrevoPipeline = BrevoChasseurPipeline | BrevoSviPipeline | BrevoETGPipeline | BrevoCollecteursPipeline;

function getChasseurPipelineStep(
  chasseur: User,
  pipelineStages: BrevoChasseurPipeline['stages'],
): BrevoChasseurPipeline['stages'][number]['id'] {
  let allFieldUpFields = true;
  if (!chasseur.telephone) allFieldUpFields = false;
  if (!chasseur.email) allFieldUpFields = false;
  if (!chasseur.nom_de_famille) allFieldUpFields = false;
  if (!chasseur.prenom) allFieldUpFields = false;
  if (!chasseur.addresse_ligne_1) allFieldUpFields = false;
  if (!chasseur.code_postal) allFieldUpFields = false;
  if (!chasseur.ville) allFieldUpFields = false;
  let isActivated = chasseur.activated;
  if (isActivated) {
    if (chasseur.at_least_one_fei_treated) {
      return pipelineStages.find((stage) => stage.name === '1ere fiche envoyée')?.id;
    }
    return pipelineStages.find((stage) => stage.name === 'Compte créé')?.id;
  }
  if (!allFieldUpFields) {
    return pipelineStages.find((stage) => stage.name === 'Inscription à valider')?.id;
  }
  if (!isActivated) {
    return pipelineStages.find((stage) => stage.name === "Liste d'attente")?.id;
  }

  return null;
}

async function updateBrevoChasseurDeal(chasseur: User) {
  try {
    if (DISABLED) return;
    if (!chasseur.roles.includes(UserRoles.CHASSEUR)) {
      return;
    }
    if (!chasseur.brevo_contact_id) {
      return;
    }

    const apiInstance = new brevo.DealsApi();
    apiInstance.setApiKey(brevo.DealsApiApiKeys.apiKey, API_KEY);

    const getDealsResult = await apiInstance.crmDealsGet(
      undefined, // filtersAttributesDealName?: string,
      undefined, // filtersLinkedCompaniesIds?: string,
      chasseur.brevo_contact_id.toString(), // filtersLinkedContactsIds?: string
    );
    let deals = getDealsResult?.body?.items as Array<BrevoDeal>;
    const allPipelines = await apiInstance.crmPipelineDetailsAllGet();
    const pipelines = allPipelines.body as Array<BrevoPipeline>;
    const chasseurPipeline = pipelines.find(
      (pipeline) => pipeline.pipelineName === 'Chasseurs',
    ) as BrevoChasseurPipeline;

    const dealToUpdate = deals?.find((deal) => deal.attributes.pipeline === chasseurPipeline.pipeline);

    if (!dealToUpdate) {
      const createDealBodyAttributes: BrevoDeal['attributes'] = {
        created_at: new Date().toISOString(),
        d_patement: chasseur.code_postal?.length > 4 ? Number(chasseur.code_postal.slice(0, 2)) : 0,
        deal_name: `${chasseur.prenom} ${chasseur.nom_de_famille}`,
        deal_owner: '67d2cf69c9580538a20d4b95', // fixed owner id, to hack deals system to fit our needs
        deal_stage: getChasseurPipelineStep(chasseur, chasseurPipeline.stages), // it's an ObjectId
        pipeline: chasseurPipeline.pipeline,
      };
      await apiInstance.crmDealsPost({
        name: `${chasseur.prenom} ${chasseur.nom_de_famille}`,
        attributes: createDealBodyAttributes,
        linkedContactsIds: [chasseur.brevo_contact_id],
      });
      return;
    }

    if (getChasseurPipelineStep(chasseur, chasseurPipeline.stages) !== dealToUpdate.attributes.deal_stage) {
      await apiInstance.crmDealsIdPatch(dealToUpdate.id, {
        attributes: {
          d_patement: chasseur.code_postal?.length > 4 ? Number(chasseur.code_postal.slice(0, 2)) : 0,
          deal_name: `${chasseur.prenom} ${chasseur.nom_de_famille}`,
          deal_stage: getChasseurPipelineStep(chasseur, chasseurPipeline.stages),
        },
      });
    }
  } catch (error) {
    capture(error as Error, {
      extra: {
        user: chasseur,
      },
    });
  }
}

async function updateBrevoETGDealPremiereFiche(etg: Entity) {
  try {
    if (DISABLED) return;
    if (etg.type !== EntityTypes.ETG) return;

    const apiInstance = new brevo.DealsApi();
    apiInstance.setApiKey(brevo.DealsApiApiKeys.apiKey, API_KEY);

    const getDealsResult = await apiInstance.crmDealsGet(
      undefined, // filtersAttributesDealName?: string,
      etg.brevo_id, // filtersLinkedCompaniesIds?: string,
      undefined, // filtersLinkedContactsIds?: string
    );
    let deals = getDealsResult?.body?.items as Array<BrevoDeal>;
    const allPipelines = await apiInstance.crmPipelineDetailsAllGet();
    const pipelines = allPipelines.body as Array<BrevoPipeline>;
    const etgPipeline = pipelines.find((pipeline) => pipeline.pipelineName === 'ETG') as BrevoETGPipeline;

    const dealToUpdate = deals?.find((deal) => deal.attributes.pipeline === etgPipeline.pipeline);

    if (!dealToUpdate) {
      capture(new Error('No deal found for ETG'), {
        extra: {
          etg,
        },
      });
      return;
    }

    const dealStage = etgPipeline.stages.find((stage) => stage.name === '1ère fiche traitée')?.id;

    await apiInstance.crmDealsIdPatch(dealToUpdate.id, {
      attributes: {
        deal_stage: dealStage,
        pipeline: etgPipeline.pipeline,
      },
    });
  } catch (error) {
    capture(error as Error, {
      extra: {
        user: etg,
      },
    });
  }
}

async function updateBrevoSVIDealPremiereFiche(svi: Entity) {
  try {
    if (DISABLED) return;
    if (svi.type !== EntityTypes.SVI) return;

    const apiInstance = new brevo.DealsApi();
    apiInstance.setApiKey(brevo.DealsApiApiKeys.apiKey, API_KEY);

    const getDealsResult = await apiInstance.crmDealsGet(
      undefined, // filtersAttributesDealName?: string,
      svi.brevo_id, // filtersLinkedCompaniesIds?: string,
      undefined, // filtersLinkedContactsIds?: string
    );
    let deals = getDealsResult?.body?.items as Array<BrevoDeal>;
    const allPipelines = await apiInstance.crmPipelineDetailsAllGet();
    const pipelines = allPipelines.body as Array<BrevoPipeline>;
    const sviPipeline = pipelines.find((pipeline) => pipeline.pipelineName === 'SVI') as BrevoSviPipeline;

    const dealToUpdate = deals?.find((deal) => deal.attributes.pipeline === sviPipeline.pipeline);

    if (!dealToUpdate) {
      capture(new Error('No deal found for SVI'), {
        extra: {
          svi,
        },
      });
      return;
    }

    const dealStage = sviPipeline.stages.find((stage) => stage.name === '1ère fiche reçue')?.id;

    await apiInstance.crmDealsIdPatch(dealToUpdate.id, {
      attributes: {
        deal_stage: dealStage,
        pipeline: sviPipeline.pipeline,
      },
    });
  } catch (error) {
    capture(error as Error, {
      extra: {
        user: svi,
      },
    });
  }
}

export {
  // services
  sendEmail,
  // specific to zacharie
  // contact
  createBrevoContactFromContactForm,
  createBrevoContact,
  updateBrevoContact,
  // company
  updateOrCreateBrevoCompany,
  linkBrevoCompanyToContact,
  unlinkBrevoCompanyToContact,
  // deals
  updateBrevoChasseurDeal,
  updateBrevoETGDealPremiereFiche,
  updateBrevoSVIDealPremiereFiche,
};

// prisma.user
//   .findMany({
//     where: {
//       brevo_contact_id: { not: null },
//       roles: { has: UserRoles.COLLECTEUR_PRO },
//     },
//   })
//   .then(async (users) => {
//     console.log(`Updating ${users.length} Brevo contacts`);
//     for (const user of users) {
//       console.log(`Updating Brevo contact for ${user.email}`);
//       await updateBrevoContact(user);
//       console.log(`Updated Brevo contact for ${user.email}`);
//     }
//     console.log('Done');
//   });
