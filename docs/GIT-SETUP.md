# Sharing changes with Git

The upstream repository is https://github.com/YouMads/JobScout . The code is licensed under AGPL-3.0-only; see LICENSE.

Use the project folder containing package.json and server.mjs. Keep runtime data and personal exports outside Git history. .gitignore excludes data/, node_modules/, .env files, backups/exports, logs and models. Only .env.example is shareable configuration.

## Review before pushing

```sh
npm test
npm run check:share
git status --short
git diff --cached --stat
```

Review and commit only the intended source files. Preserve LICENSE and copyright notices when distributing copies. Fork the repository to publish your own changes, then open a pull request if you want to contribute them upstream.

Sharing the code lets another person install a separate local copy. It does not upload browser profiles or create a hosted multi-user service.
