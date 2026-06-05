# CLAUDE.md — Backend (api-express)

Scoped rules for the Express/Prisma API. Loaded in addition to the root `CLAUDE.md`.

## Emails — keep the inventory in sync

All outgoing email goes through Brevo (`src/third-parties/brevo.ts` → `sendEmail()`), with the wrappers `sendNotificationToUser` / `queueSendNotificationToUser` (`src/service/notifications.ts`), `sendOnboardingEmailOnce` (`src/utils/send-onboarding-email.ts`), and `inviteUser` (`src/utils/invite-user.ts`).

**`doc/emails.md` is the team-facing inventory of every email Zacharie sends** (transactional, automatic, cron, internal notices) and what is wired up vs. dead. Whenever you add, remove, rewire, or change the subject/trigger/recipient of an email — or move a Trichine/commented notification from dead to live — **update `doc/emails.md` in the same change.** Don't let it drift.
