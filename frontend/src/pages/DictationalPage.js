import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Mic, X, ArrowUp, Settings } from 'lucide-react';
import AudioVisualizer from '../components/AudioVisualizer';
import '../styles/DictationalPage.css';

const DictationalPage = () => {
  const navigate = useNavigate();
  const [typedText, setTypedText] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);
  const [phraseIndex, setPhraseIndex] = useState(0);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [recordedAudio, setRecordedAudio] = useState(null);
  const [attachedImages, setAttachedImages] = useState([]);
  const fileInputRef = React.useRef(null);
  
  const phrases = ['build', 'imagine', 'create', 'design'];

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

  const handleGetStarted = async () => {
    if (!isRecording) {
      // Request microphone access and start recording
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        
        // Start recording
        const mediaRecorder = new MediaRecorder(stream);
        const audioChunks = [];
        
        mediaRecorder.ondataavailable = (event) => {
          audioChunks.push(event.data);
        };
        
        mediaRecorder.onstop = async () => {
          // Create audio blob and store it
          const audioBlob = new Blob(audioChunks, { type: 'audio/webm' });
          setRecordedAudio(audioBlob);
        };
        
        // Store media recorder and stream
        window.dictationalMediaRecorder = mediaRecorder;
        window.dictationalStream = stream;
        window.dictationalAudioChunks = audioChunks;
        
        mediaRecorder.start();
        setIsRecording(true);
      } catch (error) {
        console.error('Microphone access denied:', error);
        alert('Microphone access is required to use voice input');
      }
    } else {
      // X button - just cancel recording, don't save
      if (window.dictationalMediaRecorder) {
        window.dictationalMediaRecorder.stop();
      }
      if (window.dictationalStream) {
        window.dictationalStream.getTracks().forEach(track => track.stop());
        window.dictationalStream = null;
      }
      setIsRecording(false);
      setRecordedAudio(null);
    }
  };

  const handleGoToEditor = async () => {
    console.log('🚀 Arrow clicked - isRecording:', isRecording, 'recordedAudio:', !!recordedAudio);
    
    if (isRecording && window.dictationalMediaRecorder) {
      // Stop recording and navigate
      return new Promise((resolve) => {
        window.dictationalMediaRecorder.addEventListener('stop', () => {
          const audioChunks = window.dictationalAudioChunks || [];
          if (audioChunks.length > 0) {
            const audioBlob = new Blob(audioChunks, { type: 'audio/webm' });
            
            // Stop stream
            if (window.dictationalStream) {
              window.dictationalStream.getTracks().forEach(track => track.stop());
              window.dictationalStream = null;
            }
            
            console.log('✅ Audio saved, navigating to editor');
            navigate('/dictational-editor', { 
              state: { audioBlob, attachedImages }
            });
          }
          resolve();
        }, { once: true });
        
        window.dictationalMediaRecorder.stop();
      });
    } else if (recordedAudio) {
      // Already have audio
      console.log('✅ Using previously recorded audio');
      navigate('/dictational-editor', { 
        state: { audioBlob: recordedAudio, attachedImages }
      });
    } else {
      // No audio - for testing, create a dummy blob with text
      console.log('⚠️ No audio recorded - creating test prompt');
      const testPrompt = "create a simple hello world button app";
      
      // Navigate directly with test text and images
      navigate('/dictational-editor', { 
        state: { testPrompt, attachedImages }
      });
    }
  };

  const handleConversational = () => {
    setIsSettingsOpen(false);
    navigate('/workspace');
  };

  const handleHome = () => {
    setIsSettingsOpen(false);
    navigate('/');
  };

  const handleLogout = () => {
    localStorage.removeItem('whispUser');
    setIsSettingsOpen(false);
    navigate('/');
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
    <div className="dictational-page">
      {/* Background Image */}
      <div className="w-full h-screen relative overflow-hidden">
        <img
          src="https://customer-assets.emergentagent.com/job_whisp-buddy/artifacts/mg36eqvy_u3752894846_an_astronaut_walking_towards_a_doorway_in_a_empty_352c8521-4c4d-44bb-81ff-5b674cfcee58_3.png"
          alt="Astronaut background"
          className="absolute inset-0 w-full h-full object-cover"
          style={{ objectFit: 'cover' }}
        />
      </div>

      {/* Overlay */}
      <div className="hero-overlay" />

      {/* Logo - Top Left */}
      <div className="logo" onClick={() => navigate('/')} style={{ cursor: 'pointer' }}>
        <span>Whisp</span>
        <span className="beta-badge">BETA</span>
      </div>

      {/* Settings Icon - Top Right */}
      <div className="settings-container">
        <button 
          className="settings-toggle"
          onClick={() => setIsSettingsOpen(!isSettingsOpen)}
          aria-label="Settings"
        >
          <Settings size={20} />
        </button>

        {isSettingsOpen && (
          <div className="settings-dropdown">
            <button className="settings-item" onClick={handleConversational}>
              Conversational
            </button>
            <button className="settings-item" onClick={handleHome}>
              Home
            </button>
            <button className="settings-item" onClick={handleLogout}>
              Logout
            </button>
          </div>
        )}
      </div>

      {/* Hero Content */}
      <div className="hero-content">
        <h1 className="hero-title">
          <span className="title-regular">What will you build </span>
          <span className="title-italic">today</span>
        </h1>
        <p className="hero-subtitle">
          Voice to app in seconds
        </p>

        {/* Pill Bar - Wide with typing effect or visualizer */}
        <div className="pill-bar">
          <button className="pill-button" title="Attach file">
            <Plus size={20} />
          </button>
          
          {isRecording ? (
            <div className="pill-input-area">
              <AudioVisualizer isActive={isRecording} />
            </div>
          ) : (
            <div className="pill-input-area" onClick={handleGetStarted}>
              <span className="pill-placeholder">
                Start speaking to {typedText}<span className="cursor">|</span>
              </span>
            </div>
          )}
          
          <button className="pill-button mic-button" onClick={handleGetStarted} title={isRecording ? "Stop recording" : "Start voice"}>
            {isRecording ? <X size={20} /> : <Mic size={20} />}
          </button>
          <button className="pill-button" title="Submit" onClick={handleGoToEditor}>
            <ArrowUp size={20} />
          </button>
        </div>
      </div>
    </div>
  );
};

export default DictationalPage;
