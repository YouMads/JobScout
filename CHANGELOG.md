# 0.16.1 - Public release preparation

- Added AGPL-3.0-only licensing and copyright attribution to YouMad (YouMads).
- Included LICENSE in source archives and validated license metadata in the sharing check.
- Corrected outdated feed-count and license documentation.
- Fixed search completion claiming current filters were applied when the user changed preferences while it was running.

# 0.16.0 - Feed reliability and download efficiency

- Fixed failed refreshes being treated as successful cache freshness. Preserve cached jobs and successful timestamps; retry failures after 15 minutes on the next search.
- Revalidate single-page feeds with ETag/Last-Modified when providers support them; unchanged responses reuse listings without a response body.
- Limit concurrent provider requests to three and each decompressed feed response to 12 MB.
- Pause periodic AI status checks while the dashboard tab is hidden.
- Added GitLab careers through its public Greenhouse feed. Not included in country recommendations; choose it under Job websites (All feeds includes it).
- Added regression tests for cache validation, failure recovery, response limits and concurrency.

# 0.15.0 - Saved searches

- Save up to 20 named filter/source combinations per profile; run, edit and delete them.
- Backups preserve saved searches; CV, background and model are not copied into a search.
- Added setup-wizard testing instructions and saved-search regression coverage.

# Changes

## 0.14.0 — 26 October 2026

- Added automatic match explanations and tightened role, seniority and explicit country restrictions. Alternative experience requirements remain flagged for review instead of taking the highest alternative.
- Added per-job feed retrieval and expiry timestamps, direct source-status checks, freshness labels and availability filters. Checks preserve application stages, notes and profile ownership.
- Added bounded, robots-aware checks using public Himalayas, Lever and Greenhouse APIs where links support them, with conservative HTML evidence and separate listed/closed/unavailable/unknown outcomes.
- Added 23 matching and freshness checks; all 153 automated tests pass. Isolated DOM flow checks passed, and live provider checks were exercised. Visual browser testing remains unavailable because the browser-control runtime could not start.


## 0.13.0 — 26 October 2026

- Added three-step onboarding and Settings for country, role, skills, experience, background, source presets and a per-profile local AI model.
- Added country-aware filtering, city suggestions, regional eligibility, AI review context and separately cached Himalayas country searches. Existing profiles and backups retain Cyprus defaults and saved data.
- Added downloaded-model discovery and a sample response test. Reviews validate local model metadata and text-generation capability; no downloads, accounts or cloud calls are automated.
- All 130 automated tests pass, alongside isolated DOM flow checks and a real local qwen3:4b connection test. Live Greece feed search verified. Browser visual QA was unavailable because the browser-control runtime could not start.


## 0.12.0 — 25 October 2026

- Prepared local source for Git sharing, with explicit allowlisting, private/runtime-data exclusions, contributor documentation and a future Windows/Linux test workflow. No hosted repository or license was created.
- Added validated optional port, local model, loopback Ollama service, cache-directory and launcher settings. Removed machine-specific paths and fixed model names from the UI.
- Added portable startup, readiness-based browser opening, diagnostics and nine local-mock configuration/server integration checks. All 116 tests pass, including a clean copy installed into a folder with spaces.


## 0.11.0 — 23 October 2026

- Skipped unnecessary AI extraction when a scan contains only published feed records, with clear UI labels.
- Added profile-specific company watchlists, sequential scan-all, individual retry, cancel controls, and persistent bounded scan history.
- Added baseline comparisons for new and not-seen roles, with coverage/partial/cancellation safeguards and backup compatibility.
- Separated preferred versus required experience using section and clause evidence; preserved unknown suitability and mandatory junior conflicts.
- Strengthened conservative cross-site deduplication, normalized aliases/tracking parameters, retained attribution links, and preserved distinct requisitions.
- Added 26 checks for snapshots, limits, cache reuse, backups, cancellation, duplicate evidence and experience clauses. All 107 checks pass.


## 0.10.0 — 23 October 2026

- Replaced green and violet styling with black/gray palettes and a dark default. Increased title, body, label and control sizes, simplified surfaces and made active states clearer.
- Added a Jobs jump link, labelled layout controls and completed-scan result navigation. Removed repeated empty keyword-score rows.
- Cached repeated description/location/experience/CV checks with CV-aware invalidation; debounced text filters and stopped background status updates from rebuilding result cards.
- Added bounded five-minute scan/result reuse with original timestamps and an explicit Read fresh pages action. Published boards now end redundant HTML exploration while retaining other discovered boards.
- Added seven meaningful checks for cache boundaries, invalidation and crawl efficiency. All 81 checks pass.


## 0.9.0 — 23 October 2026

- Added Scan a website: public-page discovery from a company/careers link, supported public job-board feeds, and local AI role extraction with source quotations.
- Added visible reading/AI/save steps, pages-read/skipped coverage, role filtering, source links, save controls and a pasted-text fallback. Saved discoveries use the existing application, review and backup flows.
- Kept scan results transient and profile-scoped; the scanner does not use CV data or submit applications. Structured listings remain visible when the local AI step fails.
- Added bounded fetching, DNS-pinned public-address checks, redirect validation, robots-aware HTML crawling and read-only public API allowlisting. Page scripts are never executed.
- Added 22 checks covering access boundaries, discovery, embeds, parsing, evidence grounding, deduplication, locations and backup compatibility. All 74 checks pass.


## 0.8.0 — 23 October 2026

- Added a temporary three-job comparison shortlist with listing details, technical keyword checks and existing AI reviews.
- Added an application stage board with accessible stage selectors, using the same records as saved cards.
- Added locally saved priority, next-action and follow-up date fields, due summaries, filtering, sorting and a Discover attention link. Closed applications are excluded from active due counts.
- Focused the application page on planning, with direct manual-job import and CSV export of the active profile’s entire saved pipeline.
- Preserved planning metadata through manual edits and JSON backups; older saved entries and backups remain supported.
- Added six checks for calendar validity, planning defaults, follow-up classification, filtering/sorting, safe CSV fields and backup compatibility. All 52 checks pass.


## 0.7.0 — 23 October 2026

- Functional dashboard header with local AI readiness and in-progress review state visible on small screens.
- Explained website, CV and manual-import controls instead of bare tool buttons.
- Automatic text checks and keyword overlap clearly labelled separately from AI suggestions.
- Job listing, AI review and personal notes separated into labelled sections.
- Dedicated AI workbench showing the information used, output expectations, progress, and saved review.
- Workspace guide explaining finding, reviewing and tracking, plus a reference for every tool.
- Read listing / AI review actions on job cards and visible Save labels.
- Larger, clearer card titles and sticky close controls in long dialogs.
- Existing data keys, source adapters, local-only AI endpoint and dependency versions preserved.


## 0.6.0 — 22 October 2026

- Per-profile first-discovered, seen/unseen, and hidden/restored history using stable job identities.
- New/Unseen/Seen/Hidden filters, card badges, and page-level mark-seen action.
- Explicit junior/graduate and early-career evidence filters; unknown and conflicting requirements are visible.
- Per-profile source selection, with disabled feeds excluded from search requests.
- Manual imports from pasted links/text, original-site attribution, editing, stages, notes, and local AI reviews.
- Local PDF/TXT/Markdown CV extraction and editable text preview; keyword overlap on cards and in sorting.
- Optional CV evidence included in requested Ollama reviews; no paid or cloud API.
- Backups retain CV text, source choices, history and manual jobs; old backups still import.
- Windows first-run dependency setup; pinned unpdf version and lockfile.
- 46 automated checks and browser verification with synthetic CV/job data.


## 0.5.0 — 22 October 2026

- Added Remote OK, Wheely, Wrike, Fayara, Welltech, Talos, and Scorewarrior: 13 connected sources.
- Reusable employer adapters for Lever, Greenhouse, and Ashby, preserving attribution and location restrictions.
- Formatted About sections with headings, paragraphs, ordered and bullet lists, source labels and original-listing links.
- Cleaner card excerpts and expandable experience/location checks.
- Safe description rendering discards external scripts, attributes and embedded content.
- Structured descriptions survive saved jobs and validated backup imports; older saved jobs remain readable.
- Versioned source caches refresh the description format once and then follow normal cache intervals.
- 34 automated checks; live validation of all 13 feeds.

## 0.4.0 — 21 October 2026

- Redesigned responsive dashboard with a forest-green sidebar and focused result cards.
- Compact mobile filters and collapsible advanced preferences.
- Light/dark themes and list/grid layouts saved per browser.
- Instant filtering within fetched results, salary-only filtering, and company sorting.
- Pagination showing 12 opportunities per page.
- Application-stage overview and stage-specific pipeline filtering.
- Dedicated backup and profile dialogs.
- Automatic initial search and clearer loading, empty, failure, and unsaved-filter states.
- Readable frontend source and a code guide; preserves existing profiles and backup format.
- Source package excludes cached listings, user backups, and model weights.

## 0.3.0

- Description-based experience signals, clearer eligibility checks, and profile backups.

## 0.2.0

- Six job sources, website badges, website filtering, and duplicate source links.
