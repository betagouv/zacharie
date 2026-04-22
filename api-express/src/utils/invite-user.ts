import { User } from '@prisma/client';
import prisma from '~/prisma';
import crypto from 'crypto';
import { sendEmail } from '~/third-parties/brevo';

export async function inviteUser(newUser: User, me: User) {
  let url = 'https://zacharie.beta.gouv.fr/app/connexion';
  let password = await prisma.password.findUnique({
    where: {
      user_id: newUser.id,
    },
  });
  if (!password) {
    const token = crypto.randomUUID();
    password = await prisma.password.create({
      data: {
        user_id: newUser.id,
        password: '',
        reset_password_token: token,
        reset_password_last_email_sent_at: new Date(),
      },
    });
    url = `https://zacharie.beta.gouv.fr/app/connexion/invitation?invitation-token=${token}&email=${encodeURIComponent(newUser.email)}`;
  }

  const invitationEmail = [
    `Bonjour,`,
    `Votre compte Zacharie a été créé, vous pouvez désormais accéder à l'application en cliquant sur le lien suivant: ${url}.`,
    `N’hésitez pas à nous contacter si besoin,`,
    `L’équipe Zacharie`,
    `Ce message a été généré automatiquement par l’application Zacharie. Si c'est une erreur, veuillez ignorer ce message.`,
  ].join('\n\n');
  await sendEmail({
    emails: [newUser.email],
    subject: `${me.prenom} ${me.nom_de_famille} vous a invité à rejoindre Zacharie`,
    text: invitationEmail,
  });
}
