import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTheme } from '@/contexts/ThemeContext';
import { Sun, Moon, Mic, MicOff, ArrowUp, Plus } from 'lucide-react';
import '../styles/LandingPage.css';

const LandingPage = () => {
  const navigate = useNavigate();
  const { theme, toggleTheme } = useTheme();
  const [isListening, setIsListening] = useState(false);
  const [isTalking, setIsTalking] = useState(false);
  const [attachedFiles, setAttachedFiles] = useState([]);
  const [typedText, setTypedText] = useState('');
  const [phraseIndex, setPhraseIndex] = useState(0);
  const [isDeleting, setIsDeleting] = useState(false);
  const audioContextRef = useRef(null);
  const analyserRef = useRef(null);
  const animationFrameRef = useRef(null);
  const fileInputRef = useRef(null);

  const phrases = [
    'Start speaking to build',
    'Start speaking to imagine',
    'Start speaking to wonder'
  ];

  // Typing effect
  useEffect(() => {
    const currentPhrase = phrases[phraseIndex];
    const typingSpeed = isDeleting ? 50 : 100;
    const pauseTime = 2000;

    const timer = setTimeout(() => {
      if (!isDeleting) {
        // Typing
        if (typedText.length < currentPhrase.length) {
          setTypedText(currentPhrase.substring(0, typedText.length + 1));
        } else {
          // Pause before deleting
          setTimeout(() => setIsDeleting(true), pauseTime);
        }
      } else {
        // Deleting
        if (typedText.length > 0) {
          setTypedText(typedText.substring(0, typedText.length - 1));
        } else {
          setIsDeleting(false);
          setPhraseIndex((prev) => (prev + 1) % phrases.length);
        }
      }
    }, typingSpeed);

    return () => clearTimeout(timer);
  }, [typedText, isDeleting, phraseIndex]);

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

  const handleFileUpload = (event) => {
    const files = Array.from(event.target.files);
    setAttachedFiles(prev => [...prev, ...files]);
    console.log('Files attached:', files);
  };

  const handleTransitionToEditor = () => {
    stopListening();
    navigate('/editor', { state: { attachedFiles } });
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

        {/* Typing Text */}
        <p className="main-text" data-testid="landing-text">
          {typedText}<span className="cursor">|</span>
        </p>

        {/* Controls */}
        <div className="controls">
          <input
            ref={fileInputRef}
            type="file"
            multiple
            className="file-input"
            onChange={handleFileUpload}
            accept="image/*,.pdf,.doc,.docx,.txt"
          />
          
          <button 
            className="control-btn"
            onClick={() => fileInputRef.current?.click()}
            data-testid="attach-file-btn"
            aria-label="Attach files"
          >
            <Plus size={20} />
          </button>

          <button 
            className="control-btn"
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

        {/* File count indicator */}
        {attachedFiles.length > 0 && (
          <p style={{ fontSize: '14px', color: 'var(--text-secondary)' }}>
            {attachedFiles.length} file{attachedFiles.length > 1 ? 's' : ''} attached
          </p>
        )}
      </div>

      {/* Background effects */}
      <div className="bg-grid"></div>
    </div>
  );
};

export default LandingPage;