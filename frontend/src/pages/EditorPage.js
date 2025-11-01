import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useTheme } from '@/contexts/ThemeContext';
import { Sun, Moon, Trash2, Code, Eye, Download, Plus } from 'lucide-react';
import RealtimeAudioChat from '@/services/RealtimeAudioChat';
import axios from 'axios';
import '../styles/EditorPage.css';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const EditorPage = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { theme, toggleTheme } = useTheme();
  const [isListening, setIsListening] = useState(true);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [statusText, setStatusText] = useState('Alright! Let me understand what you\'re building here...');
  const [generatedCode, setGeneratedCode] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [projectName, setProjectName] = useState('Untitled Project');
  const [showCode, setShowCode] = useState(false);
  const [attachedFiles, setAttachedFiles] = useState(location.state?.attachedFiles || []);
  const realtimeChatRef = useRef(null);
  const iframeRef = useRef(null);
  const conversationRef = useRef([]);
  const fileInputRef = useRef(null);

  // Building phase messages
  const buildingMessages = [
    "Okay so I'm putting together the structure now...",
    "This is actually turning out really cool!",
    "Adding some nice touches here...",
    "Almost there, this is looking awesome!",
    "Just polishing things up..."
  ];

  useEffect(() => {
    // Auto-start voice conversation
    initializeRealtimeChat();
    setIsSpeaking(true);
    setTimeout(() => setIsSpeaking(false), 3000);
  }, []);

  const initializeRealtimeChat = async () => {
    try {
      if (!realtimeChatRef.current) {
        realtimeChatRef.current = new RealtimeAudioChat();
        
        realtimeChatRef.current.onTranscript = (text, isUser) => {
          conversationRef.current.push({ role: isUser ? 'user' : 'assistant', content: text });
          
          if (!isUser) {
            setStatusText(text);
            setIsSpeaking(true);
            setTimeout(() => setIsSpeaking(false), 2000);
            
            // Check if Whisp is asking to start building
            if (text.toLowerCase().includes('hit go') || text.toLowerCase().includes('press go') || text.toLowerCase().includes('click go')) {
              // User should click the generate button
            }
          }
        };

        await realtimeChatRef.current.init();
      }
      setIsListening(true);
    } catch (error) {
      console.error('Failed to initialize realtime chat:', error);
      setStatusText("Hmm, having trouble with the mic. Mind refreshing?");
    }
  };

  const stopRealtimeChat = () => {
    if (realtimeChatRef.current) {
      realtimeChatRef.current.disconnect();
      realtimeChatRef.current = null;
    }
    setIsListening(false);
  };

  const handleFileUpload = (event) => {
    const files = Array.from(event.target.files);
    setAttachedFiles(prev => [...prev, ...files]);
    setStatusText(`Nice! Got ${files.length} more file${files.length > 1 ? 's' : ''}. What should I do with ${files.length > 1 ? 'these' : 'this'}?`);
    setIsSpeaking(true);
    setTimeout(() => setIsSpeaking(false), 2500);
    console.log('Files attached in editor:', files);
  };

  const handleGenerateCode = async () => {
    setIsGenerating(true);
    setIsSpeaking(true);
    
    let messageIndex = 0;
    const messageInterval = setInterval(() => {
      if (messageIndex < buildingMessages.length) {
        setStatusText(buildingMessages[messageIndex]);
        messageIndex++;
      }
    }, 3000);
    
    try {
      const userRequirements = conversationRef.current
        .filter(m => m.role === 'user')
        .map(m => m.content)
        .join(' ');

      const response = await axios.post(`${API}/generate-code`, {
        conversation_history: conversationRef.current,
        user_requirements: userRequirements
      });

      clearInterval(messageInterval);

      if (response.data.success) {
        setGeneratedCode(response.data.code);
        setStatusText("Boom! There it is. Check it out - pretty slick, right? What do you think?");
        
        if (iframeRef.current) {
          const iframeDoc = iframeRef.current.contentDocument || iframeRef.current.contentWindow.document;
          iframeDoc.open();
          iframeDoc.write(response.data.code);
          iframeDoc.close();
        }
        
        setTimeout(() => setIsSpeaking(false), 4000);
      }
    } catch (error) {
      clearInterval(messageInterval);
      console.error('Code generation failed:', error);
      setStatusText("Oof, hit a snag. Let's try that again - describe it one more time?");
      setTimeout(() => setIsSpeaking(false), 3000);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleClearChat = () => {
    conversationRef.current = [];
    setGeneratedCode('');
    setStatusText("Fresh slate! What are we building now?");
    setIsSpeaking(true);
    setTimeout(() => setIsSpeaking(false), 2000);
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
    
    setStatusText("Downloaded! You can tweak it however you like now.");
    setIsSpeaking(true);
    setTimeout(() => setIsSpeaking(false), 2500);
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

            {attachedFiles.length > 0 && (
              <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginTop: '8px' }}>
                📎 {attachedFiles.length} file{attachedFiles.length > 1 ? 's' : ''} attached
              </p>
            )}
          </div>

          <div className="conversation-controls">
            <input
              ref={fileInputRef}
              type="file"
              multiple
              className="file-input"
              onChange={handleFileUpload}
              accept="image/*,.pdf,.doc,.docx,.txt"
            />

            <button 
              className="control-btn-editor"
              onClick={() => fileInputRef.current?.click()}
              data-testid="attach-file-editor-btn"
            >
              <Plus size={22} />
            </button>

            <button 
              className="control-btn-editor"
              onClick={handleClearChat}
              data-testid="clear-chat-btn"
            >
              <Trash2 size={22} />
            </button>

            <button 
              className="control-btn-editor"
              onClick={handleGenerateCode}
              disabled={isGenerating || conversationRef.current.length === 0}
              data-testid="generate-code-btn"
              title="Generate Preview"
            >
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor">
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