import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTheme } from '@/contexts/ThemeContext';
import { Sun, Moon, Mic, MicOff, ArrowUp } from 'lucide-react';
import '../styles/LandingPage.css';

const LandingPage = () => {
  const navigate = useNavigate();
  const { theme, toggleTheme } = useTheme();
  const [isListening, setIsListening] = useState(false);
  const [isTalking, setIsTalking] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const audioContextRef = useRef(null);
  const analyserRef = useRef(null);
  const animationFrameRef = useRef(null);

  const animateSphere = () => {
    if (!analyserRef.current) return;

    const dataArray = new Uint8Array(analyserRef.current.frequencyBinCount);
    analyserRef.current.getByteFrequencyData(dataArray);
    
    const average = dataArray.reduce((a, b) => a + b) / dataArray.length;
    
    if (average > 30) {
      setIsTalking(true);
    } else {
      setIsTalking(false);
    }

    animationFrameRef.current = requestAnimationFrame(animateSphere);
  };

  const startListening = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      audioContextRef.current = new (window.AudioContext || window.webkitAudioContext)();
      const source = audioContextRef.current.createMediaStreamSource(stream);
      analyserRef.current = audioContextRef.current.createAnalyser();
      analyserRef.current.fftSize = 256;
      source.connect(analyserRef.current);
      
      setIsListening(true);
      animateSphere();
    } catch (error) {
      console.error('Error accessing microphone:', error);
    }
  };

  const stopListening = () => {
    if (audioContextRef.current) {
      audioContextRef.current.close();
    }
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
    }
    setIsListening(false);
    setIsTalking(false);
  };

  const handleTransitionToEditor = () => {
    stopListening();
    navigate('/editor');
  };

  useEffect(() => {
    return () => {
      stopListening();
    };
  }, []);

  return (
    <div className={`landing-page ${theme}`}>
      {/* Theme Toggle */}
      <button 
        className="theme-toggle"
        onClick={toggleTheme}
        data-testid="theme-toggle-btn"
        aria-label="Toggle theme"
      >
        {theme === 'dark' ? <Sun size={20} /> : <Moon size={20} />}
      </button>

      {/* Logo */}
      <div className="logo">
        <svg width="32" height="32" viewBox="0 0 32 32" fill="none">
          <path d="M16 4L20 12L28 16L20 20L16 28L12 20L4 16L12 12L16 4Z" fill="currentColor"/>
        </svg>
        <span>Whisp</span>
        <span className="beta-tag">BETA</span>
      </div>

      {/* Main Content */}
      <div className="main-content">
        {/* Glowing Sphere */}
        <div className="sphere-container">
          <div 
            className={`sphere ${
              isTalking ? 'talking' : 
              isListening ? 'listening' : ''
            }`}
            data-testid="voice-sphere"
          >
            <div className="sphere-glow"></div>
          </div>
        </div>

        {/* Text */}
        <p className="main-text" data-testid="landing-text">
          {isTalking ? 'I\'m listening...' : 
           isListening ? 'Go ahead, I\'m all ears!' : 
           'Start speaking to build'}
        </p>

        {/* Controls */}
        <div className="controls">
          <button 
            className="control-btn"
            onClick={() => setIsMuted(!isMuted)}
            data-testid="mute-toggle-btn"
            aria-label="Toggle mute"
          >
            {isMuted ? <MicOff size={20} /> : <Mic size={20} />}
          </button>

          <button 
            className="control-btn primary"
            onClick={isListening ? stopListening : startListening}
            data-testid="mic-control-btn"
            aria-label={isListening ? 'Stop listening' : 'Start listening'}
          >
            {isListening ? <MicOff size={20} /> : <Mic size={20} />}
          </button>

          <button 
            className="control-btn"
            onClick={handleTransitionToEditor}
            data-testid="transition-to-editor-btn"
            aria-label="Go to editor"
          >
            <ArrowUp size={20} />
          </button>
        </div>
      </div>

      {/* Background effects */}
      <div className="bg-grid"></div>
    </div>
  );
};

export default LandingPage;