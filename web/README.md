# Lanrith console frontend

The React application uses the same-origin `/api/v1` contract. Production requests never fall back to fixtures. Build output lives in `web/dist`; the router server must serve `index.html` for frontend routes such as `/devices/:id`, while preserving `/api/v1` and `/auth` endpoints.

Use Node 22.12 or newer. From `web/`:

```sh
npm ci
npm run dev
npm run typecheck
npm test
npm run build
```

The development server proxies `/api` and `/auth` to `127.0.0.1:8080`. Change only the development proxy in `vite.config.ts` if the local Go server uses another port. Appliance requests always use the browser's origin.

Open `/overview?demo=1` for explicit fixtures, or build with `VITE_DEMO_MODE=1`. A persistent banner identifies demo mode. Optional `demo_role=viewer` or `demo_role=admin` exercises permission states. These parameters select fixtures only; they cannot change a production session's role. Fixtures use RFC documentation addresses and example names. Their annotation edits remain in memory.

`npm run build:preview` builds production assets in `dist/`, then builds the same application separately in `.preview-dist/` with `VITE_DEMO_MODE=1`. It generates `../router-console-preview.html` and the existing `../artifacts/router-console.html` mirror with embedded local fonts, their licences, exact primary/reverse SVG assets, favicon, metadata and application bundle. Preview URLs with a usable origin use hash routing. File URLs and opaque Open Design frames use internal navigation because they cannot resolve browser-history URLs. A smoke test boots the compiled preview in that frame context and visits all seven pages without network requests. The appliance build uses browser routes and keeps its normal API behavior.

`npm run storybook` is the component reference. `npm run build:storybook` writes a local reference to `storybook-static/`. Every visual component and page has a Storybook example; the toolbar selects the design-system theme and fixture role. Storybook uses an explicit fixture adapter and disables its telemetry.

The application imports `design/colors_and_type.css` and `design/build/reference.css`. Canonical light/dark values come from `design/tokens.css`; local variable Manrope and IBM Plex Mono retain their own OFL licences in `public/licenses/`. `Brand` uses the supplied outlined SVG wordmark and junction mark, with primary/reverse variants selected by the canonical theme CSS and one accessible name. Sidebar and sign-in use the full wordmark. Product and browser label: Lanrith console. Existing package names, routes, API identifiers and preference keys are retained.

The approved brand supersedes the historical provisional identity in the original design brief. Update the shared package first, then follow [design/EXPORT.md](../design/EXPORT.md) to copy and verify it; do not fork token values in application CSS. `design/components.manifest.json` describes the component contracts. The exported design reference and its independent validation remain separate from the production API application and the alternate Phase 3 implementation.

URL queries retain search, device, verdict, family, protocol, translation, rule/flow selection, interval and cursor state. Traffic queries request 50 records and send evidence/time filters to the API before pagination, following the concurrent API integration. The client also filters the returned evidence. Event requests send time windows; severity/kind filters apply to the bounded response. Exports download the server-authorized flow scope; client filters do not alter the export contract.

Authenticated annotation writes and logout send `X-CSRF-Token` from in-memory session state. Initial local login sends same-origin JSON; the supplied contract returns its first CSRF token after authentication, so the backend must protect initial login through its origin and cookie policy. The frontend renders API strings as React text, restricts the OIDC link to the same origin, and stores only theme/density preferences locally. The Go API must enforce authorization, session expiry, CSRF, query/export bounds and secure cookies; browser role gates are usability controls.

No hook traversal history, translated ports, application connectivity, per-device bandwidth series, CPU/memory budgets or physical switch topology are supplied by this contract. Their absence is stated in the relevant views. Installed rule metadata never becomes an invented flow path. Expiry alone never claims a rule was removed.

Interaction tests cover URL flow filtering, inspector focus restoration, keyboard tabs, permission denials, failed annotation drafts, hostile labels, shared counters, chart gaps and API errors. Browser layout and Go integration checks remain with the parent implementation task.
