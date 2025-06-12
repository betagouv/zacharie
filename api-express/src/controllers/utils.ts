import express from 'express';
import passport from 'passport';
import { catchErrors } from '../middlewares/errors';
const router: express.Router = express.Router();
import { RequestWithUser } from '~/types/request';
import { sendEmail } from '~/third-parties/brevo';

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
    sendEmail({
      emails: ['contact@zacharie.beta.gouv.fr'],
      subject: `Contact: ${prenom} ${nom_de_famille} - ${email} - ${object}`,
      html: `<p>Nom: ${nom_de_famille}</p>
      <p>Prénom: ${prenom}</p>
      <p>Téléphone: ${telephone}</p>
      <p>Email: ${email}</p>
      <p>Objet: ${object}</p>
      <p>Message: ${message}</p>`,
    });
    res.status(200).send({ ok: true });
  }),
);

export default router;
