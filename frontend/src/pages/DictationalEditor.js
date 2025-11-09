import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useTheme } from '@/contexts/ThemeContext';
import { Sun, Moon, Plus, Mic, X, ArrowUp, Code, Eye, Square, Copy, Check, Download, RefreshCw, ExternalLink } from 'lucide-react';
import AudioVisualizer from '../components/AudioVisualizer';
import Editor from '@monaco-editor/react';
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
  const [currentAppCode, setCurrentAppCode] = useState('');
  const [previewContent, setPreviewContent] = useState('');
  const [showCode, setShowCode] = useState(false);
  const [showPreview, setShowPreview] = useState(true);
  const [previewCollapsed, setPreviewCollapsed] = useState(false);
  const [sessionId] = useState(() => `session-${Date.now()}`);
  const [generationCancelled, setGenerationCancelled] = useState(false);
  const [copiedMessageId, setCopiedMessageId] = useState(null);
  const [typedText, setTypedText] = useState('');
  const [phraseIndex, setPhraseIndex] = useState(0);
  const [isDeleting, setIsDeleting] = useState(false);
  const [selectedFile, setSelectedFile] = useState(0);
  
  const phrases = ['build', 'imagine', 'create', 'design'];
  
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
      // Add user message to EXISTING chat (don't replace)
      setChatMessages(prev => [...prev, {
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
  
  // Typing effect for pill bar
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
  
  useEffect(() => {
    // Auto-reload preview when app code updates
    if (currentAppCode && generatedFiles.length > 0 && !previewCollapsed) {
      console.log('🔄 App code changed - reloading preview');
      renderPreview(generatedFiles);
    }
  }, [currentAppCode]);
  
  useEffect(() => {
    // Render/reload preview when files are generated or updated
    if (generatedFiles.length > 0 && !previewCollapsed) {
      console.log('🎯 useEffect triggered - rendering/reloading preview');
      renderPreview(generatedFiles);
    }
  }, [generatedFiles, showCode, previewCollapsed]);
  
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
        
        // ADD user message to EXISTING chat (don't replace)
        setChatMessages(prev => [...prev, {
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
        session_id: sessionId,
        previous_code: currentAppCode || null,
        conversation_history: chatMessages.map(m => ({
          role: m.role === 'user' ? 'user' : 'assistant',
          content: m.content
        }))
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
        
        console.log('✅ Generation complete with steps:', steps);
        console.log('📊 Steps array:', steps);
        console.log('📊 Steps length:', steps.length);
        
        // Add step messages one by one with loading animation
        for (let i = 0; i < steps.length; i++) {
          if (generationCancelled) break;
          
          const stepId = `step-${Date.now()}-${i}`;
          
          console.log(`➕ Adding step ${i + 1}/${steps.length}: ${steps[i]}`);
          
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
          
          console.log(`✅ Completing step ${i + 1}: ${steps[i]}`);
          
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
        
        // Store current app code for future iterations
        const htmlFile = result.files?.find(f => f.path === 'index.html');
        if (htmlFile) {
          setCurrentAppCode(htmlFile.content);
        }
        
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
    console.log('🖼️ Rendering preview, files:', files);
    
    if (!files || files.length === 0) return;
    
    const projectFiles = {};
    files.forEach(file => {
      projectFiles[file.path] = file.content;
    });
    
    console.log('📁 Files:', Object.keys(projectFiles));
    
    const hasPackageJson = projectFiles['package.json'];
    const hasViteConfig = projectFiles['vite.config.ts'];
    
    let project;
    
    if (hasPackageJson && hasViteConfig) {
      console.log('🚀 Vite React project - using create-react-app template');
      project = {
        title: 'Whisp App',
        template: 'create-react-app',  // ✅ Supported React template
        files: projectFiles
      };
    } else {
      console.log('📄 HTML project');
      project = {
        title: 'Whisp App',
        template: 'html',
        files: projectFiles
      };
    }
    
    if (stackblitzRef.current) {
      try {
        const vm = await sdk.embedProject(
          stackblitzRef.current,
          project,
          {
            openFile: hasViteConfig ? 'src/App.tsx' : 'index.html',
            view: showCode ? 'editor' : 'preview',
            height: '100%',
            hideNavigation: true,
            terminalHeight: 0
          }
        );
        
        // Store VM reference for reloading
        window.stackblitzVM = vm;
        console.log('✅ StackBlitz embedded!');
      } catch (error) {
        console.error('❌ StackBlitz error:', error);
      }
    }
  };
  
  const handleReloadPreview = () => {
    if (window.stackblitzVM) {
      window.stackblitzVM.editor.openFile('index.html');
      console.log('🔄 Preview reloaded');
    }
  };
  
  const handleOpenInNewTab = () => {
    if (window.stackblitzVM) {
      // StackBlitz provides a URL we can open
      const previewUrl = window.stackblitzVM.url || stackblitzRef.current?.src;
      if (previewUrl) {
        window.open(previewUrl, '_blank');
      }
    }
  };
  
  const handleVoiceInput = async () => {
    if (!isRecording) {
      // Start recording
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        const mediaRecorder = new MediaRecorder(stream);
        const audioChunks = [];
        
        mediaRecorder.ondataavailable = (event) => {
          audioChunks.push(event.data);
        };
        
        // Store for later use
        window.dictationalEditorRecorder = mediaRecorder;
        window.dictationalEditorAudioChunks = audioChunks;
        window.dictationalEditorStream = stream;
        
        mediaRecorder.start();
        setIsRecording(true);
      } catch (error) {
        console.error('Microphone error:', error);
        alert('Microphone access required');
      }
    } else {
      // X button - Cancel recording, don't submit
      console.log('❌ Canceling recording...');
      if (window.dictationalEditorRecorder) {
        window.dictationalEditorRecorder.stop();
        window.dictationalEditorRecorder = null;
      }
      if (window.dictationalEditorStream) {
        window.dictationalEditorStream.getTracks().forEach(track => track.stop());
        window.dictationalEditorStream = null;
      }
      window.dictationalEditorAudioChunks = [];
      setIsRecording(false);
    }
  };
  
  const handleSubmitVoice = async () => {
    if (isRecording) {
      // Stop recording and submit (DON'T navigate, stay in editor)
      console.log('✅ Stopping recording and submitting...');
      
      return new Promise((resolve) => {
        if (window.dictationalEditorRecorder) {
          window.dictationalEditorRecorder.addEventListener('stop', async () => {
            const audioChunks = window.dictationalEditorAudioChunks || [];
            if (audioChunks.length > 0) {
              const audioBlob = new Blob(audioChunks, { type: 'audio/webm' });
              
              // Stop stream
              if (window.dictationalEditorStream) {
                window.dictationalEditorStream.getTracks().forEach(track => track.stop());
                window.dictationalEditorStream = null;
              }
              
              // Transcribe and generate (adds to existing chat)
              await handleAudioTranscription(audioBlob);
            }
            resolve();
          }, { once: true });
          
          window.dictationalEditorRecorder.stop();
          setIsRecording(false);
        }
      });
    }
  };
  
  const handleStopGeneration = () => {
    console.log('🛑 Stopping generation...');
    setGenerationCancelled(true);
    setIsGenerating(false);
  };
  
  const handleCopyResponse = async (messageId, content) => {
    try {
      await navigator.clipboard.writeText(content);
      setCopiedMessageId(messageId);
      setTimeout(() => setCopiedMessageId(null), 2000);
    } catch (error) {
      console.error('Copy failed:', error);
    }
  };
  
  const handleExportCode = () => {
    if (generatedFiles.length === 0) return;
    
    const mainFile = generatedFiles[0];
    const blob = new Blob([mainFile.content], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = mainFile.path;
    a.click();
    URL.revokeObjectURL(url);
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
            onClick={() => {
              console.log('Code button clicked');
              setShowCode(true);
              setShowPreview(false);
              if (generatedFiles.length > 0) renderPreview(generatedFiles);
            }}
            disabled={!generatedFiles.length}
          >
            <Code size={18} />
            <span>Code</span>
          </button>
          <button 
            className="header-btn"
            onClick={() => {
              console.log('Preview button clicked');
              setShowCode(false);
              setShowPreview(true);
              setPreviewCollapsed(false);
              if (generatedFiles.length > 0) renderPreview(generatedFiles);
            }}
            disabled={!generatedFiles.length}
          >
            <Eye size={18} />
            <span>Preview</span>
          </button>
          <button 
            className="header-btn"
            onClick={handleExportCode}
            disabled={!generatedFiles.length}
          >
            <Download size={18} />
            <span>Export</span>
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
                {msg.role !== 'thinking' && (
                  <div className="message-avatar">
                    {msg.role === 'user' ? '👤' : 
                     msg.role === 'error' ? '⚠️' : 
                     msg.role === 'step' ? (msg.isLoading ? <div className="loading-spinner-small"></div> : '✓') : '✦'}
                  </div>
                )}
                <div className="message-content" style={msg.role === 'thinking' ? { paddingLeft: 0 } : {}}>
                  {msg.role === 'thinking' ? (
                    <div className="thinking-shimmer">{msg.content}</div>
                  ) : msg.role === 'assistant' ? (
                    <>
                      {/* Render summary with proper formatting */}
                      <div className="assistant-summary">
                        {msg.content.replace(/\*\*/g, '').split('\n').map((line, i) => (
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
                      {/* Copy button */}
                      <button 
                        className="copy-btn" 
                        onClick={() => handleCopyResponse(msg.id, msg.content)}
                      >
                        {copiedMessageId === msg.id ? <Check size={16} /> : <Copy size={16} />}
                        {copiedMessageId === msg.id ? 'Copied!' : 'Copy'}
                      </button>
                    </>
                  ) : (
                    msg.content
                  )}
                </div>
              </div>
            ))}
            
            {/* Preview Button - Below last message if available */}
            {chatMessages.some(m => m.showPreviewButton) && generatedFiles.length > 0 && (
              <div style={{ padding: '0 48px 8px 48px', display: 'flex', gap: '12px' }}>
                <button className="preview-btn" onClick={() => renderPreview(generatedFiles)}>
                  <Eye size={18} />
                  Preview
                </button>
                <button className="export-btn" onClick={handleExportCode}>
                  <Download size={18} />
                  Export
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
                <AudioVisualizer isActive={isRecording} isDark={theme === 'dark'} />
              </div>
            ) : (
              <div className="pill-input-area">
                <span className="pill-placeholder">
                  Continue speaking to {typedText}<span className="cursor">|</span>
                </span>
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
              onClick={isGenerating ? handleStopGeneration : handleSubmitVoice}
              disabled={isTranscribing || (!isRecording && !isGenerating)}
            >
              {isGenerating ? <Square size={20} fill="currentColor" /> : <ArrowUp size={20} />}
            </button>
          </div>
        </div>
        
        {/* Right Panel - Preview */}
        <div className="preview-panel-dict">
          <div className="preview-header-dict">
            <span>Preview</span>
            {!previewCollapsed && generatedFiles.length > 0 && (
              <div className="preview-controls">
                <button className="preview-control-btn" onClick={handleReloadPreview} title="Reload">
                  <RefreshCw size={16} />
                </button>
                <button className="preview-control-btn" onClick={handleOpenInNewTab} title="Open in new tab">
                  <ExternalLink size={16} />
                </button>
                <button className="preview-control-btn" onClick={() => setPreviewCollapsed(true)} title="Collapse">
                  <X size={16} />
                </button>
              </div>
            )}
          </div>
          
          <div className="preview-content-dict">
            {previewCollapsed ? (
              <div className="preview-collapsed">
                <button className="preview-btn" onClick={() => setPreviewCollapsed(false)}>
                  <Eye size={18} />
                  Show Preview
                </button>
              </div>
            ) : isGenerating ? (
              <div className="preview-loading-dict">
                <div className="loading-spinner">✦</div>
                <p>Building your app...</p>
              </div>
            ) : generatedFiles.length > 0 ? (
              <div 
                ref={stackblitzRef}
                className="stackblitz-preview"
                style={{ width: '100%', height: '100%' }}
              />
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
