# Verification record

Local verification on 2026-11-09 with Node 24.14 and npm 11.9.

## Automated checks

`npm run check` runs strict TypeScript checks for API/frontend, 18 Node test-runner tests and both production builds.

Covered behaviors:

- Vegan/vegetarian and allergen constraints, exact budget inclusivity and integer currency validation.
- All 512 subsets of nine allergens × 3 diets × 6 budget boundaries, with every eligible dish checked against the independent invariants.
- Flavor/keyword ranking, stable ties, catalog isolation and data coherence.
- No matches without relaxing constraints; no provider call for an empty candidate set.
- AI opt-in, missing configuration, provider outages, valid reordering, invalid/ineligible/invented/duplicate/partial IDs, invalid explanation lengths and prompt-like craving text.
- Responses API payload/output parsing, refusal, malformed output, incomplete status and an abort deadline, all with fake network responses.
- HTTP health/menu/recommendation routes, invalid types, unknown fields, malformed/oversized JSON, 404s, rate limiting, security headers, request IDs and logs that omit preference bodies.

## Browser checks

Manual browser QA uses the local Vite frontend and real Express API. Checked:

- Initial matches and fully loaded local images/fonts.
- 6.50 JOD + vegan + no sesame returns only the three eligible dishes.
- The applied-filter summary and “preferences changed” notice keep old results distinct from pending preferences.
- Zero budget shows an honest empty state.
- Save a dish, inspect the ingredient/allergen dialog and view it in the saved menu filter.
- Full menu, category controls and the explanation page.
- Desktop and 390 px mobile layouts, including horizontal overflow inspection.

The final production preview is also checked separately for frontend HTML, static assets, health and a constrained API request.

Results: **18 tests passed, 0 failed; API and frontend type checks passed; both production builds passed.** The production request for vegan dishes without sesame at 6.50 JOD returned Chili lentil bowl (6.00), Batata harra (3.75), and Garden quinoa salad (5.75), with deterministic fallback when AI was requested without credentials. The final production browser had no console errors or broken images and loaded its local fonts.

- [Machine-readable smoke evidence](verification.json)
- [Desktop screenshot](screenshots/desktop.jpg)
- [390 px mobile screenshot](screenshots/mobile.jpg)

The temporary development and production verification servers were stopped after testing. Run the commands in the README to reopen the demo.

## Limits

No live AI request or paid service was used. Provider behavior is verified through injected fakes, not credentials. No deployment, database, account system or production restaurant data is included. Browser checks are manual; there is no automated browser suite. Production readiness requires the controls and verified data described in the README.
