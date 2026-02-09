import { useState, useEffect } from 'react'

function App() {
  const [formData, setFormData] = useState({
    name: '',
    role: '',
    bio: '',
    skills: '',
    email: '',
    github: '',
    linkedin: '',
    projects: [{ title: '', description: '', link: '' }]
  })
  const [selectedCategory, setSelectedCategory] = useState('simple')
  const [selectedTemplate, setSelectedTemplate] = useState('simple')
  const [previewTemplate, setPreviewTemplate] = useState(null)
  const [view, setView] = useState('generate') // 'generate' | 'auth'
  const [authMode, setAuthMode] = useState('login') // 'login' | 'signup'
  const [authData, setAuthData] = useState({ name: '', email: '', password: '' })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const templateCategories = {
    simple: [
      { id: 'simple', name: 'Classic', desc: 'Clean & straightforward' },
      { id: 'simple-gradient', name: 'Gradient', desc: 'Colorful gradients' },
      { id: 'simple-dark', name: 'Dark Code', desc: 'Developer themed' }
    ],
    modern: [
      { id: 'modern', name: 'Floating', desc: 'Animated orbs & glass' },
      { id: 'modern-glass', name: 'Glass Pro', desc: 'Premium glassmorphism' },
      { id: 'modern-cyber', name: 'Cyberpunk', desc: 'Neon & glitch effects' }
    ],
    minimal: [
      { id: 'minimal', name: 'Simple', desc: 'Typography focused' },
      { id: 'minimal-serif', name: 'Serif', desc: 'Elegant serif fonts' },
      { id: 'minimal-mono', name: 'Monospace', desc: 'Code-style minimal' }
    ],
    creative: [
      { id: 'creative', name: 'Sidebar', desc: 'Custom cursor & sidebar' },
      { id: 'creative-bold', name: 'Bold', desc: 'Strong visual impact' },
      { id: 'creative-neon', name: 'Neon', desc: 'Vibrant neon colors' }
    ]
  }

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

  const handleInputChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value })
  }

  const handleProjectChange = (index, field, value) => {
    const newProjects = [...formData.projects]
    newProjects[index][field] = value
    setFormData({ ...formData, projects: newProjects })
  }

  const addProject = () => {
    setFormData({
      ...formData,
      projects: [...formData.projects, { title: '', description: '', link: '' }]
    })
  }

  const removeProject = (index) => {
    if (formData.projects.length > 1) {
      const newProjects = formData.projects.filter((_, i) => i !== index)
      setFormData({ ...formData, projects: newProjects })
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setSuccess('')

    if (!formData.name || !formData.projects[0].title) {
      setError('Please fill in at least your name and one project')
      return
    }

    setLoading(true)

    try {
      const response = await fetch('/api/generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ ...formData, template: selectedTemplate })
      })

      if (!response.ok) {
        throw new Error('Generation failed')
      }

      const data = await response.json()
      
      if (data.success && data.shareUrl) {
        // Open portfolio in new tab using full URL
        const newWindow = window.open(data.shareUrl, '_blank', 'noopener,noreferrer')
        
        if (!newWindow) {
          // If popup was blocked, navigate directly
          window.location.href = data.shareUrl
        }
        
        // Copy share URL to clipboard silently
        if (navigator.clipboard) {
          try {
            await navigator.clipboard.writeText(data.shareUrl)
          } catch (e) {
            console.log('Clipboard copy failed:', e)
          }
        }
      } else {
        throw new Error('Invalid response from server')
      }
    } catch (err) {
      setError('Failed to generate portfolio. Please try again.')
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  const handleAuthChange = (e) => {
    setAuthData({ ...authData, [e.target.name]: e.target.value })
  }

  const handleAuthSubmit = (e) => {
    e.preventDefault()
    setError('')
    setSuccess('')
    // Mock auth — in a real app call backend endpoints
    if (authMode === 'login') {
      if (!authData.email || !authData.password) return setError('Please provide email and password')
      setSuccess('Logged in (mock).')
    } else {
      if (!authData.name || !authData.email || !authData.password) return setError('Please fill all fields')
      setSuccess('Account created (mock).')
    }
  }

  return (
    <div className="portfolio-app">
      {/* Custom Cursor */}
      <div className="custom-cursor"></div>
      <div className="custom-cursor-dot"></div>
      
      {/* Gradient Background */}
      <div className="gradient-bg">
        <div className="gradient-orb orb-1"></div>
        <div className="gradient-orb orb-2"></div>
        <div className="gradient-orb orb-3"></div>
      </div>

      {/* Preview Modal */}
      {previewTemplate && (
        <div className="preview-modal" onClick={() => setPreviewTemplate(null)}>
          <div className="preview-modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="preview-modal-header">
              <h2>Template Preview: {previewTemplate.name}</h2>
              <button className="close-preview" onClick={() => setPreviewTemplate(null)}>✕</button>
            </div>
            <div className="preview-iframe-container">
              <iframe 
                src={`/api/preview/${previewTemplate.id}`}
                className="preview-iframe"
                title="Template Preview"
              />
            </div>
            <div className="preview-modal-footer">
              <button 
                className="select-template-btn"
                onClick={() => {
                  setSelectedTemplate(previewTemplate.id);
                  setPreviewTemplate(null);
                }}
              >
                Select This Template
              </button>
              <button className="cancel-preview-btn" onClick={() => setPreviewTemplate(null)}>
                Close Preview
              </button>
            </div>
          </div>
        </div>
      )}
      
      {/* Navigation */}
      <nav className="top-nav">
        <div className="nav-container">
          <div className="brand">
            <span className="brand-icon">⚡</span>
            <span className="brand-name">Portfolio<span className="accent">AI</span></span>
          </div>
          <div className="nav-links">
            <button 
              className={`nav-link ${view === 'generate' ? 'active' : ''}`}
              onClick={() => setView('generate')}
            >
              <span className="link-icon">🎨</span>
              Create
            </button>
            <button 
              className={`nav-link ${view === 'auth' ? 'active' : ''}`}
              onClick={() => { setView('auth'); setAuthMode('login') }}
            >
              <span className="link-icon">👤</span>
              Account
            </button>
          </div>
        </div>
      </nav>

      <div className="main-content">
        {error && (
          <div className="notification error-notification">
            <span className="notif-icon">⚠️</span>
            <span>{error}</span>
          </div>
        )}
        {success && (
          <div className="notification success-notification">
            <span className="notif-icon">✓</span>
            <span>{success}</span>
          </div>
        )}

        {view === 'auth' ? (
          <div className="auth-view">
            <div className="auth-card">
              <div className="auth-header">
                <h1>{authMode === 'login' ? 'Welcome Back' : 'Join Us'}</h1>
                <p>{authMode === 'login' ? 'Sign in to continue creating' : 'Start building amazing portfolios'}</p>
              </div>
              
              <form onSubmit={handleAuthSubmit} className="auth-form">
                {authMode === 'signup' && (
                  <div className="form-field">
                    <label htmlFor="auth-name">
                      <span className="field-icon">👤</span>
                      Full Name
                    </label>
                    <input 
                      id="auth-name" 
                      name="name" 
                      value={authData.name} 
                      onChange={handleAuthChange} 
                      placeholder="John Doe"
                      className="field-input"
                    />
                  </div>
                )}
                <div className="form-field">
                  <label htmlFor="auth-email">
                    <span className="field-icon">📧</span>
                    Email
                  </label>
                  <input 
                    id="auth-email" 
                    name="email" 
                    type="email"
                    value={authData.email} 
                    onChange={handleAuthChange} 
                    placeholder="you@example.com"
                    className="field-input"
                  />
                </div>
                <div className="form-field">
                  <label htmlFor="auth-password">
                    <span className="field-icon">🔒</span>
                    Password
                  </label>
                  <input 
                    id="auth-password" 
                    name="password" 
                    type="password" 
                    value={authData.password} 
                    onChange={handleAuthChange} 
                    placeholder="••••••••"
                    className="field-input"
                  />
                </div>
                
                <button type="submit" className="primary-btn">
                  {authMode === 'login' ? '🚀 Sign In' : '✨ Create Account'}
                </button>
                
                <div className="auth-switch">
                  <span>{authMode === 'login' ? "Don't have an account? " : "Already registered? "}</span>
                  <button 
                    type="button" 
                    className="text-link" 
                    onClick={() => setAuthMode(authMode === 'login' ? 'signup' : 'login')}
                  >
                    {authMode === 'login' ? 'Sign Up' : 'Sign In'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        ) : (
          <div className="generator-view">
            <div className="hero-header">
              <h1 className="hero-title">
                Create Your <span className="gradient-text">Dream Portfolio</span>
              </h1>
              <p className="hero-description">
                Powered by AI • Built in Minutes • Professional Results
              </p>
            </div>
            
            <form onSubmit={handleSubmit} className="generator-form">
              {/* Template Selection Section */}
              <div className="form-section">
                <div className="section-label">
                  <div className="label-group">
                    <span className="label-icon">🎨</span>
                    <h2>Choose Your Template Style</h2>
                  </div>
                </div>
                
                {/* Category Tabs */}
                <div className="category-tabs">
                  <button
                    type="button"
                    className={`category-tab ${selectedCategory === 'simple' ? 'active' : ''}`}
                    onClick={() => { setSelectedCategory('simple'); setSelectedTemplate('simple'); }}
                  >
                    Simple
                  </button>
                  <button
                    type="button"
                    className={`category-tab ${selectedCategory === 'modern' ? 'active' : ''}`}
                    onClick={() => { setSelectedCategory('modern'); setSelectedTemplate('modern'); }}
                  >
                    Modern
                  </button>
                  <button
                    type="button"
                    className={`category-tab ${selectedCategory === 'minimal' ? 'active' : ''}`}
                    onClick={() => { setSelectedCategory('minimal'); setSelectedTemplate('minimal'); }}
                  >
                    Minimal
                  </button>
                  <button
                    type="button"
                    className={`category-tab ${selectedCategory === 'creative' ? 'active' : ''}`}
                    onClick={() => { setSelectedCategory('creative'); setSelectedTemplate('creative'); }}
                  >
                    Creative
                  </button>
                </div>

                {/* Template Variations */}
                <div className="template-grid">
                  {templateCategories[selectedCategory].map((template) => (
                    <div
                      key={template.id}
                      className={`template-card ${selectedTemplate === template.id ? 'active' : ''}`}
                      onClick={() => setSelectedTemplate(template.id)}
                    >
                      <div className="template-preview">
                        <div className={`preview-${selectedCategory}`}>
                          {selectedCategory === 'simple' && (
                            <>
                              <div className="prev-header"></div>
                              <div className="prev-content">
                                <div className="prev-line"></div>
                                <div className="prev-line short"></div>
                              </div>
                            </>
                          )}
                          {selectedCategory === 'modern' && (
                            <>
                              <div className="prev-nav"></div>
                              <div className="prev-hero"></div>
                              <div className="prev-grid">
                                <div className="prev-box"></div>
                                <div className="prev-box"></div>
                              </div>
                            </>
                          )}
                          {selectedCategory === 'minimal' && (
                            <>
                              <div className="prev-title"></div>
                              <div className="prev-text">
                                <div className="prev-line"></div>
                                <div className="prev-line"></div>
                                <div className="prev-line short"></div>
                              </div>
                            </>
                          )}
                          {selectedCategory === 'creative' && (
                            <>
                              <div className="prev-sidebar"></div>
                              <div className="prev-main">
                                <div className="prev-section"></div>
                                <div className="prev-section"></div>
                              </div>
                            </>
                          )}
                        </div>
                      </div>
                      <div className="template-info">
                        <h3>{template.name}</h3>
                        <p>{template.desc}</p>
                      </div>
                      <div className="template-actions">
                        <button
                          type="button"
                          className="preview-btn"
                          onClick={(e) => {
                            e.stopPropagation();
                            setPreviewTemplate(template);
                          }}
                        >
                          👁️ Preview
                        </button>
                        {selectedTemplate === template.id && <div className="template-badge">✓ Selected</div>}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Personal Info Section */}
              <div className="form-section">
                <div className="section-label">
                  <div className="label-group">
                    <span className="label-icon">👨‍💼</span>
                    <h2>Personal Information</h2>
                  </div>
                </div>
                
                <div className="fields-grid">
                  <div className="form-field">
                    <label htmlFor="name">
                      <span className="field-icon">📝</span>
                      Full Name *
                    </label>
                    <input
                      type="text"
                      id="name"
                      name="name"
                      value={formData.name}
                      onChange={handleInputChange}
                      placeholder="John Doe"
                      className="field-input"
                      required
                    />
                  </div>

                  <div className="form-field">
                    <label htmlFor="role">
                      <span className="field-icon">💼</span>
                      Professional Title
                    </label>
                    <input
                      type="text"
                      id="role"
                      name="role"
                      value={formData.role}
                      onChange={handleInputChange}
                      placeholder="Full Stack Developer"
                      className="field-input"
                    />
                  </div>

                  <div className="form-field">
                    <label htmlFor="email">
                      <span className="field-icon">📧</span>
                      Email
                    </label>
                    <input
                      type="email"
                      id="email"
                      name="email"
                      value={formData.email}
                      onChange={handleInputChange}
                      placeholder="john@example.com"
                      className="field-input"
                    />
                  </div>

                  <div className="form-field">
                    <label htmlFor="github">
                      <span className="field-icon">💻</span>
                      GitHub Username
                    </label>
                    <input
                      type="text"
                      id="github"
                      name="github"
                      value={formData.github}
                      onChange={handleInputChange}
                      placeholder="johndoe"
                      className="field-input"
                    />
                  </div>

                  <div className="form-field">
                    <label htmlFor="linkedin">
                      <span className="field-icon">🔗</span>
                      LinkedIn Username
                    </label>
                    <input
                      type="text"
                      id="linkedin"
                      name="linkedin"
                      value={formData.linkedin}
                      onChange={handleInputChange}
                      placeholder="johndoe"
                      className="field-input"
                    />
                  </div>
                </div>

                <div className="form-field">
                  <label htmlFor="bio">
                    <span className="field-icon">✍️</span>
                    About You
                  </label>
                  <textarea
                    id="bio"
                    name="bio"
                    value={formData.bio}
                    onChange={handleInputChange}
                    placeholder="Share your story, passion, and what makes you unique..."
                    rows={4}
                    className="field-input"
                  />
                </div>

                <div className="form-field">
                  <label htmlFor="skills">
                    <span className="field-icon">⚡</span>
                    Skills & Technologies
                  </label>
                  <input
                    type="text"
                    id="skills"
                    name="skills"
                    value={formData.skills}
                    onChange={handleInputChange}
                    placeholder="React, Node.js, Python, AWS, Docker..."
                    className="field-input"
                  />
                  <span className="field-hint">Separate skills with commas</span>
                </div>
              </div>

              {/* Projects Section */}
              <div className="form-section">
                <div className="section-label">
                  <div className="label-group">
                    <span className="label-icon">💼</span>
                    <h2>Your Projects</h2>
                  </div>
                  <button type="button" onClick={addProject} className="add-btn">
                    <span>+</span> Add Project
                  </button>
                </div>
                
                <div className="projects-container">
                  {formData.projects.map((project, index) => (
                    <div key={index} className="project-item">
                      <div className="project-header">
                        <span className="project-badge">Project {index + 1}</span>
                        {formData.projects.length > 1 && (
                          <button
                            type="button"
                            className="delete-btn"
                            onClick={() => removeProject(index)}
                            title="Remove project"
                          >
                            ✕
                          </button>
                        )}
                      </div>
                      
                      <div className="form-field">
                        <label htmlFor={`project-title-${index}`}>Project Title *</label>
                        <input
                          type="text"
                          id={`project-title-${index}`}
                          value={project.title}
                          onChange={(e) => handleProjectChange(index, 'title', e.target.value)}
                          placeholder="E-Commerce Platform"
                          className="field-input"
                          required
                        />
                      </div>
                      
                      <div className="form-field">
                        <label htmlFor={`project-desc-${index}`}>Description</label>
                        <textarea
                          id={`project-desc-${index}`}
                          value={project.description}
                          onChange={(e) => handleProjectChange(index, 'description', e.target.value)}
                          placeholder="What makes this project special..."
                          rows={3}
                          className="field-input"
                        />
                      </div>
                      
                      <div className="form-field">
                        <label htmlFor={`project-link-${index}`}>Project URL</label>
                        <input
                          type="url"
                          id={`project-link-${index}`}
                          value={project.link}
                          onChange={(e) => handleProjectChange(index, 'link', e.target.value)}
                          placeholder="https://github.com/username/project"
                          className="field-input"
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <button type="submit" className="submit-btn" disabled={loading}>
                {loading ? (
                  <>
                    <div className="btn-spinner"></div>
                    <span>Creating Your Portfolio...</span>
                  </>
                ) : (
                  <>
                    <span>🚀 Create & View Portfolio</span>
                  </>
                )}
              </button>
            </form>
          </div>
        )}
      </div>
    </div>
  )
}

export default App
