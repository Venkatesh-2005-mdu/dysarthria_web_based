import React, { useState } from 'react';
import './SpeechTasks.css';

export default function SpeechTasks({ assessment, onTaskComplete }) {
  const [currentTaskIndex, setCurrentTaskIndex] = useState(0);
  const [completedTasks, setCompletedTasks] = useState(new Set());

  const tasks = {
    phonation: [
      { id: 1, name: 'Sustained /a/', instruction: 'Hold the sound /a/ for as long as you can', example: 'aaaaaaa...' },
      { id: 2, name: 'Sustained /e/', instruction: 'Hold the sound /e/ for as long as you can', example: 'eeeeeee...' },
      { id: 3, name: 'Sustained /i/', instruction: 'Hold the sound /i/ for as long as you can', example: 'iiiiiii...' },
      { id: 4, name: 'Sustained /o/', instruction: 'Hold the sound /o/ for as long as you can', example: 'ooooooo...' },
      { id: 5, name: 'Sustained /u/', instruction: 'Hold the sound /u/ for as long as you can', example: 'uuuuuuu...' },
    ],
    'rate-of-speech': [
      { id: 1, name: 'Picture Description', instruction: 'Describe what you see in the image at normal speed', example: 'The boy is playing with a ball...' },
      { id: 2, name: 'Reading', instruction: 'Read the provided text aloud at your normal pace', example: 'The quick brown fox jumps over the lazy dog.' },
      { id: 3, name: 'Conversation', instruction: 'Answer the following question in conversational speech', example: 'What did you have for breakfast today?' },
    ],
    'resonance': [
      { id: 1, name: 'Nasal Consonants', instruction: 'Say these words: mama, nana, no', example: 'mama, nana, no' },
      { id: 2, name: 'Oral Consonants', instruction: 'Say these words: pop, tat, kak', example: 'pop, tat, kak' },
      { id: 3, name: 'Sentences', instruction: 'Read these sentences: Mama made muffins. Nan is nine.', example: 'Mama made muffins. Nan is nine.' },
    ],
    'articulation': [
      { id: 1, name: 'Single Sounds', instruction: 'Say each sound clearly: /p/, /t/, /k/', example: '/p/, /t/, /k/' },
      { id: 2, name: 'Words', instruction: 'Say these words: pop, top, cop, pat, cat, map', example: 'pop, top, cop, pat, cat, map' },
      { id: 3, name: 'Sentences', instruction: 'Say: Peter put the pot on the porch.', example: 'Peter put the pot on the porch.' },
    ],
    'sz-ratio': [
      { id: 1, name: 'Sustained /s/', instruction: 'Hold the sound /s/ as long as you can', example: 'sssssss...' },
      { id: 2, name: 'Sustained /z/', instruction: 'Hold the sound /z/ as long as you can', example: 'zzzzzzz...' },
      { id: 3, name: 'Word List', instruction: 'Say these words: sun, zip, six, zoo', example: 'sun, zip, six, zoo' },
    ],
    'pitch': [
      { id: 1, name: 'Low Pitch', instruction: 'Say /a/ at your lowest comfortable pitch', example: 'aaaa (low)' },
      { id: 2, name: 'Normal Pitch', instruction: 'Say /a/ at your normal speaking pitch', example: 'aaaa (normal)' },
      { id: 3, name: 'High Pitch', instruction: 'Say /a/ at your highest comfortable pitch', example: 'aaaa (high)' },
      { id: 4, name: 'Pitch Variation', instruction: 'Say: "Where are you going?" with natural intonation', example: 'Where are you going?' },
    ],
    'pataka': [
      { id: 1, name: 'Pataka', instruction: 'Repeat pa-ta-ka repeatedly as fast as you can', example: 'pa-ta-ka, pa-ta-ka, pa-ta-ka...' },
      { id: 2, name: 'Bababa', instruction: 'Repeat ba-ba-ba repeatedly as fast as you can', example: 'ba-ba-ba, ba-ba-ba...' },
      { id: 3, name: 'Tatata', instruction: 'Repeat ta-ta-ta repeatedly as fast as you can', example: 'ta-ta-ta, ta-ta-ta...' },
    ],
  };

  const currentTasks = tasks[assessment] || [];
  const currentTask = currentTasks[currentTaskIndex];

  const handleTaskComplete = () => {
    const newCompleted = new Set(completedTasks);
    newCompleted.add(currentTaskIndex);
    setCompletedTasks(newCompleted);

    if (currentTaskIndex < currentTasks.length - 1) {
      setCurrentTaskIndex(currentTaskIndex + 1);
    } else {
      // All tasks completed
      if (onTaskComplete) {
        onTaskComplete(true);
      }
    }
  };

  const handleSkipTask = () => {
    if (currentTaskIndex < currentTasks.length - 1) {
      setCurrentTaskIndex(currentTaskIndex + 1);
    } else {
      if (onTaskComplete) {
        onTaskComplete(false);
      }
    }
  };

  return (
    <div className="speech-tasks">
      <div className="tasks-header">
        <h2>Speech Tasks for {assessment}</h2>
        <div className="progress">
          <p>{completedTasks.size} of {currentTasks.length} completed</p>
          <div className="progress-bar">
            <div
              className="progress-fill"
              style={{ width: `${(completedTasks.size / currentTasks.length) * 100}%` }}
            />
          </div>
        </div>
      </div>

      {currentTask && (
        <div className="current-task">
          <div className="task-number">
            Task {currentTaskIndex + 1} of {currentTasks.length}
          </div>
          <div className="task-content">
            <h3>{currentTask.name}</h3>
            <div className="task-instruction">
              <p>{currentTask.instruction}</p>
            </div>
            <div className="task-example">
              <strong>Example:</strong>
              <p className="example-text">"{currentTask.example}"</p>
            </div>
          </div>

          <div className="task-controls">
            <button onClick={handleSkipTask} className="btn-skip">
              Skip Task
            </button>
            <button onClick={handleTaskComplete} className="btn-complete">
              Task Complete ✓
            </button>
          </div>

          <div className="task-list">
            <h4>Task Progress</h4>
            <ul>
              {currentTasks.map((task, index) => (
                <li
                  key={task.id}
                  className={`task-item ${index === currentTaskIndex ? 'current' : ''} ${completedTasks.has(index) ? 'completed' : ''}`}
                >
                  {completedTasks.has(index) ? '✓' : index === currentTaskIndex ? '→' : '○'} {task.name}
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </div>
  );
}
