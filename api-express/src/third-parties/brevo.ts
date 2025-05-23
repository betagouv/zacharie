import * as brevo from '@getbrevo/brevo';
import { User, UserRoles } from '@prisma/client';
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

    if (getContact?.body?.id) {
      if (!props.brevo_contact_id) {
        props = await prisma.user.update({
          where: { id: props.id },
          data: { brevo_contact_id: getContact.body.id },
        });
      }
      // @ts-expect-error EXT_ID any
      if (getContact.body.attributes?.EXT_ID !== props.id) {
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
    if (!getContact?.body?.id) {
      return;
    }
    props = await prisma.user.update({
      where: { id: props.id },
      data: { brevo_contact_id: getContact.body.id },
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
