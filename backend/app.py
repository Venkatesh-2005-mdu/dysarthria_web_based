"""
SLP Assessment Backend - FastAPI Audio Analysis Server
Handles audio processing, analysis, and specialized speech assessment calculations
"""

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
import os
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# Initialize FastAPI app
app = FastAPI(
    title="SLP Assessment Backend",
    description="Audio analysis and speech assessment processing",
    version="1.0.0"
)

# CORS middleware configuration
allowed_origins = os.getenv("CORS_ORIGINS", "http://localhost:5173,http://localhost:3001").split(",")

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Import routes
from routes.rate_of_speech import router as rate_of_speech_router
from routes.phonation_test import router as phonation_router
from routes.resonance_analysis import router as resonance_router
from routes.articulation_screener import router as articulation_router
from routes.sz_ratio import router as sz_router
from routes.pitch_analysis import router as pitch_router
from routes.analyze_vowel import router as vowel_router
from routes.process_pataka import router as pataka_router
from routes.analyze_general import router as general_router

# Include routers
app.include_router(rate_of_speech_router, prefix="/rate-of-speech", tags=["Rate of Speech"])
app.include_router(phonation_router, prefix="/phonation", tags=["Phonation"])
app.include_router(resonance_router, prefix="/resonance", tags=["Resonance"])
app.include_router(articulation_router, prefix="/articulation", tags=["Articulation"])
app.include_router(sz_router, prefix="/sz-ratio", tags=["S/Z Ratio"])
app.include_router(pitch_router, prefix="/pitch", tags=["Pitch Analysis"])
app.include_router(vowel_router, prefix="/vowel", tags=["Vowel Analysis"])
app.include_router(pataka_router, prefix="/pataka", tags=["Pataka"])
app.include_router(general_router, prefix="/analyze", tags=["General Analysis"])

@app.get("/health")
async def health_check():
    """Health check endpoint"""
    return {
        "status": "Python backend is running",
        "service": "SLP Assessment Audio Analysis"
    }

@app.get("/")
async def root():
    """Root endpoint"""
    return {
        "message": "SLP Assessment Backend",
        "service": "Audio Analysis and Speech Processing",
        "endpoints": {
            "health": "/health",
            "rate_of_speech": "/rate-of-speech",
            "phonation": "/phonation",
            "resonance": "/resonance",
            "articulation": "/articulation",
            "sz_ratio": "/sz-ratio",
            "pitch_analysis": "/pitch",
            "vowel_analysis": "/vowel",
            "pataka_analysis": "/pataka",
            "general_analysis": "/analyze"
        }
    }

if __name__ == "__main__":
    import uvicorn
    port = int(os.getenv("PORT", 8000))
    environment = os.getenv("ENVIRONMENT", "development")
    
    uvicorn.run(
        app,
        host="127.0.0.1",
        port=port,
        log_level="info" if environment == "production" else "debug"
    )
