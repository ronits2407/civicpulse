import { OpenAI } from 'openai'

async function run() {
  try {
    const client = new OpenAI({
      baseURL: process.env.OLLAMA_BASE_URL || 'http://localhost:11434/v1',
      apiKey: 'ollama'
    })
    
    // We'll try to send a tiny 1x1 png image
    const base64Image = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII='
    const mimeType = 'image/png'

    console.log('Sending to Ollama...')
    const response = await client.chat.completions.create({
      model: 'llava',
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'image_url',
              image_url: { url: `data:${mimeType};base64,${base64Image}` },
            },
            { type: 'text', text: 'What is this?' },
          ],
        },
      ],
      temperature: 0.1,
    })

    console.log(response.choices[0]?.message?.content)
  } catch (err: any) {
    console.error(err)
  }
}

run()
