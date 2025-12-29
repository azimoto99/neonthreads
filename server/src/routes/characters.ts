import express from 'express';
import { v4 as uuidv4 } from 'uuid';
import { runQuery, runInsert, runUpdate, parseJsonField } from '../database';
import { ImageService } from '../services/imageService';
import { Character, CreateCharacterRequest, InventoryItem } from '../types';
import { authenticateToken } from '../middleware/auth';

const router = express.Router();

// All character routes require authentication
router.use(authenticateToken);

// Create a new character
router.post('/', async (req, res) => {
  try {
    const request: CreateCharacterRequest = req.body;
    const { background, augmentations, appearance, trade, optionalPrompts } = request;

    // Validate required fields
    if (!background || !augmentations || !appearance || !trade) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // Use authenticated user's ID as player ID
    const playerId = req.userId!;

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

    res.json(character);
  } catch (error) {
    console.error('Error fetching character:', error);
    res.status(500).json({ error: 'Failed to fetch character' });
  }
});

// Get all characters for the authenticated user
router.get('/my-characters', async (req, res) => {
  try {
    const playerId = req.userId!;
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

    // Verify character belongs to authenticated user
    const rows = await runQuery<any[]>(
      'SELECT * FROM characters WHERE id = ?',
      [id]
    );

    if (rows.length === 0) {
      return res.status(404).json({ error: 'Character not found' });
    }

    if (rows[0].player_id !== req.userId) {
      return res.status(403).json({ error: 'Access denied' });
    }

    await runUpdate(
      'UPDATE characters SET status = ? WHERE id = ?',
      [status, id]
    );

    res.json({ success: true });
  } catch (error) {
    console.error('Error updating character status:', error);
    res.status(500).json({ error: 'Failed to update character status' });
  }
});

// Generate character portrait
router.get('/:id/portrait', async (req, res) => {
  try {
    const { id } = req.params;
    const forceRegenerate = req.query.force === 'true';
    
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

    // Compute current appearance hash
    const currentHash = ImageService.getAppearanceHash(character);
    
    // Check if we have a stored portrait hash (we'll store it in story_state for now)
    const storedHash = character.currentStoryState.portraitHash;
    
    // Check if we have a cached portrait URL
    const cachedPortraitUrl = row.portrait_url;
    
    // Regenerate if forced, hash changed, no hash exists, or no cached URL
    if (forceRegenerate || !storedHash || storedHash !== currentHash || !cachedPortraitUrl) {
      const isAppearanceChange = storedHash && storedHash !== currentHash && cachedPortraitUrl;
      console.log('Generating character portrait for:', character.id, 
        forceRegenerate ? '(forced)' : isAppearanceChange ? '(appearance changed - editing)' : '(no cache - generating new)');
      
      // If appearance changed and we have existing portrait, edit it instead of generating new
      const portraitUrl = await ImageService.generateCharacterPortrait(
        character, 
        isAppearanceChange ? cachedPortraitUrl : undefined
      );

      if (!portraitUrl) {
        return res.status(500).json({ error: 'Failed to generate character portrait' });
      }

      // Update portrait hash and URL
      character.currentStoryState.portraitHash = currentHash;
      await runUpdate(
        'UPDATE characters SET current_story_state = ?, portrait_url = ? WHERE id = ?',
        [JSON.stringify(character.currentStoryState), portraitUrl, id]
      );

      res.json({ portraitUrl, hash: currentHash });
    } else {
      // Portrait is cached and still valid - return cached URL
      console.log('Returning cached portrait for:', character.id);
      res.json({ portraitUrl: cachedPortraitUrl, hash: currentHash });
    }
  } catch (error) {
    console.error('Error generating character portrait:', error);
    res.status(500).json({ error: 'Failed to generate character portrait' });
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

