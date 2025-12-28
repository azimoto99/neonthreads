import express from 'express';
import { v4 as uuidv4 } from 'uuid';
import { runQuery, runInsert } from '../database';
import { Character, CreateCharacterRequest, InventoryItem } from '../types';

const router = express.Router();

// Create a new character
router.post('/', async (req, res) => {
  try {
    const request: CreateCharacterRequest = req.body;
    const { background, augmentations, appearance, trade, optionalPrompts } = request;

    // Validate required fields
    if (!background || !augmentations || !appearance || !trade) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // Generate player ID if not provided (for MVP, we'll use a simple approach)
    const playerId = req.body.playerId || uuidv4();

    // Build full description
    let fullDescription = `Background: ${background}\n`;
    fullDescription += `Augmentations/Cyberware: ${augmentations}\n`;
    fullDescription += `Appearance: ${appearance}\n`;
    fullDescription += `Trade/Skill: ${trade}`;

    if (optionalPrompts) {
      if (optionalPrompts.enemies) {
        fullDescription += `\nEnemies/Those who want them dead: ${optionalPrompts.enemies}`;
      }
      if (optionalPrompts.neverSellOut) {
        fullDescription += `\nNever sell out: ${optionalPrompts.neverSellOut}`;
      }
      if (optionalPrompts.secret) {
        fullDescription += `\nBiggest secret/regret: ${optionalPrompts.secret}`;
      }
      if (optionalPrompts.problemHandling) {
        fullDescription += `\nProblem handling style: ${optionalPrompts.problemHandling}`;
      }
      if (optionalPrompts.reputation) {
        fullDescription += `\nStreet reputation: ${optionalPrompts.reputation}`;
      }
    }

    const characterId = uuidv4();
    const createdAt = new Date().toISOString();
    const initialStoryState = JSON.stringify({
      location: 'night_city_street',
      currentScene: 'initial',
      activeComplications: [],
      npcRelationships: {},
      worldState: {}
    });

    // Starting inventory based on trade
    const startingInventory = getStartingInventory(trade);
    
    // Insert character
    await runInsert(
      `INSERT INTO characters (id, player_id, background, augmentations, appearance, trade, optional_prompts, full_description, created_at, current_story_state, status, story_history, inventory, money, health, max_health)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        characterId,
        playerId,
        background,
        augmentations,
        appearance,
        trade,
        optionalPrompts ? JSON.stringify(optionalPrompts) : null,
        fullDescription,
        createdAt,
        initialStoryState,
        'alive',
        '[]',
        JSON.stringify(startingInventory),
        500, // Starting money
        100, // Starting health
        100  // Max health
      ]
    );

    const character: Character = {
      id: characterId,
      playerId,
      background,
      augmentations,
      appearance,
      trade,
      optionalPrompts,
      fullDescription,
      createdAt,
      currentStoryState: JSON.parse(initialStoryState),
      status: 'alive',
      storyHistory: [],
      inventory: startingInventory,
      money: 500,
      health: 100,
      maxHealth: 100
    };

    res.json(character);
  } catch (error) {
    console.error('Error creating character:', error);
    res.status(500).json({ error: 'Failed to create character' });
  }
});

// Get character by ID
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const rows = await runQuery<any[]>(
      'SELECT * FROM characters WHERE id = ?',
      [id]
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

    res.json(character);
  } catch (error) {
    console.error('Error fetching character:', error);
    res.status(500).json({ error: 'Failed to fetch character' });
  }
});

// Get all characters for a player
router.get('/player/:playerId', async (req, res) => {
  try {
    const { playerId } = req.params;
    const rows = await runQuery<any[]>(
      'SELECT * FROM characters WHERE player_id = ? ORDER BY created_at DESC',
      [playerId]
    );

    const characters: Character[] = rows.map(row => ({
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
    }));

    res.json(characters);
  } catch (error) {
    console.error('Error fetching characters:', error);
    res.status(500).json({ error: 'Failed to fetch characters' });
  }
});

// Update character status
router.patch('/:id/status', async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    if (!status || !['alive', 'dead'].includes(status)) {
      return res.status(400).json({ error: 'Invalid status' });
    }

    await runInsert(
      'UPDATE characters SET status = ? WHERE id = ?',
      [status, id]
    );

    res.json({ success: true });
  } catch (error) {
    console.error('Error updating character status:', error);
    res.status(500).json({ error: 'Failed to update character status' });
  }
});

// Helper function to get starting inventory based on trade
function getStartingInventory(trade: string): InventoryItem[] {
  const tradeLower = trade.toLowerCase();
  const inventory: InventoryItem[] = [
    { name: 'Basic Commlink', description: 'Standard communication device', quantity: 1, type: 'tool' },
    { name: 'Street Clothes', description: 'Basic clothing', quantity: 1, type: 'misc' }
  ];

  if (tradeLower.includes('solo') || tradeLower.includes('combat') || tradeLower.includes('fighter')) {
    inventory.push(
      { name: 'Pistol', description: 'Standard handgun', quantity: 1, type: 'weapon' },
      { name: 'Ammo', description: 'Pistol ammunition', quantity: 30, type: 'consumable' },
      { name: 'Combat Knife', description: 'Melee weapon', quantity: 1, type: 'weapon' }
    );
  } else if (tradeLower.includes('netrunner') || tradeLower.includes('hack') || tradeLower.includes('tech')) {
    inventory.push(
      { name: 'Cyberdeck', description: 'Hacking interface', quantity: 1, type: 'tool' },
      { name: 'Data Shard', description: 'Hacking tool', quantity: 3, type: 'consumable' }
    );
  } else if (tradeLower.includes('fixer') || tradeLower.includes('dealer')) {
    inventory.push(
      { name: 'Contacts List', description: 'Network of connections', quantity: 1, type: 'misc' },
      { name: 'Credstick', description: 'Digital currency storage', quantity: 1, type: 'tool' }
    );
  } else if (tradeLower.includes('medic') || tradeLower.includes('doctor')) {
    inventory.push(
      { name: 'Medkit', description: 'Medical supplies', quantity: 1, type: 'tool' },
      { name: 'Stim', description: 'Healing stimulant', quantity: 2, type: 'consumable' }
    );
  }

  return inventory;
}

export { router as characterRoutes };

