import { useState } from 'react'

function App() {
  const [formData, setFormData] = useState({
    name: '',
    role: '',
    bio: '',
    skills: '',
    projects: [{ title: '', description: '', link: '' }]
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

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
        body: JSON.stringify(formData)
      })

      if (!response.ok) {
        throw new Error('Generation failed')
      }

      const blob = await response.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `portfolio-${formData.name.replace(/\s+/g, '-').toLowerCase()}.zip`
      document.body.appendChild(a)
      a.click()
      window.URL.revokeObjectURL(url)
      document.body.removeChild(a)

      setSuccess('✨ Portfolio generated successfully! Download started.')
    } catch (err) {
      setError('Failed to generate portfolio. Please try again.')
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="container">
      <div className="header">
        <h1>✨ AI Portfolio Generator</h1>
        <p>Create your stunning portfolio in seconds</p>
      </div>

      {error && <div className="error">{error}</div>}
      {success && <div className="success">{success}</div>}

      <form onSubmit={handleSubmit}>
        <div className="form-group">
          <label htmlFor="name">Full Name *</label>
          <input
            type="text"
            id="name"
            name="name"
            value={formData.name}
            onChange={handleInputChange}
            placeholder="John Doe"
            required
          />
        </div>

        <div className="form-group">
          <label htmlFor="role">Role / Title</label>
          <input
            type="text"
            id="role"
            name="role"
            value={formData.role}
            onChange={handleInputChange}
            placeholder="Full Stack Developer"
          />
        </div>

        <div className="form-group">
          <label htmlFor="bio">Bio</label>
          <textarea
            id="bio"
            name="bio"
            value={formData.bio}
            onChange={handleInputChange}
            placeholder="Tell us about yourself..."
          />
        </div>

        <div className="form-group">
          <label htmlFor="skills">Skills (comma separated)</label>
          <input
            type="text"
            id="skills"
            name="skills"
            value={formData.skills}
            onChange={handleInputChange}
            placeholder="JavaScript, React, Node.js, MongoDB"
          />
        </div>

        <div className="projects-section">
          <h3>Projects</h3>
          {formData.projects.map((project, index) => (
            <div key={index} className="project-card">
              <div className="project-header">
                <strong>Project {index + 1}</strong>
                {formData.projects.length > 1 && (
                  <button
                    type="button"
                    className="btn-remove"
                    onClick={() => removeProject(index)}
                  >
                    Remove
                  </button>
                )}
              </div>
              <div className="form-group">
                <label htmlFor={`project-title-${index}`}>Project Title *</label>
                <input
                  type="text"
                  id={`project-title-${index}`}
                  value={project.title}
                  onChange={(e) => handleProjectChange(index, 'title', e.target.value)}
                  placeholder="My Awesome Project"
                  required
                />
              </div>
              <div className="form-group">
                <label htmlFor={`project-desc-${index}`}>Description</label>
                <textarea
                  id={`project-desc-${index}`}
                  value={project.description}
                  onChange={(e) => handleProjectChange(index, 'description', e.target.value)}
                  placeholder="Brief description of your project..."
                />
              </div>
              <div className="form-group">
                <label htmlFor={`project-link-${index}`}>Link (optional)</label>
                <input
                  type="url"
                  id={`project-link-${index}`}
                  value={project.link}
                  onChange={(e) => handleProjectChange(index, 'link', e.target.value)}
                  placeholder="https://github.com/username/project"
                />
              </div>
            </div>
          ))}
          <button type="button" className="btn-add" onClick={addProject}>
            + Add Another Project
          </button>
        </div>

        <button type="submit" className="btn-generate" disabled={loading}>
          {loading ? (
            <div className="loading">
              <div className="spinner"></div>
              Generating your portfolio...
            </div>
          ) : (
            '🚀 Generate My Portfolio'
          )}
        </button>
      </form>
    </div>
  )
}

export default App
