import { GoogleGenerativeAI } from '@google/generative-ai';

const defaultConfig = {
  model: 'gemini-2.5-flash',
  analysisFocus:
    'Assess the transaction for fraud risk considering velocity, geography, amount, device reputation, and payment method patterns.',
  blockThreshold: 80,
  flagThreshold: 55,
  fallbackAction: 'FLAG',
  temperature: 0.2,
  topP: 0.8,
  maxOutputTokens: 512,
  cooldownMsOn429: 60_000,
};

let genAIInstance = null;
const modelCache = new Map();
let cooldownUntil = 0;

function clampScore(value) {
  if (typeof value !== 'number' || Number.isNaN(value)) return null;
  return Math.max(0, Math.min(100, Math.round(value)));
}

function extractJsonPayload(text) {
  if (!text) return null;
  const cleaned = text.trim();

  try {
    return JSON.parse(cleaned);
  } catch (error) {
    const codeBlockMatch = cleaned.match(/```json\s*([\s\S]*?)```/i);
    if (codeBlockMatch) {
      try {
        return JSON.parse(codeBlockMatch[1]);
      } catch (inner) {
        return null;
      }
    }

    const braceMatch = cleaned.match(/\{[\s\S]*\}/);
    if (braceMatch) {
      try {
        return JSON.parse(braceMatch[0]);
      } catch (inner) {
        return null;
      }
    }

    return null;
  }
}

function normalizeStatus(verdict, score, thresholds) {
  if (verdict) {
    const normalized = verdict.toString().toUpperCase();
    if (['BLOCK', 'DECLINE', 'REJECT'].includes(normalized)) return 'BLOCK';
    if (['FLAG', 'REVIEW', 'INVESTIGATE', 'ESCALATE'].includes(normalized)) return 'FLAG';
    if (['APPROVE', 'ALLOW', 'PASS', 'CONTINUE'].includes(normalized)) return 'CONTINUE';
  }

  if (typeof score === 'number') {
    if (score >= thresholds.blockThreshold) return 'BLOCK';
    if (score >= thresholds.flagThreshold) return 'FLAG';
  }

  return 'CONTINUE';
}

function buildPrompt(transaction, config) {
  return [
    'You are an expert fraud detection analyst for a payments company.',
    'Evaluate the transaction data provided below and respond ONLY with a strict JSON object using this schema (no markdown, no narrative):',
    '{',
    '  "score": <number from 0-100 representing fraud risk>,',
    '  "verdict": "APPROVE" | "FLAG" | "BLOCK",',
    '  "reason": <succinct explanation>,',
    '  "signals": [<list of salient factors contributing to the assessment>]',
    '}',
    'Guidelines:',
    '- Score 0 means no fraud risk, 100 means certain fraud.',
    '- Use BLOCK only for very high-confidence fraud, FLAG when a human review is advisable.',
    '- Always include at least one signal referencing the provided values.',
    config.analysisFocus ? `Focus area: ${config.analysisFocus}` : null,
    '',
    'Transaction JSON:',
    JSON.stringify(transaction ?? {}, null, 2),
  ]
    .filter(Boolean)
    .join('\n');
}

async function resolveModel(config, services) {
  if (services?.geminiModel) {
    return services.geminiModel;
  }

  if (typeof services?.getGeminiModel === 'function') {
    const resolved = await services.getGeminiModel(config.model, config);
    if (resolved) return resolved;
  }

  if (!process.env.GEMINI_API_KEY) {
    throw new Error('GEMINI_API_KEY is not configured');
  }

  if (!genAIInstance) {
    genAIInstance = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
  }

  if (!modelCache.has(config.model)) {
    const model = genAIInstance.getGenerativeModel({
      model: config.model,
      generationConfig: {
        temperature: config.temperature,
        topP: config.topP,
        maxOutputTokens: config.maxOutputTokens,
      },
    });
    modelCache.set(config.model, model);
  }

  return modelCache.get(config.model);
}

export default async function geminiCheck({ transaction, config = {}, services = {} }) {
  const mergedConfig = { ...defaultConfig, ...config };
  const now = Date.now();
  if (cooldownUntil > now) {
    const remainingMs = cooldownUntil - now;
    services.metrics?.increment?.('geminiCooldownSkip');
    return {
      status: mergedConfig.fallbackAction?.toUpperCase() === 'CONTINUE' ? 'CONTINUE' : 'FLAG',
      reason: `Gemini AI check skipped due to rate limiting. Retry in ${Math.ceil(
        remainingMs / 1000,
      )}s`,
      severity: 'medium',
      metadata: {
        aiError: true,
        model: mergedConfig.model,
        retryAfterMs: remainingMs,
      },
    };
  }

  if (!transaction) {
    return {
      status: 'CONTINUE',
      reason: 'No transaction payload provided to Gemini check.',
      metadata: {
        aiError: true,
        model: mergedConfig.model,
      },
    };
  }

  try {
    const model = await resolveModel(mergedConfig, services);
    const prompt = buildPrompt(transaction, mergedConfig);
    const result = await model.generateContent(prompt);
    const response = await result.response;

    let text = typeof response.text === 'function' ? response.text() : undefined;

    if (!text && Array.isArray(response.candidates)) {
      const candidateText = response.candidates
        .flatMap((candidate) => candidate.content?.parts ?? [])
        .map((part) => part.text || '')
        .filter(Boolean)
        .join('\n');
      text = candidateText || text;
    }

    const parsed = extractJsonPayload(text);
    if (!parsed) {
      throw new Error('Gemini response did not contain valid JSON payload.');
    }

    const score = clampScore(parsed.score);
    const status = normalizeStatus(parsed.verdict, score, mergedConfig);
    const signals = Array.isArray(parsed.signals) ? parsed.signals : [];

    if (typeof score === 'number') {
      services.metrics?.recordRisk(score);
    }

    const counterKey =
      status === 'BLOCK' ? 'geminiBlock' : status === 'FLAG' ? 'geminiFlag' : 'geminiPass';
    services.metrics?.increment?.(counterKey);

    return {
      status,
      reason:
        parsed.reason ||
        `Gemini AI suggests ${status.toLowerCase()} with score ${score ?? 'N/A'}.`,
      severity: status === 'BLOCK' ? 'high' : status === 'FLAG' ? 'medium' : 'low',
      metadata: {
        aiScore: score,
        aiVerdict: parsed.verdict ?? status,
        aiSignals: signals,
        model: mergedConfig.model,
        promptVersion: 'gemini-check:v1',
        rawResponse: text,
      },
    };
  } catch (error) {
    console.warn('[GeminiCheck] Falling back due to error:', error.message);
    services.metrics?.increment?.('geminiError');

    const message = error?.message || '';
    const retryMatch = message.match(/retry in\s+([0-9.]+)s/i);
    const retryAfterMs = retryMatch ? Math.ceil(Number(retryMatch[1]) * 1000) : 0;
    const isRateLimited = error?.status === 429 || /quota/i.test(message) || retryMatch;

    if (isRateLimited) {
      const cooldownMs = retryAfterMs || mergedConfig.cooldownMsOn429 || 60_000;
      cooldownUntil = Date.now() + cooldownMs;
      services.logger?.warn?.(
        `[GeminiCheck] Entering cooldown for ${Math.ceil(cooldownMs / 1000)}s due to rate limit.`,
      );
    }

    const fallbackStatus =
      mergedConfig.fallbackAction && mergedConfig.fallbackAction.toUpperCase() === 'CONTINUE'
        ? 'CONTINUE'
        : 'FLAG';

    return {
      status: fallbackStatus,
      reason: `Gemini AI check unavailable: ${error.message}`,
      severity: 'medium',
      metadata: {
        aiError: true,
        model: mergedConfig.model,
        retryAfterMs: cooldownUntil > Date.now() ? cooldownUntil - Date.now() : undefined,
      },
    };
  }
}

export function __resetGeminiState() {
  cooldownUntil = 0;
}
