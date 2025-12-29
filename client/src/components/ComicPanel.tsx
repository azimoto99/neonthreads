import React from 'react';
import './ComicPanel.css';

interface ComicPanelProps {
  panelNumber?: number;
  visualDescription?: string; // Optional - can use text for legacy
  dialogue?: string[];
  narration?: string;
  imageUrl?: string;
  type?: 'story' | 'combat' | 'outcome';
  loading?: boolean;
  // Legacy support
  text?: string;
}

const ComicPanel: React.FC<ComicPanelProps> = ({ 
  panelNumber,
  visualDescription, 
  dialogue = [],
  narration,
  imageUrl,
  type = 'story', 
  loading = false,
  text // Legacy support
}) => {
  // Use legacy text if provided (for backward compatibility)
  const displayText = text || visualDescription || '';
  const displayNarration = narration;

  return (
    <div className={`comic-panel comic-panel-${type}`}>
      {loading && !imageUrl ? (
        <div className="comic-panel-loading">
          <div className="loading-spinner"></div>
          <p>Generating comic panel...</p>
        </div>
      ) : imageUrl ? (
        <>
          <div className="comic-panel-image-container">
            <img 
              src={imageUrl} 
              alt="Comic panel" 
              className="comic-panel-image"
              onError={(e) => {
                const target = e.target as HTMLImageElement;
                console.error('Image failed to load:', imageUrl?.substring(0, 100));
                target.style.display = 'none';
                target.parentElement?.classList.add('image-error');
              }}
              onLoad={() => {
                console.log('Image loaded successfully');
              }}
            />
          </div>
          <div className="comic-panel-overlay">
            {/* Only show story text/narration, no dialogue bubbles */}
            {displayNarration && (
              <div className="comic-panel-narration">{displayNarration}</div>
            )}
            {displayText && !displayNarration && (
              <div className="comic-panel-text">{displayText}</div>
            )}
          </div>
        </>
      ) : (
        <div className="comic-panel-text-only">
          {panelNumber && (
            <div className="comic-panel-number">PANEL {panelNumber}</div>
          )}
          {/* Only show story text/narration, no dialogue bubbles */}
          {displayNarration && (
            <div className="comic-panel-narration">{displayNarration}</div>
          )}
          {displayText && !displayNarration && (
            <div className="comic-panel-text">{displayText}</div>
          )}
        </div>
      )}
      <div className="comic-panel-border"></div>
    </div>
  );
};

export default ComicPanel;

