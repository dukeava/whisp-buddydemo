import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useTheme } from '@/contexts/ThemeContext';
import { Sun, Moon, Plus, Mic, X, ArrowUp, Eye, Square, Download, RefreshCw, ExternalLink, Share2, MicOff } from 'lucide-react';
import RealtimeAudioChat from '@/services/RealtimeAudioChat';
import AudioVisualizer from '../components/AudioVisualizer';
import sdk from '@stackblitz/sdk';
import axios from 'axios';
import JSZip from 'jszip';
import '../styles/ConversationalEditor.css';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const ConversationalEditor = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { theme, toggleTheme } = useTheme();
  
  const [isVoiceConnected, setIsVoiceConnected] = useState(false);
  const [isWhispTalking, setIsWhispTalking] = useState(false);
  const [isUserSpeaking, setIsUserSpeaking] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedFiles, setGeneratedFiles] = useState([]);
  const [currentAppCode, setCurrentAppCode] = useState('');
  const [showPreview, setShowPreview] = useState(true);
  const [previewCollapsed, setPreviewCollapsed] = useState(false);
  const [sessionId] = useState(() => `session-${Date.now()}`);
  const [isShareModalOpen, setIsShareModalOpen] = useState(false);
  const [shareUrl, setShareUrl] = useState('');
  const [linkCopied, setLinkCopied] = useState(false);
  const [attachedImages, setAttachedImages] = useState([]);
  const [conversationHistory, setConversationHistory] = useState(location.state?.conversationHistory || []);
  const [hasGreeted, setHasGreeted] = useState(false);
  const [typedText, setTypedText] = useState('');
  const [phraseIndex, setPhraseIndex] = useState(0);
  const [isDeleting, setIsDeleting] = useState(false);
  
  const phrases = ['build', 'imagine', 'create', 'design'];
  
  const stackblitzRef = useRef(null);
  const fileInputRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const hasInitialized = useRef(false);
  
  // Typing effect
  useEffect(() => {
    if (isVoiceConnected) return; // Stop typing when voice active
    
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
  }, [typedText, isDeleting, phraseIndex, isVoiceConnected]);
  
  useEffect(() => {
    // Prevent double initialization from React StrictMode
    if (hasInitialized.current) return;
    hasInitialized.current = true;
    
    const audioBlob = location.state?.audioBlob;
    const initialImages = location.state?.attachedFiles || [];
    
    console.log('🎬 ConversationalEditor mounted');
    console.log('📦 Location state:', location.state);
    console.log('🎤 Audio blob:', audioBlob);
    
    // Set attached images
    if (initialImages.length > 0) {
      setAttachedImages(initialImages.filter(f => f.type?.startsWith('image/')).map(f => ({
        name: f.name,
        data: f.preview || URL.createObjectURL(f),
        type: f.type
      })));
    }
    
    // If we have audio from landing page, transcribe and generate
    if (audioBlob) {
      console.log('✅ Audio blob found, starting generation');
      handleGenerateFromAudio(audioBlob);
    }
  }, []);
  
  const initializeVoice = async () => {
    try {
      console.log('✅ Voice ready for use (Whisper + GPT-4o + ElevenLabs)');
      setIsVoiceConnected(true);
    } catch (error) {
      console.error('❌ Voice initialization failed:', error);
    }
  };
  
  const handleVoiceChat = async (audioBlob) => {
    try {
      // Transcribe with Whisper
      const formData = new FormData();
      formData.append('file', audioBlob, 'audio.webm');
      
      const transcribeResponse = await axios.post(`${API}/dictational/transcribe`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      
      if (!transcribeResponse.data.success) {
        throw new Error('Transcription failed');
      }
      
      const userText = transcribeResponse.data.text;
      console.log('📝 User said:', userText);
      
      // Add to conversation history
      setConversationHistory(prev => [...prev, { role: 'user', content: userText }]);
      
      // Get GPT-4o response
      const chatResponse = await axios.post(`${API}/conversational/chat`, {
        message: userText,
        session_id: sessionId,
        conversation_history: conversationHistory
      });
      
      if (chatResponse.data.success) {
        const aiResponse = chatResponse.data.response;
        console.log('🤖 Whisp says:', aiResponse);
        
        // Add to conversation history
        setConversationHistory(prev => [...prev, { role: 'assistant', content: aiResponse }]);
        
        // Speak with ElevenLabs
        setIsWhispTalking(true);
        await speakWithElevenLabs(aiResponse);
        setIsWhispTalking(false);
      }
      
    } catch (error) {
      console.error('❌ Voice chat error:', error);
      setIsWhispTalking(true);
      await speakWithElevenLabs("Hmm, I didn't quite catch that. Uhh, can you say that again?");
      setIsWhispTalking(false);
    }
  };
  
  const speakWithElevenLabs = async (text) => {
    try {
      const response = await axios.post(`${API}/elevenlabs/tts`, {
        text: text
      });
      
      if (response.data.success && response.data.audio) {
        // Decode base64 to binary
        const binaryString = atob(response.data.audio);
        const bytes = new Uint8Array(binaryString.length);
        for (let i = 0; i < binaryString.length; i++) {
          bytes[i] = binaryString.charCodeAt(i);
        }
        
        // Create blob and play
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
  }, [generatedFiles, previewCollapsed]);
  
  const handleGenerateFromAudio = async (audioBlob) => {
    console.log('🚀 Starting generation from audio');
    setIsGenerating(true);
    
    try {
      // 1. Transcribe audio to get full prompt
      const formData = new FormData();
      formData.append('file', audioBlob, 'audio.webm');
      
      const transcribeResponse = await axios.post(`${API}/dictational/transcribe`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      
      if (!transcribeResponse.data.success) {
        throw new Error('Transcription failed');
      }
      
      const prompt = transcribeResponse.data.text;
      console.log('📝 Full prompt:', prompt);
      
      // 2. Generate code
      const response = await axios.post(`${API}/conversational/generate`, {
        prompt: prompt,
        session_id: sessionId,
        previous_code: currentAppCode || null,
        attached_images: attachedImages,
        conversation_history: []
      });
      
      console.log('📥 Response received:', response.data);
      
      // Clear attached images
      setAttachedImages([]);
      
      if (response.data.success) {
        const result = response.data.result;
        
        setGeneratedFiles(result.files || []);
        
        // Store code
        const htmlFile = result.files?.find(f => f.path === 'index.html');
        if (htmlFile) {
          setCurrentAppCode(htmlFile.content);
        }
        
        // Refresh preview
        if (result.files && result.files.length > 0 && !previewCollapsed) {
          console.log('🔄 Auto-refreshing preview');
          setShowPreview(true);
          await renderPreview(result.files);
        }
        
        // Speak conversational summary
        if (result.summary) {
          setTimeout(async () => {
            setIsWhispTalking(true);
            await speakWithElevenLabs(result.summary);
            setIsWhispTalking(false);
          }, 1000);
        }
        
        setIsGenerating(false);
      }
      
    } catch (error) {
      console.error('❌ Generation error:', error);
      setIsGenerating(false);
      
      setIsWhispTalking(true);
      await speakWithElevenLabs("Hmm, something went wrong. Uhh, wanna try again?");
      setIsWhispTalking(false);
    }
  };
  
  const handleGenerateFromConversation = async () => {
    console.log('🚀 Starting code generation from conversation');
    setIsGenerating(true);
    
    // Build prompt from conversation history
    const conversationText = conversationHistory
      .map(msg => `${msg.role}: ${msg.content}`)
      .join('\n');
    
    console.log('💬 Conversation:', conversationText);
    
    try {
      console.log('📡 Calling API:', `${API}/conversational/generate`);
      
      const response = await axios.post(`${API}/conversational/generate`, {
        prompt: conversationText,
        session_id: sessionId,
        previous_code: currentAppCode || null,
        attached_images: attachedImages,
        conversation_history: conversationHistory
      });
      
      console.log('📥 Response received:', response.data);
      
      // Clear attached images after sending
      setAttachedImages([]);
      
      if (response.data.success) {
        const result = response.data.result;
        
        setGeneratedFiles(result.files || []);
        
        // Store current app code for future iterations
        const htmlFile = result.files?.find(f => f.path === 'index.html');
        if (htmlFile) {
          setCurrentAppCode(htmlFile.content);
        }
        
        // Refresh preview
        if (result.files && result.files.length > 0 && !previewCollapsed) {
          console.log('🔄 Auto-refreshing preview with new code');
          setShowPreview(true);
          await renderPreview(result.files);
        }
        
        // Speak summary after generation
        if (result.summary) {
          setTimeout(async () => {
            setIsWhispTalking(true);
            await speakWithElevenLabs(result.summary);
            setIsWhispTalking(false);
          }, 1000);
        }
        
        setIsGenerating(false);
      }
      
    } catch (error) {
      console.error('❌ Generation error:', error);
      setIsGenerating(false);
      
      setIsWhispTalking(true);
      await speakWithElevenLabs("Hmm, something went wrong with generating that. Uhh, wanna try again?");
      setIsWhispTalking(false);
    }
  };
  
  const toggleVoice = async () => {
    if (!isVoiceConnected) {
      // First click - initialize and greet
      setIsUserSpeaking(true); // Show visualizer immediately
      await initializeVoice();
      
      // Greet with ElevenLabs
      setTimeout(async () => {
        setIsWhispTalking(true);
        await speakWithElevenLabs("Hey! Umm, are you looking to change anything?");
        setIsWhispTalking(false);
        setHasGreeted(true);
        
        // Start recording after greeting
        startRecording();
      }, 500);
    } else {
      // X button - Stop recording and disconnect
      stopRecording();
      setIsUserSpeaking(false);
      setIsWhispTalking(false);
      setIsVoiceConnected(false);
    }
  };
  
  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      const audioChunks = [];
      
      mediaRecorder.ondataavailable = (event) => {
        audioChunks.push(event.data);
      };
      
      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(audioChunks, { type: 'audio/webm' });
        stream.getTracks().forEach(track => track.stop());
        
        // Process the audio
        if (audioBlob.size > 0) {
          await handleVoiceChat(audioBlob);
        }
        
        // Restart recording if still connected
        if (isVoiceConnected) {
          setTimeout(() => startRecording(), 100);
        }
      };
      
      window.convEditorRecorder = mediaRecorder;
      window.convEditorStream = stream;
      
      mediaRecorder.start();
      
      // Auto-stop after 10 seconds to process
      setTimeout(() => {
        if (mediaRecorder.state === 'recording') {
          mediaRecorder.stop();
        }
      }, 10000);
      
    } catch (error) {
      console.error('❌ Recording error:', error);
    }
  };
  
  const stopRecording = () => {
    if (window.convEditorRecorder && window.convEditorRecorder.state === 'recording') {
      window.convEditorRecorder.stop();
    }
    if (window.convEditorStream) {
      window.convEditorStream.getTracks().forEach(track => track.stop());
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
    <div className={`conversational-editor ${theme}`}>
      {/* Header */}
      <header className="conv-editor-header">
        <div className="header-left">
          <button className="logo-btn" onClick={() => navigate('/')}>
            <span>Whisp</span>
          </button>
          <span className="mode-badge">Conversational</span>
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
      <div className="conv-editor-content">
        {/* Left Panel - Sphere */}
        <div className="sphere-panel-conv">
          <div className="sphere-container-conv">
            <div 
              className={`sphere-conv ${
                isWhispTalking ? 'talking' : 
                isUserSpeaking ? 'listening' : 
                isGenerating ? 'generating' : ''
              }`}
            >
              <div className="sphere-glow-conv"></div>
            </div>
            
            {isGenerating && (
              <p className="sphere-status">Building your app...</p>
            )}
            {isWhispTalking && (
              <p className="sphere-status">Speaking...</p>
            )}
          </div>
          
          {/* Bottom Pill Bar */}
          <div className="voice-pill-bar">
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
            
            {isVoiceConnected ? (
              <div className="pill-input-area">
                <AudioVisualizer isActive={isUserSpeaking || isWhispTalking} isDark={theme === 'dark'} />
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
              onClick={toggleVoice}
              disabled={isGenerating}
            >
              {isVoiceConnected ? <X size={20} /> : <Mic size={20} />}
            </button>
            
            <button 
              className="pill-button" 
              onClick={handleGenerateFromConversation}
              disabled={!isVoiceConnected || isGenerating}
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

export default ConversationalEditor;
