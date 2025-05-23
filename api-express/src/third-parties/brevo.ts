import * as brevo from '@getbrevo/brevo';
import { Entity, EntityTypes, User, UserRoles } from '@prisma/client';
import parsePhoneNumber from 'libphonenumber-js';
import prisma from '~/prisma';

const API_KEY = process.env.BREVO_API;

type SendEmailProps = {
  emails: Array<string>;
  subject: string;
  html?: string;
  text?: string;
  from?: string;
};
export async function sendEmail(props: SendEmailProps) {
  if (process.env.NODE_ENV === 'development') {
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
  sendSmtpEmail.sender = {
    name: 'Zacharie',
    email: 'contact@zacharie.beta.gouv.fr',
  };
  sendSmtpEmail.to = props.emails.map((email) => ({ email }));
  const result = await apiInstance.sendTransacEmail(sendSmtpEmail);
  // console.log('Email sent successfully:', result);
}

function formatRoles(role: UserRoles) {
  switch (role) {
    case UserRoles.EXAMINATEUR_INITIAL:
      return 'Examinateur initial';
    case UserRoles.PREMIER_DETENTEUR:
      return 'Premier détenteur';
    case UserRoles.SVI:
      return 'SVI';
    case UserRoles.COLLECTEUR_PRO:
      return 'Collecteur';
    case UserRoles.ETG:
      return 'ETG';
    default:
      return 'Partenaire';
  }
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
export async function createBrevoContact(props: User, createdBy: 'ADMIN' | 'USER') {
  if (process.env.NODE_ENV === 'development') {
    console.log('Creating Brevo contact in development mode');
    console.log(props);
    return;
  }
  if (props.roles.includes(UserRoles.ADMIN)) {
    return;
  }
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
      return;
    }
  } catch (error) {
    console.log(error);
  }

  const createContact = new brevo.CreateContact();
  createContact.email = props.email;
  createContact.extId = props.id;
  createContact.attributes = {
    CREATED_BY: [createdBy],
    'CREATION DATE': props.created_at.toISOString(),
    ROLE: props.roles.map(formatRoles),
  };

  const result = await apiInstance.createContact(createContact);

  // console.log(result);
  await prisma.user.update({
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
}

export async function updateBrevoContact(props: User) {
  if (process.env.NODE_ENV === 'development') {
    console.log('Updating Brevo contact in development mode');
    console.log(props);
    return;
  }
  if (props.roles.includes(UserRoles.ADMIN)) {
    return;
  }
  const apiInstance = new brevo.ContactsApi();
  apiInstance.setApiKey(brevo.ContactsApiApiKeys.apiKey, API_KEY);

  if (!props.brevo_contact_id) {
    const getContact = await apiInstance.getContactInfo(props.email);
    const brevoContact = getContact.body as BrevoContact;
    if (!brevoContact?.id) {
      return;
    }
    props = await prisma.user.update({
      where: { id: props.id },
      data: { brevo_contact_id: brevoContact.id },
    });
  }

  let LANDLINE_NUMBER = '';
  let SMS = '';
  let WHATSAPP = '';
  let TELEPHONE_PORTABLE = '';
  let TELEPHONE_FIXE = '';
  if (props.telephone) {
    const phoneNumber = parsePhoneNumber(props.telephone, 'FR');
    if (phoneNumber?.isPossible()) {
      if (phoneNumber.number.startsWith('+336') || phoneNumber.number.startsWith('+337')) {
        SMS = phoneNumber.number;
        WHATSAPP = phoneNumber.number;
        TELEPHONE_PORTABLE = phoneNumber.number;
      } else {
        LANDLINE_NUMBER = phoneNumber.number;
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
    ROLE: props.roles.map(formatRoles),
    LANDLINE_NUMBER,
    SMS,
    WHATSAPP,
    TELEPHONE_PORTABLE,
    TELEPHONE_FIXE,
    ADRESSE: ADRESSE ? ADRESSE : '',
    NUM_EXAMINATEUR: props.numero_cfei,
    EXT_ID: props.id,
  };

  const result = await apiInstance.updateContact(props.brevo_contact_id.toString(), updateContact);

  // result.body is undefined so we don't update
  // await prisma.user.update({
  //   where: { id: props.id },
  //   data: { brevo_contact_id: result.body.id },
  // });
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

export async function updateOrCreateBrevoCompany(props: Entity) {
  // if (process.env.NODE_ENV === 'development') {
  //   console.log('Updating Brevo company in development mode');
  //   console.log(props);
  //   return;
  // }
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
    await prisma.entity.update({
      where: { id: props.id },
      data: { brevo_id: result.body.id },
    });
    return;
  }

  console.log('Updating Brevo company');
  const updateCompany = await apiInstance.companiesIdPatch(props.brevo_id, {
    attributes: brevoCompany.attributes,
  });
  return;
}

/* 
async function importFromBrevo() {
  // if (process.env.NODE_ENV === 'development') {
  //   console.log('Creating Brevo entity in development mode');
  //   return;
  // }
  // const apiInstance = new brevo.CompaniesApi();
  // apiInstance.setApiKey(brevo.CompaniesApiApiKeys.apiKey, API_KEY);

  // const companies = await apiInstance.companiesGet();
  // console.log(JSON.stringify(companies.body.items, null, 2));

  const apiInstance = new brevo.CompaniesApi();
  apiInstance.setApiKey(brevo.CompaniesApiApiKeys.apiKey, API_KEY);

  const companies = await apiInstance.companiesGet(undefined, undefined, undefined, 1, 100);
  const companiesArray = companies.body.items as Array<BrevoCompany>;

  const zachPremierDetenteurs = await prisma.entity.findMany({
    where: {
      type: EntityTypes.PREMIER_DETENTEUR,
    },
  });
  // for (const etg of zachSvis) {
  //   const name = etg.raison_sociale;
  //   const company = companiesArray.find((company) => company.attributes.name === name);
  //   if (company) {
  //     console.log('FOUND');
  //     console.log(company.id);
  //   } else {
  //     console.log('NOT FOUND');
  //     console.log(name);
  //   }
  // }

  for (const det of companiesArray) {
    const brevoCompany = companiesArray.find(
      (company) =>
        company.attributes.cat_gorie.includes('collecteur') &&
        company.attributes.name === det.attributes.name,
    );
    const zachCompany = zachPremierDetenteurs.find((etg) => etg.raison_sociale === det.attributes.name);
    if (brevoCompany && zachCompany) {
      // console.log('FOUND in BRVO and ZACH');
      // await prisma.entity.update({
      //   where: { id: zachCompany.id },
      //   data: {
      //     brevo_id: brevoCompany.id,
      //   },
      // });
    } else if (zachCompany) {
      // console.log('FOUND in ZACH but not in BRVO');
      // console.log(zachCompany);
    } else if (brevoCompany) {
      console.log('FOUND in BRVO but not in ZACH');
      console.log(brevoCompany);
      await prisma.entity.create({
        data: {
          type: EntityTypes.COLLECTEUR_PRO,
          brevo_id: brevoCompany.id,
          raison_sociale: brevoCompany.attributes.name,
          nom_d_usage: brevoCompany.attributes.name,
        },
      });
    }
  }
} 
  */

// importFromBrevo();
