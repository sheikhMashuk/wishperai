# WishperAI

A desktop AI application powered by Tauri, React, and Python.

## Structure
- `client`: Tauri + React frontend
- `server`: Python backend
- `landing`: Landing page
- `infra`: Infrastructure / deployment configs

## Setup
### Client
```bash
cd client
npm install
npm run tauri dev
```

### Server
```bash
cd server
pip install -r requirements.txt
# run your python entrypoint (e.g. uvicorn app.main:app)
```
