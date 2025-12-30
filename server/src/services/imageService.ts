import dotenv from 'dotenv';
import path from 'path';
import { Character } from '../types';

dotenv.config({ path: path.join(__dirname, '../../.env') });

// Using Nano Banana Free API for image generation
// Note: Free tier may have rate limits and lower resolution
const NANO_BANANA_API_URL = 'https://gateway.nanobananapro.site/api/v1';
const NANO_BANANA_MODEL = 'nano-banana-free'; // Free tier model

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
   * Poll for image generation completion
   */
  private static async pollForImageCompletion(taskId: string, apiKey: string, maxAttempts: number = 60): Promise<string | null> {
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      await new Promise(resolve => setTimeout(resolve, 2000)); // Wait 2 seconds between polls
      
      try {
        const response = await fetch(`${NANO_BANANA_API_URL}/status/${taskId}`, {
          headers: {
            'Authorization': `Bearer ${apiKey}`,
          },
        });

        if (!response.ok) {
          console.error('Error checking task status:', response.status);
          continue;
        }

        const data: any = await response.json();
        
        if (data.status === 'completed' && (data.image_url || data.url)) {
          return data.image_url || data.url;
        }
        
        if (data.status === 'failed') {
          console.error('Image generation failed:', data.error);
          return null;
        }
        
        // Still processing
        if (attempt % 10 === 0) {
          console.log(`Still generating image... (${attempt * 2}s)`);
        }
      } catch (error) {
        console.error('Error polling for image:', error);
      }
    }
    
    console.error('Image generation timed out');
    return null;
  }

  /**
   * Generate a comic panel image using Nano Banana Pro
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
      console.log('Generating image with Nano Banana Pro, prompt:', imagePrompt.substring(0, 100) + '...');
      
      const apiKey = process.env.NANO_BANANA_API_KEY;
      
      if (!apiKey || apiKey === 'your_nano_banana_api_key_here') {
        throw new Error('NANO_BANANA_API_KEY is not set. Please add your Nano Banana Pro API key to server/.env');
      }

      // Build request body with prompt and optional character portrait as reference
      const requestBody: any = {
        model: NANO_BANANA_MODEL,
        prompt: imagePrompt,
        resolution: '2K',
        aspect_ratio: '1:1',
      };

      // If character portrait is provided, use it as a reference image
      if (characterPortraitUrl) {
        requestBody.reference_image = characterPortraitUrl;
        requestBody.reference_strength = 0.7; // How much to follow the reference (0-1)
        console.log('Using character portrait as reference for scene image');
      }

      // Generate image using Nano Banana Pro API
      const response = await fetch(`${NANO_BANANA_API_URL}/images/generate`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
        console.error('Nano Banana Pro API error:', response.status, errorData);
        return null;
      }

      const data: any = await response.json();
      
      // Check if response contains task ID (async processing)
      if (data.task_id) {
        // Poll for completion
        const imageUrl = await this.pollForImageCompletion(data.task_id, apiKey);
        if (imageUrl) {
          return { imageUrl, imagePrompt };
        }
        return null;
      }
      
      // If image is returned directly
      if (data.image_url || data.url) {
        const imageUrl = data.image_url || data.url;
        console.log('Image generated successfully with Nano Banana Pro!');
        return {
          imageUrl,
          imagePrompt
        };
      }

      console.error('Unexpected response format from Nano Banana Pro:', data);
      return null;
    } catch (error: any) {
      console.error('Error generating comic panel image with Nano Banana Pro:', error);
      
      if (error?.message?.includes('API_KEY') || error?.message?.includes('authentication')) {
        console.error('❌ Nano Banana Pro API authentication failed. Check your NANO_BANANA_API_KEY in server/.env');
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
   * Generate a character portrait for consistency using Nano Banana Pro
   */
  static async generateCharacterPortrait(character: Character, existingPortraitUrl?: string): Promise<string | null> {
    try {
      const apiKey = process.env.NANO_BANANA_API_KEY;
      
      if (!apiKey || apiKey === 'your_nano_banana_api_key_here') {
        throw new Error('NANO_BANANA_API_KEY is not set. Please add your Nano Banana Pro API key to server/.env');
      }

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
      
      const editPrompt = `Update the character's appearance to match: ${character.appearance}, ${clothingDescription}cyberware and augmentations: ${character.augmentations}. Keep the same character, same pose, same background, but update only the appearance details, clothing, and cyberware to match the new description.`;

      // If we have an existing portrait, edit it instead of generating new
      if (existingPortraitUrl) {
        console.log('Editing existing character portrait with Nano Banana Pro');
        
        const response = await fetch(`${NANO_BANANA_API_URL}/images/edit`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: NANO_BANANA_MODEL,
            prompt: editPrompt,
            image_input: [existingPortraitUrl],
            resolution: '2K',
            aspect_ratio: '1:1',
          }),
        });

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
          console.error('Nano Banana Pro edit API error:', response.status, errorData);
          // Fall through to generate new if edit fails
        } else {
          const data: any = await response.json();
          
          if (data.task_id) {
            const imageUrl = await this.pollForImageCompletion(data.task_id, apiKey);
            if (imageUrl) {
              console.log('Character portrait edited successfully with Nano Banana Pro!');
              return imageUrl;
            }
          } else if (data.image_url || data.url) {
            console.log('Character portrait edited successfully with Nano Banana Pro!');
            return data.image_url || data.url;
          }
        }
      }

      // Generate new portrait if no existing one or edit failed
      console.log('Generating new character portrait with Nano Banana Pro');
      
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

      const response = await fetch(`${NANO_BANANA_API_URL}/images/generate`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: NANO_BANANA_MODEL,
          prompt: generatePrompt,
          resolution: '2K',
          aspect_ratio: '1:1',
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
        console.error('Nano Banana Pro API error for portrait:', response.status, errorData);
        return null;
      }

      const data: any = await response.json();
      
      if (data.task_id) {
        const imageUrl = await this.pollForImageCompletion(data.task_id, apiKey);
        if (imageUrl) {
          console.log('Character portrait generated successfully with Nano Banana Pro!');
          return imageUrl;
        }
        return null;
      }
      
      if (data.image_url || data.url) {
        console.log('Character portrait generated successfully with Nano Banana Pro!');
        return data.image_url || data.url;
      }

      console.error('Unexpected response format from Nano Banana Pro for portrait:', data);
      return null;
    } catch (error: any) {
      console.error('Error generating character portrait with Nano Banana Pro:', error);
      
      if (error?.message?.includes('API_KEY') || error?.message?.includes('authentication')) {
        console.error('❌ Nano Banana Pro API authentication failed. Check your NANO_BANANA_API_KEY in server/.env');
      }
      
      return null;
    }
  }

  /**
   * Edit a character portrait with a custom prompt
   */
  static async editCharacterPortrait(
    character: Character,
    existingPortraitUrl: string,
    customPrompt: string
  ): Promise<string | null> {
    try {
      const apiKey = process.env.NANO_BANANA_API_KEY;
      
      if (!apiKey || apiKey === 'your_nano_banana_api_key_here') {
        throw new Error('NANO_BANANA_API_KEY is not set. Please add your Nano Banana Pro API key to server/.env');
      }

      if (!existingPortraitUrl) {
        throw new Error('Existing portrait URL is required for editing');
      }

      console.log('Editing character portrait with custom prompt:', customPrompt);
      
      // Build the edit prompt - combine custom prompt with character context
      const editPrompt = `${customPrompt}. Keep the same character, same pose, same background style, but apply the requested changes. Maintain anime cyberpunk art style.`;
      
      const response = await fetch(`${NANO_BANANA_API_URL}/images/edit`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: NANO_BANANA_MODEL,
          prompt: editPrompt,
          image_input: [existingPortraitUrl],
          resolution: '2K',
          aspect_ratio: '1:1',
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
        console.error('Nano Banana Pro edit API error:', response.status, errorData);
        return null;
      }

      const data: any = await response.json();
      
      if (data.task_id) {
        const imageUrl = await this.pollForImageCompletion(data.task_id, apiKey);
        if (imageUrl) {
          console.log('Character portrait edited successfully with Nano Banana Pro!');
          return imageUrl;
        }
        return null;
      }
      
      if (data.image_url || data.url) {
        console.log('Character portrait edited successfully with Nano Banana Pro!');
        return data.image_url || data.url;
      }

      console.error('Unexpected response format from Nano Banana Pro for portrait edit:', data);
      return null;
    } catch (error: any) {
      console.error('Error editing character portrait with Nano Banana Pro:', error);
      
      if (error?.message?.includes('API_KEY') || error?.message?.includes('authentication')) {
        console.error('❌ Nano Banana Pro API authentication failed. Check your NANO_BANANA_API_KEY in server/.env');
      }
      
      return null;
    }
  }
}


