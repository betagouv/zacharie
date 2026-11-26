---
name: delete-comment
description: Audit and delete the code comments of a path (or the whole repo). Sorts each comment as tautology, stale, excuse or decision record, deletes it, files excuses in doc/adr/excuses-a-traiter.md and moves decisions into ADRs. Use when the user runs /delete-comment, asks to clean comments, or when `npm run lint:comments` reports a new comment.
---

# /delete-comment [path]

The codebase bans comments: rule `local/no-comments` in `eslint.comments.config.js` (`api-express/` and `app-local-first-react-router/`), run by `npm run lint:comments` in CI. `e2e/` and `expo/` follow the rule without a linter. This skill removes comments that slipped in, or replays the full audit on a path.

Scope: `.ts`, `.tsx`, `.js`, `.mjs`, `.cjs` files under the given path (default: the whole repo). Out of scope: `prisma/schema.prisma`, SQL migrations, SQL inside template strings, YAML, shell, Markdown.

## 1. Sort every comment

Read the file and the code around each comment. Put each comment in exactly one bucket:

| Bucket              | Definition                                                                                                                                                 | Action                                                      |
| ------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------- |
| **Tautology**       | Repeats what the code already says (names, types, obvious control flow, section banners).                                                                  | Delete.                                                     |
| **Stale**           | Refers to code, files, behavior or plans that no longer exist; commented-out code; old TODO/FIXME done.                                                    | Delete.                                                     |
| **Excuse**          | Justifies a hack, a workaround, a known bug, a TODO, a "temporary" shortcut, a `setTimeout` to dodge a race.                                               | Delete, and add an entry to `doc/adr/excuses-a-traiter.md`. |
| **Decision record** | Explains an important, non-obvious _why_ (business rule, regulatory constraint, sync ordering, security, perf trade-off, a constraint from a third party). | Delete, and move the content into an ADR in `doc/adr/`.     |

When in doubt between Tautology and Decision record, ask: "would a competent dev reading this code get it wrong without this sentence?" If no → Tautology.

Keep only tool directives: `eslint-disable*` (and its `-- reason`), `@ts-expect-error` / `@ts-ignore` / `@ts-nocheck`, `prettier-ignore`, `@vite-ignore`, `/// <reference>`, `#__PURE__`, coverage ignores, shebangs. The exact allowlist is `ALLOWED_DIRECTIVES` in `eslint.comments.config.js`.

## 2. Edit rules

- Change comments only. Never change code behavior, names or formatting beyond removing the comment line(s).
- Use the Edit tool, never a regex/sed over files: `//` also appears in URLs and strings.
- JSX comments: remove the whole `{/* ... */}` expression.
- A trailing comment (`foo(); // bar`): remove only the comment and the spaces before it.
- If removing a comment leaves an empty block (`catch {}`), that is fine.
- Don't leave a blank line where a comment was if it creates two blank lines in a row.

## 3. ADRs (decision records)

An ADR (Architecture Decision Record) is a short Markdown file that records one decision: the context, the decision, and its consequences. Format and index: `doc/adr/README.md`.

- First look for an existing ADR on the same subject in `doc/adr/` and add to it.
- Otherwise create `doc/adr/NNNN-<sujet-en-kebab-case>.md` with the next free number, and add it to the index in `doc/adr/README.md`.
- Write in French. Group by subject, not by file. Cite the code location by file path and symbol name (not line numbers, they drift).

## 4. Excuses

Append to `doc/adr/excuses-a-traiter.md`, one `##` section per excuse, in French:

```md
## <titre court du problème>

- Fichier : `path/to/file.ts` (`symbolName`)
- Contournement actuel : <ce que fait le code>
- Correction attendue : <ce qu'il faudrait faire>
```

The user turns this list into Notion cards. Do not create GitHub issues.

## 5. Verification

From each touched package (`api-express/`, `app-local-first-react-router/`):

```bash
npm run lint:comments   # must pass
npm run typecheck       # no output + exit 0 = success
```

Then run `npx prettier --write` on the touched files from inside their package. In `e2e/` and `expo/`, check with `grep -rnE '^\s*(//|/\*)'` that only directives remain.

If a large path cannot be cleaned in one go, freeze the rest with ESLint bulk suppressions (`npx eslint -c eslint.comments.config.js --suppress-rule local/no-comments .`, then `--prune-suppressions` after each cleanup) instead of disabling the rule.

Report: number of comments per bucket, lines removed (`git diff --shortstat`), ADRs created or updated, excuses added.
