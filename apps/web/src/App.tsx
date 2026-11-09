import { useEffect, useRef, useState, type FormEvent } from 'react';
import { ArrowDown, ArrowRight, Check, CheckCheck, ChevronDown, Clock3, Flame, Heart, Info, Leaf, LoaderCircle, SlidersHorizontal, Sparkles, Sprout, UtensilsCrossed, X } from 'lucide-react';
import { allergens, categories, flavors, formatJod, recommendationRequestSchema, type Allergen, type ApiError, type CatalogResponse, type Dish, type HealthResponse, type Recommendation, type RecommendationRequest, type RecommendationResponse } from '@sufra/contracts';

const initial: RecommendationRequest = { maxPriceFils: 10000, diet: 'any', excludeAllergens: [], flavors: ['fresh', 'smoky'], category: 'any', mood: '', limit: 3, useAi: false };
const allergenLabels: Record<Allergen, string> = { milk: 'Milk', egg: 'Egg', wheat: 'Wheat', sesame: 'Sesame', peanut: 'Peanuts', 'tree-nut': 'Tree nuts', soy: 'Soy', fish: 'Fish', shellfish: 'Shellfish' };
type Tab = 'match' | 'menu' | 'how';

async function api<T>(url: string, options?: RequestInit): Promise<T> {
  const response = await fetch(url, options);
  if (!response.ok) {
    const body = await response.json().catch(() => null) as ApiError | null;
    throw new Error(body?.error.message ?? 'The kitchen is taking a moment. Please try again.');
  }
  return response.json() as Promise<T>;
}
function toggle<T>(items: T[], value: T): T[] { return items.includes(value) ? items.filter(x => x !== value) : [...items, value]; }
function signature(value: RecommendationRequest): string { return JSON.stringify(value); }

export function App() {
  const [tab, setTab] = useState<Tab>('match');
  const [form, setForm] = useState<RecommendationRequest>(initial);
  const [submitted, setSubmitted] = useState<RecommendationRequest>(initial);
  const [result, setResult] = useState<RecommendationResponse | null>(null);
  const [menu, setMenu] = useState<Dish[]>([]);
  const [aiAvailable, setAiAvailable] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [menuCategory, setMenuCategory] = useState('any');
  const [selected, setSelected] = useState<Dish | null>(null);
  const dialog = useRef<HTMLDialogElement>(null);
  const controller = useRef<AbortController | null>(null);
  const requestNumber = useRef(0);
  const [saved, setSaved] = useState<string[]>(() => {
    try { const value: unknown = JSON.parse(localStorage.getItem('sufra:saved') ?? '[]'); return Array.isArray(value) ? value.filter((x): x is string => typeof x === 'string') : []; } catch { return []; }
  });
  const [savedOnly, setSavedOnly] = useState(false);
  const [catalogError, setCatalogError] = useState('');
  const dirty = signature(form) !== signature(submitted);

  function save(id: string) {
    setSaved(previous => { const next = toggle(previous, id); try { localStorage.setItem('sufra:saved', JSON.stringify(next)); } catch { /* session state still works */ } return next; });
  }
  async function recommend(preferences: RecommendationRequest) {
    const number = ++requestNumber.current;
    controller.current?.abort();
    const nextController = new AbortController();
    controller.current = nextController;
    setLoading(true); setError('');
    try {
      const next = await api<RecommendationResponse>('/api/recommendations', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(preferences), signal: nextController.signal });
      if (number === requestNumber.current) { setResult(next); setSubmitted(preferences); }
    } catch (err) {
      if (number === requestNumber.current && !nextController.signal.aborted) setError(err instanceof Error ? err.message : 'Could not find your matches. Try again.');
    } finally { if (number === requestNumber.current) setLoading(false); }
  }
  async function loadCatalog(signal?: AbortSignal) {
    setCatalogError('');
    try {
      const catalog = await api<CatalogResponse>('/api/menu', { signal });
      setMenu(catalog.dishes);
    } catch { if (!signal?.aborted) setCatalogError('Could not load the menu. Please try again.'); }
  }
  useEffect(() => {
    const abort = new AbortController();
    void loadCatalog(abort.signal);
    void api<HealthResponse>('/api/health', { signal: abort.signal }).then(health => setAiAvailable(health.aiAvailable)).catch(() => {});
    void recommend(initial);
    return () => { abort.abort(); controller.current?.abort(); };
  }, []);
  useEffect(() => {
    if (selected) dialog.current?.showModal();
    else dialog.current?.close();
  }, [selected]);

  function submit(event: FormEvent) {
    event.preventDefault();
    const parsed = recommendationRequestSchema.safeParse(form);
    if (!parsed.success) { setError('Choose a budget between 0 and 50 JOD, with up to three decimal places.'); return; }
    void recommend(parsed.data);
  }
  function openTab(next: Tab) { setTab(next); }
  const visibleMenu = menu.filter(dish => (menuCategory === 'any' || dish.category === menuCategory) && (!savedOnly || saved.includes(dish.id)));

  return <div className="app-shell">
    <a className="skip-link" href="#main">Skip to content</a>
    <header className="site-header">
      <a className="brand" href="#" aria-label="Sufra home" onClick={event => { event.preventDefault(); openTab('match'); }}><span className="brand-mark"><Sprout size={24} strokeWidth={1.7} /></span><span>sufra<span className="brand-dot">.</span></span></a>
      <nav aria-label="Main navigation">
        <button className={tab === 'match' ? 'nav-link active' : 'nav-link'} onClick={() => openTab('match')}>Find your dish</button>
        <button className={tab === 'menu' ? 'nav-link active' : 'nav-link'} onClick={() => openTab('menu')}>Explore menu</button>
        <button className={tab === 'how' ? 'nav-link active' : 'nav-link'} onClick={() => openTab('how')}>How it works</button>
      </nav>
      <span className="header-note"><span className="status-dot" /> A little taste of Amman</span>
    </header>

    <main id="main">
      {tab === 'match' && <>
        <section className="hero">
          <div className="hero-copy"><p className="eyebrow"><span /> GOOD FOOD. GOOD MOOD.</p><h1>A little more<br /><em>your taste.</em><span className="hero-asterisk">✳</span></h1><p>Something fresh? A little heat? Find the dish that<br className="desktop-break" /> fits your cravings, your diet, and your day.</p><a className="hero-link" href="#matchmaker">Let’s find your next favorite <ArrowDown size={16} /></a></div>
          <div className="hero-visual" aria-hidden="true"><div className="hero-orbit" /><img className="hero-image" src="/images/hero.jpg" alt="" /><span className="hero-stamp">MADE FOR<br /><strong>your mood</strong><Sprout size={24} /></span><div className="floating-note"><span className="note-icon"><Leaf size={18} /></span><div>A good match feels right.<small>Fresh ingredients. Thoughtful choices.</small></div></div><span className="hero-squiggle">~</span></div>
        </section>

        <section id="matchmaker" className="match-layout">
          <aside className="preferences"><form onSubmit={submit}>
            <div className="panel-title"><SlidersHorizontal size={18} /><h2>Your kind of plate</h2><button type="button" className="text-button" onClick={() => setForm({ ...initial, flavors: [] })}>Reset</button></div>
            <div className="form-section"><label className="field-label" htmlFor="budget">My budget <span>per dish</span></label><div className="budget-display"><input id="budget" type="number" min="0" max="50" step="0.001" required value={Number.isNaN(form.maxPriceFils) ? '' : form.maxPriceFils / 1000} onChange={event => setForm({ ...form, maxPriceFils: event.target.value === '' ? NaN : Math.round(Number(event.target.value) * 1000) })} /><span>JOD</span></div><input aria-label="Budget slider" className="range" type="range" min="0" max="20000" step="500" value={Math.min(20000, form.maxPriceFils || 0)} onChange={event => setForm({ ...form, maxPriceFils: Number(event.target.value) })} /><div className="range-labels"><span>0 JOD</span><span>20 JOD</span></div></div>
            <fieldset className="form-section"><legend className="field-label">The way I eat</legend><div className="diet-options">{(['any', 'vegetarian', 'vegan'] as const).map(diet => <button key={diet} type="button" aria-pressed={form.diet === diet} className={form.diet === diet ? 'choice selected' : 'choice'} onClick={() => setForm({ ...form, diet })}>{diet === 'any' ? <UtensilsCrossed size={14} /> : <Leaf size={14} />}{diet === 'any' ? 'Everything' : diet === 'vegetarian' ? 'Vegetarian' : 'Vegan'}{form.diet === diet && <Check size={13} />}</button>)}</div></fieldset>
            <div className="form-section"><details className="allergen-picker"><summary><span>Ingredients to avoid <small>{form.excludeAllergens.length ? `${form.excludeAllergens.length} selected` : 'Optional'}</small></span><ChevronDown size={16} /></summary><fieldset><legend className="sr-only">Exclude dishes containing these allergens</legend><div className="allergen-options">{allergens.map(allergen => <label key={allergen}><input type="checkbox" checked={form.excludeAllergens.includes(allergen)} onChange={() => setForm({ ...form, excludeAllergens: toggle(form.excludeAllergens, allergen) })} />{allergenLabels[allergen]}</label>)}</div></fieldset></details>{form.excludeAllergens.length > 0 && <p className="tiny-note">Avoiding: {form.excludeAllergens.map(a => allergenLabels[a]).join(', ')}</p>}</div>
            <fieldset className="form-section"><legend className="field-label">What sounds good?</legend><div className="flavor-options">{flavors.map(flavor => <button type="button" key={flavor} aria-pressed={form.flavors.includes(flavor)} className={form.flavors.includes(flavor) ? 'flavor selected' : 'flavor'} onClick={() => setForm({ ...form, flavors: toggle(form.flavors, flavor) })}>{flavor === 'spicy' ? <Flame size={13} /> : flavor === 'fresh' ? <Sprout size={13} /> : <span className="flavor-dot" />}{flavor}{form.flavors.includes(flavor) && <Check size={12} />}</button>)}</div></fieldset>
            <div className="form-section craving"><label className="field-label" htmlFor="mood">Anything else you’re craving?</label><textarea id="mood" placeholder="A smoky chicken bowl, maybe?" value={form.mood} maxLength={300} onChange={event => setForm({ ...form, mood: event.target.value })} /><p className="tiny-note">A taste preference. Use the filters above for dietary needs.</p></div>
            <div className="ai-option"><label><span><Sparkles size={15} /><strong>Personalize with AI</strong><small>{aiAvailable ? 'Optional taste ranking & explanations' : 'Not configured · taste matching is ready'}</small></span><input type="checkbox" aria-label="Personalize with AI" role="switch" checked={form.useAi} disabled={!aiAvailable} onChange={event => setForm({ ...form, useAi: event.target.checked })} /></label></div>
            <button className="primary-button" type="submit" disabled={loading}>{loading ? <><LoaderCircle size={17} className="spinner" /> Finding your favorites</> : <>Find my matches <ArrowRight size={17} /></>}</button>
          </form></aside>

          <div className="results-panel" aria-busy={loading}>
            <div className="results-heading"><div><p className="eyebrow">A MENU THAT GETS YOU</p><h2>A few things you’ll love<span>.</span></h2></div><span className="match-mode"><span className="status-dot" />{result?.meta.mode === 'ai' ? 'AI personalized' : 'Taste matched'}</span></div>
            <div className="results-context" aria-live="polite">{loading ? 'Finding a little something for you…' : result ? <><strong>{result.meta.eligibleDishes} {result.meta.eligibleDishes === 1 ? 'dish' : 'dishes'}</strong> {result.meta.eligibleDishes === 1 ? 'fits' : 'fit'} your preferences. Here are {result.recommendations.length ? `your top ${result.recommendations.length} picks` : 'your results'}.</> : 'Your next favorite is waiting.'}</div>
            <div className="applied-filters" aria-label="Applied filters"><span><Check size={12} /> Up to {formatJod(submitted.maxPriceFils)}</span>{submitted.diet !== 'any' && <span><Leaf size={12} /> {submitted.diet}</span>}{submitted.flavors.map(flavor => <span key={flavor}>{flavor}</span>)}{submitted.excludeAllergens.map(allergen => <span key={allergen}>No {allergenLabels[allergen].toLowerCase()}</span>)}</div>
            {dirty && <div className="notice"><Info size={15} /><span>Preferences changed. Find your matches to update these results.</span></div>}
            {error && <div className="error-message" role="alert"><Info size={17} /><span>{error}</span><button type="button" onClick={() => void recommend(form)}>Try again</button></div>}
            {result?.meta.fallbackReason && !['not-requested', 'no-candidates'].includes(result.meta.fallbackReason) && <div className="notice"><Info size={15} /><span>AI is unavailable right now. These picks use our taste matching rules.</span></div>}
            {loading && !result ? <div className="dish-grid">{[1, 2, 3].map(id => <div className="skeleton-card" key={id}><div /><span /><span /><span /></div>)}</div> : result && result.recommendations.length > 0 ? <div className={`dish-grid ${loading ? 'refreshing' : ''}`}>{result.recommendations.map((rec, index) => <DishCard key={rec.dish.id} dish={rec.dish} recommendation={rec} rank={index + 1} saved={saved.includes(rec.dish.id)} onSave={save} onDetails={setSelected} />)}</div> : !loading && result && <div className="empty-state"><span><Sprout size={32} /></span><h3>No dish fits just yet.</h3><p>Your dietary and ingredient filters stay in place.<br />Try a higher budget or explore the full menu.</p><button className="secondary-button" onClick={() => openTab('menu')}>Explore the menu <ArrowRight size={16} /></button></div>}
            <div className="reassurance"><span className="reassurance-icon"><CheckCheck size={20} /></span><div><h3>Good choices, with a little peace of mind.</h3><p>Every match fits your selected budget, diet and ingredient filters.</p></div></div>
            <div className="menu-invitation"><div><span className="eyebrow">STILL FEELING CURIOUS?</span><p>There’s more goodness on the menu.</p></div><button className="text-button" onClick={() => openTab('menu')}>Explore all {menu.length || ''} dishes <ArrowRight size={16} /></button></div>
          </div>
        </section>
      </>}

      {tab === 'menu' && <section className="menu-page"><p className="eyebrow">SOMETHING FOR EVERY MOOD</p><div className="page-title"><div><h1>The whole <em>good menu.</em></h1><p>Bright bowls, comforting classics, and a little something sweet.</p></div><button aria-pressed={savedOnly} className={savedOnly ? 'secondary-button is-saved' : 'secondary-button'} onClick={() => setSavedOnly(!savedOnly)}><Heart size={16} /> Saved ({saved.length})</button></div><div className="category-tabs" aria-label="Menu category">{['any', ...categories].map(category => <button key={category} aria-pressed={menuCategory === category} className={menuCategory === category ? 'selected' : ''} onClick={() => setMenuCategory(category)}>{category === 'any' ? 'All dishes' : category}</button>)}</div>{catalogError ? <div role="alert" className="error-message">{catalogError}<button onClick={() => void loadCatalog()}>Try again</button></div> : <><p className="menu-count">{visibleMenu.length} {visibleMenu.length === 1 ? 'dish' : 'dishes'} · prices in JOD</p><div className="full-menu-grid">{visibleMenu.map(dish => <DishCard key={dish.id} dish={dish} saved={saved.includes(dish.id)} onSave={save} onDetails={setSelected} />)}</div>{!visibleMenu.length && <div className="empty-state"><Heart size={28} /><h3>{savedOnly ? 'Your favorites start here.' : 'No dishes in this category.'}</h3><p>{savedOnly ? 'Tap the heart on a dish to keep it close.' : 'Try another category.'}</p></div>}</>}</section>}

      {tab === 'how' && <section className="how-page"><p className="eyebrow">THOUGHTFUL BY DESIGN</p><h1>Your next favorite.<br /><em>In three little steps.</em></h1><p className="how-intro">Less menu scrolling. More “that’s exactly what I wanted.”</p><div className="how-grid">{[{ icon: <SlidersHorizontal />, title: 'Make it yours.', body: 'Set your budget per dish, choose your diet, and tell us which ingredients to avoid. These filters are always applied.' }, { icon: <Sprout />, title: 'Follow your cravings.', body: 'Pick the flavors you love or describe your mood. We rank the dishes that fit. Optional AI adds a more personal taste recommendation.' }, { icon: <UtensilsCrossed />, title: 'Meet your match.', body: 'Explore your top picks, see why they fit, and check every ingredient. Save a favorite for the next time you’re hungry.' }].map((step, index) => <article key={step.title}><span className="step-number">0{index + 1}</span><div className="step-icon">{step.icon}</div><h2>{step.title}</h2><p>{step.body}</p></article>)}</div><button className="primary-button" onClick={() => openTab('match')}>Find my matches <ArrowRight size={17} /></button></section>}
    </main>
    <footer className="site-footer"><div><span className="footer-brand">sufra.</span><span>A sample menu. A thoughtful little demo.</span></div><p>Sample recipes only. For food allergies, confirm ingredients and cross-contact with the restaurant.</p></footer>

    <dialog ref={dialog} className="dish-dialog" onClose={() => setSelected(null)} onClick={event => { if (event.target === event.currentTarget) setSelected(null); }} aria-labelledby="dish-dialog-title">{selected && <div className="dialog-content"><button className="dialog-close icon-button" aria-label="Close dish details" onClick={() => setSelected(null)}><X size={20} /></button><img src={selected.image} alt="" className="dialog-image" /><div className="dialog-body"><p className="eyebrow">{selected.category} · {formatJod(selected.priceFils)}</p><h2 id="dish-dialog-title">{selected.name}</h2><p>{selected.description}</p><div className="dish-facts"><span><Clock3 size={14} /> {selected.preparationMinutes} min</span><span>{selected.calories} kcal</span><span>{selected.proteinGrams}g protein</span></div><h3>What’s in it</h3><p className="ingredients">{selected.ingredients.join(' · ')}</p><h3>Diet & allergens</h3><p>{selected.vegan ? 'Vegan' : selected.vegetarian ? 'Vegetarian' : 'Contains animal ingredients'}</p><p className="allergen-note">{selected.allergens.length ? `Contains: ${selected.allergens.map(a => allergenLabels[a]).join(', ')}.` : 'None of the listed allergens in this sample recipe.'}</p><p className="tiny-note">Nutrition is illustrative. Food photos are representative. Confirm ingredients and cross-contact with the restaurant.</p><button className="secondary-button" onClick={() => save(selected.id)}><Heart size={16} fill={saved.includes(selected.id) ? 'currentColor' : 'none'} /> {saved.includes(selected.id) ? 'Saved to favorites' : 'Save this dish'}</button></div></div>}</dialog>
  </div>;
}

function DishCard({ dish, recommendation, rank, saved, onSave, onDetails }: { dish: Dish; recommendation?: Recommendation; rank?: number; saved: boolean; onSave: (id: string) => void; onDetails: (dish: Dish) => void }) {
  const tasteReason = recommendation?.reasons.find(reason => reason.startsWith('Matches')) ?? recommendation?.reasons.at(-1);
  return <article className="dish-card"><div className="dish-photo"><img src={dish.image} alt="" loading="lazy" style={{ objectPosition: dish.imagePosition }} />{rank && <span className={rank === 1 ? 'rank-badge first' : 'rank-badge'}>{rank === 1 ? <><Sparkles size={12} /> Your top pick</> : `0${rank} · A good match`}</span>}<button className={saved ? 'save-button saved' : 'save-button'} onClick={() => onSave(dish.id)} aria-label={`${saved ? 'Unsave' : 'Save'} ${dish.name}`} aria-pressed={saved}><Heart size={16} fill={saved ? 'currentColor' : 'none'} /></button></div><div className="dish-body"><div className="dish-category"><span>{dish.category}</span>{dish.vegan ? <span className="diet-badge"><Leaf size={10} />Vegan</span> : dish.vegetarian ? <span className="diet-badge"><Leaf size={10} />Vegetarian</span> : null}</div><h3>{dish.name}</h3><p className="dish-description">{dish.description}</p><div className="dish-facts"><span><Clock3 size={12} /> {dish.preparationMinutes} min</span><span>{dish.calories} kcal</span>{dish.flavors.includes('spicy') && <span><Flame size={12} /> Spicy</span>}</div>{recommendation && <div className="why-match"><span><CheckCheck size={14} /> WHY IT FITS</span><p>{tasteReason}</p>{recommendation.aiExplanation && <p className="ai-explanation"><Sparkles size={12} />{recommendation.aiExplanation}</p>}</div>}<div className="dish-bottom"><span className="dish-price">{formatJod(dish.priceFils).replace(' JOD', '')}<small> JOD</small></span><button onClick={() => onDetails(dish)} aria-label={`View ${dish.name} details`}>View dish <ArrowRight size={14} /></button></div></div></article>;
}
