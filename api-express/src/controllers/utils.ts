import express from 'express';
import passport from 'passport';
import { catchErrors } from '../middlewares/errors';
const router: express.Router = express.Router();
import { RequestWithUser } from '~/types/request';
import { createBrevoContactFromContactForm, sendEmail } from '~/third-parties/brevo';

router.get(
  '/now',
  passport.authenticate('user', { session: false, failWithError: true }),
  catchErrors(async (req: RequestWithUser, res: express.Response, next: express.NextFunction) => {
    const data = Date.now();
    res.status(200).send({ ok: true, data });
  }),
);

router.post(
  '/contact',
  catchErrors(async (req: express.Request, res: express.Response, next: express.NextFunction) => {
    const { nom_de_famille, prenom, telephone, email, message, object, job } = req.body;
    if (job) {
      // honey pot
      res.status(200).send({ ok: true });
      return;
    }
    await createBrevoContactFromContactForm({
      nom_de_famille,
      prenom,
      email,
      telephone,
      message,
    });
    await sendEmail({
      emails: ['contact@zacharie.beta.gouv.fr', email],
      subject: `Contact\u00A0: ${prenom} ${nom_de_famille} - ${email} - ${object}`,
      html: `<p>Nous avons bien reçu votre message. Nous vous répondrons dans les plus brefs délais.</p>
      <p>Voici les informations que vous avez fournies\u00A0:</p>
      <p>Nom\u00A0: ${nom_de_famille}</p>
      <p>Prénom\u00A0: ${prenom}</p>
      <p>Téléphone\u00A0: ${telephone}</p>
      <p>Email\u00A0: ${email}</p>
      <p>Objet\u00A0: ${object}</p>
      <p>Message\u00A0: ${message}</p>`,
    });
    res.status(200).send({ ok: true });
  }),
);

export default router;
