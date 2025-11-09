import React from 'react';
import '../styles/AudioVisualizer.css';

const AudioVisualizer = ({ isActive, isDark = true }) => {
  // Generate 40 bars for the visualizer
  const bars = Array.from({ length: 40 }, (_, i) => i);

  return (
    <div className="audio-visualizer">
      {bars.map((bar) => (
        <div
          key={bar}
          className={`visualizer-bar ${isDark ? '' : 'grey'} ${isActive ? 'active' : ''}`}
          style={{
            animationDelay: `${bar * 0.05}s`,
            animationDuration: `${0.4 + Math.random() * 0.4}s`
          }}
        />
      ))}
    </div>
  );
};

export default AudioVisualizer;
