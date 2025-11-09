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
  const [sessionId] = useState(() => `session-${Date.now()}`);
  const fileInputRef = useRef(null);

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
      // First click - greet and start recording
      setIsRecording(true);
      setIsConnected(true);
      
      // Greet with ElevenLabs
      setTimeout(async () => {
        setIsWhispTalking(true);
        await speakWithElevenLabs("Hey I'm Dan, um what will you like to build or imagine today");
        setIsWhispTalking(false);
        setHasGreeted(true);
        
        // Start recording after greeting
        startRecording();
      }, 300);
    } else {
      // X button - Stop everything
      stopRecording();
      setIsRecording(false);
      setIsWhispTalking(false);
      setIsConnected(false);
    }
  };
  
  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      
      mediaRecorder.ondataavailable = async (event) => {
        if (event.data.size > 1000) {
          // Process this chunk immediately without stopping recording
          const audioBlob = new Blob([event.data], { type: 'audio/webm' });
          await handleConversation(audioBlob);
        }
      };
      
      window.landingRecorder = mediaRecorder;
      window.landingStream = stream;
      
      // Start continuous recording with 5-second chunks
      mediaRecorder.start(5000);
      
      console.log('🎤 Continuous recording started');
      
    } catch (error) {
      console.error('❌ Recording error:', error);
      alert('Microphone access required');
    }
  };
  
  const stopRecording = () => {
    if (window.landingRecorder && window.landingRecorder.state === 'recording') {
      window.landingRecorder.stop();
    }
    if (window.landingStream) {
      window.landingStream.getTracks().forEach(track => track.stop());
    }
  };
  
  const handleConversation = async (audioBlob) => {
    try {
      // Only process if blob has meaningful audio (> 1KB)
      if (audioBlob.size < 1000) {
        console.log('⏭️ Skipping empty audio chunk');
        return;
      }
      
      console.log('🎧 Processing audio chunk:', audioBlob.size, 'bytes');
      
      // 1. Transcribe with Whisper
      const formData = new FormData();
      formData.append('file', audioBlob, 'audio.webm');
      
      const transcribeResponse = await axios.post(`${API}/dictational/transcribe`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      
      if (!transcribeResponse.data.success || !transcribeResponse.data.text.trim()) {
        console.log('⏭️ No speech detected in chunk');
        return;
      }
      
      const userText = transcribeResponse.data.text.trim();
      console.log('📝 User:', userText);
      
      // Add to conversation
      setConversationHistory(prev => [...prev, { role: 'user', content: userText }]);
      
      // 2. Get GPT-4o response with YOUR prompt
      const chatResponse = await axios.post(`${API}/conversational/chat`, {
        message: userText,
        session_id: sessionId,
        conversation_history: conversationHistory
      });
      
      if (!chatResponse.data.success) return;
      
      const aiResponse = chatResponse.data.response;
      console.log('🤖 Whisp:', aiResponse);
      
      // Add to conversation
      setConversationHistory(prev => [...prev, { role: 'assistant', content: aiResponse }]);
      
      // 3. Speak with ElevenLabs
      setIsWhispTalking(true);
      await speakWithElevenLabs(aiResponse);
      setIsWhispTalking(false);
      
    } catch (error) {
      console.error('❌ Conversation error:', error);
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
    navigate('/conversational-editor', { 
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
      // Cleanup recording on unmount
      stopRecording();
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