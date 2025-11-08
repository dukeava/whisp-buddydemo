import React from 'react';
import '../styles/ModeSelectionModal.css';

const ModeSelectionModal = ({ isOpen, onClose, onSelectMode }) => {
  if (!isOpen) return null;

  const handleModeSelect = (mode) => {
    onSelectMode(mode);
  };

  return (
    <div className="mode-modal-overlay" onClick={onClose}>
      <div className="mode-modal-container" onClick={(e) => e.stopPropagation()}>
        <h2 className="mode-modal-title">Choose your mode</h2>
        
        <div className="mode-cards-container">
          {/* Dictational Mode */}
          <div className="mode-card" onClick={() => handleModeSelect('dictational')}>
            <div className="mode-card-image">
              <img 
                src="https://customer-assets.emergentagent.com/job_whisp-buddy/artifacts/0my0aekf_u3752894846_two_people_sitting_in_a_mountain_top_greenery_flo_2f2a3a76-b0a7-4c80-8dcc-91a824f03991_0.png" 
                alt="Dictational mode"
              />
            </div>
            <div className="mode-card-content">
              <h3 className="mode-card-title">Dictational</h3>
              <p className="mode-card-description">
                Speak your idea to existence
              </p>
            </div>
          </div>

          {/* Conversational Mode */}
          <div className="mode-card" onClick={() => handleModeSelect('conversational')}>
            <span className="mode-recommended-badge">Recommended</span>
            <div className="mode-card-image">
              <img 
                src="https://customer-assets.emergentagent.com/job_whisp-buddy/artifacts/w2kthpkg_u3752894846_a_man_seen_walking_into_the_unknown_in_a_greenery_f743c564-10fe-4a15-8fa2-5453dee881f2_0.png" 
                alt="Conversational mode"
              />
            </div>
            <div className="mode-card-content">
              <h3 className="mode-card-title">Conversational</h3>
              <p className="mode-card-description">
                The future of ideation to creation
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ModeSelectionModal;
