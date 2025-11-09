import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useTheme } from '@/contexts/ThemeContext';
import { Sun, Moon, Plus, Mic, X, ArrowUp, Code, Eye, Square } from 'lucide-react';
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
  const [generationCancelled, setGenerationCancelled] = useState(false);
  
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
    // Render preview when files are generated
    if (generatedFiles.length > 0 && !showCode) {
      console.log('🎯 useEffect triggered - rendering preview');
      renderPreview(generatedFiles);
    }
  }, [generatedFiles, showCode]);
  
  const handleAudioTranscription = async (audioBlob) => {
    console.log('🎤 Starting transcription...', audioBlob);
    setIsTranscribing(true);
    
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
        
        // Add user message in one update
        setChatMessages([{
          id: `user-${Date.now()}`,
          role: 'user',
          content: transcribedText
        }]);
        
        // Start code generation
        handleGenerateCode(transcribedText);
      }
    } catch (error) {
      console.error('❌ Transcription error:', error);
      console.error('Error response:', error.response?.data);
      console.error('Error status:', error.response?.status);
      
      const errorMessage = error.response?.data?.detail || error.message || 'Failed to transcribe audio. Please try again.';
      
      setChatMessages([{
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
    setGenerationCancelled(false);
    
    // Add "Thinking..." shimmer message
    const thinkingId = `thinking-${Date.now()}`;
    setChatMessages(prev => [...prev, {
      id: thinkingId,
      role: 'thinking',
      content: 'Thinking...'
    }]);
    
    try {
      console.log('📡 Calling API:', `${API}/dictational/generate-simple`);
      
      // Use simple POST request
      const response = await axios.post(`${API}/dictational/generate-simple`, {
        prompt: prompt,
        session_id: sessionId
      });
      
      console.log('📥 Response received:', response.data);
      
      // Remove "Thinking..." message
      setChatMessages(prev => prev.filter(m => m.id !== thinkingId));
      
      if (response.data.success && !generationCancelled) {
        const result = response.data.result;
        const steps = result.steps || [];
        
        // Parse summary to extract intro and features/conclusion
        const summaryLines = result.summary.split('\n');
        let intro = '';
        let featuresAndConclusion = '';
        let foundHeader = false;
        
        for (const line of summaryLines) {
          if (line.startsWith('## ')) {
            foundHeader = true;
          }
          
          if (!foundHeader && line.trim()) {
            intro += line + '\n';
          } else if (foundHeader || line.startsWith('-') || line.startsWith('##')) {
            featuresAndConclusion += line + '\n';
          }
        }
        
        console.log('📝 Intro:', intro);
        console.log('📝 Features:', featuresAndConclusion);
        
        // Add intro message first
        if (intro.trim()) {
          setChatMessages(prev => [...prev, {
            id: `intro-${Date.now()}`,
            role: 'assistant',
            content: intro.trim()
          }]);
          
          await new Promise(resolve => setTimeout(resolve, 800));
        }
        
        // Add step messages with loading animation
        for (let i = 0; i < steps.length; i++) {
          if (generationCancelled) break;
          
          const stepId = `step-${Date.now()}-${i}`;
          
          // Add with loading spinner
          setChatMessages(prev => [...prev, {
            id: stepId,
            role: 'step',
            content: steps[i],
            isLoading: true
          }]);
          
          // Wait then mark as completed with checkmark
          await new Promise(resolve => setTimeout(resolve, 700));
          
          if (generationCancelled) break;
          
          setChatMessages(prev => prev.map(m =>
            m.id === stepId
              ? { ...m, isLoading: false, isCompleted: true }
              : m
          ));
        }
        
        if (generationCancelled) {
          setIsGenerating(false);
          return;
        }
        
        // Wait before showing features/conclusion
        await new Promise(resolve => setTimeout(resolve, 600));
        
        // Add features and conclusion
        if (featuresAndConclusion.trim()) {
          setChatMessages(prev => [...prev, {
            id: `features-${Date.now()}`,
            role: 'assistant',
            content: featuresAndConclusion.trim(),
            showPreviewButton: true
          }]);
        }
        
        setGeneratedFiles(result.files || []);
        setIsGenerating(false);
      }
      
    } catch (error) {
      // Remove "Thinking..." on error
      setChatMessages(prev => prev.filter(m => m.id !== thinkingId));
      
      console.error('❌ Generation error:', error);
      setIsGenerating(false);
      
      setChatMessages(prev => [...prev, {
        id: `error-${Date.now()}`,
        role: 'error',
        content: `Failed to generate code: ${error.response?.data?.detail || error.message}`
      }]);
    }
  };
  
  const renderPreview = async (files) => {
    console.log('🖼️ Rendering preview with StackBlitz, files:', files);
    
    if (!files || files.length === 0) {
      console.error('❌ No files to render');
      return;
    }
    
    // Check if it's HTML or React
    const hasHTML = files.some(f => f.path.endsWith('.html'));
    const hasReact = files.some(f => f.path.endsWith('.tsx') || f.path.endsWith('.jsx'));
    
    // Create project files object
    const projectFiles = {};
    files.forEach(file => {
      projectFiles[file.path] = file.content;
    });
    
    console.log('📁 Project files:', Object.keys(projectFiles));
    console.log('📁 Type: HTML?', hasHTML, 'React?', hasReact);
    
    let project;
    
    if (hasHTML && !hasReact) {
      // Plain HTML project
      project = {
        title: 'Whisp App',
        description: 'Generated by Whisp',
        template: 'html',
        files: projectFiles
      };
    } else {
      // React/TypeScript project
      project = {
        title: 'Whisp App',
        description: 'Generated by Whisp',
        template: 'node',
        files: {
          'package.json': JSON.stringify({
            name: 'whisp-app',
            version: '1.0.0',
            dependencies: {
              'react': '^18.2.0',
              'react-dom': '^18.2.0'
            },
            devDependencies: {
              '@types/react': '^18.0.0',
              '@types/react-dom': '^18.0.0',
              'typescript': '^5.0.0'
            }
          }, null, 2),
          'index.html': '<!DOCTYPE html><html><head></head><body><div id="root"></div><script type="module" src="/src/main.tsx"></script></body></html>',
          'src/main.tsx': `import React from 'react';\nimport ReactDOM from 'react-dom/client';\nimport App from './App';\n\nReactDOM.createRoot(document.getElementById('root')!).render(<App />);`,
          'src/App.tsx': projectFiles['App.tsx'] || '',
          'src/styles.css': projectFiles['styles.css'] || '',
          'vite.config.ts': `import { defineConfig } from 'vite';\nimport react from '@vitejs/plugin-react';\n\nexport default defineConfig({ plugins: [react()] });`,
          'tsconfig.json': JSON.stringify({
            compilerOptions: {
              target: 'ES2020',
              lib: ['ES2020', 'DOM'],
              jsx: 'react-jsx',
              module: 'ESNext',
              moduleResolution: 'bundler',
              strict: true
            }
          }, null, 2)
        }
      };
    }
    
    console.log('📦 StackBlitz project type:', project.template);
    
    // Embed in container
    if (stackblitzRef.current) {
      try {
        console.log('🚀 Embedding StackBlitz...');
        await sdk.embedProject(
          stackblitzRef.current,
          project,
          {
            openFile: hasReact ? 'src/App.tsx' : 'index.html',
            view: 'preview',
            height: '100%',
            hideNavigation: true
          }
        );
        console.log('✅ StackBlitz embedded!');
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
  
  const handleStopGeneration = () => {
    console.log('🛑 Stopping generation...');
    setGenerationCancelled(true);
    setIsGenerating(false);
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
            
            {chatMessages.map((msg) => (
              <div key={msg.id || `msg-${Date.now()}-${Math.random()}`} className={`chat-message ${msg.role}`}>
                <div className="message-avatar">
                  {msg.role === 'user' ? '👤' : 
                   msg.role === 'error' ? '⚠️' : 
                   msg.role === 'step' ? (msg.isLoading ? '⏳' : '✓') : '✦'}
                </div>
                <div className="message-content">
                  {msg.role === 'assistant' ? (
                    /* Render summary with proper formatting */
                    <div className="assistant-summary">
                      {msg.content.split('\n').map((line, i) => (
                        <div key={i}>
                          {line.startsWith('## ') ? (
                            <h3 className="summary-header">{line.replace('## ', '')}</h3>
                          ) : line.startsWith('- ') ? (
                            <div className="summary-bullet">• {line.replace('- ', '')}</div>
                          ) : line ? (
                            <div className="summary-text">{line}</div>
                          ) : <div style={{ height: '8px' }} />}
                        </div>
                      ))}
                    </div>
                  ) : (
                    msg.content
                  )}
                </div>
              </div>
            ))}
            
            {/* Preview Button - Below last message if available */}
            {chatMessages.some(m => m.showPreviewButton) && generatedFiles.length > 0 && (
              <div style={{ padding: '0 48px 8px 48px' }}>
                <button className="preview-btn" onClick={() => renderPreview(generatedFiles)}>
                  Preview
                </button>
              </div>
            )}
            
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
            
            <button 
              className="pill-button" 
              onClick={isGenerating ? handleStopGeneration : handleVoiceInput}
              disabled={isTranscribing}
            >
              {isGenerating ? <Square size={20} fill="currentColor" /> : <ArrowUp size={20} />}
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
