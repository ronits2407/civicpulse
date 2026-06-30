/**
 * Unified AI client for CivicPulse.
 *
 * Set AI_PROVIDER=gemini  (default) → uses Google Generative AI (Gemini Flash / Pro)
 * Set AI_PROVIDER=ollama          → uses Ollama Cloud via OpenAI-compatible API
 *
 * Ollama Cloud env vars:
 *   OLLAMA_API_KEY   – your key from https://ollama.com/settings
 *   OLLAMA_BASE_URL  – defaults to https://ollama.com/v1
 *   OLLAMA_FLASH_MODEL  – model used where Gemini Flash was used (default: qwen3:30b-a3b)
 *   OLLAMA_PRO_MODEL    – model used where Gemini Pro was used   (default: qwen3:235b-a22b)
 *
 * NOTE: Embeddings always use Google's gemini-embedding-001 model (when provider=gemini)
 * or Ollama's nomic-embed-text (when provider=ollama). pgvector dimensions are fixed at
 * 768 to match these models. Changing embedding providers would require re-embedding all
 * stored vectors.
 */

import { GoogleGenAI } from '@google/genai'
import OpenAI from 'openai'
import { ChatGoogleGenerativeAI } from '@langchain/google-genai'
import { ChatOpenAI } from '@langchain/openai'

// ─── Provider detection ──────────────────────────────────────────────────────

export type AIProvider = 'gemini' | 'ollama'

function getProvider(): AIProvider {
  const raw = process.env.AI_PROVIDER?.toLowerCase()
  if (raw === 'ollama') return 'ollama'
  return 'gemini' // safe default
}

// ─── Gemini setup (@google/genai) ────────────────────────────────────────────

let _genAI: GoogleGenAI | null = null
function getGenAI(): GoogleGenAI {
  if (!_genAI) {
    if (!process.env.GEMINI_API_KEY) throw new Error('GEMINI_API_KEY is not set')
    _genAI = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY })
  }
  return _genAI
}

// Custom fetch to disable keep-alive (fixes UND_ERR_SOCKET with ngrok)
const customFetch = (url: any, init?: any) => {
  return fetch(url, {
    ...init,
    keepalive: false,
  })
}

// ─── Ollama Cloud (OpenAI-compatible) setup ──────────────────────────────────

let _ollamaClient: OpenAI | null = null
function getOllamaClient(): OpenAI {
  if (!_ollamaClient) {
    _ollamaClient = new OpenAI({
      baseURL: process.env.OLLAMA_BASE_URL || 'http://localhost:11434/v1',
      apiKey: process.env.OLLAMA_API_KEY || 'ollama', // local ollama doesn't require a real API key
      maxRetries: 3,
      fetch: customFetch
    })
  }
  return _ollamaClient
}

let _ollamaLocalClient: OpenAI | null = null
function getOllamaLocalClient(): OpenAI {
  if (!_ollamaLocalClient) {
    _ollamaLocalClient = new OpenAI({
      baseURL: process.env.OLLAMA_LOCAL_BASE_URL || 'http://localhost:11434/v1',
      apiKey: 'ollama', // local ollama API doesn't enforce this, but OpenAI client requires a value
      maxRetries: 3,
      fetch: customFetch
    })
  }
  return _ollamaLocalClient
}

function getOllamaFlashModel(): string {
  // A capable mid-size model — fast, good at structured output
  return process.env.OLLAMA_FLASH_MODEL || 'qwen3:30b-a3b'
}

function getOllamaProModel(): string {
  // A larger, more capable model for complex reasoning (Agent 5)
  return process.env.OLLAMA_PRO_MODEL || 'qwen3:235b-a22b'
}

// ─── Public API ──────────────────────────────────────────────────────────────

/**
 * Generate structured JSON from a prompt.
 * This is the primary function used by all agents (1–4).
 */
export async function generateStructuredJSON<T>(
  prompt: string,
  systemInstruction: string,
  usePro = false
): Promise<T> {
  const provider = getProvider()

  if (provider === 'ollama') {
    const client = getOllamaClient()
    const model = usePro ? getOllamaProModel() : getOllamaFlashModel()

    const response = await client.chat.completions.create({
      model,
      messages: [
        { role: 'system', content: systemInstruction + '\nAlways respond with valid JSON only. No markdown, no preamble.' },
        { role: 'user', content: prompt },
      ],
      temperature: 0.1, // low temp for deterministic JSON
    })

    const text = response.choices[0]?.message?.content || ''
    const clean = text.replace(/```json|```/g, '').trim()
    try {
      return JSON.parse(clean) as T
    } catch (e) {
      console.error('[AI Client] Failed to parse JSON from Ollama. Raw text:', clean)
      throw e
    }
  }

  // Default: Gemini (using @google/genai SDK)
  const ai = getGenAI()
  const modelId = usePro ? 'gemini-2.5-pro' : 'gemini-2.5-flash'

  const response = await ai.models.generateContent({
    model: modelId,
    contents: prompt,
    config: {
      systemInstruction,
      temperature: 0.1,
    },
  })

  const text = response.text || ''
  const clean = text.replace(/```json|```/g, '').trim()
  try {
    return JSON.parse(clean) as T
  } catch (e) {
    console.error('[AI Client] Failed to parse JSON from Gemini. Raw text:', clean)
    throw e
  }
}

/**
 * Analyze an image (vision). Ollama uses qwen3-vl or qwen2.5vl if configured;
 * falls back to Gemini Flash if the vision model env var is not set for Ollama.
 */
export async function analyzeImage(imageUrl: string, prompt: string): Promise<string> {
  const provider = getProvider()

  if (provider === 'ollama') {
    // Fetch the image and pass as base64 via OpenAI vision API
    const imageResponse = await fetch(imageUrl)
    if (!imageResponse.ok) {
      throw new Error(`Failed to download image from ${imageUrl}: ${imageResponse.status} ${imageResponse.statusText}`);
    }
    const imageData = await imageResponse.arrayBuffer()
    let buffer: any = Buffer.from(imageData)
    let mimeType = imageResponse.headers.get('content-type') || 'image/jpeg'
    
    try {
      const sharp = (await import('sharp')).default
      buffer = await sharp(buffer)
        .resize({ width: 1024, withoutEnlargement: true })
        .jpeg({ quality: 85 })
        .toBuffer()
      mimeType = 'image/jpeg'
    } catch (e) {
      console.warn('[AI Client] Sharp image optimization skipped/failed:', e)
      if (!mimeType.startsWith('image/')) mimeType = 'image/jpeg'
    }
    
    const base64Image = buffer.toString('base64')

    const visionModel = process.env.OLLAMA_VISION_MODEL || 'llava'
    const client = getOllamaClient()

    const response = await client.chat.completions.create({
      model: visionModel,
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'image_url',
              image_url: { url: `data:${mimeType};base64,${base64Image}` },
            },
            { type: 'text', text: prompt },
          ],
        },
      ],
      temperature: 0.1,
    })

    return response.choices[0]?.message?.content || ''
  }

  // Default: Gemini Flash (multimodal via @google/genai)
  const ai = getGenAI()

  const imageResponse = await fetch(imageUrl)
  if (!imageResponse.ok) {
    throw new Error(`Failed to download image from ${imageUrl}: ${imageResponse.status} ${imageResponse.statusText}`);
  }
  const imageData = await imageResponse.arrayBuffer()
  let buffer: any = Buffer.from(imageData)
  let mimeType = imageResponse.headers.get('content-type') || 'image/jpeg'

  try {
    const sharp = (await import('sharp')).default
    buffer = await sharp(buffer)
      .resize({ width: 1024, withoutEnlargement: true })
      .jpeg({ quality: 85 })
      .toBuffer()
    mimeType = 'image/jpeg'
  } catch (e) {
    console.warn('[AI Client] Sharp image optimization skipped/failed:', e)
    if (!mimeType.startsWith('image/')) mimeType = 'image/jpeg'
  }

  const base64Image = buffer.toString('base64')

  const response = await ai.models.generateContent({
    model: 'gemini-2.5-flash',
    contents: [
      {
        role: 'user',
        parts: [
          {
            inlineData: {
              data: base64Image,
              mimeType: mimeType,
            },
          },
          { text: prompt },
        ],
      },
    ],
    config: {
      temperature: 0.1,
    },
  })

  return response.text || ''
}

/**
 * Generate a text embedding.
 * Uses Google's gemini-embedding-001 or Ollama's nomic-embed-text.
 * Both output 768 dimensions matching the pgvector column.
 */
export async function generateEmbedding(text: string): Promise<number[]> {
  const provider = getProvider()

  if (provider === 'ollama') {
    const client = getOllamaLocalClient()
    const embeddingModel = process.env.OLLAMA_EMBEDDING_MODEL || 'nomic-embed-text'
    const response = await client.embeddings.create({
      model: embeddingModel,
      input: text,
    })
    return response.data[0].embedding
  }

  // Default: Gemini embedding (via @google/genai)
  const ai = getGenAI()
  const response = await ai.models.embedContent({
    model: 'gemini-embedding-001',
    contents: text,
    config: {
      outputDimensionality: 768,
    },
  })

  return response.embeddings![0].values!
}

/**
 * Convenience: generate plain text (no JSON parsing).
 */
export async function generateText(
  prompt: string,
  systemInstruction?: string,
  usePro = false
): Promise<string> {
  const provider = getProvider()

  if (provider === 'ollama') {
    const client = getOllamaClient()
    const model = usePro ? getOllamaProModel() : getOllamaFlashModel()
    const messages: OpenAI.Chat.ChatCompletionMessageParam[] = []
    if (systemInstruction) messages.push({ role: 'system', content: systemInstruction })
    messages.push({ role: 'user', content: prompt })

    const response = await client.chat.completions.create({ model, messages, temperature: 0.1 })
    return response.choices[0]?.message?.content || ''
  }

  // Gemini (via @google/genai)
  const ai = getGenAI()
  const modelId = usePro ? 'gemini-2.5-pro' : 'gemini-2.5-flash'

  const response = await ai.models.generateContent({
    model: modelId,
    contents: prompt,
    config: {
      ...(systemInstruction ? { systemInstruction } : {}),
      temperature: 0.1,
    },
  })

  return response.text || ''
}

/**
 * Get a LangChain Chat Model for use with ReAct agents or tool calling.
 * Respects the AI_PROVIDER (gemini vs ollama).
 */
export function getChatModel(usePro = false) {
  const provider = getProvider()
  if (provider === 'ollama') {
    const model = usePro ? getOllamaProModel() : getOllamaFlashModel()
    return new ChatOpenAI({
      modelName: model,
      temperature: 0.1,
      apiKey: process.env.OLLAMA_API_KEY || 'ollama',
      configuration: {
        baseURL: process.env.OLLAMA_BASE_URL || 'http://localhost:11434/v1',
      },
    })
  }

  const model = usePro ? 'gemini-2.5-pro' : 'gemini-2.5-flash'
  if (!process.env.GEMINI_API_KEY) throw new Error('GEMINI_API_KEY is not set')
  
  return new ChatGoogleGenerativeAI({
    model: model,
    temperature: 0.1,
    apiKey: process.env.GEMINI_API_KEY,
  })
}
