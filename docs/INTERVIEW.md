# Interview walkthrough

## A 30-second introduction

“I built Sufra, a restaurant recommendation app with Node.js, Express, React and TypeScript. It uses a modular monolith: catalog and recommendation modules are separate in code but run in one backend process. The interesting decision is where I use AI. Budget, dietary and allergen filters are deterministic rules. AI can personalize the ordering of eligible dishes and add taste explanations, with a reliable fallback if the provider is unavailable.”

## Five-minute demo

1. **Start** — Run `npm run dev`, open `http://127.0.0.1:5173`. Show the 14-dish menu and default matches. Every dish shows price, relevant dietary labels and a reason.
2. **Reliable filters** — Set the budget to **6.50 JOD**, choose **Vegan**, expand **Ingredients to avoid** and select **Sesame**. Leave Fresh and Smoky selected. Click **Find my matches**. Results are Garden quinoa salad, Chili lentil bowl and Batata harra. Open a dish to inspect its recipe facts.
3. **Personalization** — Deselect Fresh, select Spicy, and type `lentil` in the craving field. Smoky and Spicy should both be active. Find matches again. Chili lentil bowl moves first; eligible dish constraints are unchanged.
4. **Boundary behavior** — Set the budget to **0** and submit. The app honestly returns no matches. It never silently raises the budget or removes an allergen filter. Reset your form, then submit to restore matches.
5. **Resilience** — Show that AI is off and the complete demo still works. If asked, open the fake-provider tests rather than claiming a live provider call. Explain that enabling AI requires a server-side key, an explicit configuration flag and request-level opt-in.
6. **Code** — Walk through `domain.ts`, then `service.ts`, then `app.ts`. Finish with `npm run check` and show the test results.

## Explain a request in 45 seconds

“Express parses a small JSON request and validates it with Zod. The recommendation service reads dishes through the catalog interface. Pure domain functions remove every dish that violates the hard constraints, then rank the remaining dishes by flavors and a simple keyword signal. Optionally, an injected AI adapter reorders the eligible IDs. The service checks that those IDs form the complete eligible set, joins them to trusted catalog facts, rechecks eligibility and limits the result. The frontend receives the resulting dishes and explanations through a typed contract.”

## Likely questions

**Why a modular monolith?** One deployment, straightforward tracing and quick local development suit the current scope. Modules own their behavior and expose narrow boundaries. If there is later a real scaling or ownership reason to extract a service, the dependency boundary is visible already.

**Why Express?** It makes the HTTP layer small and explicit. Validation, routing, errors, request IDs and rate limiting are easy to demonstrate without hiding the recommendation use case in framework code.

**Why not ask an LLM for all recommendations?** It should not decide whether an over-budget or excluded-ingredient dish is acceptable. The server controls the candidate set and trusted facts. AI handles the softer taste ordering, and the system still works when it fails.

**How do you prevent hallucinated dishes?** AI receives a finite list of eligible IDs, the output schema constrains them, and the application independently requires a one-to-one permutation of the eligible set. It rejects unknown, duplicate and missing IDs. Returned dish facts always come from the catalog. Natural-language taste explanations still need evaluation; a schema is not a truth guarantee.

**What about prompt injection?** Free text is bounded and passed as preference data, never used to build database queries or as executable instructions. Hard constraints run before and after AI. A malicious model response cannot introduce a different dish. In a larger system I would also evaluate explanation quality and adversarial inputs.

**How is ranking calculated?** Each selected flavor match is worth 10 points. Distinct matched words in dish names, ingredients and flavors add 2 points each, up to four words. Ties use lower price, then dish ID. It is an explainable baseline, not collaborative filtering or a trained recommendation model. No fabricated confidence percentages appear in the UI.

**How do you handle money?** Prices use integer fils rather than floating-point dinars. A dish at 5,750 fils is included at that exact maximum and excluded at 5,749. The API rejects fractional fils and numeric strings.

**How would you add Postgres?** Implement `CatalogReader` with a database-backed repository owned by the catalog module. Persist dishes, ingredients and allergen relations with verified metadata. Push hard filters into parameterized SQL for larger menus, then rank the bounded candidate set. A shared database still fits a modular monolith; other modules should use the catalog interface rather than accessing its tables directly.

**How would you test this?** Domain tests cover budget boundaries, ranking and all 512 allergen subsets across diets and budgets. Service tests inject valid, invented, duplicated and incomplete AI results and provider failures. HTTP tests verify validation, routing, headers, rate limits and privacy-conscious logs. Adapter tests fake the Responses API and cover deadlines/refusals. Browser checks verify the user journey and narrow-screen layout.

**What would you add next?** Menu persistence and verified allergen metadata first, followed by admin authentication. Then saved preference profiles, offline evaluation data, latency/error metrics, provider cost budgets and caching. Only add embeddings or learned ranking when there is sufficient catalog size and interaction data to justify them.

## Be precise about the scope

- The catalog is a read-only in-memory fixture, not a live restaurant database.
- Favorites persist in this browser only. There is no user account system or server-side profile.
- AI integration is implemented and tested with fakes; a real paid provider request has not been exercised.
- This version recommends individual dishes, not complete meal combinations under a combined budget.
- Allergen filtering is only as reliable as the verified recipe data. The sample menu does not certify allergy safety or cross-contact handling.
