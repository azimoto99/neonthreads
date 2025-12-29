import { useState, useEffect } from 'react';
import './GameInterface.css';
import BodySilhouette from './BodySilhouette';
import LocationIndicator from './LocationIndicator';
import { Character, StoryResponse, CombatResolution } from '../types';
import { authenticatedFetch } from '../utils/api';

interface GameInterfaceProps {
  character: Character;
  playerId: string;
  onCharacterDeath: () => void;
  onNewCharacter: () => void;
}

const GameInterface: React.FC<GameInterfaceProps> = ({ 
  character, 
  playerId: _playerId, 
  onCharacterDeath,
  onNewCharacter 
}) => {
  const [currentStory, setCurrentStory] = useState<StoryResponse | null>(null);
  const [playerAction, setPlayerAction] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [combatMode, setCombatMode] = useState(false);
  const [combatTactics, setCombatTactics] = useState('');
  const [characterPortrait, setCharacterPortrait] = useState<string | null>(null);
  const [inventoryOpen, setInventoryOpen] = useState(false);
  const [currentCharacter, setCurrentCharacter] = useState<Character>(character);
  
  // Update local character state when prop changes
  useEffect(() => {
    setCurrentCharacter(character);
  }, [character]);

  useEffect(() => {
    // Load initial story scenario if character has no story history
    if (character.storyHistory.length === 0) {
      loadStoryScenario();
    } else {
      // Load the most recent story event
      const lastEvent = character.storyHistory[character.storyHistory.length - 1];
      setCurrentStory({
        scenario: lastEvent.description,
        outcome: lastEvent.outcome,
        requiresInput: true,
        nextScene: character.currentStoryState.currentScene,
        imageUrl: lastEvent.imageUrl
      });
    }
    // Load character portrait if available
    loadCharacterPortrait();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [character.id, character.appearance, character.inventory]);

  const loadCharacterPortrait = async () => {
    try {
      console.log('Loading character portrait for:', character.id);
      const response = await authenticatedFetch(`/characters/${character.id}/portrait`);
      
      if (!response.ok) {
        console.warn('Failed to load character portrait:', response.status);
        setCharacterPortrait(null);
        return;
      }

      const data = await response.json();
      if (data.portraitUrl) {
        console.log('Character portrait loaded successfully');
        setCharacterPortrait(data.portraitUrl);
      } else {
        console.warn('No portrait URL in response');
        setCharacterPortrait(null);
      }
    } catch (error) {
      console.error('Error loading character portrait:', error);
      setCharacterPortrait(null);
    }
  };

  const loadStoryScenario = async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await authenticatedFetch(`/story/${character.id}/scenario`, {
        method: 'POST',
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
        throw new Error(errorData.error || `Server error: ${response.status}`);
      }

      const story = await response.json();
      setCurrentStory(story);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to load story';
      console.error('Story generation error:', err);
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const handleActionSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!playerAction.trim() || loading) return;

    setLoading(true);
    setError(null);

    try {
      const response = await authenticatedFetch(`/story/${character.id}/action`, {
        method: 'POST',
        body: JSON.stringify({
          action: playerAction,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to process action');
      }

      const storyResponse: StoryResponse = await response.json();
      setCurrentStory(storyResponse);
      setPlayerAction('');

        // Always fetch updated character to get new health/money/inventory
        const updatedCharacter = await fetchCharacter();
        if (updatedCharacter) {
          setCurrentCharacter(updatedCharacter);
          // Update character state - this will trigger re-render with new health/money
          // Check if inventory or appearance changed and regenerate portrait
          const inventoryChanged = JSON.stringify(updatedCharacter.inventory) !== JSON.stringify(currentCharacter.inventory);
          const appearanceChanged = updatedCharacter.appearance !== currentCharacter.appearance;
          if (inventoryChanged || appearanceChanged) {
            console.log('Character appearance or inventory changed, regenerating portrait');
            loadCharacterPortrait();
          }
          
          // Check for death
          if (updatedCharacter.status === 'dead' || (updatedCharacter.health !== undefined && updatedCharacter.health <= 0)) {
            setTimeout(() => {
              alert('Your character has died. The streets of Night City are unforgiving.');
              onCharacterDeath();
            }, 2000);
          }
        }

      // If combat is initiated, enter combat mode
      if (storyResponse.combat) {
        setCombatMode(true);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to process action');
    } finally {
      setLoading(false);
    }
  };

  const handleCombatSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!combatTactics.trim() || !currentStory?.combat || loading) return;

    setLoading(true);
    setError(null);

    try {
      const response = await authenticatedFetch(`/story/${character.id}/combat`, {
        method: 'POST',
        body: JSON.stringify({
          combatScenario: currentStory.combat,
          playerTactics: combatTactics,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to resolve combat');
      }

      const combatResolution: CombatResolution = await response.json();
      
      // Update story with combat outcome
      setCurrentStory({
        scenario: combatResolution.description,
        outcome: combatResolution.outcome,
        requiresInput: combatResolution.characterStatus !== 'dead',
        nextScene: character.currentStoryState.currentScene,
        imageUrl: combatResolution.imageUrl
      });

      setCombatMode(false);
      setCombatTactics('');

      // Always fetch updated character to get new health/money/inventory
      const updatedCharacter = await fetchCharacter();
      if (updatedCharacter) {
        setCurrentCharacter(updatedCharacter);
        // Check if inventory or appearance changed and regenerate portrait
        const inventoryChanged = JSON.stringify(updatedCharacter.inventory) !== JSON.stringify(currentCharacter.inventory);
        const appearanceChanged = updatedCharacter.appearance !== currentCharacter.appearance;
        if (inventoryChanged || appearanceChanged) {
          console.log('Character appearance or inventory changed after combat, regenerating portrait');
          loadCharacterPortrait();
        }
      }

      // Check if character died (from combat resolution or health reaching 0)
      if (combatResolution.characterStatus === 'dead' || 
          (updatedCharacter && (updatedCharacter.status === 'dead' || (updatedCharacter.health !== undefined && updatedCharacter.health <= 0)))) {
        setTimeout(() => {
          alert('Your character has died. The streets of Night City are unforgiving.');
          onCharacterDeath();
        }, 2000);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to resolve combat');
    } finally {
      setLoading(false);
    }
  };

  const fetchCharacter = async (): Promise<Character | null> => {
    try {
      const response = await authenticatedFetch(`/characters/${character.id}`);
      if (response.ok) {
        return await response.json();
      }
    } catch (err) {
      console.error('Error fetching character:', err);
    }
    return null;
  };

  // Extract injuries from story history or character state
  const getInjuries = (): string[] => {
    const injuries: string[] = [];
    // Check recent story events for injuries
    const recentEvents = currentCharacter.storyHistory.slice(-5);
    recentEvents.forEach(event => {
      if (event.consequences) {
        event.consequences.forEach(consequence => {
          if (consequence.toLowerCase().includes('injured') || 
              consequence.toLowerCase().includes('damage') ||
              consequence.toLowerCase().includes('wound')) {
            injuries.push(consequence);
          }
        });
      }
    });
    return injuries.slice(0, 3); // Limit to 3 most recent
  };

  // Calculate mental state and stress (placeholder logic - can be enhanced)
  const mentalState = Math.max(0, Math.min(100, (currentCharacter.health || 100) + 20));
  const stressLevel = Math.max(0, Math.min(100, 100 - (currentCharacter.health || 100)));

  return (
    <div className="game-interface">
      <div className="game-header">
        <h1 className="neon-glow">NEON THREADS</h1>
        <button onClick={onNewCharacter} className="btn-new-character">
          New Character
        </button>
      </div>

      <div className="game-grid-layout">
        {/* Top Left: Location Indicator */}
        <div className="grid-location">
          <LocationIndicator 
            location={character.currentStoryState.location}
            scene={character.currentStoryState.currentScene}
          />
        </div>

        {/* Top Middle: Scene Image */}
        <div className="grid-scene-image">
          {loading && !currentStory ? (
            <div className="scene-image-placeholder">
              <div className="loading-text">Generating scene...</div>
            </div>
          ) : currentStory?.imageUrl ? (
            <div className="scene-image-container">
              <img 
                src={currentStory.imageUrl} 
                alt="Current scene" 
                className="scene-image"
                onError={(e) => {
                  const target = e.target as HTMLImageElement;
                  console.error('Scene image failed to load:', currentStory.imageUrl?.substring(0, 100));
                  target.style.display = 'none';
                }}
                onLoad={() => {
                  console.log('Scene image loaded successfully');
                }}
              />
            </div>
          ) : (
            <div className="scene-image-placeholder">
              <div className="placeholder-text">No scene image</div>
            </div>
          )}
        </div>

        {/* Top Right: Character Portrait */}
        <div className="grid-character-portrait">
          <div className="character-portrait-container">
            {characterPortrait ? (
              <img 
                src={characterPortrait} 
                alt="Character portrait" 
                className="character-portrait-image"
              />
            ) : (
              <div className="character-portrait-placeholder">
                <div className="portrait-icon">👤</div>
                <div className="portrait-text">{character.appearance.substring(0, 30)}...</div>
              </div>
            )}
          </div>
        </div>

        {/* Under Portrait: HP Bar and Inventory */}
        <div className="grid-character-stats">
          <div className="character-stats-container">
            <div className="info-section">
              <h3>Health</h3>
              <div className="health-bar-container">
                <div className="health-bar" style={{ width: `${Math.max(0, Math.min(100, ((currentCharacter.health || 100) / (currentCharacter.maxHealth || 100)) * 100))}%` }}>
                  <span className="health-text">{currentCharacter.health || 100}/{currentCharacter.maxHealth || 100}</span>
                </div>
              </div>
            </div>
            <div className="info-section">
              <h3>Money</h3>
              <p className="money-display">{(currentCharacter.money || 500).toLocaleString()} eddies</p>
            </div>
            <div className="info-section inventory-section">
              <button 
                className="inventory-button"
                onClick={() => setInventoryOpen(!inventoryOpen)}
                title={inventoryOpen ? "Close inventory" : "Open inventory"}
              >
                <span className="inventory-icon">🎒</span>
                <span className="inventory-button-text">Inventory</span>
                {currentCharacter.inventory && currentCharacter.inventory.length > 0 && (
                  <span className="inventory-count">{currentCharacter.inventory.length}</span>
                )}
              </button>
              {inventoryOpen && (
                <div className="inventory-list">
                  {currentCharacter.inventory && currentCharacter.inventory.length > 0 ? (
                    currentCharacter.inventory.map((item, index) => (
                      <div key={index} className="inventory-item">
                        <span className="item-name">{item.name}</span>
                        {item.quantity > 1 && <span className="item-quantity">x{item.quantity}</span>}
                      </div>
                    ))
                  ) : (
                    <p className="empty-inventory">Empty</p>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Middle Bottom: Story Text (Scrollable) */}
        <div className="grid-story-text">
          <div className="story-text-container">
            <div className="story-text-header">
              <h3>Story</h3>
            </div>
            <div className="story-text-content">
              {loading && !currentStory ? (
                <div className="story-loading">Generating your story...</div>
              ) : currentStory ? (
                <>
                  <div className="story-scenario">{currentStory.scenario}</div>
                  {currentStory.outcome && (
                    <div className={`story-outcome ${currentStory.success === false ? 'failure' : currentStory.success === true ? 'success' : ''}`}>
                      <strong>Outcome:</strong> {currentStory.outcome}
                      {currentStory.success !== undefined && (
                        <span className={`result-badge ${currentStory.success ? 'success' : 'failure'}`}>
                          {currentStory.success ? '✓ SUCCESS' : '✗ FAILURE'}
                        </span>
                      )}
                    </div>
                  )}
                  {currentStory.consequences && currentStory.consequences.length > 0 && (
                    <div className="story-consequences">
                      <strong>Consequences:</strong>
                      <ul>
                        {currentStory.consequences.map((consequence, i) => (
                          <li key={i}>{consequence}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {(currentStory.healthChange || currentStory.moneyChange) && (
                    <div className="stat-changes">
                      {currentStory.healthChange && (
                        <span className={`stat-change ${currentStory.healthChange < 0 ? 'negative' : 'positive'}`}>
                          Health: {currentStory.healthChange > 0 ? '+' : ''}{currentStory.healthChange}
                        </span>
                      )}
                      {currentStory.moneyChange && (
                        <span className={`stat-change ${currentStory.moneyChange < 0 ? 'negative' : 'positive'}`}>
                          Money: {currentStory.moneyChange > 0 ? '+' : ''}{currentStory.moneyChange} eddies
                        </span>
                      )}
                    </div>
                  )}
                  {currentStory.combat && combatMode && (
                    <div className="combat-info-inline">
                      <p><strong>⚔️ COMBAT:</strong> {currentStory.combat.opponent} - {currentStory.combat.environment}</p>
                      <p><strong>Stakes:</strong> {currentStory.combat.stakes}</p>
                    </div>
                  )}
                </>
              ) : (
                <div className="no-story">No story available. Loading...</div>
              )}
              {error && <div className="error-message">{error}</div>}
            </div>
          </div>
        </div>

        {/* Bottom Middle: Chat Input Box */}
        <div className="grid-chat-input">
          <div className="chat-input-container">
            {currentStory?.combat && combatMode ? (
              <form onSubmit={handleCombatSubmit} className="chat-form">
                <textarea
                  value={combatTactics}
                  onChange={(e) => setCombatTactics(e.target.value)}
                  placeholder="Describe your combat tactics..."
                  rows={3}
                  className="chat-input"
                  disabled={loading}
                />
                <button type="submit" className="btn-chat-submit" disabled={loading || !combatTactics.trim()}>
                  {loading ? 'Resolving...' : 'Execute'}
                </button>
              </form>
            ) : !combatMode && currentStory?.requiresInput ? (
              <form onSubmit={handleActionSubmit} className="chat-form">
                <textarea
                  value={playerAction}
                  onChange={(e) => setPlayerAction(e.target.value)}
                  placeholder="What do you do?"
                  rows={3}
                  className="chat-input"
                  disabled={loading}
                />
                <button type="submit" className="btn-chat-submit" disabled={loading || !playerAction.trim()}>
                  {loading ? 'Processing...' : 'Act'}
                </button>
              </form>
            ) : (
              <div className="chat-input-disabled">
                <textarea
                  placeholder="Waiting for story..."
                  rows={3}
                  className="chat-input"
                  disabled={true}
                />
                <button className="btn-chat-submit" disabled={true}>
                  Act
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Bottom Right: Body Silhouette */}
        <div className="grid-body-silhouette">
            <BodySilhouette
            health={currentCharacter.health || 100}
            maxHealth={currentCharacter.maxHealth || 100}
            mentalState={mentalState}
            stressLevel={stressLevel}
            injuries={getInjuries()}
          />
        </div>
      </div>
    </div>
  );
};

export default GameInterface;

