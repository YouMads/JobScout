# Local data and network behavior

Each person runs a separate local JobScout instance. Browser profiles are convenience workspaces, not authenticated accounts.

| Information | Location | Retention |
| --- | --- | --- |
| Preferences, jobs, notes, CV text and AI reviews | Browser localStorage on this dashboard origin | Until edited, removed or site data is cleared |
| Public job-feed cache | Local server data directory | Source cache interval |
| Uploaded CV bytes | Local server and bounded PDF worker | Not retained as files; extracted text returns to the browser |
| AI review inputs | Configured local Ollama endpoint | JobScout retains the resulting review in the browser when complete |
| Requested website pages | Local server, then the chosen public pages | Raw evidence stays in at most four sessions for up to 20 minutes |
| Pasted careers text | Local server and local AI on request | No website fetches; transient scan memory |
| Watchlist summaries | Active browser profile | Up to 12 sites, 60 roles per snapshot and 8 attempts per site |
| Listing availability checks | Owning browser profile; short-lived server response cache | Up to 500 latest checks per profile; server cache up to 200 results for 10 minutes |
| Backups and CSV exports | Your selected download location | Until you remove those files |

AI reviews can include up to 10,000 CV characters, 2,000 background characters and 8,000 description characters. The selected country code is sent to Himalayas to filter its feed. Feed searches do not send your CV, background or personal skill list to providers. Website scans do not use your CV. Websites see ordinary requests from your computer, including its network address.

Country and model choices stay with browser profiles and are included in backups. The optional AI connection test sends only a small fixed sample prompt to local Ollama. Country is chosen by the user; there is no IP geolocation.

Listing status checks send only the listing link and title to the local server, which reads the public source. They do not use AI, your CV or background. A status check keeps a short result and evidence, not a copy of the page.

The data directory contains public feed cache data, not browser profiles. Archives use an explicit allowlist, excluding local settings, cache, dependencies, logs and models. Git ignores common runtime and export paths. A custom cache directory needs its own ignore rule if it is inside the repository; use an external or already-ignored runtime directory.

Browser storage and exports are plain data, not encrypted storage. Back up before clearing site data or changing browser/origin. localhost, 127.0.0.1 and different ports have separate storage. Import creates copies of profiles.

The server binds to 127.0.0.1 and validates Host/Origin. Ollama configuration is loopback-only and intended for downloaded local models. JobScout does not manage accounts, keys, subscriptions or model downloads. Public hosting, authenticated shared accounts and unattended scans are outside the current local design.


## Application drafts and poor-match feedback

Draft letters, candidate quotations, CV suggestions and poor-match feedback are stored with the active browser profile and included in exported backups. Treat backups and downloaded letters as personal files. CV inclusion in draft generation is opt-in; profile skills/background and the selected job description go to the configured local Ollama endpoint. JobScout does not send drafts to employers, analytics services or a cloud model. Feedback is not uploaded for training and does not silently change filters.
