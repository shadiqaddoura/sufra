import { formatJod, type Dish, type Recommendation, type RecommendationRequest } from '@sufra/contracts';

export function violations(dish: Dish, request: RecommendationRequest) {
  return {
    budget: dish.priceFils > request.maxPriceFils,
    diet: (request.diet === 'vegan' && !dish.vegan) || (request.diet === 'vegetarian' && !dish.vegetarian),
    allergens: dish.allergens.some(a => request.excludeAllergens.includes(a)),
    category: request.category !== 'any' && dish.category !== request.category,
  };
}

export function isEligible(dish: Dish, request: RecommendationRequest): boolean {
  return !Object.values(violations(dish, request)).some(Boolean);
}

export function rankDeterministically(dishes: Dish[], request: RecommendationRequest): Recommendation[] {
  const moodWords = new Set(request.mood.toLowerCase().match(/[a-z]+/g) ?? []);
  const ranked = dishes.map(dish => {
    const matchedFlavors = dish.flavors.filter(f => request.flavors.includes(f));
    const searchable = new Set(`${dish.name} ${dish.ingredients.join(' ')} ${dish.flavors.join(' ')}`.toLowerCase().match(/[a-z]+/g));
    const wordMatches = [...moodWords].filter(word => word.length > 2 && searchable.has(word));
    // Explicit flavor choices dominate weak keyword matches; ties prefer value, then stable ID.
    const score = matchedFlavors.length * 10 + Math.min(wordMatches.length, 4) * 2;
    const reasons = [`Within your ${formatJod(request.maxPriceFils)} budget`];
    if (request.diet !== 'any') reasons.push(`Fits your ${request.diet} preference`);
    if (request.excludeAllergens.length) reasons.push('Contains none of your excluded allergens in the sample recipe');
    if (matchedFlavors.length) reasons.push(`Matches your taste for ${matchedFlavors.join(' and ')}`);
    if (wordMatches.length) reasons.push(`Matches “${wordMatches.slice(0, 2).join('” and “')}” in your craving`);
    if (!matchedFlavors.length && !wordMatches.length) reasons.push('A good-value option from your eligible dishes');
    return { dish, reasons, matchedFlavors, score };
  });
  return ranked.sort((a, b) => b.score - a.score || a.dish.priceFils - b.dish.priceFils || a.dish.id.localeCompare(b.dish.id))
    .map(({ score: _score, ...recommendation }) => recommendation);
}
