# TrackLeet – Intelligent LeetCode Performance Tracker

TrackLeet is a Chrome Extension that transforms your LeetCode practice into a structured performance intelligence system.

It doesn’t just count solved problems — it analyzes skill growth, topic weaknesses, efficiency trends, and generates intelligent suggestions.

---

## Features

### 1. Real-Time Skill Intelligence

- Dynamic Skill Index (starts at 100)
- Difficulty-weighted growth (Easy/Medium/Hard)
- Anti-farming protection (prevents inflation via easy-only solving)
- Exponential Moving Average smoothing

---

### 2. Advanced Analysis Dashboard (3 Graphs)

**Skill Growth (EMA Smoothed)**

- Tracks long-term progression
- Removes noise from short bursts

**Efficiency Trend**

- Raw efficiency per solve
- Rolling average (window = 5)
- Detects suspicious solves

**Time Per Solve**

- Bar chart of time spent per accepted problem
- Helps identify overthinking or rushed submissions

---

### 3. Topic Intelligence Engine

Multi-factor Topic Strength Score (TSS):

- Acceptance rate
- Efficiency score
- Difficulty weighting (0.3 / 0.5 / 0.8)
- Recent trend (last 5 solves)
- Confidence factor (attempt volume based)

Classification:

- Strong
- Average
- Weak

---

### 4. Deterministic Suggestion Engine

Suggestions are generated using:

- Weak topics
- User-defined goals
- Recent activity
- Difficulty imbalance
- Recency penalties

Each suggestion includes a reason:

- "Matches your goal"
- "Identified weak topic"
- "Worked recently — try deeper problems"

---

### 5. Smart Timer System

- Auto-start on editor focus
- Auto-stop on Accepted / Failed
- Manual Start / Stop from popup
- Tracks time per solve accurately
- No page refresh required

---

### 6. Anti-Farming Protection

If last 5 solves contain ≥ 4 Easy problems:

- Skill growth from Easy is reduced by 50%

Encourages real difficulty progression.

---

## Architecture

Chrome Extension (MV3)

content.js</br>
↓</br>
background.js (Service Worker)</br>
↓</br>
Engines:</br>
a. profileEngine - fetches profile data</br>
b. decayEngine - decays score for inactivity</br>
c. suggestionEngine - recommends questions to attempt</br>
d. topicEngine - categorises weak and strong topics and lets user add target topics</br>
e. streakEngine - maintains streak in the extension (to be improved)</br>
f. skillEngine - for skill calculation and maintainence</br>

decayEngine</br>
↓</br>
chrome.storage.local</br>
↓</br>
popup.js (UI + Charts)</br>

Design Principles:

- Deterministic algorithms
- No external APIs
- Fully client-side
- Modular architecture
- Extensible for AI augmentation later

---

## Project Structure

TrackLeet/</br>
│</br>
├── manifest.json</br>
│</br>
├── background/</br>
│ ├── background.js</br>
│ ├── constants.js</br>
│ ├── storage.js</br>
│ ├── skillEngine.js</br>
│ ├── topicEngine.js</br>
│ ├── suggestionEngine.js</br>
│ ├── decayEngine.js</br>
│</br>
├── content/</br>
│ └── content.js</br>
│</br>
├── popup/</br>
│ ├── popup.html</br>
│ ├── popup.js</br>
│ └── popup.css</br>
│</br>
└── libs/</br>
└── chart.js</br>
</br>

---

## Installation

1. Clone repository:

```bash
git clone https://github.com/Sameep-das/TrackLeet.git
```

2. Open Chrome: chrome://extensions

3. Enable Developer Mode

4. Click Load Unpacked

5. Select the TrackLeet folder

## How It Works
Skill Delta Formula
delta = baseDifficultyWeight × efficiency

Where:

Easy = 0
Medium = 2
Hard = 5
</br>
Efficiency:
</br>
log(expectedTime / actualTime + 1)</br>
Topic Strength Score (TSS)
TSS =</br>
0.4 × acceptanceRate +
0.2 × efficiency +
0.2 × difficultyWeight +
0.2 × recentTrend
</br>
FinalScore = TSS × confidenceFactor</br>
Suggestion Scoring
Score =</br>
0.4 × goalPriority +
0.3 × weaknessWeight +
0.3 × recencyFactor
</br>
Top 5 returned.

## Why This Project Matters

### TrackLeet demonstrates:

- Chrome Extension (Manifest V3)
- Service Worker architecture
- DOM mutation handling (SPA safe)
- Deterministic performance modeling
- Data visualization with Chart.js
- Real-time state synchronization
- Modular software design

## Author

Sameep Das
GitHub: https://github.com/Sameep-das
