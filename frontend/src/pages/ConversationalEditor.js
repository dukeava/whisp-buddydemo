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
  
  const stackblitzRef = useRef(null);
  const fileInputRef = useRef(null);
  const realtimeChatRef = useRef(null);
  const hasInitialized = useRef(false);
  
  useEffect(() => {
    // Prevent double initialization from React StrictMode
    if (hasInitialized.current) return;
    hasInitialized.current = true;
    
    console.log('🎬 ConversationalEditor mounted');
    console.log('📦 Location state:', location.state);
    console.log('💬 Conversation history:', conversationHistory.length);
    
    // Initialize voice
    initializeVoice();
    
    // If we have conversation history from landing page, generate immediately
    if (conversationHistory.length > 0) {
      console.log('✅ Conversation history found, generating app');
      setTimeout(() => {
        handleGenerateFromConversation();
      }, 1500);
    }
  }, []);
  
  const initializeVoice = async () => {
    try {
      realtimeChatRef.current = new RealtimeAudioChat();
      
      realtimeChatRef.current.onTranscript = (transcript, role) => {
        console.log(`📝 ${role}: ${transcript}`);
        setConversationHistory(prev => [...prev, { role, content: transcript }]);
      };
      
      realtimeChatRef.current.onSpeakingStateChange = (state) => {
        console.log('🗣️ Speaking state:', state);
        if (state === 'user_speaking') {
          setIsUserSpeaking(true);
        } else if (state === 'user_stopped') {
          setIsUserSpeaking(false);
        } else if (state === 'assistant_speaking') {
          setIsWhispTalking(true);
        } else if (state === 'assistant_stopped') {
          setIsWhispTalking(false);
        }
      };
      
      await realtimeChatRef.current.init('editor');
      setIsVoiceConnected(true);
      console.log('✅ Voice initialized');
    } catch (error) {
      console.error('❌ Voice initialization failed:', error);
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
  
  const handleGenerateFromConversation = async () => {
    console.log('🚀 Starting code generation from conversation');
    setIsGenerating(true);
    
    // Build prompt from conversation history
    const conversationText = conversationHistory
      .map(msg => `${msg.role}: ${msg.content}`)
      .join('\n');
    
    console.log('💬 Conversation:', conversationText);
    
    try {
      console.log('📡 Calling API:', `${API}/dictational/generate-simple`);
      
      const response = await axios.post(`${API}/dictational/generate-simple`, {
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
        if (result.summary && realtimeChatRef.current) {
          await handleVoiceSummary(result.summary);
        }
        
        setIsGenerating(false);
      }
      
    } catch (error) {
      console.error('❌ Generation error:', error);
      setIsGenerating(false);
      
      if (realtimeChatRef.current) {
        realtimeChatRef.current.playElevenLabsAudio(
          "Hmm, something went wrong with generating that. Uhh, wanna try again?"
        );
      }
    }
  };
  
  const handleVoiceSummary = async (summary) => {
    if (!realtimeChatRef.current) return;
    
    // Extract intro from summary for conversational speaking
    const summaryLines = summary.split('\n');
    let intro = '';
    
    for (const line of summaryLines) {
      if (line.startsWith('## ')) break;
      if (line.trim()) {
        intro += line + ' ';
      }
    }
    
    // Make it conversational
    const conversationalIntro = intro.trim() || 
      "Okay so I built that for you! Umm, check it out and let me know what you think!";
    
    console.log('🗣️ Speaking summary:', conversationalIntro);
    await realtimeChatRef.current.playElevenLabsAudio(conversationalIntro);
  };
  
  const toggleVoice = async () => {
    if (!isVoiceConnected) {
      await initializeVoice();
    } else {
      // Toggle listening
      setIsUserSpeaking(!isUserSpeaking);
      
      // If first time, greet
      if (!hasGreeted && realtimeChatRef.current) {
        setHasGreeted(true);
        await realtimeChatRef.current.playElevenLabsAudio(
          "Hey! Umm, are you looking to change anything?"
        );
      }
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
            
            <div className="pill-spacer"></div>
            
            <button 
              className="pill-button mic-button" 
              onClick={toggleVoice}
              disabled={isGenerating}
            >
              {isVoiceConnected && isUserSpeaking ? <MicOff size={20} /> : <Mic size={20} />}
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
