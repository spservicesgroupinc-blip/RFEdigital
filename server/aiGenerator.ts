import { GoogleGenAI, Type } from '@google/genai';
import type { GenerationMode, GenerationProvider, ProductCategory } from '../src/types/workspace';

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
      : `You are an award-winning children's book author and independent publisher. Write clean, publication-ready manuscript text or page-by-page spread copy for "${params.productTitle}" (${params.category}). Keep prose rhythmic, warm, and ready to typeset.`;

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

export async function generateStorybookIllustration(params: {
  prompt: string;
  stylePreset: string;
  provider: GenerationProvider;
  productTitle: string;
}): Promise<{ svgMarkup: string; caption: string; model: string }> {
  const systemInstruction = `You are a master editorial book illustrator. Create a rich, layered, publication-grade SVG illustration with viewBox="0 0 800 800" for "${params.productTitle}".
Style direction: ${params.stylePreset}.
Rules:
- Output ONLY valid standalone <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 800">...</svg> markup. No markdown fences, no commentary.
- Use rich layered backgrounds, gradients (<defs><linearGradient>/<radialGradient>), organic curved paths, atmospheric lighting, foreground framing foliage/architecture, and a clear central storybook focal subject.
- Do NOT include <script>, <foreignObject>, external image links, or inline event handlers.
- Do NOT include placeholder text or watermarks.`;

  if (params.provider === 'openrouter') {
    const result = await callOpenRouterText(systemInstruction, params.prompt);
    const svgMarkup = sanitizeSvgMarkup(result.text);
    return {
      svgMarkup,
      caption: params.prompt.slice(0, 180),
      model: result.model,
    };
  }

  const ai = getGeminiClient();
  const response = await ai.models.generateContent({
    model: 'gemini-4-hydrogen',
    contents: `Illustrate this page scene: ${params.prompt}`,
    config: {
      systemInstruction,
    },
  });

  const text = response.text?.trim() ?? '';
  const svgMarkup = sanitizeSvgMarkup(text);
  return {
    svgMarkup,
    caption: params.prompt.slice(0, 180),
    model: 'gemini-4-hydrogen',
  };
}
