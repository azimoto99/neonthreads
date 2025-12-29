import React, { useState } from 'react';
import { StoryEvent } from '../types';
import ComicPanel from './ComicPanel';
import './StoryHistoryViewer.css';

interface StoryHistoryViewerProps {
  storyHistory: StoryEvent[];
  isOpen: boolean;
  onClose: () => void;
}

const StoryHistoryViewer: React.FC<StoryHistoryViewerProps> = ({ storyHistory, isOpen, onClose }) => {
  const [selectedIndex, setSelectedIndex] = useState(storyHistory.length - 1);

  if (!isOpen) return null;

  const currentEvent = storyHistory[selectedIndex];
  const canGoPrevious = selectedIndex > 0;
  const canGoNext = selectedIndex < storyHistory.length - 1;

  const handlePrevious = () => {
    if (canGoPrevious) {
      setSelectedIndex(selectedIndex - 1);
    }
  };

  const handleNext = () => {
    if (canGoNext) {
      setSelectedIndex(selectedIndex + 1);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowLeft' && canGoPrevious) {
      handlePrevious();
    } else if (e.key === 'ArrowRight' && canGoNext) {
      handleNext();
    } else if (e.key === 'Escape') {
      onClose();
    }
  };

  return (
    <div className="story-history-overlay" onClick={onClose} onKeyDown={handleKeyDown} tabIndex={0}>
      <div className="story-history-modal" onClick={(e) => e.stopPropagation()}>
        <div className="story-history-header">
          <h2>Story History</h2>
          <button className="story-history-close" onClick={onClose}>×</button>
        </div>
        
        <div className="story-history-navigation">
          <button 
            className="story-history-nav-btn" 
            onClick={handlePrevious}
            disabled={!canGoPrevious}
          >
            ← Previous
          </button>
          <span className="story-history-counter">
            {selectedIndex + 1} / {storyHistory.length}
          </span>
          <button 
            className="story-history-nav-btn" 
            onClick={handleNext}
            disabled={!canGoNext}
          >
            Next →
          </button>
        </div>

        <div className="story-history-content">
          {currentEvent && (
            <>
              <div className="story-history-event-header">
                <span className="story-history-type">{currentEvent.type.toUpperCase()}</span>
                <span className="story-history-date">
                  {new Date(currentEvent.timestamp).toLocaleString()}
                </span>
              </div>

              {currentEvent.imageUrl ? (
                <div className="story-history-image-container">
                  <ComicPanel
                    visualDescription={currentEvent.description}
                    imageUrl={currentEvent.imageUrl}
                    type={currentEvent.type === 'combat' ? 'combat' : currentEvent.type === 'decision' ? 'outcome' : 'story'}
                  />
                </div>
              ) : (
                <div className="story-history-text-only">
                  <div className="story-history-description">
                    {currentEvent.description}
                  </div>
                </div>
              )}

              {currentEvent.playerInput && (
                <div className="story-history-player-input">
                  <strong>Your Action:</strong> {currentEvent.playerInput}
                </div>
              )}

              <div className="story-history-outcome">
                <strong>Outcome:</strong> {currentEvent.outcome}
              </div>

              {currentEvent.consequences && currentEvent.consequences.length > 0 && (
                <div className="story-history-consequences">
                  <strong>Consequences:</strong>
                  <ul>
                    {currentEvent.consequences.map((consequence, i) => (
                      <li key={i}>{consequence}</li>
                    ))}
                  </ul>
                </div>
              )}
            </>
          )}
        </div>

        <div className="story-history-timeline">
          {storyHistory.map((event, index) => (
            <button
              key={event.id}
              className={`story-history-timeline-item ${index === selectedIndex ? 'active' : ''}`}
              onClick={() => setSelectedIndex(index)}
              title={`${event.type} - ${new Date(event.timestamp).toLocaleString()}`}
            >
              {index + 1}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};

export default StoryHistoryViewer;

