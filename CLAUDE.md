# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Running the App

No build step required. The entire app is a single static HTML file (`app.html`).

To serve locally:
```
npx http-server -p 8080
# or
python -m http.server 8080
```

The VSCode debug config (`.vscode/launch.json`) launches Chrome at `http://localhost:8080`.

## Architecture

**Single-file SPA** — all HTML, CSS, and JS live in `app.html` (~2,500 lines). No framework, no bundler, no dependencies except Leaflet Maps (CDN).

**Language:** Hebrew (RTL), targeting the Ashdod municipality. The app manages apartment expansion requests under Urban Plan #603-0595660 (Quarter Z / רובע ז').

### Roles

The app has two modes toggled via `switchRole()`:

- **Submitter (מגיש)** — fills the expansion request form, uploads attachments, tracks status
- **Reviewer / City Architect (מתכנן עיר)** — reviews all requests in a dashboard + map, approves/rejects, can edit page content inline

### State & Persistence

- All requests stored in **`localStorage`** as JSON (including base64-encoded file attachments)
- No backend — the app is entirely client-side
- `loadRequests()` / `saveRequests()` are the persistence boundary

### Key JavaScript Functions

| Area | Functions |
|------|-----------|
| Navigation | `switchRole()`, `goToPage()`, `renderNavTabs()` |
| Form & uploads | `submitRequest()`, `handleAttachmentSelect()`, `initializeImageUpload()` |
| Request management | `loadRequests()`, `filterRequests()`, `viewRequestDetails()` |
| Geocoding | `geocodeFullAddress()`, `resolveRequestLocation()`, `openLocationModal()` |
| Map | `initializeMap()`, `updateMapMarkers()` |
| Reviewer editing | `toggleReviewerEdit()`, `savePageEdits()`, `addComment()` |
| Image viewer | `openImageFullscreen()`, `zoomViewer()`, `setupViewerEvents()` |

### External Dependencies (CDN only)

- **Leaflet 1.9.4** — interactive map
- **OpenStreetMap Nominatim** — address geocoding (with disambiguation modal when multiple results match)

## Code Layout in app.html

| Lines | Content |
|-------|---------|
| 1–871 | `<style>` block — full CSS with RTL support and CSS variables |
| 872–1328 | HTML markup — all views/pages as hidden `<div>` sections |
| 1329–end | `<script>` block — all application logic |
