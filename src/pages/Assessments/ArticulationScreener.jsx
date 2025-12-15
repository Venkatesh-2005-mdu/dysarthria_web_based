import React, { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import AnnotatedWaveformCanvas from "../../components/AnnotatedWaveformCanvas";
import "../Assessments/ArticulationScreener.css";

// TAT (Test of Articulation in Tamil) - Complete word list from official TAT document
const TAT_WORDS = [
  // First Set (S.No 1-33)
  { id: 1, english: "adupu", tamil: "அடுப்பு", ipa: "a-", cr: "a" },
  { id: 2, english: "kan", tamil: "கண்", ipa: "-a-", cr: "a" },
  { id: 3, english: "aranju", tamil: "அரஞ்சு", ipa: "a-", cr: "a" },
  { id: 4, english: "kal", tamil: "கல்", ipa: "-a-", cr: "a" },
  { id: 5, english: "roja", tamil: "ரோஜா", ipa: "a-", cr: "a" },

  { id: 6, english: "itli", tamil: "இட்லி", ipa: "i-", cr: "i" },
  { id: 7, english: "koli", tamil: "கோழி", ipa: "-i", cr: "i" },
  { id: 8, english: "i", tamil: "இ", ipa: "i-", cr: "i" },
  { id: 9, english: "vidu", tamil: " வீடு", ipa: "-i", cr: "i" },
  { id: 10, english: "ti", tamil: "தி", ipa: "-i", cr: "i" },

  { id: 11, english: "utadu", tamil: "உடது", ipa: "u-", cr: "u" },
  { id: 12, english: "mudi", tamil: "முடி", ipa: "-u-", cr: "u" },
  { id: 13, english: "usi", tamil: "உசி", ipa: "u-", cr: "u" },
  { id: 14, english: "nul", tamil: "நூல்", ipa: "-u-", cr: "u" },

  { id: 15, english: "eli", tamil: "எலி", ipa: "e-", cr: "e" },
  { id: 16, english: "elu", tamil: "ஏழு", ipa: "-e-", cr: "e" },
  { id: 17, english: "tengay", tamil: "தேங்காய்", ipa: "-e-", cr: "e" },

  { id: 18, english: "ottagam", tamil: "ஒட்டகம்", ipa: "o-", cr: "o" },
  { id: 19, english: "odu", tamil: "ஓடு", ipa: "o-", cr: "o" },

  { id: 20, english: "kai", tamil: "கை", ipa: "k-", cr: "k" },
  { id: 21, english: "kattarikay", tamil: "கத்தரிக்காய்", ipa: "-k-", cr: "k" },
  { id: 22, english: "kurangu", tamil: "குரங்கு", ipa: "-g-", cr: "g" },
  { id: 23, english: "puttakam", tamil: "புத்தகம்", ipa: "-k-", cr: "k" },

  { id: 24, english: "cavi", tamil: "சாவி", ipa: "c-", cr: "c" },
  { id: 25, english: "pucci", tamil: "பூச்சி", ipa: "-c-", cr: "c" },

  { id: 26, english: "jannal", tamil: "ஜன்னல்", ipa: "j-", cr: "j" },
  { id: 27, english: "manjal", tamil: "மஞ்சள்", ipa: "-j-", cr: "j" },

  { id: 28, english: "puttu", tamil: "புட்டு", ipa: "-t-", cr: "t" },
  { id: 29, english: "caday", tamil: "சடை", ipa: "d-", cr: "d" },
  { id: 30, english: "dappa", tamil: "டப்பா", ipa: "-d-", cr: "d" },

  { id: 31, english: "tatta", tamil: "தட்டா", ipa: "t-", cr: "t" },
  { id: 32, english: "pattu", tamil: "பட்டு", ipa: "-t-", cr: "t" },

  { id: 33, english: "puli", tamil: "புலி", ipa: "p-", cr: "p" },


  // Second Set (S.No 34-66)
    { id: 34, english: "pappa", tamil: "பப்பா", ipa: "-p-", cr: "p" },
  { id: 35, english: "bommay", tamil: "பொம்மை", ipa: "b-", cr: "b" },
  { id: 36, english: "karumbu", tamil: "கரும்பு", ipa: "-b-", cr: "b" },

  { id: 37, english: "sart", tamil: "சார்ட்", ipa: "s-", cr: "s" },
  { id: 38, english: "sippu", tamil: "சிப்பு", ipa: "s-", cr: "s" },
  { id: 39, english: "kasu", tamil: "காசு", ipa: "-s-", cr: "s" },

  { id: 40, english: "mangay", tamil: "மாங்காய்", ipa: "-n-", cr: "n" },
  { id: 41, english: "vandi", tamil: "வண்டி", ipa: "-n-", cr: "n" },
  { id: 42, english: "pen", tamil: "பெண்", ipa: "-n", cr: "n" },
  { id: 43, english: "nay", tamil: "நாய்", ipa: "n-", cr: "n" },

  { id: 44, english: "jannal", tamil: "ஜன்னல்", ipa: "-n-", cr: "n" },
  { id: 45, english: "men", tamil: "மேன்", ipa: "-n", cr: "n" },
  { id: 46, english: "pantu", tamil: "பந்து", ipa: "-n-", cr: "n" },

  { id: 47, english: "unjal", tamil: "உஞ்சல்", ipa: "n-", cr: "n" },

  { id: 48, english: "malay", tamil: "மலை", ipa: "m-", cr: "m" },
  { id: 49, english: "erumbu", tamil: "எறும்பு", ipa: "-m-", cr: "m" },
  { id: 50, english: "maram", tamil: "மரம்", ipa: "-m", cr: "m" },

  { id: 51, english: "valayppalam", tamil: "வழைப்பழம்", ipa: "-l-", cr: "l" },
  { id: 52, english: "simil", tamil: "சிமில்", ipa: "-l", cr: "l" },
  { id: 53, english: "valayal", tamil: "வளையல்", ipa: "-l-", cr: "l" },
  { id: 54, english: "tel", tamil: "தெல்", ipa: "-l", cr: "l" },
  { id: 55, english: "lari", tamil: "லாரி", ipa: "l-", cr: "l" },

  { id: 56, english: "palli", tamil: "பள்ளி", ipa: "-ɭ-", cr: "ḷ" },
  { id: 57, english: "pal", tamil: "பால்", ipa: "-l", cr: "l" },

  { id: 58, english: "rotti", tamil: "ரொட்டி", ipa: "r-", cr: "r" },
  { id: 59, english: "karumbu", tamil: "கரும்பு", ipa: "-r-", cr: "r" },
  { id: 60, english: "kar", tamil: "கார்", ipa: "-r-", cr: "r" },
  { id: 61, english: "neri", tamil: "நெறி", ipa: "-r-", cr: "r" },

  { id: 62, english: "valay", tamil: "வளை", ipa: "v-", cr: "v" },
  { id: 63, english: "tavalay", tamil: "தவளை", ipa: "-v-", cr: "v" },

  { id: 64, english: "yanay", tamil: "யானை", ipa: "y-", cr: "y" },
  { id: 65, english: "muyal", tamil: "முயல்", ipa: "-y-", cr: "y" },
  { id: 66, english: "vay", tamil: "வை", ipa: "-y", cr: "y" }
];


// Scoring criteria
const SCORING_CRITERIA = {
  IPA: "IPA",
  CR: "CR (Consonant Replacement)",
  S: "S (Substitution)",
  O: "O (Omission)",
  D: "D (Distortion)",
  A: "A (Addition)",
};

const ArticulationScreener = () => {
  const navigate = useNavigate();
  const mediaRecorderRef = useRef(null);
  const audioContextRef = useRef(null);
  const streamRef = useRef(null);

  const [selectedWord, setSelectedWord] = useState(null);
  const [recordingState, setRecordingState] = useState({});
  const [recognizedText, setRecognizedText] = useState({});
  const [scores, setScores] = useState({});
  const [expandedWord, setExpandedWord] = useState(null);
  const [showNotes, setShowNotes] = useState(false);
  const [notes, setNotes] = useState({});
  const [speechRecognitionActive, setSpeechRecognitionActive] = useState(false);

  // Initialize Web Speech API for speech-to-text
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  const recognitionRef = useRef(null);

  useEffect(() => {
    if (SpeechRecognition) {
      recognitionRef.current = new SpeechRecognition();
      recognitionRef.current.continuous = false;
      recognitionRef.current.interimResults = true;
      recognitionRef.current.lang = "ta-IN"; // Tamil language

      recognitionRef.current.onstart = () => {
        setSpeechRecognitionActive(true);
      };

      recognitionRef.current.onend = () => {
        setSpeechRecognitionActive(false);
      };

      recognitionRef.current.onerror = (event) => {
        console.error("Speech recognition error:", event.error);
        setSpeechRecognitionActive(false);
      };
    }

    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
      }
    };
  }, []);

  const startRecording = async (wordId) => {
    try {
      if (!audioContextRef.current) {
        audioContextRef.current = new (window.AudioContext || window.webkitAudioContext)();
      }

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      mediaRecorderRef.current = new MediaRecorder(stream);
      const chunks = [];

      mediaRecorderRef.current.ondataavailable = (e) => chunks.push(e.data);
      mediaRecorderRef.current.onstop = async () => {
        const blob = new Blob(chunks, { type: "audio/webm" });
        await analyzeAudioBlob(blob, wordId);
        startSpeechRecognition(wordId);
        
        // Save blob to state so it can be played back
        setRecordingState((prev) => ({
          ...prev,
          [wordId]: { ...prev[wordId], blob },
        }));
      };

      mediaRecorderRef.current.start();

      setRecordingState((prev) => ({
        ...prev,
        [wordId]: { recording: true, startTime: Date.now() },
      }));
    } catch (err) {
      console.error("Error accessing microphone:", err);
      alert("Microphone access denied");
    }
  };

  const stopRecording = (wordId) => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      mediaRecorderRef.current.stop();

      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
      }

      const duration = recordingState[wordId]
        ? ((Date.now() - recordingState[wordId].startTime) / 1000).toFixed(2)
        : 0;

      setRecordingState((prev) => ({
        ...prev,
        [wordId]: { ...prev[wordId], recording: false, duration },
      }));
    }
  };

  const analyzeAudioBlob = async (blob, wordId) => {
    try {
      const audioContext = audioContextRef.current;
      const arrayBuffer = await blob.arrayBuffer();
      const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);

      const waveform = audioBuffer.getChannelData(0);
      const samplingRate = audioBuffer.sampleRate;

      // Downsample for visualization
      const factor = Math.max(1, Math.floor(waveform.length / 3000));
      const downsampledWaveform = Array.from(waveform).slice(0, Math.min(waveform.length, 3000 * factor)).filter((_, i) => i % factor === 0);

      setRecordingState((prev) => ({
        ...prev,
        [wordId]: {
          ...prev[wordId],
          waveform: downsampledWaveform,
          samplingRate,
        },
      }));
    } catch (err) {
      console.error("Error analyzing audio:", err);
    }
  };

  const startSpeechRecognition = (wordId) => {
    if (!recognitionRef.current) {
      console.log("Speech Recognition not supported in this browser");
      return;
    }

    recognitionRef.current.onresult = (event) => {
      let transcription = "";
      for (let i = event.resultIndex; i < event.results.length; i++) {
        transcription += event.results[i][0].transcript;
      }
      setRecognizedText((prev) => ({
        ...prev,
        [wordId]: transcription.trim(),
      }));
    };

    try {
      recognitionRef.current.start();
    } catch (err) {
      console.error("Error starting speech recognition:", err);
    }
  };

  const updateScore = (wordId, criterion, value) => {
    setScores((prev) => ({
      ...prev,
      [wordId]: {
        ...(prev[wordId] || {}),
        [criterion]: value,
      },
    }));
  };

  const updateNote = (wordId, note) => {
    setNotes((prev) => ({
      ...prev,
      [wordId]: note,
    }));
  };

  const playRecording = (wordId) => {
    if (recordingState[wordId]?.blob) {
      const url = URL.createObjectURL(recordingState[wordId].blob);
      const audio = new Audio(url);
      audio.play();
    }
  };

  const clearRecording = (wordId) => {
    setRecordingState((prev) => {
      const updated = { ...prev };
      delete updated[wordId];
      return updated;
    });
    setRecognizedText((prev) => {
      const updated = { ...prev };
      delete updated[wordId];
      return updated;
    });
  };

  const handleSaveAndReturn = async () => {
    // Prepare data for backend submission
    const assessmentData = {
      words: TAT_WORDS.map((word) => ({
        id: word.id,
        english: word.english,
        tamil: word.tamil,
        ipa: word.ipa,
        cr: word.cr,
        recordedText: recognizedText[word.id] || "",
        scores: scores[word.id] || {},
        notes: notes[word.id] || "",
        audioData: recordingState[word.id]?.waveform || [],
        samplingRate: recordingState[word.id]?.samplingRate || 0,
      })),
    };

    console.log("Assessment Data:", assessmentData);
    // TODO: Send to backend for storage
    navigate("/assessmenthome");
  };

  return (
    <div className="as-wrapper">
      {/* Premium Navbar */}
      <nav className="as-navbar">
        <div className="navbar-left">
          <button className="nav-back-btn" onClick={() => navigate("/assessmenthome")}>
            ← Back
          </button>
          <h2 className="navbar-title">Articulation Screener - Tamil (TAT)</h2>
        </div>
        <div className="navbar-right">
          <div className="nav-progress">
            <span className="progress-label">Step 5 of 6</span>
            <div className="progress-bar">
              <div className="progress-fill" style={{ width: "83.33%" }} />
            </div>
          </div>
        </div>
      </nav>

      {/* Breadcrumb Navigation */}
      <div className="as-breadcrumb">
        <span>Dashboard</span>
        <span className="breadcrumb-separator">›</span>
        <span>Assessments</span>
        <span className="breadcrumb-separator">›</span>
        <span className="breadcrumb-current">Articulation Screener</span>
      </div>

      {/* Instructions Card */}
      <div className="as-instructions glass-card">
        <div className="instructions-header">
          <h3 className="instructions-title">Test of Articulation in Tamil (TAT)</h3>
        </div>
        <div className="instructions-tips">
          <div className="tip-item">
            <span className="tip-icon">🎤</span>
            <p><strong>Record Each Word:</strong> Click the record button for each Tamil word and speak clearly at natural speaking rate.</p>
          </div>
          <div className="tip-item">
            <span className="tip-icon">✍</span>
            <p><strong>Scoring Criteria:</strong> Rate each word using S (Severe), O (Obligatory), D (Distorted), A (Age-appropriate) categories.</p>
          </div>
          <div className="tip-item">
            <span className="tip-icon">📊</span>
            <p><strong>Comprehensive Assessment:</strong> 66 Tamil words covering all phonetic positions and articulation patterns.</p>
          </div>
        </div>
      </div>

      {/* Word List Container */}
      <div className="as-container">
        <div className="word-list-grid">
          {TAT_WORDS.map((word) => (
            <div
              key={word.id}
              className={`word-card glass-card ${expandedWord === word.id ? "expanded" : ""} ${
                recordingState[word.id]?.recording ? "recording" : ""
              }`}
              onClick={() => setExpandedWord(expandedWord === word.id ? null : word.id)}
            >
              {/* Collapsed View */}
              <div className="word-card-header">
                <span className="word-id">#{word.id}</span>
                <span className="word-english">{word.english}</span>
                <span className="word-tamil">{word.tamil}</span>
                {recordingState[word.id] && (
                  <span className="recording-indicator">
                    {recordingState[word.id].recording ? "🔴 REC" : "✓"}
                  </span>
                )}
              </div>

              {/* Expanded View */}
              {expandedWord === word.id && (
                <div className="word-card-expanded">
                  {/* IPA & CR Reference */}
                  <div className="reference-section">
                    <div className="ref-item">
                      <label>IPA:</label>
                      <code>{word.ipa}</code>
                    </div>
                    <div className="ref-item">
                      <label>CR:</label>
                      <code>{word.cr}</code>
                    </div>
                  </div>

                  {/* Recording Controls */}
                  <div className="recording-controls">
                    <button
                      className={`btn-record-word ${recordingState[word.id]?.recording ? "recording" : ""}`}
                      onClick={(e) => {
                        e.stopPropagation();
                        if (recordingState[word.id]?.recording) {
                          stopRecording(word.id);
                        } else {
                          startRecording(word.id);
                        }
                      }}
                    >
                      {recordingState[word.id]?.recording
                        ? `⏹ Stop (${((Date.now() - recordingState[word.id].startTime) / 1000).toFixed(1)}s)`
                        : "🎤 Record"}
                    </button>

                    {recordingState[word.id]?.waveform && (
                      <button
                        className="btn-play-word"
                        onClick={(e) => {
                          e.stopPropagation();
                          playRecording(word.id);
                        }}
                      >
                        🔊 Play
                      </button>
                    )}

                    {recordingState[word.id] && (
                      <button
                        className="btn-clear-word"
                        onClick={(e) => {
                          e.stopPropagation();
                          clearRecording(word.id);
                        }}
                      >
                        🗑 Clear
                      </button>
                    )}
                  </div>

                  {/* Waveform Display */}
                  {recordingState[word.id]?.waveform && (
                    <div className="waveform-container-small">
                      <AnnotatedWaveformCanvas
                        waveform={recordingState[word.id].waveform}
                        samplingRate={recordingState[word.id].samplingRate}
                      />
                    </div>
                  )}

                  {/* Transcription */}
                  <div className="transcription-section">
                    <label>Transcribed Text:</label>
                    <div className="transcription-box">
                      {speechRecognitionActive ? (
                        <p className="listening">🎙 Listening...</p>
                      ) : recognizedText[word.id] ? (
                        <p className="text">{recognizedText[word.id]}</p>
                      ) : (
                        <p className="placeholder">Click record and speak the word</p>
                      )}
                    </div>
                  </div>

                  {/* Scoring Section */}
                  <div className="scoring-section">
                    <label>Scores:</label>
                    <div className="scoring-grid">
                      {["S", "O", "D", "A"].map((criterion) => (
                        <div key={criterion} className="score-input">
                          <label>{criterion}</label>
                          <input
                            type="checkbox"
                            checked={scores[word.id]?.[criterion] || false}
                            onChange={(e) => updateScore(word.id, criterion, e.target.checked)}
                            onClick={(e) => e.stopPropagation()}
                          />
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Notes */}
                  <div className="notes-section">
                    <label>Notes:</label>
                    <textarea
                      className="notes-input"
                      value={notes[word.id] || ""}
                      onChange={(e) => updateNote(word.id, e.target.value)}
                      onClick={(e) => e.stopPropagation()}
                      placeholder="SLP observations..."
                      rows={3}
                    />
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Action Buttons */}
      <section className="as-action-section">
        <div className="action-buttons">
          <button className="glass-btn btn-secondary" onClick={() => navigate("/assessmenthome")}>
            ← Back to Assessments
          </button>
          <button className="glass-btn btn-primary" onClick={handleSaveAndReturn}>
            💾 Save & Return Home
          </button>
        </div>
      </section>
    </div>
  );
};

export default ArticulationScreener;