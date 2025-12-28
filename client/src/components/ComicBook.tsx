import React from 'react';
import './ComicBook.css';
import ComicPanel from './ComicPanel';
import { ComicPanel as ComicPanelType } from '../types';

interface ComicBookProps {
  panels: ComicPanelType[];
  loading?: boolean;
}

const ComicBook: React.FC<ComicBookProps> = ({ panels, loading = false }) => {
  if (loading) {
    return (
      <div className="comic-book">
        <div className="comic-book-loading">
          <div className="loading-spinner"></div>
          <p>Generating comic book...</p>
        </div>
      </div>
    );
  }

  if (!panels || panels.length === 0) {
    return (
      <div className="comic-book">
        <div className="comic-book-empty">No panels available</div>
      </div>
    );
  }

  // Only show the first panel (which should have the image)
  // If no image yet, still show the first panel with its text
  const panelsToShow = panels.slice(0, 1);

  return (
    <div className="comic-book">
      <div className="comic-book-grid">
        {panelsToShow.map((panel, index) => (
          <div key={panel.panelNumber || index} className="comic-book-panel-wrapper">
            <ComicPanel
              panelNumber={panel.panelNumber || index + 1}
              visualDescription={panel.visualDescription}
              dialogue={panel.dialogue || []}
              narration={panel.narration}
              imageUrl={panel.imageUrl}
            />
          </div>
        ))}
      </div>
    </div>
  );
};

export default ComicBook;

