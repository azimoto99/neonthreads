import express from 'express';
import { v4 as uuidv4 } from 'uuid';
import { runQuery, runInsert } from '../database';
import { AIService } from '../services/aiService';
import { ImageService } from '../services/imageService';
import { Character, PlayerActionRequest, StoryResponse, CombatResolution, InventoryItem } from '../types';

const router = express.Router();

// Get initial story scenario for a character
router.post('/:characterId/scenario', async (req, res) => {
  try {
    const { characterId } = req.params;
    
    // Fetch character
    const rows = await runQuery<any[]>(
      'SELECT * FROM characters WHERE id = ?',
      [characterId]
    );

    if (rows.length === 0) {
      return res.status(404).json({ error: 'Character not found' });
    }

    const row = rows[0];
    const character: Character = {
      id: row.id,
      playerId: row.player_id,
      background: row.background,
      augmentations: row.augmentations,
      appearance: row.appearance,
      trade: row.trade,
      optionalPrompts: row.optional_prompts ? JSON.parse(row.optional_prompts) : undefined,
      fullDescription: row.full_description,
      createdAt: row.created_at,
      currentStoryState: JSON.parse(row.current_story_state),
      status: row.status,
      storyHistory: JSON.parse(row.story_history),
      inventory: row.inventory ? JSON.parse(row.inventory) : [],
      money: row.money || 500,
      health: row.health || 100,
      maxHealth: row.max_health || 100
    };

    if (character.status === 'dead') {
      return res.status(400).json({ error: 'Character is dead' });
    }

    // Generate story scenario
    const storyHistory = character.storyHistory.map(e => e.description);
    const storyResponse = await AIService.generateStoryScenario(character, storyHistory);

    // Generate images for each panel individually
    if (storyResponse.panels && storyResponse.panels.length > 0) {
      // Generate image for the first panel only (to start)
      // We'll generate others on-demand or sequentially
      try {
        const firstPanel = storyResponse.panels[0];
        const imageData = await ImageService.generateComicPanel(
          character, 
          storyResponse.scenario, 
          'story',
          {
            panels: [firstPanel], // Only pass the single panel
            outcome: storyResponse.outcome,
            consequences: storyResponse.consequences
          }
        );
        if (imageData && storyResponse.panels[0]) {
          storyResponse.panels[0].imageUrl = imageData.imageUrl;
          storyResponse.panels[0].imagePrompt = imageData.imagePrompt;
        }
      } catch (error) {
        console.error('Image generation failed for first panel, continuing without image:', error);
      }
    }

    // Update character's current scene
    if (storyResponse.nextScene) {
      character.currentStoryState.currentScene = storyResponse.nextScene;
      await runInsert(
        'UPDATE characters SET current_story_state = ? WHERE id = ?',
        [JSON.stringify(character.currentStoryState), characterId]
      );
    }

    // Record story event
    const eventId = uuidv4();
    await runInsert(
      `INSERT INTO story_events (id, character_id, timestamp, type, description, outcome)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [
        eventId,
        characterId,
        new Date().toISOString(),
        'story',
        storyResponse.scenario,
        storyResponse.outcome || 'Story scenario generated'
      ]
    );

    // Update character's story history
    const storyEvent: any = {
      id: eventId,
      timestamp: new Date().toISOString(),
      type: 'story',
      description: storyResponse.scenario,
      outcome: storyResponse.outcome || 'Story scenario generated'
    };

    // Store panel images in story event if available
    if (storyResponse.panels && storyResponse.panels.length > 0) {
      const firstPanel = storyResponse.panels[0];
      if (firstPanel.imageUrl) {
        storyEvent.imageUrl = firstPanel.imageUrl;
        storyEvent.imagePrompt = firstPanel.imagePrompt;
      }
    }

    character.storyHistory.push(storyEvent);

    await runInsert(
      'UPDATE characters SET story_history = ? WHERE id = ?',
      [JSON.stringify(character.storyHistory), characterId]
    );

    res.json(storyResponse);
  } catch (error: any) {
    console.error('Error generating story scenario:', error);
    const errorMessage = error?.message || 'Failed to generate story scenario';
    res.status(500).json({ 
      error: errorMessage,
      details: process.env.NODE_ENV === 'development' ? error?.stack : undefined
    });
  }
});

// Process player action
router.post('/:characterId/action', async (req, res) => {
  try {
    const { characterId } = req.params;
    const { action, context }: PlayerActionRequest = req.body;

    if (!action) {
      return res.status(400).json({ error: 'Action is required' });
    }

    // Fetch character
    const rows = await runQuery<any[]>(
      'SELECT * FROM characters WHERE id = ?',
      [characterId]
    );

    if (rows.length === 0) {
      return res.status(404).json({ error: 'Character not found' });
    }

    const row = rows[0];
    const character: Character = {
      id: row.id,
      playerId: row.player_id,
      background: row.background,
      augmentations: row.augmentations,
      appearance: row.appearance,
      trade: row.trade,
      optionalPrompts: row.optional_prompts ? JSON.parse(row.optional_prompts) : undefined,
      fullDescription: row.full_description,
      createdAt: row.created_at,
      currentStoryState: JSON.parse(row.current_story_state),
      status: row.status,
      storyHistory: JSON.parse(row.story_history),
      inventory: row.inventory ? JSON.parse(row.inventory) : [],
      money: row.money || 500,
      health: row.health || 100,
      maxHealth: row.max_health || 100
    };

    if (character.status === 'dead') {
      return res.status(400).json({ error: 'Character is dead' });
    }

    // Process action
    const storyHistory = character.storyHistory.map(e => `${e.type}: ${e.description}`);
    const storyResponse = await AIService.processPlayerAction(
      character,
      action,
      character.currentStoryState.currentScene,
      storyHistory
    );

    // Generate image for the first panel only
    if (storyResponse.panels && storyResponse.panels.length > 0) {
      try {
        const firstPanel = storyResponse.panels[0];
        const imageType = storyResponse.combat ? 'combat' : 'outcome';
        const imageData = await ImageService.generateComicPanel(
          character, 
          storyResponse.scenario, 
          imageType,
          {
            panels: [firstPanel], // Only pass the single panel
            outcome: storyResponse.outcome,
            consequences: storyResponse.consequences
          }
        );
        if (imageData && storyResponse.panels[0]) {
          storyResponse.panels[0].imageUrl = imageData.imageUrl;
          storyResponse.panels[0].imagePrompt = imageData.imagePrompt;
        }
      } catch (error) {
        console.error('Image generation failed for first panel, continuing without image:', error);
      }
    }

    // Update character's current scene
    if (storyResponse.nextScene) {
      character.currentStoryState.currentScene = storyResponse.nextScene;
    }

    // Record story event
    const eventId = uuidv4();
    await runInsert(
      `INSERT INTO story_events (id, character_id, timestamp, type, description, player_input, outcome)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        eventId,
        characterId,
        new Date().toISOString(),
        storyResponse.combat ? 'combat' : 'decision',
        storyResponse.scenario,
        action,
        storyResponse.outcome || 'Action processed'
      ]
    );

    // Update character's story history
    const storyEvent: any = {
      id: eventId,
      timestamp: new Date().toISOString(),
      type: storyResponse.combat ? 'combat' : 'decision',
      description: storyResponse.scenario,
      playerInput: action,
      outcome: storyResponse.outcome || 'Action processed'
    };

    if (imageData) {
      storyEvent.imageUrl = imageData.imageUrl;
      storyEvent.imagePrompt = imageData.imagePrompt;
    }

    character.storyHistory.push(storyEvent);

    await runInsert(
      'UPDATE characters SET current_story_state = ?, story_history = ? WHERE id = ?',
      [
        JSON.stringify(character.currentStoryState),
        JSON.stringify(character.storyHistory),
        characterId
      ]
    );

    res.json(storyResponse);
  } catch (error: any) {
    console.error('Error processing player action:', error);
    const errorMessage = error?.message || 'Failed to process player action';
    res.status(500).json({ 
      error: errorMessage,
      details: process.env.NODE_ENV === 'development' ? error?.stack : undefined
    });
  }
});

// Resolve combat
router.post('/:characterId/combat', async (req, res) => {
  try {
    const { characterId } = req.params;
    const { combatScenario, playerTactics } = req.body;

    if (!combatScenario || !playerTactics) {
      return res.status(400).json({ error: 'Combat scenario and player tactics are required' });
    }

    // Fetch character
    const rows = await runQuery<any[]>(
      'SELECT * FROM characters WHERE id = ?',
      [characterId]
    );

    if (rows.length === 0) {
      return res.status(404).json({ error: 'Character not found' });
    }

    const row = rows[0];
    const character: Character = {
      id: row.id,
      playerId: row.player_id,
      background: row.background,
      augmentations: row.augmentations,
      appearance: row.appearance,
      trade: row.trade,
      optionalPrompts: row.optional_prompts ? JSON.parse(row.optional_prompts) : undefined,
      fullDescription: row.full_description,
      createdAt: row.created_at,
      currentStoryState: JSON.parse(row.current_story_state),
      status: row.status,
      storyHistory: JSON.parse(row.story_history),
      inventory: row.inventory ? JSON.parse(row.inventory) : [],
      money: row.money || 500,
      health: row.health || 100,
      maxHealth: row.max_health || 100
    };

    if (character.status === 'dead') {
      return res.status(400).json({ error: 'Character is dead' });
    }

    // Resolve combat
    const storyHistory = character.storyHistory.map(e => `${e.type}: ${e.description}`);
    const combatResolution = await AIService.resolveCombat(
      character,
      combatScenario,
      playerTactics,
      storyHistory
    );

    // Generate comic panel image for combat outcome
    let imageData: { imageUrl: string; imagePrompt: string } | null = null;
    try {
      imageData = await ImageService.generateComicPanel(
        character, 
        combatResolution.description, 
        'combat',
        {
          outcome: combatResolution.outcome,
          consequences: combatResolution.consequences
        }
      );
    } catch (error) {
      console.error('Image generation failed for combat:', error);
    }

    // Update character status if dead
    if (combatResolution.characterStatus === 'dead') {
      character.status = 'dead';
      await runInsert(
        'UPDATE characters SET status = ? WHERE id = ?',
        ['dead', characterId]
      );
    }

    // Record combat event
    const eventId = uuidv4();
    await runInsert(
      `INSERT INTO story_events (id, character_id, timestamp, type, description, player_input, outcome, consequences)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        eventId,
        characterId,
        new Date().toISOString(),
        'combat',
        combatResolution.description,
        playerTactics,
        combatResolution.outcome,
        JSON.stringify(combatResolution.consequences)
      ]
    );

    // Update character's story history
    const storyEvent: any = {
      id: eventId,
      timestamp: new Date().toISOString(),
      type: 'combat',
      description: combatResolution.description,
      playerInput: playerTactics,
      outcome: combatResolution.outcome,
      consequences: combatResolution.consequences
    };

    if (imageData) {
      storyEvent.imageUrl = imageData.imageUrl;
      storyEvent.imagePrompt = imageData.imagePrompt;
    }

    character.storyHistory.push(storyEvent);

    await runInsert(
      'UPDATE characters SET story_history = ? WHERE id = ?',
      [JSON.stringify(character.storyHistory), characterId]
    );

    // Add image to combat resolution response
    const responseWithImage = {
      ...combatResolution,
      imageUrl: imageData?.imageUrl,
      imagePrompt: imageData?.imagePrompt
    };

    res.json(responseWithImage);
  } catch (error: any) {
    console.error('Error resolving combat:', error);
    const errorMessage = error?.message || 'Failed to resolve combat';
    res.status(500).json({ 
      error: errorMessage,
      details: process.env.NODE_ENV === 'development' ? error?.stack : undefined
    });
  }
});

export { router as storyRoutes };

