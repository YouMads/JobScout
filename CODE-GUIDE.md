# JobScout source code guide

Version 0.14.0. Plain browser HTML/CSS/JavaScript and a local Node.js server, with one pinned dependency (unpdf). No build step or API key.

## Setup and configuration

Use Node.js 22+. Run npm ci --ignore-scripts, then npm start. On Windows, Start-JobScout.cmd prepares dependencies and invokes the portable launcher with browser opening and optional local Ollama startup.

config.mjs parses .env from the project root. Environment variables override it. Defaults are dashboard port 4317, local Ollama at 127.0.0.1:11434, qwen3:4b and data/ for the public feed cache. Legacy PORT still works. Both launcher and server use the same parser. The server always binds to 127.0.0.1; non-local Ollama URLs, embedded credentials and cloud model suffixes are rejected.

npm run doctor checks prerequisites and local model readiness. Offline AI is an optional-capability warning; searching and tracking remain available. The launcher opens a browser only after a ready message from its child server. npm start alone does not open a browser or start Ollama automatically.

## File map

| File | Purpose |
| --- | --- |
| freshness.mjs | Normalized profile status records, feed/expiry dates and status labels |
| vacancy-check.mjs | Bounded source checks, evidence classification and short-lived cache |
| countries.mjs | Country names, common city/offset presets, regional checks and legacy preference migration |
| feed-cache.mjs | Country-specific feed keys and bounded cache merging |
| local-ai.mjs | Downloaded model checks and rejection of cloud aliases / unsupported models |
| public/setup.js | Profile setup wizard and model connection test |
| config.mjs | Validated local settings and model-name matching |
| server.mjs | Local HTTP API, caches, CV extraction and Ollama requests |
| public/index.html, public/style.css | Structure and responsive black/gray interface |
| public/app.js | Profiles, discovery, details, plans, AI, comparisons and watchlists |
| public/view-model.mjs | Pure filtering, sorting, pagination, counts and memoized checks |
| sources.mjs | Public feeds and Lever/Greenhouse/Ashby adapters |
| scanner.mjs | Public-address/DNS checks, robots-aware reads, ATS discovery and grounded AI |
| scan-cache.mjs, scan-control.mjs | Bounded sessions, result reuse and cancellation |
| watchlist.mjs | Bounded summaries, comparisons, history and sequential queues |
| duplicates.mjs | Conservative identity and source-link merging |
| description.mjs | Safe markup conversion and text-block rendering |
| lib.mjs, matching.mjs | Role/skill filters, experience evidence and location checks |
| workspace.mjs | Tracking, manual jobs, plans, follow-ups and CSV export |
| candidate.mjs, cv.mjs, cv-worker.mjs | CV keywords and isolated PDF/text extraction |
| backup.mjs | Backup validation and normalization |
| scripts/launch.mjs, scripts/runtime.mjs | Portable startup and readiness helpers |
| scripts/doctor.mjs | Local diagnosis |
| scripts/source-files.mjs, scripts/check-source.mjs | Distributable manifest and sharing checks |
| tests/ | Synthetic unit and local-server integration checks |
| .github/workflows/test.yml | Future Windows/Linux, Node 22/24 checks |

## API

- GET /api/health identifies JobScout and its version/model without contacting Ollama.
- GET /api/status checks Ollama, returns the default model and downloaded GGUF model choices.
- POST /api/ai/test validates a selected model and requests a tiny structured response, using the shared AI lock.
- GET /api/sources?country=GR lists providers and recommended sources without fetching feeds.
- POST /api/jobs/check accepts a listing URL and title, reads its public source and returns listed/closed/unavailable/unknown evidence. Never accepts an AI conclusion as closure evidence.
- POST /api/search accepts preferences and enabled sources, returning matching public jobs.
- POST /api/cv/extract accepts bounded local PDF/text bytes and returns text.
- POST /api/scan/collect reads a requested public link or pasted text. Feed-only scans finish without AI.
- POST /api/scan/analyze extracts grounded roles from a transient session using local Ollama.
- POST /api/analyze reviews a listing against profile and optional CV evidence.

Only fixed, explicitly listed UI modules are served. Settings, cache files, Git metadata, docs and configuration source are not static routes. The browser calls the local server, which handles provider/Ollama requests. Backups are parsed in the browser.

## Invariants

- A feed retrieval timestamp is not a live source check. Preserve per-job fetchedAt across failed refreshes; retain expiresAt and exclude expired Discover results.
- Direct listing checks have a separate single-request lock, 30-second cancellation, 2 MB response bound, DNS/redirect guards and robots checks for HTML. Only documented read-only provider paths bypass HTML robots checks. Ten-minute results remain bounded to 200 in-memory entries and retain their original timestamp.
- Matching URL/title/ID evidence is required for positive status. Missing pages and blocked access do not confirm closure. Checks update only the owning profile’s bounded availability map; saved stages and notes are unchanged.
- Match explanations use the applied Discover preferences or current preferences for saved applications. Cache invalidation includes role, level, years, skills, country and CV text.

- Country and optional model are per-profile preferences. Existing profiles migrate to CY and stable local/local_remote/remote area values. New profiles need setup; imported backups remain usable. Changing country preserves saved data.
- Himalayas cache keys include country. Existing unkeyed Himalayas cache belongs to CY. Keep up to 12 variants and evict their jobs together; never reuse another country’s freshness or failed-feed fallback.
- AI resolves the model for each operation, verifies downloaded GGUF and completion capability with local Ollama, and rejects remote-host metadata. The server default and .env are never rewritten by the dashboard.

- Preserve jobscout-v1 and jobscout-ui browser keys. Appearance is separate from profiles. Backup v1 stays backward compatible.
- Unknown requirements, arrangements, salaries and eligibility remain unknown. Preferred experience is separate from required years. Keyword overlap is not an AI suitability score.
- Preserve attribution links when combining supported duplicates. Different locations, arrangements, seniority and same-source requisitions remain separate unless identity evidence agrees.
- Never execute page scripts. Validate redirects and DNS destinations. HTML follows robots rules and pacing; documented read-only ATS feeds use their public paths.
- Collection is bounded to 6 pages/feeds, 60 roles, 2 MB per response and 60 seconds. AI has a four-minute limit and one shared lock. Disconnects cancel requests; an OS DNS lookup may settle up to its existing timeout before cleanup.
- At most four scans remain in memory for 20 minutes. Matching inputs may reuse five-minute-old results with the original time. Read fresh pages bypasses reuse.
- Watchlists retain summaries rather than page text or CV data. Only complete comparable scans infer new/not-seen changes. Partial, cancelled and failed attempts keep the prior snapshot. Not seen never confirms closure.
- Render normalized text blocks instead of provider HTML. Do not automate applications, sign-ins or protection bypasses.

## Checks and packaging

npm test runs unit/integration checks with synthetic data and local HTTP mocks, independent of providers and GPUs. The GitHub Actions workflow is prepared locally and has not run on GitHub until upload and a trigger.

npm run check:share checks the manifest and Git-visible paths for unexpected files and selected credential/machine-path patterns. Add intentional new source entries to scripts/source-files.mjs and review the diff yourself.

Package-Source.ps1 uses that same manifest for a versioned ZIP next to the project. Archives exclude .git, node_modules, runtime data, local .env files, logs, browser state, exports and models. Fresh copies create their own ordinary data folder; machine-specific junctions are excluded.

The license remains undecided. See CONTRIBUTING.md, docs/PRIVACY.md and docs/GIT-SETUP.md before preparing a public release.
