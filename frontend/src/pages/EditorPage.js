import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTheme } from '@/contexts/ThemeContext';
import { Sun, Moon, Mic, MicOff, Trash2, Code, Eye, Play, Download } from 'lucide-react';
import RealtimeAudioChat from '@/services/RealtimeAudioChat';
import axios from 'axios';
import '../styles/EditorPage.css';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const EditorPage = () => {
  const navigate = useNavigate();
  const { theme, toggleTheme } = useTheme();
  const [isListening, setIsListening] = useState(false);
  const [messages, setMessages] = useState([
    { role: 'assistant', content: 'Hey! Tell me what you want to build today.' }
  ]);
  const [generatedCode, setGeneratedCode] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [projectName, setProjectName] = useState('Untitled Project');
  const [showCode, setShowCode] = useState(false);
  const realtimeChatRef = useRef(null);
  const iframeRef = useRef(null);
  const messagesEndRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const initializeRealtimeChat = async () => {
    try {
      if (!realtimeChatRef.current) {
        realtimeChatRef.current = new RealtimeAudioChat();
        
        // Set up event handlers
        realtimeChatRef.current.onTranscript = (transcript, isUser) => {
          setMessages(prev => [...prev, {
            role: isUser ? 'user' : 'assistant',
            content: transcript
          }]);
        };

        await realtimeChatRef.current.init();
      }
      setIsListening(true);
    } catch (error) {
      console.error('Failed to initialize realtime chat:', error);
    }
  };

  const stopRealtimeChat = () => {
    if (realtimeChatRef.current) {
      realtimeChatRef.current.disconnect();
      realtimeChatRef.current = null;
    }
    setIsListening(false);
  };

  const handleGenerateCode = async () => {
    setIsGenerating(true);
    
    try {
      // Build user requirements from conversation
      const userRequirements = messages
        .filter(m => m.role === 'user')
        .map(m => m.content)
        .join(' ');

      const response = await axios.post(`${API}/generate-code`, {
        conversation_history: messages,
        user_requirements: userRequirements
      });

      if (response.data.success) {
        setGeneratedCode(response.data.code);
        
        // Update iframe with generated code
        if (iframeRef.current) {
          const iframeDoc = iframeRef.current.contentDocument || iframeRef.current.contentWindow.document;
          iframeDoc.open();
          iframeDoc.write(response.data.code);
          iframeDoc.close();
        }
      }
    } catch (error) {
      console.error('Code generation failed:', error);
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: 'Sorry, I encountered an error generating the code. Let\'s try again!'
      }]);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleClearChat = () => {
    setMessages([{ role: 'assistant', content: 'Hey! Tell me what you want to build today.' }]);
    setGeneratedCode('');
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
        {/* Left Panel - Conversation */}
        <div className="conversation-panel">
          <div className="conversation-header">
            <div className="sphere-mini" data-testid="conversation-sphere">
              <div className={`sphere-glow-mini ${isListening ? 'active' : ''}`}></div>
            </div>
            <h3>Conversation</h3>
          </div>

          <div className="messages-container" data-testid="messages-container">
            {messages.map((msg, idx) => (
              <div 
                key={idx} 
                className={`message ${msg.role}`}
                data-testid={`message-${msg.role}-${idx}`}
              >
                <div className="message-content">
                  {msg.content}
                </div>
              </div>
            ))}
            <div ref={messagesEndRef} />
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
              {isListening ? <MicOff size={18} /> : <Mic size={18} />}
            </button>

            <button 
              className="control-btn-editor"
              onClick={handleGenerateCode}
              disabled={isGenerating}
              data-testid="generate-code-btn"
            >
              <Play size={18} />
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
                  sandbox="allow-scripts allow-same-origin"
                  data-testid="preview-iframe"
                />
              )
            ) : (
              <div className="preview-empty" data-testid="preview-empty">
                <svg width="64" height="64" viewBox="0 0 32 32" fill="none" opacity="0.3">
                  <path d="M16 4L20 12L28 16L20 20L16 28L12 20L4 16L12 12L16 4Z" fill="currentColor"/>
                </svg>
                <p>Start a conversation to see your creation come to life</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default EditorPage;