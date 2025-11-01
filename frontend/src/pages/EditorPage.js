import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTheme } from '@/contexts/ThemeContext';
import { Sun, Moon, Trash2, Code, Eye, Download } from 'lucide-react';
import RealtimeAudioChat from '@/services/RealtimeAudioChat';
import axios from 'axios';
import '../styles/EditorPage.css';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const EditorPage = () => {
  const navigate = useNavigate();
  const { theme, toggleTheme } = useTheme();
  const [isListening, setIsListening] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [statusText, setStatusText] = useState('Hey! Tell me what you wanna build today. I\'m all ears!');
  const [transcript, setTranscript] = useState([]);
  const [showTranscript, setShowTranscript] = useState(false);
  const [generatedCode, setGeneratedCode] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [projectName, setProjectName] = useState('Untitled Project');
  const [showCode, setShowCode] = useState(false);
  const realtimeChatRef = useRef(null);
  const iframeRef = useRef(null);
  const conversationRef = useRef([]);

  // Conversational AI responses
  const conversationalResponses = [
    "Ooh, that sounds exciting! Tell me more about what you're envisioning.",
    "I love where this is going! What features are you thinking?",
    "Nice! So just to clarify - you want this to...",
    "Got it! This is gonna be awesome. Let me ask you something...",
    "That's a cool idea! Quick question though...",
    "Okay okay, I'm seeing the vision! But help me understand...",
    "Sweet! Before I start building, let me make sure I got this right...",
    "Alright, so we're making something really cool here! One more thing...",
    "This is gonna be fire! Just wanna double-check...",
    "I'm pumped to build this with you! Let's nail down..."
  ];

  useEffect(() => {
    // Simulate conversational status updates
    const statusMessages = [
      "Hey! Tell me what you wanna build today. I'm all ears!",
      "Just listening... take your time!",
      "Mhmm, I'm following...",
      "Go on, I'm with you!"
    ];

    if (isListening && !isSpeaking) {
      const interval = setInterval(() => {
        setStatusText(statusMessages[Math.floor(Math.random() * statusMessages.length)]);
      }, 4000);
      return () => clearInterval(interval);
    }
  }, [isListening, isSpeaking]);

  const initializeRealtimeChat = async () => {
    try {
      if (!realtimeChatRef.current) {
        realtimeChatRef.current = new RealtimeAudioChat();
        
        realtimeChatRef.current.onTranscript = (text, isUser) => {
          setTranscript(prev => [...prev, { role: isUser ? 'user' : 'assistant', content: text }]);
          conversationRef.current.push({ role: isUser ? 'user' : 'assistant', content: text });
          
          if (!isUser) {
            setStatusText(text);
            setIsSpeaking(true);
            setTimeout(() => setIsSpeaking(false), 2000);
          }
          
          setShowTranscript(true);
        };

        await realtimeChatRef.current.init();
      }
      setIsListening(true);
      setStatusText("I'm listening! What's on your mind?");
    } catch (error) {
      console.error('Failed to initialize realtime chat:', error);
      setStatusText("Oops! Mic issue. Mind clicking the mic button again?");
    }
  };

  const stopRealtimeChat = () => {
    if (realtimeChatRef.current) {
      realtimeChatRef.current.disconnect();
      realtimeChatRef.current = null;
    }
    setIsListening(false);
    setStatusText("Paused. Hit the mic when you're ready!");
  };

  const handleGenerateCode = async () => {
    setIsGenerating(true);
    setStatusText("Alright! Let me cook up something awesome for you...");
    setIsSpeaking(true);
    
    try {
      const userRequirements = conversationRef.current
        .filter(m => m.role === 'user')
        .map(m => m.content)
        .join(' ');

      const response = await axios.post(`${API}/generate-code`, {
        conversation_history: conversationRef.current,
        user_requirements: userRequirements
      });

      if (response.data.success) {
        setGeneratedCode(response.data.code);
        setStatusText("Ta-da! Check out what I made. Thoughts?");
        
        if (iframeRef.current) {
          const iframeDoc = iframeRef.current.contentDocument || iframeRef.current.contentWindow.document;
          iframeDoc.open();
          iframeDoc.write(response.data.code);
          iframeDoc.close();
        }
      }
    } catch (error) {
      console.error('Code generation failed:', error);
      setStatusText("Hmm, hit a snag there. Wanna try describing it differently?");
    } finally {
      setIsGenerating(false);
      setIsSpeaking(false);
    }
  };

  const handleClearChat = () => {
    setTranscript([]);
    conversationRef.current = [];
    setGeneratedCode('');
    setStatusText("Fresh start! What do you wanna build?");
    setShowTranscript(false);
  };

  const handleDownloadCode = () => {
    if (!generatedCode) return;
    
    const blob = new Blob([generatedCode], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${projectName.replace(/\s+/g, '-').toLowerCase()}.html`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className={`editor-page ${theme}`}>
      {/* Header */}
      <header className="editor-header">
        <div className="header-left">
          <button 
            className="logo-btn"
            onClick={() => navigate('/')}
            data-testid="back-to-home-btn"
          >
            <svg width="24" height="24" viewBox="0 0 32 32" fill="none">
              <path d="M16 4L20 12L28 16L20 20L16 28L12 20L4 16L12 12L16 4Z" fill="currentColor"/>
            </svg>
          </button>
          <input 
            type="text" 
            className="project-name-input"
            value={projectName}
            onChange={(e) => setProjectName(e.target.value)}
            data-testid="project-name-input"
          />
          <span className="status-badge" data-testid="status-badge">Unsaved changes</span>
        </div>

        <div className="header-right">
          <button 
            className="header-btn"
            onClick={() => setShowCode(!showCode)}
            data-testid="toggle-code-btn"
          >
            {showCode ? <Eye size={18} /> : <Code size={18} />}
            <span>{showCode ? 'Preview' : 'Code'}</span>
          </button>
          <button 
            className="header-btn"
            onClick={handleDownloadCode}
            disabled={!generatedCode}
            data-testid="download-code-btn"
          >
            <Download size={18} />
            <span>Export</span>
          </button>
          <button 
            className="theme-toggle-header"
            onClick={toggleTheme}
            data-testid="theme-toggle-header-btn"
          >
            {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
          </button>
        </div>
      </header>

      {/* Main Content */}
      <div className="editor-content">
        {/* Left Panel - Voice Sphere */}
        <div className="conversation-panel">
          <div className="conversation-sphere-container">
            <div className="conversation-sphere-wrapper" style={{ position: 'relative' }}>
              <div 
                className={`conversation-sphere ${
                  isGenerating ? 'speaking' : 
                  isSpeaking ? 'speaking' : 
                  isListening ? 'listening' : ''
                }`}
                data-testid="conversation-sphere"
              >
                <div className="conversation-sphere-glow"></div>
              </div>
            </div>
            
            <p className="conversation-status" data-testid="conversation-status">
              {statusText}
            </p>
          </div>

          {/* Transcript (appears at bottom) */}
          <div 
            className={`transcript-container ${showTranscript ? 'visible' : ''}`}
            data-testid="transcript-container"
          >
            {transcript.slice(-3).map((item, idx) => (
              <div 
                key={idx} 
                className={`transcript-item ${item.role}`}
                data-testid={`transcript-${item.role}`}
              >
                {item.content}
              </div>
            ))}
          </div>

          <div className="conversation-controls">
            <button 
              className="control-btn-editor"
              onClick={handleClearChat}
              data-testid="clear-chat-btn"
            >
              <Trash2 size={18} />
            </button>
            
            <button 
              className={`control-btn-editor primary ${isListening ? 'active' : ''}`}
              onClick={isListening ? stopRealtimeChat : initializeRealtimeChat}
              data-testid="voice-toggle-btn"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                <path d="M19 10v2a7 7 0 0 1-14 0v-2" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                <line x1="12" y1="19" x2="12" y2="23" strokeWidth="2" strokeLinecap="round"/>
                <line x1="8" y1="23" x2="16" y2="23" strokeWidth="2" strokeLinecap="round"/>
              </svg>
            </button>

            <button 
              className="control-btn-editor"
              onClick={handleGenerateCode}
              disabled={isGenerating || transcript.length === 0}
              data-testid="generate-code-btn"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                <polygon points="5 3 19 12 5 21 5 3" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="currentColor"/>
              </svg>
            </button>
          </div>
        </div>

        {/* Right Panel - Preview */}
        <div className="preview-panel">
          <div className="preview-header">
            <span>Preview</span>
            <div className="preview-tabs">
              <button className="tab active" data-testid="preview-tab">Preview</button>
              <button className="tab" data-testid="code-tab">Code</button>
            </div>
          </div>

          <div className="preview-content">
            {isGenerating ? (
              <div className="preview-loading" data-testid="preview-loading">
                <div className="loading-spinner">
                  <svg width="48" height="48" viewBox="0 0 32 32" fill="none">
                    <path d="M16 4L20 12L28 16L20 20L16 28L12 20L4 16L12 12L16 4Z" fill="currentColor"/>
                  </svg>
                </div>
                <h3>Spinning up preview...</h3>
                <p>Stepping into the horizon</p>
              </div>
            ) : generatedCode ? (
              showCode ? (
                <pre className="code-display" data-testid="code-display">
                  <code>{generatedCode}</code>
                </pre>
              ) : (
                <iframe
                  ref={iframeRef}
                  className="preview-iframe"
                  title="Preview"
                  sandbox="allow-scripts"
                  data-testid="preview-iframe"
                />
              )
            ) : (
              <div className="preview-empty" data-testid="preview-empty">
                <svg width="64" height="64" viewBox="0 0 32 32" fill="none" opacity="0.3">
                  <path d="M16 4L20 12L28 16L20 20L16 28L12 20L4 16L12 12L16 4Z" fill="currentColor"/>
                </svg>
                <p>Start chatting with me to bring your ideas to life!</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default EditorPage;