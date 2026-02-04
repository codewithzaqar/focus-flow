# FocusFlow

![Version](https://img.shields.io/badge/version-v0.0.2-blue.svg)
![License](https://img.shields.io/badge/license-MIT-green.svg)
![Size](https://img.shields.io/badge/size-%3C20KB-orange.svg)

**FocusFlow** is a lightweight, privacy-focused productivity application designed to help you enter flow states. It combines a Pomodoro timer, a task management queue, native analytics, and a generative audio engine—all contained within a **single HTML file**.

No servers, no tracking, no external dependencies.

## ✨ Features (v0.0.2)

*   **⏱️ Precision Timer:** Drift-corrected logic using `Date.now()` ensures accuracy even when the tab is backgrounded.
*   **📝 Task Queue:** Add, prioritize, and check off tasks. "Active" tasks are highlighted to keep you focused on one thing at a time.
*   **📊 Native Analytics:** visualizing your focus history over the last 7 days using the HTML5 Canvas API.
*   **🔊 Generative Audio Engine:** Integrated "Brown Noise" generator (via Web Audio API) with volume control to mask distractions.
*   **💾 Local Persistence:** All data (tasks, history, settings) is stored in your browser's `localStorage`. Your data never leaves your device.
*   **🎉 Rewards:** Satisfying animations and confetti effects upon session completion.

## 🚀 Getting Started

### Prerequisites
*   A modern web browser (Chrome, Firefox, Safari, Edge).
*   That's it. No Node.js, Python, or servers required.

### Installation
1.  Clone this repository:
    ```bash
    git clone https://github.com/yourusername/focusflow.git
    ```
2.  Navigate to the folder:
    ```bash
    cd focusflow
    ```
3.  **Run the app:**
    Double-click `index.html` to open it in your browser.

## 🛠️ Tech Stack

*   **Core:** HTML5, CSS3, Vanilla JavaScript (ES6+).
*   **State Management:** Reactive Object pattern (No frameworks).
*   **Data:** Browser `localStorage`.
*   **Audio:** Web Audio API (Oscillators and GainNodes).
*   **Graphics:** HTML5 Canvas (2D Context).

## 📂 Project Structure

This project utilizes a **Single File Architecture (SFA)**.

```text
focusflow/
├── index.html       # The entire application (Logic, Styles, Markup)
├── README.md        # Documentation
└── .gitignore       # Git configuration