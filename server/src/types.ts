// Character Types
export interface InventoryItem {
  name: string;
  description: string;
  quantity: number;
  type: 'weapon' | 'tool' | 'consumable' | 'cyberware' | 'misc';
}

export interface Character {
  id: string;
  playerId: string;
  background: string;
  augmentations: string;
  appearance: string;
  trade: string;
  optionalPrompts?: {
    enemies?: string;
    neverSellOut?: string;
    secret?: string;
    problemHandling?: string;
    reputation?: string;
  };
  fullDescription: string;
  createdAt: string;
  currentStoryState: StoryState;
  status: 'alive' | 'dead';
  storyHistory: StoryEvent[];
  inventory: InventoryItem[];
  money: number; // in eddies (cyberpunk currency)
  health: number; // 0-100
  maxHealth: number; // 100
}

export interface StoryState {
  location: string;
  currentScene: string;
  activeComplications: string[];
  npcRelationships: Record<string, number>;
  worldState: Record<string, any>;
}

export interface StoryEvent {
  id: string;
  timestamp: string;
  type: 'story' | 'combat' | 'decision' | 'death' | 'multiplayer';
  description: string;
  playerInput?: string;
  outcome: string;
  consequences?: string[];
  imageUrl?: string;
  imagePrompt?: string;
}

// Game Types
export interface ComicPanel {
  panelNumber: number;
  visualDescription: string;
  dialogue?: string[];
  narration?: string;
  imageUrl?: string;
  imagePrompt?: string;
}

export interface StoryResponse {
  scenario: string;
  panels?: ComicPanel[]; // 6 comic book panels (optional for backward compatibility)
  choices?: string[];
  requiresInput: boolean;
  combat?: CombatScenario;
  outcome?: string;
  nextScene?: string;
  imageUrl?: string; // Legacy - for single image
  imagePrompt?: string; // Legacy - for single image
  success?: boolean; // Whether the action succeeded
  difficulty?: 'easy' | 'medium' | 'hard' | 'impossible';
  consequences?: string[]; // Consequences of the action
  healthChange?: number; // Health change (-10 to 10)
  moneyChange?: number; // Money change (-100 to 100)
  inventoryChanges?: string[]; // Array of "+item name" or "-item name"
}

export interface CombatScenario {
  opponent: string;
  opponentDescription: string;
  environment: string;
  stakes: string;
  playerAdvantages?: string[];
  playerDisadvantages?: string[];
}

export interface CombatResolution {
  outcome: 'victory' | 'defeat' | 'escape' | 'negotiation';
  description: string;
  consequences: string[];
  characterInjuries?: string[];
  characterStatus: 'alive' | 'dead' | 'injured';
  imageUrl?: string;
  imagePrompt?: string;
}

// API Types
export interface CreateCharacterRequest {
  background: string;
  augmentations: string;
  appearance: string;
  trade: string;
  optionalPrompts?: Character['optionalPrompts'];
}

export interface PlayerActionRequest {
  characterId: string;
  action: string;
  context?: string;
}

