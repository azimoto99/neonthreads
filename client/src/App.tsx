import { useState, useEffect } from 'react';
import './App.css';
import CharacterCreation from './components/CharacterCreation';
import GameInterface from './components/GameInterface';
import { Character } from './types';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';

function App() {
  const [currentCharacter, setCurrentCharacter] = useState<Character | null>(null);
  const [playerId, setPlayerId] = useState<string>('');

  useEffect(() => {
    // Get or create player ID from localStorage
    let storedPlayerId = localStorage.getItem('neonThreadsPlayerId');
    if (!storedPlayerId) {
      storedPlayerId = `player_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      localStorage.setItem('neonThreadsPlayerId', storedPlayerId);
    }
    setPlayerId(storedPlayerId);

    // Try to load last active character from localStorage
    const lastCharacterId = localStorage.getItem('neonThreadsLastCharacter');
    if (lastCharacterId) {
      fetchCharacter(lastCharacterId);
    }
  }, []);

  const fetchCharacter = async (characterId: string) => {
    try {
      const response = await fetch(`${API_BASE_URL}/characters/${characterId}`);
      if (response.ok) {
        const character = await response.json();
        setCurrentCharacter(character);
        localStorage.setItem('neonThreadsLastCharacter', characterId);
      } else {
        localStorage.removeItem('neonThreadsLastCharacter');
      }
    } catch (error) {
      console.error('Error fetching character:', error);
    }
  };

  const handleCharacterCreated = (character: Character) => {
    setCurrentCharacter(character);
    localStorage.setItem('neonThreadsLastCharacter', character.id);
  };

  const handleCharacterDeath = () => {
    setCurrentCharacter(null);
    localStorage.removeItem('neonThreadsLastCharacter');
  };

  if (!currentCharacter) {
    return (
      <div className="App">
        <CharacterCreation 
          playerId={playerId}
          onCharacterCreated={handleCharacterCreated}
        />
      </div>
    );
  }

  return (
    <div className="App">
      <GameInterface 
        character={currentCharacter}
        playerId={playerId}
        onCharacterDeath={handleCharacterDeath}
        onNewCharacter={() => setCurrentCharacter(null)}
      />
    </div>
  );
}

export default App;

