import { useState, useEffect } from 'react'

export default function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [isSignup, setIsSignup] = useState(false)

  useEffect(() => {
    const cursor = document.querySelector('.custom-cursor')
    const cursorDot = document.querySelector('.custom-cursor-dot')
    
    let mouseX = 0
    let mouseY = 0
    let cursorX = 0
    let cursorY = 0
    let dotX = 0
    let dotY = 0

    const handleMouseMove = (e) => {
      mouseX = e.clientX
      mouseY = e.clientY
    }

    const animateCursor = () => {
      // Dot follows immediately (fast)
      dotX += (mouseX - dotX) * 0.9
      dotY += (mouseY - dotY) * 0.9
      
      // Outer ring follows with delay (slower, slimy effect)
      cursorX += (mouseX - cursorX) * 0.15
      cursorY += (mouseY - cursorY) * 0.15
      
      if (cursorDot) {
        cursorDot.style.transform = `translate(${dotX}px, ${dotY}px)`
      }
      if (cursor) {
        cursor.style.transform = `translate(${cursorX}px, ${cursorY}px)`
      }
      
      requestAnimationFrame(animateCursor)
    }

    document.addEventListener('mousemove', handleMouseMove)
    animateCursor()

    return () => {
      document.removeEventListener('mousemove', handleMouseMove)
    }
  }, [])

  const handleSubmit = (e) => {
    e.preventDefault()
    setError('')
    setSuccess('')
    if (!email || !password) return setError('Please enter email and password')
    setTimeout(() => {
      setSuccess(isSignup ? 'Account created successfully!' : 'Logged in successfully!')
      setTimeout(() => (window.location.href = '/'), 800)
    }, 600)
  }

  return (
    <div className="landing-page">
      {/* Custom Cursor */}
      <div className="custom-cursor"></div>
      <div className="custom-cursor-dot"></div>
      
      {/* Hero Section with Auth */}
      <section className="hero-section">
        <div className="login-content">
          <div className="welcome-box">
            <h1>WELCOME!</h1>
            <p className="tagline">Build Your AI-Powered Portfolio in Minutes</p>
          </div>
          
          <div className="signin-card">
            <div className="auth-tabs">
              <button 
                className={!isSignup ? 'active' : ''} 
                onClick={() => setIsSignup(false)}
              >
                Sign In
              </button>
              <button 
                className={isSignup ? 'active' : ''} 
                onClick={() => setIsSignup(true)}
              >
                Sign Up
              </button>
            </div>
            
            {error && <div className="error">{error}</div>}
            {success && <div className="success">{success}</div>}
            
            <form onSubmit={handleSubmit}>
              <div className="login-field">
                <label>EMAIL</label>
                <input 
                  type="email" 
                  value={email} 
                  onChange={(e) => setEmail(e.target.value)} 
                  placeholder="you@example.com" 
                />
              </div>
              <div className="login-field">
                <label>PASSWORD</label>
                <input 
                  type="password" 
                  value={password} 
                  onChange={(e) => setPassword(e.target.value)} 
                  placeholder="••••••••" 
                />
              </div>
              <div className="login-buttons">
                <button type="submit" className="btn-login">
                  {isSignup ? 'SIGN UP' : 'LOGIN'}
                </button>
              </div>
            </form>
          </div>
        </div>
        
        <div className="scroll-indicator">
          <span>Scroll to explore</span>
          <div className="arrow-down">↓</div>
        </div>
      </section>

      {/* Features Section */}
      <section className="features-section">
        <div className="container">
          <h2 className="section-title">Why Choose Our Portfolio Generator?</h2>
          <div className="features-grid">
            <div className="feature-card">
              <div className="feature-icon">🤖</div>
              <h3>AI-Powered</h3>
              <p>Let AI enhance your content and create professional descriptions for your projects and skills.</p>
            </div>
            <div className="feature-card">
              <div className="feature-icon">⚡</div>
              <h3>Lightning Fast</h3>
              <p>Generate a complete portfolio website in under 60 seconds. No coding required.</p>
            </div>
            <div className="feature-card">
              <div className="feature-icon">🎨</div>
              <h3>Beautiful Templates</h3>
              <p>Choose from stunning, responsive templates designed by professionals.</p>
            </div>
            <div className="feature-card">
              <div className="feature-icon">📱</div>
              <h3>Mobile Ready</h3>
              <p>All portfolios are fully responsive and look perfect on any device.</p>
            </div>
            <div className="feature-card">
              <div className="feature-icon">🚀</div>
              <h3>Easy Deploy</h3>
              <p>Download as ZIP or deploy directly to GitHub Pages with one click.</p>
            </div>
            <div className="feature-card">
              <div className="feature-icon">🔧</div>
              <h3>Customizable</h3>
              <p>Full control over your content, projects, skills, and personal branding.</p>
            </div>
          </div>
        </div>
      </section>

      {/* How It Works Section */}
      <section className="how-it-works-section">
        <div className="container">
          <h2 className="section-title">How It Works</h2>
          <div className="steps-container">
            <div className="step">
              <div className="step-number">1</div>
              <h3>Sign Up & Login</h3>
              <p>Create your free account in seconds</p>
            </div>
            <div className="step">
              <div className="step-number">2</div>
              <h3>Fill Your Info</h3>
              <p>Add your name, role, bio, skills, and projects</p>
            </div>
            <div className="step">
              <div className="step-number">3</div>
              <h3>Choose Template</h3>
              <p>Select from our collection of professional designs</p>
            </div>
            <div className="step">
              <div className="step-number">4</div>
              <h3>Generate & Download</h3>
              <p>Get your portfolio as a ready-to-deploy package</p>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="cta-section">
        <div className="container">
          <h2>Ready to Build Your Portfolio?</h2>
          <p>Join thousands of developers, designers, and creators who trust us</p>
          <button className="btn-cta" onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}>
            Get Started Now
          </button>
        </div>
      </section>

      {/* Footer */}
      <footer className="landing-footer">
        <div className="container">
          <p>&copy; 2026 AI Portfolio Generator. Built at Neurathon Hackathon.</p>
        </div>
      </footer>
    </div>
  )
}
