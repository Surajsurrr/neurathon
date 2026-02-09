import { useState } from 'react'
import './LandingPage.css'

function LandingPage({ onGetStarted }) {
  return (
    <div className="landing-page">
      
      
              


      {/* How It Works Section */}
      <section className="how-it-works-section">
        <h2 className="section-title">Three Ways to Build Your Portfolio</h2>
        <p className="section-subtitle">
          Choose the method that works best for you - it's that simple!
        </p>
        <div className="methods-grid">
          <div className="method-card">
            <div className="method-number">01</div>
            <div className="method-icon">✍️</div>
            <h3>Enter Your Details</h3>
            <p>Simply fill in your information, skills, and projects manually. Perfect for those who want complete control over every detail of their portfolio.</p>
            <div className="method-tag">Most Popular</div>
          </div>
          <div className="method-card">
            <div className="method-number">02</div>
            <div className="method-icon">📄</div>
            <h3>Upload Your Resume</h3>
            <p>Have a resume ready? Upload it and let our AI extract all the information automatically. Your portfolio will be generated in seconds.</p>
            <div className="method-tag">Coming Soon</div>
          </div>
          <div className="method-card">
            <div className="method-number">03</div>
            <div className="method-icon">🎨</div>
            <h3>Clone a Portfolio</h3>
            <p>Found a portfolio you love? Upload it as a reference, choose your template, and we'll help you create a similar design with your content.</p>
            <div className="method-tag">Coming Soon</div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="cta-section">
        <div className="cta-content">
          <h2>Ready to showcase your work?</h2>
          <p>Join thousands of creators who trust our platform to build their portfolios</p>
          <button className="btn-cta" onClick={onGetStarted}>
            Get Started - It's Free
          </button>
        </div>
      </section>

      {/* Footer */}
      <footer className="landing-footer">
        <p>© 2026 AI Portfolio Generator • Built for Hackathon</p>
      </footer>
    </div>
  )
}

export default LandingPage
