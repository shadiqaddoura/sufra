import { formatJod, type Dish, type Recommendation, type RecommendationRequest, type RankingMetadata, type RankingSignal, type ScoreComponent } from '@sufra/contracts';

type Vector = Map<string, number>;
const stopWords = new Set('a an and the with for of some something please want would like maybe craving me my dish food'.split(' '));
const aliases: Record<string, string> = { lentils: 'lentil', potatoes: 'potato', chickpeas: 'chickpea', bowls: 'bowl', salads: 'salad', nuts: 'nut', lemons: 'lemon', chillies: 'chili', chilli: 'chili' };
const round = (number: number) => Math.round(number * 10) / 10;
function words(text: string): string[] {
  return [...new Set((text.toLowerCase().match(/[a-z]+/g) ?? []).map(word => aliases[word] ?? word).filter(word => word.length > 2 && !stopWords.has(word)))];
}
function normalize(vector: Vector): Vector {
  const length = Math.hypot(...vector.values());
  return new Map([...vector].map(([key, value]) => [key, length ? value / length : 0]));
}
function similarity(a: Vector, b: Vector): number {
  return Math.min(1, Math.max(0, [...a].reduce((sum, [key, value]) => sum + value * (b.get(key) ?? 0), 0)));
}

// All blocks are L2-normalized. Category, flavors and ingredients contribute
// 15%, 35% and 50% of a dish vector's squared length, respectively.
// Ingredient IDF is computed from the whole catalog, never the filtered subset.
function dishVectors(catalog: Dish[]): Map<string, Vector> {
  const frequency = new Map<string, number>();
  for (const dish of catalog) for (const ingredient of new Set(dish.ingredients.map(i => i.toLowerCase()))) {
    frequency.set(ingredient, (frequency.get(ingredient) ?? 0) + 1);
  }
  return new Map(catalog.map(dish => {
    const vector: Vector = new Map([[`category:${dish.category}`, Math.sqrt(0.15)]]);
    const flavors = [...new Set(dish.flavors)];
    for (const flavor of flavors) vector.set(`flavor:${flavor}`, Math.sqrt(0.35 / flavors.length));
    const ingredients = normalize(new Map(dish.ingredients.map(ingredient => {
      const key = ingredient.toLowerCase();
      return [key, Math.log((catalog.length + 1) / ((frequency.get(key) ?? 0) + 1)) + 1];
    })));
    for (const [ingredient, value] of ingredients) vector.set(`ingredient:${ingredient}`, value * Math.sqrt(0.5));
    return [dish.id, normalize(vector)];
  }));
}

export function rankContentBased(dishes: Dish[], request: RecommendationRequest, catalog: Dish[] = dishes): { recommendations: Recommendation[]; ranking: RankingMetadata } {
  const vectors = dishVectors(catalog);
  const likedIds = new Set(request.likedDishIds);
  const liked = catalog.filter(dish => likedIds.has(dish.id));
  const profile: Vector = new Map();
  for (const dish of liked) for (const [key, value] of vectors.get(dish.id)!) profile.set(key, (profile.get(key) ?? 0) + value / liked.length);
  const tasteProfile = normalize(profile);
  const searchable = new Map(catalog.map(dish => [dish.id, new Set(words(`${dish.name} ${dish.ingredients.join(' ')} ${dish.flavors.join(' ')}`))]));
  const vocabulary = new Set([...searchable.values()].flatMap(terms => [...terms]));
  const cravingTerms = words(request.mood).filter(word => vocabulary.has(word));
  const selectedFlavors = [...new Set(request.flavors)];
  const signals: { signal: RankingSignal; label: string; weight: number; active: boolean }[] = [
    { signal: 'flavors', label: 'Selected flavors', weight: 50, active: selectedFlavors.length > 0 },
    { signal: 'craving', label: 'Craving words', weight: 20, active: cravingTerms.length > 0 },
    { signal: 'favorites', label: 'Saved-dish similarity', weight: 30, active: liked.length > 0 },
  ];
  const totalWeight = signals.filter(s => s.active).reduce((total, s) => total + s.weight, 0);
  const ranking: RankingMetadata = { algorithm: 'content-based-v1', strategy: liked.length ? 'personalized' : totalWeight ? 'taste' : 'value', profileSize: liked.length, recognizedCravingTerms: cravingTerms };
  const recommendations = dishes.map(dish => {
    const matchedFlavors = selectedFlavors.filter(flavor => dish.flavors.includes(flavor));
    const matchedWords = cravingTerms.filter(word => searchable.get(dish.id)?.has(word));
    const scores: Record<RankingSignal, number> = {
      flavors: selectedFlavors.length ? matchedFlavors.length / selectedFlavors.length : 0,
      craving: cravingTerms.length ? matchedWords.length / cravingTerms.length : 0,
      favorites: liked.length ? similarity(vectors.get(dish.id) ?? new Map(), tasteProfile) : 0,
    };
    const scoreBreakdown: ScoreComponent[] = signals.filter(s => s.active).map(s => ({
      signal: s.signal, label: s.label, similarity: scores[s.signal], weight: s.weight / totalWeight,
      points: round(100 * s.weight / totalWeight * scores[s.signal]),
    }));
    const score = round(scoreBreakdown.reduce((total, component) => total + component.points, 0));
    const reasons = [`Within your ${formatJod(request.maxPriceFils)} budget`];
    if (request.diet !== 'any') reasons.push(`Fits your ${request.diet} preference`);
    if (request.excludeAllergens.length) reasons.push('Contains none of your excluded allergens in the sample recipe');
    if (matchedFlavors.length) reasons.push(`Matches your taste for ${matchedFlavors.join(' and ')}`);
    if (matchedWords.length) reasons.push(`Matches “${matchedWords.slice(0, 3).join('” and “')}” in your craving`);
    if (scores.favorites > 0) {
      const nearest = [...liked].sort((a, b) => similarity(vectors.get(dish.id)!, vectors.get(b.id)!) - similarity(vectors.get(dish.id)!, vectors.get(a.id)!) || a.id.localeCompare(b.id))[0]!;
      const sharedFlavors = dish.flavors.filter(flavor => nearest.flavors.includes(flavor));
      const sharedIngredients = dish.ingredients.filter(ingredient => nearest.ingredients.includes(ingredient));
      if (nearest.id === dish.id) reasons.push('Already one of your saved favorites');
      else if (sharedIngredients.length) reasons.push(`Shares ${sharedIngredients.slice(0, 2).join(' and ')} with your saved ${nearest.name}`);
      else if (sharedFlavors.length) reasons.push(`Shares ${sharedFlavors.join(' and ')} flavors with your saved ${nearest.name}`);
      else reasons.push(`Same ${dish.category} category as your saved ${nearest.name}`);
    }
    if (!score) reasons.push(totalWeight ? 'No taste overlap found; offered as an eligible alternative' : 'No taste signals yet; baseline uses price, then dish ID');
    return { dish, reasons, matchedFlavors, score, scoreBreakdown };
  }).sort((a, b) => b.score - a.score || a.dish.priceFils - b.dish.priceFils || a.dish.id.localeCompare(b.dish.id));
  return { recommendations, ranking };
}

export function rankDeterministically(dishes: Dish[], request: RecommendationRequest, catalog: Dish[] = dishes): Recommendation[] {
  return rankContentBased(dishes, request, catalog).recommendations;
}
