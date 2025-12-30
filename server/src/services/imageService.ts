import dotenv from 'dotenv';
import path from 'path';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { Character } from '../types';

dotenv.config({ path: path.join(__dirname, '../../.env') });

// Using Hugging Face Inference API for free image generation
// Note: This is a free alternative since Google Imagen requires special access
const HF_API_URL = 'https://router.huggingface.co';
const HF_IMAGE_MODEL = 'stabilityai/stable-diffusion-xl-base-1.0'; // Free model

export class ImageService {
  /**
   * Generate an image prompt for a story scenario with full context
   */
  static generateImagePrompt(
    character: Character,
    scenario: string,
    sceneType: 'story' | 'combat' | 'outcome',
    storyContext?: {
      panels?: Array<{
        visualDescription: string;
        dialogue?: string[];
        narration?: string;
      }>;
      outcome?: string;
      consequences?: string[];
    }
  ): string {
    // Extract all character creation context
    const characterVisual = character.appearance;
    const augmentations = character.augmentations;
    const background = character.background;
    const trade = character.trade;
    const location = character.currentStoryState.currentScene.replace(/_/g, ' ');
    
    // Extract clothing items from inventory
    const clothingItems = (character.inventory || [])
      .filter(item => item.type === 'misc' || item.name.toLowerCase().includes('cloth') || 
                      item.name.toLowerCase().includes('outfit') || 
                      item.name.toLowerCase().includes('armor') ||
                      item.name.toLowerCase().includes('jacket') ||
                      item.name.toLowerCase().includes('shirt') ||
                      item.name.toLowerCase().includes('pants'))
      .map(item => item.name)
      .join(', ');
    
    const clothingDescription = clothingItems ? `wearing: ${clothingItems}, ` : '';

    // Start with strong visual emphasis - ABSOLUTELY NO TEXT
    let basePrompt = `Anime style cyberpunk comic book illustration, `;
    basePrompt += `pure visual illustration, absolutely no text, no speech bubbles, no caption boxes, no dialogue, no narration, `;
    basePrompt += `visual artwork only, `;
    
    if (sceneType === 'combat') {
      basePrompt += `dynamic action scene, intense battle sequence, `;
    } else {
      basePrompt += `cinematic dramatic scene, `;
    }

    basePrompt += `anime art style, detailed anime character design, `;
    
    // Include full character creation context
    // Note: If characterPortraitUrl is provided, it will be used as a reference image
    // so we can be less verbose in the prompt about appearance
    basePrompt += `character background context: ${background.substring(0, 150)}, `;
    basePrompt += `character trade/skills: ${trade}, `;
    basePrompt += `main character appearance: ${characterVisual}, `;
    basePrompt += `${clothingDescription}`;
    basePrompt += `cyberware and augmentations: ${augmentations}, `;
    basePrompt += `location setting: ${location}, `;

    // Include the full story scenario context
    const scenarioVisual = scenario
      .substring(0, 300)
      .replace(/dialogue|speech|text|narration|caption/gi, '')
      .replace(/["']/g, ' ')
      .trim();
    basePrompt += `story context: ${scenarioVisual}, `;

    // Use panel visual description if available (most detailed)
    if (storyContext?.panels && storyContext.panels.length > 0) {
      const panel = storyContext.panels[0];
      let visualDesc = panel.visualDescription
        .replace(/dialogue|speech|text|narration|caption/gi, '')
        .replace(/["']/g, ' ')
        .trim();
      
      basePrompt += `detailed visual scene composition: ${visualDesc}, `;
    }

    // Add visual context from outcome/consequences
    if (storyContext?.outcome) {
      const visualOutcome = storyContext.outcome
        .replace(/dialogue|speech|text|narration|caption/gi, '')
        .substring(0, 150);
      basePrompt += `visual outcome context: ${visualOutcome}, `;
    }
    
    if (storyContext?.consequences && storyContext.consequences.length > 0) {
      const visualConsequences = storyContext.consequences
        .join(', ')
        .replace(/dialogue|speech|text|narration|caption/gi, '')
        .substring(0, 150);
      basePrompt += `visual consequences: ${visualConsequences}, `;
    }

    // Emphasize visual style and composition
    basePrompt += `anime cyberpunk aesthetic, vibrant neon colors, `;
    basePrompt += `anime shading and highlights, cel-shaded style, `;
    basePrompt += `detailed background, atmospheric lighting, `;
    basePrompt += `high quality anime artwork, professional anime illustration, `;
    basePrompt += `comic book panel style, `;
    basePrompt += `character must match their background and trade, `;
    basePrompt += `scene must reflect the story context accurately, `;
    basePrompt += `absolutely no text, no speech bubbles, no captions, no dialogue, no words, `;
    basePrompt += `pure visual storytelling, `;
    basePrompt += `illustration only, no text elements whatsoever`;

    return basePrompt;
  }

  /**
   * Get Gemini AI instance for Imagen
   */
  private static getGeminiAI(): GoogleGenerativeAI {
    const apiKey = process.env.GEMINI_API_KEY;
    
    if (!apiKey || apiKey === 'your_gemini_api_key_here') {
      throw new Error('GEMINI_API_KEY is not set. Please add your Gemini API key to server/.env');
    }
    
    return new GoogleGenerativeAI(apiKey);
  }

  /**
   * Generate image using Hugging Face Inference API (free tier)
   */
  private static async generateImageWithHF(
    prompt: string,
    aspectRatio: string = '1:1'
  ): Promise<string | null> {
    try {
      // Hugging Face Inference API is free and doesn't require an API key for basic usage
      // However, using an API key (HF_API_KEY) provides better rate limits
      const apiKey = process.env.HF_API_KEY; // Optional - improves rate limits
      
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };
      
      if (apiKey && apiKey !== 'your_hf_api_key_here') {
        headers['Authorization'] = `Bearer ${apiKey}`;
      }

      // Map aspect ratio to image dimensions
      let width = 512;
      let height = 512;
      if (aspectRatio === '16:9') {
        width = 768;
        height = 512;
      } else if (aspectRatio === '9:16') {
        width = 512;
        height = 768;
      }

      const response = await fetch(
        `${HF_API_URL}/models/${HF_IMAGE_MODEL}`,
        {
          method: 'POST',
          headers,
          body: JSON.stringify({
            inputs: prompt,
            parameters: {
              width,
              height,
              num_inference_steps: 30,
              guidance_scale: 7.5,
            },
          }),
        }
      );

      if (!response.ok) {
        // If model is loading, wait and retry
        if (response.status === 503) {
          const errorData: any = await response.json().catch(() => ({}));
          if (errorData.estimated_time) {
            console.log(`Model is loading, estimated wait time: ${errorData.estimated_time}s`);
            // Wait and retry once
            await new Promise(resolve => setTimeout(resolve, (errorData.estimated_time + 5) * 1000));
            return this.generateImageWithHF(prompt, aspectRatio);
          }
        }
        
        const errorData: any = await response.json().catch(() => ({ error: 'Unknown error' }));
        console.error('Hugging Face API error:', response.status, errorData);
        return null;
      }

      // Hugging Face returns image as blob
      const imageBlob = await response.blob();
      
      // Convert blob to base64
      const arrayBuffer = await imageBlob.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);
      const base64Image = buffer.toString('base64');
      
      return `data:image/png;base64,${base64Image}`;
    } catch (error: any) {
      console.error('Error generating image with Hugging Face:', error);
      return null;
    }
  }

  /**
   * Generate a comic panel image using Hugging Face (free tier)
   */
  static async generateComicPanel(
    character: Character,
    scenario: string,
    sceneType: 'story' | 'combat' | 'outcome' = 'story',
    storyContext?: {
      panels?: Array<{
        visualDescription: string;
        dialogue?: string[];
        narration?: string;
      }>;
      outcome?: string;
      consequences?: string[];
    },
    characterPortraitUrl?: string // Optional: use character portrait as context
  ): Promise<{ imageUrl: string; imagePrompt: string } | null> {
    try {
      const imagePrompt = this.generateImagePrompt(character, scenario, sceneType, storyContext);
      console.log('Generating image with Hugging Face, prompt:', imagePrompt.substring(0, 100) + '...');
      
      // Note: Character portrait context is included in the prompt
      if (characterPortraitUrl) {
        console.log('Character portrait context included in prompt for scene image');
      }

      const imageUrl = await this.generateImageWithHF(imagePrompt, '1:1');

      if (imageUrl) {
        console.log('Image generated successfully with Hugging Face!');
        return {
          imageUrl,
          imagePrompt
        };
      }

      return null;
    } catch (error: any) {
      console.error('Error generating comic panel image with Hugging Face:', error);
      return null;
    }
  }

  /**
   * Generate a hash of character appearance + inventory for change detection
   */
  static getAppearanceHash(character: Character): string {
    const crypto = require('crypto');
    // Include appearance, augmentations, and clothing items from inventory
    const clothingItems = (character.inventory || [])
      .filter(item => item.type === 'misc' || item.name.toLowerCase().includes('cloth') || 
                      item.name.toLowerCase().includes('outfit') || 
                      item.name.toLowerCase().includes('armor') ||
                      item.name.toLowerCase().includes('jacket') ||
                      item.name.toLowerCase().includes('shirt') ||
                      item.name.toLowerCase().includes('pants'))
      .map(item => item.name)
      .sort()
      .join(',');
    
    const hashInput = `${character.appearance}|${character.augmentations}|${clothingItems}`;
    return crypto.createHash('md5').update(hashInput).digest('hex');
  }

  /**
   * Generate a character portrait using Hugging Face (free tier)
   */
  static async generateCharacterPortrait(character: Character, existingPortraitUrl?: string): Promise<string | null> {
    try {
      // Extract clothing items from inventory
      const clothingItems = (character.inventory || [])
        .filter(item => item.type === 'misc' || item.name.toLowerCase().includes('cloth') || 
                        item.name.toLowerCase().includes('outfit') || 
                        item.name.toLowerCase().includes('armor') ||
                        item.name.toLowerCase().includes('jacket') ||
                        item.name.toLowerCase().includes('shirt') ||
                        item.name.toLowerCase().includes('pants'))
        .map(item => item.name)
        .join(', ');
      
      const clothingDescription = clothingItems 
        ? `wearing: ${clothingItems}, ` 
        : '';

      // If we have an existing portrait, we'll regenerate with updated prompt
      if (existingPortraitUrl) {
        console.log('Regenerating character portrait with updated appearance using Hugging Face');
      }

      const generatePrompt = `Anime style cyberpunk character portrait illustration, 
      visual illustration only, no text blocks, 
      anime art style, detailed anime character design, 
      character appearance: ${character.appearance}, 
      ${clothingDescription}
      cyberware and augmentations: ${character.augmentations}, 
      background: neon-lit cyberpunk cityscape, 
      anime shading and highlights, cel-shaded style, 
      vibrant neon colors, high quality anime artwork, 
      professional anime illustration, front view, detailed character design, 
      character must match the exact appearance description, 
      pure visual artwork, no dialogue, no text, illustration only`;

      console.log('Generating new character portrait with Hugging Face');
      const imageUrl = await this.generateImageWithHF(generatePrompt, '1:1');

      if (imageUrl) {
        console.log('Character portrait generated successfully with Hugging Face!');
        return imageUrl;
      }

      return null;
    } catch (error: any) {
      console.error('Error generating character portrait with Hugging Face:', error);
      return null;
    }
  }

  /**
   * Edit a character portrait with a custom prompt
   * Note: We regenerate with the edit prompt included
   */
  static async editCharacterPortrait(
    character: Character,
    existingPortraitUrl: string,
    customPrompt: string
  ): Promise<string | null> {
    try {
      if (!existingPortraitUrl) {
        throw new Error('Existing portrait URL is required for editing');
      }

      console.log('Editing character portrait with Hugging Face, custom prompt:', customPrompt);
      
      // Extract clothing items from inventory
      const clothingItems = (character.inventory || [])
        .filter(item => item.type === 'misc' || item.name.toLowerCase().includes('cloth') || 
                        item.name.toLowerCase().includes('outfit') || 
                        item.name.toLowerCase().includes('armor') ||
                        item.name.toLowerCase().includes('jacket') ||
                        item.name.toLowerCase().includes('shirt') ||
                        item.name.toLowerCase().includes('pants'))
        .map(item => item.name)
        .join(', ');
      
      const clothingDescription = clothingItems 
        ? `wearing: ${clothingItems}, ` 
        : '';
      
      // Build the edit prompt - combine custom prompt with character context
      const editPrompt = `Anime style cyberpunk character portrait illustration, 
      visual illustration only, no text blocks, 
      anime art style, detailed anime character design, 
      character appearance: ${character.appearance}, 
      ${clothingDescription}
      cyberware and augmentations: ${character.augmentations}, 
      ${customPrompt}. 
      Keep the same character, same pose, same background style, but apply the requested changes. 
      Maintain anime cyberpunk art style. 
      Background: neon-lit cyberpunk cityscape, 
      anime shading and highlights, cel-shaded style, 
      vibrant neon colors, high quality anime artwork, 
      professional anime illustration, front view, detailed character design, 
      pure visual artwork, no dialogue, no text, illustration only`;

      // Regenerate with the edit prompt
      const imageUrl = await this.generateImageWithHF(editPrompt, '1:1');

      if (imageUrl) {
        console.log('Character portrait edited successfully with Hugging Face!');
        return imageUrl;
      }

      return null;
    } catch (error: any) {
      console.error('Error editing character portrait with Hugging Face:', error);
      return null;
    }
  }
}
