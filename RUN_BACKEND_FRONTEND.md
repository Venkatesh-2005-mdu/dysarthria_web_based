# Running Backend and Frontend Together

## Option 1: Run Both in Separate Terminals (Recommended)

### Terminal 1: Backend
```powershell
cd "c:\Users\HP PC\Documents\GitHub\slp-assessment-frontend\backend"
& "C:/Users/HP PC/Documents/GitHub/slp-assessment-frontend/backend_env/Scripts/python.exe" app.py
```

Expected output:
```
INFO:     Started server process [...]
INFO:     Waiting for application startup.
INFO:     Application startup complete.
INFO:     Uvicorn running on http://0.0.0.0:8000 (Press CTRL+C to quit)
```

### Terminal 2: Frontend
```powershell
cd "c:\Users\HP PC\Documents\GitHub\slp-assessment-frontend"
npm run dev
```

Expected output:
```
VITE v... ready in ... ms

➜  Local:   http://localhost:5173/
➜  press h to show help
```

## Option 2: Run Both with a Single Script

Create a file called `run-all.bat` in the project root:

```batch
@echo off
start cmd /k "cd backend && python app.py"
start cmd /k "npm run dev"
pause
```

Then double-click `run-all.bat` to start both servers.

## Option 3: Using PowerShell (Windows)

Run this in PowerShell from the project root:

```powershell
# Start backend in background job
$backendPath = "c:\Users\HP PC\Documents\GitHub\slp-assessment-frontend\backend"
$pythonExe = "C:/Users/HP PC/Documents/GitHub/slp-assessment-frontend/backend_env/Scripts/python.exe"
Start-Job -WorkingDirectory $backendPath -ScriptBlock { & $pythonExe app.py }

# Start frontend
npm run dev
```

## Verification

Once both are running, open your browser to:
- **Frontend**: http://localhost:5173
- **Backend API**: http://localhost:8000 (should show `{"message": "SLP Backend Running Successfully"}`)

## Stopping Servers

- **Frontend**: Press `Ctrl+C` in the terminal
- **Backend**: Press `Ctrl+C` in the terminal
- **Both via script**: Close both command windows or press `Ctrl+C`

## Common Issues

### Backend won't start
- Ensure you're in the `backend` directory
- Check that Python environment is activated: `& "C:/Users/HP PC/Documents/GitHub/slp-assessment-frontend/backend_env/Scripts/Activate.ps1"`
- Verify port 8000 is not in use: `netstat -ano | findstr :8000`

### Frontend won't start
- Ensure you're in the project root directory
- Run `npm install` if dependencies are missing
- Check that port 5173 is not in use: `netstat -ano | findstr :5173`

### API calls failing (404 errors)
- Make sure both servers are running
- Check browser console for CORS errors
- Verify backend is on `http://localhost:8000`
