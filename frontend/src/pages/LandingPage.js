import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTheme } from '@/contexts/ThemeContext';
import { Sun, Moon, Mic, MicOff, ArrowUp, Plus, Settings } from 'lucide-react';
import RealtimeAudioChat from '@/services/RealtimeAudioChat';
import '../styles/LandingPage.css';

const LandingPage = () => {
  const navigate = useNavigate();
  const { theme, toggleTheme } = useTheme();
  const [isRecording, setIsRecording] = useState(false);
  const [isWhispTalking, setIsWhispTalking] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [attachedFiles, setAttachedFiles] = useState([]);
  const [typedText, setTypedText] = useState('');
  const [phraseIndex, setPhraseIndex] = useState(0);
  const [isDeleting, setIsDeleting] = useState(false);
  const [conversationHistory, setConversationHistory] = useState([]);
  const [hasGreeted, setHasGreeted] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const fileInputRef = useRef(null);
  const realtimeChatRef = useRef(null);

  const phrases = [
    'Start speaking to build',
    'Start speaking to imagine',
    'Start speaking to wonder'
  ];

  // Typing effect  Always runs
  useEffect(() => {
    const currentPhrase = phrases[phraseIndex];
    const typingSpeed = isDeleting ? 50 : 100;
    const pauseTime = 2000;

    const timer = setTimeout(() => {
      if (!isDeleting) {
        if (typedText.length < currentPhrase.length) {
          setTypedText(currentPhrase.substring(0, typedText.length + 1));
        } else {
          setTimeout(() => setIsDeleting(true), pauseTime);
        }
      } else {
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

  const toggleMic = async () => {
    if (!isConnected) {
      // First click - initialize voice chat and greet
      try {
        realtimeChatRef.current = new RealtimeAudioChat();
        
        realtimeChatRef.current.onTranscript = (text, isUser) => {
          console.log(isUser ? 'User:' : 'Whisp:', text);
          setConversationHistory(prev => [...prev, { role: isUser ? 'user' : 'assistant', content: text }]);
        };

        realtimeChatRef.current.onSpeakingStateChange = (state) => {
          if (state === 'assistant_speaking') {
            setIsWhispTalking(true);
            setIsRecording(false);
          } else if (state === 'assistant_stopped') {
            setTimeout(() => setIsWhispTalking(false), 100);
          } else if (state === 'user_speaking') {
            setIsWhispTalking(false);
          }
        };

        await realtimeChatRef.current.init('landing');
        setIsConnected(true);
        console.log('✅ Voice chat initialized');
        
        // Trigger greeting after initialization
        if (!hasGreeted) {
          setTimeout(() => {
            if (realtimeChatRef.current) {
              realtimeChatRef.current.triggerResponse();
              setHasGreeted(true);
            }
          }, 500);
        }
      } catch (error) {
        console.error('Error starting voice chat:', error);
        alert('Could not start voice chat. Please check microphone permissions.');
      }
    } else {
      // Toggle recording
      if (isRecording) {
        setIsRecording(false);
      } else {
        setIsRecording(true);
        setIsWhispTalking(false);
      }
    }
  };

  const handleFileUpload = (event) => {
    const files = Array.from(event.target.files);
    setAttachedFiles(prev => [...prev, ...files]);
  };

  const handleTransitionToEditor = () => {
    navigate('/editor', { 
      state: { 
        attachedFiles,
        conversationHistory
      } 
    });
  };

  const handleDictational = () => {
    setIsSettingsOpen(false);
    navigate('/dictational');
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

  useEffect(() => {
    return () => {
      if (realtimeChatRef.current) {
        realtimeChatRef.current.disconnect();
      }
    };
  }, []);

  return (
    <div className={`landing-page ${theme}`}>
      <button 
        className="theme-toggle"
        onClick={toggleTheme}
        data-testid="theme-toggle-btn"
        aria-label="Toggle theme"
      >
        {theme === 'dark' ? <Sun size={20} /> : <Moon size={20} />}
      </button>

      <div className="logo" onClick={() => navigate('/')} style={{ cursor: 'pointer' }}>
        <span>Whisp</span>
        <span className="beta-tag">BETA</span>
      </div>

      <div className="main-content">
        <div className="sphere-container">
          <div 
            className={`sphere ${
              isWhispTalking ? 'talking' : 
              isRecording ? 'listening' : ''
            }`}
            data-testid="voice-sphere"
          >
            <div className="sphere-glow"></div>
          </div>
        </div>

        <div className="pill-bar">
          <input
            ref={fileInputRef}
            type="file"
            multiple
            className="file-input"
            onChange={handleFileUpload}
            accept="image/*,.pdf,.doc,.docx,.txt"
          />
          
          <button 
            className="pill-button"
            onClick={() => fileInputRef.current?.click()}
            data-testid="attach-file-btn"
            aria-label="Attach files"
          >
            <Plus size={20} />
          </button>

          <div className="pill-input-area">
            <span className="pill-placeholder">
              {typedText}<span className="cursor">|</span>
            </span>
          </div>

          <button 
            className="pill-button mic-button"
            onClick={toggleMic}
            data-testid="mic-control-btn"
            aria-label={isRecording ? 'Stop recording' : 'Start recording'}
          >
            {isRecording ? <MicOff size={20} /> : <Mic size={20} />}
          </button>

          <button 
            className="pill-button"
            onClick={handleTransitionToEditor}
            data-testid="transition-to-editor-btn"
            aria-label="Go to editor"
            disabled={conversationHistory.length === 0}
          >
            <ArrowUp size={20} />
          </button>
        </div>

        {attachedFiles.length > 0 && (
          <p style={{ fontSize: '14px', color: 'var(--text-secondary)', marginTop: '16px' }}>
            {attachedFiles.length} file{attachedFiles.length > 1 ? 's' : ''} attached
          </p>
        )}
      </div>

      <div className="bg-grid"></div>
    </div>
  );
};

export default LandingPage;