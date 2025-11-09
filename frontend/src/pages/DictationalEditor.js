import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useTheme } from '@/contexts/ThemeContext';
import { Sun, Moon, Plus, Mic, X, ArrowUp, Code, Eye } from 'lucide-react';
import AudioVisualizer from '../components/AudioVisualizer';
import axios from 'axios';
import '../styles/DictationalEditor.css';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const DictationalEditor = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { theme, toggleTheme } = useTheme();
  
  const [chatMessages, setChatMessages] = useState([]);
  const [isRecording, setIsRecording] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedFiles, setGeneratedFiles] = useState([]);
  const [previewContent, setPreviewContent] = useState('');
  const [showCode, setShowCode] = useState(false);
  const [sessionId] = useState(() => `session-${Date.now()}`);
  
  const iframeRef = useRef(null);
  const chatEndRef = useRef(null);
  
  useEffect(() => {
    // Handle initial audio if coming from dictational page
    const audioBlob = location.state?.audioBlob;
    if (audioBlob) {
      handleAudioTranscription(audioBlob);
    }
  }, []);
  
  useEffect(() => {
    // Auto scroll chat to bottom
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages]);
  
  useEffect(() => {
    // Render preview when files are generated and iframe is ready
    if (generatedFiles.length > 0 && !showCode && iframeRef.current) {
      console.log('🎯 useEffect triggered - rendering preview');
      renderPreview(generatedFiles);
    }
  }, [generatedFiles, showCode]);
  
  const handleAudioTranscription = async (audioBlob) => {
    console.log('🎤 Starting transcription...', audioBlob);
    setIsTranscribing(true);
    
    // Add transcribing message to chat
    setChatMessages(prev => [...prev, {
      role: 'system',
      content: 'Transcribing your voice...'
    }]);
    
    try {
      // Create form data with audio file
      const formData = new FormData();
      formData.append('file', audioBlob, 'audio.webm');
      
      console.log('📤 Sending to transcription endpoint...');
      
      // Send to transcription endpoint
      const response = await axios.post(`${API}/dictational/transcribe`, formData, {
        headers: {
          'Content-Type': 'multipart/form-data'
        }
      });
      
      console.log('📥 Transcription response:', response.data);
      
      if (response.data.success) {
        const transcribedText = response.data.text;
        
        console.log('✅ Transcribed text:', transcribedText);
        
        // Remove transcribing message and add user message in one update
        setChatMessages(prev => {
          const filtered = prev.filter(m => m.content !== 'Transcribing your voice...');
          return [...filtered, {
            id: `user-${Date.now()}`,
            role: 'user',
            content: transcribedText
          }];
        });
        
        // Start code generation
        handleGenerateCode(transcribedText);
      }
    } catch (error) {
      console.error('❌ Transcription error:', error);
      setChatMessages(prev => [...prev, {
        id: `error-${Date.now()}`,
        role: 'error',
        content: 'Failed to transcribe audio. Please try again.'
      }]);
    } finally {
      setIsTranscribing(false);
    }
  };
  
  const handleGenerateCode = async (prompt) => {
    console.log('🚀 Starting code generation with prompt:', prompt);
    setIsGenerating(true);
    
    try {
      // Use fetch with streaming
      const response = await fetch(`${API}/dictational/generate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          prompt: prompt,
          session_id: sessionId
        })
      });
      
      console.log('📡 Streaming response received');
      
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let currentMessageId = Date.now();
      let buffer = '';
      
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';
        
        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const data = JSON.parse(line.slice(6));
              console.log('📨 Stream data:', data);
              
              if (data.type === 'progress') {
                // Update or add progress message
                setChatMessages(prev => {
                  const existing = prev.find(m => m.id === currentMessageId);
                  if (existing) {
                    return prev.map(m => 
                      m.id === currentMessageId 
                        ? { ...m, content: data.message }
                        : m
                    );
                  } else {
                    return [...prev, {
                      id: currentMessageId,
                      role: 'assistant',
                      content: data.message,
                      isProgress: true
                    }];
                  }
                });
              } else if (data.type === 'complete') {
                console.log('✅ Generation complete:', data.result);
                
                // Remove progress message
                setChatMessages(prev => prev.filter(m => m.id !== currentMessageId));
                
                const result = data.result;
                setGeneratedFiles(result.files || []);
                
                // Add summary message
                setChatMessages(prev => [...prev, {
                  role: 'assistant',
                  content: result.summary,
                  showPreviewButton: true
                }]);
                
                // Don't call renderPreview here - useEffect will handle it
                
                setIsGenerating(false);
              }
            } catch (parseError) {
              console.error('Failed to parse stream data:', parseError, line);
            }
          }
        }
      }
      
    } catch (error) {
      console.error('❌ Generation error:', error);
      setIsGenerating(false);
      setChatMessages(prev => [...prev, {
        role: 'error',
        content: 'Failed to generate code. Please try again.'
      }]);
    }
  };
  
  const renderPreview = (files) => {
    console.log('🖼️ Rendering preview with files:', files);
    
    // Find the main file (App.tsx, index.html, etc.)
    const mainFile = files.find(f => 
      f.path.includes('App.tsx') || 
      f.path.includes('index.html') ||
      f.path.includes('App.jsx') ||
      f.path.includes('app.tsx') ||
      f.path.includes('app.jsx')
    ) || files[0];
    
    if (!mainFile) {
      console.error('❌ No main file found in:', files);
      return;
    }
    
    console.log('📄 Main file:', mainFile.path);
    
    // Create HTML content
    let htmlContent = '';
    
    if (mainFile.path.endsWith('.tsx') || mainFile.path.endsWith('.jsx')) {
      // React component - wrap in HTML
      const styleFile = files.find(f => f.path.endsWith('.css'));
      const styles = styleFile ? styleFile.content : '';
      
      htmlContent = `
        <!DOCTYPE html>
        <html lang="en">
          <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Preview</title>
            <script crossorigin src="https://unpkg.com/react@18/umd/react.production.min.js"></script>
            <script crossorigin src="https://unpkg.com/react-dom@18/umd/react-dom.production.min.js"></script>
            <script src="https://unpkg.com/@babel/standalone/babel.min.js"></script>
            <script src="https://cdn.tailwindcss.com"></script>
            <style>${styles}</style>
          </head>
          <body>
            <div id="root"></div>
            <script type="text/babel">
              ${mainFile.content}
              
              const root = ReactDOM.createRoot(document.getElementById('root'));
              root.render(<App />);
            </script>
          </body>
        </html>
      `;
    } else if (mainFile.path.endsWith('.html')) {
      // HTML file
      htmlContent = mainFile.content;
    } else {
      // Default - wrap content in HTML
      htmlContent = `
        <!DOCTYPE html>
        <html lang="en">
          <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Preview</title>
          </head>
          <body>
            <pre>${mainFile.content}</pre>
          </body>
        </html>
      `;
    }
    
    console.log('📝 HTML content generated, length:', htmlContent.length);
    setPreviewContent(htmlContent);
    
    // Render in iframe
    if (iframeRef.current) {
      try {
        const iframeDoc = iframeRef.current.contentDocument || iframeRef.current.contentWindow.document;
        iframeDoc.open();
        iframeDoc.write(htmlContent);
        iframeDoc.close();
        console.log('✅ Preview rendered in iframe');
      } catch (iframeError) {
        console.error('❌ Iframe error:', iframeError);
      }
    } else {
      console.error('❌ Iframe ref is null');
    }
  };
  
  const handleVoiceInput = async () => {
    if (!isRecording) {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        const mediaRecorder = new MediaRecorder(stream);
        const audioChunks = [];
        
        mediaRecorder.ondataavailable = (event) => {
          audioChunks.push(event.data);
        };
        
        mediaRecorder.onstop = async () => {
          const audioBlob = new Blob(audioChunks, { type: 'audio/webm' });
          await handleAudioTranscription(audioBlob);
          stream.getTracks().forEach(track => track.stop());
        };
        
        window.dictationalEditorRecorder = mediaRecorder;
        mediaRecorder.start();
        setIsRecording(true);
      } catch (error) {
        console.error('Microphone error:', error);
        alert('Microphone access required');
      }
    } else {
      if (window.dictationalEditorRecorder) {
        window.dictationalEditorRecorder.stop();
        window.dictationalEditorRecorder = null;
      }
      setIsRecording(false);
    }
  };
  
  return (
    <div className={`dictational-editor ${theme}`}>
      {/* Header */}
      <header className="dict-editor-header">
        <div className="header-left">
          <button className="logo-btn" onClick={() => navigate('/')}>
            <span>Whisp</span>
          </button>
          <span className="mode-badge">Dictational</span>
        </div>
        
        <div className="header-right">
          <button 
            className="header-btn"
            onClick={() => setShowCode(!showCode)}
            disabled={!generatedFiles.length}
          >
            {showCode ? <Eye size={18} /> : <Code size={18} />}
            <span>{showCode ? 'Preview' : 'Code'}</span>
          </button>
          <button className="theme-toggle-header" onClick={toggleTheme}>
            {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
          </button>
        </div>
      </header>
      
      {/* Main Content */}
      <div className="dict-editor-content">
        {/* Left Panel - Chat */}
        <div className="chat-panel">
          <div className="chat-messages">
            {isTranscribing && (
              <div className="chat-message system">
                <div className="message-content">Transcribing your voice...</div>
              </div>
            )}
            
            {chatMessages.map((msg, idx) => (
              <div key={idx} className={`chat-message ${msg.role}`}>
                <div className="message-avatar">
                  {msg.role === 'user' ? '👤' : msg.role === 'error' ? '⚠️' : '✦'}
                </div>
                <div className="message-content">
                  {msg.content}
                  {msg.showPreviewButton && generatedFiles.length > 0 && (
                    <button className="preview-btn" onClick={() => renderPreview(generatedFiles)}>
                      Preview
                    </button>
                  )}
                </div>
              </div>
            ))}
            
            <div ref={chatEndRef} />
          </div>
          
          {/* Bottom Pill Bar */}
          <div className="dict-pill-bar">
            <button className="pill-button">
              <Plus size={20} />
            </button>
            
            {isRecording ? (
              <div className="pill-input-area">
                <AudioVisualizer isActive={isRecording} />
              </div>
            ) : (
              <div className="pill-input-area">
                <span className="pill-placeholder">Continue speaking...</span>
              </div>
            )}
            
            <button 
              className="pill-button mic-button" 
              onClick={handleVoiceInput}
              disabled={isGenerating || isTranscribing}
            >
              {isRecording ? <X size={20} /> : <Mic size={20} />}
            </button>
            
            <button className="pill-button">
              <ArrowUp size={20} />
            </button>
          </div>
        </div>
        
        {/* Right Panel - Preview */}
        <div className="preview-panel-dict">
          <div className="preview-header-dict">
            <span>Preview</span>
          </div>
          
          <div className="preview-content-dict">
            {isGenerating ? (
              <div className="preview-loading-dict">
                <div className="loading-spinner">✦</div>
                <p>Building your app...</p>
              </div>
            ) : generatedFiles.length > 0 ? (
              showCode ? (
                <div className="code-display">
                  {generatedFiles.map((file, idx) => (
                    <div key={idx} className="code-file">
                      <div className="file-name">{file.path}</div>
                      <pre><code>{file.content}</code></pre>
                    </div>
                  ))}
                </div>
              ) : (
                <iframe
                  ref={iframeRef}
                  className="preview-iframe-dict"
                  title="Preview"
                  sandbox="allow-scripts allow-same-origin"
                />
              )
            ) : (
              <div className="preview-empty-dict">
                <span className="empty-icon">✦</span>
                <p>Your app will appear here</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default DictationalEditor;
