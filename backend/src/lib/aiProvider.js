const OpenAI = require('openai');
const { GoogleGenAI } = require('@google/genai');
const pdfParse = require('pdf-parse');

// ── Extract text from a base64-encoded PDF ──
async function extractPdfText(base64Data) {
  try {
    const buffer = Buffer.from(base64Data, 'base64');
    const result = await pdfParse(buffer);
    return result.text?.trim() || '';
  } catch (err) {
    console.error('[pdf] extraction error:', err.message);
    return '[PDF content could not be extracted]';
  }
}

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

// ── Tool definitions for function calling ──
const GENERATION_TOOLS_OPENAI = [
  {
    type: 'function',
    function: {
      name: 'generate_image',
      description: 'Generate an image from a text prompt. Use this when the user asks you to create, draw, generate, or make an image/picture/illustration/artwork.',
      parameters: {
        type: 'object',
        properties: {
          prompt: {
            type: 'string',
            description: 'Detailed description of the image to generate. Be specific about style, colors, composition, lighting, etc.',
          },
          aspect_ratio: {
            type: 'string',
            enum: ['1:1', '16:9', '9:16', '4:3', '3:4'],
            description: 'Aspect ratio of the image. Default 1:1.',
          },
        },
        required: ['prompt'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'generate_tts',
      description: 'Convert text to speech audio. Use when the user asks to read aloud, speak, or generate audio/voice from text.',
      parameters: {
        type: 'object',
        properties: {
          text: {
            type: 'string',
            description: 'The text to convert to speech.',
          },
          voice: {
            type: 'string',
            description: 'Voice to use. Options: alloy, echo, fable, onyx, nova, shimmer (OpenAI) or Kore, Charon, Fenrir, Aoede, Puck (Google).',
          },
        },
        required: ['text'],
      },
    },
  },
];

const GENERATION_TOOLS_GEMINI = [
  {
    functionDeclarations: [
      {
        name: 'generate_image',
        description: 'Generate an image from a text prompt. Use this when the user asks you to create, draw, generate, or make an image/picture/illustration/artwork.',
        parameters: {
          type: 'OBJECT',
          properties: {
            prompt: { type: 'STRING', description: 'Detailed description of the image to generate.' },
            aspect_ratio: { type: 'STRING', description: 'Aspect ratio: 1:1, 16:9, 9:16, 4:3, 3:4. Default 1:1.' },
          },
          required: ['prompt'],
        },
      },
      {
        name: 'generate_tts',
        description: 'Convert text to speech audio. Use when the user asks to read aloud, speak, or generate audio/voice from text.',
        parameters: {
          type: 'OBJECT',
          properties: {
            text: { type: 'STRING', description: 'The text to convert to speech.' },
            voice: { type: 'STRING', description: 'Voice name. Options: Kore, Charon, Fenrir, Aoede, Puck.' },
          },
          required: ['text'],
        },
      },
    ],
  },
];

// Detect fake tool-call JSON that models output when they don't support real function calling
// Returns { toolName, args } or null
function detectFakeToolCall(text) {
  const trimmed = text.trim();
  // Try to parse as JSON first
  let parsed = null;
  try {
    // Handle markdown code blocks wrapping JSON
    const jsonMatch = trimmed.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/) || [null, trimmed];
    parsed = JSON.parse(jsonMatch[1].trim());
  } catch {
    // Try to find JSON object in the text
    const jsonStart = trimmed.indexOf('{');
    const jsonEnd = trimmed.lastIndexOf('}');
    if (jsonStart !== -1 && jsonEnd > jsonStart) {
      try {
        parsed = JSON.parse(trimmed.substring(jsonStart, jsonEnd + 1));
      } catch { return null; }
    }
  }
  if (!parsed) return null;

  // Detect DALL-E style: { "action": "dalle.text2im", "action_input": "{ \"prompt\": \"...\" }" }
  if (parsed.action === 'dalle.text2im' || parsed.action === 'text2im' || parsed.action === 'generate_image') {
    let prompt = '';
    try {
      const input = typeof parsed.action_input === 'string' ? JSON.parse(parsed.action_input) : parsed.action_input;
      prompt = input?.prompt || input?.description || '';
    } catch {
      prompt = typeof parsed.action_input === 'string' ? parsed.action_input : '';
    }
    if (prompt) return { toolName: 'generate_image', args: { prompt } };
  }

  // Detect direct format: { "tool": "generate_image", "prompt": "..." }
  if (parsed.tool === 'generate_image' || parsed.function === 'generate_image' || parsed.name === 'generate_image') {
    const prompt = parsed.prompt || parsed.input?.prompt || parsed.arguments?.prompt || parsed.parameters?.prompt || '';
    if (prompt) return { toolName: 'generate_image', args: { prompt } };
  }

  // Detect: { "prompt": "...", "type": "image" } or similar
  if (parsed.prompt && (parsed.type === 'image' || parsed.model?.includes('dall') || parsed.model?.includes('imagen'))) {
    return { toolName: 'generate_image', args: { prompt: parsed.prompt } };
  }

  // Detect TTS patterns
  if (parsed.action === 'tts' || parsed.tool === 'generate_tts' || parsed.function === 'generate_tts') {
    const text = parsed.text || parsed.input?.text || parsed.action_input || '';
    if (text) return { toolName: 'generate_tts', args: { text } };
  }

  return null;
}

// Execute a tool call and return media results
async function executeToolCall(name, args, genApiKeys) {
  console.log(`[tool] executing ${name}:`, JSON.stringify(args).substring(0, 200));

  if (name === 'generate_image') {
    // Prefer Google (Imagen) > OpenAI (DALL-E)
    const googleKey = genApiKeys?.google;
    const openaiKey = genApiKeys?.openai;
    if (googleKey) {
      const images = await generateImage('google', googleKey, args.prompt, {
        aspectRatio: args.aspect_ratio || '1:1',
      });
      return images.map(img => ({ type: 'media', mimeType: img.mimeType, data: img.data }));
    }
    if (openaiKey) {
      const images = await generateImage('openai', openaiKey, args.prompt, {
        size: args.aspect_ratio === '16:9' ? '1792x1024' : args.aspect_ratio === '9:16' ? '1024x1792' : '1024x1024',
      });
      return images.map(img => ({ type: 'media', mimeType: img.mimeType, data: img.data }));
    }
    return [{ type: 'text', content: 'Image generation is not available — no Google or OpenAI API key configured for generation.' }];
  }

  if (name === 'generate_tts') {
    const googleKey = genApiKeys?.google;
    const openaiKey = genApiKeys?.openai;
    if (openaiKey) {
      const audio = await generateTTS('openai', openaiKey, args.text, { voice: args.voice });
      return [{ type: 'media', mimeType: audio.mimeType, data: audio.data }];
    }
    if (googleKey) {
      const audio = await generateTTS('google', googleKey, args.text, { voice: args.voice });
      return [{ type: 'media', mimeType: audio.mimeType, data: audio.data }];
    }
    return [{ type: 'text', content: 'TTS is not available — no OpenAI or Google API key configured.' }];
  }

  return [{ type: 'text', content: `Unknown tool: ${name}` }];
}

// ── Convert raw PCM to WAV so browsers can play it ──
// Google's SDK returns little-endian PCM already — just wrap with WAV header
function pcmToWav(pcmBase64, sampleRate = 24000, numChannels = 1, bitsPerSample = 16) {
  const raw = Buffer.from(pcmBase64, 'base64');

  // If data already has a known audio header, return as-is
  if (raw.length > 12) {
    if (raw.toString('ascii', 0, 4) === 'RIFF' && raw.toString('ascii', 8, 12) === 'WAVE') {
      console.log('[pcmToWav] data already has WAV header, returning as-is');
      return pcmBase64;
    }
    if (raw[0] === 0xFF && (raw[1] & 0xE0) === 0xE0) {
      console.log('[pcmToWav] data is already MP3, returning as-is');
      return pcmBase64;
    }
  }

  const byteRate = sampleRate * numChannels * (bitsPerSample / 8);
  const blockAlign = numChannels * (bitsPerSample / 8);
  const dataSize = raw.length;
  const wav = Buffer.alloc(44 + dataSize);

  // RIFF header
  wav.write('RIFF', 0);
  wav.writeUInt32LE(36 + dataSize, 4);
  wav.write('WAVE', 8);
  // fmt sub-chunk
  wav.write('fmt ', 12);
  wav.writeUInt32LE(16, 16);
  wav.writeUInt16LE(1, 20);            // PCM format
  wav.writeUInt16LE(numChannels, 22);
  wav.writeUInt32LE(sampleRate, 24);
  wav.writeUInt32LE(byteRate, 28);
  wav.writeUInt16LE(blockAlign, 32);
  wav.writeUInt16LE(bitsPerSample, 34);
  // data sub-chunk
  wav.write('data', 36);
  wav.writeUInt32LE(dataSize, 40);
  raw.copy(wav, 44);

  console.log(`[pcmToWav] wrapped ${dataSize} bytes PCM → ${wav.length} bytes WAV (rate=${sampleRate})`);
  return wav.toString('base64');
}

// ── Gemini TTS streaming — uses AUDIO response modality ──
async function* streamGeminiTTS(apiKey, modelId, messages, options = {}) {
  const ai = createGoogleClient(apiKey);
  const t0 = Date.now();

  // For TTS, the last user message is the text to speak
  const lastUserMsg = [...messages].reverse().find(m => m.role === 'user');
  const textToSpeak = lastUserMsg?.content || '';
  if (!textToSpeak.trim()) {
    yield { type: 'text', content: 'No text provided for speech generation.' };
    return;
  }

  const voiceName = options.voice || 'Kore';
  console.log(`[ai] gemini-tts ${modelId} voice=${voiceName} text="${textToSpeak.substring(0, 60)}..."`);

  try {
    const response = await ai.models.generateContent({
      model: modelId,
      contents: [{ role: 'user', parts: [{ text: textToSpeak }] }],
      config: {
        responseModalities: ['AUDIO'],
        speechConfig: {
          voiceConfig: {
            prebuiltVoiceConfig: { voiceName },
          },
        },
      },
    });
    console.log(`[ai] gemini-tts done ${modelId}: ${Date.now() - t0}ms`);

    // Debug: log the full response structure
    const candidate = response.candidates?.[0];
    if (!candidate) {
      console.error(`[ai] gemini-tts: no candidates in response`);
      yield { type: 'text', content: 'TTS model returned empty response. Make sure the model supports audio output (e.g. gemini-2.5-flash-preview-tts).' };
      return;
    }

    const parts = candidate.content?.parts || [];
    console.log(`[ai] gemini-tts: ${parts.length} parts, types: ${parts.map(p => p.inlineData ? `inlineData(${p.inlineData.mimeType})` : p.text ? 'text' : 'unknown').join(', ')}`);

    const audioPart = parts.find(p => p.inlineData);
    if (audioPart?.inlineData) {
      const rawMime = audioPart.inlineData.mimeType || '';
      const rawData = audioPart.inlineData.data;

      if (!rawData || rawData.length === 0) {
        console.error(`[ai] gemini-tts: inlineData.data is empty`);
        yield { type: 'text', content: 'TTS model returned empty audio data.' };
        return;
      }

      console.log(`[ai] gemini-tts raw mimeType="${rawMime}", data length=${rawData.length} chars`);

      // Convert raw PCM (big-endian L16) to WAV (little-endian) for browser playback
      const rateMatch = rawMime.match(/rate=(\d+)/);
      const sampleRate = rateMatch ? parseInt(rateMatch[1]) : 24000;
      const wavData = pcmToWav(rawData, sampleRate);

      console.log(`[ai] gemini-tts wav data length=${wavData.length} chars`);
      yield { type: 'media', mimeType: 'audio/wav', data: wavData };
    } else {
      // Check if there's text explaining why no audio was generated
      const textPart = parts.find(p => p.text);
      const reason = textPart?.text || 'Make sure the model supports audio output (e.g. gemini-2.5-flash-preview-tts).';
      console.error(`[ai] gemini-tts: no audio part found. Response text: ${reason.substring(0, 200)}`);
      yield { type: 'text', content: `TTS model returned no audio. ${reason}` };
    }
  } catch (err) {
    console.error(`[ai] gemini-tts error:`, err.message, err.stack?.substring(0, 300));
    throw err;
  }
}

// ── Native Gemini streaming — auto-fallback when thinking or tools are unsupported ──
async function* streamGeminiNative(apiKey, modelId, messages, maxTokens, temperature, topP, genApiKeys, modelType = 'text') {
  const ai = createGoogleClient(apiKey);
  const t0 = Date.now();
  const isImageModel = modelType === 'image';

  const systemMsg = messages.find(m => m.role === 'system');
  const chatMessages = messages.filter(m => m.role !== 'system');
  const contents = chatMessages.map(m => ({
    role: m.role === 'assistant' ? 'model' : 'user',
    parts: (m.attachments && m.attachments.length > 0)
      ? buildGeminiMultimodalParts(m)
      : [{ text: m.content }],
  }));

  const baseConfig = {
    maxOutputTokens: maxTokens, temperature, topP,
    ...(systemMsg ? { systemInstruction: systemMsg.content } : {}),
    // Image models MUST have responseModalities set to get images back
    ...(isImageModel ? { responseModalities: ['TEXT', 'IMAGE'] } : {}),
  };

  // Image models: no tools/thinking needed — just generate with IMAGE modality
  // Text models: try configs from most features → least
  const attempts = isImageModel
    ? [{ config: baseConfig, tools: undefined }]
    : [
        { config: { ...baseConfig, thinkingConfig: { includeThoughts: true } }, tools: GENERATION_TOOLS_GEMINI },
        { config: baseConfig, tools: GENERATION_TOOLS_GEMINI },
        { config: baseConfig, tools: undefined },
      ];

  // ── Image models: use non-streaming since images arrive all-at-once ──
  // NOTE: skeleton 'generating' event is yielded by streamChatCompletion before entering here
  if (isImageModel) {
    try {
      const reqParams = { model: modelId, contents, config: baseConfig };
      console.log(`[ai] gemini-image generating ${modelId}...`);
      const response = await ai.models.generateContent(reqParams);
      console.log(`[ai] gemini-image done ${modelId}: ${Date.now() - t0}ms`);

      const parts = response.candidates?.[0]?.content?.parts || [];
      for (const part of parts) {
        if (part.inlineData) {
          yield { type: 'media', mimeType: part.inlineData.mimeType, data: part.inlineData.data };
        } else if (part.text) {
          yield { type: 'text', content: part.text };
        }
      }
      if (!parts.length) {
        yield { type: 'text', content: 'Image model returned no output.' };
      }
    } catch (err) {
      console.error(`[ai] gemini-image error:`, err.message);
      throw err;
    }
    return;
  }

  // ── Text models: streaming with progressive fallback ──
  let response = null;
  for (let i = 0; i < attempts.length; i++) {
    const attempt = attempts[i];
    try {
      const reqParams = { model: modelId, contents, config: attempt.config };
      if (attempt.tools) reqParams.tools = attempt.tools;
      response = await ai.models.generateContentStream(reqParams);
      console.log(`[ai] gemini-native stream-open ${modelId} (attempt ${i + 1}): ${Date.now() - t0}ms`);
      break;
    } catch (err) {
      const msg = err?.message || err?.toString() || '';
      const isUnsupported = msg.includes('Thinking is not enabled') ||
        msg.includes('not supported') ||
        msg.includes('INVALID_ARGUMENT') ||
        (err?.status === 400 && (msg.includes('think') || msg.includes('tool') || msg.includes('function')));
      if (isUnsupported && i < attempts.length - 1) {
        console.log(`[ai] gemini attempt ${i + 1} failed (${msg.substring(0, 80)}), trying simpler config...`);
        continue;
      }
      throw err;
    }
  }

  let first = true;
  for await (const chunk of response) {
    const parts = chunk.candidates?.[0]?.content?.parts || [];
    for (const part of parts) {
      if (part.inlineData) {
        if (first) { console.log(`[ai] gemini-native first-token ${modelId}: ${Date.now() - t0}ms`); first = false; }
        yield { type: 'media', mimeType: part.inlineData.mimeType, data: part.inlineData.data };
        continue;
      }
      if (part.functionCall) {
        if (first) { console.log(`[ai] gemini-native first-token ${modelId}: ${Date.now() - t0}ms`); first = false; }
        console.log(`[ai] gemini function call: ${part.functionCall.name}`);
        yield { type: 'generating', mediaType: part.functionCall.name === 'generate_tts' ? 'audio' : 'image' };
        try {
          const results = await executeToolCall(part.functionCall.name, part.functionCall.args || {}, genApiKeys);
          for (const result of results) { yield result; }
        } catch (toolErr) {
          console.error(`[tool] execution error:`, toolErr.message);
          yield { type: 'text', content: `\n\nFailed to execute ${part.functionCall.name}: ${toolErr.message}` };
        }
        continue;
      }
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

async function* streamChatCompletion(provider, apiKey, modelId, messages, maxTokens = 4096, temperature = 0.7, topP = 0.95, genApiKeys = {}, modelType = 'text', ttsOptions = {}) {
  // ── TTS models: dedicated path with AUDIO response modality ──
  if (modelType === 'tts') {
    if (provider === 'google') {
      yield { type: 'generating', mediaType: 'audio' };
      yield* streamGeminiTTS(apiKey, modelId, messages, ttsOptions);
      return;
    }
    // For non-Google TTS models, fall through to normal streaming
    // (they'll handle it via tool calling or fake-call detection)
  }

  
  // Use native Google SDK for Gemini — true token-by-token streaming
  // The OpenAI-compatible wrapper buffers the entire response (~8s) before fake-streaming
  if (provider === 'google') {
    yield* streamGeminiNative(apiKey, modelId, messages, maxTokens, temperature, topP, genApiKeys, modelType);
    return;
  }

  // All other providers use OpenAI-compatible SDK
  const client = createAIClient(provider, apiKey);
  const t0 = Date.now();

  // Build messages with multimodal support for OpenAI-compatible providers
  // (async because PDF extraction is async)
  const builtMessages = await Promise.all(messages.map(async m => {
    const content = (m.attachments && m.attachments.length > 0)
      ? await buildOpenAIMultimodalContent(m)
      : m.content;
    return { role: m.role, content };
  }));

  // Only add tools for providers that support function calling
  const supportsTools = ['openai', 'openrouter', 'groq', 'mistral'].includes(provider);

  let useTools = supportsTools;
  let stream;
  const baseParams = {
    model: modelId,
    messages: builtMessages,
    stream: true,
    max_tokens: maxTokens,
    temperature,
    top_p: topP,
  };

  // Try with tools first, fall back without if model doesn't support them
  if (useTools) {
    try {
      stream = await client.chat.completions.create({ ...baseParams, tools: GENERATION_TOOLS_OPENAI, tool_choice: 'auto' });
    } catch (toolErr) {
      const msg = toolErr?.message || '';
      if (toolErr?.status === 400 || msg.includes('tool') || msg.includes('function') || msg.includes('not supported')) {
        console.log(`[ai] ${provider}/${modelId} doesn't support tools, retrying without...`);
        useTools = false;
        stream = await client.chat.completions.create(baseParams);
      } else {
        throw toolErr;
      }
    }
  } else {
    stream = await client.chat.completions.create(baseParams);
  }
  console.log(`[ai] stream-open ${provider}/${modelId}: ${Date.now() - t0}ms`);

  let first = true;
  // Accumulate tool calls across streamed deltas
  const pendingToolCalls = {}; // id → { name, arguments }
  let hasToolCalls = false;
  let fullText = ''; // Accumulate all streamed text for fake-tool-call detection

  for await (const chunk of stream) {
    const choice = chunk.choices?.[0];
    const content = choice?.delta?.content;
    if (content) {
      if (first) { console.log(`[ai] first-token ${provider}/${modelId}: ${Date.now() - t0}ms`); first = false; }
      fullText += content;
      yield content;
    }

    // Accumulate tool call deltas
    const toolCalls = choice?.delta?.tool_calls;
    if (toolCalls) {
      hasToolCalls = true;
      for (const tc of toolCalls) {
        const idx = tc.index ?? 0;
        if (!pendingToolCalls[idx]) {
          pendingToolCalls[idx] = { id: tc.id || '', name: '', arguments: '' };
        }
        if (tc.id) pendingToolCalls[idx].id = tc.id;
        if (tc.function?.name) pendingToolCalls[idx].name += tc.function.name;
        if (tc.function?.arguments) pendingToolCalls[idx].arguments += tc.function.arguments;
      }
    }
  }

  // Execute real tool calls from function-calling-capable models
  if (hasToolCalls) {
    console.log(`[ai] executing ${Object.keys(pendingToolCalls).length} tool call(s)`);
    yield { type: 'generating', mediaType: 'image' };
    for (const [, tc] of Object.entries(pendingToolCalls)) {
      try {
        const args = JSON.parse(tc.arguments || '{}');
        const results = await executeToolCall(tc.name, args, genApiKeys);
        for (const result of results) {
          yield result;
        }
      } catch (toolErr) {
        console.error(`[tool] execution error for ${tc.name}:`, toolErr.message);
        yield { type: 'text', content: `\n\nFailed to generate: ${toolErr.message}` };
      }
    }
  }
  // Detect fake tool-call JSON from models that don't support real function calling
  else if (fullText.trim()) {
    const fakeCall = detectFakeToolCall(fullText);
    if (fakeCall) {
      console.log(`[ai] detected fake tool call in text: ${fakeCall.toolName}`);
      // Signal to clear the fake JSON text and show generating skeleton
      yield { type: 'clear_and_generate', toolName: fakeCall.toolName };
      try {
        const results = await executeToolCall(fakeCall.toolName, fakeCall.args, genApiKeys);
        for (const result of results) {
          yield result;
        }
      } catch (toolErr) {
        console.error(`[tool] fake-call execution error:`, toolErr.message);
        yield { type: 'text', content: `Failed to generate: ${toolErr.message}` };
      }
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
      parts: (m.attachments && m.attachments.length > 0)
        ? buildGeminiMultimodalParts(m)
        : [{ text: m.content }],
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

  // Build messages with multimodal + PDF extraction for non-Google
  const builtMessages = await Promise.all(messages.map(async m => {
    const content = (m.attachments && m.attachments.length > 0)
      ? await buildOpenAIMultimodalContent(m)
      : m.content;
    return { role: m.role, content };
  }));

  const response = await client.chat.completions.create({
    model: modelId,
    messages: builtMessages,
    max_tokens: maxTokens,
  });

  return response.choices?.[0]?.message?.content || '';
}

// ── Image Generation ──
async function generateImage(provider, apiKey, prompt, options = {}) {
  if (provider === 'google') {
    const ai = createGoogleClient(apiKey);
    // Use Gemini's image generation (Imagen 3)
    const response = await ai.models.generateImages({
      model: 'imagen-3.0-generate-002',
      prompt,
      config: {
        numberOfImages: options.count || 1,
        aspectRatio: options.aspectRatio || '1:1',
      },
    });
    // Return array of base64 images
    return (response.generatedImages || []).map(img => ({
      mimeType: 'image/png',
      data: img.image?.imageBytes || '',
    }));
  }

  if (provider === 'openai') {
    const client = createAIClient('openai', apiKey);
    const response = await client.images.generate({
      model: options.model || 'dall-e-3',
      prompt,
      n: options.count || 1,
      size: options.size || '1024x1024',
      response_format: 'b64_json',
    });
    return (response.data || []).map(img => ({
      mimeType: 'image/png',
      data: img.b64_json || '',
    }));
  }

  throw new Error(`Image generation not supported for provider: ${provider}`);
}

// ── Text-to-Speech ──
async function generateTTS(provider, apiKey, text, options = {}) {
  if (provider === 'openai') {
    const client = createAIClient('openai', apiKey);
    const response = await client.audio.speech.create({
      model: options.model || 'tts-1',
      voice: options.voice || 'alloy',
      input: text,
      response_format: 'mp3',
    });
    // response is a Response object with arrayBuffer
    const buffer = Buffer.from(await response.arrayBuffer());
    return { mimeType: 'audio/mpeg', data: buffer.toString('base64') };
  }

  if (provider === 'google') {
    const ai = createGoogleClient(apiKey);
    // Use Gemini 2.5 Flash with audio output
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash-preview-tts',
      contents: [{ role: 'user', parts: [{ text }] }],
      config: {
        responseModalities: ['AUDIO'],
        speechConfig: {
          voiceConfig: {
            prebuiltVoiceConfig: {
              voiceName: options.voice || 'Kore',
            },
          },
        },
      },
    });
    const audioPart = response.candidates?.[0]?.content?.parts?.find(p => p.inlineData);
    if (audioPart?.inlineData) {
      const rawMime = audioPart.inlineData.mimeType || '';
      const rateMatch = rawMime.match(/rate=(\d+)/);
      const sampleRate = rateMatch ? parseInt(rateMatch[1]) : 24000;
      const wavData = pcmToWav(audioPart.inlineData.data || '', sampleRate);
      return { mimeType: 'audio/wav', data: wavData };
    }
    throw new Error('No audio generated');
  }

  throw new Error(`TTS not supported for provider: ${provider}`);
}

// ── Video Generation (Gemini Veo) ──
async function generateVideo(provider, apiKey, prompt, options = {}) {
  if (provider === 'google') {
    const ai = createGoogleClient(apiKey);
    // Start async video generation
    let operation = await ai.models.generateVideos({
      model: 'veo-2.0-generate-001',
      prompt,
      config: {
        aspectRatio: options.aspectRatio || '16:9',
        numberOfVideos: 1,
      },
    });
    // Poll for completion (up to 5 minutes)
    const maxWait = 300_000;
    const start = Date.now();
    while (!operation.done && Date.now() - start < maxWait) {
      await new Promise(r => setTimeout(r, 5000));
      operation = await ai.operations.get({ operation: operation.name });
    }
    if (!operation.done) throw new Error('Video generation timed out');
    const videos = operation.response?.generatedVideos || [];
    if (videos.length === 0) throw new Error('No video generated');
    return videos.map(v => ({
      mimeType: 'video/mp4',
      data: v.video?.videoBytes || '',
    }));
  }

  throw new Error(`Video generation not supported for provider: ${provider}`);
}

// ── Build multimodal message parts for Gemini ──
function buildGeminiMultimodalParts(message) {
  const parts = [];
  if (message.attachments && message.attachments.length > 0) {
    for (const att of message.attachments) {
      parts.push({
        inlineData: { mimeType: att.mimeType, data: att.data },
      });
    }
  }
  if (message.content) {
    parts.push({ text: message.content });
  }
  return parts;
}

// ── Build multimodal message for OpenAI (+ all non-Google providers) ──
// PDFs are extracted to text since OpenAI doesn't support inline PDF
async function buildOpenAIMultimodalContent(message) {
  if (!message.attachments || message.attachments.length === 0) {
    return message.content;
  }
  const content = [];
  for (const att of message.attachments) {
    if (att.mimeType.startsWith('image/')) {
      content.push({
        type: 'image_url',
        image_url: { url: `data:${att.mimeType};base64,${att.data}` },
      });
    } else if (att.mimeType === 'application/pdf') {
      // Extract text from PDF and inject as a text block
      const pdfText = await extractPdfText(att.data);
      if (pdfText) {
        content.push({
          type: 'text',
          text: `[Content of attached PDF file]:\n\n${pdfText}`,
        });
      }
    } else if (att.mimeType.startsWith('audio/')) {
      // OpenAI chat supports input_audio
      content.push({
        type: 'input_audio',
        input_audio: { data: att.data, format: att.mimeType.includes('wav') ? 'wav' : 'mp3' },
      });
    } else if (att.mimeType.startsWith('text/') || ['application/json', 'application/xml', 'text/csv', 'text/markdown'].includes(att.mimeType)) {
      // Plain text files — decode and inject
      const textContent = Buffer.from(att.data, 'base64').toString('utf-8');
      content.push({
        type: 'text',
        text: `[Content of attached file]:\n\n${textContent}`,
      });
    }
  }
  if (message.content) {
    content.push({ type: 'text', text: message.content });
  }
  return content.length > 0 ? content : message.content;
}

module.exports = {
  streamChatCompletion,
  chatCompletion,
  createAIClient,
  generateImage,
  generateTTS,
  generateVideo,
  buildGeminiMultimodalParts,
  buildOpenAIMultimodalContent,
};
