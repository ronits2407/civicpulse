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
 * NOTE: Embeddings always use Google's text-embedding-004 model because pgvector
 * dimensions are fixed at 768 to match that model. Changing embedding providers
 * would require re-embedding all stored vectors.
 */

import { GoogleGenerativeAI, GenerativeModel } from '@google/generative-ai'
import OpenAI from 'openai'

// ─── Provider detection ──────────────────────────────────────────────────────

export type AIProvider = 'gemini' | 'ollama'

function getProvider(): AIProvider {
  const raw = process.env.AI_PROVIDER?.toLowerCase()
  if (raw === 'ollama') return 'ollama'
  return 'gemini' // safe default
}

// ─── Gemini setup ────────────────────────────────────────────────────────────

let _genAI: GoogleGenerativeAI | null = null
function getGenAI(): GoogleGenerativeAI {
  if (!_genAI) {
    if (!process.env.GEMINI_API_KEY) throw new Error('GEMINI_API_KEY is not set')
    _genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY)
  }
  return _genAI
}

export function getGeminiFlashModel(): GenerativeModel {
  return getGenAI().getGenerativeModel({ model: 'gemini-2.5-flash' })
}

export function getGeminiProModel(): GenerativeModel {
  return getGenAI().getGenerativeModel({ model: 'gemini-2.5-pro' })
}

// ─── Ollama Cloud (OpenAI-compatible) setup ──────────────────────────────────

let _ollamaClient: OpenAI | null = null
function getOllamaClient(): OpenAI {
  if (!_ollamaClient) {
    _ollamaClient = new OpenAI({
      baseURL: process.env.OLLAMA_BASE_URL || 'http://localhost:11434/v1',
      apiKey: process.env.OLLAMA_API_KEY || 'ollama', // local ollama doesn't require a real API key
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

  // Default: Gemini
  const genAI = getGenAI()
  const geminiModel = genAI.getGenerativeModel({
    model: usePro ? 'gemini-2.5-pro' : 'gemini-2.5-flash',
    systemInstruction,
  })
  const result = await geminiModel.generateContent(prompt)
  const text = result.response.text()
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
    const imageData = await imageResponse.arrayBuffer()
    const base64Image = Buffer.from(imageData).toString('base64')
    const mimeType = imageResponse.headers.get('content-type') || 'image/jpeg'

    const visionModel = process.env.OLLAMA_VISION_MODEL || 'qwen2.5vl:72b-instruct-q4_K_M'
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
    })

    return response.choices[0]?.message?.content || ''
  }

  // Default: Gemini Flash (multimodal)
  const model = getGeminiFlashModel()
  const imageResponse = await fetch(imageUrl)
  const imageData = await imageResponse.arrayBuffer()
  const base64Image = Buffer.from(imageData).toString('base64')
  const mimeType = imageResponse.headers.get('content-type') || 'image/jpeg'

  const result = await model.generateContent([
    { inlineData: { data: base64Image, mimeType: mimeType as any } },
    prompt,
  ])
  return result.response.text()
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

  const model = getGenAI().getGenerativeModel({ model: 'gemini-embedding-001' })
  const result = await model.embedContent(text)
  return result.embedding.values
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

    const response = await client.chat.completions.create({ model, messages })
    return response.choices[0]?.message?.content || ''
  }

  // Gemini
  const genAI = getGenAI()
  const geminiModel = genAI.getGenerativeModel({
    model: usePro ? 'gemini-2.5-pro' : 'gemini-2.5-flash',
    ...(systemInstruction ? { systemInstruction } : {}),
  })
  const result = await geminiModel.generateContent(prompt)
  return result.response.text()
}
