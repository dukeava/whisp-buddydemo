import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTheme } from '@/contexts/ThemeContext';
import { Sun, Moon, Mic, MicOff, ArrowUp, Plus, Settings, X } from 'lucide-react';
import AudioVisualizer from '../components/AudioVisualizer';
import axios from 'axios';
import '../styles/LandingPage.css';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

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
  const [isProcessing, setIsProcessing] = useState(false);
  const [sessionId] = useState(() => `session-${Date.now()}`);
  const [conversationStep, setConversationStep] = useState(0);
  const fileInputRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);

  const phrases = ['build', 'imagine', 'create', 'design'];

  // Typing effect - matches homepage
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

  const toggleMic = async () => {
    if (!isConnected) {
      // Start "conversation" (fake it with pre-scripted responses)
      setIsRecording(true);
      setIsConnected(true);
      
      // Greet
      setTimeout(async () => {
        setIsWhispTalking(true);
        await speakWithElevenLabs("Hey I'm Dan, um what will you like to build or imagine today");
        setIsWhispTalking(false);
        setHasGreeted(true);
        
        // Start recording (will be used as prompt later)
        await startSimpleRecording();
        
        // Fake conversation flow with pre-scripted responses
        startFakeConversation();
      }, 300);
    } else {
      // Stop everything
      stopSimpleRecording();
      stopFakeConversation();
      setIsRecording(false);
      setIsWhispTalking(false);
      setIsConnected(false);
    }
  };
  
  const startSimpleRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      
      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };
      
      window.landingRecorder = mediaRecorder;
      window.landingStream = stream;
      
      // Just record continuously, no processing
      mediaRecorder.start();
      console.log('🎤 Recording (will use as prompt when Go clicked)');
      
    } catch (error) {
      console.error('❌ Recording error:', error);
      alert('Microphone access required');
    }
  };
  
  const stopSimpleRecording = () => {
    if (window.landingRecorder && window.landingRecorder.state === 'recording') {
      window.landingRecorder.stop();
    }
    if (window.landingStream) {
      window.landingStream.getTracks().forEach(track => track.stop());
    }
  };
  
  const fakeConversationLines = [
    "Oh nice! Umm, what kind of vibe are you going for?",
    "Cool! So who's this for? Like for yourself or?",
    "Hmm that's actually not bad! What features are you thinking?",
    "Wait that's sick! Uhh, how should it look?",
    "Okay okay, I'm seeing the vision! Any specific colors or style?",
    "Alright hit go AND lets GET this rolling"
  ];
  
  const startFakeConversation = () => {
    let step = 0;
    
    const conversationInterval = setInterval(async () => {
      console.log('💬 Fake conversation check - step:', step, 'connected:', isConnected);
      
      if (step >= fakeConversationLines.length) {
        console.log('✅ Fake conversation complete');
        clearInterval(conversationInterval);
        return;
      }
      
      // Speak next line
      console.log('🗣️ Speaking:', fakeConversationLines[step]);
      setIsWhispTalking(true);
      await speakWithElevenLabs(fakeConversationLines[step]);
      setIsWhispTalking(false);
      
      step++;
      setConversationStep(step);
    }, 12000); // Every 12 seconds
    
    window.landingConversationInterval = conversationInterval;
    console.log('✅ Fake conversation started');
  };
  
  const stopFakeConversation = () => {
    if (window.landingConversationInterval) {
      clearInterval(window.landingConversationInterval);
    }
  };
  
  const speakWithElevenLabs = async (text) => {
    try {
      const response = await axios.post(`${API}/elevenlabs/tts`, { text });
      
      if (response.data.success && response.data.audio) {
        const binaryString = atob(response.data.audio);
        const bytes = new Uint8Array(binaryString.length);
        for (let i = 0; i < binaryString.length; i++) {
          bytes[i] = binaryString.charCodeAt(i);
        }
        
        const blob = new Blob([bytes], { type: 'audio/mpeg' });
        const audioUrl = URL.createObjectURL(blob);
        const audio = new Audio(audioUrl);
        
        await new Promise((resolve) => {
          audio.onended = resolve;
          audio.play();
        });
        
        URL.revokeObjectURL(audioUrl);
      }
    } catch (error) {
      console.error('❌ ElevenLabs error:', error);
    }
  };

  const handleFileUpload = (event) => {
    const files = Array.from(event.target.files);
    setAttachedFiles(prev => [...prev, ...files]);
  };

  const handleTransitionToEditor = () => {
    // Stop recording and get all audio
    stopFakeConversation();
    
    if (window.landingRecorder && window.landingRecorder.state === 'recording') {
      window.landingRecorder.stop();
      
      // Wait for final chunks then navigate
      setTimeout(() => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        
        if (window.landingStream) {
          window.landingStream.getTracks().forEach(track => track.stop());
        }
        
        navigate('/conversational-editor', { 
          state: { 
            audioBlob, // Full recording as prompt
            attachedFiles,
            conversationHistory
          } 
        });
      }, 200);
    } else {
      // No recording, just navigate
      navigate('/conversational-editor', { 
        state: { 
          attachedFiles,
          conversationHistory
        } 
      });
    }
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
      // Cleanup recording on unmount
      stopSimpleRecording();
      stopFakeConversation();
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

      {/* Settings Icon */}
      <div className="settings-container-voice">
        <button 
          className="settings-toggle-voice"
          onClick={() => setIsSettingsOpen(!isSettingsOpen)}
          aria-label="Settings"
        >
          <Settings size={20} />
        </button>

        {isSettingsOpen && (
          <div className="settings-dropdown-voice">
            <button className="settings-item-voice" onClick={handleDictational}>
              Dictational
            </button>
            <button className="settings-item-voice" onClick={handleHome}>
              Home
            </button>
            <button className="settings-item-voice" onClick={handleLogout}>
              Logout
            </button>
          </div>
        )}
      </div>

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
          
          {/* Tiny attached images inside pill bar */}
          {attachedFiles.length > 0 && (
            <div className="tiny-images-inline">
              {attachedFiles.slice(0, 5).map((file, index) => {
                // Only show images
                if (!file.type?.startsWith('image/')) return null;
                
                // Create preview URL
                const previewUrl = file.preview || URL.createObjectURL(file);
                
                return (
                  <div key={index} className="tiny-image">
                    <img src={previewUrl} alt={file.name} />
                    <button 
                      className="tiny-remove-btn" 
                      onClick={(e) => {
                        e.stopPropagation();
                        setAttachedFiles(prev => prev.filter((_, i) => i !== index));
                      }}
                    >
                      <X size={10} />
                    </button>
                  </div>
                );
              })}
            </div>
          )}

          {isConnected ? (
            <div className="pill-input-area">
              <AudioVisualizer isActive={isRecording || isWhispTalking} />
            </div>
          ) : (
            <div className="pill-input-area">
              <span className="pill-placeholder">
                Start speaking to {typedText}<span className="cursor">|</span>
              </span>
            </div>
          )}

          <button 
            className="pill-button mic-button"
            onClick={toggleMic}
            data-testid="mic-control-btn"
            aria-label={isConnected ? 'Stop conversation' : 'Start conversation'}
          >
            {isConnected ? <X size={20} /> : <Mic size={20} />}
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
      </div>

      <div className="bg-grid"></div>
    </div>
  );
};

export default LandingPage;