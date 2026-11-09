# How Sufra recommends dishes

## Eligibility and relevance are different decisions

The server first removes dishes outside the inclusive integer-fils budget, diet, selected category or allergen rules. A preference profile never relaxes those constraints. This stage is filtering.

The second stage compares the remaining dishes against current tastes and explicit positive feedback (saved dishes). It can recommend a similar dish that the person has never saved. This stage is content-based ranking. A saved dish may itself be ineligible now and still describe taste; it is never reintroduced into results.

## Request-scoped content profile

`content-ranker.ts` has no HTTP, storage, provider or ML dependency. For each catalog dish:

- Category is a one-hot feature block with 15% of squared vector length.
- Flavors are a normalized multi-hot block with 35% of squared length.
- Ingredients use binary term frequency and smoothed inverse document frequency: `log((N + 1) / (df + 1)) + 1`. Normalize this block and assign 50% of squared length.
- Normalize the combined vector, average vectors for distinct known saved IDs, then normalize the average. Score a candidate against this profile using cosine similarity.

Ingredient phrases are catalog-controlled and lowercase, not semantic embeddings. Rarer shared ingredients matter more than common ones. IDF uses the full menu rather than the eligible subset. Profiles are recomputed per request and not saved on the server. Unknown IDs are ignored and duplicate IDs have no extra influence.

## Explicit, inspectable score

Three signals lie between 0 and 1:

1. Selected flavors: matched distinct flavors / selected distinct flavors. Base weight 50.
2. Craving words: matched distinct recognized terms / recognized terms. Base weight 20. Tokenization is English-only with a small explicit plural/alias map and stop-word list. Unsupported words do not create fake evidence. This does not understand negation or arbitrary natural language; structured filters remain mandatory for dietary needs.
3. Favorites: cosine similarity to the saved-dish profile. Base weight 30.

Normalize only active weights. If all three are present, total points are `50 × flavors + 20 × craving + 30 × favorites`. If craving is absent, flavors and favorites receive 62.5 and 37.5 possible points. With favorites alone, cosine similarity receives all 100 possible points. Components are rounded to one decimal point and summed; sort by the displayed score, then lower price, then stable ID.

Scores are comparable within the same request only. They are not probabilities, satisfaction forecasts or calibrated confidence. A 100-point self-match means a saved dish matches its own profile, not a guarantee the person will enjoy it. With no usable signals, all scores are zero and ranking falls back to price/ID. With no eligible dishes, return an empty result.

## UI and AI behavior

Saving or unsaving does not silently reorder cards mid-interaction. It marks the current results as stale; submitting applies the latest profile. The Use saved dishes checkbox allows a direct personalized-versus-cold-start comparison. Favorites are browser-local, bounded to 50 IDs, and the API validates the payload. Each card has a Why this rank disclosure with component points and factual reasons.

Optional AI gets eligible dish data, taste text and baseline score components, so it can consider personalization without receiving raw saved IDs or saved recipes. Scores are derived preference information; enabling live AI transmits them. Output must be a complete permutation of eligible IDs. Prices and recipe facts come from the catalog. Provider failure preserves the complete content-based result. When AI reorders, the UI explicitly labels the visible score as baseline, not the final ranking rule.

## Concrete interview demonstration

Use vegan + no sesame + 6.50 JOD, with no selected flavors or craving:

| Saved signal | First eligible dish | Baseline points |
| --- | --- | ---: |
| None | Batata harra | 0 (price fallback) |
| Harissa chicken bowl | Chili lentil bowl | 38.3 |
| Garden quinoa salad | Garden quinoa salad | 100 |

In all cases the eligible set remains Batata harra, Chili lentil bowl and Garden quinoa salad. Chicken is never returned. This is an interpretable behavior change beyond merely filtering a menu.

## Tradeoffs and a credible path to trained ML

This is a small, deterministic content-based recommender. Its profile responds to explicit feedback, but its weights are hand-set. It does not train from clicks, compare different users, or use learned embeddings. Similarity can overemphasize a small number of favorites; there is no exploration/diversity objective or negative-feedback model. Craving matching is lexical. A tiny 14-item sample cannot demonstrate generalizable prediction quality.

A next experiment, not implemented here:

1. With informed consent, record pseudonymous impressions, ranked candidate IDs, model version, explicit likes/dislikes and selections. Do not infer dislikes from every unclicked result or log raw dietary/medical text.
2. Build train/validation/test splits by time (and evaluate new users separately). Prevent leakage from future saves or selections into earlier profiles.
3. Compare this baseline with a regularized logistic or pairwise ranking model over the same features, using real interaction labels. Add richer embeddings only when catalog size and language needs warrant them.
4. Measure NDCG@3, Recall@3, coverage and cold-start quality. Audit popularity/position bias and obtain a held-out evaluation before claiming improvement.
5. Keep eligibility outside the learned model, version feature/weight artifacts, and retain deterministic fallback. Start with an in-process model inside the same recommendation module; a new microservice is not justified by the demo.
