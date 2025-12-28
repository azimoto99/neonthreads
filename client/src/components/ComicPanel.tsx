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
  const displayDialogue = dialogue || [];
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
                target.style.display = 'none';
                target.parentElement?.classList.add('image-error');
              }}
            />
          </div>
          <div className="comic-panel-overlay">
            {displayDialogue.length > 0 && (
              <div className="comic-panel-dialogue">
                {displayDialogue.map((line, i) => (
                  <div key={i} className="speech-bubble">
                    {line}
                  </div>
                ))}
              </div>
            )}
            {displayNarration && (
              <div className="comic-panel-narration">{displayNarration}</div>
            )}
            {displayText && (
              <div className="comic-panel-text">{displayText}</div>
            )}
          </div>
        </>
      ) : (
        <div className="comic-panel-text-only">
          {panelNumber && (
            <div className="comic-panel-number">PANEL {panelNumber}</div>
          )}
          {displayDialogue.length > 0 && (
            <div className="comic-panel-dialogue">
              {displayDialogue.map((line, i) => (
                <div key={i} className="speech-bubble">
                  {line}
                </div>
              ))}
            </div>
          )}
          {displayNarration && (
            <div className="comic-panel-narration">{displayNarration}</div>
          )}
          <div className="comic-panel-text">{displayText}</div>
        </div>
      )}
      <div className="comic-panel-border"></div>
    </div>
  );
};

export default ComicPanel;

