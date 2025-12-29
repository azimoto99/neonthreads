import dotenv from 'dotenv';
import path from 'path';
import { Character } from '../types';

dotenv.config({ path: path.join(__dirname, '../../.env') });

// Using AI Horde (Stable Horde) API
const AI_HORDE_API_URL = 'https://stablehorde.net/api/v2';
// Default model for anime-style images - can be changed via env variable
const DEFAULT_MODEL = process.env.AI_HORDE_MODEL || 'Deliberate';

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
   * Generate a comic panel image using AI Horde (Stable Horde)
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
      const apiKey = process.env.AI_HORDE_API_KEY;
      
      // AI Horde API key is optional but recommended for priority
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        'apikey': apiKey || '0000000000' // Anonymous key if not provided
      };
      
      if (apiKey) {
        headers['apikey'] = apiKey;
      }
      
      console.log('Generating image with AI Horde, prompt:', imagePrompt.substring(0, 100) + '...');
      
      // Create async generation request
      const createResponse = await fetch(`${AI_HORDE_API_URL}/generate/async`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          prompt: imagePrompt,
          params: {
            n: 1, // Number of images
            width: 512,
            height: 512,
            steps: 30,
            cfg_scale: 7.5,
            sampler_name: 'k_euler_a',
            karras: true,
            post_processing: ['GFPGAN'] // Optional face enhancement
          },
          models: [DEFAULT_MODEL],
          nsfw: false,
          trusted_workers: false,
          censor_nsfw: true
        })
      });

      if (!createResponse.ok) {
        const errorText = await createResponse.text();
        console.error('AI Horde API error creating request:', createResponse.status, errorText);
        return null;
      }

      const requestData: any = await createResponse.json();
      const requestId = requestData.id;
      
      if (!requestId) {
        console.error('No request ID returned from AI Horde');
        return null;
      }
      
      console.log('Request created, ID:', requestId);
      
      // Poll for completion
      let isDone = false;
      let attempts = 0;
      const maxAttempts = 120; // 120 seconds max wait (AI Horde can be slower)
      
      while (!isDone && attempts < maxAttempts) {
        await new Promise(resolve => setTimeout(resolve, 2000)); // Check every 2 seconds
        
        const checkResponse = await fetch(`${AI_HORDE_API_URL}/generate/check/${requestId}`, {
          headers: apiKey ? { 'apikey': apiKey } : {}
        });
        
        if (!checkResponse.ok) {
          console.error('Error checking request status:', checkResponse.status);
          break;
        }
        
        const status: any = await checkResponse.json();
        
        if (status.done === true) {
          isDone = true;
          console.log('Image generation succeeded!');
          break;
        } else if (status.faulted === true) {
          console.error('Image generation failed:', status.error_message);
          return null;
        }
        
        attempts++;
        if (attempts % 10 === 0) {
          console.log(`Still generating... (${attempts * 2}s)`);
        }
      }
      
      if (!isDone) {
        console.error('Image generation timed out');
        return null;
      }

      // Get the generated image
      const statusResponse = await fetch(`${AI_HORDE_API_URL}/generate/status/${requestId}`, {
        headers: apiKey ? { 'apikey': apiKey } : {}
      });
      
      if (!statusResponse.ok) {
        console.error('Error fetching generation status:', statusResponse.status);
        return null;
      }
      
      const statusData: any = await statusResponse.json();
      
      if (!statusData.generations || statusData.generations.length === 0) {
        console.error('No generations returned from AI Horde');
        return null;
      }
      
      // AI Horde returns base64 encoded images or URLs
      const generation = statusData.generations[0];
      
      if (!generation) {
        console.error('No generation data in response');
        return null;
      }

      // Check if image is a URL or base64
      // AI Horde can return either a URL or base64 string
      let imageUrl: string;
      const imageData = generation.img || generation.url || generation.image;
      
      if (!imageData) {
        console.error('No image data in generation response');
        console.error('Generation keys:', Object.keys(generation));
        console.error('Generation data:', JSON.stringify(generation, null, 2));
        return null;
      }
      
      const trimmedData = String(imageData).trim();
      
      // Check if it's a URL first (most common case with AI Horde)
      if (trimmedData.startsWith('http://') || trimmedData.startsWith('https://')) {
        // It's a URL - use it directly
        imageUrl = trimmedData;
        console.log('Image is a URL:', imageUrl.substring(0, 100));
      } else if (trimmedData.startsWith('data:')) {
        // Already has data URL prefix
        imageUrl = trimmedData;
        console.log('Image is already a data URL');
      } else {
        // Assume it's base64 - clean and add data URL prefix
        const cleanBase64 = trimmedData.replace(/\s/g, '');
        imageUrl = `data:image/png;base64,${cleanBase64}`;
        console.log('Image is base64, length:', cleanBase64.length);
      }

      console.log('Image generated successfully! Type:', imageUrl.startsWith('data:') ? 'base64' : 'url');
      return {
        imageUrl,
        imagePrompt
      };
    } catch (error) {
      console.error('Error generating comic panel image:', error);
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
   * Generate a character portrait for consistency using AI Horde
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

      const apiKey = process.env.AI_HORDE_API_KEY;
      
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        'apikey': apiKey || '0000000000'
      };
      
      if (apiKey) {
        headers['apikey'] = apiKey;
      }

      const createResponse = await fetch(`${AI_HORDE_API_URL}/generate/async`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          prompt: prompt,
          params: {
            n: 1,
            width: 512,
            height: 512,
            steps: 30,
            cfg_scale: 7.5,
            sampler_name: 'k_euler_a',
            karras: true,
            post_processing: ['GFPGAN']
          },
          models: [DEFAULT_MODEL],
          nsfw: false,
          trusted_workers: false,
          censor_nsfw: true
        })
      });

      if (!createResponse.ok) {
        return null;
      }

      const requestData: any = await createResponse.json();
      const requestId = requestData.id;
      
      if (!requestId) {
        return null;
      }
      
      // Poll for completion
      let isDone = false;
      let attempts = 0;
      
      while (!isDone && attempts < 120) {
        await new Promise(resolve => setTimeout(resolve, 2000));
        const checkResponse = await fetch(`${AI_HORDE_API_URL}/generate/check/${requestId}`, {
          headers: apiKey ? { 'apikey': apiKey } : {}
        });
        
        if (!checkResponse.ok) {
          break;
        }
        
        const status: any = await checkResponse.json();
        
        if (status.done === true) {
          isDone = true;
          break;
        } else if (status.faulted === true) {
          return null;
        }
        attempts++;
      }
      
      if (!isDone) {
        return null;
      }

      const statusResponse = await fetch(`${AI_HORDE_API_URL}/generate/status/${requestId}`, {
        headers: apiKey ? { 'apikey': apiKey } : {}
      });
      
      if (!statusResponse.ok) {
        return null;
      }
      
      const statusData: any = await statusResponse.json();
      
      if (!statusData.generations || statusData.generations.length === 0) {
        return null;
      }
      
      const generation = statusData.generations[0];
      
      if (!generation) {
        return null;
      }

      // Check if image is a URL or base64
      const imageData = generation.img || generation.url || generation.image;
      
      if (!imageData) {
        return null;
      }
      
      const trimmedData = String(imageData).trim();
      
      // Check if it's a URL first
      if (trimmedData.startsWith('http://') || trimmedData.startsWith('https://')) {
        return trimmedData;
      } else if (trimmedData.startsWith('data:')) {
        return trimmedData;
      } else {
        // Assume base64
        const cleanBase64 = trimmedData.replace(/\s/g, '');
        return `data:image/png;base64,${cleanBase64}`;
      }
    } catch (error) {
      console.error('Error generating character portrait:', error);
      return null;
    }
  }
}


