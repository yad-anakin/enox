const OpenAI = require('openai');
const { GoogleGenAI } = require('@google/genai');

// Provider configurations — trailing slashes matter for Google
const PROVIDER_CONFIGS = {
  openai: {
    baseURL: 'https://api.openai.com/v1',
  },
  anthropic: {
    baseURL: 'https://api.anthropic.com/v1',
  },
  google: {
    baseURL: 'https://generativelanguage.googleapis.com/v1beta/openai/',
  },
  mistral: {
    baseURL: 'https://api.mistral.ai/v1',
  },
  groq: {
    baseURL: 'https://api.groq.com/openai/v1',
  },
  openrouter: {
    baseURL: 'https://openrouter.ai/api/v1',
  },
};

// Cache clients to reuse TCP connections (avoids TLS handshake per request)
const clientCache = new Map();
const googleClientCache = new Map();

function createAIClient(provider, apiKey) {
  const config = PROVIDER_CONFIGS[provider];
  if (!config) throw new Error(`Unsupported provider: ${provider}`);

  const cacheKey = `${provider}:${apiKey}`;
  let client = clientCache.get(cacheKey);
  if (!client) {
    client = new OpenAI({
      apiKey,
      baseURL: config.baseURL,
      timeout: 20000,
      maxRetries: 0,
    });
    clientCache.set(cacheKey, client);
  }
  return client;
}

function createGoogleClient(apiKey) {
  let client = googleClientCache.get(apiKey);
  if (!client) {
    client = new GoogleGenAI({ apiKey });
    googleClientCache.set(apiKey, client);
  }
  return client;
}

// ── Native Gemini streaming via @google/genai — supports thinking tokens ──
async function* streamGeminiNative(apiKey, modelId, messages, maxTokens, temperature, topP) {
  const ai = createGoogleClient(apiKey);
  const t0 = Date.now();

  // Extract system instruction from messages (OpenAI format → Gemini format)
  const systemMsg = messages.find(m => m.role === 'system');
  const chatMessages = messages.filter(m => m.role !== 'system');

  // Convert OpenAI message format → Gemini native format
  const contents = chatMessages.map(m => ({
    role: m.role === 'assistant' ? 'model' : 'user',
    parts: [{ text: m.content }],
  }));

  const response = await ai.models.generateContentStream({
    model: modelId,
    contents,
    config: {
      maxOutputTokens: maxTokens,
      temperature,
      topP,
      ...(systemMsg ? { systemInstruction: systemMsg.content } : {}),
      thinkingConfig: { includeThoughts: true },
    },
  });
  console.log(`[ai] gemini-native stream-open ${modelId}: ${Date.now() - t0}ms`);

  let first = true;
  for await (const chunk of response) {
    const parts = chunk.candidates?.[0]?.content?.parts || [];
    for (const part of parts) {
      if (!part.text) continue;
      if (first) { console.log(`[ai] gemini-native first-token ${modelId}: ${Date.now() - t0}ms`); first = false; }
      if (part.thought) {
        yield { type: 'thinking', content: part.text };
      } else {
        yield { type: 'text', content: part.text };
      }
    }
  }
  console.log(`[ai] gemini-native stream-done ${modelId}: ${Date.now() - t0}ms`);
}

async function* streamChatCompletion(provider, apiKey, modelId, messages, maxTokens = 4096, temperature = 0.7, topP = 0.95) {
  // Use native Google SDK for Gemini — true token-by-token streaming
  // The OpenAI-compatible wrapper buffers the entire response (~8s) before fake-streaming
  if (provider === 'google') {
    yield* streamGeminiNative(apiKey, modelId, messages, maxTokens, temperature, topP);
    return;
  }

  // All other providers use OpenAI-compatible SDK
  const client = createAIClient(provider, apiKey);
  const t0 = Date.now();

  const params = {
    model: modelId,
    messages,
    stream: true,
    max_tokens: maxTokens,
    temperature,
    top_p: topP,
  };

  const stream = await client.chat.completions.create(params);
  console.log(`[ai] stream-open ${provider}/${modelId}: ${Date.now() - t0}ms`);

  let first = true;
  for await (const chunk of stream) {
    const content = chunk.choices?.[0]?.delta?.content;
    if (content) {
      if (first) { console.log(`[ai] first-token ${provider}/${modelId}: ${Date.now() - t0}ms`); first = false; }
      yield content;
    }
  }
  console.log(`[ai] stream-done ${provider}/${modelId}: ${Date.now() - t0}ms`);
}

async function chatCompletion(provider, apiKey, modelId, messages, maxTokens = 4096) {
  // Use native Google SDK for non-streaming Gemini too
  if (provider === 'google') {
    const ai = createGoogleClient(apiKey);
    const systemMsg = messages.find(m => m.role === 'system');
    const chatMessages = messages.filter(m => m.role !== 'system');
    const contents = chatMessages.map(m => ({
      role: m.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: m.content }],
    }));
    const result = await ai.models.generateContent({
      model: modelId,
      contents,
      config: {
        maxOutputTokens: maxTokens,
        ...(systemMsg ? { systemInstruction: systemMsg.content } : {}),
      },
    });
    return result.candidates?.[0]?.content?.parts?.map(p => p.text).join('') || '';
  }

  const client = createAIClient(provider, apiKey);

  const response = await client.chat.completions.create({
    model: modelId,
    messages,
    max_tokens: maxTokens,
  });

  return response.choices?.[0]?.message?.content || '';
}

module.exports = { streamChatCompletion, chatCompletion, createAIClient };
