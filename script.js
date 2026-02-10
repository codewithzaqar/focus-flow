/* ============================================
   FOCUSFLOW v0.0.4 - JavaScript
   Multi-File Architecture Build (PWA Edition)
   Advanced PWA: Shortcuts, WCO, Wake Lock, Media Session, Haptics, Badging
   ============================================
   
   Modular Architecture:
   1. StorageModule - localStorage management
   2. HistoryModule - ff_history analytics storage
   3. TaskModule - Task queue CRUD operations
   4. TimerModule - Pomodoro timer logic (with Date.now precision + persistence)
   5. AudioModule - Web Audio API brown noise (lazy init)
   6. ChartModule - Canvas API bar chart
   7. ConfettiModule - Celebration effect
   8. SettingsModule - User preferences (with custom duration + theme)
   9. ThemeModule - Theme switching (Default/Midnight/Forest)
   10. UIModule - DOM interactions
   11. AppData - Data backup/restore (JSON Export/Import)
   12. AppInput - Keyboard shortcut handler
   13. AppNetwork - Online/Offline detection
   14. App.PWA - Service Worker registration, install prompt, & update detection
   15. WakeLockModule - Screen Wake Lock API (prevent sleep during timer)
   16. MediaSessionModule - Media Session API (lock screen controls)
   17. HapticsModule - Vibration API (tactile feedback)
   18. BadgeModule - Badging API (app icon badges)
   19. App - Main initialization (with URL shortcut params)
   
   ============================================ */

'use strict';

/* ============================================
   MODULE 1: StorageModule
   Handles all localStorage operations
   ============================================ */
const StorageModule = (() => {
    const KEYS = {
        TASKS: 'focusflow_tasks_v2',
        HISTORY: 'ff_history',
        SETTINGS: 'focusflow_settings_v2',
        THEME: 'focusflow_theme',
        TIMER_STATE: 'focusflow_timer_state'
    };

    const get = (key, fallback = null) => {
        try {
            const data = localStorage.getItem(key);
            return data ? JSON.parse(data) : fallback;
        } catch (e) {
            return fallback;
        }
    };

    const set = (key, value) => {
        try {
            localStorage.setItem(key, JSON.stringify(value));
            return true;
        } catch (e) {
            return false;
        }
    };

    const remove = (key) => {
        try {
            localStorage.removeItem(key);
        } catch (e) { /* ignore */ }
    };

    return { KEYS, get, set, remove };
})();


/* ============================================
   MODULE 2: HistoryModule
   Real analytics with ff_history storage
   Records: {date, duration, taskId, taskName, timestamp}
   ============================================ */
const HistoryModule = (() => {
    const getRecords = () => {
        return StorageModule.get(StorageModule.KEYS.HISTORY, []);
    };

    const saveRecords = (records) => {
        StorageModule.set(StorageModule.KEYS.HISTORY, records);
    };

    // Record a completed focus session
    const recordSession = (duration, taskId = null, taskName = null) => {
        if (duration <= 0) return null;

        const records = getRecords();
        const now = new Date();
        
        const record = {
            date: now.toISOString().split('T')[0],
            duration: duration,
            taskId: taskId,
            taskName: taskName,
            timestamp: now.getTime()
        };

        records.push(record);

        // Keep last 90 days of data
        const cutoff = Date.now() - (90 * 24 * 60 * 60 * 1000);
        const filtered = records.filter(r => r.timestamp > cutoff);
        
        saveRecords(filtered);
        return record;
    };

    // Get aggregated data for last 7 days
    const getLast7Days = () => {
        const records = getRecords();
        const days = [];
        const labels = [];
        const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

        for (let i = 6; i >= 0; i--) {
            const date = new Date();
            date.setDate(date.getDate() - i);
            const dateStr = date.toISOString().split('T')[0];

            const dayTotal = records
                .filter(r => r.date === dateStr)
                .reduce((sum, r) => sum + (r.duration || 0), 0);

            days.push(dayTotal);
            labels.push(dayNames[date.getDay()]);
        }

        return { data: days, labels };
    };

    // Get total stats
    const getStats = () => {
        const records = getRecords();
        const totalMinutes = records.reduce((sum, r) => sum + (r.duration || 0), 0);
        const totalSessions = records.length;
        const avgSession = totalSessions > 0 ? Math.round(totalMinutes / totalSessions) : 0;

        return { totalMinutes, totalSessions, avgSession };
    };

    // Get streak (consecutive days with sessions)
    const getStreak = () => {
        const records = getRecords();
        let streak = 0;
        const today = new Date();

        for (let i = 0; i < 365; i++) {
            const checkDate = new Date(today);
            checkDate.setDate(checkDate.getDate() - i);
            const dateStr = checkDate.toISOString().split('T')[0];

            const hasSession = records.some(r => r.date === dateStr);

            if (hasSession) {
                streak++;
            } else if (i > 0) {
                break;
            }
        }

        return streak;
    };

    // Get today's stats
    const getTodayStats = () => {
        const records = getRecords();
        const today = new Date().toISOString().split('T')[0];
        const todayRecords = records.filter(r => r.date === today);

        return {
            sessions: todayRecords.length,
            minutes: todayRecords.reduce((sum, r) => sum + (r.duration || 0), 0)
        };
    };

    // Clear all history
    const clearHistory = () => {
        saveRecords([]);
    };

    // Check if there's any data
    const hasData = () => {
        return getRecords().length > 0;
    };

    return {
        getRecords,
        recordSession,
        getLast7Days,
        getStats,
        getStreak,
        getTodayStats,
        clearHistory,
        hasData
    };
})();


/* ============================================
   MODULE 3: TaskModule
   Task queue management with CRUD operations
   Sorts: Active > Pending > Completed
   ============================================ */
const TaskModule = (() => {
    const DEFAULT_STATE = { tasks: [], activeTaskId: null };
    let state = { ...DEFAULT_STATE };

    const init = () => {
        const stored = StorageModule.get(StorageModule.KEYS.TASKS, DEFAULT_STATE);
        state.tasks = Array.isArray(stored.tasks) ? stored.tasks : [];
        state.activeTaskId = stored.activeTaskId || null;
        return state;
    };

    const save = () => {
        StorageModule.set(StorageModule.KEYS.TASKS, state);
    };

    const generateId = () => {
        return Date.now().toString(36) + Math.random().toString(36).substr(2, 6);
    };

    const add = (name) => {
        const trimmedName = (name || '').trim();
        if (!trimmedName) return null;
        
        const task = {
            id: generateId(),
            name: trimmedName,
            completed: false,
            createdAt: Date.now()
        };
        
        state.tasks.unshift(task);
        save();
        return task;
    };

    const remove = (id) => {
        state.tasks = state.tasks.filter(t => t.id !== id);
        if (state.activeTaskId === id) {
            state.activeTaskId = null;
        }
        save();
    };

    // Toggle complete and save state
    const toggleComplete = (id) => {
        const task = state.tasks.find(t => t.id === id);
        if (task) {
            task.completed = !task.completed;
            task.completedAt = task.completed ? Date.now() : null;
            
            // Clear active if completed
            if (task.completed && state.activeTaskId === id) {
                state.activeTaskId = null;
            }
            save();
        }
        return task;
    };

    const setActive = (id) => {
        const task = state.tasks.find(t => t.id === id);
        if (task && !task.completed) {
            state.activeTaskId = id;
            save();
        }
    };

    const getActive = () => {
        return state.tasks.find(t => t.id === state.activeTaskId) || null;
    };

    // Get tasks sorted: Active first, then Pending, then Completed
    const getAll = () => {
        const active = state.tasks.filter(t => t.id === state.activeTaskId && !t.completed);
        const pending = state.tasks.filter(t => t.id !== state.activeTaskId && !t.completed);
        const completed = state.tasks.filter(t => t.completed);
        return [...active, ...pending, ...completed];
    };

    const getPendingCount = () => state.tasks.filter(t => !t.completed).length;
    
    const getCompletedCount = () => state.tasks.filter(t => t.completed).length;

    return { 
        init, add, remove, toggleComplete, setActive, 
        getActive, getAll, getPendingCount, getCompletedCount 
    };
})();


/* ============================================
   MODULE 4: TimerModule
   Pomodoro timer with Date.now() precision
   Handles tab switching correctly
   NOW WITH STATE PERSISTENCE
   ============================================ */
const TimerModule = (() => {
    const CIRCUMFERENCE = 2 * Math.PI * 108;
    
    let state = {
        mode: 'focus',
        isRunning: false,
        remainingSeconds: 25 * 60,
        totalSeconds: 25 * 60,
        intervalId: null,
        startTime: null,      // When timer started
        pausedRemaining: null // Remaining when paused
    };

    let callbacks = {
        onTick: null,
        onComplete: null
    };

    // Save timer state to localStorage
    const saveState = () => {
        const persistState = {
            mode: state.mode,
            isRunning: state.isRunning,
            remainingSeconds: state.remainingSeconds,
            totalSeconds: state.totalSeconds,
            targetEndTime: state.isRunning ? Date.now() + (state.remainingSeconds * 1000) : null,
            savedAt: Date.now()
        };
        StorageModule.set(StorageModule.KEYS.TIMER_STATE, persistState);
    };

    // Clear persisted state
    const clearPersistedState = () => {
        StorageModule.remove(StorageModule.KEYS.TIMER_STATE);
    };

    // Restore timer state from localStorage
    const restoreState = () => {
        const saved = StorageModule.get(StorageModule.KEYS.TIMER_STATE, null);
        if (!saved) return null;

        const now = Date.now();
        
        // If timer was running
        if (saved.isRunning && saved.targetEndTime) {
            const remainingMs = saved.targetEndTime - now;
            
            if (remainingMs <= 0) {
                // Timer completed while app was closed
                clearPersistedState();
                return { 
                    completed: true, 
                    mode: saved.mode,
                    totalSeconds: saved.totalSeconds
                };
            } else {
                // Timer still has time remaining
                const remainingSeconds = Math.ceil(remainingMs / 1000);
                return {
                    completed: false,
                    mode: saved.mode,
                    isRunning: true,
                    remainingSeconds: remainingSeconds,
                    totalSeconds: saved.totalSeconds
                };
            }
        } else if (!saved.isRunning && saved.remainingSeconds > 0) {
            // Timer was paused
            return {
                completed: false,
                mode: saved.mode,
                isRunning: false,
                remainingSeconds: saved.remainingSeconds,
                totalSeconds: saved.totalSeconds
            };
        }

        return null;
    };

    const setDuration = (seconds) => {
        state.totalSeconds = seconds;
        state.remainingSeconds = seconds;
        state.pausedRemaining = null;
        state.startTime = null;
    };

    const setMode = (mode) => {
        state.mode = mode;
    };

    const formatTime = (seconds) => {
        const m = Math.floor(seconds / 60);
        const s = seconds % 60;
        return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
    };

    const getProgress = () => {
        if (state.totalSeconds === 0) return 0;
        return state.remainingSeconds / state.totalSeconds;
    };

    const getProgressOffset = () => {
        return CIRCUMFERENCE * (1 - getProgress());
    };

    // Calculate remaining time based on Date.now() for precision
    const calculateRemaining = () => {
        if (!state.startTime) return state.remainingSeconds;
        
        const elapsed = Math.floor((Date.now() - state.startTime) / 1000);
        const remaining = (state.pausedRemaining || state.totalSeconds) - elapsed;
        return Math.max(0, remaining);
    };

    const tick = () => {
        state.remainingSeconds = calculateRemaining();
        
        // Save state on each tick for persistence
        saveState();
        
        if (callbacks.onTick) {
            callbacks.onTick(getState());
        }
        
        if (state.remainingSeconds <= 0) {
            stop();
            clearPersistedState();
            if (callbacks.onComplete) {
                callbacks.onComplete(state.mode);
            }
        }
    };

    const start = () => {
        if (state.isRunning) return;
        state.isRunning = true;
        
        // Store the starting point
        state.pausedRemaining = state.remainingSeconds;
        state.startTime = Date.now();
        
        // Save state immediately
        saveState();
        
        // Use setInterval for visual updates, but calculate from Date.now()
        state.intervalId = setInterval(tick, 1000);
        
        // Immediate tick
        tick();
    };

    const pause = () => {
        if (!state.isRunning) return;
        
        // Save remaining before stopping
        state.remainingSeconds = calculateRemaining();
        state.pausedRemaining = state.remainingSeconds;
        state.startTime = null;
        
        state.isRunning = false;
        if (state.intervalId) {
            clearInterval(state.intervalId);
            state.intervalId = null;
        }
        
        // Save paused state
        saveState();
    };

    const stop = () => {
        pause();
    };

    const reset = () => {
        pause();
        state.remainingSeconds = state.totalSeconds;
        state.pausedRemaining = null;
        state.startTime = null;
        clearPersistedState();
    };

    const getState = () => ({
        mode: state.mode,
        isRunning: state.isRunning,
        remainingSeconds: state.remainingSeconds,
        totalSeconds: state.totalSeconds,
        formatted: formatTime(state.remainingSeconds),
        progressOffset: getProgressOffset()
    });

    const setCallbacks = (onTick, onComplete) => {
        callbacks.onTick = onTick;
        callbacks.onComplete = onComplete;
    };

    const getElapsedMinutes = () => {
        return Math.floor((state.totalSeconds - state.remainingSeconds) / 60);
    };

    const getDurationMinutes = () => {
        return Math.floor(state.totalSeconds / 60);
    };

    // Apply restored state (called during init)
    const applyRestoredState = (restored) => {
        state.mode = restored.mode;
        state.remainingSeconds = restored.remainingSeconds;
        state.totalSeconds = restored.totalSeconds;
        
        if (restored.isRunning) {
            state.pausedRemaining = restored.remainingSeconds;
            state.startTime = Date.now();
            state.isRunning = true;
            state.intervalId = setInterval(tick, 1000);
        }
    };

    return { 
        setDuration, setMode, formatTime, 
        start, pause, stop, reset, 
        getState, setCallbacks, getElapsedMinutes, getDurationMinutes,
        restoreState, applyRestoredState, clearPersistedState, saveState
    };
})();


/* ============================================
   MODULE 5: AudioModule
   Web Audio API Brown Noise with GainNode control
   Lazy initialization on user interaction
   ============================================ */
const AudioModule = (() => {
    let audioContext = null;
    let noiseNode = null;
    let gainNode = null;
    let isPlaying = false;
    let volume = 0.20;
    let isInitialized = false;

    const createBrownNoiseBuffer = (context) => {
        const bufferSize = 2 * context.sampleRate;
        const buffer = context.createBuffer(1, bufferSize, context.sampleRate);
        const output = buffer.getChannelData(0);
        
        let lastOut = 0.0;
        for (let i = 0; i < bufferSize; i++) {
            const white = Math.random() * 2 - 1;
            output[i] = (lastOut + (0.02 * white)) / 1.02;
            lastOut = output[i];
            output[i] *= 2.5;
        }
        
        return buffer;
    };

    // Only initialize on user interaction
    const init = () => {
        if (isInitialized) return true;
        
        try {
            audioContext = new (window.AudioContext || window.webkitAudioContext)();
            
            gainNode = audioContext.createGain();
            gainNode.gain.value = volume;
            gainNode.connect(audioContext.destination);
            
            isInitialized = true;
            return true;
        } catch (e) {
            return false;
        }
    };

    const start = () => {
        // Initialize on first user interaction
        if (!init()) return false;
        if (isPlaying) return true;

        // Resume if suspended (browser autoplay policy)
        if (audioContext.state === 'suspended') {
            audioContext.resume();
        }

        const buffer = createBrownNoiseBuffer(audioContext);
        noiseNode = audioContext.createBufferSource();
        noiseNode.buffer = buffer;
        noiseNode.loop = true;
        
        noiseNode.connect(gainNode);
        noiseNode.start();
        
        isPlaying = true;
        return true;
    };

    const stop = () => {
        if (noiseNode) {
            try {
                noiseNode.stop();
                noiseNode.disconnect();
            } catch (e) { /* ignore */ }
            noiseNode = null;
        }
        isPlaying = false;
    };

    const setVolume = (value) => {
        volume = Math.max(0, Math.min(1, value));
        if (gainNode && audioContext) {
            gainNode.gain.setTargetAtTime(volume, audioContext.currentTime, 0.1);
        }
    };

    const getVolume = () => volume;

    const toggle = () => {
        if (isPlaying) {
            stop();
        } else {
            start();
        }
        return isPlaying;
    };

    const getState = () => ({ isPlaying, volume });

    // Play completion beep
    const playBeep = () => {
        try {
            const ctx = new (window.AudioContext || window.webkitAudioContext)();
            const now = ctx.currentTime;

            for (let i = 0; i < 3; i++) {
                const osc = ctx.createOscillator();
                const gain = ctx.createGain();

                osc.connect(gain);
                gain.connect(ctx.destination);

                osc.frequency.value = 880;
                osc.type = 'sine';

                const startTime = now + i * 0.2;
                gain.gain.setValueAtTime(0.15, startTime);
                gain.gain.exponentialRampToValueAtTime(0.01, startTime + 0.12);

                osc.start(startTime);
                osc.stop(startTime + 0.12);
            }
        } catch (e) { /* ignore */ }
    };

    return { init, start, stop, setVolume, getVolume, toggle, getState, playBeep };
})();


/* ============================================
   MODULE 6: ChartModule
   HTML5 Canvas Bar Chart
   ============================================ */
const ChartModule = (() => {
    let canvas = null;
    let ctx = null;

    const init = (canvasId) => {
        canvas = document.getElementById(canvasId);
        if (!canvas) return false;
        ctx = canvas.getContext('2d');
        return true;
    };

    const drawBarChart = (data, labels) => {
        if (!ctx || !canvas) return;

        const hasData = data.some(v => v > 0);
        const container = document.getElementById('chartContainer');
        
        if (!hasData) {
            canvas.style.display = 'none';
            if (container && !container.querySelector('.chart-empty')) {
                const empty = document.createElement('div');
                empty.className = 'chart-empty';
                empty.textContent = 'Complete a session to view analytics';
                container.appendChild(empty);
            }
            return;
        } else {
            canvas.style.display = 'block';
            const empty = container?.querySelector('.chart-empty');
            if (empty) empty.remove();
        }

        const dpr = window.devicePixelRatio || 1;
        const rect = canvas.getBoundingClientRect();
        canvas.width = rect.width * dpr;
        canvas.height = rect.height * dpr;
        ctx.scale(dpr, dpr);

        const width = rect.width;
        const height = rect.height;
        
        const padding = { top: 25, right: 15, bottom: 35, left: 40 };
        const chartWidth = width - padding.left - padding.right;
        const chartHeight = height - padding.top - padding.bottom;
        
        const maxValue = Math.max(...data, 1);
        const roundedMax = Math.ceil(maxValue / 10) * 10 || 10;

        ctx.clearRect(0, 0, width, height);

        // Grid lines
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
        ctx.lineWidth = 1;
        const gridLines = 4;
        for (let i = 0; i <= gridLines; i++) {
            const y = padding.top + (chartHeight / gridLines) * i;
            ctx.beginPath();
            ctx.moveTo(padding.left, y);
            ctx.lineTo(width - padding.right, y);
            ctx.stroke();

            const value = Math.round(roundedMax - (roundedMax / gridLines) * i);
            ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
            ctx.font = '10px -apple-system, BlinkMacSystemFont, sans-serif';
            ctx.textAlign = 'right';
            ctx.fillText(value.toString(), padding.left - 6, y + 3);
        }

        // Get current theme accent color for chart bars
        const computedStyle = getComputedStyle(document.documentElement);
        const accentColor = computedStyle.getPropertyValue('--accent-focus').trim() || '#6366f1';
        const accentLong = computedStyle.getPropertyValue('--accent-long').trim() || '#8b5cf6';

        // Bars
        const barCount = data.length;
        const barWidth = (chartWidth / barCount) * 0.55;
        const barGap = (chartWidth / barCount) * 0.45;

        data.forEach((value, index) => {
            const barHeight = Math.max(value > 0 ? 4 : 2, (value / roundedMax) * chartHeight);
            const x = padding.left + (chartWidth / barCount) * index + barGap / 2;
            const y = padding.top + chartHeight - barHeight;

            const gradient = ctx.createLinearGradient(x, y + barHeight, x, y);
            gradient.addColorStop(0, accentColor);
            gradient.addColorStop(1, accentLong);

            ctx.fillStyle = value > 0 ? gradient : 'rgba(255,255,255,0.1)';
            ctx.beginPath();
            const radius = Math.min(4, barWidth / 2);
            ctx.moveTo(x, y + barHeight);
            ctx.lineTo(x, y + radius);
            ctx.quadraticCurveTo(x, y, x + radius, y);
            ctx.lineTo(x + barWidth - radius, y);
            ctx.quadraticCurveTo(x + barWidth, y, x + barWidth, y + radius);
            ctx.lineTo(x + barWidth, y + barHeight);
            ctx.closePath();
            ctx.fill();

            if (value > 0) {
                ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
                ctx.font = 'bold 9px -apple-system, BlinkMacSystemFont, sans-serif';
                ctx.textAlign = 'center';
                ctx.fillText(Math.round(value).toString(), x + barWidth / 2, y - 4);
            }

            ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
            ctx.font = '9px -apple-system, BlinkMacSystemFont, sans-serif';
            ctx.textAlign = 'center';
            ctx.fillText(labels[index] || '', x + barWidth / 2, height - padding.bottom + 18);
        });
    };

    return { init, drawBarChart };
})();


/* ============================================
   MODULE 7: ConfettiModule
   Lightweight celebration effect
   ============================================ */
const ConfettiModule = (() => {
    const colors = ['#6366f1', '#8b5cf6', '#10b981', '#f59e0b', '#ec4899', '#3b82f6'];
    
    const launch = () => {
        const container = document.getElementById('confettiContainer');
        if (!container) return;

        const particleCount = 50;
        
        for (let i = 0; i < particleCount; i++) {
            const particle = document.createElement('div');
            particle.className = 'confetti';
            
            const color = colors[Math.floor(Math.random() * colors.length)];
            const size = Math.random() * 8 + 6;
            const left = Math.random() * 100;
            const delay = Math.random() * 0.5;
            const duration = Math.random() * 2 + 2;
            const rotation = Math.random() * 360;
            
            particle.style.cssText = `
                left: ${left}%;
                width: ${size}px;
                height: ${size}px;
                background: ${color};
                border-radius: ${Math.random() > 0.5 ? '50%' : '2px'};
                animation: confettiFall ${duration}s ease-out ${delay}s forwards;
                transform: rotate(${rotation}deg);
            `;
            
            container.appendChild(particle);
            
            // Clean up after animation
            setTimeout(() => {
                particle.remove();
            }, (duration + delay) * 1000 + 100);
        }
    };
    
    return { launch };
})();


/* ============================================
   MODULE 8: SettingsModule
   User preferences management
   Now supports custom focus duration
   ============================================ */
const SettingsModule = (() => {
    const DEFAULT_SETTINGS = {
        focus: 25,
        short: 5,
        long: 15
    };

    const MODE_CONFIG = {
        focus: { label: 'Focus', accent: '--accent-focus', glow: '--accent-focus-glow' },
        short: { label: 'Short Break', accent: '--accent-short', glow: '--accent-short-glow' },
        long: { label: 'Long Break', accent: '--accent-long', glow: '--accent-long-glow' }
    };

    const get = () => {
        return StorageModule.get(StorageModule.KEYS.SETTINGS, { ...DEFAULT_SETTINGS });
    };

    const save = (settings) => {
        StorageModule.set(StorageModule.KEYS.SETTINGS, settings);
    };

    const getModeConfig = (mode) => MODE_CONFIG[mode] || MODE_CONFIG.focus;

    const getModeDuration = (mode) => {
        const settings = get();
        return (settings[mode] || DEFAULT_SETTINGS[mode]) * 60;
    };

    // New: Set custom focus duration
    const setFocusDuration = (minutes) => {
        const settings = get();
        const validMinutes = Math.max(1, Math.min(120, parseInt(minutes, 10) || 25));
        settings.focus = validMinutes;
        save(settings);
        return validMinutes;
    };

    // New: Get current focus duration in minutes
    const getFocusDuration = () => {
        const settings = get();
        return settings.focus || DEFAULT_SETTINGS.focus;
    };

    return { get, save, getModeConfig, getModeDuration, setFocusDuration, getFocusDuration, DEFAULT_SETTINGS };
})();


/* ============================================
   MODULE 9: ThemeModule
   Theme switching (Default/Midnight/Forest)
   Persists to localStorage
   ============================================ */
const ThemeModule = (() => {
    const THEMES = ['default', 'midnight', 'forest'];
    const DEFAULT_THEME = 'default';

    const get = () => {
        const stored = StorageModule.get(StorageModule.KEYS.THEME, DEFAULT_THEME);
        return THEMES.includes(stored) ? stored : DEFAULT_THEME;
    };

    const set = (theme) => {
        if (!THEMES.includes(theme)) {
            theme = DEFAULT_THEME;
        }
        
        StorageModule.set(StorageModule.KEYS.THEME, theme);
        apply(theme);
        return theme;
    };

    const apply = (theme) => {
        const body = document.body;
        
        if (theme === 'default') {
            body.removeAttribute('data-theme');
        } else {
            body.setAttribute('data-theme', theme);
        }
    };

    const init = () => {
        const theme = get();
        apply(theme);
        return theme;
    };

    return { THEMES, get, set, apply, init };
})();


/* ============================================
   MODULE 10: UIModule
   DOM manipulation and event handling
   ============================================ */
const UIModule = (() => {
    const $ = (sel) => document.querySelector(sel);
    const $$ = (sel) => document.querySelectorAll(sel);

    const elements = {};

    const cache = () => {
        elements.timer = $('#timer');
        elements.timerDisplay = $('#timerDisplay');
        elements.timerLabel = $('#timerLabel');
        elements.timerProgress = $('#timerProgress');
        elements.playPauseBtn = $('#playPauseBtn');
        elements.playIcon = $('#playIcon');
        elements.resetBtn = $('#resetBtn');
        elements.skipBtn = $('#skipBtn');
        elements.modeBtns = $$('.mode-btn');
        elements.currentFocus = $('#currentFocus');
        elements.currentTaskName = $('#currentTaskName');
        elements.taskInput = $('#taskInput');
        elements.addTaskBtn = $('#addTaskBtn');
        elements.taskList = $('#taskList');
        elements.taskCount = $('#taskCount');
        elements.settingsBtn = $('#settingsBtn');
        elements.settingsModal = $('#settingsModal');
        elements.settingsClose = $('#settingsClose');
        elements.audioToggle = $('#audioToggle');
        elements.volumeRow = $('#volumeRow');
        elements.volumeSlider = $('#volumeSlider');
        elements.volumeValue = $('#volumeValue');
        elements.clearHistoryBtn = $('#clearHistoryBtn');
        elements.exportDataBtn = $('#exportDataBtn');
        elements.importDataBtn = $('#importDataBtn');
        elements.importFileInput = $('#importFileInput');
        elements.customFocusDuration = $('#customFocusDuration');
        elements.statsBtn = $('#statsBtn');
        elements.statsOverlay = $('#statsOverlay');
        elements.statsClose = $('#statsClose');
        elements.statTotalMinutes = $('#statTotalMinutes');
        elements.statTotalSessions = $('#statTotalSessions');
        elements.statAvgSession = $('#statAvgSession');
        elements.statStreak = $('#statStreak');
        // Theme elements
        elements.themeSelector = $('#themeSelector');
        elements.themeBtns = $$('.theme-btn');
        // Shortcuts modal elements
        elements.shortcutsBtn = $('#shortcutsBtn');
        elements.shortcutsModal = $('#shortcutsModal');
        elements.shortcutsClose = $('#shortcutsClose');
        // Install App button (PWA)
        elements.installAppBtn = $('#installAppBtn');
        // Offline badge
        elements.offlineBadge = $('#offlineBadge');
        // Update toast
        elements.updateToast = $('#updateToast');
        elements.updateToastBtn = $('#updateToastBtn');
        elements.updateToastDismiss = $('#updateToastDismiss');
    };

    const updateTimer = (state) => {
        if (elements.timerDisplay) {
            elements.timerDisplay.textContent = state.formatted;
        }
        if (elements.timerProgress) {
            elements.timerProgress.style.strokeDashoffset = state.progressOffset;
        }
        if (elements.timer) {
            elements.timer.classList.toggle('running', state.isRunning);
        }
        
        document.title = state.isRunning 
            ? `${state.formatted} - FocusFlow` 
            : 'FocusFlow';
    };

    const updatePlayPauseButton = (isRunning) => {
        if (elements.playIcon) {
            if (isRunning) {
                elements.playIcon.innerHTML = '<rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/>';
                elements.playPauseBtn.setAttribute('aria-label', 'Pause');
            } else {
                elements.playIcon.innerHTML = '<polygon points="6,4 20,12 6,20"/>';
                elements.playPauseBtn.setAttribute('aria-label', 'Start');
            }
        }
    };

    const setMode = (mode) => {
        const config = SettingsModule.getModeConfig(mode);
        
        if (elements.timerLabel) {
            elements.timerLabel.textContent = config.label;
        }
        
        elements.modeBtns.forEach(btn => {
            btn.classList.toggle('active', btn.dataset.mode === mode);
        });
        
        const root = document.documentElement;
        root.style.setProperty('--accent', `var(${config.accent})`);
        root.style.setProperty('--accent-glow', `var(${config.glow})`);
    };

    const updateCurrentTask = () => {
        const activeTask = TaskModule.getActive();
        
        if (elements.currentFocus && elements.currentTaskName) {
            if (activeTask) {
                elements.currentTaskName.textContent = activeTask.name;
                elements.currentFocus.classList.add('visible');
            } else {
                elements.currentFocus.classList.remove('visible');
            }
        }
    };

    const escapeHtml = (text) => {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    };

    // Render tasks sorted: Active > Pending > Completed
    const renderTasks = () => {
        const tasks = TaskModule.getAll();
        const activeTask = TaskModule.getActive();
        
        if (!elements.taskList) return;

        if (tasks.length === 0) {
            elements.taskList.innerHTML = '<div class="empty-state">Add a task to get started</div>';
        } else {
            elements.taskList.innerHTML = tasks.map(task => `
                <div class="task-item ${task.completed ? 'completed' : ''} ${activeTask?.id === task.id ? 'active' : ''}" data-id="${task.id}">
                    <div class="task-checkbox" data-action="complete" title="${task.completed ? 'Mark incomplete' : 'Mark complete'}">${task.completed ? '&#10003;' : ''}</div>
                    <span class="task-name" data-action="select">${escapeHtml(task.name)}</span>
                    <button class="task-delete" data-action="delete" title="Delete task">&#10005;</button>
                </div>
            `).join('');
        }

        if (elements.taskCount) {
            const pending = TaskModule.getPendingCount();
            const completed = TaskModule.getCompletedCount();
            elements.taskCount.textContent = completed > 0 
                ? `${pending} pending, ${completed} done`
                : `${pending} task${pending !== 1 ? 's' : ''}`;
        }

        updateCurrentTask();
    };

    const toggleSettings = (show) => {
        if (elements.settingsModal) {
            elements.settingsModal.classList.toggle('visible', show);
        }
    };

    const toggleStats = (show) => {
        if (elements.statsOverlay) {
            elements.statsOverlay.classList.toggle('visible', show);
            if (show) {
                updateStatsDisplay();
            }
        }
    };

    const toggleShortcuts = (show) => {
        if (elements.shortcutsModal) {
            elements.shortcutsModal.classList.toggle('visible', show);
        }
    };

    const updateStatsDisplay = () => {
        const stats = HistoryModule.getStats();
        const streak = HistoryModule.getStreak();
        
        if (elements.statTotalMinutes) elements.statTotalMinutes.textContent = stats.totalMinutes;
        if (elements.statTotalSessions) elements.statTotalSessions.textContent = stats.totalSessions;
        if (elements.statAvgSession) elements.statAvgSession.textContent = stats.avgSession;
        if (elements.statStreak) elements.statStreak.textContent = streak;

        const chartData = HistoryModule.getLast7Days();
        ChartModule.drawBarChart(chartData.data, chartData.labels);
    };

    const updateAudioToggle = (isPlaying) => {
        if (elements.audioToggle) {
            elements.audioToggle.classList.toggle('active', isPlaying);
            elements.audioToggle.setAttribute('aria-checked', isPlaying);
        }
        if (elements.volumeRow) {
            elements.volumeRow.classList.toggle('enabled', isPlaying);
        }
    };

    const updateVolumeDisplay = (value) => {
        if (elements.volumeValue) {
            elements.volumeValue.textContent = `${Math.round(value)}%`;
        }
    };

    const updateThemeButtons = (activeTheme) => {
        elements.themeBtns.forEach(btn => {
            btn.classList.toggle('active', btn.dataset.theme === activeTheme);
        });
    };

    // Offline badge
    const showOfflineBadge = (show) => {
        if (elements.offlineBadge) {
            elements.offlineBadge.classList.toggle('visible', show);
        }
    };

    // Update toast
    const showUpdateToast = (show) => {
        if (elements.updateToast) {
            elements.updateToast.classList.toggle('visible', show);
        }
    };

    const notify = (title, body) => {
        if ('Notification' in window && Notification.permission === 'granted') {
            try {
                new Notification(title, { body, silent: true });
            } catch (e) { /* ignore */ }
        }
    };

    const requestNotificationPermission = () => {
        if ('Notification' in window && Notification.permission === 'default') {
            Notification.requestPermission();
        }
    };

    return {
        cache,
        elements,
        updateTimer,
        updatePlayPauseButton,
        setMode,
        updateCurrentTask,
        renderTasks,
        toggleSettings,
        toggleStats,
        toggleShortcuts,
        updateStatsDisplay,
        updateAudioToggle,
        updateVolumeDisplay,
        updateThemeButtons,
        showOfflineBadge,
        showUpdateToast,
        notify,
        requestNotificationPermission
    };
})();


/* ============================================
   MODULE 11: AppData
   Data Backup System (JSON Export/Import)
   Handles file I/O for localStorage backup/restore
   ============================================ */
const AppData = (() => {
    // Keys that should be included in backup
    const BACKUP_KEYS = {
        tasks: 'focusflow_tasks_v2',
        history: 'ff_history',
        settings: 'focusflow_settings_v2',
        theme: 'focusflow_theme'
    };

    // Export all data to JSON
    const exportData = () => {
        try {
            const backup = {
                version: 'v0.0.4',
                exportedAt: new Date().toISOString(),
                ff_tasks: StorageModule.get(BACKUP_KEYS.tasks, { tasks: [], activeTaskId: null }),
                ff_history: StorageModule.get(BACKUP_KEYS.history, []),
                ff_settings: StorageModule.get(BACKUP_KEYS.settings, SettingsModule.DEFAULT_SETTINGS),
                ff_theme: StorageModule.get(BACKUP_KEYS.theme, 'default')
            };

            const jsonString = JSON.stringify(backup, null, 2);
            const blob = new Blob([jsonString], { type: 'application/json' });
            const url = URL.createObjectURL(blob);

            // Create download link and trigger click
            const link = document.createElement('a');
            link.href = url;
            link.download = 'focusflow_backup.json';
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);

            // Clean up blob URL
            setTimeout(() => URL.revokeObjectURL(url), 100);

            return { success: true };
        } catch (error) {
            return { success: false, error: error.message };
        }
    };

    // Validate backup data structure
    const validateBackup = (data) => {
        if (!data || typeof data !== 'object') {
            return { valid: false, error: 'Invalid file format: Not a valid JSON object' };
        }

        // Check for required keys (ff_tasks and ff_history)
        const hasTasksKey = 'ff_tasks' in data;
        const hasHistoryKey = 'ff_history' in data;

        if (!hasTasksKey && !hasHistoryKey) {
            return { 
                valid: false, 
                error: 'Invalid backup file: Missing required keys (ff_tasks, ff_history)' 
            };
        }

        // Validate ff_tasks structure if present
        if (hasTasksKey) {
            const tasks = data.ff_tasks;
            if (typeof tasks !== 'object' || tasks === null) {
                return { valid: false, error: 'Invalid ff_tasks format' };
            }
            if (!Array.isArray(tasks.tasks)) {
                return { valid: false, error: 'Invalid ff_tasks.tasks: Must be an array' };
            }
        }

        // Validate ff_history structure if present
        if (hasHistoryKey) {
            if (!Array.isArray(data.ff_history)) {
                return { valid: false, error: 'Invalid ff_history: Must be an array' };
            }
        }

        return { valid: true };
    };

    // Import data from JSON file
    const importData = (file) => {
        return new Promise((resolve) => {
            if (!file) {
                resolve({ success: false, error: 'No file selected' });
                return;
            }

            if (!file.type.includes('json') && !file.name.endsWith('.json')) {
                resolve({ success: false, error: 'Invalid file type: Please select a JSON file' });
                return;
            }

            const reader = new FileReader();

            reader.onload = (event) => {
                try {
                    const data = JSON.parse(event.target.result);

                    // Validate the backup structure
                    const validation = validateBackup(data);
                    if (!validation.valid) {
                        resolve({ success: false, error: validation.error });
                        return;
                    }

                    // Overwrite localStorage with backup data
                    if (data.ff_tasks) {
                        StorageModule.set(BACKUP_KEYS.tasks, data.ff_tasks);
                    }
                    if (data.ff_history) {
                        StorageModule.set(BACKUP_KEYS.history, data.ff_history);
                    }
                    if (data.ff_settings) {
                        StorageModule.set(BACKUP_KEYS.settings, data.ff_settings);
                    }
                    if (data.ff_theme) {
                        StorageModule.set(BACKUP_KEYS.theme, data.ff_theme);
                    }

                    resolve({ success: true, reloadRequired: true });
                } catch (parseError) {
                    resolve({ 
                        success: false, 
                        error: 'Failed to parse JSON file: ' + parseError.message 
                    });
                }
            };

            reader.onerror = () => {
                resolve({ success: false, error: 'Failed to read file' });
            };

            reader.readAsText(file);
        });
    };

    return { exportData, importData, validateBackup };
})();


/* ============================================
   MODULE 12: AppInput
   Keyboard Shortcuts Handler
   ============================================ */
const AppInput = (() => {
    let isInitialized = false;
    let callbacks = {};

    const SHORTCUTS = {
        TOGGLE_TIMER: ' ',       // Spacebar
        CLOSE_MODAL: 'Escape',   // Esc
        NEW_TASK: 'n'            // N key
    };

    const init = (handlers) => {
        if (isInitialized) return;
        
        callbacks = handlers || {};
        
        document.addEventListener('keydown', handleKeyDown);
        isInitialized = true;
    };

    const handleKeyDown = (event) => {
        const target = event.target;
        const tagName = target.tagName.toLowerCase();
        const isEditable = tagName === 'input' || tagName === 'textarea' || target.isContentEditable;

        // Always handle Escape (close modals)
        if (event.key === 'Escape') {
            if (callbacks.onEscape) {
                callbacks.onEscape();
            }
            return;
        }

        // Don't handle other shortcuts when typing in inputs
        if (isEditable) {
            return;
        }

        // Spacebar - Toggle Timer
        if (event.code === 'Space' || event.key === ' ') {
            event.preventDefault();
            if (callbacks.onToggleTimer) {
                callbacks.onToggleTimer();
            }
            return;
        }

        // N key - Focus new task input
        if (event.key.toLowerCase() === 'n') {
            event.preventDefault();
            if (callbacks.onNewTask) {
                callbacks.onNewTask();
            }
            return;
        }
    };

    const destroy = () => {
        document.removeEventListener('keydown', handleKeyDown);
        isInitialized = false;
        callbacks = {};
    };

    return { init, destroy, SHORTCUTS };
})();


/* ============================================
   MODULE 13: AppNetwork
   Online/Offline Detection and UI Updates
   ============================================ */
const AppNetwork = (() => {
    let isOnline = navigator.onLine;

    const init = () => {
        // Set initial state
        isOnline = navigator.onLine;
        updateUI();

        // Listen for online/offline events
        window.addEventListener('online', handleOnline);
        window.addEventListener('offline', handleOffline);
    };

    const handleOnline = () => {
        isOnline = true;
        updateUI();
    };

    const handleOffline = () => {
        isOnline = false;
        updateUI();
    };

    const updateUI = () => {
        UIModule.showOfflineBadge(!isOnline);
    };

    const getStatus = () => isOnline;

    return { init, getStatus };
})();


/* ============================================
   MODULE 14: App.PWA
   Service Worker Registration, Install Prompt,
   & Update Detection with Toast Notification
   ============================================ */
const AppPWA = (() => {
    let deferredPrompt = null;
    let isInstalled = false;
    let waitingWorker = null;

    // Register Service Worker
    const registerServiceWorker = async () => {
        if (!('serviceWorker' in navigator)) {
            return false;
        }

        try {
            const registration = await navigator.serviceWorker.register('/sw.js', {
                scope: '/'
            });


            // Check for waiting worker on page load
            if (registration.waiting) {
                waitingWorker = registration.waiting;
                showUpdateToast();
            }

            // Handle updates
            registration.addEventListener('updatefound', () => {
                const newWorker = registration.installing;

                newWorker.addEventListener('statechange', () => {
                    if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                        waitingWorker = newWorker;
                        showUpdateToast();
                    }
                });
            });

            // Listen for controller change (after skipWaiting)
            navigator.serviceWorker.addEventListener('controllerchange', () => {
                window.location.reload();
            });

            return true;
        } catch (error) {
            return false;
        }
    };

    // Show update toast notification
    const showUpdateToast = () => {
        UIModule.showUpdateToast(true);
    };

    // Hide update toast
    const hideUpdateToast = () => {
        UIModule.showUpdateToast(false);
    };

    // Apply the update by telling waiting SW to skip waiting
    const applyUpdate = () => {
        if (waitingWorker) {
            waitingWorker.postMessage({ type: 'SKIP_WAITING' });
        }
    };

    // Bind update toast buttons
    const bindUpdateToastEvents = () => {
        const { elements } = UIModule;
        
        elements.updateToastBtn?.addEventListener('click', () => {
            applyUpdate();
        });

        elements.updateToastDismiss?.addEventListener('click', () => {
            hideUpdateToast();
        });
    };

    // Listen for beforeinstallprompt event
    const listenForInstallPrompt = () => {
        window.addEventListener('beforeinstallprompt', (event) => {
            // Prevent the default browser install prompt
            event.preventDefault();
            
            // Save the event for later use
            deferredPrompt = event;
            
            
            // Show the install button in settings
            showInstallButton();
        });

        // Listen for app installed event
        window.addEventListener('appinstalled', () => {
            isInstalled = true;
            deferredPrompt = null;
            hideInstallButton();
        });

        // Check if already installed (standalone mode)
        if (window.matchMedia('(display-mode: standalone)').matches) {
            isInstalled = true;
        }
    };

    // Show the install button
    const showInstallButton = () => {
        const { elements } = UIModule;
        if (elements.installAppBtn) {
            elements.installAppBtn.style.display = 'flex';
        }
    };

    // Hide the install button
    const hideInstallButton = () => {
        const { elements } = UIModule;
        if (elements.installAppBtn) {
            elements.installAppBtn.style.display = 'none';
        }
    };

    // Trigger the native install prompt
    const promptInstall = async () => {
        if (!deferredPrompt) {
            return false;
        }

        // Show the native install prompt
        deferredPrompt.prompt();
        
        // Wait for user response
        const { outcome } = await deferredPrompt.userChoice;
        
        
        // Clear the deferred prompt
        deferredPrompt = null;
        
        if (outcome === 'accepted') {
            hideInstallButton();
            return true;
        }
        
        return false;
    };

    // Bind install button click event
    const bindInstallButton = () => {
        const { elements } = UIModule;
        elements.installAppBtn?.addEventListener('click', () => {
            promptInstall();
        });
    };

    // Initialize PWA features
    const init = () => {
        registerServiceWorker();
        listenForInstallPrompt();
        bindInstallButton();
        bindUpdateToastEvents();
    };

    // Check if app can be installed
    const canInstall = () => deferredPrompt !== null;

    // Check if app is installed
    const isAppInstalled = () => isInstalled;

    return {
        init,
        promptInstall,
        canInstall,
        isAppInstalled,
        applyUpdate
    };
})();


/* ============================================
   MODULE 15: WakeLockModule
   Screen Wake Lock API - Prevent sleep during timer
   ============================================ */
const WakeLockModule = (() => {
    let wakeLock = null;
    let isSupported = 'wakeLock' in navigator;

    const isAvailable = () => isSupported;

    const request = async () => {
        if (!isSupported) {
            return false;
        }

        try {
            // Release any existing lock first
            if (wakeLock) {
                await release();
            }

            wakeLock = await navigator.wakeLock.request('screen');

            // Listen for release events (e.g., when user switches tabs)
            wakeLock.addEventListener('release', () => {
                wakeLock = null;
            });

            return true;
        } catch (error) {
            return false;
        }
    };

    const release = async () => {
        if (wakeLock) {
            try {
                await wakeLock.release();
                wakeLock = null;
            } catch (error) {
            }
        }
    };

    const getState = () => ({
        isSupported,
        isLocked: wakeLock !== null
    });

    // Re-acquire wake lock when page becomes visible again
    const handleVisibilityChange = async () => {
        if (wakeLock !== null && document.visibilityState === 'visible') {
            await request();
        }
    };

    // Listen for visibility changes
    if (isSupported) {
        document.addEventListener('visibilitychange', handleVisibilityChange);
    }

    return {
        isAvailable,
        request,
        release,
        getState
    };
})();


/* ============================================
   MODULE 16: MediaSessionModule
   Media Session API - Lock Screen Controls for Focus Noise
   ============================================ */
const MediaSessionModule = (() => {
    let isSupported = 'mediaSession' in navigator;

    const isAvailable = () => isSupported;

    // Initialize media session metadata
    const init = () => {
        if (!isSupported) {
            return false;
        }

        try {
            // Set metadata for lock screen display
            navigator.mediaSession.metadata = new MediaMetadata({
                title: 'Focus Mode',
                artist: 'FocusFlow',
                album: 'Brown Noise',
                artwork: [
                    { src: 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 96 96"><rect width="96" height="96" rx="20" fill="%236366f1"/><polygon points="38,28 68,48 38,68" fill="white"/></svg>', sizes: '96x96', type: 'image/svg+xml' }
                ]
            });

            // Set up action handlers for hardware buttons
            navigator.mediaSession.setActionHandler('play', () => {
                // Toggle audio on
                const isPlaying = AudioModule.toggle();
                UIModule.updateAudioToggle(isPlaying);
            });

            navigator.mediaSession.setActionHandler('pause', () => {
                // Toggle audio off
                const isPlaying = AudioModule.toggle();
                UIModule.updateAudioToggle(isPlaying);
            });

            // Set initial playback state
            updatePlaybackState(false);

            return true;
        } catch (error) {
            return false;
        }
    };

    // Update the playback state shown on lock screen
    const updatePlaybackState = (isPlaying) => {
        if (!isSupported) return;

        try {
            navigator.mediaSession.playbackState = isPlaying ? 'playing' : 'paused';
        } catch (error) {
        }
    };

    return {
        isAvailable,
        init,
        updatePlaybackState
    };
})();


/* ============================================
   MODULE 17: HapticsModule
   Vibration API - Haptic feedback for user actions
   ============================================ */
const HapticsModule = (() => {
    let isSupported = 'vibrate' in navigator;

    const isAvailable = () => isSupported;

    // Light tick feedback for task completion
    const taskComplete = () => {
        if (!isSupported) {
            return false;
        }

        try {
            // Short, crisp tick (10ms)
            navigator.vibrate(10);
            return true;
        } catch (error) {
            return false;
        }
    };

    // Heartbeat pattern for timer completion
    const timerComplete = () => {
        if (!isSupported) {
            return false;
        }

        try {
            // Heartbeat pattern: 200ms on, 100ms off, 200ms on
            navigator.vibrate([200, 100, 200]);
            return true;
        } catch (error) {
            return false;
        }
    };

    // Generic light feedback
    const lightFeedback = () => {
        if (!isSupported) return false;

        try {
            navigator.vibrate(15);
            return true;
        } catch (error) {
            return false;
        }
    };

    return {
        isAvailable,
        taskComplete,
        timerComplete,
        lightFeedback
    };
})();


/* ============================================
   MODULE 18: BadgeModule
   Badging API - App icon badges for timer/tasks
   ============================================ */
const BadgeModule = (() => {
    let isSupported = 'setAppBadge' in navigator;

    const isAvailable = () => isSupported;

    // Set badge with a number (for active tasks)
    const setCount = async (count) => {
        if (!isSupported) {
            return false;
        }

        try {
            if (count > 0) {
                await navigator.setAppBadge(count);
            } else {
                await navigator.clearAppBadge();
            }
            return true;
        } catch (error) {
            return false;
        }
    };

    // Set generic dot badge (for timer running)
    const setIndicator = async () => {
        if (!isSupported) {
            return false;
        }

        try {
            await navigator.setAppBadge();
            return true;
        } catch (error) {
            return false;
        }
    };

    // Clear badge
    const clear = async () => {
        if (!isSupported) {
            return false;
        }

        try {
            await navigator.clearAppBadge();
            return true;
        } catch (error) {
            return false;
        }
    };

    // Update badge based on app state
    const updateFromState = async () => {
        const timerState = TimerModule.getState();
        const pendingTasks = TaskModule.getPendingCount();

        if (timerState.isRunning) {
            // Timer running: show indicator
            await setIndicator();
        } else if (pendingTasks > 0) {
            // Tasks pending: show count
            await setCount(pendingTasks);
        } else {
            // Nothing active: clear badge
            await clear();
        }
    };

    return {
        isAvailable,
        setCount,
        setIndicator,
        clear,
        updateFromState
    };
})();


/* ============================================
   MODULE 19: App
   Main application initialization & events
   ============================================ */
const App = (() => {
    let currentMode = 'focus';
    const MODES = ['focus', 'short', 'long'];

    const init = () => {
        UIModule.cache();
        TaskModule.init();
        ChartModule.init('focusChart');
        
        // Initialize theme
        const currentTheme = ThemeModule.init();
        UIModule.updateThemeButtons(currentTheme);

        // Initialize Network status monitoring
        AppNetwork.init();

        // Initialize PWA (Service Worker + Install Prompt + Update Detection)
        AppPWA.init();

        TimerModule.setCallbacks(onTimerTick, onTimerComplete);

        // Check for persisted timer state
        const restoredState = TimerModule.restoreState();
        if (restoredState) {
            handleRestoredTimerState(restoredState);
        } else {
            setMode('focus');
        }

        UIModule.renderTasks();

        // Initialize volume display
        const initialVolume = AudioModule.getVolume() * 100;
        if (UIModule.elements.volumeSlider) {
            UIModule.elements.volumeSlider.value = initialVolume;
        }
        UIModule.updateVolumeDisplay(initialVolume);

        // Initialize custom focus duration input
        initCustomDurationInput();

        bindEvents();
        initKeyboardShortcuts();
        UIModule.requestNotificationPermission();

        // Save timer state on visibility change (user leaves/returns to app)
        document.addEventListener('visibilitychange', handleVisibilityChange);

        // Handle URL query parameters for app shortcuts
        handleUrlParams();
    };

    // Handle URL query parameters for app shortcuts
    const handleUrlParams = () => {
        const urlParams = new URLSearchParams(window.location.search);
        const action = urlParams.get('action');

        if (action === 'focus') {
            // Set to focus mode and start timer
            setMode('focus');
            TimerModule.start();
            WakeLockModule.request();
            UIModule.updatePlayPauseButton(true);
        } else if (action === 'addtask') {
            // Focus and scroll to task input
            const { elements } = UIModule;
            if (elements.taskInput) {
                elements.taskInput.focus();
                elements.taskInput.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }
        }

        // Clean up URL parameters to prevent re-triggering on refresh
        if (action) {
            window.history.replaceState({}, document.title, window.location.pathname);
        }
    };

    // Handle restored timer state from localStorage
    const handleRestoredTimerState = (restored) => {
        if (restored.completed) {
            // Timer completed while app was closed
            
            // Record the session if it was a focus session
            if (restored.mode === 'focus') {
                const duration = Math.floor(restored.totalSeconds / 60);
                const activeTask = TaskModule.getActive();
                HistoryModule.recordSession(
                    duration,
                    activeTask?.id || null,
                    activeTask?.name || null
                );
                
                // Show notification
                UIModule.notify(
                    'Focus Session Complete!',
                    `Great work! You focused for ${duration} minutes while away.`
                );
                
                // Launch confetti
                ConfettiModule.launch();
                AudioModule.playBeep();
            }
            
            // Auto advance to next mode
            const todayStats = HistoryModule.getTodayStats();
            const nextMode = restored.mode === 'focus' 
                ? (todayStats.sessions % 4 === 0 ? 'long' : 'short')
                : 'focus';
            setMode(nextMode);
        } else {
            // Timer has remaining time - resume it
            
            currentMode = restored.mode;
            UIModule.setMode(restored.mode);
            TimerModule.applyRestoredState(restored);
            UIModule.updateTimer(TimerModule.getState());
            UIModule.updatePlayPauseButton(restored.isRunning);
        }
    };

    // Handle page visibility changes
    const handleVisibilityChange = () => {
        if (document.hidden) {
            // User is leaving the page - state is already saved on each tick
        } else {
            // User returned - recalculate timer if running
            const state = TimerModule.getState();
            if (state.isRunning) {
                UIModule.updateTimer(state);
            }
        }
    };

    // Initialize custom duration input with saved value
    const initCustomDurationInput = () => {
        const { elements } = UIModule;
        if (elements.customFocusDuration) {
            elements.customFocusDuration.value = SettingsModule.getFocusDuration();
        }
    };

    // Cycle to next mode: focus -> short -> long -> focus
    const cycleMode = () => {
        const currentIndex = MODES.indexOf(currentMode);
        const nextIndex = (currentIndex + 1) % MODES.length;
        setMode(MODES[nextIndex]);
    };

    const setMode = (mode) => {
        TimerModule.pause();
        TimerModule.clearPersistedState();
        currentMode = mode;
        
        const duration = SettingsModule.getModeDuration(mode);
        TimerModule.setDuration(duration);
        TimerModule.setMode(mode);
        
        UIModule.setMode(mode);
        UIModule.updateTimer(TimerModule.getState());
        UIModule.updatePlayPauseButton(false);
    };

    const onTimerTick = (state) => {
        UIModule.updateTimer(state);
    };

        // Timer completion - record to ff_history + confetti
    const onTimerComplete = (mode) => {
        // Release wake lock when timer completes
        WakeLockModule.release();
        
        // Trigger haptic feedback for timer completion
        HapticsModule.timerComplete();
        
        // Clear badge when timer completes
        BadgeModule.clear();
        
        AudioModule.playBeep();
        
        if (mode === 'focus') {
            const activeTask = TaskModule.getActive();
            const duration = TimerModule.getDurationMinutes();
            
            // Record session to ff_history
            HistoryModule.recordSession(
                duration,
                activeTask?.id || null,
                activeTask?.name || null
            );
            
            // Launch confetti celebration
            ConfettiModule.launch();
            
            UIModule.notify(
                'Focus Session Complete!',
                `Great work! You focused for ${duration} minutes.`
            );
            
            // Auto advance to break
            const todayStats = HistoryModule.getTodayStats();
            const nextMode = todayStats.sessions % 4 === 0 ? 'long' : 'short';
            setMode(nextMode);
        } else {
            UIModule.notify('Break Complete!', 'Ready for another focus session?');
            setMode('focus');
        }
        
        UIModule.updateTimer(TimerModule.getState());
        UIModule.updatePlayPauseButton(false);
    };

    const bindEvents = () => {
        const { elements } = UIModule;

        // Play/Pause
        elements.playPauseBtn?.addEventListener('click', () => {
            const state = TimerModule.getState();
            if (state.isRunning) {
                TimerModule.pause();
                // Release wake lock when timer pauses
                WakeLockModule.release();
            } else {
                TimerModule.start();
                // Request wake lock when timer starts (prevents screen sleep)
                WakeLockModule.request();
            }
            UIModule.updatePlayPauseButton(TimerModule.getState().isRunning);
            // Update badge when timer state changes
            BadgeModule.updateFromState();
        });

        // Reset
        elements.resetBtn?.addEventListener('click', () => {
            TimerModule.reset();
            UIModule.updateTimer(TimerModule.getState());
            UIModule.updatePlayPauseButton(false);
            // Update badge when timer is reset
            BadgeModule.updateFromState();
        });

        // Skip
        elements.skipBtn?.addEventListener('click', () => {
            const state = TimerModule.getState();
            if (currentMode === 'focus' && state.isRunning) {
                const elapsed = TimerModule.getElapsedMinutes();
                if (elapsed >= 1) {
                    const activeTask = TaskModule.getActive();
                    HistoryModule.recordSession(
                        elapsed,
                        activeTask?.id || null,
                        activeTask?.name || null
                    );
                }
            }
            
            if (currentMode === 'focus') {
                setMode('short');
            } else {
                setMode('focus');
            }
        });

        // Mode buttons
        elements.modeBtns.forEach(btn => {
            btn.addEventListener('click', () => setMode(btn.dataset.mode));
        });

        // Add task
        const addTask = () => {
            const name = elements.taskInput?.value;
            if (name && name.trim()) {
                TaskModule.add(name);
                elements.taskInput.value = '';
                UIModule.renderTasks();
                // Update badge after adding task
                BadgeModule.updateFromState();
            }
        };

        elements.addTaskBtn?.addEventListener('click', addTask);
        elements.taskInput?.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') addTask();
        });

        // Task list clicks
        elements.taskList?.addEventListener('click', (e) => {
            const taskItem = e.target.closest('.task-item');
            if (!taskItem) return;

            const taskId = taskItem.dataset.id;
            const action = e.target.dataset.action;

            if (action === 'delete') {
                TaskModule.remove(taskId);
                // Update badge after task removal
                BadgeModule.updateFromState();
            } else if (action === 'complete') {
                const task = TaskModule.toggleComplete(taskId);
                // Trigger haptic feedback when completing a task
                if (task && task.completed) {
                    HapticsModule.taskComplete();
                }
                // Update badge after task completion
                BadgeModule.updateFromState();
            } else if (action === 'select' || !action) {
                const task = TaskModule.getAll().find(t => t.id === taskId);
                if (task && !task.completed) {
                    TaskModule.setActive(taskId);
                }
            }

            UIModule.renderTasks();
        });

        // Settings modal
        elements.settingsBtn?.addEventListener('click', () => {
            UIModule.toggleSettings(true);
        });

        elements.settingsClose?.addEventListener('click', () => {
            UIModule.toggleSettings(false);
        });

        elements.settingsModal?.addEventListener('click', (e) => {
            if (e.target === elements.settingsModal) {
                UIModule.toggleSettings(false);
            }
        });

        // Theme selector
        elements.themeBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                const theme = btn.dataset.theme;
                ThemeModule.set(theme);
                UIModule.updateThemeButtons(theme);
            });
        });

        // Shortcuts modal
        elements.shortcutsBtn?.addEventListener('click', () => {
            UIModule.toggleShortcuts(true);
        });

        elements.shortcutsClose?.addEventListener('click', () => {
            UIModule.toggleShortcuts(false);
        });

        elements.shortcutsModal?.addEventListener('click', (e) => {
            if (e.target === elements.shortcutsModal) {
                UIModule.toggleShortcuts(false);
            }
        });

        // Audio toggle (lazy init on user interaction)
        elements.audioToggle?.addEventListener('click', () => {
            const isPlaying = AudioModule.toggle();
            UIModule.updateAudioToggle(isPlaying);
            
            // Initialize Media Session when audio is first toggled
            if (isPlaying) {
                MediaSessionModule.init();
            }
            MediaSessionModule.updatePlaybackState(isPlaying);
        });

        elements.audioToggle?.addEventListener('keypress', (e) => {
            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                const isPlaying = AudioModule.toggle();
                UIModule.updateAudioToggle(isPlaying);
            }
        });

        // Volume slider
        elements.volumeSlider?.addEventListener('input', (e) => {
            const value = parseInt(e.target.value, 10);
            AudioModule.setVolume(value / 100);
            UIModule.updateVolumeDisplay(value);
        });

        // Custom focus duration input
        elements.customFocusDuration?.addEventListener('change', (e) => {
            const newDuration = SettingsModule.setFocusDuration(e.target.value);
            e.target.value = newDuration; // Update to validated value
            
            // If currently in focus mode and not running, update the timer
            if (currentMode === 'focus' && !TimerModule.getState().isRunning) {
                setMode('focus');
            }
        });

        // Clear history with confirmation
        elements.clearHistoryBtn?.addEventListener('click', () => {
            if (confirm('Clear all focus history? This action cannot be undone.')) {
                HistoryModule.clearHistory();
                UIModule.updateStatsDisplay();
                UIModule.toggleSettings(false);
                // Update badge after clearing history
                BadgeModule.updateFromState();
            }
        });

        // Data Export
        elements.exportDataBtn?.addEventListener('click', () => {
            const result = AppData.exportData();
            if (!result.success) {
                alert('Export failed: ' + result.error);
            }
        });

        // Data Import
        elements.importDataBtn?.addEventListener('click', () => {
            elements.importFileInput?.click();
        });

        elements.importFileInput?.addEventListener('change', async (e) => {
            const file = e.target.files?.[0];
            if (!file) return;

            const result = await AppData.importData(file);
            
            // Reset file input for future imports
            e.target.value = '';

            if (result.success) {
                if (result.reloadRequired) {
                    alert('Backup restored successfully! The page will now reload.');
                    window.location.reload();
                }
            } else {
                alert('Import failed: ' + result.error);
            }
            
            // Update badge after import
            BadgeModule.updateFromState();
        });

        // Timer display click - cycle mode
        elements.timerDisplay?.addEventListener('click', () => {
            cycleMode();
        });

        elements.timerDisplay?.addEventListener('keypress', (e) => {
            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                cycleMode();
            }
        });

        // Stats panel
        elements.statsBtn?.addEventListener('click', () => {
            UIModule.toggleStats(true);
        });

        elements.statsClose?.addEventListener('click', () => {
            UIModule.toggleStats(false);
        });

        elements.statsOverlay?.addEventListener('click', (e) => {
            if (e.target === elements.statsOverlay) {
                UIModule.toggleStats(false);
            }
        });

        // Window resize for chart
        let resizeTimeout;
        window.addEventListener('resize', () => {
            clearTimeout(resizeTimeout);
            resizeTimeout = setTimeout(() => {
                if (elements.statsOverlay?.classList.contains('visible')) {
                    UIModule.updateStatsDisplay();
                }
            }, 150);
        });
    };

    // Initialize keyboard shortcuts via AppInput module
    const initKeyboardShortcuts = () => {
        AppInput.init({
            onToggleTimer: () => {
                const state = TimerModule.getState();
                if (state.isRunning) {
                    TimerModule.pause();
                    WakeLockModule.release();
                } else {
                    TimerModule.start();
                    WakeLockModule.request();
                }
                UIModule.updatePlayPauseButton(TimerModule.getState().isRunning);
                // Update badge when timer state changes via keyboard
                BadgeModule.updateFromState();
            },
            onEscape: () => {
                UIModule.toggleStats(false);
                UIModule.toggleSettings(false);
                UIModule.toggleShortcuts(false);
            },
            onNewTask: () => {
                const { elements } = UIModule;
                if (elements.taskInput) {
                    elements.taskInput.focus();
                    elements.taskInput.scrollIntoView({ behavior: 'smooth', block: 'center' });
                }
            }
        });
    };

    return { init };
})();


/* ============================================
   INITIALIZATION
   Wait for DOMContentLoaded to prevent errors
   ============================================ */
document.addEventListener('DOMContentLoaded', App.init);
