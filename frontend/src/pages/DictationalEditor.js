import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useTheme } from '@/contexts/ThemeContext';
import { Sun, Moon, Plus, Mic, X, ArrowUp, Eye, Square, Copy, Check, Download, RefreshCw, ExternalLink, Share2 } from 'lucide-react';
import AudioVisualizer from '../components/AudioVisualizer';
import Editor from '@monaco-editor/react';
import sdk from '@stackblitz/sdk';
import axios from 'axios';
import JSZip from 'jszip';
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
  const [isShareModalOpen, setIsShareModalOpen] = useState(false);
  const [shareUrl, setShareUrl] = useState('');
  const [linkCopied, setLinkCopied] = useState(false);
  const [attachedImages, setAttachedImages] = useState([]);
  
  const phrases = ['build', 'imagine', 'create', 'design'];
  
  const iframeRef = useRef(null);
  const stackblitzRef = useRef(null);
  const chatEndRef = useRef(null);
  const hasInitialized = useRef(false);
  const fileInputRef = useRef(null);
  
  useEffect(() => {
    // Prevent double initialization from React StrictMode
    if (hasInitialized.current) return;
    hasInitialized.current = true;
    
    // Handle initial audio and images if coming from dictational page
    const audioBlob = location.state?.audioBlob;
    const testPrompt = location.state?.testPrompt;
    const initialImages = location.state?.attachedImages || [];
    
    console.log('🎬 DictationalEditor mounted');
    console.log('📦 Location state:', location.state);
    console.log('🎤 Audio blob:', audioBlob);
    console.log('📝 Test prompt:', testPrompt);
    console.log('📸 Attached images:', initialImages.length);
    
    // Set initial attached images
    if (initialImages.length > 0) {
      setAttachedImages(initialImages);
    }
    
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
      
      // Add error message to EXISTING chat (don't replace)
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
        attached_images: attachedImages,
        conversation_history: chatMessages.map(m => ({
          role: m.role === 'user' ? 'user' : 'assistant',
          content: m.content
        }))
      });
      
      console.log('📥 Response received:', response.data);
      
      // Clear attached images after sending
      setAttachedImages([]);
      
      // Remove "Thinking..." message
      setChatMessages(prev => prev.filter(m => m.id !== thinkingId));
      
      if (response.data.success && !generationCancelled) {
        const result = response.data.result;
        const steps = result.steps || [];
        const summary = result.summary || 'Great! I\'ve updated your app with the changes you requested.';
        
        // Parse summary to extract intro and features/conclusion
        const summaryLines = summary.split('\n');
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
        
        // Fallback if no proper summary structure
        if (!intro.trim() && !featuresAndConclusion.trim() && summary) {
          intro = summary;
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
        if (steps.length > 0) {
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
        
        // Explicitly refresh preview to show new changes
        if (result.files && result.files.length > 0 && !previewCollapsed) {
          console.log('🔄 Auto-refreshing preview with new code');
          // Ensure we're in preview mode, not code mode
          setShowPreview(true);
          setShowCode(false);
          await renderPreview(result.files);
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
        // If VM exists, update files instead of re-embedding
        if (window.stackblitzVM) {
          console.log('🔄 Updating existing StackBlitz files...');
          
          // Update each file in the existing project
          for (const [path, content] of Object.entries(projectFiles)) {
            console.log(`📝 Updating file: ${path}`);
            await window.stackblitzVM.applyFsDiff({
              create: {
                [path]: content
              },
              destroy: []
            });
          }
          
          console.log('✅ Files updated! StackBlitz will auto-refresh.');
          return;
        }
        
        // First time - embed the project
        console.log('🚀 Embedding StackBlitz in preview mode');
        const vm = await sdk.embedProject(
          stackblitzRef.current,
          project,
          {
            openFile: hasViteConfig ? 'src/App.tsx' : 'index.html',
            view: 'preview',  // Always preview mode
            height: '100%',
            hideNavigation: true,
            terminalHeight: 0
          }
        );
        
        // Store VM reference for file updates
        window.stackblitzVM = vm;
        console.log('✅ StackBlitz embedded!');
      } catch (error) {
        console.error('❌ StackBlitz error:', error);
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
  
  const handleExportCode = async () => {
    if (generatedFiles.length === 0) return;
    
    try {
      // Create a new ZIP file
      const zip = new JSZip();
      
      // Add all generated files to the ZIP
      generatedFiles.forEach(file => {
        zip.file(file.path, file.content);
      });
      
      // Generate the ZIP file
      const content = await zip.generateAsync({ type: 'blob' });
      
      // Download the ZIP
      const url = URL.createObjectURL(content);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'whisp-app.zip';
      a.click();
      URL.revokeObjectURL(url);
      
      console.log('✅ ZIP file exported successfully');
    } catch (error) {
      console.error('❌ Export failed:', error);
    }
  };
  
  const handleReloadPreview = async () => {
    if (generatedFiles.length === 0 || !window.stackblitzVM) return;
    
    console.log('🔄 Reloading preview...');
    
    // Clear and re-embed to force fresh reload
    stackblitzRef.current.innerHTML = '';
    window.stackblitzVM = null;
    
    // Small delay
    await new Promise(resolve => setTimeout(resolve, 100));
    
    // Re-embed
    await renderPreview(generatedFiles);
    
    console.log('✅ Preview reloaded');
  };
  
  const handleOpenInNewTab = () => {
    if (!generatedFiles.length) return;
    
    // Create a blob URL from the main HTML file
    const htmlFile = generatedFiles.find(f => f.path === 'index.html') || generatedFiles[0];
    const blob = new Blob([htmlFile.content], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    
    // Open in new tab
    window.open(url, '_blank');
    
    console.log('🔗 Opened preview in new tab');
    
    // Clean up after a delay
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  
  const handleShare = () => {
    if (!generatedFiles.length) return;
    
    // Create a blob URL for sharing
    const htmlFile = generatedFiles.find(f => f.path === 'index.html') || generatedFiles[0];
    const blob = new Blob([htmlFile.content], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    
    setShareUrl(url);
    setIsShareModalOpen(true);
    setLinkCopied(false);
    
    console.log('📤 Share modal opened');
  };
  
  const handleCopyShareLink = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setLinkCopied(true);
      setTimeout(() => setLinkCopied(false), 2000);
      console.log('✅ Link copied to clipboard');
    } catch (error) {
      console.error('❌ Copy failed:', error);
    }
  };
  
  const handleCloseShareModal = () => {
    setIsShareModalOpen(false);
    // Clean up blob URL
    if (shareUrl) {
      URL.revokeObjectURL(shareUrl);
      setShareUrl('');
    }
  };
  
  const handleAttachImage = () => {
    fileInputRef.current?.click();
  };
  
  const handleFileSelect = async (e) => {
    const files = Array.from(e.target.files);
    const imageFiles = files.filter(file => file.type.startsWith('image/'));
    
    if (imageFiles.length === 0) {
      alert('Please select image files only');
      return;
    }
    
    // Convert images to base64
    const imagePromises = imageFiles.map(file => {
      return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => {
          resolve({
            name: file.name,
            data: e.target.result,
            type: file.type
          });
        };
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });
    });
    
    try {
      const images = await Promise.all(imagePromises);
      setAttachedImages(prev => [...prev, ...images]);
      console.log('✅ Images attached:', images.length);
      
      // Clear file input
      e.target.value = '';
    } catch (error) {
      console.error('❌ Image upload failed:', error);
      alert('Failed to upload images. Please try again.');
    }
  };
  
  const handleRemoveImage = (index) => {
    setAttachedImages(prev => prev.filter((_, i) => i !== index));
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
            onClick={() => setPreviewCollapsed(false)}
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
            {/* Hidden file input */}
            <input 
              ref={fileInputRef}
              type="file"
              accept="image/*"
              multiple
              onChange={handleFileSelect}
              style={{ display: 'none' }}
            />
            
            <button className="pill-button" onClick={handleAttachImage} title="Attach images">
              <Plus size={20} />
            </button>
            
            {/* Tiny attached images inside pill bar */}
            {attachedImages.length > 0 && (
              <div className="tiny-images-inline-editor">
                {attachedImages.map((img, index) => (
                  <div key={index} className="tiny-image-editor">
                    <img src={img.data} alt={img.name} />
                    <button 
                      className="tiny-remove-btn-editor" 
                      onClick={(e) => {
                        e.stopPropagation();
                        handleRemoveImage(index);
                      }}
                    >
                      <X size={10} />
                    </button>
                  </div>
                ))}
              </div>
            )}
            
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
                <button className="preview-control-btn" onClick={handleShare} title="Share">
                  <Share2 size={16} />
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
      
      {/* Share Modal */}
      {isShareModalOpen && (
        <div className="share-modal-overlay" onClick={handleCloseShareModal}>
          <div className="share-modal" onClick={(e) => e.stopPropagation()}>
            <button className="share-modal-close" onClick={handleCloseShareModal}>
              <X size={20} />
            </button>
            
            <div className="share-modal-image">
              <img 
                src="https://customer-assets.emergentagent.com/job_b4891fc0-0141-4191-9e12-b5b08cb6a810/artifacts/o6bugclp_u3752894846_a_staircase_in_a_flowery_area_and_greenery_area_w_f9ef8c9b-7271-46c6-8d9b-e37dd397080a_2.png" 
                alt="Share"
                className="share-image"
              />
            </div>
            
            <div className="share-modal-content">
              <h2 className="share-modal-title">
                Share to the <em>world</em>
              </h2>
              
              <div className="share-link-container">
                <input 
                  type="text" 
                  value={shareUrl} 
                  readOnly 
                  className="share-link-input"
                />
              </div>
              
              <button 
                className="share-copy-btn" 
                onClick={handleCopyShareLink}
              >
                {linkCopied ? (
                  <>
                    <Check size={18} />
                    <span>Link Copied!</span>
                  </>
                ) : (
                  <>
                    <Copy size={18} />
                    <span>Copy Link</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default DictationalEditor;
