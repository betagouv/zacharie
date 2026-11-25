import * as brevo from '@getbrevo/brevo';
import { Entity, EntityTypes, User, UserEtgRoles, UserRoles } from '@prisma/client';
import parsePhoneNumber from 'libphonenumber-js';
import prisma from '~/prisma';
import { capture } from './sentry';
import { IS_DEV_OR_TEST, ENVIRONMENT } from '~/config';
import { escapeBrevoPlaceholders } from '~/utils/sanitize';
import { getChasseurDealName } from '~/utils/brevo-chasseur-deal-name';

const DISABLED = ENVIRONMENT === 'test' || IS_DEV_OR_TEST;

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
  cc?: Array<string>;
};

export type SentEmail = { messageId: string | null };

async function sendEmail(props: SendEmailProps): Promise<SentEmail | false> {
  try {
    if (IS_DEV_OR_TEST) {
      console.log('Sending email in development mode');
      console.log(props);
      return { messageId: null };
    }
    if (!props.html && !props.text) {
      throw new Error('html or text is required');
    }
    const apiInstance = new brevo.TransactionalEmailsApi();
    apiInstance.setApiKey(brevo.TransactionalEmailsApiApiKeys.apiKey, API_KEY);

    const sendSmtpEmail = new brevo.SendSmtpEmail();
    sendSmtpEmail.subject = escapeBrevoPlaceholders(props.subject);
    if (props.html) {
      sendSmtpEmail.htmlContent = escapeBrevoPlaceholders(props.html);
    } else if (props.text) {
      sendSmtpEmail.textContent = escapeBrevoPlaceholders(props.text);
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
    if (props.cc?.length) {
      sendSmtpEmail.cc = props.cc.map((email) => ({ email }));
    }
    const result = await apiInstance.sendTransacEmail(sendSmtpEmail);
    return { messageId: result.body.messageId ?? null };
  } catch (error) {
    capture(error as Error, {
      extra: {
        subject: props.subject,
        recipientsCount: props.emails.length,
        brevoResponse: brevoErrorResponse(error).data,
      },
    });
    return false;
  }
}

type SendTemplateEmailProps = {
  emails: Array<string>;
  templateId: number;
  params?: Record<string, unknown>;
  from?: {
    name: string;
    email: string;
  };
  attachments?: brevo.SendSmtpEmailAttachmentInner[];
  cc?: Array<string>;
};

async function sendTemplateEmail(props: SendTemplateEmailProps): Promise<SentEmail | false> {
  try {
    if (!props.templateId) {
      capture(new Error('sendTemplateEmail appelé sans templateId'), {
        extra: {
          recipientsCount: props.emails.length,
          paramsKeys: Object.keys(props.params ?? {}),
        },
      });
      return false;
    }
    if (IS_DEV_OR_TEST) {
      console.log('Sending template email in development mode');
      console.log(props);
      return { messageId: null };
    }
    const apiInstance = new brevo.TransactionalEmailsApi();
    apiInstance.setApiKey(brevo.TransactionalEmailsApiApiKeys.apiKey, API_KEY);

    const sendSmtpEmail = new brevo.SendSmtpEmail();
    sendSmtpEmail.templateId = props.templateId;
    if (props.params) {
      sendSmtpEmail.params = props.params;
    }
    if (props.from) {
      sendSmtpEmail.sender = props.from;
    }
    if (props.attachments) {
      sendSmtpEmail.attachment = props.attachments;
    }
    sendSmtpEmail.to = props.emails.map((email) => ({ email }));
    if (props.cc?.length) {
      sendSmtpEmail.cc = props.cc.map((email) => ({ email }));
    }
    const result = await apiInstance.sendTransacEmail(sendSmtpEmail);
    return { messageId: result.body.messageId ?? null };
  } catch (error) {
    capture(error as Error, {
      extra: {
        templateId: props.templateId,
        recipientsCount: props.emails.length,
        brevoResponse: brevoErrorResponse(error).data,
      },
    });
    return false;
  }
}

const DELIVERY_FAILURE_EVENTS = ['bounces', 'hardBounces', 'softBounces', 'invalid', 'blocked', 'error'];

async function getEmailDeliveryFailure(messageId: string, email: string): Promise<string | null> {
  try {
    const apiInstance = new brevo.TransactionalEmailsApi();
    apiInstance.setApiKey(brevo.TransactionalEmailsApiApiKeys.apiKey, API_KEY);
    const result = await apiInstance.getEmailEventReport(
      50,
      0,
      undefined,
      undefined,
      2,
      email,
      undefined,
      undefined,
      messageId
    );
    const failure = (result.body.events ?? []).find((event) =>
      DELIVERY_FAILURE_EVENTS.includes(String(event.event))
    );
    return failure ? String(failure.event) : null;
  } catch (error) {
    capture(error as Error, { extra: { messageId } });
    return null;
  }
}

function formatRoles(user: User) {
  const roles = [];
  switch (user.roles[0]) {
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
    case UserRoles.COMMERCE_DE_DETAIL:
      roles.push('Commerce de détail');
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

async function formatContactAttributes(
  user: User
): Promise<Omit<BrevoContact['attributes'], 'LANDLINE_NUMBER'>> {
  let SMS = '';
  let WHATSAPP = '';
  let TELEPHONE_PORTABLE = '';
  let TELEPHONE_FIXE = '';
  if (user.telephone) {
    const phoneNumber = parsePhoneNumber(user.telephone, 'FR');
    if (phoneNumber?.isPossible()) {
      if (phoneNumber.number.startsWith('+336') || phoneNumber.number.startsWith('+337')) {
        const existingUsersWithSamePhoneNumber = await prisma.user.findMany({
          where: { telephone: user.telephone },
        });
        if (existingUsersWithSamePhoneNumber.length === 1) {
          SMS = phoneNumber.number;
          WHATSAPP = phoneNumber.number;
        }
        TELEPHONE_PORTABLE = phoneNumber.number;
      } else {
        TELEPHONE_FIXE = phoneNumber.number;
      }
    }
  }

  let ADRESSE = '';
  if (user.addresse_ligne_1) {
    ADRESSE += user.addresse_ligne_1;
    if (user.addresse_ligne_2) {
      ADRESSE += `\n${user.addresse_ligne_2}`;
    }
    ADRESSE += `\n${user.code_postal} ${user.ville}`;
  }

  return {
    PRENOM: user.prenom,
    NOM: user.nom_de_famille,
    ROLE: formatRoles(user),
    SMS: SMS,
    WHATSAPP: WHATSAPP,
    TELEPHONE_PORTABLE: TELEPHONE_PORTABLE,
    TELEPHONE_FIXE: TELEPHONE_FIXE,
    ADRESSE: ADRESSE,
    NUM_EXAMINATEUR: user.numero_cfei,
    EXT_ID: user.id,
  };
}

async function createBrevoContact(
  props: User,
  createdBy: 'ADMIN' | 'USER',
  { notifyTeam = true }: { notifyTeam?: boolean } = {}
): Promise<User> {
  try {
    if (DISABLED) return props;
    if (props.isZacharieAdmin) return props;
    const apiInstance = new brevo.ContactsApi();
    apiInstance.setApiKey(brevo.ContactsApiApiKeys.apiKey, API_KEY);

    try {
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
        if (notifyTeam && createdBy === 'USER') {
          await sendEmail({
            emails: ['contact@zacharie.beta.gouv.fr'],
            subject: `Nouvelle ouverture de compte pour ${props.email}`,
            text: `Un nouveau compte a été ouvert pour ${props.email}`,
          });
        }
        return props;
      }
    } catch (error) {}

    const createContact = new brevo.CreateContact();
    createContact.email = props.email;
    createContact.extId = props.id;
    createContact.attributes = {
      ...(await formatContactAttributes(props)),
      CREATED_BY: [createdBy],
      'CREATION DATE': props.created_at.toISOString(),
    };

    const result = await apiInstance.createContact(createContact);

    props = await prisma.user.update({
      where: { id: props.id },
      data: { brevo_contact_id: result.body.id },
    });
    if (notifyTeam && createdBy === 'USER') {
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
        userId: props.id,
        brevoResponse: brevoErrorResponse(error).data,
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
      const getContact = await apiInstance.getContactInfo(props.email);
      const brevoContact = getContact.body as BrevoContact;
      if (brevoContact?.id) {
        return;
      }
    } catch (error) {}

    let TELEPHONE_PORTABLE = '';
    let TELEPHONE_FIXE = '';
    if (props.telephone) {
      const phoneNumber = parsePhoneNumber(props.telephone, 'FR');
      if (phoneNumber?.isPossible()) {
        if (phoneNumber.number.startsWith('+336') || phoneNumber.number.startsWith('+337')) {
          TELEPHONE_PORTABLE = phoneNumber.number;
        } else {
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
      TELEPHONE_PORTABLE: TELEPHONE_PORTABLE,
      TELEPHONE_FIXE: TELEPHONE_FIXE,
    };

    const result = await apiInstance.createContact(createContact);
  } catch (error) {
    capture(error as Error);
  }
}

function brevoErrorResponse(error: unknown): { status?: number; data?: unknown } {
  const response = (error as { response?: { status?: number; data?: unknown } })?.response;
  return { status: response?.status, data: response?.data };
}

function isBrevoDuplicatePhoneError(error: unknown): boolean {
  const { status, data } = brevoErrorResponse(error);
  if (status !== 400) return false;
  return /duplicate|SMS|WHATSAPP/i.test(JSON.stringify(data ?? ''));
}

async function updateBrevoContact(props: User, createdBy: 'ADMIN' | 'USER'): Promise<User> {
  try {
    if (DISABLED) return props;
    if (props.isZacharieAdmin) return props;
    const apiInstance = new brevo.ContactsApi();
    apiInstance.setApiKey(brevo.ContactsApiApiKeys.apiKey, API_KEY);

    if (!props.brevo_contact_id) {
      let brevoContact: BrevoContact | null = null;
      try {
        const getContact = await apiInstance.getContactInfo(props.email);
        brevoContact = getContact.body as BrevoContact;
      } catch (error) {
        if (brevoErrorResponse(error).status !== 404) throw error;
      }
      if (!brevoContact?.id) {
        return createBrevoContact(props, createdBy, { notifyTeam: false });
      }
      props = await prisma.user.update({
        where: { id: props.id },
        data: { brevo_contact_id: brevoContact.id },
      });
    }

    const attributes = await formatContactAttributes(props);
    const updateContact = new brevo.UpdateContact();
    updateContact.attributes = attributes;
    try {
      await apiInstance.updateContact(props.brevo_contact_id.toString(), updateContact);
    } catch (error) {
      if (!isBrevoDuplicatePhoneError(error)) throw error;
      const { SMS: _sms, WHATSAPP: _whatsapp, ...attributesWithoutUniquePhone } = attributes;
      updateContact.attributes = attributesWithoutUniquePhone;
      await apiInstance.updateContact(props.brevo_contact_id.toString(), updateContact);
    }
    return props;
  } catch (error) {
    capture(error as Error, {
      extra: {
        userId: props.id,
        brevoResponse: brevoErrorResponse(error).data,
      },
    });
    return props;
  }
}

interface BrevoCompany extends brevo.Company {
  attributes: {
    cat_gorie?: Array<
      'premier_d_tenteur__chasseur' | 'collecteur' | 'etg' | 'svi' | 'partenaire' | 'examinateur_initial'
    >;
    created_at?: string;
    d_partement?: string;
    code_postal?: string;
    compte_transporteur_cr?: boolean;
    compte_transporteur_utilis?: boolean;
    d_ploiement_zacharie?: Array<
      | 'aucun__change'
      | 'echange__tabli'
      | 'compte_valid'
      | 'utilisateur'
      | 'ancien_utilisateur___a_chang__d_etg'
      | 'refus___avant_utilisation'
      | 'liste_d_attente'
    >;
    etg_contr_l_s_par_ce_svi?: Array<
      | 'vilette_viandes'
      | 'jamet_benoit___plume_2_tout'
      | 'presta_pin_s___les_pin_s'
      | 'societe_d_exploitation_des_abattoirs_de_pamiers'
      | 'centre_d_abattage_et_de_transformation_du_couseran'
      | 'maison_conquet'
      | 'lorraine_de_venaison'
      | 'guellier_et_fils'
      | 'sarl_gibiers_du_sud_ouest___sud_ouest_gibier'
      | 'eurl_andre_pascal'
      | 'l_atelier_du_loup'
      | 'regie_abattoir_municipal'
      | 'm_a__brochette'
      | 'pyragena'
      | 'la_catalane_d_abattage'
      | 'abattoir_transfrontalier_cerdagne_capcir'
      | 'gibier_marchal'
      | 'damien_de_jong'
      | 'maison_du_gibier'
      | 'gibal_ge'
      | 'nemrod_alsace'
      | 'herrscher_michel_production'
      | 'chez_laurent___boucherie_charcuterie_traiteur_chez'
      | 'societe_d_abattage_des_vosges_saonoises'
      | 'federation_departementale_des_chasseurs_de_la_haut'
      | 'au_gibier_de_france'
      | 'nemrod_sologne'
    >;
    last_updated_at?: string;
    linked_contacts?: Array<BrevoContact['id']>;
    mail?: string;
    name?: string;
    next_activity_date?: string;
    nombre_d_etg_pour_cet_svi?: number;
    number_of_activities?: number;
    number_of_contacts?: number;
    num_ro_ccg?: string;
    num_ro_ccg_v_rifi?: boolean;
    number_of_employees?: number;
    owner?: string;
    owner_assign_date?: string;
    phone_number?: string;
    revenue?: number;
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
    if (props.for_testing) return props;
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
    if (entity.for_testing) return;
    if (!entity.brevo_id) return;
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
        userId: user.id,
      },
    });
  }
}

async function unlinkBrevoCompanyToContact(entity: Entity, user: User) {
  try {
    if (DISABLED) return;
    if (entity.for_testing) return;
    if (!entity.brevo_id) return;
    const apiInstance = new brevo.CompaniesApi();
    apiInstance.setApiKey(brevo.CompaniesApiApiKeys.apiKey, API_KEY);
    await apiInstance.companiesLinkUnlinkIdPatch(entity.brevo_id, {
      unlinkContactIds: [user.brevo_contact_id],
    });
  } catch (error) {
    capture(error as Error, {
      extra: {
        entity,
        userId: user.id,
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
  pipelineStages: BrevoChasseurPipeline['stages']
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
      undefined,
      undefined,
      chasseur.brevo_contact_id.toString()
    );
    let deals = getDealsResult?.body?.items as Array<BrevoDeal>;
    const allPipelines = await apiInstance.crmPipelineDetailsAllGet();
    const pipelines = allPipelines.body as Array<BrevoPipeline>;
    const chasseurPipeline = pipelines.find(
      (pipeline) => pipeline.pipelineName === 'Chasseurs'
    ) as BrevoChasseurPipeline;

    const dealToUpdate = deals?.find((deal) => deal.attributes.pipeline === chasseurPipeline.pipeline);

    if (!dealToUpdate) {
      const createDealBodyAttributes: BrevoDeal['attributes'] = {
        created_at: new Date().toISOString(),
        d_patement: chasseur.code_postal?.length > 4 ? Number(chasseur.code_postal.slice(0, 2)) : 0,
        deal_name: getChasseurDealName(chasseur),
        deal_owner: '67d2cf69c9580538a20d4b95',
        deal_stage: getChasseurPipelineStep(chasseur, chasseurPipeline.stages),
        pipeline: chasseurPipeline.pipeline,
      };
      await apiInstance.crmDealsPost({
        name: getChasseurDealName(chasseur),
        attributes: createDealBodyAttributes,
        linkedContactsIds: [chasseur.brevo_contact_id],
      });
      return;
    }

    if (getChasseurPipelineStep(chasseur, chasseurPipeline.stages) !== dealToUpdate.attributes.deal_stage) {
      await apiInstance.crmDealsIdPatch(dealToUpdate.id, {
        attributes: {
          d_patement: chasseur.code_postal?.length > 4 ? Number(chasseur.code_postal.slice(0, 2)) : 0,
          deal_name: getChasseurDealName(chasseur),
          deal_stage: getChasseurPipelineStep(chasseur, chasseurPipeline.stages),
        },
      });
    }
  } catch (error) {
    capture(error as Error, {
      extra: {
        userId: chasseur.id,
        brevoResponse: brevoErrorResponse(error).data,
      },
    });
  }
}

async function updateBrevoETGDealPremiereFiche(etg: Entity) {
  try {
    if (DISABLED) return;
    if (etg.for_testing) return;
    if (etg.type !== EntityTypes.ETG) return;

    const apiInstance = new brevo.DealsApi();
    apiInstance.setApiKey(brevo.DealsApiApiKeys.apiKey, API_KEY);

    const getDealsResult = await apiInstance.crmDealsGet(undefined, etg.brevo_id, undefined);
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
        userId: etg.id,
      },
    });
  }
}

async function updateBrevoSVIDealPremiereFiche(svi: Entity) {
  try {
    if (DISABLED) return;
    if (svi.for_testing) return;
    if (svi.type !== EntityTypes.SVI) return;

    const apiInstance = new brevo.DealsApi();
    apiInstance.setApiKey(brevo.DealsApiApiKeys.apiKey, API_KEY);

    const getDealsResult = await apiInstance.crmDealsGet(undefined, svi.brevo_id, undefined);
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
        userId: svi.id,
      },
    });
  }
}

export {
  sendEmail,
  sendTemplateEmail,
  getEmailDeliveryFailure,
  createBrevoContactFromContactForm,
  createBrevoContact,
  updateBrevoContact,
  updateOrCreateBrevoCompany,
  linkBrevoCompanyToContact,
  unlinkBrevoCompanyToContact,
  updateBrevoChasseurDeal,
  updateBrevoETGDealPremiereFiche,
  updateBrevoSVIDealPremiereFiche,
};
