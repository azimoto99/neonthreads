import { useState, useEffect } from 'react';
import './App.css';
import Login from './components/Login';
import Register from './components/Register';
import CharacterCreation from './components/CharacterCreation';
import GameInterface from './components/GameInterface';
import { Character } from './types';
import { authenticatedFetch } from './utils/api';

type AuthState = 'login' | 'register' | 'authenticated';

function App() {
  const [authState, setAuthState] = useState<AuthState>('login');
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [user, setUser] = useState<{ id: string; email: string; username?: string } | null>(null);
  const [currentCharacter, setCurrentCharacter] = useState<Character | null>(null);

  useEffect(() => {
    // Check if user is already logged in
    const token = localStorage.getItem('neonThreadsToken');
    const userId = localStorage.getItem('neonThreadsUserId');
    
    if (token && userId) {
      // Verify token is still valid
      checkAuth();
    }
  }, []);

  const checkAuth = async () => {
    try {
      const response = await authenticatedFetch('/auth/me');
      if (response.ok) {
        const userData = await response.json();
        setUser({ id: userData.id, email: userData.email, username: userData.username });
        setIsAuthenticated(true);
        setAuthState('authenticated');
        
        // Try to load last active character
        const lastCharacterId = localStorage.getItem('neonThreadsLastCharacter');
        if (lastCharacterId) {
          await fetchCharacter(lastCharacterId);
        }
      } else {
        // Token invalid, clear auth
        localStorage.removeItem('neonThreadsToken');
        localStorage.removeItem('neonThreadsUserId');
        localStorage.removeItem('neonThreadsLastCharacter');
        setUser(null);
        setIsAuthenticated(false);
        setAuthState('login');
        setCurrentCharacter(null);
      }
    } catch (error) {
      console.error('Error checking auth:', error);
      // Only clear auth if it's an auth error
      if (error instanceof Error && error.message === 'Authentication required') {
        localStorage.removeItem('neonThreadsToken');
        localStorage.removeItem('neonThreadsUserId');
        localStorage.removeItem('neonThreadsLastCharacter');
        setUser(null);
        setIsAuthenticated(false);
        setAuthState('login');
        setCurrentCharacter(null);
      }
    }
  };

  const handleLogin = (_token: string, userData: { id: string; email: string; username?: string }) => {
    setUser(userData);
    setIsAuthenticated(true);
    setAuthState('authenticated');
  };

  const handleLogout = () => {
    localStorage.removeItem('neonThreadsToken');
    localStorage.removeItem('neonThreadsUserId');
    localStorage.removeItem('neonThreadsLastCharacter');
    setUser(null);
    setIsAuthenticated(false);
    setCurrentCharacter(null);
    setAuthState('login');
  };

  const fetchCharacter = async (characterId: string) => {
    try {
      const response = await authenticatedFetch(`/characters/${characterId}`);
      if (response.ok) {
        const character = await response.json();
        setCurrentCharacter(character);
        localStorage.setItem('neonThreadsLastCharacter', characterId);
      } else {
        localStorage.removeItem('neonThreadsLastCharacter');
      }
    } catch (error) {
      console.error('Error fetching character:', error);
      if (error instanceof Error && error.message === 'Authentication required') {
        handleLogout();
      }
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

  // Show login/register if not authenticated
  if (!isAuthenticated) {
    if (authState === 'register') {
      return (
        <div className="App">
          <Register 
            onRegister={handleLogin}
            onSwitchToLogin={() => setAuthState('login')}
          />
        </div>
      );
    }
    
    return (
      <div className="App">
        <Login 
          onLogin={handleLogin}
          onSwitchToRegister={() => setAuthState('register')}
        />
      </div>
    );
  }

  // Show character creation or game interface
  if (!currentCharacter) {
    return (
      <div className="App">
        <div style={{ position: 'absolute', top: '20px', right: '20px' }}>
          <button 
            onClick={handleLogout}
            className="btn btn-secondary"
            style={{ padding: '8px 16px', fontSize: '14px' }}
          >
            Logout ({user?.email})
          </button>
        </div>
        <CharacterCreation 
          onCharacterCreated={handleCharacterCreated}
        />
      </div>
    );
  }

  return (
    <div className="App">
      <GameInterface 
        character={currentCharacter}
        playerId={user!.id}
        onCharacterDeath={handleCharacterDeath}
        onNewCharacter={() => setCurrentCharacter(null)}
      />
    </div>
  );
}

export default App;

