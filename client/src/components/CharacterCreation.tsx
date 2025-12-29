import React, { useState } from 'react';
import './CharacterCreation.css';
import { Character, CreateCharacterRequest } from '../types';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';

interface CharacterCreationProps {
  playerId: string;
  onCharacterCreated: (character: Character) => void;
}

const CharacterCreation: React.FC<CharacterCreationProps> = ({ playerId, onCharacterCreated }) => {
  const [step, setStep] = useState(1);
  const [formData, setFormData] = useState<CreateCharacterRequest>({
    background: '',
    augmentations: '',
    appearance: '',
    trade: '',
    optionalPrompts: {}
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const corePrompts = [
    {
      key: 'background' as keyof CreateCharacterRequest,
      question: "What's your background?",
      placeholder: "e.g., street kid, corpo, nomad, netrunner, fixer, solo...",
      description: "Your origin story shapes who you are in Night City."
    },
    {
      key: 'augmentations' as keyof CreateCharacterRequest,
      question: "What augmentations/cyberware define you?",
      placeholder: "e.g., cybernetic eyes, neural interface, reinforced skeleton, mantis blades...",
      description: "Your chrome makes you more than human. What have you installed?"
    },
    {
      key: 'appearance' as keyof CreateCharacterRequest,
      question: "How do you look?",
      placeholder: "Describe your appearance, style, and distinguishing features...",
      description: "In Night City, style is survival. What's your look?"
    },
    {
      key: 'trade' as keyof CreateCharacterRequest,
      question: "What's your trade or primary skill?",
      placeholder: "e.g., hacking, combat, persuasion, tech, stealth, driving...",
      description: "What do you do to survive in the streets?"
    }
  ];

  const optionalPrompts = [
    {
      key: 'enemies' as const,
      question: "Who wants you dead or who did you betray?",
      placeholder: "Optional - Leave blank to skip"
    },
    {
      key: 'neverSellOut' as const,
      question: "What's the one thing you'd never sell out?",
      placeholder: "Optional - Leave blank to skip"
    },
    {
      key: 'secret' as const,
      question: "What's your biggest secret or regret?",
      placeholder: "Optional - Leave blank to skip"
    },
    {
      key: 'problemHandling' as const,
      question: "How do you handle problems?",
      placeholder: "e.g., talk, hack, fight, run... (Optional)"
    },
    {
      key: 'reputation' as const,
      question: "What's your reputation on the street?",
      placeholder: "Optional - Leave blank to skip"
    }
  ];

  const handleInputChange = (key: string, value: string) => {
    if (key in formData && typeof formData[key as keyof CreateCharacterRequest] === 'string') {
      setFormData({ ...formData, [key]: value });
    } else if (key.startsWith('optional_')) {
      const optionalKey = key.replace('optional_', '') as keyof typeof formData.optionalPrompts;
      setFormData({
        ...formData,
        optionalPrompts: {
          ...formData.optionalPrompts,
          [optionalKey]: value || undefined
        }
      });
    }
  };

  const handleNext = () => {
    if (step <= corePrompts.length) {
      // Core prompts - required
      const currentPrompt = corePrompts[step - 1];
      if (!formData[currentPrompt.key]) {
        setError('Please answer this question before continuing.');
        return;
      }
      setError(null);
      setStep(step + 1);
    } else {
      // Optional prompts - can skip
      setError(null);
      setStep(step + 1);
    }
  };

  const handleBack = () => {
    if (step > 1) {
      setStep(step - 1);
      setError(null);
    }
  };

  const handleSubmit = async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`${API_BASE_URL}/characters`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ...formData,
          playerId
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to create character');
      }

      const character = await response.json();
      onCharacterCreated(character);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create character');
      setLoading(false);
    }
  };

  const currentCorePrompt = step <= corePrompts.length ? corePrompts[step - 1] : null;
  const currentOptionalPrompt = step > corePrompts.length 
    ? optionalPrompts[step - corePrompts.length - 1] 
    : null;
  const isOptionalStep = step > corePrompts.length;
  const isLastStep = step === corePrompts.length + optionalPrompts.length;

  return (
    <div className="character-creation fade-in">
      <div className="creation-container">
        <h1 className="neon-glow">NEON THREADS</h1>
        <h2>Character Creation</h2>
        
        <div className="progress-bar">
          <div 
            className="progress-fill"
            style={{ width: `${(step / (corePrompts.length + optionalPrompts.length)) * 100}%` }}
          />
        </div>

        <div className="prompt-section">
          {currentCorePrompt && (
            <>
              <h3>{currentCorePrompt.question}</h3>
              <p className="prompt-description">{currentCorePrompt.description}</p>
              <textarea
                value={formData[currentCorePrompt.key] as string || ''}
                onChange={(e) => handleInputChange(currentCorePrompt.key, e.target.value)}
                placeholder={currentCorePrompt.placeholder}
                rows={6}
                className="character-input"
              />
            </>
          )}

          {currentOptionalPrompt && (
            <>
              <h3>{currentOptionalPrompt.question}</h3>
              <p className="prompt-description">Optional - You can skip this or come back to it</p>
              <textarea
                value={formData.optionalPrompts?.[currentOptionalPrompt.key] || ''}
                onChange={(e) => handleInputChange(`optional_${currentOptionalPrompt.key}`, e.target.value)}
                placeholder={currentOptionalPrompt.placeholder}
                rows={4}
                className="character-input"
              />
            </>
          )}

          {error && <div className="error-message">{error}</div>}
        </div>

        <div className="button-group">
          {step > 1 && (
            <button onClick={handleBack} className="btn btn-secondary">
              Back
            </button>
          )}
          {isOptionalStep && !isLastStep && (
            <button 
              onClick={handleNext} 
              className="btn btn-secondary"
            >
              Skip
            </button>
          )}
          {!isLastStep ? (
            <button 
              onClick={handleNext} 
              className="btn btn-primary"
              disabled={!isOptionalStep && currentCorePrompt ? !formData[currentCorePrompt.key as keyof CreateCharacterRequest] : false}
            >
              Next
            </button>
          ) : (
            <button 
              onClick={handleSubmit} 
              className="btn btn-primary"
              disabled={loading}
            >
              {loading ? 'Creating Character...' : 'Enter Night City'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default CharacterCreation;

