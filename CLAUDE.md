# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Running the App

Static site, no build step. Entry point is `index.html` (`app.html` only redirects to it).

```
python3 -m http.server 8080
```

Deployed on Vercel from `main`. Merging a PR into `main` updates the live address.

## Architecture

- `index.html` — markup: fixed top bar, landing page, app shell with all pages as hidden `.page` sections, modals.
- `css/app.css` — Ashdod municipality design system (paper/ink, sea, dune, nahal, port), Rubik + IBM Plex Mono, motion layer, dark mode.
- `js/app.js` — all application logic (roles, navigation, forms, requests, map, documents, reviewer auth).
- `js/shell.js` — top bar: the A&I logo button items (`syncAIMenu`: content editing for the city architect, theme, sign-out), toasts, scroll reveal, service worker registration.
- `manifest.webmanifest`, `sw.js`, `icons/` — installable PWA. `assets/logo-ashdod.png` — municipality logo (on white only).
- `docs/plan-instructions.pdf` — plan instructions served as a static file and referenced from `rz_documents_content.files`.

**Language:** Hebrew (RTL), Ashdod municipality. Manages apartment expansion requests under plan 603-0595660 (רובע ז').

### Data — Supabase project ASHDODMAP (shared!)

- Project `cbhexpybdggwzyakgagd` is shared with other apps. Every ROVAZ object uses the `rz_` prefix. Never touch other tables.
- Tables: `rz_requests`, `rz_documents_content` (links, files, notes, page_content), `rz_settings` (reviewer hash, no client access).
- RPCs: `rz_reviewer_password_set`, `rz_check_reviewer`, `rz_set_reviewer`, `rz_save_documents`. Schema in `supabase/rz_schema.sql`.
- The old project ROVAZ-SUPABASE (`mahaeooagyattfavbajw`) was migrated in full on 2026-10-18 and can be deleted.

### Roles

- Submitter (עורך בקשה) — enters by full name, no password.
- City architect (אדריכלית העיר) — password checked server-side. Typing her name on the landing page opens the password modal; the name alone grants nothing.

### Routing

Hash routes `#/<pageId>` and `#/reviewerRequestDetail/<id>`; "העתקת קישור" copies the current state. The app name in the top bar goes home.

## Conventions (from Anat)

- Hebrew UI, no icons, emoji or decorative arrows — words only.
- Fixed top bar on every screen with logo, app name linking home, and the A&I logo button (`<ai-menu>`): "העתקת קישור", "שיחת הפיתוח", install, content editing, theme and sign-out live inside it. No floating editor toolbar.
- After a green test, merge the PR into `main` without asking (standing approval).

## Testing

Playwright against `python3 -m http.server`, with routes mocking the Supabase REST/RPC endpoints and CDN files (the sandbox cannot reach supabase.co or the CDNs).

## A&I logo button
The top bar holds only the app name (links home), content navigation, and ONE logo button "אד' ענת שטיבלמן A&I" (`<ai-menu>` from https://appofapp-gh.vercel.app/ai-menu.js). Every editing and development action (העתקת קישור, שיחת הפיתוח, פרויקט המחקר, התקנת האפליקציה, edit mode, add, delete) lives only inside it, never as loose buttons. Standard: https://github.com/Anat1969/AppOfApp-GH/blob/main/docs/ai-menu-standard.md
