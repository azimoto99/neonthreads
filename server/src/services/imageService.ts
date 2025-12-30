import dotenv from 'dotenv';
import path from 'path';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { Character } from '../types';

dotenv.config({ path: path.join(__dirname, '../../.env') });

// Using Google Imagen for image generation (free tier)
const IMAGEN_MODEL = 'imagen-3.0-generate-001';

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
   * Generate image using Google Imagen API
   */
  private static async generateImageWithImagen(
    prompt: string,
    aspectRatio: string = '1:1'
  ): Promise<string | null> {
    try {
      const apiKey = process.env.GEMINI_API_KEY;
      
      if (!apiKey || apiKey === 'your_gemini_api_key_here') {
        throw new Error('GEMINI_API_KEY is not set. Please add your Gemini API key to server/.env');
      }

      // Use Imagen API through Vertex AI endpoint
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${IMAGEN_MODEL}:generateImages?key=${apiKey}`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            prompt: prompt,
            number_of_images: 1,
            aspect_ratio: aspectRatio,
            safety_filter_level: 'block_some',
            person_generation: 'allow_all',
          }),
        }
      );

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
        console.error('Imagen API error:', response.status, errorData);
        return null;
      }

      const data: any = await response.json();
      
      // Imagen returns images in the response
      if (data.generatedImages && data.generatedImages.length > 0) {
        const imageData = data.generatedImages[0];
        
        // Imagen returns base64 encoded images
        if (imageData.base64String) {
          return `data:image/png;base64,${imageData.base64String}`;
        }
        
        // Or it might return a URL
        if (imageData.imageUrl || imageData.url) {
          return imageData.imageUrl || imageData.url;
        }
      }

      console.error('Unexpected response format from Imagen:', data);
      return null;
    } catch (error: any) {
      console.error('Error generating image with Google Imagen:', error);
      
      if (error?.message?.includes('API_KEY') || error?.message?.includes('authentication')) {
        console.error('❌ Google Imagen API authentication failed. Check your GEMINI_API_KEY in server/.env');
      }
      
      return null;
    }
  }

  /**
   * Generate a comic panel image using Google Imagen
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
    characterPortraitUrl?: string // Optional: use character portrait as context (note: Imagen may not support this directly)
  ): Promise<{ imageUrl: string; imagePrompt: string } | null> {
    try {
      const imagePrompt = this.generateImagePrompt(character, scenario, sceneType, storyContext);
      console.log('Generating image with Google Imagen, prompt:', imagePrompt.substring(0, 100) + '...');
      
      // Note: Imagen doesn't directly support reference images in the same way
      // The character portrait context is included in the prompt instead
      if (characterPortraitUrl) {
        console.log('Character portrait context included in prompt for scene image');
      }

      const imageUrl = await this.generateImageWithImagen(imagePrompt, '1:1');

      if (imageUrl) {
        console.log('Image generated successfully with Google Imagen!');
        return {
          imageUrl,
          imagePrompt
        };
      }

      return null;
    } catch (error: any) {
      console.error('Error generating comic panel image with Google Imagen:', error);
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
   * Generate a character portrait using Google Imagen
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
      // Note: Imagen doesn't have direct image editing, so we regenerate
      if (existingPortraitUrl) {
        console.log('Regenerating character portrait with updated appearance using Google Imagen');
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

      console.log('Generating new character portrait with Google Imagen');
      const imageUrl = await this.generateImageWithImagen(generatePrompt, '1:1');

      if (imageUrl) {
        console.log('Character portrait generated successfully with Google Imagen!');
        return imageUrl;
      }

      return null;
    } catch (error: any) {
      console.error('Error generating character portrait with Google Imagen:', error);
      
      if (error?.message?.includes('API_KEY') || error?.message?.includes('authentication')) {
        console.error('❌ Google Imagen API authentication failed. Check your GEMINI_API_KEY in server/.env');
      }
      
      return null;
    }
  }

  /**
   * Edit a character portrait with a custom prompt
   * Note: Imagen doesn't support direct image editing, so we regenerate with the edit prompt
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

      console.log('Editing character portrait with Google Imagen, custom prompt:', customPrompt);
      
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
      const imageUrl = await this.generateImageWithImagen(editPrompt, '1:1');

      if (imageUrl) {
        console.log('Character portrait edited successfully with Google Imagen!');
        return imageUrl;
      }

      return null;
    } catch (error: any) {
      console.error('Error editing character portrait with Google Imagen:', error);
      
      if (error?.message?.includes('API_KEY') || error?.message?.includes('authentication')) {
        console.error('❌ Google Imagen API authentication failed. Check your GEMINI_API_KEY in server/.env');
      }
      
      return null;
    }
  }
}
