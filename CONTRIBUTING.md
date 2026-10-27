# Contributing to JobScout

JobScout is licensed under AGPL-3.0-only. By submitting contributions, you agree to license your contributions under the same terms. Only contribute code you have the right to share.

## Run and check

Use Node.js 22+. Run npm ci --ignore-scripts, then npm start. Ollama is optional for development; tests use local mocks rather than the installed model.

Run npm test and npm run check:share before proposing a change. Test observable behavior and real boundaries with synthetic CVs and job descriptions. Keep tests independent of live providers, paid services and GPU hardware.

## Code layout

The UI is plain HTML/CSS/browser JavaScript. The server uses Node built-ins; unpdf is the pinned PDF dependency. Pure modules are shared with tests. See CODE-GUIDE.md for the map.

For a new source, preserve its original link and attribution, set a cache interval, and respect access rules. Leave fields unknown when evidence is absent. Provider HTML must remain outside the DOM; descriptions use normalized text blocks.

Preserve loopback binding, host/origin validation, bounded requests, public-address and redirect checks, and scanner cancellation. Source documents are untrusted data, including AI input. Browser profiles are not authentication.

## Source files and privacy

Add intentional distributable paths to scripts/source-files.mjs. Packaging and sharing checks use this list. Do not commit .env, caches, models, dependencies, real CVs, backups, application CSVs or logs. The .env.example file contains defaults only.

Describe what changed, why, and how it was checked. Use synthetic data in UI screenshots and bug reports. Remove personal information from terminal output before sharing it.
