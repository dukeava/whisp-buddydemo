import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Mic, MicOff, ArrowUp, Settings } from 'lucide-react';
import AudioVisualizer from '../components/AudioVisualizer';
import '../styles/DictationalPage.css';

const DictationalPage = () => {
  const navigate = useNavigate();
  const [typedText, setTypedText] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);
  const [phraseIndex, setPhraseIndex] = useState(0);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  
  const phrases = ['build', 'imagine', 'create', 'design'];

  useEffect(() => {
    const currentPhrase = phrases[phraseIndex];
    const timeout = setTimeout(() => {
      if (!isDeleting) {
        if (typedText.length < currentPhrase.length) {
          setTypedText(currentPhrase.slice(0, typedText.length + 1));
        } else {
          setTimeout(() => setIsDeleting(true), 2000);
        }
      } else {
        if (typedText.length > 0) {
          setTypedText(currentPhrase.slice(0, typedText.length - 1));
        } else {
          setIsDeleting(false);
          setPhraseIndex((phraseIndex + 1) % phrases.length);
        }
      }
    }, isDeleting ? 50 : 150);

    return () => clearTimeout(timeout);
  }, [typedText, isDeleting, phraseIndex]);

  const handleGetStarted = () => {
    // Toggle recording and show visualizer
    setIsRecording(!isRecording);
  };

  const handleConversational = () => {
    setIsSettingsOpen(false);
    navigate('/workspace');
  };

  const handleHome = () => {
    setIsSettingsOpen(false);
    navigate('/');
  };

  const handleLogout = () => {
    localStorage.removeItem('whispUser');
    setIsSettingsOpen(false);
    navigate('/');
  };

  return (
    <div className="dictational-page">
      {/* Background Image */}
      <div className="w-full h-screen relative overflow-hidden">
        <img
          src="https://customer-assets.emergentagent.com/job_whisp-buddy/artifacts/mg36eqvy_u3752894846_an_astronaut_walking_towards_a_doorway_in_a_empty_352c8521-4c4d-44bb-81ff-5b674cfcee58_3.png"
          alt="Astronaut background"
          className="absolute inset-0 w-full h-full object-cover"
          style={{ objectFit: 'cover' }}
        />
      </div>

      {/* Overlay */}
      <div className="hero-overlay" />

      {/* Logo - Top Left */}
      <div className="logo" onClick={() => navigate('/')} style={{ cursor: 'pointer' }}>
        <span>Whisp</span>
        <span className="beta-badge">BETA</span>
      </div>

      {/* Settings Icon - Top Right */}
      <div className="settings-container">
        <button 
          className="settings-toggle"
          onClick={() => setIsSettingsOpen(!isSettingsOpen)}
          aria-label="Settings"
        >
          <Settings size={20} />
        </button>

        {isSettingsOpen && (
          <div className="settings-dropdown">
            <button className="settings-item" onClick={handleConversational}>
              Conversational
            </button>
            <button className="settings-item" onClick={handleHome}>
              Home
            </button>
            <button className="settings-item" onClick={handleLogout}>
              Logout
            </button>
          </div>
        )}
      </div>

      {/* Hero Content */}
      <div className="hero-content">
        <h1 className="hero-title">
          <span className="title-regular">What will you build </span>
          <span className="title-italic">today</span>
        </h1>
        <p className="hero-subtitle">
          Voice to app in seconds
        </p>

        {/* Pill Bar - Wide with typing effect */}
        <div className="pill-bar">
          <button className="pill-button" title="Attach file">
            <Plus size={20} />
          </button>
          <div className="pill-input-area" onClick={handleGetStarted}>
            <span className="pill-placeholder">
              Start speaking to {typedText}<span className="cursor">|</span>
            </span>
          </div>
          <button className="pill-button mic-button" onClick={handleGetStarted} title="Start voice">
            <Mic size={20} />
          </button>
          <button className="pill-button" title="Submit">
            <ArrowUp size={20} />
          </button>
        </div>
      </div>
    </div>
  );
};

export default DictationalPage;
