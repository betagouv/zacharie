import express from 'express';
import passport from 'passport';
import { catchErrors } from '~/middlewares/errors';
const router: express.Router = express.Router();
import { RequestWithUser } from '~/types/request';
import { createBrevoContactFromContactForm, sendEmail } from '~/third-parties/brevo';
import { sanitize } from '~/utils/sanitize';
import { contactRateLimit } from '~/middlewares/contact-rate-limit';
import z from 'zod';

router.get(
  '/now',
  passport.authenticate('user', { session: false, failWithError: true }),
  catchErrors(async (req: RequestWithUser, res: express.Response, next: express.NextFunction) => {
    const data = Date.now();
    res.status(200).send({ ok: true, data });
  })
);

const contactBodySchema = z.object({
  nom_de_famille: z.string().trim().min(1).max(100),
  prenom: z.string().trim().min(1).max(100),
  email: z.string().trim().email().max(254),
  telephone: z.string().trim().max(30).optional(),
  object: z.string().trim().max(200).optional(),
  message: z.string().trim().min(1).max(5000),
});

router.post(
  '/contact',
  contactRateLimit,
  catchErrors(async (req: express.Request, res: express.Response, next: express.NextFunction) => {
    if (req.body?.job) {
      res.status(200).send({ ok: true });
      return;
    }
    const bodyResult = contactBodySchema.safeParse(req.body);
    if (!bodyResult.success) {
      res.status(400).send({ ok: false, data: null, error: 'Formulaire de contact invalide' });
      return;
    }
    const { nom_de_famille, prenom, telephone = '', email, message, object = '' } = bodyResult.data;
    await createBrevoContactFromContactForm({
      nom_de_famille,
      prenom,
      email,
      telephone,
      message,
    });
    await sendEmail({
      emails: ['contact@zacharie.beta.gouv.fr'],
      subject: `Contact\u00A0: ${sanitize(prenom)} ${sanitize(nom_de_famille)} - ${sanitize(email)} - ${sanitize(object)}`,
      html: `
      <p>Nom\u00A0: ${sanitize(nom_de_famille)}</p>
      <p>Prénom\u00A0: ${sanitize(prenom)}</p>
      <p>Téléphone\u00A0: ${sanitize(telephone)}</p>
      <p>Email\u00A0: ${sanitize(email)}</p>
      <p>Objet\u00A0: ${sanitize(object)}</p>
      <p>Message\u00A0: ${sanitize(message)}</p>`,
    });
    res.status(200).send({ ok: true });
  })
);

export default router;
