import React, { useState } from 'react';
import { X } from 'lucide-react';
import '../styles/AuthModal.css';

const AuthModal = ({ isOpen, onClose }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSignUp, setIsSignUp] = useState(false);

  if (!isOpen) return null;

  const handleGoogleAuth = () => {
    // TODO: Implement Google OAuth
    console.log('Google auth clicked');
  };

  const handleContinue = () => {
    // TODO: Implement email/password auth
    console.log(isSignUp ? 'Sign up with email/password' : 'Sign in with email/password');
  };

  const toggleMode = () => {
    setIsSignUp(!isSignUp);
  };

  return (
    <div className="auth-modal-overlay" onClick={onClose}>
      <div className="auth-modal-container" onClick={(e) => e.stopPropagation()}>
        {/* Left side - Image */}
        <div className="auth-modal-image">
          <img 
            src="https://customer-assets.emergentagent.com/job_whisp-buddy/artifacts/1at1xmfl_u3752894846_man_sitting_on_a_chair_and_1980s_retro_computer_o_56b4f242-b1eb-47eb-8af8-d08dee7f5f25_0.png" 
            alt="Retro computer scene"
          />
        </div>

        {/* Right side - Form */}
        <div className="auth-modal-form">
          <button className="auth-modal-close" onClick={onClose}>
            <X size={24} />
          </button>

          <div className="auth-modal-content">
            <h2 className="auth-modal-title">
              {isSignUp ? (
                <>Sign up / <span className="italic">Create account</span></>
              ) : (
                <>Sign in / <span className="italic">Log in</span></>
              )}
            </h2>
            <p className="auth-modal-subtitle">
              {isSignUp 
                ? "Create your Whisp account to start building"
                : "We'll sign you in or create an account if you don't have one yet"
              }
            </p>

            <button className="auth-google-btn" onClick={handleGoogleAuth}>
              <svg width="20" height="20" viewBox="0 0 48 48">
                <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
                <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
                <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/>
                <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
              </svg>
              {isSignUp ? "Sign up with Google" : "Continue with Google"}
            </button>

            <div className="auth-divider">
              <span>OR</span>
            </div>

            <input
              type="email"
              placeholder="Enter your email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="auth-input"
            />

            <input
              type="password"
              placeholder="Enter your password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="auth-input"
            />

            <button className="auth-continue-btn" onClick={handleContinue}>
              {isSignUp ? "Sign up" : "Continue"}
            </button>

            <p className="auth-create-account" onClick={toggleMode}>
              {isSignUp 
                ? "Have an account? Log in"
                : "New to Whisp? Create an account"
              }
            </p>

            <p className="auth-terms">
              By signing up or signing in, you agree to our{' '}
              <a href="#terms">Terms</a> and <a href="#privacy">Privacy Policy</a>.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AuthModal;
