import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTheme } from '@/contexts/ThemeContext';
import { Sun, Moon, Mic, MicOff, ArrowUp, Plus } from 'lucide-react';
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
  const fileInputRef = useRef(null);
  const realtimeChatRef = useRef(null);

  const phrases = [
    'Start speaking to build',
    'Start speaking to imagine',
    'Start speaking to wonder'
  ];

  // Typing effect - Always runs
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
      // First click - connect and greet
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
        
        // Trigger Whisp to speak based on its instructions
        if (!hasGreeted) {
          setTimeout(() => {
            if (realtimeChatRef.current) {
              realtimeChatRef.current.triggerResponse();
              setHasGreeted(true);
            }
          }, 1000);
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

      <div className="logo">
        <svg width="32" height="32" viewBox="0 0 32 32" fill="none">
          <path d="M16 4L20 12L28 16L20 20L16 28L12 20L4 16L12 12L16 4Z" fill="currentColor"/>
        </svg>
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

        <p className="main-text" data-testid="landing-text">
          {typedText}<span className="cursor">|</span>
        </p>

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
            <Plus size={24} />
          </button>

          <button 
            className="control-btn"
            onClick={toggleMic}
            data-testid="mic-control-btn"
            aria-label={isRecording ? 'Stop recording' : 'Start recording'}
          >
            {isRecording ? <MicOff size={24} /> : <Mic size={24} />}
          </button>

          <button 
            className="control-btn"
            onClick={handleTransitionToEditor}
            data-testid="transition-to-editor-btn"
            aria-label="Go to editor"
            disabled={conversationHistory.length === 0}
          >
            <ArrowUp size={24} />
          </button>
        </div>

        {attachedFiles.length > 0 && (
          <p style={{ fontSize: '14px', color: 'var(--text-secondary)' }}>
            {attachedFiles.length} file{attachedFiles.length > 1 ? 's' : ''} attached
          </p>
        )}
      </div>

      <div className="bg-grid"></div>
    </div>
  );
};

export default LandingPage;