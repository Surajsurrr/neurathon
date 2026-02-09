import { useState } from 'react'
import './LandingPage.css'

function LandingPage({ onGetStarted, onResumeUpload }) {
  const [showResumeModal, setShowResumeModal] = useState(false)
  const [resumeFile, setResumeFile] = useState(null)
  const [uploading, setUploading] = useState(false)
  const [uploadError, setUploadError] = useState('')

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

  return (
    <div className="landing-page">
      
      
              


      {/* How It Works Section */}
      <section className="how-it-works-section">
        <h2 className="section-title">Three Ways to Build Your Portfolio</h2>
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
    </div>
  )
}

export default LandingPage
