// ---------------------------------------------------------------------------
// Glow — routine rule engine. Deterministic: recommendations are derived from
// the actual concern scores (ui_score: higher = healthier, so LOW score =
// concern worth addressing). No free-form AI text → no hallucinations.
// ---------------------------------------------------------------------------

export interface Routine {
  am: string[];
  pm: string[];
  weekly: string[];
  focus: string[];
}

const CONCERN_LABELS: Record<string, string> = {
  wrinkle: 'Wrinkles', droopy_upper_eyelid: 'Upper eyelids', droopy_lower_eyelid: 'Lower eyelids',
  firmness: 'Firmness', acne: 'Acne', moisture: 'Moisture', eye_bag: 'Eye bags',
  dark_circle_v2: 'Dark circles', age_spot: 'Age spots', radiance: 'Radiance',
  redness: 'Redness', oiliness: 'Oiliness', pore: 'Pores', texture: 'Texture',
};

/** Low ui_score = the concern is present/worth addressing. */
const CONCERN_THRESHOLD = 75;

export function generateRoutine(
  scores: Record<string, number>,
  fitzpatrick: string | null
): Routine {
  const concerns = Object.entries(scores)
    .filter(([, s]) => s < CONCERN_THRESHOLD)
    .sort((a, b) => a[1] - b[1]) // worst first
    .map(([k]) => k);

  const am: string[] = ['Gentle low-pH cleanser'];
  const pm: string[] = ['Oil-based cleanser', 'Water-based cleanser'];
  const weekly: string[] = [];
  const focus: string[] = concerns.map((c) => CONCERN_LABELS[c] ?? c);

  const has = (c: string) => concerns.includes(c);

  if (has('radiance') || has('texture')) am.push('Vitamin C serum (brightening)');
  if (has('moisture')) am.push('Hyaluronic acid serum (hydration)');
  am.push('Moisturizer');
  if (fitzpatrick && ['I', 'II', 'III'].includes(fitzpatrick)) {
    am.push('SPF 50+ (your Fitzpatrick type ' + fitzpatrick + ' burns easily — SPF is non-negotiable)');
  } else {
    am.push('SPF 30+ (daily protection, all skin types)');
  }

  if (has('pore') || has('oiliness') || has('acne')) {
    pm.push('Salicylic acid (BHA) 2–3×/week — targets ' + (CONCERN_LABELS[concerns.find((c) => ['pore','oiliness','acne'].includes(c))!] ?? 'congestion'));
    weekly.push('Salicylic acid (BHA) 2–3×/week');
  }
  if (has('wrinkle') || has('droopy_upper_eyelid') || has('droopy_lower_eyelid') || has('firmness')) {
    pm.push('Retinol (start 2–3×/week, build up) — targets ' + (CONCERN_LABELS[concerns.find((c) => ['wrinkle','droopy_upper_eyelid','droopy_lower_eyelid','firmness'].includes(c))!] ?? 'texture & firmness'));
    weekly.push('Retinol 2–3×/week (never same night as BHA)');
  }
  if (has('dark_circle_v2') || has('eye_bag')) pm.push('Caffeine eye cream (AM optional)');
  if (has('redness')) pm.push('Centella / azulene calming serum (redness)');
  if (has('age_spot')) {
    am.push('Niacinamide + vitamin C for age spots');
    weekly.push('Niacinamide serum daily for age spots');
  }
  if (has('acne')) pm.push('Benzoyl peroxide spot treatment (only on active spots)');
  if (has('moisture') || has('firmness')) pm.push('Ceramide-rich night moisturizer');

  pm.push('Night moisturizer');

  return { am, pm, weekly, focus };
}
