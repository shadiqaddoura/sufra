import { type Dish, type RecommendationRequest } from '@sufra/contracts';

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

// Compatibility export; the content-based scorer is separate from eligibility rules.
export { rankDeterministically } from './content-ranker.js';
