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

  return (
    <div className="comic-book">
      <div className="comic-book-grid">
        {panels.map((panel, index) => (
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

