import React from 'react';
import './LocationIndicator.css';

interface LocationIndicatorProps {
  location: string;
  scene: string;
}

const LocationIndicator: React.FC<LocationIndicatorProps> = ({
  location,
  scene
}) => {
  const formattedLocation = location.replace(/_/g, ' ').toUpperCase();
  const formattedScene = scene.replace(/_/g, ' ');

  return (
    <div className="location-indicator">
      <div className="location-header">
        <h3>Location</h3>
      </div>
      <div className="location-content">
        <div className="location-name">{formattedLocation}</div>
        <div className="scene-name">{formattedScene}</div>
      </div>
    </div>
  );
};

export default LocationIndicator;


