import { useState, useEffect } from 'react'
import LandingPage from './LandingPage'

function App() {
  const [showLanding, setShowLanding] = useState(true)
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
  const [resumeData, setResumeData] = useState(null) // stores extracted resume data
  const [resumeFlow, setResumeFlow] = useState(false) // true = show template picker only
  const [cloneFlow, setCloneFlow] = useState(false) // true = show form with cloned template
  const [clonedTemplateId, setClonedTemplateId] = useState(null) // 'cloned-xxxx'
  const [cloneSourceUrl, setCloneSourceUrl] = useState('')

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

  // Hide landing page when navigating to auth
  useEffect(() => {
    if (view === 'auth') {
      setShowLanding(false)
    }
  }, [view])

  // Honor landing flag from URL (fallback target after auth)
  useEffect(() => {
    try {
      const params = new URLSearchParams(window.location.search)
      if (params.get('showLanding') === '1') {
        setShowLanding(true)
      }
    } catch (e) {
      // ignore
    }
  }, [])

  // Manage history state for SPA view navigation so back/forward work without reload
  useEffect(() => {
    // When entering auth view, push a history entry so history.back() returns here
    if (view === 'auth') {
      try {
        window.history.pushState({ view: 'auth' }, '', '?auth=1')
      } catch (e) {
        // ignore
      }
    } else {
      try {
        // Replace state for generate view to keep history tidy
        window.history.replaceState({ view: 'generate' }, '', window.location.pathname)
      } catch (e) {
        // ignore
      }
    }
  }, [view])

  useEffect(() => {
    const onPop = (e) => {
      const stateView = e.state && e.state.view
      if (stateView) {
        setView(stateView)
        setShowLanding(stateView !== 'auth')
      } else {
        // No state (fresh pop) -> show landing as safe default
        setView('generate')
        setShowLanding(true)
      }
    }

    window.addEventListener('popstate', onPop)
    return () => window.removeEventListener('popstate', onPop)
  }, [])

  useEffect(() => {
    const cursor = document.querySelector('.custom-cursor')
    const cursorDot = document.querySelector('.custom-cursor-dot')
    
    let mouseX = 0
    let mouseY = 0
    let cursorX = 0
    let cursorY = 0
    let dotX = 0
    let dotY = 0

    let trailCounter = 0

    const handleMouseMove = (e) => {
      mouseX = e.clientX
      mouseY = e.clientY

      // Spawn trail particle every 3rd move
      trailCounter++
      if (trailCounter % 3 === 0) {
        const trail = document.createElement('div')
        trail.className = 'cursor-trail'
        trail.style.left = `${e.clientX - 3}px`
        trail.style.top = `${e.clientY - 3}px`
        document.body.appendChild(trail)
        setTimeout(() => trail.remove(), 600)
      }
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

    // Hover detection for interactive elements
    const addHover = () => {
      if (cursor) cursor.classList.add('hovering')
      if (cursorDot) cursorDot.classList.add('hovering')
    }
    const removeHover = () => {
      if (cursor) cursor.classList.remove('hovering')
      if (cursorDot) cursorDot.classList.remove('hovering')
    }
    const addClick = () => {
      if (cursor) cursor.classList.add('clicking')
      if (cursorDot) cursorDot.classList.add('clicking')
    }
    const removeClick = () => {
      if (cursor) cursor.classList.remove('clicking')
      if (cursorDot) cursorDot.classList.remove('clicking')
    }

    document.querySelectorAll('button, a, input, textarea, .template-card, .category-tab, .nav-link, .add-btn, .submit-btn').forEach(el => {
      el.addEventListener('mouseenter', addHover)
      el.addEventListener('mouseleave', removeHover)
    })
    document.addEventListener('mousedown', addClick)
    document.addEventListener('mouseup', removeClick)

    document.addEventListener('mousemove', handleMouseMove)
    animateCursor()

    // Re-attach hover listeners when DOM updates
    const observer = new MutationObserver(() => {
      document.querySelectorAll('button, a, input, textarea, .template-card, .category-tab, .nav-link, .add-btn, .submit-btn').forEach(el => {
        el.removeEventListener('mouseenter', addHover)
        el.removeEventListener('mouseleave', removeHover)
        el.addEventListener('mouseenter', addHover)
        el.addEventListener('mouseleave', removeHover)
      })
    })
    observer.observe(document.body, { childList: true, subtree: true })

    return () => {
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mousedown', addClick)
      document.removeEventListener('mouseup', removeClick)
      observer.disconnect()
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

  const handleResumeData = (extractedData) => {
    // Store resume data and enter template-only flow
    setResumeData(extractedData)
    setResumeFlow(true)
    setCloneFlow(false)
    setShowLanding(false)
    setSuccess('✨ Resume parsed successfully! Now pick a template for your portfolio.')
    setTimeout(() => setSuccess(''), 4000)
  }

  const handleCloneDesign = (cloneInfo) => {
    // Store cloned template and enter clone flow (show form to enter details)
    setClonedTemplateId(cloneInfo.clonedTemplateId)
    setCloneSourceUrl(cloneInfo.sourceUrl)
    setCloneFlow(true)
    setResumeFlow(false)
    setShowLanding(false)
    setSuccess('🎨 Design cloned successfully! Now enter your details to build your portfolio.')
    setTimeout(() => setSuccess(''), 4000)
  }

  const handleResumeGenerate = async () => {
    if (!resumeData) return
    setError('')
    setLoading(true)

    try {
      const payload = {
        name: resumeData.name || 'Portfolio',
        role: resumeData.role || '',
        bio: resumeData.bio || resumeData.summary || '',
        skills: resumeData.skills ? resumeData.skills.join(', ') : '',
        email: resumeData.email || '',
        github: resumeData.github || '',
        linkedin: resumeData.linkedin || '',
        projects: resumeData.projects && resumeData.projects.length > 0
          ? resumeData.projects
          : [{ title: 'My Project', description: 'A project from my resume', link: '' }],
        template: selectedTemplate
      }

      const response = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      })

      if (!response.ok) throw new Error('Generation failed')

      const data = await response.json()

      if (data.success && data.shareUrl) {
        const newWindow = window.open(data.shareUrl, '_blank', 'noopener,noreferrer')
        if (!newWindow) window.location.href = data.shareUrl

        if (navigator.clipboard) {
          try { await navigator.clipboard.writeText(data.shareUrl) } catch (e) {}
        }
        setSuccess('🎉 Portfolio generated! Link copied to clipboard.')
        setTimeout(() => setSuccess(''), 5000)
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
    <>
      {/* Custom Cursor - Always visible */}
      <div className="custom-cursor"></div>
      <div className="custom-cursor-dot"></div>
      
      {showLanding ? (
        <LandingPage 
          onGetStarted={() => setShowLanding(false)} 
          onResumeUpload={handleResumeData}
          onCloneDesign={handleCloneDesign}
        />
      ) : (
        <div className="portfolio-app">
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
        ) : resumeFlow ? (
          /* ─── Resume Flow: Template Picker Only ─── */
          <div className="generator-view resume-flow-view">
            <div className="hero-header">
              <h1 className="hero-title">
                Pick a <span className="gradient-text">Template</span>
              </h1>
              <p className="hero-description">
                Your resume has been parsed ✓ &nbsp;Now choose how your portfolio should look
              </p>
            </div>

            {/* Extracted info summary */}
            {resumeData && (
              <div className="resume-summary-card">
                <div className="resume-summary-header">
                  <span className="resume-summary-icon">📋</span>
                  <h3>Extracted from your resume</h3>
                </div>
                <div className="resume-summary-details">
                  {resumeData.name && <div className="resume-tag"><span className="tag-label">Name:</span> {resumeData.name}</div>}
                  {resumeData.role && <div className="resume-tag"><span className="tag-label">Role:</span> {resumeData.role}</div>}
                  {resumeData.email && <div className="resume-tag"><span className="tag-label">Email:</span> {resumeData.email}</div>}
                  {resumeData.skills && resumeData.skills.length > 0 && (
                    <div className="resume-skills-row">
                      <span className="tag-label">Skills:</span>
                      <div className="resume-skill-chips">
                        {resumeData.skills.slice(0, 10).map((skill, i) => (
                          <span key={i} className="skill-chip">{skill}</span>
                        ))}
                        {resumeData.skills.length > 10 && <span className="skill-chip more">+{resumeData.skills.length - 10} more</span>}
                      </div>
                    </div>
                  )}
                  {resumeData.projects && resumeData.projects.length > 0 && (
                    <div className="resume-tag"><span className="tag-label">Projects:</span> {resumeData.projects.length} found</div>
                  )}
                </div>
              </div>
            )}

            {/* Template Selection */}
            <div className="form-section">
              <div className="section-label">
                <div className="label-group">
                  <span className="label-icon">🎨</span>
                  <h2>Choose Your Template Style</h2>
                </div>
              </div>
              
              <div className="category-tabs">
                <button type="button" className={`category-tab ${selectedCategory === 'simple' ? 'active' : ''}`}
                  onClick={() => { setSelectedCategory('simple'); setSelectedTemplate('simple'); }}>Simple</button>
                <button type="button" className={`category-tab ${selectedCategory === 'modern' ? 'active' : ''}`}
                  onClick={() => { setSelectedCategory('modern'); setSelectedTemplate('modern'); }}>Modern</button>
                <button type="button" className={`category-tab ${selectedCategory === 'minimal' ? 'active' : ''}`}
                  onClick={() => { setSelectedCategory('minimal'); setSelectedTemplate('minimal'); }}>Minimal</button>
                <button type="button" className={`category-tab ${selectedCategory === 'creative' ? 'active' : ''}`}
                  onClick={() => { setSelectedCategory('creative'); setSelectedTemplate('creative'); }}>Creative</button>
              </div>

              <div className="template-grid">
                {templateCategories[selectedCategory].map((template) => (
                  <div key={template.id}
                    className={`template-card ${selectedTemplate === template.id ? 'active' : ''}`}
                    onClick={() => setSelectedTemplate(template.id)}>
                    <div className="template-preview">
                      <div className={`preview-${selectedCategory}`}>
                        {selectedCategory === 'simple' && (<><div className="prev-header"></div><div className="prev-content"><div className="prev-line"></div><div className="prev-line short"></div></div></>)}
                        {selectedCategory === 'modern' && (<><div className="prev-nav"></div><div className="prev-hero"></div><div className="prev-grid"><div className="prev-box"></div><div className="prev-box"></div></div></>)}
                        {selectedCategory === 'minimal' && (<><div className="prev-title"></div><div className="prev-text"><div className="prev-line"></div><div className="prev-line"></div><div className="prev-line short"></div></div></>)}
                        {selectedCategory === 'creative' && (<><div className="prev-sidebar"></div><div className="prev-main"><div className="prev-section"></div><div className="prev-section"></div></div></>)}
                      </div>
                    </div>
                    <div className="template-info">
                      <h3>{template.name}</h3>
                      <p>{template.desc}</p>
                    </div>
                    <div className="template-actions">
                      <button type="button" className="preview-btn"
                        onClick={(e) => { e.stopPropagation(); setPreviewTemplate(template); }}>
                        👁️ Preview
                      </button>
                      {selectedTemplate === template.id && <div className="template-badge">✓ Selected</div>}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Generate Button */}
            <button className="submit-btn" onClick={handleResumeGenerate} disabled={loading}
              style={{ marginTop: '2rem' }}>
              {loading ? (
                <><div className="btn-spinner"></div><span>Generating Your Portfolio...</span></>
              ) : (
                <span>🚀 Generate My Portfolio</span>
              )}
            </button>

            <button className="text-link" style={{ marginTop: '1rem', display: 'block', textAlign: 'center', opacity: 0.7 }}
              onClick={() => {
                // Pre-fill the form with extracted resume data
                setFormData({
                  name: resumeData?.name || '',
                  role: resumeData?.role || '',
                  bio: resumeData?.bio || resumeData?.summary || '',
                  skills: resumeData?.skills ? resumeData.skills.join(', ') : '',
                  email: resumeData?.email || '',
                  github: resumeData?.github || '',
                  linkedin: resumeData?.linkedin || '',
                  projects: resumeData?.projects && resumeData.projects.length > 0
                    ? resumeData.projects
                    : [{ title: '', description: '', link: '' }]
                })
                setResumeFlow(false)
                setSuccess('📝 Resume data loaded into the form. Edit anything you like!')
                setTimeout(() => setSuccess(''), 4000)
              }}>
              ✏️ Want to edit details manually instead?
            </button>
          </div>
        ) : cloneFlow ? (
          /* ─── Clone Flow: Cloned Design Preview + Form ─── */
          <div className="generator-view clone-flow-view">
            <div className="hero-header">
              <h1 className="hero-title">
                Build with <span className="gradient-text">Cloned Design</span>
              </h1>
              <p className="hero-description">
                Design cloned from <strong>{cloneSourceUrl}</strong> — now add your details
              </p>
            </div>

            {/* Cloned design preview */}
            <div className="clone-preview-banner">
              <div className="clone-preview-left">
                <span className="clone-preview-icon">🎨</span>
                <div>
                  <h3>Cloned Template Ready</h3>
                  <p>The design from the URL has been converted into your custom template</p>
                </div>
              </div>
              <button className="preview-cloned-btn" onClick={() => setPreviewTemplate({ id: clonedTemplateId, name: 'Cloned Design' })}>
                👁️ Preview Design
              </button>
            </div>

            {/* Form for user details */}
            <form onSubmit={async (e) => {
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
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ ...formData, template: clonedTemplateId })
                })
                if (!response.ok) throw new Error('Generation failed')
                const data = await response.json()
                if (data.success && data.shareUrl) {
                  const newWindow = window.open(data.shareUrl, '_blank', 'noopener,noreferrer')
                  if (!newWindow) window.location.href = data.shareUrl
                  if (navigator.clipboard) {
                    try { await navigator.clipboard.writeText(data.shareUrl) } catch (e) {}
                  }
                  setSuccess('🎉 Portfolio generated with cloned design! Link copied.')
                  setTimeout(() => setSuccess(''), 5000)
                } else throw new Error('Invalid response')
              } catch (err) {
                setError('Failed to generate portfolio. Please try again.')
                console.error(err)
              } finally {
                setLoading(false)
              }
            }} className="generator-form">
              
              {/* Personal Info */}
              <div className="form-section">
                <div className="section-label">
                  <div className="label-group">
                    <span className="label-icon">👤</span>
                    <h2>Personal Information</h2>
                  </div>
                </div>
                <div className="form-grid">
                  <div className="form-field">
                    <label htmlFor="clone-name"><span className="field-icon">✨</span>Full Name *</label>
                    <input id="clone-name" name="name" value={formData.name} onChange={handleInputChange} placeholder="John Doe" className="field-input" required />
                  </div>
                  <div className="form-field">
                    <label htmlFor="clone-role"><span className="field-icon">💼</span>Role / Title</label>
                    <input id="clone-role" name="role" value={formData.role} onChange={handleInputChange} placeholder="Full Stack Developer" className="field-input" />
                  </div>
                  <div className="form-field full-width">
                    <label htmlFor="clone-bio"><span className="field-icon">📝</span>Bio / About</label>
                    <textarea id="clone-bio" name="bio" value={formData.bio} onChange={handleInputChange} placeholder="Tell us about yourself..." className="field-input" rows="3" />
                  </div>
                  <div className="form-field full-width">
                    <label htmlFor="clone-skills"><span className="field-icon">🛠️</span>Skills (comma-separated)</label>
                    <input id="clone-skills" name="skills" value={formData.skills} onChange={handleInputChange} placeholder="React, Node.js, Python, ..." className="field-input" />
                  </div>
                </div>
              </div>

              {/* Contact & Social */}
              <div className="form-section">
                <div className="section-label">
                  <div className="label-group">
                    <span className="label-icon">🔗</span>
                    <h2>Contact & Social</h2>
                  </div>
                </div>
                <div className="form-grid">
                  <div className="form-field">
                    <label htmlFor="clone-email"><span className="field-icon">📧</span>Email</label>
                    <input id="clone-email" name="email" type="email" value={formData.email} onChange={handleInputChange} placeholder="you@email.com" className="field-input" />
                  </div>
                  <div className="form-field">
                    <label htmlFor="clone-github"><span className="field-icon">🐙</span>GitHub</label>
                    <input id="clone-github" name="github" value={formData.github} onChange={handleInputChange} placeholder="username or URL" className="field-input" />
                  </div>
                  <div className="form-field">
                    <label htmlFor="clone-linkedin"><span className="field-icon">💼</span>LinkedIn</label>
                    <input id="clone-linkedin" name="linkedin" value={formData.linkedin} onChange={handleInputChange} placeholder="username or URL" className="field-input" />
                  </div>
                </div>
              </div>

              {/* Projects */}
              <div className="form-section">
                <div className="section-label">
                  <div className="label-group">
                    <span className="label-icon">🚀</span>
                    <h2>Projects</h2>
                  </div>
                </div>
                {formData.projects.map((project, index) => (
                  <div key={index} className="project-card">
                    <div className="project-header">
                      <span className="project-number">Project {index + 1}</span>
                      {formData.projects.length > 1 && (
                        <button type="button" className="remove-project" onClick={() => removeProject(index)}>✕</button>
                      )}
                    </div>
                    <div className="form-grid">
                      <div className="form-field">
                        <label><span className="field-icon">📌</span>Title *</label>
                        <input value={project.title} onChange={(e) => handleProjectChange(index, 'title', e.target.value)} placeholder="Project Name" className="field-input" required={index === 0} />
                      </div>
                      <div className="form-field">
                        <label><span className="field-icon">🔗</span>Link</label>
                        <input value={project.link} onChange={(e) => handleProjectChange(index, 'link', e.target.value)} placeholder="https://..." className="field-input" />
                      </div>
                      <div className="form-field full-width">
                        <label><span className="field-icon">📄</span>Description</label>
                        <textarea value={project.description} onChange={(e) => handleProjectChange(index, 'description', e.target.value)} placeholder="What does this project do?" className="field-input" rows="2" />
                      </div>
                    </div>
                  </div>
                ))}
                <button type="button" className="add-project-btn" onClick={addProject}>
                  <span>+</span> Add Another Project
                </button>
              </div>

              {/* Generate */}
              <button type="submit" className="submit-btn" disabled={loading}>
                {loading ? (
                  <><div className="btn-spinner"></div><span>Generating with Cloned Design...</span></>
                ) : (
                  <span>🚀 Generate My Portfolio</span>
                )}
              </button>
            </form>

            <button className="text-link" style={{ marginTop: '1rem', display: 'block', textAlign: 'center', opacity: 0.7 }}
              onClick={() => {
                setCloneFlow(false)
                setClonedTemplateId(null)
                setShowLanding(true)
              }}>
              ← Back to choose a different method
            </button>
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
      )}
    </>
  )
}

export default App
