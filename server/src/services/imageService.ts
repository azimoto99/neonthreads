import { GoogleGenerativeAI } from '@google/generative-ai';
import dotenv from 'dotenv';
import path from 'path';
import { Character } from '../types';

dotenv.config({ path: path.join(__dirname, '../../.env') });

// Using Google Imagen via Gemini API
const IMAGEN_MODEL = 'imagen-3.0-generate-001'; // or 'imagen-3.0-fast-generate-001' for faster generation

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
    basePrompt += `character background context: ${background.substring(0, 150)}, `;
    basePrompt += `character trade/skills: ${trade}, `;
    basePrompt += `character appearance: ${characterVisual}, `;
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
      throw new Error('GEMINI_API_KEY is not set or is still using placeholder value. Please add your actual Gemini API key to server/.env');
    }
    
    return new GoogleGenerativeAI(apiKey);
  }

  /**
   * Generate a comic panel image using Google Imagen via Gemini API
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
    }
  ): Promise<{ imageUrl: string; imagePrompt: string } | null> {
    try {
      const imagePrompt = this.generateImagePrompt(character, scenario, sceneType, storyContext);
      console.log('Generating image with Imagen, prompt:', imagePrompt.substring(0, 100) + '...');
      
      const genAI = this.getGeminiAI();
      
      // Use Imagen through the Generative AI API
      // Note: Imagen is accessed via the REST API endpoint
      const apiKey = process.env.GEMINI_API_KEY;
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${IMAGEN_MODEL}:generateImages?key=${apiKey}`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            prompt: imagePrompt,
            number_of_images: 1,
            aspect_ratio: '1:1',
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
      
      if (!data.generatedImages || data.generatedImages.length === 0) {
        console.error('No images returned from Imagen');
        return null;
      }

      // Imagen returns base64 encoded images
      const generatedImage = data.generatedImages[0];
      const base64Image = generatedImage.base64String;
      
      if (!base64Image) {
        console.error('No base64 image data in response');
        return null;
      }

      // Convert base64 to data URL
      const imageUrl = `data:image/png;base64,${base64Image}`;
      
      console.log('Image generated successfully with Imagen!');
      return {
        imageUrl,
        imagePrompt
      };
    } catch (error: any) {
      console.error('Error generating comic panel image with Imagen:', error);
      
      if (error?.message?.includes('API_KEY') || error?.message?.includes('authentication')) {
        console.error('❌ Imagen API authentication failed. Check your GEMINI_API_KEY in server/.env');
      }
      
      // Return null to allow story to continue without image
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
   * Generate a character portrait for consistency using Google Imagen
   */
  static async generateCharacterPortrait(character: Character): Promise<string | null> {
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
      
      const prompt = `Anime style cyberpunk character portrait illustration, 
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

      console.log('Generating character portrait with Imagen');
      
      const apiKey = process.env.GEMINI_API_KEY;
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
            aspect_ratio: '1:1',
            safety_filter_level: 'block_some',
            person_generation: 'allow_all',
          }),
        }
      );

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
        console.error('Imagen API error for portrait:', response.status, errorData);
        return null;
      }

      const data: any = await response.json();
      
      if (!data.generatedImages || data.generatedImages.length === 0) {
        console.error('No images returned from Imagen for portrait');
        return null;
      }

      // Imagen returns base64 encoded images
      const generatedImage = data.generatedImages[0];
      const base64Image = generatedImage.base64String;
      
      if (!base64Image) {
        console.error('No base64 image data in portrait response');
        return null;
      }

      // Convert base64 to data URL
      const imageUrl = `data:image/png;base64,${base64Image}`;
      
      console.log('Character portrait generated successfully with Imagen!');
      return imageUrl;
    } catch (error: any) {
      console.error('Error generating character portrait with Imagen:', error);
      
      if (error?.message?.includes('API_KEY') || error?.message?.includes('authentication')) {
        console.error('❌ Imagen API authentication failed. Check your GEMINI_API_KEY in server/.env');
      }
      
      return null;
    }
  }
}


