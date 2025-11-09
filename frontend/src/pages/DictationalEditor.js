import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useTheme } from '@/contexts/ThemeContext';
import { Sun, Moon, Plus, Mic, X, ArrowUp, Code, Eye } from 'lucide-react';
import AudioVisualizer from '../components/AudioVisualizer';
import sdk from '@stackblitz/sdk';
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
  const stackblitzRef = useRef(null);
  const chatEndRef = useRef(null);
  const hasInitialized = useRef(false);
  
  useEffect(() => {
    // Prevent double initialization from React StrictMode
    if (hasInitialized.current) return;
    hasInitialized.current = true;
    
    // Handle initial audio if coming from dictational page
    const audioBlob = location.state?.audioBlob;
    const testPrompt = location.state?.testPrompt;
    
    console.log('🎬 DictationalEditor mounted');
    console.log('📦 Location state:', location.state);
    console.log('🎤 Audio blob:', audioBlob);
    console.log('📝 Test prompt:', testPrompt);
    
    if (audioBlob) {
      console.log('✅ Audio blob found, starting transcription');
      handleAudioTranscription(audioBlob);
    } else if (testPrompt) {
      console.log('✅ Test prompt found, using directly');
      // Add user message directly
      setChatMessages([{
        id: `user-${Date.now()}`,
        role: 'user',
        content: testPrompt
      }]);
      // Start generation
      handleGenerateCode(testPrompt);
    } else {
      console.log('❌ No audio blob or test prompt in location state!');
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
      id: `system-transcribing-${Date.now()}`,
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
      console.error('Error response:', error.response?.data);
      console.error('Error status:', error.response?.status);
      
      const errorMessage = error.response?.data?.detail || error.message || 'Failed to transcribe audio. Please try again.';
      
      setChatMessages(prev => [...prev, {
        id: `error-${Date.now()}`,
        role: 'error',
        content: `Transcription failed: ${errorMessage}`
      }]);
    } finally {
      setIsTranscribing(false);
    }
  };
  
  const handleGenerateCode = async (prompt) => {
    console.log('🚀 Starting code generation with prompt:', prompt);
    setIsGenerating(true);
    
    try {
      console.log('📡 Calling API:', `${API}/dictational/generate`);
      
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
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      console.log('📡 Streaming response received, status:', response.status);
      
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let currentMessageId = Date.now();
      let buffer = '';
      let messageCount = 0;
      
      while (true) {
        const { done, value } = await reader.read();
        if (done) {
          console.log('✅ Stream finished, total messages:', messageCount);
          break;
        }
        
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';
        
        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const data = JSON.parse(line.slice(6));
              messageCount++;
              console.log(`📨 Stream data #${messageCount}:`, data);
              
              if (data.type === 'progress') {
                console.log('➡️ Adding/updating progress message:', data.message);
                // Update or add progress message
                setChatMessages(prev => {
                  const existing = prev.find(m => m.id === currentMessageId);
                  if (existing) {
                    console.log('  Updating existing progress message');
                    return prev.map(m => 
                      m.id === currentMessageId 
                        ? { ...m, content: data.message }
                        : m
                    );
                  } else {
                    console.log('  Adding new progress message with id:', currentMessageId);
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
                console.log('📂 Files received:', data.result.files);
                console.log('📝 Summary:', data.result.summary);
                
                const result = data.result;
                
                // Single state update: remove progress and add summary
                setChatMessages(prev => {
                  const filtered = prev.filter(m => m.id !== currentMessageId);
                  return [...filtered, {
                    id: `assistant-${Date.now()}`,
                    role: 'assistant',
                    content: result.summary,
                    showPreviewButton: true
                  }];
                });
                
                setGeneratedFiles(result.files || []);
                
                // Don't call renderPreview here - useEffect will handle it
                
                setIsGenerating(false);
              }
            } catch (parseError) {
              console.error('❌ Failed to parse stream data:', parseError, 'Line:', line);
            }
          }
        }
      }
      
    } catch (error) {
      console.error('❌ Generation error:', error);
      console.error('Error details:', error.message, error.stack);
      setIsGenerating(false);
      setChatMessages(prev => [...prev, {
        id: `error-${Date.now()}`,
        role: 'error',
        content: `Failed to generate code: ${error.message}`
      }]);
    }
  };
  
  const renderPreview = async (files) => {
    console.log('🖼️ Rendering preview with StackBlitz, files:', files);
    
    if (!files || files.length === 0) {
      console.error('❌ No files to render');
      return;
    }
    
    // Create StackBlitz project structure
    const projectFiles = {};
    let hasReactComponents = false;
    
    files.forEach(file => {
      projectFiles[file.path] = file.content;
      if (file.path.endsWith('.tsx') || file.path.endsWith('.jsx')) {
        hasReactComponents = true;
      }
    });
    
    console.log('📁 Project files:', Object.keys(projectFiles));
    
    // Determine project type and setup
    let project;
    
    if (hasReactComponents) {
      // React/TypeScript project
      project = {
        title: 'Whisp Generated App',
        description: 'Generated by Whisp Dictational Mode',
        template: 'node',
        files: {
          ...projectFiles,
          'package.json': JSON.stringify({
            name: 'whisp-generated-app',
            version: '1.0.0',
            dependencies: {
              'react': '^18.2.0',
              'react-dom': '^18.2.0'
            },
            devDependencies: {
              '@types/react': '^18.0.0',
              '@types/react-dom': '^18.0.0',
              'typescript': '^5.0.0',
              'vite': '^4.0.0'
            }
          }, null, 2),
          'index.html': projectFiles['index.html'] || '<!DOCTYPE html><html><head></head><body><div id="root"></div><script type="module" src="/src/main.tsx"></script></body></html>',
          'src/main.tsx': projectFiles['App.tsx'] ? `import React from 'react';\nimport ReactDOM from 'react-dom/client';\nimport App from './App';\n\nReactDOM.createRoot(document.getElementById('root')!).render(<App />);` : projectFiles['src/main.tsx'] || '',
          'src/App.tsx': projectFiles['App.tsx'] || projectFiles['src/App.tsx'] || '',
          'tsconfig.json': JSON.stringify({
            compilerOptions: {
              target: 'ES2020',
              useDefineForClassFields: true,
              lib: ['ES2020', 'DOM', 'DOM.Iterable'],
              module: 'ESNext',
              skipLibCheck: true,
              moduleResolution: 'bundler',
              allowImportingTsExtensions: true,
              resolveJsonModule: true,
              isolatedModules: true,
              noEmit: true,
              jsx: 'react-jsx',
              strict: true
            },
            include: ['src']
          }, null, 2)
        }
      };
    } else {
      // Plain HTML project
      const mainFile = files.find(f => f.path.includes('.html')) || files[0];
      project = {
        title: 'Whisp Generated App',
        description: 'Generated by Whisp Dictational Mode',
        template: 'html',
        files: projectFiles
      };
    }
    
    console.log('📦 StackBlitz project configured:', project.template);
    
    // Embed StackBlitz in the preview container
    if (stackblitzRef.current) {
      try {
        const vm = await sdk.embedProject(
          stackblitzRef.current,
          project,
          {
            openFile: Object.keys(projectFiles)[0],
            view: 'preview',
            height: '100%',
            hideNavigation: true,
            hideDevTools: false
          }
        );
        console.log('✅ StackBlitz preview embedded successfully');
      } catch (error) {
        console.error('❌ StackBlitz error:', error);
      }
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
                <div className="message-avatar">⏳</div>
                <div className="message-content">Transcribing your voice...</div>
              </div>
            )}
            
            {isGenerating && (
              <div className="chat-message system">
                <div className="message-avatar">⚙️</div>
                <div className="message-content">
                  <div className="loading-dots">Generating your app...</div>
                </div>
              </div>
            )}
            
            {chatMessages.map((msg) => (
              <div key={msg.id || `msg-${Date.now()}-${Math.random()}`} className={`chat-message ${msg.role}`}>
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
                  {generatedFiles.map((file) => (
                    <div key={file.path} className="code-file">
                      <div className="file-name">{file.path}</div>
                      <pre><code>{file.content}</code></pre>
                    </div>
                  ))}
                </div>
              ) : (
                <div 
                  ref={stackblitzRef}
                  className="stackblitz-preview"
                  style={{ width: '100%', height: '100%' }}
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
