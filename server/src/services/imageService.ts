import dotenv from 'dotenv';
import path from 'path';
import { Character } from '../types';

dotenv.config({ path: path.join(__dirname, '../../.env') });

// Using Replicate API with Google Imagen-4
const REPLICATE_API_URL = 'https://api.replicate.com/v1/predictions';
// Imagen-4 model on Replicate - using the model identifier
const IMAGEN_MODEL = 'google/imagen-4';

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
    const characterVisual = character.appearance;
    const augmentations = character.augmentations;
    const location = character.currentStoryState.currentScene.replace(/_/g, ' ');

    // Start with strong visual emphasis - NO TEXT BLOCKS
    let basePrompt = `Anime style cyberpunk comic book illustration, `;
    basePrompt += `visual illustration only, no large text blocks, `;
    basePrompt += `primarily visual artwork, `;
    
    if (sceneType === 'combat') {
      basePrompt += `dynamic action scene, intense battle sequence, `;
    } else {
      basePrompt += `cinematic dramatic scene, `;
    }

    basePrompt += `anime art style, detailed anime character design, `;
    basePrompt += `character appearance: ${characterVisual}, `;
    basePrompt += `cyberware and augmentations: ${augmentations}, `;
    basePrompt += `location setting: ${location}, `;

    // ONLY use visual descriptions - focus on the single panel being generated
    if (storyContext?.panels && storyContext.panels.length > 0) {
      // Use ONLY the visual description from the panel being generated
      const panel = storyContext.panels[0]; // Should only be one panel
      // Clean the visual description to remove any text references
      let visualDesc = panel.visualDescription
        .replace(/dialogue|speech|text|narration|caption/gi, '')
        .replace(/["']/g, '')
        .trim();
      
      basePrompt += `visual scene composition: ${visualDesc}, `;
    } else {
      // Fallback to scenario text, but clean it
      const scenarioVisual = scenario
        .substring(0, 200)
        .replace(/[^\w\s]/g, ' ')
        .replace(/dialogue|speech|text|narration|caption/gi, '')
        .trim();
      basePrompt += `visual scene elements: ${scenarioVisual}, `;
    }

    // Add visual context from outcome/consequences, but keep it visual
    if (storyContext?.outcome) {
      const visualOutcome = storyContext.outcome
        .replace(/dialogue|speech|text|narration|caption/gi, '')
        .substring(0, 100);
      basePrompt += `visual outcome context: ${visualOutcome}, `;
    }

    // Emphasize visual style and composition
    basePrompt += `anime cyberpunk aesthetic, vibrant neon colors, `;
    basePrompt += `anime shading and highlights, cel-shaded style, `;
    basePrompt += `detailed background, atmospheric lighting, `;
    basePrompt += `high quality anime artwork, professional anime illustration, `;
    basePrompt += `comic book panel style, `;
    basePrompt += `minimal text elements, only small speech bubbles if needed, `;
    basePrompt += `focus on visual storytelling, `;
    basePrompt += `no large text blocks, no paragraphs of text, `;
    basePrompt += `illustration first, text secondary and minimal`;

    return basePrompt;
  }

  /**
   * Generate a comic panel image using Google Imagen-4 via Replicate
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
      const replicateApiKey = process.env.REPLICATE_API_TOKEN || process.env.REPLICATE_API_KEY;
      
      if (!replicateApiKey) {
        console.warn('REPLICATE_API_TOKEN not set. Skipping image generation.');
        return null;
      }
      
      console.log('Generating image with Imagen-4, prompt:', imagePrompt.substring(0, 100) + '...');
      
      // Create prediction with Imagen-4
      const createResponse = await fetch(REPLICATE_API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Token ${replicateApiKey}`
        },
        body: JSON.stringify({
          version: IMAGEN_MODEL, // Replicate uses version field
          input: {
            prompt: imagePrompt,
            aspect_ratio: '1:1',
            output_format: 'png',
            safety_filter_level: 'block_only_high'
          }
        })
      });

      if (!createResponse.ok) {
        const errorText = await createResponse.text();
        console.error('Replicate API error creating prediction:', createResponse.status, errorText);
        return null;
      }

      const prediction: any = await createResponse.json();
      const predictionId = prediction.id;
      
      if (!predictionId) {
        console.error('No prediction ID returned from Replicate');
        return null;
      }
      
      console.log('Prediction created, ID:', predictionId);
      
      // Poll for completion
      let result = null;
      let attempts = 0;
      const maxAttempts = 60; // 60 seconds max wait
      
      while (attempts < maxAttempts) {
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        const statusResponse = await fetch(`${REPLICATE_API_URL}/${predictionId}`, {
          headers: {
            'Authorization': `Token ${replicateApiKey}`
          }
        });
        
        if (!statusResponse.ok) {
          console.error('Error checking prediction status:', statusResponse.status);
          break;
        }
        
        const status: any = await statusResponse.json();
        
        if (status.status === 'succeeded') {
          result = status.output;
          console.log('Image generation succeeded!');
          break;
        } else if (status.status === 'failed') {
          console.error('Image generation failed:', status.error);
          return null;
        } else if (status.status === 'canceled') {
          console.error('Image generation was canceled');
          return null;
        }
        
        attempts++;
        if (attempts % 10 === 0) {
          console.log(`Still generating... (${attempts}s)`);
        }
      }
      
      // Handle both array and single URL response formats
      const fetchedImageUrl = Array.isArray(result) ? result[0] : result;
      
      if (!fetchedImageUrl) {
        console.error('Image generation timed out or failed - no URL returned');
        return null;
      }

      // Fetch the image and convert to base64
      console.log('Fetching image from:', fetchedImageUrl);
      const imageResponse = await fetch(fetchedImageUrl);
      
      if (!imageResponse.ok) {
        console.error('Error fetching generated image:', imageResponse.status);
        return null;
      }
      
      const imageBlob = await imageResponse.blob();
      const arrayBuffer = await imageBlob.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);
      const base64 = buffer.toString('base64');
      const imageUrl = `data:image/png;base64,${base64}`;

      console.log('Image generated successfully!');
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
   * Generate a character portrait for consistency using Google Imagen-4
   */
  static async generateCharacterPortrait(character: Character): Promise<string | null> {
    try {
      const prompt = `Anime style cyberpunk character portrait illustration, 
      visual illustration only, no text blocks, 
      anime art style, detailed anime character design, 
      character appearance: ${character.appearance}, 
      cyberware and augmentations: ${character.augmentations}, 
      background: neon-lit cyberpunk cityscape, 
      anime shading and highlights, cel-shaded style, 
      vibrant neon colors, high quality anime artwork, 
      professional anime illustration, front view, detailed character design, 
      pure visual artwork, no dialogue, no text, illustration only`;

      const replicateApiKey = process.env.REPLICATE_API_TOKEN || process.env.REPLICATE_API_KEY;
      
      if (!replicateApiKey) {
        return null;
      }

      const createResponse = await fetch(REPLICATE_API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Token ${replicateApiKey}`
        },
        body: JSON.stringify({
          version: IMAGEN_MODEL, // Replicate uses version field
          input: {
            prompt: prompt,
            aspect_ratio: '1:1',
            output_format: 'png',
            safety_filter_level: 'block_only_high'
          }
        })
      });

      if (!createResponse.ok) {
        return null;
      }

      const prediction: any = await createResponse.json();
      const predictionId = prediction.id;
      
      if (!predictionId) {
        return null;
      }
      
      // Poll for completion
      let result = null;
      let attempts = 0;
      
      while (attempts < 60) {
        await new Promise(resolve => setTimeout(resolve, 1000));
        const statusResponse = await fetch(`${REPLICATE_API_URL}/${predictionId}`, {
          headers: {
            'Authorization': `Token ${replicateApiKey}`
          }
        });
        
        if (!statusResponse.ok) {
          break;
        }
        
        const status: any = await statusResponse.json();
        
        if (status.status === 'succeeded') {
          result = status.output;
          break;
        } else if (status.status === 'failed' || status.status === 'canceled') {
          return null;
        }
        attempts++;
      }
      
      // Handle both array and single URL response formats
      const fetchedImageUrl = Array.isArray(result) ? result[0] : result;
      
      if (!fetchedImageUrl) {
        return null;
      }

      const imageResponse = await fetch(fetchedImageUrl);
      if (!imageResponse.ok) {
        return null;
      }
      
      const imageBlob = await imageResponse.blob();
      const arrayBuffer = await imageBlob.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);
      const base64 = buffer.toString('base64');
      return `data:image/png;base64,${base64}`;
    } catch (error) {
      console.error('Error generating character portrait:', error);
      return null;
    }
  }
}

