import { GoogleGenerativeAI } from '@google/generative-ai';
import dotenv from 'dotenv';
import path from 'path';
import { Character, StoryResponse, CombatResolution, StoryState } from '../types';

// Load environment variables from server/.env
dotenv.config({ path: path.join(__dirname, '../../.env') });

export class AIService {
  private static readonly MODEL = 'gemini-2.0-flash-exp'; // Gemini Pro Preview 3 (experimental)
  private static readonly MAX_TOKENS = 2048;

  /**
   * Get Gemini AI instance
   */
  private static getGeminiAI(): GoogleGenerativeAI {
    const apiKey = process.env.GEMINI_API_KEY;
    
    if (!apiKey || apiKey === 'your_gemini_api_key_here') {
      throw new Error('GEMINI_API_KEY is not set or is still using placeholder value. Please add your actual Gemini API key to server/.env');
    }
    
    return new GoogleGenerativeAI(apiKey);
  }

  /**
   * Make a request to Gemini API
   */
  private static async callGemini(prompt: string): Promise<string> {
    try {
      const genAI = this.getGeminiAI();
      const model = genAI.getGenerativeModel({ 
        model: this.MODEL,
        generationConfig: {
          maxOutputTokens: this.MAX_TOKENS,
          temperature: 0.8,
        }
      });

      const result = await model.generateContent(prompt);
      const response = await result.response;
      return response.text();
    } catch (error: any) {
      console.error('Gemini API Error:', error);
      
      if (error?.message?.includes('API_KEY') || error?.message?.includes('authentication')) {
        throw new Error('Gemini API authentication failed. Please check your GEMINI_API_KEY in server/.env');
      }
      
      if (error?.message?.includes('quota') || error?.message?.includes('rate limit')) {
        throw new Error('Gemini API rate limit exceeded. Please try again later.');
      }
      
      throw new Error(`Gemini API error: ${error?.message || 'Unknown error'}`);
    }
  }

  /**
   * Generate initial story scenario for a character
   */
  static async generateStoryScenario(
    character: Character,
    previousEvents?: string[]
  ): Promise<StoryResponse> {
    const context = this.buildCharacterContext(character, previousEvents);
    
    const prompt = `${context}

Generate an engaging cyberpunk story scenario as a 6-panel comic book. The story should:
1. Be appropriate to their background and skills
2. Present a challenge or opportunity
3. Require player action/decision
4. Be vivid and atmospheric
5. Include dialogue in speech bubbles
6. Show visual progression across 6 panels

Format your response as JSON with:
{
  "scenario": "brief overall story summary (1-2 sentences)",
  "panels": [
    {
      "panelNumber": 1,
      "visualDescription": "detailed visual description of what's shown in this panel",
      "dialogue": ["character dialogue", "other character dialogue"],
      "narration": "optional narration text"
    },
    ... (6 panels total)
  ],
  "requiresInput": true,
  "nextScene": "brief scene identifier"
}

Each panel should:
- Have a clear visual scene (what the reader sees)
- Include dialogue in speech bubbles (characters talking)
- Progress the story visually
- Be cyberpunk-themed with neon, tech, and atmosphere
- Panel 1: Opening scene/setting
- Panel 2-3: Story development
- Panel 4-5: Conflict or challenge
- Panel 6: Cliffhanger or decision point

Make it immersive and cinematic!`;

    try {
      const content = await this.callGemini(prompt);

      const response = this.parseJSONResponse(content);
      
      // Ensure we have 6 panels
      let panels = response.panels || [];
      if (panels.length !== 6) {
        // If AI didn't generate 6 panels, create fallback panels
        panels = this.createFallbackPanels(response.scenario || 'You find yourself in the neon-lit streets of Night City...');
      }
      
      return {
        scenario: response.scenario || 'You find yourself in the neon-lit streets of Night City...',
        panels: panels,
        requiresInput: response.requiresInput !== false,
        nextScene: response.nextScene || 'street'
      };
    } catch (error: any) {
      console.error('Error generating story scenario:', error);
      
      // Provide more specific error messages
      if (error?.message?.includes('authentication') || error?.message?.includes('API_KEY')) {
        console.error('❌ Gemini API authentication failed. Check your GEMINI_API_KEY in server/.env');
        throw new Error('API authentication failed. Please check your Gemini API key.');
      }
      
      if (error?.message?.includes('rate limit') || error?.message?.includes('quota')) {
        console.error('❌ Gemini API rate limit exceeded');
        throw new Error('API rate limit exceeded. Please try again later.');
      }
      
      // Return fallback story but log the error
      console.error('⚠️  Using fallback story due to error:', error.message || error);
      const fallbackScenario = 'The neon lights flicker as you step into the rain-soaked alley. Something is about to happen...';
      return {
        scenario: fallbackScenario,
        panels: this.createFallbackPanels(fallbackScenario),
        requiresInput: true,
        nextScene: 'street'
      };
    }
  }

  /**
   * Process player action and generate outcome
   */
  static async processPlayerAction(
    character: Character,
    action: string,
    currentScene: string,
    storyHistory: string[]
  ): Promise<StoryResponse> {
    const context = this.buildCharacterContext(character, storyHistory);
    const recentHistory = storyHistory.slice(-5).join('\n');
    
    // Build inventory and stats context
    const inventoryList = character.inventory?.map(item => 
      `${item.name} (${item.quantity}x) - ${item.description}`
    ).join(', ') || 'Empty';
    
    const stats = `Money: ${character.money} eddies | Health: ${character.health}/${character.maxHealth} | Inventory: ${inventoryList}`;
    
    const prompt = `${context}

${stats}

Current Scene: ${currentScene}
Recent Story History:
${recentHistory}

Player Action: "${action}"

CRITICAL: Evaluate this action REALISTICALLY and CHALLENGINGLY:
1. Check if player has required items/money - if not, action FAILS
2. Consider difficulty - some actions are IMPOSSIBLE or VERY DIFFICULT
3. Character's capabilities matter - a netrunner can't fight like a solo
4. Actions can FAIL - don't always succeed
5. Failure has CONSEQUENCES - injuries, lost money, enemies, etc.
6. Make it CHALLENGING - success rate should be 40-60%, not 100%
7. Death is possible - characters can die from bad decisions
8. Realistic limitations - can't use items you don't have

Evaluate difficulty and consequences:
- EASY (80% success): Actions matching character's trade/skills - minor damage (5-10) if fails
- MEDIUM (50% success): Risky actions, combat, hacking - moderate damage (10-25) if fails
- HARD (20% success): Nearly impossible actions, fighting groups - severe damage (25-40) if fails
- IMPOSSIBLE (0% success): Actions requiring items/money you don't have - critical damage (40-50) or death

Damage calculation:
- Base damage from failed actions: 5-50 based on difficulty
- Combat damage: 10-40 based on opponent strength and outcome
- Environmental hazards: 5-30 based on danger level
- Healing: 5-20 from medical items or rest

Money (eddies) changes:
- Small transactions: 50-200 eddies
- Medium transactions: 200-500 eddies
- Large transactions: 500-1000 eddies
- Always count eddies properly - track all gains and losses

Format your response as JSON:
{
  "scenario": "detailed outcome description (2-3 paragraphs)",
  "outcome": "brief summary - include SUCCESS or FAILURE",
  "success": true/false,
  "difficulty": "easy|medium|hard|impossible",
  "requiresInput": true/false,
  "nextScene": "scene identifier",
  "consequences": ["consequence1", "consequence2"],
  "healthChange": -50 to 20 (negative = damage, positive = healing, AI decides based on severity),
  "moneyChange": -500 to 1000 (negative = lost, positive = gained, in eddies),
  "inventoryChanges": ["+item name" or "-item name"] - ONLY add/remove items that make sense for the story context and character's trade/background. Items should be contextual to what happened in the scenario.
  "combat": {
    "opponent": "if combat initiated",
    "opponentDescription": "description",
    "environment": "combat environment",
    "stakes": "what's at risk"
  } OR null
}

IMPORTANT: Actions should fail 40-60% of the time. Be harsh but fair.`;

    try {
      const content = await this.callGemini(prompt);
      const response = this.parseJSONResponse(content);
      const scenario = response.scenario || 'Your action has consequences...';
      return {
        scenario: scenario,
        panels: response.panels || this.createFallbackPanels(scenario),
        outcome: response.outcome || 'Action completed',
        requiresInput: response.requiresInput !== false,
        nextScene: response.nextScene || currentScene,
        combat: response.combat || undefined,
        success: response.success,
        difficulty: response.difficulty,
        consequences: response.consequences || [],
        healthChange: response.healthChange || 0,
        moneyChange: response.moneyChange || 0,
        inventoryChanges: response.inventoryChanges || []
      };
    } catch (error: any) {
      console.error('Error processing player action:', error);
      
      if (error?.message?.includes('authentication') || error?.message?.includes('API_KEY')) {
        throw new Error('API authentication failed. Please check your Gemini API key.');
      }
      
      if (error?.message?.includes('quota') || error?.message?.includes('rate limit')) {
        throw new Error('API rate limit exceeded. Please try again later.');
      }
      
      const fallbackScenario = 'Your action ripples through the neon-soaked world. The consequences unfold...';
      return {
        scenario: fallbackScenario,
        panels: this.createFallbackPanels(fallbackScenario),
        outcome: 'Action processed',
        requiresInput: true,
        nextScene: currentScene
      };
    }
  }

  /**
   * Resolve combat scenario
   */
  static async resolveCombat(
    character: Character,
    combatScenario: any,
    playerTactics: string,
    storyHistory: string[]
  ): Promise<CombatResolution> {
    const context = this.buildCharacterContext(character, storyHistory);
    
    const prompt = `${context}

Combat Scenario:
Opponent: ${combatScenario.opponent}
${combatScenario.opponentDescription}
Environment: ${combatScenario.environment}
Stakes: ${combatScenario.stakes}

Player Tactics: "${playerTactics}"

Determine the combat outcome based on:
1. Character's skills and augmentations
2. Tactical approach quality
3. Environmental advantages
4. Surprise/positioning
5. Narrative weight

Format your response as JSON:
{
  "outcome": "victory" | "defeat" | "escape" | "negotiation",
  "description": "detailed narrative of the combat (2-3 paragraphs)",
  "consequences": ["consequence1", "consequence2"],
  "characterInjuries": ["injury1"] OR [],
  "characterStatus": "alive" | "dead" | "injured"
}

Be fair but dramatic. Death should feel earned, not arbitrary.`;

    try {
      const content = await this.callGemini(prompt);
      const response = this.parseJSONResponse(content);
      return {
        outcome: response.outcome || 'victory',
        description: response.description || 'The combat concludes...',
        consequences: response.consequences || [],
        characterInjuries: response.characterInjuries || [],
        characterStatus: response.characterStatus || 'alive'
      };
    } catch (error: any) {
      console.error('Error resolving combat:', error);
      
      if (error?.message?.includes('authentication') || error?.message?.includes('API_KEY')) {
        throw new Error('API authentication failed. Please check your Gemini API key.');
      }
      
      return {
        outcome: 'victory',
        description: 'The combat ends with you standing, though not unscathed.',
        consequences: ['You survived the encounter'],
        characterStatus: 'alive'
      };
    }
  }

  /**
   * Build character context string for AI prompts
   */
  private static buildCharacterContext(character: Character, storyHistory?: string[]): string {
    let context = `Character Profile:
Background: ${character.background}
Augmentations/Cyberware: ${character.augmentations}
Appearance: ${character.appearance}
Trade/Skill: ${character.trade}
Status: ${character.status}

Full Description: ${character.fullDescription}`;

    if (character.optionalPrompts) {
      const opts = character.optionalPrompts;
      if (opts.enemies) context += `\nEnemies/Those who want them dead: ${opts.enemies}`;
      if (opts.neverSellOut) context += `\nNever sell out: ${opts.neverSellOut}`;
      if (opts.secret) context += `\nBiggest secret/regret: ${opts.secret}`;
      if (opts.problemHandling) context += `\nProblem handling style: ${opts.problemHandling}`;
      if (opts.reputation) context += `\nStreet reputation: ${opts.reputation}`;
    }

    if (storyHistory && storyHistory.length > 0) {
      context += `\n\nStory History:\n${storyHistory.slice(-10).join('\n')}`;
    }

    return context;
  }

  /**
   * Parse JSON response from AI, handling markdown code blocks
   */
  private static parseJSONResponse(text: string): any {
    try {
      // Remove markdown code blocks if present
      const cleaned = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      return JSON.parse(cleaned);
    } catch (error) {
      console.error('Error parsing AI JSON response:', error);
      console.error('Response text:', text);
      return {};
    }
  }

  /**
   * Create fallback panels if AI doesn't generate exactly 6
   */
  static createFallbackPanels(scenario: string): any[] {
    const panels = [];
    const scenarioParts = scenario.split('. ').filter(p => p.length > 10);
    
    for (let i = 0; i < 6; i++) {
      panels.push({
        panelNumber: i + 1,
        visualDescription: scenarioParts[i] || `Scene ${i + 1} in the cyberpunk world`,
        dialogue: i % 2 === 0 ? ["What's happening here?"] : [],
        narration: i === 0 ? scenario.substring(0, 100) : undefined
      });
    }
    
    return panels;
  }
}

// Validate API key on startup
if (!process.env.GEMINI_API_KEY || process.env.GEMINI_API_KEY === 'your_gemini_api_key_here') {
  console.warn('⚠️  WARNING: GEMINI_API_KEY is not set or is using placeholder value!');
  console.warn('⚠️  Story generation will fail. Please set GEMINI_API_KEY in server/.env');
  console.warn('⚠️  Get your API key from: https://aistudio.google.com/app/apikey');
} else {
  console.log('✅ Gemini API key loaded');
}

