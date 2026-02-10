# FocusFlow

![Version](https://img.shields.io/badge/version-v0.0.4-blue.svg)
![PWA](https://img.shields.io/badge/PWA-Yes-success.svg)
![License](https://img.shields.io/badge/license-MIT-green.svg)

A privacy-first, offline-first Progressive Web App designed to help you achieve and sustain deep focus. FocusFlow combines a precision Pomodoro timer, task queue, ambient audio engine, and visual analytics into a seamless, installable application that works entirely offline.

**No accounts. No tracking. No external dependencies. Your data stays on your device.**

---

## Why FocusFlow?

Productivity isn't about doing more—it's about protecting your attention. FocusFlow creates the conditions for **flow state**: that rare zone where time dissolves and deep work happens naturally. By combining proven focus techniques with ambient audio, distraction-free design, and native OS integrations, FocusFlow helps you stop multitasking and start finishing.

**Offline-First Architecture**: Whether you're on a plane, in a coffee shop with spotty WiFi, or simply want to minimize distractions, FocusFlow works seamlessly without an internet connection. Install it once, use it forever.

---

## Key Features

### Core Functionality
- **Precision Timer** — Drift-corrected Pomodoro logic using `Date.now()` ensures accuracy even when browser tabs are backgrounded or devices sleep.
- **State Recovery** — Timer state persists across app closures and device restarts. Resume exactly where you left off.
- **Task Queue** — Add, prioritize, and complete tasks. The active task stays highlighted to maintain single-task focus.
- **Session Analytics** — Canvas-rendered bar charts visualize your focus history over the last 7 days.

### Audio Engine
- **Brown Noise Generator** — Web Audio API-powered ambient sound with adjustable volume to mask distractions and promote concentration.
- **Media Session Integration** — Control audio playback from your device's lock screen and notification center.

### Customization
- **Theme Switcher** — Three visual themes to match your environment:
  - **Default** — Slate/Blue professional dark theme
  - **Midnight** — Pure black OLED-optimized with purple accents
  - **Forest** — Calming dark green/emerald palette
- **Custom Focus Duration** — Set your preferred focus session length (1-120 minutes).
- **Data Backup** — Export and import all your data as JSON for backup or device migration.

### Privacy by Design
- All data persists in browser `localStorage`
- Zero network requests
- No analytics or telemetry
- Fully functional offline

---

## Progressive Web App (PWA) Features

FocusFlow v0.0.4 is a fully-featured Progressive Web App that integrates deeply with your operating system:

### Installation & App Experience
- **Install Prompt** — Add FocusFlow to your home screen (mobile) or desktop (Windows/macOS/Linux) for a native app experience
- **Standalone Display** — Runs as a standalone app without browser chrome, including Window Controls Overlay support on desktop
- **App Shortcuts** — Long-press the app icon for quick actions:
  - **Start Focus** — Jump directly into a focus session
  - **Add Task** — Instantly open the task input

### Native OS Integrations
- **Wake Lock API** — Prevents your screen from sleeping while the timer is running (mobile & desktop)
- **Haptics API** — Tactile feedback on task completion and timer finish (supported devices)
- **Badging API** — App icon shows badge count for pending tasks or timer indicator
- **Media Session API** — Lock screen and notification center controls for ambient audio
- **Offline Detection** — Visual indicator when connection is lost; app continues functioning normally

### State Persistence & Recovery
- **Timer Persistence** — Timer state saves every second to localStorage
- **Background Recovery** — If the app is closed or device restarted, the timer resumes with correct remaining time
- **Session Completion Detection** — Automatically detects if a session completed while the app was closed and records it

---

## Keyboard Shortcuts

| Key       | Action                     |
|-----------|----------------------------|
| `Space`   | Toggle Timer (Play/Pause)  |
| `N`       | Focus New Task Input       |
| `Esc`     | Close Open Modals          |

---

## Running the App

### ⚠️ Important: HTTP Server Required

Due to the Service Worker implementation for offline functionality, **FocusFlow cannot run by simply double-clicking `index.html`**. The Service Worker requires a secure context (HTTPS) or localhost (HTTP) to function properly.

### Quick Start Options

#### Option 1: VS Code Live Server (Recommended)
1. Install the "Live Server" extension in VS Code
2. Right-click on `index.html` and select "Open with Live Server"
3. The app opens at `http://127.0.0.1:5500` (or similar)

#### Option 2: Node.js Serve
```bash
# Install serve globally
npm install -g serve

# Navigate to project directory
cd focusflow

# Start the server
serve .

# Open http://localhost:3000 in your browser
```

#### Option 3: Python HTTP Server
```bash
# Python 3
cd focusflow
python -m http.server 8000

# Open http://localhost:8000 in your browser
```

#### Option 4: PHP Built-in Server
```bash
cd focusflow
php -S localhost:8000
```

### Installation as PWA

Once running on a local server:

1. **Desktop (Chrome/Edge)**:
   - Look for the install icon (📥) in the address bar
   - Or open Settings → Install FocusFlow
   - App installs to your desktop/start menu

2. **Mobile (Chrome/Safari)**:
   - Chrome: Tap menu → "Add to Home screen"
   - Safari: Tap share button → "Add to Home Screen"

3. **Offline Usage**:
   - After first load, all assets are cached
   - Close the browser completely
   - Reopen the installed app—it works offline

---

## Project Structure

```
focusflow/
├── index.html          # Application markup and structure
├── style.css           # Glassmorphism UI styles with theming
├── script.js           # Modular JavaScript (19 modules)
├── sw.js               # Service Worker for offline caching
├── manifest.json       # PWA manifest (icons, shortcuts, display)
└── README.md           # Documentation
```

---

## Browser Support

FocusFlow is optimized for modern browsers with full PWA support:

| Feature | Chrome | Edge | Safari | Firefox |
|---------|--------|------|--------|---------|
| Core App | ✅ 90+ | ✅ 90+ | ✅ 14+ | ✅ 90+ |
| PWA Install | ✅ | ✅ | ✅ (iOS 16.4+) | ❌ |
| Service Worker | ✅ | ✅ | ✅ | ✅ |
| Wake Lock API | ✅ 84+ | ✅ 84+ | ❌ | ❌ |
| Haptics API | ✅ 63+ | ✅ 63+ | ✅ | ❌ |
| Media Session | ✅ 73+ | ✅ 73+ | ✅ 15+ | ❌ |
| Badging API | ✅ 81+ | ✅ 81+ | ❌ | ❌ |

**Recommended**: Chrome, Edge, or Safari for the full PWA experience including native OS integrations.

---

## Tech Stack

| Layer         | Technology                          |
|---------------|-------------------------------------|
| Markup        | HTML5                               |
| Styling       | CSS3 (Custom Properties, Glassmorphism) |
| Logic         | Vanilla JavaScript (ES6+ Modules)   |
| Audio         | Web Audio API                       |
| Graphics      | HTML5 Canvas 2D                     |
| Persistence   | localStorage                        |
| Offline       | Service Worker (Stale-While-Revalidate) |
| PWA           | Web App Manifest                    |

---

## License

MIT License. See [LICENSE](LICENSE) for details.

---

## Changelog

### v0.0.4 (Stable PWA Release)
- ✨ Full PWA support with Service Worker and Web App Manifest
- ✨ Offline-first architecture—works without internet
- ✨ Installable on desktop and mobile home screens
- ✨ Wake Lock API integration (prevents screen sleep)
- ✨ Haptics API for tactile feedback
- ✨ Media Session API for lock screen controls
- ✨ Badging API for app icon badges
- ✨ App shortcuts for quick actions
- ✨ State recovery—timer persists across app restarts
- ✨ Background sync for analytics
- 🔧 Removed all debugging console statements
- 🔧 Stale-While-Revalidate caching strategy

### v0.0.3
- Added three theme variants (Default, Midnight, Forest)
- Custom focus duration settings (1-120 minutes)
- Data backup/restore functionality (JSON export/import)
- State recovery for timer persistence
- Keyboard shortcuts (Space, N, Esc)

### v0.0.2
- Initial multi-file architecture
- Brown noise generator
- Canvas-based analytics chart
- Task queue with active task highlighting

### v0.0.1
- Initial single-file implementation
- Basic Pomodoro timer
- Simple task list
- LocalStorage persistence
