import React from 'react';
import { useNavigate } from 'react-router-dom';
import '../styles/AboutPage.css';

const AboutPage = () => {
  const navigate = useNavigate();

  return (
    <div className="about-page">
      {/* Header */}
      <header className="about-header">
        <div className="logo" onClick={() => navigate('/')}>
          <span>Whisp</span>
          <span className="beta-badge">BETA</span>
        </div>
      </header>

      {/* Main Content */}
      <div className="about-content">
        <h1 className="about-title">
          The call to the <em>Vision</em>
        </h1>

        <div className="about-image-container">
          <img 
            src="https://customer-assets.emergentagent.com/job_b4891fc0-0141-4191-9e12-b5b08cb6a810/artifacts/nnfovneb_u3752894846_an_astronaut_in_a_greenery_area_and_flowery_like__14118b0f-dcf1-4756-8d98-38d29f593298_2.png" 
            alt="Vision" 
            className="about-image" 
          />
        </div>

        <div className="about-text-container">
          <p className="about-text">
            In a world where technology moves faster than thought, we asked ourselves a simple question: What if creation could happen at the speed of imagination? What if the barrier between idea and reality could dissolve into nothing more than a conversation?
          </p>
          <p className="about-text">
            Whisp was born from this vision—a belief that everyone deserves to build, to create, to manifest their ideas without the weight of complexity holding them back. We're not just building tools; we're crafting a new way of thinking about creation itself. Voice becomes code. Conversation becomes application. Dreams become reality.
          </p>
          <p className="about-text">
            This is more than software. It's a movement toward a future where your voice is the most powerful development tool you'll ever need. Where artificial intelligence doesn't replace human creativity but amplifies it. Where the void between imagination and creation collapses into a single moment of pure possibility.
          </p>
          <p className="about-text">
            Welcome to Whisp. Welcome to building at the speed of thought. The vision is calling—will you answer?
          </p>
        </div>
      </div>
    </div>
  );
};

export default AboutPage;
