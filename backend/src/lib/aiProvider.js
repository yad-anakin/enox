const OpenAI = require('openai');

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

function createAIClient(provider, apiKey) {
  const config = PROVIDER_CONFIGS[provider];
  if (!config) throw new Error(`Unsupported provider: ${provider}`);

  const cacheKey = `${provider}:${apiKey}`;
  let client = clientCache.get(cacheKey);
  if (!client) {
    client = new OpenAI({
      apiKey,
      baseURL: config.baseURL,
      timeout: 30000,
      maxRetries: 0,
    });
    clientCache.set(cacheKey, client);
  }
  return client;
}

async function* streamChatCompletion(provider, apiKey, modelId, messages, maxTokens = 4096, temperature = 0.7, topP = 0.95) {
  const client = createAIClient(provider, apiKey);

  const params = {
    model: modelId,
    messages,
    stream: true,
    max_tokens: maxTokens,
    temperature,
    top_p: topP,
  };

  const stream = await client.chat.completions.create(params);

  for await (const chunk of stream) {
    const content = chunk.choices?.[0]?.delta?.content;
    if (content) {
      yield content;
    }
  }
}

async function chatCompletion(provider, apiKey, modelId, messages, maxTokens = 4096) {
  const client = createAIClient(provider, apiKey);

  const response = await client.chat.completions.create({
    model: modelId,
    messages,
    max_tokens: maxTokens,
  });

  return response.choices?.[0]?.message?.content || '';
}

module.exports = { streamChatCompletion, chatCompletion, createAIClient };
