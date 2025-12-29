import React from 'react';
import './BodySilhouette.css';

interface BodySilhouetteProps {
  health: number;
  maxHealth: number;
  mentalState?: number; // 0-100, mental health/stress
  stressLevel?: number; // 0-100, stress level
  injuries?: string[]; // List of injury descriptions
}

const BodySilhouette: React.FC<BodySilhouetteProps> = ({
  health,
  maxHealth,
  mentalState = 100,
  stressLevel = 0,
  injuries = []
}) => {
  const healthPercent = (health / maxHealth) * 100;
  
  // Determine body part damage based on health percentage
  const getBodyPartDamage = (part: string): number => {
    if (healthPercent > 75) return 0;
    if (healthPercent > 50) return 1; // Light damage
    if (healthPercent > 25) return 2; // Moderate damage
    return 3; // Severe damage
  };

  const headDamage = getBodyPartDamage('head');
  const torsoDamage = getBodyPartDamage('torso');
  const leftArmDamage = getBodyPartDamage('leftArm');
  const rightArmDamage = getBodyPartDamage('rightArm');
  const leftLegDamage = getBodyPartDamage('leftLeg');
  const rightLegDamage = getBodyPartDamage('rightLeg');

  const getDamageColor = (damage: number): string => {
    switch (damage) {
      case 0: return 'transparent';
      case 1: return 'rgba(255, 255, 0, 0.3)'; // Yellow - light
      case 2: return 'rgba(255, 165, 0, 0.5)'; // Orange - moderate
      case 3: return 'rgba(255, 0, 0, 0.7)'; // Red - severe
      default: return 'transparent';
    }
  };

  return (
    <div className="body-silhouette-container">
      <div className="body-silhouette-header">
        <h3>Status</h3>
      </div>
      
      <div className="body-silhouette-wrapper">
        <svg
          viewBox="0 0 200 400"
          className="body-silhouette-svg"
          xmlns="http://www.w3.org/2000/svg"
        >
          {/* Head */}
          <ellipse
            cx="100"
            cy="50"
            rx="35"
            ry="40"
            className="body-part"
            fill={getDamageColor(headDamage)}
            stroke={headDamage > 0 ? '#ff4444' : 'var(--border-color)'}
            strokeWidth="2"
          />
          
          {/* Torso */}
          <rect
            x="70"
            y="90"
            width="60"
            height="120"
            rx="5"
            className="body-part"
            fill={getDamageColor(torsoDamage)}
            stroke={torsoDamage > 0 ? '#ff4444' : 'var(--border-color)'}
            strokeWidth="2"
          />
          
          {/* Left Arm */}
          <rect
            x="30"
            y="100"
            width="25"
            height="80"
            rx="5"
            className="body-part"
            fill={getDamageColor(leftArmDamage)}
            stroke={leftArmDamage > 0 ? '#ff4444' : 'var(--border-color)'}
            strokeWidth="2"
          />
          
          {/* Right Arm */}
          <rect
            x="145"
            y="100"
            width="25"
            height="80"
            rx="5"
            className="body-part"
            fill={getDamageColor(rightArmDamage)}
            stroke={rightArmDamage > 0 ? '#ff4444' : 'var(--border-color)'}
            strokeWidth="2"
          />
          
          {/* Left Leg */}
          <rect
            x="75"
            y="210"
            width="30"
            height="100"
            rx="5"
            className="body-part"
            fill={getDamageColor(leftLegDamage)}
            stroke={leftLegDamage > 0 ? '#ff4444' : 'var(--border-color)'}
            strokeWidth="2"
          />
          
          {/* Right Leg */}
          <rect
            x="95"
            y="210"
            width="30"
            height="100"
            rx="5"
            className="body-part"
            fill={getDamageColor(rightLegDamage)}
            stroke={rightLegDamage > 0 ? '#ff4444' : 'var(--border-color)'}
            strokeWidth="2"
          />
        </svg>
      </div>

      <div className="status-bars">
        <div className="status-bar-item">
          <div className="status-label">Mental</div>
          <div className="status-bar-container">
            <div 
              className="status-bar mental-bar"
              style={{ width: `${mentalState}%` }}
            />
          </div>
          <div className="status-value">{mentalState}%</div>
        </div>
        
        <div className="status-bar-item">
          <div className="status-label">Stress</div>
          <div className="status-bar-container">
            <div 
              className="status-bar stress-bar"
              style={{ width: `${stressLevel}%` }}
            />
          </div>
          <div className="status-value">{stressLevel}%</div>
        </div>
      </div>

      {injuries.length > 0 && (
        <div className="injuries-list">
          <div className="injuries-label">Injuries:</div>
          {injuries.slice(0, 3).map((injury, index) => (
            <div key={index} className="injury-item">
              {injury}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default BodySilhouette;


