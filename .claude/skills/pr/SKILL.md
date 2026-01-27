---
name: pr
description: Creates a branch, commits changes, pushes, and opens a PR. Use when the user wants to submit their changes as a pull request.
---

When the user invokes this skill, follow these steps:

## 1. Analyze the changes

Run `git status` and `git diff` to understand what has changed. Based on the changes, determine:

- The type of change: `fix`, `feat`, `chore`, `refactor`, `docs`, `test`, `style`
- A short descriptive name (2-4 words, kebab-case)

## 2. Create branch name

Format: `{type}--{short-description}`

Examples:

- `fix--login-validation`
- `feat--export-csv`
- `chore--update-dependencies`
- `refactor--user-service`

## 3. Execute the workflow

1. **Create and switch to the new branch**:

   ```bash
   git checkout -b {branch-name}
   ```

2. **Stage the changes** (be specific, avoid staging sensitive files):

   ```bash
   git add {specific-files}
   ```

3. **Commit with a conventional commit message**:
   Format: `{type}: {short description}`

   ```bash
   git commit -m "{type}: {description}"
   ```

4. **Push to remote**:

   ```bash
   git push -u origin {branch-name}
   ```

5. **Create the PR**:

   ```bash
   gh pr create --title "{type}: {description}" --body "$(cat <<'EOF'
   ## Summary
   {bullet points describing the changes}

   ## Test plan
   {how to verify the changes work}

   🤖 Generated with [Claude Code](https://claude.com/claude-code)
   EOF
   )"
   ```

## 4. Return the PR URL

After creating the PR, display the URL so the user can review it.

## Notes

- If already on a feature branch, ask the user if they want to use it or create a new one
- If there are no changes to commit, inform the user
- Always check `git status` before starting to understand the current state
