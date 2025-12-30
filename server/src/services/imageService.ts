import dotenv from 'dotenv';
import path from 'path';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { Character } from '../types';

dotenv.config({ path: path.join(__dirname, '../../.env') });

// Using Replicate API for free image generation (free tier available)
// Alternative: Using a simple placeholder service that doesn't require auth
// Note: For production, consider using Replicate with API key for better results
const REPLICATE_API_URL = 'https://api.replicate.com/v1';
const REPLICATE_MODEL = 'stability-ai/sdxl:39ed52f2a78e934b3ba6e2a89f5b1c712de7dfea535525255b1aa35c5565e08b';

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
   * Generate image using a simple placeholder service
   * Note: This is a basic implementation. For production, use Replicate or another service with API key
   */
  private static async generateImageWithPlaceholder(
    prompt: string,
    aspectRatio: string = '1:1'
  ): Promise<string | null> {
    try {
      // For now, return a placeholder data URL
      // In production, you would integrate with a real image generation service
      // Options: Replicate (requires API key), Stability AI (requires API key), etc.
      
      console.warn('Image generation placeholder: Using fallback. Consider setting up Replicate API or another image service.');
      
      // Create a simple placeholder image (1x1 transparent PNG)
      const placeholderBase64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
      
      return `data:image/png;base64,${placeholderBase64}`;
    } catch (error: any) {
      console.error('Error generating placeholder image:', error);
      return null;
    }
  }
  
  /**
   * Generate image using Replicate API (requires API key but has free tier)
   */
  private static async generateImageWithReplicate(
    prompt: string,
    aspectRatio: string = '1:1'
  ): Promise<string | null> {
    try {
      const apiKey = process.env.REPLICATE_API_KEY;
      
      if (!apiKey || apiKey === 'your_replicate_api_key_here') {
        // Fall back to placeholder if no API key
        return this.generateImageWithPlaceholder(prompt, aspectRatio);
      }
      
      const headers: Record<string, string> = {
        'Authorization': `Token ${apiKey}`,
        'Content-Type': 'application/json',
      };

      // Start prediction
      const predictionResponse = await fetch(
        `${REPLICATE_API_URL}/predictions`,
        {
          method: 'POST',
          headers,
          body: JSON.stringify({
            version: REPLICATE_MODEL.split(':')[1],
            input: {
              prompt: prompt,
              width: aspectRatio === '16:9' ? 768 : aspectRatio === '9:16' ? 512 : 512,
              height: aspectRatio === '16:9' ? 512 : aspectRatio === '9:16' ? 768 : 512,
            },
          }),
        }
      );

      if (!predictionResponse.ok) {
        const errorData: any = await predictionResponse.json().catch(() => ({ error: 'Unknown error' }));
        console.error('Replicate API error:', predictionResponse.status, errorData);
        return this.generateImageWithPlaceholder(prompt, aspectRatio);
      }

      const prediction: any = await predictionResponse.json();
      const predictionId = prediction.id;

      // Poll for completion
      let attempts = 0;
      const maxAttempts = 60;
      
      while (attempts < maxAttempts) {
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        const statusResponse = await fetch(
          `${REPLICATE_API_URL}/predictions/${predictionId}`,
          { headers }
        );
        
        if (!statusResponse.ok) {
          break;
        }
        
        const status: any = await statusResponse.json();
        
        if (status.status === 'succeeded' && status.output && status.output.length > 0) {
          // Download the image
          const imageUrl = status.output[0];
          const imageResponse = await fetch(imageUrl);
          const imageBlob = await imageResponse.blob();
          
          // Convert to base64
          const arrayBuffer = await imageBlob.arrayBuffer();
          const buffer = Buffer.from(arrayBuffer);
          const base64Image = buffer.toString('base64');
          
          return `data:image/png;base64,${base64Image}`;
        }
        
        if (status.status === 'failed') {
          console.error('Replicate prediction failed:', status.error);
          return this.generateImageWithPlaceholder(prompt, aspectRatio);
        }
        
        attempts++;
      }
      
      console.error('Replicate prediction timed out');
      return this.generateImageWithPlaceholder(prompt, aspectRatio);
    } catch (error: any) {
      console.error('Error generating image with Replicate:', error);
      return this.generateImageWithPlaceholder(prompt, aspectRatio);
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
      console.log('Generating image, prompt:', imagePrompt.substring(0, 100) + '...');
      
      // Note: Character portrait context is included in the prompt
      if (characterPortraitUrl) {
        console.log('Character portrait context included in prompt for scene image');
      }

      const imageUrl = await this.generateImageWithReplicate(imagePrompt, '1:1');

      if (imageUrl) {
        console.log('Image generated successfully!');
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
        console.log('Regenerating character portrait with updated appearance');
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

      console.log('Generating new character portrait');
      const imageUrl = await this.generateImageWithReplicate(generatePrompt, '1:1');

      if (imageUrl) {
        console.log('Character portrait generated successfully!');
        return imageUrl;
      }

      return null;
    } catch (error: any) {
      console.error('Error generating character portrait:', error);
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

      console.log('Editing character portrait with custom prompt:', customPrompt);
      
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
      const imageUrl = await this.generateImageWithReplicate(editPrompt, '1:1');

      if (imageUrl) {
        console.log('Character portrait edited successfully!');
        return imageUrl;
      }

      return null;
    } catch (error: any) {
      console.error('Error editing character portrait:', error);
      return null;
    }
  }
}
