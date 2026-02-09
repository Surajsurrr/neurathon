import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import Login from './Login'
import './index.css'
import './premium-styles.css'

const path = window.location.pathname

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    {path === '/login' ? <Login /> : <App />}
  </React.StrictMode>,
)
