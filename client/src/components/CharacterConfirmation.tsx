import React, { useState, useEffect } from 'react';
import './CharacterConfirmation.css';
import { Character } from '../types';
import { authenticatedFetch } from '../utils/api';

interface CharacterConfirmationProps {
  character: Character;
  onConfirm: () => void;
  onBack: () => void;
  onDeleteCharacter?: () => void;
}

const CharacterConfirmation: React.FC<CharacterConfirmationProps> = ({ 
  character, 
  onConfirm,
  onBack,
  onDeleteCharacter
}) => {
  const [portraitUrl, setPortraitUrl] = useState<string | null>(null);
  const [loadingPortrait, setLoadingPortrait] = useState(true);
  const [editingPortrait, setEditingPortrait] = useState(false);
  const [editPrompt, setEditPrompt] = useState('');
  const [loadingEdit, setLoadingEdit] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Fetch character portrait
    fetchPortrait();
  }, [character.id]);

  const fetchPortrait = async () => {
    setLoadingPortrait(true);
    setError(null);
    try {
      const response = await authenticatedFetch(`/characters/${character.id}/portrait`);
      if (response.ok) {
        const data = await response.json();
        setPortraitUrl(data.portraitUrl);
      } else {
        setError('Failed to load character portrait');
      }
    } catch (err) {
      console.error('Error fetching portrait:', err);
      setError('Failed to load character portrait');
    } finally {
      setLoadingPortrait(false);
    }
  };

  const handleEditPortrait = async () => {
    if (!editPrompt.trim()) {
      setError('Please enter a prompt to edit the portrait');
      return;
    }

    setLoadingEdit(true);
    setError(null);

    try {
      const response = await authenticatedFetch(`/characters/${character.id}/portrait/edit`, {
        method: 'POST',
        body: JSON.stringify({ prompt: editPrompt.trim() }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to edit portrait');
      }

      const data = await response.json();
      setPortraitUrl(data.portraitUrl);
      setEditPrompt('');
      setEditingPortrait(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to edit portrait');
    } finally {
      setLoadingEdit(false);
    }
  };

  return (
    <div className="character-confirmation fade-in">
      <div className="confirmation-container">
        <h1 className="neon-glow">CHARACTER CONFIRMATION</h1>
        
        <div className="confirmation-content">
          {/* Left side - Portrait */}
          <div className="portrait-section">
            <h2>Portrait</h2>
            {loadingPortrait ? (
              <div className="portrait-loading">
                <div className="spinner"></div>
                <p>Generating portrait...</p>
              </div>
            ) : portraitUrl ? (
              <div className="portrait-display">
                <img 
                  src={portraitUrl} 
                  alt="Character Portrait" 
                  className="character-portrait-img"
                />
                {!editingPortrait ? (
                  <button 
                    className="btn btn-secondary"
                    onClick={() => setEditingPortrait(true)}
                  >
                    Edit Portrait
                  </button>
                ) : (
                  <div className="portrait-edit-form">
                    <textarea
                      value={editPrompt}
                      onChange={(e) => setEditPrompt(e.target.value)}
                      placeholder="Enter a prompt to modify the portrait (e.g., 'make the character look more menacing', 'add a scar on the left cheek', 'change the hair color to blue')"
                      rows={4}
                      className="edit-prompt-input"
                    />
                    <div className="edit-actions">
                      <button
                        className="btn btn-secondary"
                        onClick={() => {
                          setEditingPortrait(false);
                          setEditPrompt('');
                          setError(null);
                        }}
                        disabled={loadingEdit}
                      >
                        Cancel
                      </button>
                      <button
                        className="btn btn-primary"
                        onClick={handleEditPortrait}
                        disabled={loadingEdit || !editPrompt.trim()}
                      >
                        {loadingEdit ? 'Editing...' : 'Apply Edit'}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="portrait-error">
                <p>Failed to load portrait</p>
                <button className="btn btn-secondary" onClick={fetchPortrait}>
                  Retry
                </button>
              </div>
            )}
          </div>

          {/* Right side - Stats and Info */}
          <div className="info-section">
            <div className="stats-grid">
              <div className="stat-card">
                <h3>Health</h3>
                <div className="stat-value">
                  {character.health} / {character.maxHealth}
                </div>
                <div className="health-bar">
                  <div 
                    className="health-fill"
                    style={{ width: `${(character.health / character.maxHealth) * 100}%` }}
                  />
                </div>
              </div>

              <div className="stat-card">
                <h3>Money</h3>
                <div className="stat-value">€{character.money || 500}</div>
              </div>

              <div className="stat-card">
                <h3>Status</h3>
                <div className="stat-value status-badge">{character.status}</div>
              </div>
            </div>

            <div className="character-details">
              <h3>Character Details</h3>
              <div className="detail-item">
                <strong>Background:</strong>
                <p>{character.background}</p>
              </div>
              <div className="detail-item">
                <strong>Appearance:</strong>
                <p>{character.appearance}</p>
              </div>
              <div className="detail-item">
                <strong>Augmentations:</strong>
                <p>{character.augmentations}</p>
              </div>
              <div className="detail-item">
                <strong>Trade/Skill:</strong>
                <p>{character.trade}</p>
              </div>
            </div>

            {character.inventory && character.inventory.length > 0 && (
              <div className="inventory-section">
                <h3>Starting Inventory</h3>
                <div className="inventory-list">
                  {character.inventory.map((item, index) => (
                    <div key={index} className="inventory-item">
                      <span className="item-name">{item.name}</span>
                      {item.type && <span className="item-type">{item.type}</span>}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {error && <div className="error-message">{error}</div>}

        <div className="confirmation-actions">
          {onDeleteCharacter && (
            <button 
              className="btn btn-danger"
              onClick={async () => {
                if (window.confirm('Are you sure you want to delete this character and start over?')) {
                  try {
                    await authenticatedFetch(`/characters/${character.id}`, {
                      method: 'DELETE',
                    });
                    onDeleteCharacter();
                  } catch (err) {
                    setError('Failed to delete character');
                  }
                }
              }}
            >
              Delete & Start Over
            </button>
          )}
          <button 
            className="btn btn-secondary"
            onClick={onBack}
          >
            Back
          </button>
          <button 
            className="btn btn-primary"
            onClick={onConfirm}
            disabled={loadingPortrait}
          >
            Enter Night City
          </button>
        </div>
      </div>
    </div>
  );
};

export default CharacterConfirmation;

