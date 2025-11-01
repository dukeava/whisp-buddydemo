import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useTheme } from '@/contexts/ThemeContext';
import { Sun, Moon, Trash2, Code, Eye, Download, Plus, Mic, MicOff } from 'lucide-react';
import RealtimeAudioChat from '@/services/RealtimeAudioChat';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';
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
  const [statusText, setStatusText] = useState('Alright! Let me build this for you...');
  const [generatedCode, setGeneratedCode] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [projectName, setProjectName] = useState('Untitled Project');
  const [showCode, setShowCode] = useState(false);
  const [attachedFiles, setAttachedFiles] = useState(location.state?.attachedFiles || []);
  const [conversationHistory, setConversationHistory] = useState(location.state?.conversationHistory || []);
  const realtimeChatRef = useRef(null);
  const iframeRef = useRef(null);
  const fileInputRef = useRef(null);
  const hasGeneratedRef = useRef(false);

  useEffect(() => {
    // Auto-start building if we have conversation history
    if (conversationHistory.length > 0 && !hasGeneratedRef.current) {
      hasGeneratedRef.current = true;
      setTimeout(() => {
        handleGenerateCode();
      }, 1500);
    }
    
    // Initialize voice chat
    initializeRealtimeChat();
  }, []);

  const initializeRealtimeChat = async () => {
    try {
      if (!realtimeChatRef.current) {
        realtimeChatRef.current = new RealtimeAudioChat();
        
        realtimeChatRef.current.onTranscript = (text, isUser) => {
          console.log(isUser ? 'User:' : 'Whisp:', text);
          
          if (!isUser) {
            setStatusText(text);
            setIsSpeaking(true);
            setTimeout(() => setIsSpeaking(false), 3000);
          }
        };

        realtimeChatRef.current.onSpeakingStateChange = (state) => {
          if (state === 'assistant_speaking') {
            setIsSpeaking(true);
          } else if (state === 'assistant_stopped') {
            // Smooth transition back to stagnant state
            setIsSpeaking(false);
          }
        };

        await realtimeChatRef.current.init('editor');
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

  const handleFileUpload = (event) => {
    const files = Array.from(event.target.files);
    setAttachedFiles(prev => [...prev, ...files]);
  };

  const handleGenerateCode = async () => {
    setIsGenerating(true);
    setIsSpeaking(true);
    
    // Send initial message via voice
    if (realtimeChatRef.current) {
      realtimeChatRef.current.sendMessage("Alright, starting to build this now! Setting up the foundation first...");
    }
    
    // Progress updates
    const updates = [
      { delay: 3000, message: "Looking good! Adding the features you wanted..." },
      { delay: 6000, message: "Ooh this is turning out nice! Working on the UI now..." },
      { delay: 9000, message: "Almost there! Just polishing things up..." }
    ];
    
    const timeouts = updates.map(({ delay, message }) => 
      setTimeout(() => {
        if (realtimeChatRef.current && isGenerating) {
          realtimeChatRef.current.sendMessage(message);
        }
      }, delay)
    );
    
    try {
      const userRequirements = conversationHistory
        .filter(m => m.role === 'user')
        .map(m => m.content)
        .join(' ');

      const response = await axios.post(`${API}/generate-code`, {
        conversation_history: conversationHistory,
        user_requirements: userRequirements
      });

      timeouts.forEach(t => clearTimeout(t));

      if (response.data.success) {
        setGeneratedCode(response.data.code);
        
        const completionMessage = "Boom! Check it out - I think this really captures what you were going for! What do you think?";
        if (realtimeChatRef.current) {
          realtimeChatRef.current.sendMessage(completionMessage);
        }
        setStatusText(completionMessage);
        
        // Render in iframe
        if (iframeRef.current) {
          const iframeDoc = iframeRef.current.contentDocument || iframeRef.current.contentWindow.document;
          iframeDoc.open();
          iframeDoc.write(response.data.code);
          iframeDoc.close();
        }
      }
    } catch (error) {
      timeouts.forEach(t => clearTimeout(t));
      console.error('Code generation failed:', error);
      const errorMessage = "Hmm, hit a snag. Let me try that again...";
      if (realtimeChatRef.current) {
        realtimeChatRef.current.sendMessage(errorMessage);
      }
      setStatusText(errorMessage);
    } finally {
      setIsGenerating(false);
      setTimeout(() => setIsSpeaking(false), 2000);
    }
  };

  const handleClearChat = () => {
    setConversationHistory([]);
    setGeneratedCode('');
    hasGeneratedRef.current = false;
    setStatusText("Fresh start! What do you wanna build?");
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

  const toggleCodePreview = () => {
    setShowCode(!showCode);
  };

  return (
    <div className={`editor-page ${theme}`}>
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
            onClick={toggleCodePreview}
            data-testid="toggle-code-btn"
            disabled={!generatedCode}
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

      <div className="editor-content">
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
              onClick={isListening ? stopRealtimeChat : initializeRealtimeChat}
              data-testid="mic-toggle-editor-btn"
            >
              {isListening ? <MicOff size={22} /> : <Mic size={22} />}
            </button>

            <button 
              className="control-btn-editor"
              onClick={handleGenerateCode}
              disabled={isGenerating || conversationHistory.length === 0}
              data-testid="generate-code-btn"
              title="Generate Preview"
            >
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                <polygon points="5 3 19 12 5 21 5 3" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="currentColor"/>
              </svg>
            </button>
          </div>
        </div>

        <div className="preview-panel">
          <div className="preview-header">
            <span>Preview</span>
            <div className="preview-tabs">
              <button 
                className={`tab ${!showCode ? 'active' : ''}`}
                onClick={() => setShowCode(false)}
                data-testid="preview-tab"
              >
                Preview
              </button>
              <button 
                className={`tab ${showCode ? 'active' : ''}`}
                onClick={() => setShowCode(true)}
                data-testid="code-tab"
              >
                Code
              </button>
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
                <p>Building your vision</p>
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
                <p>Building your app...</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default EditorPage;