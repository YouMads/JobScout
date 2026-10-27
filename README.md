# JobScout Local

A local job-search dashboard with country-aware setup and remote work, with public job feeds, company watchlists and optional Ollama AI reviews. Run your own copy on Windows, macOS or Linux. No paid API key, account or build step is required.

## Features

- Set up each profile in three steps: country, job preferences and optional local AI. Reopen Settings at any time.

- Read “Why this result?” explanations for role, country, experience and skill mentions.
- Check a listing’s status without AI, distinguish closures from unavailable or unverified links, and filter source-reported closures while keeping saved applications.
- Search 14 public job feeds and employer boards, with role, location, skill, experience, website and salary filters.
- Save up to 12 company careers links per browser profile. Scan sequentially, cancel requests and retry unfinished websites; retain the last 8 attempts per site.
- Compare complete scans of the same pages for new roles and roles not seen again. Not seen does not confirm a closure.
- Use a downloaded local Ollama model to identify roles in page text or review a job against your profile and optional CV.
- Extract text from PDF, TXT or Markdown CVs locally, and compare technical keyword mentions.
- Track application stages, notes, priorities, next actions and follow-up dates. Compare three roles, export CSV and back up profiles.
- Read a black/gray interface with dark and light themes.

Each person runs their own local server and keeps their own browser data. Browser profiles are convenience profiles; anyone using that browser can switch between them. Git hosting shares the code; it does not provide a running JobScout service or authenticated accounts.

## Quick start

Install [Node.js 22 or newer](https://nodejs.org/en/download). Clone this repository or extract a source archive into a folder.

### Windows

Double-click **Start-JobScout.cmd**. It installs the pinned PDF dependency on first start, starts the dashboard, and opens the browser after the server is ready. It also tries to start an installed local Ollama instance. Keep the terminal window open; press Ctrl+C to stop JobScout.

### Any platform

Open a terminal in the project folder:

~~~sh
npm ci --ignore-scripts
npm start
~~~

Open [JobScout](http://127.0.0.1:4317/). Press Ctrl+C in the terminal to stop it. Use the same address and browser for existing profiles: localhost and 127.0.0.1 have separate browser storage.

### Country setup

New profiles start with a country picker, followed by role, experience and skills. The country changes location labels, city suggestions, regional remote leads, timezone checks where mapped, and the Himalayas country query. Existing profiles keep Cyprus and their source selections.

Cyprus recommends 13 feeds; GitLab careers is an additional optional source. Other countries start with four international remote feeds; local employer coverage is limited. Add employer careers links to Company watchlist, or customise Job websites. Selecting a country does not add every national job board, guarantee local jobs, or establish work permission. Country names are supported across the ISO country/territory list; city and timezone presets cover common locations, with unknown mappings left unexcluded.

Settings lets you keep your current source choices or explicitly apply recommended feeds. Your saved jobs, CV, notes and watchlists stay in the profile.

### Optional local AI

Install and open [Ollama](https://ollama.com/download), then download the default model once:

~~~sh
ollama pull qwen3:4b
~~~

In **Settings → Local AI**, refresh the downloaded model list, choose a model and use **Test local AI**. This sends a tiny sample prompt without your profile or CV. Model choice is saved per browser profile and takes precedence over the server default. No restart is needed. Cloud aliases and embedding-only models cannot run reviews.

Job feeds, tracking, CV keyword checks and published job-feed scans work with Ollama offline. AI reviews and extraction from unstructured page text need a running local model. The first request can take longer while the model loads. Ollama and model weights are separate installations, excluded from this repository.

Check setup with:

~~~sh
npm run doctor
~~~

## Local settings

Defaults work without a configuration file. Copy [.env.example](.env.example) to **.env** only if you need changes. JobScout reads it from the project folder; existing environment variables take precedence. Restart after changes.

| Setting | Default | Purpose |
| --- | --- | --- |
| JOBSCOUT_PORT | 4317 | Dashboard port; changing it also changes the browser storage origin |
| JOBSCOUT_MODEL | qwen3:4b | Downloaded local Ollama model, supporting the app's structured JSON requests |
| JOBSCOUT_OLLAMA_URL | http://127.0.0.1:11434 | Local Ollama address; loopback only |
| JOBSCOUT_DATA_DIR | data | Public feed cache; relative paths resolve from the project folder |
| JOBSCOUT_OLLAMA_BIN | unset | Optional executable path for the Windows launcher if Ollama is not on PATH |

The legacy PORT environment variable still works. The server always binds to 127.0.0.1. Non-local Ollama endpoints and cloud-suffixed model names are rejected. Use a downloaded local model in an Ollama instance you run yourself.

## Using the dashboard

**Discover:** Choose preferences and Find opportunities. New/Unseen/Seen/Hidden describe this profile's reading history; the first search sets its baseline. Missing salary, arrangement or requirements remain unknown.

**Automatic matching:** Skills use keyword overlap, separate from AI assessment. Junior searches normally exclude senior titles and required experience above two years; change your years or keep and flag higher requirements. Preferred experience appears separately. Unknown suitability stays labelled. Alternative year requirements are flagged for review. Explicit country requirements take precedence over broad remote labels; All locations lets you inspect conflicting leads yourself. Architect and founding-engineer titles are excluded from junior searches. A regional listing does not establish eligibility in your selected country.

**Listing freshness:** Cards show when a job was retrieved from its feed, separately from any direct source check. Open a job and select **Check listing status**. Supported public job APIs or readable pages can confirm that a listing is present, report a closure, or leave availability unknown. A missing link, blocked page or failed request does not prove closure. Checks are limited to one at a time, 30 seconds and a bounded response; results may be reused for 10 minutes. Each profile keeps up to 500 latest checks, including in backups. Older checks are labelled; recheck before applying.

The Availability filter can hide source-reported closures or show jobs needing a recent check. Your saved notes and application stages are never changed by a check. For combined listings, checks cover the primary source link; other source links may differ. Source expiry dates remove expired feed results from Discover, while saved copies stay available.

**Website scanner:** Read up to 6 pages/feeds and retain up to 60 roles from a public company/careers link, using Lever, Greenhouse or Ashby feeds when detected. Published feed records do not need AI extraction. Other text can be checked by local AI with source quotations and links. Protected, sign-in, JavaScript-only or robots-excluded pages may need pasted text. Pasted-text mode makes no website requests. Empty results mean no roles were verified in that evidence, not that the company has no vacancies.

**Company watchlist:** Add links and choose Scan all websites. Only complete, comparable scans establish change comparisons. Limited, failed, cancelled or pasted-text scans keep the previous full snapshot. Changed page coverage starts a fresh baseline. Cached reports keep their original checked time; Read fresh pages checks again. Scanning is not scheduled while the app is closed.

**CV and reviews:** PDF extraction is limited to 6 MB / 20 pages; scanned PDFs need pasted text or separate OCR. Review extracted text before saving it. Keywords measure mentions, not proficiency. AI reviews receive saved profile/CV evidence only when requested. Confirm requirements on the source listing.

**Applications:** Save jobs, update stages and notes, and set follow-ups. Dates are checked while the dashboard is open. Open the original listing to apply yourself. CSV exports contain the active profile's pipeline. Backups retain all profiles and import as new copies.

## Sources and attribution

[sources.mjs](sources.mjs) configures Remotive, Jobicy, Himalayas, Remote OK, XM, Workato, Quadcode, Wheely, Wrike, Fayara, Welltech, Talos and Scorewarrior. Listings retain original links and attribution, including combined duplicates. Provider access and availability can change; check Source status for failures.

Feeds are cached for six hours, with Himalayas refreshed daily. Himalayas covers the first three software-search pages for your selected country, cached separately for up to 12 country variants; Jobicy supplies up to 200 recent engineering jobs. This is partial source coverage, not the entire web or every employer in your country. JobScout does not bypass website protections or automate applications. Verify availability, location restrictions and requirements on the original page.

## Data and privacy

Profiles, CV text, saved applications, notes, reviews, reading history and watchlist summaries live in browser localStorage. Clearing site data removes them; export a backup first. Public feed data is cached locally. CV files are read but not retained by the server; raw scan text stays in bounded process memory and expires.

Job requests go from the local server to chosen public sources. AI requests go to the configured loopback Ollama service. No API key or automatic cloud fallback is configured. Keep personal backups and exports outside the repository. See [data and privacy](docs/PRIVACY.md).

## Development and sharing

~~~sh
npm test
npm run check:share
~~~

Tests use synthetic fixtures and local mock services; no GPU, Ollama or live job feed is required. A GitHub Actions workflow is prepared for Windows/Linux and Node 22/24. It runs after future pushes or pull requests and does not deploy the app.

Read the [code guide](CODE-GUIDE.md), [contribution guide](CONTRIBUTING.md), [local Git guide](docs/GIT-SETUP.md) and [changelog](CHANGELOG.md). The sharing check audits the explicit source list and Git-visible files for unexpected data and selected credential patterns. Runtime caches, local settings, exports, models and dependencies are excluded; review your diff too.

To build a source ZIP on Windows:

~~~powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\Package-Source.ps1
~~~

## License

Copyright (c) 2026 YouMad (YouMads).

JobScout is licensed under the [GNU Affero General Public License v3.0](LICENSE) (SPDX: AGPL-3.0-only). You may use, modify and redistribute it, including commercially, subject to the license. Preserve copyright and license notices. Distributing covered modifications requires corresponding source under the same license; users of modified versions offered over a network must be offered their corresponding source. See LICENSE for the complete terms and warranty disclaimer.

Dependencies, Ollama models and third-party job content retain their own licenses and terms. This license does not grant rights to private profile data or third-party content. The package stays private to prevent accidental npm publication.


## Saved searches and testing setup

Use **Save this search** to name the current filters and Job websites choices. **Saved searches** offers Run, Edit and Delete. Edit loads the filters into the dashboard; change them and click **Save edited search**. Up to 20 searches belong to each profile and are included in backups. Running a search preserves your CV, background and AI model. Temporary result sorting and result-only filters are not part of a saved search.

To test first-time setup without changing existing data:
1. Click the + beside the profile selector and create `Setup test`.
2. Choose a country, area and city. Check the feed-coverage preview.
3. Choose role, experience and skills; continue to the optional Local AI step.
4. Complete setup without AI, or refresh installed models and test one.
5. Reload and verify the profile choices persist; switch back to your main profile and check it is unchanged.

Settings or Change setup reopens the wizard for the current profile. Reopening an existing profile keeps current website choices unless Use recommended feeds is checked. Closing before completion should not commit wizard edits. For a truly clean first-run check, use a separate browser profile/private window at the same app address; do not clear your main browser storage.


## Feed download efficiency (0.16)

The catalog now includes GitLab careers (14 feeds total). Enable it under Job websites; it is excluded from country recommendations, but included if you select all feeds. Country restrictions still apply.

Successful caches retain the existing six-hour refresh interval (24 hours for Himalayas). Failed refreshes retain prior listings and retry after 15 minutes when a search is requested. Single-page feeds send ETag or Last-Modified validators when available; providers returning 304 avoid retransmitting their JSON. Savings depend on provider support and whether the feed changed. Requests run at most three at once, with a 12 MB decompressed response limit. No background job-feed polling was added.

GitLab was verified against its live public endpoint during implementation. Greenhouse documents public read access at https://docs.greenhouse.io/job-board.html . This does not guarantee every listed role accepts applicants from your country.
