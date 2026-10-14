# OSRS Character Planner — Hybrid Dashboard Redesign

A fan-made, dark RuneScape-inspired companion that combines an OSRS character dashboard, skills goals, a quest planner, and a Grand Exchange wishlist.

## What's new
- New responsive dashboard with a left sidebar on desktop and a scrollable navigation strip on mobile.
- Character overview, OSRS skill tiles, XP to goals, quest completion, GP savings, and wishlist summaries.
- Personal activity journal (records changes you make from this version onwards in this browser).
- Redesigned Skills Planner, Training Calculator, collapsible Quest Planner, and GE Wishlist.
- Player Profiles page explaining the future shared-profiles functionality **without claiming it is already implemented**.
- Existing local goals/quests/wishlist are migrated from the previous version on first load for your current character. New local data is separated by character name within the same browser.
- Local Python `server.py` now supports `/api/ge` as well as Hiscores and quest lookup.

## IMPORTANT: How to publish this update to the existing Vercel website

The Vercel backend and configuration files are included in this ZIP. To publish just the redesign to your existing GitHub repository, the **required root-level files** are:

1. `index.html` — **replace** the existing file.
2. `styles.css` — **add** this new file.
3. `app.js` — **add** this new file.

Recommended: also **replace** `server.py` (the updated local development server supports GE lookup) and `README.md`. `vercel.json`, `requirements.txt`, and `api/index.py` are unchanged from the uploaded starting ZIP; you do not need to touch them for this redesign.

In GitHub, go to `Dcstormz/osrs-character-planner` → **Add file** → **Upload files** while at the repository root. Drag the root-level files listed above, then **Commit changes**. Vercel should automatically deploy the changes to the SAME website URL.

**Tip:** Make a copy of your current ZIP and/or use a separate Git branch to preview major changes before publishing them. If the deployment fails, you can roll back in Vercel to the previous good deployment.

## Run locally (Windows)

1. Extract this ZIP into a folder (keep `api` as a folder).
2. Open Command Prompt inside that folder.
3. Run `python server.py`.
4. Open http://localhost:8000 in your browser.

Python's standard library runs the local server. Flask is required by the Vercel function (`requirements.txt`).

## Data and service limitations

- OSRS stats come from Jagex Hiscores; GE data and quest data come from the OSRS Wiki services. Those sites may occasionally be unavailable or rate-limit requests.
- GE prices are observed trade prices, **not guaranteed offers**. If a price is unavailable, that item is excluded from calculated wishlist totals and totals have an asterisk.
- Your GP cash stack is entered manually; Jagex does not expose bank contents in Hiscores.
- Quest completion is marked manually. Quest skill requirements are best-effort; always verify full prerequisites and boosts on the Wiki.
- Wishlists, skill goals, quest completion and local activity are saved to browser localStorage, **not shared between different devices/people** yet. No sign-in or database exists in this release. Future shared player profiles require Supabase or another backend with authentication and per-player authorization.
- This is an unofficial fan project and is not affiliated with Jagex.

## Project layout

- `index.html`: HTML interface
- `styles.css`: complete responsive theme
- `app.js`: dashboard interactions, local persistence, API requests
- `server.py`: local Python server + quest parsing and GE endpoint
- `api/index.py`: Flask endpoints for Vercel
- `vercel.json`: routing for Vercel API endpoints
- `requirements.txt`: Flask dependency
