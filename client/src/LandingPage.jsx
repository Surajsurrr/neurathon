import { useState } from 'react'
import './LandingPage.css'

function LandingPage({ onGetStarted, onResumeUpload, onCloneDesign }) {
  const [showResumeModal, setShowResumeModal] = useState(false)
  const [showCloneModal, setShowCloneModal] = useState(false)
  const [resumeFile, setResumeFile] = useState(null)
  const [uploading, setUploading] = useState(false)
  const [uploadError, setUploadError] = useState('')
  const [cloneUrl, setCloneUrl] = useState('')
  const [cloning, setCloning] = useState(false)
  const [cloneError, setCloneError] = useState('')

  const handleResumeSelect = (e) => {
    const file = e.target.files[0]
    if (file) {
      const validTypes = ['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document']
      if (!validTypes.includes(file.type)) {
        setUploadError('Please upload a PDF or DOC/DOCX file')
        return
      }
      if (file.size > 5 * 1024 * 1024) {
        setUploadError('File size must be less than 5MB')
        return
      }
      setResumeFile(file)
      setUploadError('')
    }
  }

  const handleResumeUpload = async () => {
    if (!resumeFile) {
      setUploadError('Please select a file first')
      return
    }

    setUploading(true)
    setUploadError('')

    const formData = new FormData()
    formData.append('resume', resumeFile)

    try {
      const response = await fetch('http://localhost:3000/api/parse-resume', {
        method: 'POST',
        body: formData
      })

      const data = await response.json()

      if (data.success) {
        setShowResumeModal(false)
        if (onResumeUpload) {
          onResumeUpload(data.extractedData)
        }
      } else {
        setUploadError(data.error || 'Failed to parse resume')
      }
    } catch (error) {
      setUploadError('Error uploading resume. Please try again.')
    } finally {
      setUploading(false)
    }
  }

  const handleClonePortfolio = async () => {
    if (!cloneUrl.trim()) {
      setCloneError('Please enter a portfolio URL')
      return
    }

    // Basic URL validation
    try {
      const url = new URL(cloneUrl.startsWith('http') ? cloneUrl : 'https://' + cloneUrl)
      if (!['http:', 'https:'].includes(url.protocol)) throw new Error()
    } catch {
      setCloneError('Please enter a valid URL (e.g. https://example.com)')
      return
    }

    setCloning(true)
    setCloneError('')

    try {
      const finalUrl = cloneUrl.startsWith('http') ? cloneUrl : 'https://' + cloneUrl
      const response = await fetch('http://localhost:3000/api/clone-portfolio', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: finalUrl })
      })

      const data = await response.json()

      if (data.success) {
        setShowCloneModal(false)
        setCloneUrl('')
        if (onCloneDesign) {
          onCloneDesign({
            clonedTemplateId: data.clonedTemplateId,
            sourceUrl: data.sourceUrl,
            detectedSections: data.detectedSections
          })
        }
      } else {
        setCloneError(data.error || 'Failed to clone portfolio design')
      }
    } catch (error) {
      setCloneError('Error connecting to server. Please try again.')
    } finally {
      setCloning(false)
    }
  }

  return (
    <div className="landing-page">
      
      
              


      {/* How It Works Section */}
      <section className="how-it-works-section">
        <h2 className="section-title">Four Ways to Build Your Portfolio</h2>
        <p className="section-subtitle">
          Choose the method that works best for you - it's that simple!
        </p>
        <div className="methods-grid">
          <div className="method-card" onClick={onGetStarted} style={{ cursor: 'pointer' }}>
            <div className="method-number">01</div>
            <div className="method-icon">✍️</div>
            <h3>Enter Your Details</h3>
            <p>Simply fill in your information, skills, and projects manually. Perfect for those who want complete control over every detail of their portfolio.</p>
            <div className="method-tag">Most Popular</div>
          </div>
          <div className="method-card" onClick={() => setShowResumeModal(true)} style={{ cursor: 'pointer' }}>
            <div className="method-number">02</div>
            <div className="method-icon">📄</div>
            <h3>Upload Your Resume</h3>
            <p>Have a resume ready? Upload it and let our AI extract all the information automatically. Your portfolio will be generated in seconds.</p>
            <div className="method-tag" style={{ background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' }}>Available Now</div>
          </div>
          <div className="method-card" onClick={() => setShowCloneModal(true)} style={{ cursor: 'pointer' }}>
            <div className="method-number">03</div>
            <div className="method-icon">🎨</div>
            <h3>Clone a Portfolio</h3>
            <p>Found a portfolio design you love? Paste its URL and we'll clone the template structure, then you fill in your own details.</p>
            <div className="method-tag" style={{ background: 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)' }}>New ✨</div>
          </div>
          <div className="method-card" onClick={() => window.open('http://172.20.10.8:5174/ai-studio', '_blank')} style={{ cursor: 'pointer' }}>
            <div className="method-number">04</div>
            <div className="method-icon">🐙</div>
            <h3>Upload Your GitHub Link</h3>
            <p>Share your GitHub profile URL and let our system automatically analyze your repositories, contributions, and tech stack to build a portfolio that truly reflects your coding journey.</p>
            <div className="method-tag" style={{ background: 'linear-gradient(135deg, #00c6ff 0%, #0072ff 100%)' }}>GitHub Powered 🔗</div>
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

      {/* Resume Upload Modal */}
      {showResumeModal && (
        <div className="modal-overlay" onClick={() => setShowResumeModal(false)}>
          <div className="resume-modal" onClick={(e) => e.stopPropagation()}>
            <button className="modal-close" onClick={() => setShowResumeModal(false)}>✕</button>
            <h2>Upload Your Resume</h2>
            <p className="modal-subtitle">Upload your resume and let AI do the work</p>
            
            <div className="upload-area">
              <input
                type="file"
                id="resume-upload"
                accept=".pdf,.doc,.docx"
                onChange={handleResumeSelect}
                style={{ display: 'none' }}
              />
              <label htmlFor="resume-upload" className="upload-label">
                <div className="upload-icon">📄</div>
                <div className="upload-text">
                  {resumeFile ? (
                    <>
                      <strong>{resumeFile.name}</strong>
                      <span>Click to change file</span>
                    </>
                  ) : (
                    <>
                      <strong>Click to upload or drag and drop</strong>
                      <span>PDF, DOC, DOCX (Max 5MB)</span>
                    </>
                  )}
                </div>
              </label>
            </div>

            {uploadError && <div className="upload-error">{uploadError}</div>}

            <button 
              className="btn-upload" 
              onClick={handleResumeUpload}
              disabled={!resumeFile || uploading}
            >
              {uploading ? (
                <>
                  <div className="btn-spinner"></div>
                  <span>Extracting Information...</span>
                </>
              ) : (
                <>
                  <span>✨ Extract & Generate Portfolio</span>
                </>
              )}
            </button>
          </div>
        </div>
      )}

      {/* Clone Portfolio Modal */}
      {showCloneModal && (
        <div className="modal-overlay" onClick={() => setShowCloneModal(false)}>
          <div className="resume-modal clone-modal" onClick={(e) => e.stopPropagation()}>
            <button className="modal-close" onClick={() => setShowCloneModal(false)}>✕</button>
            <h2>🎨 Clone a Portfolio Design</h2>
            <p className="modal-subtitle">Paste the URL of any portfolio website and we'll clone its design for you to use with your own content</p>
            
            <div className="clone-input-area">
              <div className="clone-url-field">
                <span className="clone-url-icon">🔗</span>
                <input
                  type="url"
                  value={cloneUrl}
                  onChange={(e) => { setCloneUrl(e.target.value); setCloneError(''); }}
                  placeholder="https://johndoe.github.io/portfolio"
                  className="clone-url-input"
                  onKeyDown={(e) => e.key === 'Enter' && handleClonePortfolio()}
                />
              </div>
              <div className="clone-examples">
                <span>Try:</span>
                <button onClick={() => setCloneUrl('https://brittanychiang.com')}>brittanychiang.com</button>
                <button onClick={() => setCloneUrl('https://mattfarley.ca')}>mattfarley.ca</button>
              </div>
            </div>

            {cloneError && <div className="upload-error">{cloneError}</div>}

            <button 
              className="btn-upload btn-clone" 
              onClick={handleClonePortfolio}
              disabled={!cloneUrl.trim() || cloning}
            >
              {cloning ? (
                <>
                  <div className="btn-spinner"></div>
                  <span>Cloning Design...</span>
                </>
              ) : (
                <span>🚀 Clone Design & Continue</span>
              )}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

export default LandingPage
