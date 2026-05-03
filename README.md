# DocShift — PDF to Word & Excel Converter

Free, open-source PDF converter. No sign-up, no watermarks, no paid APIs.
Everything runs on **free tiers** — Railway (backend) + Vercel (frontend).

---

## Stack

| Layer | Technology | Cost |
|---|---|---|
| Frontend | React + Vite | Free (Vercel) |
| Backend | Python + FastAPI | Free (Railway) |
| PDF → Word | `pdf2docx` (offline) | Free |
| PDF → Excel | `pdfplumber` + `openpyxl` (offline) | Free |
| File storage | None — temp files deleted in 5 min | Free |
| Rate limiting | `slowapi` (10 req/min per IP) | Free |

---

## Project Structure

```
pdf-converter/
├── backend/
│   ├── main.py            ← FastAPI app (conversion logic)
│   ├── requirements.txt
│   ├── Dockerfile
│   ├── Procfile           ← Railway process file
│   └── railway.toml       ← Railway config
├── frontend/
│   ├── src/
│   │   ├── App.jsx        ← Main UI
│   │   ├── main.jsx
│   │   └── index.css
│   ├── public/
│   │   └── favicon.svg
│   ├── index.html
│   ├── package.json
│   ├── vite.config.js     ← Dev proxy to backend
│   ├── nginx.conf         ← Production nginx
│   ├── Dockerfile
│   └── vercel.json        ← Vercel config
└── docker-compose.yml     ← Local full-stack dev
```

---

## Option A: Run Locally (Docker — Easiest)

### Requirements
- [Docker Desktop](https://www.docker.com/products/docker-desktop/) installed

### Steps

```bash
# 1. Clone or download this project
git clone <your-repo-url> pdf-converter
cd pdf-converter

# 2. Start everything
docker compose up --build

# 3. Open in browser
#    Frontend: http://localhost:3000
#    Backend API docs: http://localhost:8000/docs
```

That's it. Both services start automatically.

---

## Option B: Run Locally (No Docker)

### Backend

#### Requirements
- Python 3.10 or 3.11
- On Linux/Mac: `libgl1` for pdf2docx (usually pre-installed)

```bash
cd backend

# Create virtual environment
python -m venv venv
source venv/bin/activate        # Windows: venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Start backend
uvicorn main:app --reload --port 8000
```

Backend runs at http://localhost:8000
API docs at http://localhost:8000/docs

#### Ubuntu/Debian system deps (if pdf2docx fails):
```bash
sudo apt-get install libgl1-mesa-glx libglib2.0-0
```

#### macOS (if needed):
```bash
brew install openblas
```

---

### Frontend

#### Requirements
- Node.js 18+

```bash
cd frontend

# Install dependencies
npm install

# Start dev server (auto-proxies /convert to localhost:8000)
npm run dev
```

Frontend runs at http://localhost:3000

---

## Option C: Deploy to Production (FREE)

### Step 1: Deploy Backend to Railway

Railway gives you $5/mo free credits — more than enough for this app.

1. Go to https://railway.app and sign up (free)
2. Click **New Project → Deploy from GitHub Repo**
3. Connect your GitHub account and select your repo
4. Set **Root Directory** to `backend`
5. Railway auto-detects the Dockerfile and builds it
6. Wait for deploy — grab your URL like `https://your-app.railway.app`
7. Test: visit `https://your-app.railway.app/health` — should return `{"status":"ok"}`

**Environment Variables (Railway dashboard → Variables):**
None required. The app works with defaults.

---

### Step 2: Deploy Frontend to Vercel

Vercel is 100% free for personal projects.

1. Go to https://vercel.com and sign up (free)
2. Click **Add New → Project → Import Git Repository**
3. Select your repo, set **Root Directory** to `frontend`
4. Add this **Environment Variable**:
   - Key: `VITE_API_URL`
   - Value: `https://your-app.railway.app` ← your Railway URL from Step 1
5. Click **Deploy**
6. Vercel gives you a URL like `https://docshift.vercel.app`

---

### Step 3: Fix CORS (Important!)

After deploying, update the CORS origin in `backend/main.py`:

```python
# Line ~47 in main.py — change from:
allow_origins=["*"],

# To your actual frontend URL:
allow_origins=["https://your-docshift.vercel.app"],
```

Then push to GitHub — Railway redeploys automatically.

---

## API Reference

### `POST /convert/word`
Converts a PDF to `.docx`

**Request:** `multipart/form-data`
- `file`: PDF file (max 50 MB)

**Response:** `.docx` file download

---

### `POST /convert/excel`
Converts PDF tables to `.xlsx`

**Request:** `multipart/form-data`
- `file`: PDF file (max 50 MB)

**Response:** `.xlsx` file download

---

### `GET /health`
Health check endpoint. Returns `{"status": "ok"}`

---

## Rate Limits

- 10 conversions per minute per IP address
- Files auto-deleted after 5 minutes
- Max file size: 50 MB

---

## Limitations

| Scenario | Result |
|---|---|
| Text-based PDFs | ✅ Excellent conversion |
| PDFs with tables | ✅ Extracted to Excel sheets |
| Scanned/image PDFs | ⚠️ Poor — needs OCR (not included) |
| Complex multi-column layouts | ⚠️ May need manual cleanup |
| Password-protected PDFs | ❌ Not supported |

### Adding OCR (free, optional)

For scanned PDFs, install Tesseract:

```bash
# Ubuntu/Debian
sudo apt-get install tesseract-ocr
pip install pytesseract pdf2image

# Then preprocess in main.py before conversion
from pdf2image import convert_from_path
import pytesseract
```

---

## Scaling (Still Free)

| Traffic | Solution |
|---|---|
| Low (<100/day) | Railway free tier |
| Medium (<1000/day) | Railway Hobby ($5/mo) |
| High | Add a job queue: Redis + RQ (free on Railway) |

---

## Security Checklist

- [x] File type validation (extension + magic bytes)
- [x] File size limit (50 MB)
- [x] Rate limiting (10 req/min/IP)
- [x] Temp files auto-deleted (5 min)
- [x] No file storage — files never persisted
- [ ] CORS locked to your domain (change `allow_origins` in prod)
- [ ] HTTPS enforced (automatic on Railway + Vercel)

---

## Troubleshooting

**Backend won't start:**
```bash
# Check Python version
python --version   # needs 3.10+

# Install system deps (Ubuntu)
sudo apt-get install libgl1-mesa-glx libglib2.0-0 libgomp1
```

**Conversion fails with "empty file":**
- The PDF may be image-based (scanned). Add OCR support.

**CORS errors in browser:**
- Make sure `VITE_API_URL` is set correctly in Vercel env vars
- Make sure `allow_origins` in `main.py` includes your Vercel domain

**Railway build fails:**
- Check that Root Directory is set to `backend`
- View build logs in the Railway dashboard

---

## License

MIT — use it however you want.
