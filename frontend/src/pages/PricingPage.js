import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, Check } from 'lucide-react';
import AuthModal from '../components/AuthModal';
import '../styles/PricingPage.css';

const PricingPage = () => {
  const navigate = useNavigate();
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);

  const pricingTiers = [
    {
      name: "Free",
      price: "$0",
      period: "/month",
      features: [
        "5 projects per month",
        "Basic voice assistance",
        "Standard preview",
        "Export to ZIP",
        "Community support"
      ],
      image: "https://customer-assets.emergentagent.com/job_b4891fc0-0141-4191-9e12-b5b08cb6a810/artifacts/ykk583y2_u3752894846_group_of_people_working_on_1980s_style_retro_comp_7102f9bd-b339-4302-b895-7dc2883b9012_3.png"
    },
    {
      name: "Pro",
      price: "$20",
      period: "/month",
      features: [
        "Unlimited projects",
        "Advanced AI assistance",
        "Real-time collaboration",
        "Priority support",
        "Custom integrations",
        "Advanced export options"
      ],
      image: "https://customer-assets.emergentagent.com/job_b4891fc0-0141-4191-9e12-b5b08cb6a810/artifacts/4a1biein_u3752894846_woman_sitting_on_a_swing_in_flowery_area_bluesky__215e3618-2015-4b3e-920e-17980544be77_1.png",
      popular: true
    },
    {
      name: "Max",
      price: "$50",
      period: "/month",
      features: [
        "Everything in Pro",
        "White-label solutions",
        "Dedicated account manager",
        "Custom AI training",
        "Enterprise security",
        "24/7 priority support",
        "Custom deployment"
      ],
      image: "https://customer-assets.emergentagent.com/job_b4891fc0-0141-4191-9e12-b5b08cb6a810/artifacts/kfz5r4s1_u3752894846_man_and_woman_holding_hands_running_into_the_beyo_22a79cef-f4be-4693-a043-af095330e93c_0.png"
    }
  ];

  const handleAuthSuccess = () => {
    setIsAuthModalOpen(false);
    navigate('/workspace');
  };

  return (
    <div className="pricing-page">
      {/* Header */}
      <header className="pricing-header">
        <div className="logo" onClick={() => navigate('/')}>
          <span>Whisp</span>
          <span className="beta-badge">BETA</span>
        </div>
      </header>

      {/* Main Content */}
      <div className="pricing-content">
        <h1 className="pricing-title">
          Transparent <em>Pricing</em>
        </h1>

        <div className="pricing-grid">
          {pricingTiers.map((tier, index) => (
            <div key={index} className={`pricing-card ${tier.popular ? 'popular' : ''}`}>
              {tier.popular && <div className="popular-badge">Most Popular</div>}
              
              <div className="pricing-image-container">
                <img src={tier.image} alt={tier.name} className="pricing-image" />
              </div>
              
              <h3 className="pricing-tier-name">{tier.name}</h3>
              
              <div className="pricing-price">
                <span className="price-amount">{tier.price}</span>
                <span className="price-period">{tier.period}</span>
              </div>
              
              <ul className="pricing-features">
                {tier.features.map((feature, idx) => (
                  <li key={idx} className="pricing-feature">
                    <Check size={18} className="check-icon" />
                    <span>{feature}</span>
                  </li>
                ))}
              </ul>
              
              <button className="pricing-button" onClick={() => setIsAuthModalOpen(true)}>
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
        onSuccess={handleAuthSuccess}
      />
    </div>
  );
};

export default PricingPage;
