# AI Portfolio Generator — MERN Stack MVP

AI-powered static portfolio website generator built for hackathon.

## Project Structure

```
neurathon/
├── server.js              # Express backend API
├── models/                # MongoDB schemas
│   └── Profile.js
├── templates/             # Handlebars templates
│   └── simple/
│       ├── index.hbs
│       └── style.css
├── client/                # React frontend (Vite)
│   ├── src/
│   │   ├── App.jsx
│   │   ├── main.jsx
│   │   └── index.css
│   └── package.json
└── sample_input.json      # Test payload
```

## Quick Start

### 1. Start Backend

```powershell
cd C:\Users\suraj\neurathon
npm install
node server.js
```

Backend runs on `http://localhost:3000`

### 2. Start Frontend

```powershell
cd C:\Users\suraj\neurathon\client
npm install
npm run dev
```

Frontend runs on `http://localhost:5173`

### 3. Open Browser

Navigate to `http://localhost:5173` and start generating portfolios!

## Features

✨ **Frontend:**
- Beautiful gradient UI with purple/blue theme
- Dynamic project fields (add/remove)
- Form validation and error handling
- Auto-download generated ZIP
- Fully responsive design

🚀 **Backend:**
- Express REST API (`/api/generate`)
- Handlebars template rendering
- ZIP file generation
- MongoDB integration (optional)
- Profile data persistence

## API Endpoints

### POST /api/generate
Generate portfolio ZIP from JSON input.

**Request:**
```json
{
  "name": "John Doe",
  "role": "Full Stack Developer",
  "bio": "Passionate developer...",
  "skills": "React, Node.js, MongoDB",
  "projects": [
    {
      "title": "Project Name",
      "description": "Project description",
      "link": "https://example.com"
    }
  ]
}
```

**Response:** ZIP file download

## Next Steps

- [ ] Add LLM integration (OpenAI API)
- [ ] Multiple template selection
- [ ] GitHub Pages deployment
- [ ] Image upload/generation
- [ ] User authentication

## MongoDB Setup (Optional)

To enable profile persistence:

1. Install MongoDB: `winget install MongoDB.Server`
2. Start service: `net start MongoDB`
3. Update `.env`: `MONGODB_URI=mongodb://127.0.0.1:27017/ai-portfolio`
