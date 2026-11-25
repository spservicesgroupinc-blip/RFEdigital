import { GoogleGenAI, Type } from '@google/genai';
import type {
  GenerationMode,
  GenerationProvider,
  ProductCategory,
  ProductPromptPack,
} from '../src/types/workspace.js';
import { buildSceneVariationDirective } from '../src/lib/workspaceLogic.js';

/** Resolve the default AI provider from configured API keys. */
export function resolveDefaultProvider(): GenerationProvider {
  if (process.env.OPENROUTER_API_KEY?.trim()) return 'openrouter';
  if (process.env.GEMINI_API_KEY?.trim()) return 'gemini';
  return 'gemini';
}

function getGeminiClient(): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY?.trim();
  if (!apiKey) {
    throw new Error(
      'GEMINI_API_KEY is not configured on the server. Add your key in Settings > Secrets.'
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

async function callOpenRouterText(
  systemPrompt: string,
  userPrompt: string,
  model = 'openai/gpt-4o-mini'
): Promise<{ text: string; model: string }> {
  const apiKey = process.env.OPENROUTER_API_KEY?.trim();
  if (!apiKey) {
    throw new Error(
      'OPENROUTER_API_KEY is not set on the server. Add OPENROUTER_API_KEY in Settings > Secrets, or switch provider to Gemini 4 Hydrogen.'
    );
  }

  const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': process.env.APP_URL || 'http://localhost:3000',
      'X-Title': 'FolioPress Digital Product Workspace',
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
    }),
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => '');
    throw new Error(`OpenRouter request failed (${res.status}): ${errText.slice(0, 200)}`);
  }

  const data = (await res.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
    model?: string;
  };
  const content = data.choices?.[0]?.message?.content?.trim();
  if (!content) {
    throw new Error('OpenRouter returned an empty response.');
  }
  return { text: content, model: data.model || model };
}

export async function generatePublishingText(params: {
  prompt: string;
  mode: GenerationMode;
  provider: GenerationProvider;
  productTitle: string;
  category: ProductCategory;
  openRouterModel?: string;
}): Promise<{ text: string; model: string }> {
  const systemInstruction =
    params.mode === 'kdp-metadata'
      ? `You are a senior Amazon KDP publishing strategist. Write crisp, high-converting book descriptions, subtitle ideas, BISAC categories, and 7 backend keywords for "${params.productTitle}" (${params.category}). Use clean formatting without markdown code fences.`
      : `You are an award-winning children's book author and independent publisher. Write clean, publication-ready page-by-page story text for "${params.productTitle}" (${params.category}).
Format EVERY page clearly like this so each page pairs 1-to-1 with its illustration:
Page 1:
[1 to 3 vivid, rhythmic read-aloud sentences describing a clear visual moment]
Visual Note: [Specific setting, lighting, props, secondary characters, and exact character action/pose that the illustrator must draw]

Page 2:
...
Keep every page concrete, visual, and distinct so each illustration naturally matches its exact story text.`;

  if (params.provider === 'openrouter') {
    return callOpenRouterText(
      systemInstruction,
      params.prompt,
      params.openRouterModel || 'openai/gpt-4o-mini'
    );
  }

  const ai = getGeminiClient();
  const response = await ai.models.generateContent({
    model: 'gemini-4-hydrogen',
    contents: params.prompt,
    config: {
      systemInstruction,
    },
  });

  const text = response.text?.trim();
  if (!text) {
    throw new Error('Gemini returned an empty response.');
  }
  return { text, model: 'gemini-4-hydrogen' };
}

export interface GeneratedOutlineStep {
  title: string;
  stepType: 'manuscript' | 'illustration' | 'export';
  prompt: string;
}

export async function generateSeriesPlanSteps(params: {
  seriesName: string;
  productTitle: string;
  category: ProductCategory;
  brief: string;
  stepCount?: number;
}): Promise<{ steps: GeneratedOutlineStep[]; model: string }> {
  const ai = getGeminiClient();
  const targetCount = Math.min(Math.max(params.stepCount ?? 5, 3), 8);

  const response = await ai.models.generateContent({
    model: 'gemini-4-hydrogen',
    contents: `Create a ${targetCount}-step production plan for the digital product "${params.productTitle}" (Series: "${params.seriesName}", Category: ${params.category}). Brief: ${params.brief}. Include 1 manuscript step, ${targetCount - 2} illustration steps with rich visual art-direction prompts, and 1 final export step.`,
    config: {
      systemInstruction:
        'You are an editorial production planner for independent KDP picture books and art prints. Return concise, actionable production steps.',
      responseMimeType: 'application/json',
      responseSchema: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            title: { type: Type.STRING, description: 'Short step title (under 60 chars)' },
            stepType: {
              type: Type.STRING,
              description: 'One of: manuscript, illustration, export',
            },
            prompt: {
              type: Type.STRING,
              description: 'Detailed generation or assembly prompt for this step',
            },
          },
        },
      },
    },
  });

  const raw = (response.text ?? '[]').trim();
  const parsed = JSON.parse(raw) as Array<{
    title?: string;
    stepType?: string;
    prompt?: string;
  }>;

  const steps: GeneratedOutlineStep[] = parsed
    .filter((item) => item && typeof item.title === 'string' && typeof item.prompt === 'string')
    .map((item) => {
      const normalizedType =
        item.stepType === 'manuscript' ||
        item.stepType === 'illustration' ||
        item.stepType === 'export'
          ? item.stepType
          : 'illustration';
      return {
        title: item.title!.trim().slice(0, 80),
        stepType: normalizedType,
        prompt: item.prompt!.trim().slice(0, 800),
      };
    });

  if (steps.length === 0) {
    throw new Error('Could not parse structured steps from model response.');
  }

  return { steps, model: 'gemini-4-hydrogen' };
}

export async function generateProductPromptPackWithAI(params: {
  title: string;
  category: ProductCategory;
  trimSize: string;
  pageCount: number;
  concept: string;
  targetAudience: string;
  artStylePreset: string;
  fallbackPack: ProductPromptPack;
  marketContext?: string;
}): Promise<{
  promptPack: ProductPromptPack;
  usedAi: boolean;
  model: string;
}> {
  const systemPrompt = `You are a senior independent publishing art director and KDP/Etsy strategist.
Generate a complete, ready-to-edit prompt pack for turning a digital product concept into a finished product.
Return STRICT JSON ONLY (no markdown fences) with this exact schema:
{
  "manuscriptPrompt": "Detailed prompt to generate the story copy, front matter, or interior text",
  "kdpMetadataPrompt": "Detailed prompt to generate marketplace title/subtitle, description, categories, and 7 keywords",
  "coverPrompt": "Detailed, vivid front-cover illustration prompt with clean space at top for title typography and no garbled text",
  "interiorPrompts": [
    { "title": "Short page/spread title", "prompt": "Detailed scene/page illustration prompt matching consistent characters and art style" }
  ]
}
Include exactly 4 distinct, cohesive interiorPrompts tailored specifically to the product title, audience, and format.`;

  const userPrompt = `Product Title: ${params.title}
Category: ${params.category}
Trim Size: ${params.trimSize}" · Target Pages: ${params.pageCount}
Target Audience: ${params.targetAudience}
Art Style Preset: ${params.artStylePreset}
Concept / Brief: ${params.concept}
${params.marketContext ? `Market Research Context:\n${params.marketContext}` : ''}`;

  try {
    let rawText = '';
    let modelName = 'deterministic-fallback';

    if (process.env.OPENROUTER_API_KEY?.trim()) {
      const result = await callOpenRouterText(systemPrompt, userPrompt, 'openai/gpt-4o-mini');
      rawText = result.text;
      modelName = result.model;
    } else if (process.env.GEMINI_API_KEY?.trim()) {
      const ai = getGeminiClient();
      const response = await ai.models.generateContent({
        model: 'gemini-4-hydrogen',
        contents: userPrompt,
        config: {
          systemInstruction: systemPrompt,
          responseMimeType: 'application/json',
        },
      });
      rawText = (response.text ?? '').trim();
      modelName = 'gemini-4-hydrogen';
    } else {
      return { promptPack: params.fallbackPack, usedAi: false, model: 'template' };
    }

    const cleaned = rawText.replace(/^```(?:json)?\s*/i, '').replace(/```$/i, '').trim();
    const startIdx = cleaned.indexOf('{');
    const endIdx = cleaned.lastIndexOf('}');
    if (startIdx === -1 || endIdx <= startIdx) {
      return { promptPack: params.fallbackPack, usedAi: false, model: 'template' };
    }

    const parsed = JSON.parse(cleaned.slice(startIdx, endIdx + 1)) as {
      manuscriptPrompt?: string;
      kdpMetadataPrompt?: string;
      coverPrompt?: string;
      interiorPrompts?: Array<{ title?: string; prompt?: string }>;
    };

    const interiorList = Array.isArray(parsed.interiorPrompts)
      ? parsed.interiorPrompts
          .filter((p) => p && typeof p.prompt === 'string' && p.prompt.trim().length >= 8)
          .slice(0, 6)
          .map((p, idx) => ({
            id: `page-${idx + 1}`,
            title: String(p.title ?? `Page ${idx + 1}`).trim().slice(0, 90),
            prompt: p.prompt!.trim().slice(0, 1200),
          }))
      : [];

    const merged: ProductPromptPack = {
      ...params.fallbackPack,
      manuscriptPrompt:
        typeof parsed.manuscriptPrompt === 'string' && parsed.manuscriptPrompt.trim().length >= 15
          ? parsed.manuscriptPrompt.trim().slice(0, 1500)
          : params.fallbackPack.manuscriptPrompt,
      kdpMetadataPrompt:
        typeof parsed.kdpMetadataPrompt === 'string' && parsed.kdpMetadataPrompt.trim().length >= 15
          ? parsed.kdpMetadataPrompt.trim().slice(0, 1500)
          : params.fallbackPack.kdpMetadataPrompt,
      coverPrompt:
        typeof parsed.coverPrompt === 'string' && parsed.coverPrompt.trim().length >= 15
          ? parsed.coverPrompt.trim().slice(0, 1500)
          : params.fallbackPack.coverPrompt,
      interiorPrompts:
        interiorList.length >= 2 ? interiorList : params.fallbackPack.interiorPrompts,
      updatedAt: new Date().toISOString(),
    };

    return { promptPack: merged, usedAi: true, model: modelName };
  } catch {
    return { promptPack: params.fallbackPack, usedAi: false, model: 'template' };
  }
}

/**
 * Strips potentially unsafe script/event constructs from generated SVG markup.
 */
export function sanitizeSvgMarkup(rawSvg: string): string {
  const match = rawSvg.match(/<svg[\s\S]*?<\/svg>/i);
  if (!match) {
    throw new Error('Model response did not contain a valid <svg> illustration.');
  }
  let svg = match[0];
  svg = svg.replace(/<script[\s\S]*?<\/script>/gi, '');
  svg = svg.replace(/<foreignObject[\s\S]*?<\/foreignObject>/gi, '');
  svg = svg.replace(/\son[a-z]+\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi, '');
  svg = svg.replace(/javascript:/gi, '');
  if (!/xmlns\s*=/.test(svg)) {
    svg = svg.replace('<svg', '<svg xmlns="http://www.w3.org/2000/svg"');
  }
  return svg;
}

export interface GeneratedImageOutput {
  buffer: Buffer;
  mimeType: string;
  extension: '.png' | '.jpg' | '.webp' | '.svg';
  caption: string;
  model: string;
}

const MIME_TO_EXT: Record<string, '.png' | '.jpg' | '.webp'> = {
  'image/png': '.png',
  'image/jpeg': '.jpg',
  'image/jpg': '.jpg',
  'image/webp': '.webp',
};

function extractImageUrlFromOpenRouterMessage(message: unknown): string | null {
  if (!message || typeof message !== 'object') return null;
  const msg = message as Record<string, unknown>;

  // 1. Standard OpenRouter multimodal response: message.images = [{ type: 'image_url', image_url: { url } }]
  if (Array.isArray(msg.images)) {
    for (const item of msg.images) {
      if (typeof item === 'string' && (item.startsWith('data:image/') || item.startsWith('https://'))) {
        return item;
      }
      if (item && typeof item === 'object') {
        const rec = item as Record<string, unknown>;
        const nested = rec.image_url as Record<string, unknown> | undefined;
        if (typeof nested?.url === 'string') return nested.url;
        if (typeof rec.url === 'string') return rec.url;
      }
    }
  }

  // 2. Fallback: array content parts containing image_url
  if (Array.isArray(msg.content)) {
    for (const part of msg.content) {
      if (part && typeof part === 'object') {
        const rec = part as Record<string, unknown>;
        const nested = rec.image_url as Record<string, unknown> | undefined;
        if (typeof nested?.url === 'string') return nested.url;
      }
    }
  }

  // 3. Fallback: embedded data URI in string content
  if (typeof msg.content === 'string') {
    const match = msg.content.match(/data:image\/(?:png|jpeg|jpg|webp);base64,[A-Za-z0-9+/=]+/i);
    if (match) return match[0];
  }

  return null;
}

export async function generateOpenRouterRasterImage(params: {
  prompt: string;
  stylePreset: string;
  productTitle: string;
  referenceImageDataUrl?: string;
  openRouterModel?: string;
  sceneIndex?: number;
  totalScenes?: number;
  isCover?: boolean;
  storyText?: string;
  visualNote?: string;
}): Promise<GeneratedImageOutput> {
  const apiKey = process.env.OPENROUTER_API_KEY?.trim();
  if (!apiKey) {
    throw new Error(
      'OPENROUTER_API_KEY is not configured on the server. Add OPENROUTER_API_KEY in Settings > Secrets.'
    );
  }

  const model = params.openRouterModel?.trim() || 'google/gemini-2.5-flash-image';

  const hasReference = Boolean(
    params.referenceImageDataUrl && params.referenceImageDataUrl.startsWith('data:image/')
  );

  const variationLine =
    typeof params.sceneIndex === 'number'
      ? buildSceneVariationDirective(params.sceneIndex, params.totalScenes)
      : params.isCover
        ? 'Hero Front Cover composition: iconic centered storybook framing with clean open sky/soft background in the upper third for typography.'
        : 'Fresh dynamic storybook scene framing with rich environmental storytelling.';

  const cleanStory = (params.storyText ?? '').trim();
  const cleanVisual = (params.visualNote ?? '').trim();
  const storyGroundingBlock = cleanStory
    ? `EXACT STORY TEXT PRINTED ON THIS PAGE (YOUR ILLUSTRATION MUST FAITHFULLY DEPICT THIS EXACT MOMENT):
"${cleanStory}"${cleanVisual ? `\nAuthor Visual Direction: ${cleanVisual}` : ''}
`
    : cleanVisual
      ? `Author Visual Direction: ${cleanVisual}\n`
      : '';

  const instructionText = hasReference
    ? `Create a high-resolution, publication-ready illustration for the book/product "${params.productTitle}" using the uploaded photo strictly as a CHARACTER IDENTITY REFERENCE.
${storyGroundingBlock}Style Direction: ${params.stylePreset}
Scene & Action Prompt: ${params.prompt}
Camera & Page Framing: ${variationLine}

Critical Story-Matching & Multi-Page Consistency Rules:
1. STORY ACCURACY IS #1: ${
        cleanStory
          ? 'The illustration MUST directly depict every concrete detail in the EXACT STORY TEXT above — the exact setting/location, time of day, weather, secondary animals/characters, specific objects/colors/props, and the hero’s exact action and facial expression. Never contradict the story text.'
          : 'Faithfully depict every concrete setting, prop, action, and emotion described in the Scene Prompt above.'
      }
2. CHARACTER LIKENESS: Faithfully preserve the exact recognizable identity of the subject from the uploaded photo (same face, fur/hair colors, distinctive markings, ear shape, proportions, and personality) transformed seamlessly into the requested illustration style.
3. BRAND-NEW SCENE & POSE: Do NOT copy the original photo's background, lighting, or static pose. Place this same character into the completely new environment, active body pose, and camera angle matching this exact page's story.
4. ZERO EMBEDDED TEXT: Leave subtle breathing room near the bottom or top margin for book text typesetting. Render ZERO embedded text, ZERO words, ZERO letters, ZERO speech bubbles, ZERO watermarks, and no distorted anatomy.`
    : `Create a high-resolution, publication-ready illustration for the digital product "${params.productTitle}".
${storyGroundingBlock}Style Direction: ${params.stylePreset}
Scene Prompt: ${params.prompt}
Camera & Page Framing: ${variationLine}

Requirements:
- ${
        cleanStory
          ? 'STORY ACCURACY IS #1: Faithfully depict every concrete detail mentioned in the EXACT STORY TEXT above (exact location, time of day, weather, secondary characters/animals, props/colors, and character action/emotion). Never contradict the story text.'
          : 'Clean, polished framing suitable for a commercial illustrated book, coloring page, or printable wall art.'
      }
- Render ZERO embedded text, ZERO words, ZERO letters, ZERO speech bubbles, and ZERO watermarks inside the artwork (book typography is typeset cleanly separately).`;

  const userContent = hasReference
    ? [
        { type: 'image_url', image_url: { url: params.referenceImageDataUrl! } },
        { type: 'text', text: instructionText },
      ]
    : instructionText;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 58_000);

  try {
    const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      signal: controller.signal,
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': process.env.APP_URL || 'http://localhost:3000',
        'X-Title': 'FolioPress Digital Product Workspace',
      },
      body: JSON.stringify({
        model,
        modalities: ['image', 'text'],
        messages: [
          {
            role: 'user',
            content: userContent,
          },
        ],
      }),
    });

    if (!res.ok) {
      const errText = await res.text().catch(() => '');
      throw new Error(`OpenRouter image generation failed (${res.status}): ${errText.slice(0, 260)}`);
    }

    const data = (await res.json()) as {
      model?: string;
      choices?: Array<{ message?: Record<string, unknown> }>;
    };

    const message = data.choices?.[0]?.message;
    const imageUrl = extractImageUrlFromOpenRouterMessage(message);

    if (!imageUrl) {
      throw new Error(
        `OpenRouter model "${model}" returned text instead of an image. Choose an image-output model such as google/gemini-2.5-flash-image or openai/gpt-5-image-mini.`
      );
    }

    let buffer: Buffer;
    let mimeType = 'image/png';

    if (imageUrl.startsWith('data:image/')) {
      const match = imageUrl.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/);
      if (!match) {
        throw new Error('OpenRouter returned an invalid base64 image payload.');
      }
      mimeType = match[1].toLowerCase();
      buffer = Buffer.from(match[2], 'base64');
    } else if (imageUrl.startsWith('https://')) {
      const imgRes = await fetch(imageUrl, { signal: controller.signal });
      if (!imgRes.ok) {
        throw new Error(`Could not download generated image (${imgRes.status}).`);
      }
      mimeType = (imgRes.headers.get('content-type') || 'image/png').split(';')[0].trim().toLowerCase();
      buffer = Buffer.from(await imgRes.arrayBuffer());
    } else {
      throw new Error('Unsupported image format returned by OpenRouter.');
    }

    if (buffer.byteLength === 0) {
      throw new Error('OpenRouter returned an empty image.');
    }

    const extension = MIME_TO_EXT[mimeType] ?? '.png';
    return {
      buffer,
      mimeType: extension === '.jpg' ? 'image/jpeg' : extension === '.webp' ? 'image/webp' : 'image/png',
      extension,
      caption: params.prompt.slice(0, 180),
      model: data.model || model,
    };
  } finally {
    clearTimeout(timeout);
  }
}

export async function generateStorybookIllustration(params: {
  prompt: string;
  stylePreset: string;
  provider: GenerationProvider;
  productTitle: string;
  referenceImageDataUrl?: string;
  openRouterModel?: string;
  sceneIndex?: number;
  totalScenes?: number;
  isCover?: boolean;
  storyText?: string;
  visualNote?: string;
}): Promise<GeneratedImageOutput> {
  if (params.provider === 'openrouter') {
    return generateOpenRouterRasterImage({
      prompt: params.prompt,
      stylePreset: params.stylePreset,
      productTitle: params.productTitle,
      referenceImageDataUrl: params.referenceImageDataUrl,
      openRouterModel: params.openRouterModel,
      sceneIndex: params.sceneIndex,
      totalScenes: params.totalScenes,
      isCover: params.isCover,
      storyText: params.storyText,
      visualNote: params.visualNote,
    });
  }

  // Gemini vector fallback when user explicitly selects Gemini 4 Hydrogen (free text/SVG route)
  const variationLine =
    typeof params.sceneIndex === 'number'
      ? buildSceneVariationDirective(params.sceneIndex, params.totalScenes)
      : 'Distinct illustrated book scene framing.';
  const cleanStory = (params.storyText ?? '').trim();
  const cleanVisual = (params.visualNote ?? '').trim();
  const storyClause = cleanStory
    ? `\nExact story text on this page (depict every concrete setting, character, prop, and action faithfully): "${cleanStory}"${
        cleanVisual ? `\nVisual Note: ${cleanVisual}` : ''
      }`
    : '';
  const systemInstruction = `You are a master editorial book illustrator. Create a rich, layered, publication-grade SVG illustration with viewBox="0 0 800 800" for "${params.productTitle}".
Style direction: ${params.stylePreset}.
Framing: ${variationLine}${storyClause}
Rules:
- Output ONLY valid standalone <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 800">...</svg> markup. No markdown fences, no commentary.
- Use rich layered backgrounds, gradients (<defs><linearGradient>/<radialGradient>), organic curved paths, atmospheric lighting, foreground framing foliage/architecture, and a clear central storybook focal subject directly matching the story text.
- Do NOT include <script>, <foreignObject>, external image links, or inline event handlers.
- Do NOT include any text, letters, or watermarks.`;

  const ai = getGeminiClient();
  const hasReference = Boolean(
    params.referenceImageDataUrl && params.referenceImageDataUrl.startsWith('data:image/')
  );

  let contents: unknown = `Illustrate this page scene (${variationLine})${
    cleanStory ? ` matching story text "${cleanStory}"` : ''
  }: ${params.prompt}`;
  if (hasReference) {
    const match = params.referenceImageDataUrl!.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/);
    if (match) {
      contents = {
        parts: [
          { inlineData: { mimeType: match[1], data: match[2] } },
          {
            text: `Use the character/subject in this reference photo as the consistent hero, but place them in a brand-new dynamic pose and scene (${variationLine})${
              cleanStory ? ` faithfully depicting this exact page's story text: "${cleanStory}"` : ''
            }. Scene prompt: ${params.prompt}`,
          },
        ],
      };
    }
  }

  const response = await ai.models.generateContent({
    model: 'gemini-4-hydrogen',
    contents: contents as string,
    config: {
      systemInstruction,
    },
  });

  const text = response.text?.trim() ?? '';
  const svgMarkup = sanitizeSvgMarkup(text);
  return {
    buffer: Buffer.from(svgMarkup, 'utf-8'),
    mimeType: 'image/svg+xml',
    extension: '.svg',
    caption: params.prompt.slice(0, 180),
    model: 'gemini-4-hydrogen',
  };
}
