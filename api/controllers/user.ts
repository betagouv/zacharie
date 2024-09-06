import type express from "express";
import { Router } from "express";
import passport from "passport";
import { User, UserRoles } from "@prisma/client";
import { prisma } from "~/db/prisma.server";
import type { RequestWithUser } from "../types/request";
import { catchErrors } from "../utils/errors";
import multer from "multer";

const router = Router();
const upload = multer();

router.get("/", (req, res) => {
  return res.status(200).json({ ok: true, data: null, error: null });
});

router.post(
  "/:user_id",
  passport.authenticate("jwt", { session: false }),
  upload.none(),
  catchErrors(async (req: RequestWithUser, res: express.Response) => {
    console.log("inside controller", req.user);
    const user = req.user;
    if (!user) {
      res.status(401).json({ ok: false, data: null, error: "Unauthorized" });
      return;
    }

    const isAdmin = user.roles.includes(UserRoles.ADMIN);
    const userId = req.params.user_id;

    if (!userId) {
      // only admins can create new users this way
      if (!isAdmin) {
        res.status(401).json({ ok: false, data: null, error: "Unauthorized" });
        return;
      }
    }
    if (userId !== user.id && !isAdmin) {
      res.status(401).json({ ok: false, data: null, error: "Unauthorized" });
      return;
    }

    const nextUser: Partial<User> = {};

    if ("nom_de_famille" in req.body) nextUser.nom_de_famille = req.body.nom_de_famille as string;
    if ("prenom" in req.body) nextUser.prenom = req.body.prenom as string;
    if ("telephone" in req.body) nextUser.telephone = req.body.telephone as string;
    if ("email" in req.body) nextUser.email = req.body.email as string;
    if ("addresse_ligne_1" in req.body) nextUser.addresse_ligne_1 = req.body.addresse_ligne_1 as string;
    if ("addresse_ligne_2" in req.body) nextUser.addresse_ligne_2 = req.body.addresse_ligne_2 as string;
    if ("code_postal" in req.body) nextUser.code_postal = req.body.code_postal as string;
    if ("ville" in req.body) nextUser.ville = req.body.ville as string;
    if ("roles" in req.body) nextUser.roles = req.body.roles as UserRoles[];
    if ("numero_cfei" in req.body) nextUser.numero_cfei = req.body.numero_cfei as string;
    if ("numero_frei" in req.body) nextUser.numero_frei = req.body.numero_frei as string;

    let savedUser: User | null = null;

    if (!userId) {
      savedUser = await prisma.user.create({
        data: nextUser,
      });
    } else {
      savedUser = await prisma.user.update({
        where: { id: userId },
        data: nextUser,
      });
    }

    res.json({ ok: true, data: savedUser, error: null });
    return;
  })
);

export default router;
