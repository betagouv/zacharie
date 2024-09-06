import { Router } from "express";
import { User, UserRoles } from "@prisma/client";
import { prisma } from "../../app/db/prisma.server";
import { getUserFromCookie } from "../../app/services/auth.server";

const router = Router();

async function updateOrCreateUser(req, res) {
  const user = await getUserFromCookie(req);
  if (!user) {
    return res.status(401).json({ ok: false, data: null, error: "Unauthorized" });
  }

  const isAdmin = user.roles.includes(UserRoles.ADMIN);
  const userId = req.params.user_id;

  if (!userId) {
    // only admins can create new users this way
    if (!isAdmin) {
      return res.status(401).json({ ok: false, data: null, error: "Unauthorized" });
    }
  }
  if (userId !== user.id && !isAdmin) {
    return res.status(401).json({ ok: false, data: null, error: "Unauthorized" });
  }

  const nextUser: Partial<User> = {};
  const fields = [
    "nom_de_famille",
    "prenom",
    "telephone",
    "email",
    "addresse_ligne_1",
    "addresse_ligne_2",
    "code_postal",
    "ville",
    "roles",
    "numero_cfei",
    "numero_frei",
  ];

  fields.forEach((field) => {
    if (field in req.body) {
      if (field === "roles") {
        nextUser[field] = req.body[field] as UserRoles[];
      } else {
        nextUser[field] = req.body[field] as string;
      }
    }
  });

  let savedUser: User | null = null;
  try {
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
  } catch (error) {
    console.error("Error updating/creating user:", error);
    res.status(500).json({ ok: false, data: null, error: "Internal Server Error" });
  }
}

router.post("/:user_id?", updateOrCreateUser);

export default router;
