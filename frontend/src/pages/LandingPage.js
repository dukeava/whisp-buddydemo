import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTheme } from '@/contexts/ThemeContext';
import { Sun, Moon, Mic, MicOff, ArrowUp, Plus } from 'lucide-react';
import RealtimeAudioChat from '@/services/RealtimeAudioChat';
import '../styles/LandingPage.css';

const LandingPage = () => {
  const navigate = useNavigate();
  const { theme, toggleTheme } = useTheme();
  const [isListening, setIsListening] = useState(false);
  const [isWhispTalking, setIsWhispTalking] = useState(false);
  const [attachedFiles, setAttachedFiles] = useState([]);
  const [typedText, setTypedText] = useState('');
  const [phraseIndex, setPhraseIndex] = useState(0);
  const [isDeleting, setIsDeleting] = useState(false);
  const [conversationHistory, setConversationHistory] = useState([]);
  const fileInputRef = useRef(null);
  const realtimeChatRef = useRef(null);

  const phrases = [
    'Start speaking to build',
    'Start speaking to imagine',
    'Start speaking to wonder'
  ];

  // Typing effect
  useEffect(() => {
    if (isListening) return;
    
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
  }, [typedText, isDeleting, phraseIndex, isListening]);

  const startListening = async () => {
    try {
      if (!realtimeChatRef.current) {
        realtimeChatRef.current = new RealtimeAudioChat();
        
        realtimeChatRef.current.onTranscript = (text, isUser) => {
          console.log(isUser ? 'User:' : 'Whisp:', text);
          setConversationHistory(prev => [...prev, { role: isUser ? 'user' : 'assistant', content: text }]);
        };

        realtimeChatRef.current.onSpeakingStateChange = (state) => {
          console.log('Speaking state:', state);
          if (state === 'assistant_speaking') {
            setIsWhispTalking(true);
          } else if (state === 'assistant_stopped') {
            setIsWhispTalking(false);
          } else if (state === 'user_speaking') {
            setIsWhispTalking(false);
          }
        };

        await realtimeChatRef.current.init();
        
        // Send greeting after connection
        setTimeout(() => {
          if (realtimeChatRef.current) {
            realtimeChatRef.current.sendMessage("Hey! So what kind of app are you thinking of building? I'm super excited to hear your ideas!");
            setIsWhispTalking(true);
          }
        }, 1000);
      }
      
      setIsListening(true);
      setTypedText('Listening...');
    } catch (error) {
      console.error('Error starting voice chat:', error);
      alert('Could not start voice chat. Please check microphone permissions.');
    }
  };

  const stopListening = () => {
    if (realtimeChatRef.current) {
      realtimeChatRef.current.disconnect();
      realtimeChatRef.current = null;
    }
    setIsListening(false);
    setIsWhispTalking(false);
    setTypedText('');
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
      stopListening();
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
              isListening ? 'listening' : ''
            }`}
            data-testid="voice-sphere"
          >
            <div className="sphere-glow"></div>
          </div>
        </div>

        <p className="main-text" data-testid="landing-text">
          {isListening ? typedText : (
            <>{typedText}<span className="cursor">|</span></>
          )}
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
            onClick={isListening ? stopListening : startListening}
            data-testid="mic-control-btn"
            aria-label={isListening ? 'Stop listening' : 'Start listening'}
          >
            {isListening ? <MicOff size={24} /> : <Mic size={24} />}
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