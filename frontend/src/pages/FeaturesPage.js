import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import AuthModal from '../components/AuthModal';
import '../styles/FeaturesPage.css';

const FeaturesPage = () => {
  const navigate = useNavigate();
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);

  const features = [
    {
      title: "Voice to app in",
      titleItalic: "seconds",
      description: "Transform your ideas into reality through natural conversation. Just speak, and watch your vision come to life.",
      image: "https://customer-assets.emergentagent.com/job_b4891fc0-0141-4191-9e12-b5b08cb6a810/artifacts/1a2o6yjv_u3752894846_an_astronaut_in_a_desert_area_close_up_shot_with__d4b59516-bd38-4945-b32c-db24c0c8951b_1.png"
    },
    {
      title: "Preview your",
      titleItalic: "creation",
      description: "See your app take shape in real-time. Edit, refine, and perfect your creation with instant visual feedback.",
      image: "https://customer-assets.emergentagent.com/job_b4891fc0-0141-4191-9e12-b5b08cb6a810/artifacts/phhy3sc1_u3752894846_a_1980s_retro_computer_in_a_very_green_grassy_flo_9432f26a-571e-4d7a-b04b-d591875ea1ae_3.png"
    },
    {
      title: "Ascend into the",
      titleItalic: "void",
      description: "Break free from traditional development. Let your imagination soar as you build without boundaries.",
      image: "https://customer-assets.emergentagent.com/job_b4891fc0-0141-4191-9e12-b5b08cb6a810/artifacts/eui25k6d_u3752894846_man_sitting_on_a_chair_and_1980s_retro_computer_o_56b4f242-b1eb-47eb-8af8-d08dee7f5f25_2.png"
    }
  ];

  return (
    <div className="features-page">
      {/* Header */}
      <header className="features-header">
        <div className="logo" onClick={() => navigate('/')}>
          <span>Whisp</span>
          <span className="beta-badge">BETA</span>
        </div>
      </header>

      {/* Main Content */}
      <div className="features-content">
        <h1 className="features-title">
          Building at the speed of <em>thought</em>
        </h1>

        <div className="features-grid">
          {features.map((feature, index) => (
            <div key={index} className="feature-card">
              <div className="feature-image-container">
                <img src={feature.image} alt={feature.title} className="feature-image" />
              </div>
              <h3 className="feature-title">
                {feature.title} <em>{feature.titleItalic}</em>
              </h3>
              <p className="feature-description">{feature.description}</p>
              <button className="feature-button" onClick={() => setIsAuthModalOpen(true)}>
                <span>Start speaking</span>
                <ArrowRight size={18} />
              </button>
            </div>
          ))}
        </div>
      </div>
      
      {/* Auth Modal */}
      <AuthModal 
        isOpen={isAuthModalOpen}
        onClose={() => setIsAuthModalOpen(false)}
        onSuccess={() => {
          setIsAuthModalOpen(false);
          navigate('/workspace');
        }}
      />
    </div>
  );
};

export default FeaturesPage;
