import React, { useState, useEffect } from 'react';
import './GameInterface.css';
import ComicBook from './ComicBook';
import ComicPanel from './ComicPanel';
import { Character, StoryResponse, CombatResolution } from '../types';

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:3001/api';

interface GameInterfaceProps {
  character: Character;
  playerId: string;
  onCharacterDeath: () => void;
  onNewCharacter: () => void;
  onCharacterUpdate?: (character: Character) => void;
}

const GameInterface: React.FC<GameInterfaceProps> = ({ 
  character, 
  playerId, 
  onCharacterDeath,
  onNewCharacter,
  onCharacterUpdate
}) => {
  const [currentStory, setCurrentStory] = useState<StoryResponse | null>(null);
  const [playerAction, setPlayerAction] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [combatMode, setCombatMode] = useState(false);
  const [combatTactics, setCombatTactics] = useState('');
  const [storyHistory, setStoryHistory] = useState(character.storyHistory);

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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [character.id]);

  const loadStoryScenario = async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`${API_BASE_URL}/story/${character.id}/scenario`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
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
      const response = await fetch(`${API_BASE_URL}/story/${character.id}/action`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
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

      // Update character to reflect health/money/inventory changes
      const updatedCharacter = await fetchCharacter();
      if (updatedCharacter) {
        setStoryHistory(updatedCharacter.storyHistory);
        
        // Update parent component with new character data (for health bar update)
        if (onCharacterUpdate) {
          onCharacterUpdate(updatedCharacter);
        }
        
        // Check if character died (from health reaching 0)
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
      const response = await fetch(`${API_BASE_URL}/story/${character.id}/combat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
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

      // Check if character died
      if (combatResolution.characterStatus === 'dead') {
        setTimeout(() => {
          alert('Your character has died. The streets of Night City are unforgiving.');
          onCharacterDeath();
        }, 2000);
      } else {
        // Update story history and character
        const updatedCharacter = await fetchCharacter();
        if (updatedCharacter) {
          setStoryHistory(updatedCharacter.storyHistory);
          if (onCharacterUpdate) {
            onCharacterUpdate(updatedCharacter);
          }
          
          // Check if character died
          if (updatedCharacter.status === 'dead' || (updatedCharacter.health !== undefined && updatedCharacter.health <= 0)) {
            setTimeout(() => {
              alert('Your character has died. The streets of Night City are unforgiving.');
              onCharacterDeath();
            }, 2000);
          }
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to resolve combat');
    } finally {
      setLoading(false);
    }
  };

  const fetchCharacter = async (): Promise<Character | null> => {
    try {
      const response = await fetch(`${API_BASE_URL}/characters/${character.id}`);
      if (response.ok) {
        return await response.json();
      }
    } catch (err) {
      console.error('Error fetching character:', err);
    }
    return null;
  };

  return (
    <div className="game-interface">
      <div className="game-header">
        <h1 className="neon-glow">NEON THREADS</h1>
        <button onClick={onNewCharacter} className="btn-new-character">
          New Character
        </button>
      </div>

      <div className="game-layout">
        <div className="character-sidebar">
          <h2>Character</h2>
          <div className="character-info">
            <div className="info-section">
              <h3>Health</h3>
              <div className="health-bar-container">
                <div className="health-bar" style={{ width: `${(character.health || 100) / (character.maxHealth || 100) * 100}%` }}>
                  <span className="health-text">{character.health || 100}/{character.maxHealth || 100}</span>
                </div>
              </div>
            </div>
            <div className="info-section">
              <h3>Money</h3>
              <p className="money-display">{(character.money || 500).toLocaleString()} eddies</p>
            </div>
            <div className="info-section">
              <h3>Status</h3>
              <p className={`status ${character.status}`}>{character.status.toUpperCase()}</p>
            </div>
            <div className="info-section">
              <h3>Location</h3>
              <p>{character.currentStoryState.currentScene.replace(/_/g, ' ')}</p>
            </div>
            <div className="info-section">
              <h3>Inventory</h3>
              <div className="inventory-list">
                {character.inventory && character.inventory.length > 0 ? (
                  character.inventory.map((item, index) => (
                    <div key={index} className="inventory-item">
                      <span className="item-name">{item.name}</span>
                      {item.quantity > 1 && <span className="item-quantity">x{item.quantity}</span>}
                      <span className="item-type">{item.type}</span>
                    </div>
                  ))
                ) : (
                  <p className="empty-inventory">Empty</p>
                )}
              </div>
            </div>
          </div>
        </div>

        <div className="story-panel">
          <div className="story-content">
            {loading && !currentStory ? (
              <ComicPanel 
                text="Generating your story..." 
                loading={true}
              />
            ) : currentStory ? (
              <>
                {currentStory.panels && currentStory.panels.length > 0 ? (
                  <ComicBook 
                    panels={currentStory.panels}
                    loading={loading}
                  />
                ) : (
                  <ComicPanel
                    imageUrl={currentStory.imageUrl}
                    text={currentStory.scenario}
                    type={currentStory.combat ? 'combat' : 'story'}
                    loading={loading && !currentStory.imageUrl}
                  />
                )}
                {currentStory.outcome && (
                  <div className={`outcome ${currentStory.success === false ? 'failure' : currentStory.success === true ? 'success' : ''}`}>
                    <div>
                      <strong>Outcome:</strong> {currentStory.outcome}
                      {currentStory.success !== undefined && (
                        <span className={`result-badge ${currentStory.success ? 'success' : 'failure'}`}>
                          {currentStory.success ? '✓ SUCCESS' : '✗ FAILURE'}
                        </span>
                      )}
                    </div>
                  </div>
                )}
                {currentStory.consequences && currentStory.consequences.length > 0 && (
                  <div className="consequences">
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
                  <div className="combat-section">
                    <h3>⚔️ COMBAT</h3>
                    <div className="combat-info">
                      <p><strong>Opponent:</strong> {currentStory.combat.opponent}</p>
                      <p><strong>Environment:</strong> {currentStory.combat.environment}</p>
                      <p><strong>Stakes:</strong> {currentStory.combat.stakes}</p>
                    </div>
                    <form onSubmit={handleCombatSubmit} className="combat-form">
                      <textarea
                        value={combatTactics}
                        onChange={(e) => setCombatTactics(e.target.value)}
                        placeholder="Describe your combat tactics..."
                        rows={4}
                        className="action-input"
                        disabled={loading}
                      />
                      <button type="submit" className="btn-action" disabled={loading || !combatTactics.trim()}>
                        {loading ? 'Resolving...' : 'Execute Tactics'}
                      </button>
                    </form>
                  </div>
                )}

                {!combatMode && currentStory.requiresInput !== false && (
                  <form onSubmit={handleActionSubmit} className="action-form">
                    <textarea
                      value={playerAction}
                      onChange={(e) => setPlayerAction(e.target.value)}
                      placeholder="What do you do?"
                      rows={4}
                      className="action-input"
                      disabled={loading}
                    />
                    <button type="submit" className="btn-action" disabled={loading || !playerAction.trim()}>
                      {loading ? 'Processing...' : 'Act'}
                    </button>
                  </form>
                )}
              </>
            ) : (
              <div className="no-story">No story available. Loading...</div>
            )}

            {error && <div className="error-message">{error}</div>}
          </div>

          <div className="story-history">
            <h3>Story History</h3>
            <div className="history-list">
              {storyHistory.slice().reverse().map((event, index) => (
                <div key={event.id || index} className="history-item">
                  <div className="history-type">{event.type.toUpperCase()}</div>
                  {event.imageUrl && (
                    <img 
                      src={event.imageUrl} 
                      alt="Story panel" 
                      className="history-image"
                      onError={(e) => {
                        (e.target as HTMLImageElement).style.display = 'none';
                      }}
                    />
                  )}
                  <div className="history-description">{event.description.substring(0, 150)}...</div>
                  {event.playerInput && (
                    <div className="history-input">You: {event.playerInput}</div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default GameInterface;

