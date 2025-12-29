import express from 'express';
import { v4 as uuidv4 } from 'uuid';
import { runQuery, runInsert, parseJsonField } from '../database';
import { AIService } from '../services/aiService';
import { ImageService } from '../services/imageService';
import { Character, PlayerActionRequest, StoryResponse, CombatResolution, InventoryItem } from '../types';
import { authenticateToken } from '../middleware/auth';

const router = express.Router();

// All story routes require authentication
router.use(authenticateToken);

/**
 * Process inventory changes contextually based on character and story
 */
function processInventoryChanges(
  character: Character,
  inventoryChanges: string[],
  storyContext: string
): InventoryItem[] {
  const inventory = [...(character.inventory || [])];
  
  for (const change of inventoryChanges) {
    if (change.startsWith('+')) {
      // Add item
      const itemName = change.substring(1).trim();
      // Find if item already exists
      const existingIndex = inventory.findIndex(item => item.name.toLowerCase() === itemName.toLowerCase());
      
      if (existingIndex >= 0) {
        // Increment quantity
        inventory[existingIndex].quantity += 1;
      } else {
        // Add new item - determine type based on name and context
        let itemType: 'weapon' | 'tool' | 'consumable' | 'cyberware' | 'misc' = 'misc';
        const lowerName = itemName.toLowerCase();
        
        if (lowerName.includes('weapon') || lowerName.includes('gun') || lowerName.includes('knife') || 
            lowerName.includes('sword') || lowerName.includes('blade') || lowerName.includes('rifle') ||
            lowerName.includes('pistol') || lowerName.includes('ammo')) {
          itemType = 'weapon';
        } else if (lowerName.includes('cyberware') || lowerName.includes('implant') || 
                   lowerName.includes('augment') || lowerName.includes('mod')) {
          itemType = 'cyberware';
        } else if (lowerName.includes('medkit') || lowerName.includes('stim') || 
                   lowerName.includes('heal') || lowerName.includes('food') || 
                   lowerName.includes('drink') || lowerName.includes('consumable')) {
          itemType = 'consumable';
        } else if (lowerName.includes('tool') || lowerName.includes('deck') || 
                   lowerName.includes('device') || lowerName.includes('equipment')) {
          itemType = 'tool';
        }
        
        inventory.push({
          name: itemName,
          description: `Acquired: ${storyContext.substring(0, 100)}`,
          quantity: 1,
          type: itemType
        });
      }
    } else if (change.startsWith('-')) {
      // Remove item
      const itemName = change.substring(1).trim();
      const existingIndex = inventory.findIndex(item => item.name.toLowerCase() === itemName.toLowerCase());
      
      if (existingIndex >= 0) {
        if (inventory[existingIndex].quantity > 1) {
          inventory[existingIndex].quantity -= 1;
        } else {
          inventory.splice(existingIndex, 1);
        }
      }
    }
  }
  
  return inventory;
}

/**
 * Apply story response changes to character (health, money, inventory)
 */
async function applyStoryChanges(
  characterId: string,
  character: Character,
  storyResponse: StoryResponse
): Promise<Character> {
  let newHealth = character.health || 100;
  let newMoney = character.money || 500;
  let newInventory = [...(character.inventory || [])];
  let newStatus = character.status;
  
  // Apply health change
  if (storyResponse.healthChange !== undefined) {
    newHealth = Math.max(0, Math.min(character.maxHealth || 100, newHealth + storyResponse.healthChange));
    
    // Check for death
    if (newHealth <= 0) {
      newStatus = 'dead';
      console.log(`Character ${characterId} has died (health reached 0)`);
    }
  }
  
  // Apply money change
  if (storyResponse.moneyChange !== undefined) {
    newMoney = Math.max(0, newMoney + storyResponse.moneyChange);
  }
  
  // Process inventory changes
  if (storyResponse.inventoryChanges && storyResponse.inventoryChanges.length > 0) {
    newInventory = processInventoryChanges(character, storyResponse.inventoryChanges, storyResponse.scenario);
  }
  
  // Update character in database
  await runInsert(
    `UPDATE characters SET health = ?, money = ?, inventory = ?, status = ? WHERE id = ?`,
    [newHealth, newMoney, JSON.stringify(newInventory), newStatus, characterId]
  );
  
  // Return updated character
  return {
    ...character,
    health: newHealth,
    money: newMoney,
    inventory: newInventory,
    status: newStatus
  };
}

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
    
    // Verify character belongs to authenticated user
    if (row.player_id !== req.userId) {
      return res.status(403).json({ error: 'Access denied' });
    }
    
    const character: Character = {
      id: row.id,
      playerId: row.player_id,
      background: row.background,
      augmentations: row.augmentations,
      appearance: row.appearance,
      trade: row.trade,
      optionalPrompts: parseJsonField(row.optional_prompts),
      fullDescription: row.full_description,
      createdAt: row.created_at,
      currentStoryState: parseJsonField(row.current_story_state),
      status: row.status,
      storyHistory: parseJsonField(row.story_history) || [],
      inventory: parseJsonField(row.inventory) || [],
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
    
    // Verify character belongs to authenticated user
    if (row.player_id !== req.userId) {
      return res.status(403).json({ error: 'Access denied' });
    }
    
    const character: Character = {
      id: row.id,
      playerId: row.player_id,
      background: row.background,
      augmentations: row.augmentations,
      appearance: row.appearance,
      trade: row.trade,
      optionalPrompts: parseJsonField(row.optional_prompts),
      fullDescription: row.full_description,
      createdAt: row.created_at,
      currentStoryState: parseJsonField(row.current_story_state),
      status: row.status,
      storyHistory: parseJsonField(row.story_history) || [],
      inventory: parseJsonField(row.inventory) || [],
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

    // Store panel images in story event if available
    if (storyResponse.panels && storyResponse.panels.length > 0) {
      const firstPanel = storyResponse.panels[0];
      if (firstPanel.imageUrl) {
        storyEvent.imageUrl = firstPanel.imageUrl;
        storyEvent.imagePrompt = firstPanel.imagePrompt;
      }
    }

    character.storyHistory.push(storyEvent);

    // Apply health, money, and inventory changes
    const updatedCharacter = await applyStoryChanges(characterId, character, storyResponse);
    
    // Update character state and history
    await runInsert(
      'UPDATE characters SET current_story_state = ?, story_history = ?, health = ?, money = ?, inventory = ?, status = ? WHERE id = ?',
      [
        JSON.stringify(updatedCharacter.currentStoryState),
        JSON.stringify(updatedCharacter.storyHistory),
        updatedCharacter.health,
        updatedCharacter.money,
        JSON.stringify(updatedCharacter.inventory),
        updatedCharacter.status,
        characterId
      ]
    );

    // Include updated stats in response
    const responseWithStats = {
      ...storyResponse,
      characterHealth: updatedCharacter.health,
      characterMoney: updatedCharacter.money,
      characterStatus: updatedCharacter.status
    };

    res.json(responseWithStats);
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
    
    // Verify character belongs to authenticated user
    if (row.player_id !== req.userId) {
      return res.status(403).json({ error: 'Access denied' });
    }
    
    const character: Character = {
      id: row.id,
      playerId: row.player_id,
      background: row.background,
      augmentations: row.augmentations,
      appearance: row.appearance,
      trade: row.trade,
      optionalPrompts: parseJsonField(row.optional_prompts),
      fullDescription: row.full_description,
      createdAt: row.created_at,
      currentStoryState: parseJsonField(row.current_story_state),
      status: row.status,
      storyHistory: parseJsonField(row.story_history) || [],
      inventory: parseJsonField(row.inventory) || [],
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

    // Calculate damage based on combat outcome and injuries
    // AI decides damage through characterStatus and injuries
    let healthChange = 0;
    if (combatResolution.characterStatus === 'dead') {
      healthChange = -character.health; // Kill character
    } else if (combatResolution.characterStatus === 'injured') {
      // Calculate damage based on injuries (AI decides)
      const injuryCount = combatResolution.characterInjuries?.length || 0;
      healthChange = -(10 + (injuryCount * 5)); // Base 10 damage + 5 per injury
    } else if (combatResolution.outcome === 'defeat') {
      healthChange = -20; // Significant damage on defeat
    } else if (combatResolution.outcome === 'victory') {
      healthChange = -5; // Minor damage even on victory
    } else {
      healthChange = -10; // Default damage
    }
    
    // Apply health change
    let newHealth = Math.max(0, character.health + healthChange);
    let newStatus = character.status;
    
    if (newHealth <= 0 || combatResolution.characterStatus === 'dead') {
      newHealth = 0;
      newStatus = 'dead';
      console.log(`Character ${characterId} has died from combat`);
    }
    
    // Update character
    await runInsert(
      'UPDATE characters SET story_history = ?, health = ?, status = ? WHERE id = ?',
      [JSON.stringify(character.storyHistory), newHealth, newStatus, characterId]
    );

    // Add image and stats to combat resolution response
    const responseWithImage = {
      ...combatResolution,
      imageUrl: imageData?.imageUrl,
      imagePrompt: imageData?.imagePrompt,
      healthChange: healthChange,
      characterHealth: newHealth,
      characterStatus: newStatus
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

