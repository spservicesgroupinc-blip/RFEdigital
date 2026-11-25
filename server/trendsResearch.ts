import crypto from 'node:crypto';
import { GoogleGenAI } from '@google/genai';
import type {
  GenerationProvider,
  TrendDeepDive,
  TrendMarketplace,
  TrendOpportunity,
  TrendProductType,
  TrendScanResult,
  TrendSourceLink,
  TrendTimeHorizon,
} from '../src/types/workspace';
import {
  dedupeSanitizedSources,
  extractJsonObjectFromText,
  normalizeTrendOpportunity,
  sanitizeSourceUrl,
} from '../src/lib/workspaceLogic';

const PRODUCT_TYPE_LABELS: Record<TrendProductType, string> = {
  'childrens-book': "Children's Picture Books",
  'coloring-book': 'Coloring & Activity Books',
  'wall-art': 'Printable Wall Art & Stickers',
  flashcards: 'Flashcards & Educational Worksheets',
  'ebook-planner': 'Planners, Journals & Niche Ebooks',
};

function getGeminiClient(): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY?.trim();
  if (!apiKey) {
    throw new Error(
      'GEMINI_API_KEY is not configured on the server. Add GEMINI_API_KEY or OPENROUTER_API_KEY in Settings > Secrets.'
    );
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

function getDateContext(): { todayIso: string; windowStartIso: string; windowEndIso: string } {
  const now = new Date();
  const plus60 = new Date(now.getTime() + 60 * 24 * 60 * 60 * 1000);
  const plus90 = new Date(now.getTime() + 90 * 24 * 60 * 60 * 1000);
  return {
    todayIso: now.toISOString().slice(0, 10),
    windowStartIso: plus60.toISOString().slice(0, 10),
    windowEndIso: plus90.toISOString().slice(0, 10),
  };
}

interface RawWebResearchOutput {
  rawText: string;
  model: string;
  groundingSources: TrendSourceLink[];
}

async function runOpenRouterWebSearch(
  systemPrompt: string,
  userPrompt: string,
  model = 'openai/gpt-4o-mini'
): Promise<RawWebResearchOutput> {
  const apiKey = process.env.OPENROUTER_API_KEY?.trim();
  if (!apiKey) {
    throw new Error(
      'OPENROUTER_API_KEY is not configured on the server. Add OPENROUTER_API_KEY in Settings > Secrets, or switch search engine to Gemini Live Web Search.'
    );
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 55_000);

  try {
    const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      signal: controller.signal,
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': process.env.APP_URL || 'http://localhost:3000',
        'X-Title': 'FolioPress Trends Research',
      },
      body: JSON.stringify({
        model,
        temperature: 0.25,
        tools: [
          {
            type: 'openrouter:web_search',
            parameters: {
              max_results: 6,
              max_total_results: 18,
              search_context_size: 'high',
            },
          },
        ],
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
      }),
    });

    if (!res.ok) {
      const errText = await res.text().catch(() => '');
      throw new Error(`OpenRouter live web search failed (${res.status}): ${errText.slice(0, 240)}`);
    }

    const data = (await res.json()) as {
      model?: string;
      choices?: Array<{
        message?: {
          content?: string;
          annotations?: Array<{
            type?: string;
            url_citation?: { url?: string; title?: string };
          }>;
        };
      }>;
    };

    const msg = data.choices?.[0]?.message;
    const content = msg?.content?.trim();
    if (!content) {
      throw new Error('OpenRouter live web search returned an empty response.');
    }

    const groundingSources: TrendSourceLink[] = [];
    for (const ann of msg?.annotations ?? []) {
      const citation = ann?.url_citation;
      if (citation?.url) {
        const safe = sanitizeSourceUrl(citation.url);
        if (safe) {
          groundingSources.push({
            title: (citation.title || '').trim() || new URL(safe).hostname,
            url: safe,
          });
        }
      }
    }

    return {
      rawText: content,
      model: data.model || model,
      groundingSources,
    };
  } finally {
    clearTimeout(timeout);
  }
}

async function runGeminiLiveWebSearch(
  systemPrompt: string,
  userPrompt: string
): Promise<RawWebResearchOutput> {
  const ai = getGeminiClient();
  const response = await ai.models.generateContent({
    model: 'gemini-4-hydrogen',
    contents: userPrompt,
    config: {
      systemInstruction: systemPrompt,
      temperature: 0.25,
      tools: [{ googleSearch: {} }],
    },
  });

  const rawText = response.text?.trim();
  if (!rawText) {
    throw new Error('Gemini live web search returned an empty response.');
  }

  const groundingSources: TrendSourceLink[] = [];
  const chunks =
    (
      response.candidates?.[0] as
        | {
            groundingMetadata?: {
              groundingChunks?: Array<{ web?: { uri?: string; title?: string } }>;
            };
          }
        | undefined
    )?.groundingMetadata?.groundingChunks ?? [];

  for (const chunk of chunks) {
    const uri = chunk?.web?.uri;
    if (!uri) continue;
    const safe = sanitizeSourceUrl(uri);
    if (safe) {
      groundingSources.push({
        title: (chunk.web?.title || '').trim() || new URL(safe).hostname,
        url: safe,
      });
    }
  }

  return {
    rawText,
    model: 'gemini-4-hydrogen',
    groundingSources,
  };
}

function buildScanSystemPrompt(todayIso: string, windowStartIso: string, windowEndIso: string): string {
  return `You are a rigorous digital publishing & print-on-demand market researcher conducting LIVE web research on ${todayIso}.
Your job is to identify specific, profitable micro-niches for independent creators selling books and digital products on Amazon KDP, Etsy, Teachers Pay Teachers (TpT), and Gumroad.

DATE & SEASONAL CONTEXT:
- Today's exact ISO date is ${todayIso}.
- Upcoming 60-90 day seasonal buying window is roughly ${windowStartIso} through ${windowEndIso}.
- Prioritize what is demonstrably selling RIGHT NOW or ramping up for that 60-90 day window.

STRICT HONESTY & EVIDENCE RULES (NON-NEGOTIABLE):
1. NEVER invent Best Sellers Ranks (BSR), review counts, star ratings, unit sales, or revenue numbers.
2. Clearly separate OBSERVED LIVE SIGNALS found in your web searches (e.g., actual Amazon BSR ranges cited in results, Etsy "Bestseller" / "Star Seller" tags, visible review volume/recency, observed listing price ranges, BookTok / Pinterest / TikTok trend spikes, TpT featured trending topics) from ESTIMATED DEMAND / SALES VELOCITY.
3. Every estimated velocity statement MUST explicitly be labeled as an estimate (starting with "Est.").
4. Include clickable https:// source URLs from your live search results for every opportunity card.
5. Be hyper-specific (micro-niches like "Bold & Easy Cozy Hygge Bakery Coloring Books" or "Montessori Watercolor Calm-Corner Emotion Flashcards", NEVER generic categories like "Children's Books").

OUTPUT FORMAT:
Return ONLY valid JSON (no markdown commentary outside the JSON object) matching this exact schema:
{
  "researched_at": "${todayIso}",
  "market_summary": "2-3 sentence evidence-backed overview of what is moving right now",
  "opportunities": [
    {
      "title": "Specific micro-niche name (not generic)",
      "product_type": "childrens-book | coloring-book | wall-art | flashcards | ebook-planner",
      "marketplaces": ["Amazon KDP", "Etsy"],
      "opportunity_score": 85,
      "demand_level": "High | Medium | Emerging",
      "competition_level": "Low | Medium | High",
      "price_range_usd": "$7.99 - $14.99",
      "sales_evidence": {
        "observed_signals": ["Concrete observed signal from live search results"],
        "estimated_velocity": "Est. 150-350 units/mo for top-10 listings based on observed marketplace demand signals",
        "confidence": "High | Medium | Low"
      },
      "seasonality": "Evergreen | Seasonal (specify exact peak window)",
      "buyer_pain_points": ["Concrete complaint or unmet expectation buyers mention"],
      "winning_angle": "Specific differentiation gap our studio can win with",
      "starter_blueprint": {
        "target_age_or_audience": "e.g., Ages 4-7 or Busy Preschool Teachers",
        "suggested_trim_size": "e.g., 8.5x8.5 or 8.5x11 or 8x10 or 6x9",
        "suggested_page_count": 24,
        "art_style_direction": "Concrete illustration/design direction",
        "hook_concept": "One-sentence product hook that stands out in search results",
        "seed_keywords": ["keyword 1", "keyword 2", "keyword 3", "keyword 4", "keyword 5"]
      },
      "sources": [
        { "title": "Source page title", "url": "https://..." }
      ]
    }
  ]
}`;
}

function buildDeepDiveSystemPrompt(todayIso: string): string {
  return `You are a senior digital publishing & marketplace competitive analyst conducting a focused LIVE web deep-dive on ${todayIso}.

STRICT HONESTY & EVIDENCE RULES:
1. NEVER fabricate BSRs, exact review counts, or revenue figures. Report only real observed prices, tags, review themes, and competing listings found in your live searches.
2. If a specific figure is not visible in search results, state that clearly instead of guessing.
3. Include real clickable https:// source URLs from your live web search results.

OUTPUT FORMAT:
Return ONLY valid JSON matching this exact schema:
{
  "researched_at": "${todayIso}",
  "summary": "2-3 sentence competitive landscape synthesis for this micro-niche",
  "top_competing_listings": [
    {
      "title": "Observed competing product or listing title",
      "marketplace": "Amazon KDP | Etsy | Teachers Pay Teachers | Gumroad",
      "observed_price": "$9.99",
      "observed_signal": "Observed badge, review count/rating, BSR mention, or ranking proof from search",
      "url": "https://..."
    }
  ],
  "price_ladder": {
    "entry_tier": "$4.99 - $6.99 (digital printable / basic paperback)",
    "mid_tier": "$7.99 - $11.99 (standard KDP paperback or curated bundle)",
    "premium_tier": "$12.99 - $19.99 (deluxe bundle, hardcover, or commercial license)",
    "recommended_price": "$8.99 paperback / $6.99 printable PDF"
  },
  "recurring_buyer_complaints": [
    "Specific complaint from buyer reviews or Q&A (e.g., marker bleed-through, thin paper, repetitive pages)"
  ],
  "high_intent_keywords": [
    "exact buyer search phrase 1",
    "exact buyer search phrase 2"
  ],
  "differentiation_angle": "Concrete, actionable product strategy to outperform current listings",
  "sources": [
    { "title": "Source page title", "url": "https://..." }
  ]
}`;
}

export async function runLiveTrendMarketScan(params: {
  marketplaces: TrendMarketplace[];
  productTypes: TrendProductType[];
  timeHorizon: TrendTimeHorizon;
  customTopic: string;
  provider: GenerationProvider;
  openRouterModel?: string;
}): Promise<TrendScanResult> {
  const { todayIso, windowStartIso, windowEndIso } = getDateContext();
  const systemPrompt = buildScanSystemPrompt(todayIso, windowStartIso, windowEndIso);

  const horizonDesc =
    params.timeHorizon === 'upcoming_seasonal'
      ? `UPCOMING 60-90 DAY SEASONAL DEMAND (${windowStartIso} to ${windowEndIso}): identify niches creators should publish right now to catch the upcoming seasonal wave.`
      : `SELLING RIGHT NOW (as of ${todayIso}): identify micro-niches showing active current bestseller momentum, viral BookTok/Pinterest/Etsy demand, and steady buyer conversions today.`;

  const productLabels = params.productTypes.map((t) => `${PRODUCT_TYPE_LABELS[t]} (${t})`).join(', ');
  const topicLine = params.customTopic.trim()
    ? `Custom Topic / Audience Focus: "${params.customTopic.trim()}"`
    : 'Custom Topic / Audience Focus: Open across selected categories — prioritize underserved high-buyer-intent niches.';

  const userPrompt = `Perform multiple targeted live web searches for current bestsellers, trending Etsy/TpT/Gumroad digital products, and Amazon KDP niche opportunities.

Target Marketplaces: ${params.marketplaces.join(', ')}
Target Product Types: ${productLabels}
Time Horizon: ${horizonDesc}
${topicLine}

Return 6 to 8 ranked micro-niche opportunities (sorted highest opportunity_score first) in strict JSON matching the schema. Ensure every opportunity cites real observed live signals, clearly labels estimated_velocity as an estimate, and includes clickable source URLs.`;

  const research =
    params.provider === 'openrouter'
      ? await runOpenRouterWebSearch(systemPrompt, userPrompt, params.openRouterModel)
      : await runGeminiLiveWebSearch(systemPrompt, userPrompt);

  const parsed = extractJsonObjectFromText(research.rawText);
  const rawOpportunities = Array.isArray(parsed.opportunities) ? parsed.opportunities : [];

  const normalizedOpportunities: TrendOpportunity[] = [];
  rawOpportunities.forEach((item, idx) => {
    // Distribute verified grounding sources as fallbacks if an item omits valid URLs
    const sliceStart =
      research.groundingSources.length > 0 ? (idx * 2) % research.groundingSources.length : 0;
    const rotatedFallbacks = [
      ...research.groundingSources.slice(sliceStart),
      ...research.groundingSources.slice(0, sliceStart),
    ];
    const normalized = normalizeTrendOpportunity(item, rotatedFallbacks, idx);
    if (normalized) {
      // Also enrich cards with 1-2 verified grounding URLs if the card had none
      if (normalized.sources.length === 0 && research.groundingSources.length > 0) {
        normalized.sources = dedupeSanitizedSources([], research.groundingSources);
      }
      normalizedOpportunities.push(normalized);
    }
  });

  if (normalizedOpportunities.length === 0) {
    throw new Error('Live market scan returned no structured opportunities. Please try again.');
  }

  normalizedOpportunities.sort((a, b) => b.opportunity_score - a.opportunity_score);

  return {
    id: `scan-${crypto.randomUUID().slice(0, 8)}`,
    researched_at: new Date().toISOString(),
    provider: params.provider,
    model: research.model,
    query: {
      marketplaces: params.marketplaces,
      productTypes: params.productTypes,
      timeHorizon: params.timeHorizon,
      customTopic: params.customTopic.trim(),
      provider: params.provider,
    },
    market_summary:
      String(parsed.market_summary ?? '').trim().slice(0, 800) ||
      `Live web market scan completed across ${params.marketplaces.join(', ')} on ${todayIso}.`,
    opportunities: normalizedOpportunities.slice(0, 8),
  };
}

export async function runLiveTrendDeepDive(params: {
  opportunity: TrendOpportunity;
  provider: GenerationProvider;
  openRouterModel?: string;
}): Promise<TrendDeepDive> {
  const { todayIso } = getDateContext();
  const systemPrompt = buildDeepDiveSystemPrompt(todayIso);

  const userPrompt = `Perform a focused live competitive deep-dive on this digital product micro-niche:

Niche Title: ${params.opportunity.title}
Product Type: ${params.opportunity.product_type}
Target Marketplaces: ${params.opportunity.marketplaces.join(', ')}
Observed Price Range: ${params.opportunity.price_range_usd}
Target Audience: ${params.opportunity.starter_blueprint.target_age_or_audience}
Seed Keywords: ${params.opportunity.starter_blueprint.seed_keywords.join(', ')}

Search live marketplace listings, reviews, buyer Q&A, and search suggestions to return:
1. 3 to 5 real competing listings with observed prices, observable proof signals, and clickable URLs.
2. Exact price ladder (entry, mid, premium, and recommended launch price).
3. 4 to 6 recurring buyer complaints found in reviews or buyer discussions.
4. 6 to 10 high-intent buyer search keywords.
5. A concrete differentiation angle our studio should execute to win this niche.

Return strict JSON only.`;

  const research =
    params.provider === 'openrouter'
      ? await runOpenRouterWebSearch(systemPrompt, userPrompt, params.openRouterModel)
      : await runGeminiLiveWebSearch(systemPrompt, userPrompt);

  const parsed = extractJsonObjectFromText(research.rawText);

  const rawListings = Array.isArray(parsed.top_competing_listings)
    ? parsed.top_competing_listings
    : [];

  const top_competing_listings = rawListings
    .filter((item): item is Record<string, unknown> => Boolean(item && typeof item === 'object'))
    .slice(0, 6)
    .map((item) => ({
      title: String(item.title ?? 'Competing Listing').trim().slice(0, 140),
      marketplace: String(item.marketplace ?? params.opportunity.marketplaces[0] ?? 'Amazon KDP')
        .trim()
        .slice(0, 40),
      observed_price: String(item.observed_price ?? 'Not listed').trim().slice(0, 40),
      observed_signal: String(item.observed_signal ?? 'Active listing in live search results')
        .trim()
        .slice(0, 220),
      url: sanitizeSourceUrl(String(item.url ?? '')) || research.groundingSources[0]?.url || '',
    }));

  const ladderObj = (
    parsed.price_ladder && typeof parsed.price_ladder === 'object' ? parsed.price_ladder : {}
  ) as Record<string, unknown>;

  const normalizeList = (val: unknown, max: number) =>
    Array.isArray(val)
      ? val
          .map((v) => (typeof v === 'string' ? v.trim() : ''))
          .filter(Boolean)
          .slice(0, max)
      : [];

  return {
    researched_at: new Date().toISOString(),
    provider: params.provider,
    model: research.model,
    summary:
      String(parsed.summary ?? '').trim().slice(0, 700) ||
      `Focused competitive deep-dive completed for "${params.opportunity.title}" on ${todayIso}.`,
    top_competing_listings,
    price_ladder: {
      entry_tier: String(ladderObj.entry_tier ?? '$4.99 - $6.99').trim().slice(0, 120),
      mid_tier: String(ladderObj.mid_tier ?? '$7.99 - $12.99').trim().slice(0, 120),
      premium_tier: String(ladderObj.premium_tier ?? '$13.99 - $19.99').trim().slice(0, 120),
      recommended_price: String(
        ladderObj.recommended_price ?? params.opportunity.price_range_usd
      )
        .trim()
        .slice(0, 120),
    },
    recurring_buyer_complaints: normalizeList(parsed.recurring_buyer_complaints, 8),
    high_intent_keywords: normalizeList(parsed.high_intent_keywords, 12),
    differentiation_angle: String(
      parsed.differentiation_angle ?? params.opportunity.winning_angle
    )
      .trim()
      .slice(0, 600),
    sources: dedupeSanitizedSources(parsed.sources, research.groundingSources),
  };
}
