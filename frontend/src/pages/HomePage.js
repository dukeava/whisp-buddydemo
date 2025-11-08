import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useTheme } from '@/contexts/ThemeContext';
import { Sun, Moon, Plus, Mic, ArrowUp } from 'lucide-react';
import '../styles/HomePage.css';

const HomePage = () => {
  const navigate = useNavigate();
  const { theme, toggleTheme } = useTheme();

  const handleGetStarted = () => {
    navigate('/workspace');
  };

  return (
    <div className="homepage">
      {/* Video Background */}
      <video
        className="hero-video"
        autoPlay
        loop
        muted
        playsInline
      >
        <source src="https://customer-assets.emergentagent.com/job_code-whisperer-12/artifacts/08owjfff_1104.mp4" type="video/mp4" />
      </video>

      {/* Overlay */}
      <div className="hero-overlay" />

      {/* Header */}
      <header className="homepage-header">
        <div className="logo">
          <span className="logo-icon">✦</span>
          <span>Whisp</span>
          <span className="beta-badge">BETA</span>
        </div>
        
        <nav className="nav-links">
          <a href="#features">Features</a>
          <a href="#pricing">Pricing</a>
          <a href="#about">About</a>
        </nav>

        <div className="header-actions">
          <button onClick={toggleTheme} className="theme-toggle" aria-label="Toggle theme">
            {theme === 'dark' ? <Sun size={20} /> : <Moon size={20} />}
          </button>
          <button onClick={handleGetStarted} className="get-started-btn">
            Get Started
          </button>
        </div>
      </header>

      {/* Hero Content */}
      <div className="hero-content">
        <h1 className="hero-title">
          Say it. See it. Ship it.
        </h1>
        <p className="hero-subtitle">
          Build apps by talking, not typing.
        </p>

        <button onClick={handleGetStarted} className="cta-button">
          Start speaking to build
        </button>

        {/* Pill Bar */}
        <div className="pill-bar">
          <button className="pill-button" title="Attach file">
            <Plus size={20} />
          </button>
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

export default HomePage;
