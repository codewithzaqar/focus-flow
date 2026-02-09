# FocusFlow

![Version](https://img.shields.io/badge/version-v0.0.3-blue.svg)
![License](https://img.shields.io/badge/license-MIT-green.svg)

A privacy-first productivity application designed to help you achieve and sustain deep focus. FocusFlow combines a precision Pomodoro timer, task queue, ambient audio engine, and visual analytics into a seamless workflow tool.

No accounts. No tracking. No external dependencies. Your data stays on your device.

---

## Why FocusFlow?

Productivity isn't about doing more—it's about protecting your attention. FocusFlow creates the conditions for **flow state**: that rare zone where time dissolves and deep work happens naturally. By combining proven focus techniques with ambient audio and distraction-free design, FocusFlow helps you stop multitasking and start finishing.

---

## Key Features

### Core Functionality
- **Precision Timer** — Drift-corrected Pomodoro logic using `Date.now()` ensures accuracy even when browser tabs are backgrounded.
- **Task Queue** — Add, prioritize, and complete tasks. The active task stays highlighted to maintain single-task focus.
- **Session Analytics** — Canvas-rendered bar charts visualize your focus history over the last 7 days.

### Audio Engine
- **Brown Noise Generator** — Web Audio API-powered ambient sound with adjustable volume to mask distractions and promote concentration.

### Customization (New in v0.0.3)
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

---

## Keyboard Shortcuts

| Key       | Action                     |
|-----------|----------------------------|
| `Space`   | Toggle Timer (Play/Pause)  |
| `N`       | Focus New Task Input       |
| `Esc`     | Close Open Modals          |

---

## Installation

### Prerequisites
- A modern web browser (Chrome, Firefox, Safari, Edge)

### Quick Start

1. Clone the repository:
   ```bash
   git clone https://github.com/yourusername/focusflow.git
   ```

2. Navigate to the project directory:
   ```bash
   cd focusflow
   ```

3. Open `index.html` in your browser.

No build step. No dependencies. No configuration.

---

## Project Structure

```
focusflow/
├── index.html      # Application markup and structure
├── style.css       # Glassmorphism UI styles with theming
├── script.js       # Modular JavaScript (13 modules)
└── README.md       # Documentation
```

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

---

## License

MIT License. See [LICENSE](LICENSE) for details.

test