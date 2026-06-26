import { analyzeImage, generateStructuredJSON, getGeminiFlashModel } from './lib/ai/client';
import fs from 'fs';

async function main() {
  console.log("=== Testing AI Agent Calls ===");
  try {
    console.log("\n1. Testing Image Analysis (Vision Model)");
    const imagePath = "C:/Users/RONIT/Downloads/64992955.avif";
    
    // We override fetch globally just for this test to allow local files
    const originalFetch = global.fetch;
    global.fetch = async (url: string | URL | Request, options?: RequestInit) => {
      const urlStr = url.toString();
      if (urlStr.startsWith('C:') || urlStr.startsWith('file://')) {
        const path = urlStr.replace('file:///', '');
        const buffer = fs.readFileSync(path);
        return {
          arrayBuffer: async () => buffer,
          headers: { get: () => 'image/avif' }
        } as any;
      }
      return originalFetch(url, options);
    };

    const prompt = "Describe this image.";
    const imageResult = await analyzeImage(imagePath, prompt);
    console.log("Image Analysis Result:", imageResult);
  } catch (e: any) {
    console.error("Image Analysis Error:", e.message);
  }

  try {
    console.log("\n2. Testing Structured JSON (Classifier)");
    const system = "Respond with valid JSON: { \"category\": \"test\" }";
    const prompt = "Classify this report: scootie fell into a pothole";
    const jsonResult = await generateStructuredJSON(prompt, system);
    console.log("JSON Result:", jsonResult);
  } catch (e: any) {
    console.error("JSON Generation Error:", e.message);
  }
}

main().catch(console.error);
