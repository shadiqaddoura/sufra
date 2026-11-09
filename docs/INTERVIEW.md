# Interview walkthrough

## A 30-second introduction

“I built Sufra, a restaurant recommendation app with Node.js, Express, React and TypeScript. It uses a modular monolith: catalog and recommendation modules are separate in code but run in one backend process. The interesting separation is eligibility versus relevance. Budget, dietary and allergen filters are hard rules. A content-based recommender ranks eligible dishes using current tastes and similarity to saved dishes. Its score is explainable, and optional AI can reorder only the eligible set with a reliable fallback.”

## Five-minute demo

1. **Start** — Run `npm run dev`, open `http://127.0.0.1:5173`. Show the 14-dish menu and default matches. Every dish shows price, relevant dietary labels and a reason.
2. **Reliable filters** — Set the budget to **6.50 JOD**, choose **Vegan**, expand **Ingredients to avoid** and select **Sesame**. Leave Fresh and Smoky selected. Click **Find my matches**. Results are Garden quinoa salad, Chili lentil bowl and Batata harra. Open a dish to inspect its recipe facts.
3. **Personalization beyond filtering** — Clear Fresh and Smoky and submit: Batata harra is first by price. In Explore menu, save Harissa chicken bowl, return, and submit. Chili lentil bowl moves first from ingredient/flavor/category similarity, although the saved chicken itself is ineligible. Open **Why this rank**. Switch **Use saved dishes** off and resubmit to compare. Remove the saved favorite afterwards if repeating the demo.
4. **Boundary behavior** — Set the budget to **0** and submit. The app honestly returns no matches. It never silently raises the budget or removes an allergen filter. Reset your form, then submit to restore matches.
5. **Resilience** — Show that AI is off and the complete demo still works. If asked, open the fake-provider tests rather than claiming a live provider call. Explain that enabling AI requires a server-side key, an explicit configuration flag and request-level opt-in.
6. **Code** — Walk through `domain.ts`, then `service.ts`, then `app.ts`. Finish with `npm run check` and show the test results.

## Explain a request in 45 seconds

“Express parses a small JSON request and validates it with Zod. The recommendation service reads dishes through the catalog interface. Pure domain functions remove every dish that violates the hard constraints, then build a content-based taste profile from saved dishes and rank remaining dishes by current flavors, craving terms and cosine similarity. Each response includes additive score components. Optionally, an injected AI adapter reorders the eligible IDs. The service checks that those IDs form the complete eligible set, joins them to trusted catalog facts, rechecks eligibility and limits the result. The frontend receives the resulting dishes and explanations through a typed contract.”

## Likely questions

**Why a modular monolith?** One deployment, straightforward tracing and quick local development suit the current scope. Modules own their behavior and expose narrow boundaries. If there is later a real scaling or ownership reason to extract a service, the dependency boundary is visible already.

**Why Express?** It makes the HTTP layer small and explicit. Validation, routing, errors, request IDs and rate limiting are easy to demonstrate without hiding the recommendation use case in framework code.

**Why not ask an LLM for all recommendations?** It should not decide whether an over-budget or excluded-ingredient dish is acceptable. The server controls the candidate set and trusted facts. AI handles the softer taste ordering, and the system still works when it fails.

**How do you prevent hallucinated dishes?** AI receives a finite list of eligible IDs, the output schema constrains them, and the application independently requires a one-to-one permutation of the eligible set. It rejects unknown, duplicate and missing IDs. Returned dish facts always come from the catalog. Natural-language taste explanations still need evaluation; a schema is not a truth guarantee.

**What about prompt injection?** Free text is bounded and passed as preference data, never used to build database queries or as executable instructions. Hard constraints run before and after AI. A malicious model response cannot introduce a different dish. In a larger system I would also evaluate explanation quality and adversarial inputs.

**How is ranking calculated?** Current flavors, recognized craving words and saved-dish similarity have base weights 50/20/30, normalized over active signals. Dish vectors combine category (15%), flavors (35%) and TF-IDF ingredient features (50%). The profile is the normalized mean of saved-dish vectors, and cosine similarity scores candidates. Ties use price, then ID. Points are visible, not confidence probabilities. See [the algorithm](RECOMMENDATIONS.md).

**Is that machine learning?** It is a content-based recommender using information-retrieval techniques, with hand-set weights. It does not learn ranking weights from outcomes. I would collect consented impressions and explicit feedback, build a time-split evaluation dataset, compare a learned ranking model against this baseline with NDCG@3 and Recall@3, and keep the same hard eligibility gates. Calling the current system a trained ML model would be inaccurate.

**How do you handle money?** Prices use integer fils rather than floating-point dinars. A dish at 5,750 fils is included at that exact maximum and excluded at 5,749. The API rejects fractional fils and numeric strings.

**How would you add Postgres?** Implement `CatalogReader` with a database-backed repository owned by the catalog module. Persist dishes, ingredients and allergen relations with verified metadata. Push hard filters into parameterized SQL for larger menus, then rank the bounded candidate set. A shared database still fits a modular monolith; other modules should use the catalog interface rather than accessing its tables directly.

**How would you test this?** Domain tests cover budget boundaries, ranking and all 512 allergen subsets across diets and budgets. Service tests inject valid, invented, duplicated and incomplete AI results and provider failures. HTTP tests verify validation, routing, headers, rate limits and privacy-conscious logs. Adapter tests fake the Responses API and cover deadlines/refusals. Browser checks verify the user journey and narrow-screen layout.

**What would you add next?** Menu persistence and verified allergen metadata first, followed by admin authentication. Then consented persistent feedback, offline evaluation data, latency/error metrics, provider cost budgets and caching. Only add embeddings or learned ranking when there is sufficient catalog size and interaction data to justify them.

## Be precise about the scope

- The catalog is a read-only in-memory fixture, not a live restaurant database.
- Favorites persist in this browser only and shape a request-scoped taste profile when enabled. There is no user account system or server-side profile. Saving a dish marks results stale; Find my matches applies the new profile.
- AI integration is implemented and tested with fakes; a real paid provider request has not been exercised.
- This version recommends individual dishes, not complete meal combinations under a combined budget.
- Allergen filtering is only as reliable as the verified recipe data. The sample menu does not certify allergy safety or cross-contact handling.
