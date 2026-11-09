# Verification record

Local verification on 2026-11-09 with Node 24.14 and npm 11.9.

## Automated checks

`npm run check` runs strict TypeScript checks for API/frontend, 31 Node test-runner tests and both production builds.

Covered behaviors:

- Vegan/vegetarian and allergen constraints, exact budget inclusivity and integer currency validation.
- All 512 subsets of nine allergens × 3 diets × 6 budget boundaries, with every eligible dish checked against the independent invariants.
- Content-based ranking, saved-profile changes/removal, out-of-budget saved-dish influence without returning it, normalized additive points, duplicate/stale IDs, cold starts, catalog/candidate-order stability, stable ties, catalog isolation and data coherence.
- Saved-profile HTTP contract validation and AI baseline payloads without raw saved IDs. Profile opt-out persists locally and is honored on reload.
- No matches without relaxing constraints; no provider call for an empty candidate set.
- AI opt-in, missing configuration, provider outages, valid reordering, invalid/ineligible/invented/duplicate/partial IDs, invalid explanation lengths and prompt-like craving text.
- Responses API payload/output parsing, refusal, malformed output, incomplete status and an abort deadline, all with fake network responses.
- HTTP health/menu/recommendation routes, invalid types, unknown fields, malformed/oversized JSON, 404s, rate limiting, security headers, request IDs and logs that omit preference bodies.

## Browser checks

The original browser pass used Vite. The recommendation update was verified with an isolated Playwright CLI browser against the built React app and real Express API on port 4011, with AI disabled. Checked:

- Initial matches and fully loaded local images/fonts.
- 6.50 JOD + vegan + no sesame returns only the three eligible dishes.
- The applied-filter summary and “preferences changed” notice keep old results distinct from pending preferences.
- Zero budget shows an honest empty state.
- Save a dish, inspect the ingredient/allergen dialog and view it in the saved menu filter.
- Full menu, category controls and the explanation page.
- No-taste vegan/no-sesame/6.50 JOD cold start returns Batata harra first. Saving Harissa chicken bowl then submitting returns Chili lentil bowl first without changing the eligible set.
- Saving marks results stale; updated profile applies only after submission. Turning Use saved dishes off restores the cold start, and its opt-out survives reload. Re-enabling restores personalization. Removing the saved dish restores the cold start.
- Why this rank expands to show additive points and reasons. Repeated dish-dialog opening, Escape and Close work.
- AI-mode labeling with mocked browser API responses explicitly distinguishes baseline scores/order from final AI ordering. No live provider was used; mocks were removed afterwards.
- Desktop and 390 px mobile layouts, including expanded-score disclosures, screenshot inspection and no horizontal overflow at 390 px.

The final production preview is also checked separately for frontend HTML, static assets, health and a constrained API request.

Results: **31 tests passed, 0 failed; API and frontend type checks passed; both production builds passed.** The production request for vegan dishes without sesame at 6.50 JOD returned Chili lentil bowl (6.00), Batata harra (3.75), and Garden quinoa salad (5.75), with deterministic fallback when AI was requested without credentials. The final production browser had no console errors or broken images and loaded its local fonts.

Earlier initial-version evidence (before saved-profile personalization):

- [Machine-readable smoke evidence](verification.json)
- [Desktop screenshot](screenshots/desktop.jpg)
- [390 px mobile screenshot](screenshots/mobile.jpg)

The isolated port-4011 server and QA browser were stopped after testing; pre-existing development servers were left untouched. Run the commands in the README to reopen the demo.

## Limits

No live AI request or paid service was used. Provider behavior is verified through injected fakes, not credentials. No deployment, database, account system or production restaurant data is included. Browser checks used scripted Playwright CLI interactions; there is no checked-in browser regression suite. Two non-failing Vite warnings originate in Zod dependency comment annotations. Scores use hand-set weights, and no relevance evaluation or ML training dataset exists. Production readiness requires the controls and verified data described in the README.
