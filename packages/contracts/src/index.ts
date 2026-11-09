import { z } from 'zod';

export const allergens = ['milk', 'egg', 'wheat', 'sesame', 'peanut', 'tree-nut', 'soy', 'fish', 'shellfish'] as const;
export const flavors = ['fresh', 'smoky', 'spicy', 'comforting', 'tangy'] as const;
export const categories = ['bowls', 'mains', 'salads', 'sides', 'desserts'] as const;
export const diets = ['any', 'vegetarian', 'vegan'] as const;
export type Allergen = typeof allergens[number];
export type Flavor = typeof flavors[number];
export type Category = typeof categories[number];
export type Diet = typeof diets[number];

// Currency is an integer number of fils: 1 JOD = 1,000 fils.
export const recommendationRequestSchema = z.object({
  maxPriceFils: z.number().int().min(0).max(50_000),
  diet: z.enum(diets).default('any'),
  excludeAllergens: z.array(z.enum(allergens)).max(allergens.length).default([]),
  flavors: z.array(z.enum(flavors)).max(flavors.length).default([]),
  category: z.enum(['any', ...categories]).default('any'),
  mood: z.string().trim().max(300).default(''),
  limit: z.number().int().min(1).max(6).default(3),
  useAi: z.boolean().default(false),
  // A bounded browser-local taste profile, not an account or server-side history.
  likedDishIds: z.array(z.string().min(1).max(80)).max(50).default([]),
}).strict();
export type RecommendationRequest = z.infer<typeof recommendationRequestSchema>;

export interface Dish {
  id: string;
  name: string;
  description: string;
  category: Category;
  priceFils: number;
  calories: number;
  proteinGrams: number;
  preparationMinutes: number;
  vegetarian: boolean;
  vegan: boolean;
  allergens: Allergen[];
  flavors: Flavor[];
  ingredients: string[];
  image: string;
  imagePosition?: string;
}
export type RankingSignal = 'flavors' | 'craving' | 'favorites';
export interface ScoreComponent {
  signal: RankingSignal;
  label: string;
  similarity: number;
  weight: number;
  points: number;
}
export interface RankingMetadata {
  algorithm: 'content-based-v1';
  strategy: 'personalized' | 'taste' | 'value';
  profileSize: number;
  recognizedCravingTerms: string[];
}
export interface Recommendation {
  dish: Dish;
  reasons: string[];
  matchedFlavors: Flavor[];
  // Heuristic 0–100 points, NOT probability, confidence, or a trained-model output.
  score: number;
  scoreBreakdown: ScoreComponent[];
  aiExplanation?: string;
}
export type FallbackReason = 'not-requested' | 'not-configured' | 'provider-error' | 'invalid-output' | 'no-candidates';
export interface RecommendationResponse {
  recommendations: Recommendation[];
  meta: {
    mode: 'deterministic' | 'ai';
    ranking: RankingMetadata;
    fallbackReason?: FallbackReason;
    totalDishes: number;
    eligibleDishes: number;
    excluded: { budget: number; diet: number; allergens: number; category: number };
    // Exclusion counts may overlap: one dish can fail several rules.
    requestId: string;
    durationMs: number;
  };
}
export interface CatalogResponse { dishes: Dish[]; currency: 'JOD' }
export interface HealthResponse { status: 'ok'; aiAvailable: boolean; catalogSize: number }
export interface ApiError { error: { code: string; message: string; requestId: string; fields?: Record<string, string[]> } }

export function formatJod(fils: number): string {
  return `${(fils / 1000).toFixed(fils % 10 === 0 ? 2 : 3)} JOD`;
}
