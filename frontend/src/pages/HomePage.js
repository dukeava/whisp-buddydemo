import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Mic, ArrowUp } from 'lucide-react';
import AuthModal from '../components/AuthModal';
import ModeSelectionModal from '../components/ModeSelectionModal';
import '../styles/HomePage.css';

const HomePage = () => {
  const navigate = useNavigate();
  const [typedText, setTypedText] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);
  const [phraseIndex, setPhraseIndex] = useState(0);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [isModeModalOpen, setIsModeModalOpen] = useState(false);
  
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
    setIsAuthModalOpen(true);
  };

  return (
    <div className="homepage">
      {/* Video Background */}
      <div className="w-full h-screen relative overflow-hidden">
        <video
          autoPlay
          loop
          muted
          playsInline
          className="absolute inset-0 w-full h-full object-cover"
          style={{ objectFit: 'cover' }}
        >
          <source src="https://customer-assets.emergentagent.com/job_whisp-buddy/artifacts/n7mh31n0_1105.mp4" type="video/mp4" />
          Your browser does not support the video tag.
        </video>
      </div>

      {/* Overlay */}
      <div className="hero-overlay" />

      {/* Header */}
      <header className="homepage-header">
        {/* Logo - Far Left */}
        <div className="logo">
          <span>Whisp</span>
          <span className="beta-badge">BETA</span>
        </div>
        
        {/* Nav - Centered */}
        <nav className="nav-links">
          <a href="#features">Features</a>
          <a href="#pricing">Pricing</a>
          <a href="#about">About</a>
        </nav>

        {/* Get Started - Far Right */}
        <button onClick={handleGetStarted} className="get-started-btn">
          Get Started
        </button>
      </header>

      {/* Hero Content */}
      <div className="hero-content">
        <h1 className="hero-title">
          <span className="title-regular">Say it. See it. </span>
          <span className="title-italic">Ship it.</span>
        </h1>
        <p className="hero-subtitle">
          Build apps by talking, not typing.
        </p>

        {/* Pill Bar - Wide with typing effect */}
        <div className="pill-bar">
          <button className="pill-button" title="Attach file" onClick={handleGetStarted}>
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
          <button className="pill-button" title="Submit" onClick={handleGetStarted}>
            <ArrowUp size={20} />
          </button>
        </div>
      </div>

      {/* Auth Modal */}
      <AuthModal isOpen={isAuthModalOpen} onClose={() => setIsAuthModalOpen(false)} />
    </div>
  );
};

export default HomePage;
