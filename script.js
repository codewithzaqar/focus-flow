/* ============================================
   FOCUSFLOW v0.0.5.dev3 - JavaScript
   Multi-File Architecture Build (PWA Edition)
   Advanced PWA: Shortcuts, WCO, Wake Lock, Media Session, Haptics, Badging
   Gamification: Flow Level System (XP, Levels, Progress, Achievements, Streaks, Daily Goals, RPG Profile)
   ============================================
   
   Modular Architecture:
   1. StorageModule - localStorage management
   2. HistoryModule - ff_history analytics storage
   3. TaskModule - Task queue CRUD operations
   4. TimerModule - Pomodoro timer logic (with Date.now precision + persistence)
   5. AudioModule - Web Audio API brown noise (lazy init)
   6. SFXModule - Sound Effects toggle management
   7. ChartModule - Canvas API bar chart
   8. ConfettiModule - Celebration effect
   9. SettingsModule - User preferences (with custom duration + theme)
   10. ThemeModule - Theme switching (Default/Midnight/Forest)
   11. UIModule - DOM interactions
   12. AppData - Data backup/restore (JSON Export/Import)
   13. AppInput - Keyboard shortcut handler
   14. AppNetwork - Online/Offline detection
   15. App.PWA - Service Worker registration, install prompt, & update detection
   16. WakeLockModule - Screen Wake Lock API (prevent sleep during timer)
   17. MediaSessionModule - Media Session API (lock screen controls)
   18. HapticsModule - Vibration API (tactile feedback)
   19. BadgeModule - Badging API (app icon badges)
   20. GamificationModule - XP, Levels, Flow Level system
   21. AchievementModule - Badge/Achievement system
   22. StreakModule - Daily streak tracking
   23. DailyGoalModule - Daily goal (4 sessions) with bonus XP
   24. App - Main initialization (with URL shortcut params)
   
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
        TIMER_STATE: 'focusflow_timer_state',
        GAMIFICATION: 'focusflow_gamification',
        ACHIEVEMENTS: 'ff_achievements',
        SFX_ENABLED: 'focusflow_sfx_enabled'
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
   MODULE 6: SFXModule
   Sound Effects Management
   Controls SFX toggle state and respects user preference
   ============================================ */
const SFXModule = (() => {
    let sfxEnabled = true;

    const init = () => {
        const saved = StorageModule.get(StorageModule.KEYS.SFX_ENABLED, true);
        sfxEnabled = saved !== false; // Default to true if not set
    };

    const save = () => {
        StorageModule.set(StorageModule.KEYS.SFX_ENABLED, sfxEnabled);
    };

    const isEnabled = () => sfxEnabled;

    const setEnabled = (enabled) => {
        sfxEnabled = enabled;
        save();
    };

    const toggle = () => {
        sfxEnabled = !sfxEnabled;
        save();
        return sfxEnabled;
    };

    // Play sound only if SFX is enabled
    const playIfEnabled = (soundFunction) => {
        if (sfxEnabled && soundFunction) {
            soundFunction();
        }
    };

    return {
        init,
        isEnabled,
        setEnabled,
        toggle,
        playIfEnabled
    };
})();


/* ============================================
   MODULE 8: ChartModule
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
   MODULE 8: ChartModule
   HTML5 Canvas Bar Chart
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
   MODULE 9: SettingsModule
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
        // Gamification elements
        elements.brandLevel = $('#brandLevel');
        elements.xpBarFill = $('#xpBarFill');
        elements.xpText = $('#xpText');
        elements.xpFloatContainer = $('#xpFloatContainer');
        // Achievement elements
        elements.achievementsBtn = $('#achievementsBtn');
        elements.achievementsModal = $('#achievementsModal');
        elements.achievementsClose = $('#achievementsClose');
        elements.achievementsGrid = $('#achievementsGrid');
        // Streak elements
        elements.streakIndicator = $('#streakIndicator');
        elements.streakCount = $('#streakCount');
        // Level Up elements
        elements.levelupOverlay = $('#levelupOverlay');
        elements.levelupNewLevel = $('#levelupNewLevel');
        elements.levelupLevelNum = $('#levelupLevelNum');
        // Daily Goal elements
        elements.dailyGoalProgress = $('#dailyGoalProgress');
        elements.dailyGoalCount = $('#dailyGoalCount');
        // Flow Profile Card elements
        elements.profileLevelBadge = $('#profileLevelBadge');
        elements.profileTitle = $('#profileTitle');
        elements.profileXpFill = $('#profileXpFill');
        elements.profileXpText = $('#profileXpText');
        elements.profileFocusHours = $('#profileFocusHours');
        elements.profileTasksCrushed = $('#profileTasksCrushed');
        elements.profileStreak = $('#profileStreak');
        elements.profileBadges = $('#profileBadges');
        elements.shareProgressBtn = $('#shareProgressBtn');
        // SFX Toggle
        elements.sfxToggle = $('#sfxToggle');
        // Clipboard Toast
        elements.clipboardToast = $('#clipboardToast');
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

    // Update XP display in header
    const updateXPDisplay = () => {
        const state = GamificationModule.getState();
        
        if (elements.brandLevel) {
            elements.brandLevel.textContent = `Lvl ${state.level}`;
        }
        if (elements.xpBarFill) {
            elements.xpBarFill.style.width = `${Math.round(state.progress * 100)}%`;
        }
        if (elements.xpText) {
            elements.xpText.textContent = `${state.xpInLevel} / ${state.xpNeeded} XP`;
        }
    };

    // Spawn floating XP text animation
    const spawnXPFloat = (amount, sourceElement) => {
        if (!elements.xpFloatContainer) return;
        
        const float = document.createElement('div');
        float.className = 'xp-float';
        float.textContent = `+${amount} XP`;
        
        // Position near the source element or center of screen
        let x = window.innerWidth / 2;
        let y = window.innerHeight / 2;
        
        if (sourceElement) {
            const rect = sourceElement.getBoundingClientRect();
            x = rect.left + rect.width / 2;
            y = rect.top;
        }
        
        float.style.left = `${x}px`;
        float.style.top = `${y}px`;
        float.style.transform = 'translateX(-50%)';
        
        elements.xpFloatContainer.appendChild(float);
        
        // Clean up after animation
        setTimeout(() => {
            float.remove();
        }, 1300);
    };

    // Trigger level-up shimmer on XP bar
    const triggerLevelUp = () => {
        if (elements.xpBarFill) {
            elements.xpBarFill.classList.add('level-up');
            setTimeout(() => {
                elements.xpBarFill.classList.remove('level-up');
            }, 900);
        }
    };

    // Show Level Up animation overlay
    const showLevelUpAnimation = (newLevel) => {
        if (!elements.levelupOverlay) return;
        
        // Update the level numbers
        if (elements.levelupNewLevel) {
            elements.levelupNewLevel.textContent = newLevel;
        }
        if (elements.levelupLevelNum) {
            elements.levelupLevelNum.textContent = newLevel;
        }
        
        // Show the overlay
        elements.levelupOverlay.classList.add('visible');
        
        // Play success sound only if SFX enabled
        SFXModule.playIfEnabled(AudioModule.playBeep);
        
        // Auto-hide after 3 seconds
        setTimeout(() => {
            elements.levelupOverlay.classList.add('fading');
            setTimeout(() => {
                elements.levelupOverlay.classList.remove('visible', 'fading');
            }, 500);
        }, 3000);
    };

    // Update streak display in header
    const updateStreakDisplay = (streak) => {
        if (elements.streakCount) {
            elements.streakCount.textContent = streak;
        }
        // Hide streak indicator if streak is 0
        if (elements.streakIndicator) {
            elements.streakIndicator.style.display = streak > 0 ? 'flex' : 'none';
        }
    };

    // Update daily goal widget display
    const updateDailyGoalDisplay = (progress) => {
        if (!elements.dailyGoalProgress || !elements.dailyGoalCount) return;

        // Update count
        elements.dailyGoalCount.textContent = progress.sessionsToday;

        // Update progress ring
        const circumference = 2 * Math.PI * 42; // r=42
        const offset = circumference * (1 - progress.progress);
        elements.dailyGoalProgress.style.strokeDashoffset = offset;

        // Add completed class if goal reached
        const goalSection = document.querySelector('.daily-goal-section');
        if (goalSection) {
            if (progress.goalReached) {
                goalSection.classList.add('completed');
            } else {
                goalSection.classList.remove('completed');
            }

            // Add animation class if just reached
            if (progress.goalJustReached) {
                goalSection.classList.add('goal-reached');
                setTimeout(() => {
                    goalSection.classList.remove('goal-reached');
                }, 600);
            }
        }
    };

    // Update Flow Profile Card display
    const updateFlowProfileDisplay = () => {
        const gamification = GamificationModule.getState();
        const history = HistoryModule.getStats();
        const streak = StreakModule.getStreak();
        const badges = AchievementModule.getUnlockedCount();

        // Calculate hours from minutes
        const hours = Math.floor(history.totalMinutes / 60);
        // Use total tasks completed from gamification (persists even if tasks deleted)
        const tasksCompleted = GamificationModule.getTasksCompleted();

        // Update level badge
        if (elements.profileLevelBadge) {
            elements.profileLevelBadge.textContent = gamification.level;
        }

        // Update XP bar
        if (elements.profileXpFill) {
            elements.profileXpFill.style.width = `${Math.round(gamification.progress * 100)}%`;
        }

        // Update XP text
        if (elements.profileXpText) {
            elements.profileXpText.textContent = `${gamification.xpInLevel} / ${gamification.xpNeeded} XP to next level`;
        }

        // Update stats
        if (elements.profileFocusHours) {
            elements.profileFocusHours.textContent = hours;
        }
        if (elements.profileTasksCrushed) {
            elements.profileTasksCrushed.textContent = tasksCompleted;
        }
        if (elements.profileStreak) {
            elements.profileStreak.textContent = streak;
        }
        if (elements.profileBadges) {
            elements.profileBadges.textContent = badges;
        }
    };

    // Update SFX toggle UI
    const updateSFXToggle = (enabled) => {
        if (elements.sfxToggle) {
            elements.sfxToggle.classList.toggle('active', enabled);
            elements.sfxToggle.setAttribute('aria-checked', enabled);
        }
    };

    // Show clipboard toast notification
    const showClipboardToast = () => {
        if (!elements.clipboardToast) return;

        elements.clipboardToast.classList.add('visible');

        setTimeout(() => {
            elements.clipboardToast.classList.remove('visible');
        }, 2000);
    };

    // Share progress to clipboard
    const shareProgress = async () => {
        try {
            const gamification = GamificationModule.getState();
            const streak = StreakModule.getStreak();
            const badges = AchievementModule.getUnlockedCount();

            const shareText = `I'm Level ${gamification.level} on FocusFlow! 🔥 ${streak} Day Streak | 🏆 ${badges} Badge${badges !== 1 ? 's' : ''} Unlocked. #FocusFlow`;

            await navigator.clipboard.writeText(shareText);
            showClipboardToast();
        } catch (error) {
            // Fallback: try to use document.execCommand
            try {
                const textarea = document.createElement('textarea');
                textarea.value = shareText;
                textarea.style.position = 'fixed';
                textarea.style.left = '-9999px';
                document.body.appendChild(textarea);
                textarea.select();
                document.execCommand('copy');
                document.body.removeChild(textarea);
                showClipboardToast();
            } catch (e) {
                // Clipboard failed, ignore
            }
        }
    };

    // Toggle achievements modal
    const toggleAchievements = (show) => {
        if (elements.achievementsModal) {
            elements.achievementsModal.classList.toggle('visible', show);
            if (show) {
                renderAchievements();
            }
        }
    };

    // Render achievements grid
    const renderAchievements = () => {
        if (!elements.achievementsGrid) return;

        const badges = AchievementModule.getAllBadges();

        elements.achievementsGrid.innerHTML = badges.map(badge => {
            const unlockDate = badge.unlockedAt 
                ? new Date(badge.unlockedAt).toLocaleDateString() 
                : null;

            return `
                <div class="badge-item ${badge.unlocked ? 'unlocked' : 'locked'}">
                    <div class="badge-icon">
                        ${badge.icon}
                    </div>
                    <span class="badge-name">${badge.name}</span>
                    <span class="badge-desc">${badge.description}</span>
                    ${unlockDate ? `<span class="badge-unlock-date">${unlockDate}</span>` : ''}
                </div>
            `;
        }).join('');
    };

    // Show rate limit toast
    const showRateLimitToast = () => {
        // Create toast element if it doesn't exist
        let toast = document.getElementById('rateLimitToast');
        if (!toast) {
            toast = document.createElement('div');
            toast.id = 'rateLimitToast';
            toast.className = 'rate-limit-toast';
            toast.innerHTML = `
                <div class="rate-limit-icon">
                    <svg viewBox="0 0 24 24" width="20" height="20"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
                </div>
                <div class="rate-limit-content">
                    <span class="rate-limit-title">Task Completed</span>
                    <span class="rate-limit-message">XP rate limit: Max 5 tasks/hour</span>
                </div>
            `;
            document.body.appendChild(toast);
        }

        // Show toast
        toast.classList.add('visible');

        // Hide after 3 seconds
        setTimeout(() => {
            toast.classList.remove('visible');
        }, 3000);
    };

    // Show achievement unlock toast
    const showAchievementToast = (badgeName) => {
        // Create toast element if it doesn't exist
        let toast = document.getElementById('achievementToast');
        if (!toast) {
            toast = document.createElement('div');
            toast.id = 'achievementToast';
            toast.className = 'achievement-toast';
            toast.innerHTML = `
                <div class="achievement-toast-icon">
                    <svg viewBox="0 0 24 24"><path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6"/><path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18"/><path d="M4 22h16"/><path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22"/><path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22"/><circle cx="12" cy="9" r="6"/></svg>
                </div>
                <div class="achievement-toast-content">
                    <span class="achievement-toast-title">Achievement Unlocked</span>
                    <span class="achievement-toast-name" id="achievementToastName"></span>
                </div>
            `;
            document.body.appendChild(toast);
        }

        // Update badge name
        const nameEl = document.getElementById('achievementToastName');
        if (nameEl) nameEl.textContent = badgeName;

        // Show toast
        toast.classList.add('visible');

        // Hide after 4 seconds
        setTimeout(() => {
            toast.classList.remove('visible');
        }, 4000);
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
        toggleAchievements,
        renderAchievements,
        showAchievementToast,
        showRateLimitToast,
        updateStatsDisplay,
        updateAudioToggle,
        updateVolumeDisplay,
        updateThemeButtons,
        showOfflineBadge,
        showUpdateToast,
        updateXPDisplay,
        spawnXPFloat,
        triggerLevelUp,
        showLevelUpAnimation,
        updateStreakDisplay,
        updateDailyGoalDisplay,
        updateFlowProfileDisplay,
        updateSFXToggle,
        showClipboardToast,
        shareProgress,
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
        theme: 'focusflow_theme',
        timer_state: 'focusflow_timer_state',
        gamification: 'focusflow_gamification',
        achievements: 'ff_achievements',
        streak: 'focusflow_streak',
        daily_goal: 'focusflow_daily_goal',
        sfx_enabled: 'focusflow_sfx_enabled'
    };

    // Export all data to JSON
    const exportData = () => {
        try {
            const backup = {
                version: 'v0.0.5.dev3',
                exportedAt: new Date().toISOString(),
                ff_tasks: StorageModule.get(BACKUP_KEYS.tasks, { tasks: [], activeTaskId: null }),
                ff_history: StorageModule.get(BACKUP_KEYS.history, []),
                ff_settings: StorageModule.get(BACKUP_KEYS.settings, SettingsModule.DEFAULT_SETTINGS),
                ff_theme: StorageModule.get(BACKUP_KEYS.theme, 'default'),
                ff_timer_state: StorageModule.get(BACKUP_KEYS.timer_state, null),
                ff_gamification: StorageModule.get(BACKUP_KEYS.gamification, { totalXP: 0 }),
                ff_achievements: StorageModule.get(BACKUP_KEYS.achievements, []),
                ff_streak: StorageModule.get(BACKUP_KEYS.streak, { streak: 0, lastFocusDate: null }),
                ff_daily_goal: StorageModule.get(BACKUP_KEYS.daily_goal, { sessionsToday: 0, lastResetDate: null, goalReachedToday: false }),
                ff_sfx_enabled: StorageModule.get(BACKUP_KEYS.sfx_enabled, true)
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
                    if (data.ff_timer_state) {
                        StorageModule.set(BACKUP_KEYS.timer_state, data.ff_timer_state);
                    }
                    if (data.ff_gamification) {
                        StorageModule.set(BACKUP_KEYS.gamification, data.ff_gamification);
                    }
                    if (data.ff_achievements) {
                        StorageModule.set(BACKUP_KEYS.achievements, data.ff_achievements);
                    }
                    if (data.ff_streak) {
                        StorageModule.set(BACKUP_KEYS.streak, data.ff_streak);
                    }
                    if (data.ff_daily_goal) {
                        StorageModule.set(BACKUP_KEYS.daily_goal, data.ff_daily_goal);
                    }
                    if (data.ff_sfx_enabled !== undefined) {
                        StorageModule.set(BACKUP_KEYS.sfx_enabled, data.ff_sfx_enabled);
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
   MODULE 19: GamificationModule
   XP, Levels, Flow Level system
   Rule: 1 min focus = 10 XP, 1 completed task = 50 XP
   Anti-cheat: Max 5 task completions per hour
   ============================================ */
const GamificationModule = (() => {
    // Level thresholds: Level N requires LEVELS[N-1] total XP to reach
    // Exponential curve: Level 1=0, L2=500, L3=1250 (500*2.5), L4=2500 (1250*2), etc.
    const LEVELS = [0, 500, 1250, 2500, 4750, 8750, 15750, 27750, 47750, 79750];

    const XP_PER_MINUTE = 10;
    const XP_PER_TASK = 50;
    const MAX_TASK_XP_PER_HOUR = 5; // Anti-cheat: max 5 tasks per hour

    let state = { totalXP: 0, tasksCompleted: 0 };
    let xpTodayState = {
        taskCompletions: [], // Array of timestamps when tasks were completed for XP
        lastResetDate: null
    };

    const init = () => {
        const saved = StorageModule.get(StorageModule.KEYS.GAMIFICATION, { totalXP: 0, tasksCompleted: 0 });
        state.totalXP = saved.totalXP || 0;
        state.tasksCompleted = saved.tasksCompleted || 0;
        
        // Load xpToday state for anti-cheat
        const savedXpToday = StorageModule.get('focusflow_xp_today', {
            taskCompletions: [],
            lastResetDate: null
        });
        xpTodayState = {
            taskCompletions: Array.isArray(savedXpToday.taskCompletions) ? savedXpToday.taskCompletions : [],
            lastResetDate: savedXpToday.lastResetDate || null
        };
        
        // Clean up old entries (older than 1 hour)
        cleanupOldTaskCompletions();
    };

    const save = () => {
        StorageModule.set(StorageModule.KEYS.GAMIFICATION, state);
        StorageModule.set('focusflow_xp_today', xpTodayState);
    };

    // Anti-cheat: Remove task completion timestamps older than 1 hour
    const cleanupOldTaskCompletions = () => {
        const oneHourAgo = Date.now() - (60 * 60 * 1000);
        const beforeCount = xpTodayState.taskCompletions.length;
        xpTodayState.taskCompletions = xpTodayState.taskCompletions.filter(ts => ts > oneHourAgo);
        
        // Save if we removed any entries
        if (xpTodayState.taskCompletions.length !== beforeCount) {
            save();
        }
    };

    // Anti-cheat: Check if user can earn XP for task completion
    const canEarnTaskXP = () => {
        cleanupOldTaskCompletions();
        return xpTodayState.taskCompletions.length < MAX_TASK_XP_PER_HOUR;
    };

    // Anti-cheat: Get remaining task XP slots this hour
    const getRemainingTaskXPSlots = () => {
        cleanupOldTaskCompletions();
        return Math.max(0, MAX_TASK_XP_PER_HOUR - xpTodayState.taskCompletions.length);
    };

    const getTasksCompleted = () => state.tasksCompleted;

    const getLevel = () => {
        for (let i = LEVELS.length - 1; i >= 0; i--) {
            if (state.totalXP >= LEVELS[i]) {
                return i + 1;
            }
        }
        return 1;
    };

    // Get XP thresholds for current level
    const getLevelBounds = () => {
        const level = getLevel();
        const currentThreshold = LEVELS[level - 1] || 0;
        const nextThreshold = LEVELS[level] || (currentThreshold + 50000);
        return { current: currentThreshold, next: nextThreshold, level };
    };

    // Get progress within current level (0-1)
    const getLevelProgress = () => {
        const bounds = getLevelBounds();
        const xpInLevel = state.totalXP - bounds.current;
        const xpNeeded = bounds.next - bounds.current;
        return xpNeeded > 0 ? Math.min(1, xpInLevel / xpNeeded) : 1;
    };

    // Award XP and return { awarded, newLevel, leveledUp }
    const awardXP = (amount) => {
        const oldLevel = getLevel();
        state.totalXP += amount;
        save();
        const newLevel = getLevel();
        const result = {
            awarded: amount,
            totalXP: state.totalXP,
            newLevel,
            leveledUp: newLevel > oldLevel
        };
        
        // Launch confetti on level up
        if (result.leveledUp) {
            ConfettiModule.launch();
        }
        
        return result;
    };

    // Award XP for focus minutes
    const awardFocusXP = (minutes) => {
        if (minutes <= 0) return null;
        return awardXP(minutes * XP_PER_MINUTE);
    };

    // Award XP for task completion (with anti-cheat rate limiting)
    const awardTaskXP = () => {
        // Anti-cheat: Check rate limit
        if (!canEarnTaskXP()) {
            return {
                awarded: 0,
                totalXP: state.totalXP,
                newLevel: getLevel(),
                leveledUp: false,
                rateLimited: true,
                remainingSlots: 0
            };
        }
        
        // Record this task completion for rate limiting
        xpTodayState.taskCompletions.push(Date.now());
        
        state.tasksCompleted += 1;
        save();
        const result = awardXP(XP_PER_TASK);
        result.remainingSlots = getRemainingTaskXPSlots();
        return result;
    };

    const getTotalXP = () => state.totalXP;

    const getState = () => {
        const bounds = getLevelBounds();
        return {
            totalXP: state.totalXP,
            level: bounds.level,
            progress: getLevelProgress(),
            currentThreshold: bounds.current,
            nextThreshold: bounds.next,
            xpInLevel: state.totalXP - bounds.current,
            xpNeeded: bounds.next - bounds.current
        };
    };

    // Reset XP (for clear history)
    const reset = () => {
        state.totalXP = 0;
        state.tasksCompleted = 0;
        xpTodayState = {
            taskCompletions: [],
            lastResetDate: null
        };
        save();
    };

    return {
        init, awardFocusXP, awardTaskXP, getTotalXP, getTasksCompleted,
        getLevel, getLevelProgress, getLevelBounds, getState, reset,
        canEarnTaskXP, getRemainingTaskXPSlots,
        XP_PER_MINUTE, XP_PER_TASK, MAX_TASK_XP_PER_HOUR
    };
})();


/* ============================================
   MODULE 20: AchievementModule
   Badge/Achievement System
   Tracks and awards unlockable badges
   ============================================ */
const AchievementModule = (() => {
    // Badge definitions
    const BADGES = {
        NOVICE_FLOW: {
            id: 'novice_flow',
            name: 'Novice Flow',
            description: 'Complete your first 25m session',
            icon: `<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg>`,
            check: () => {
                const records = HistoryModule.getRecords();
                return records.some(r => r.duration >= 25);
            }
        },
        TASK_MASTER: {
            id: 'task_master',
            name: 'Task Master',
            description: 'Complete 10 tasks total',
            icon: `<svg viewBox="0 0 24 24"><path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg>`,
            check: () => {
                const tasks = TaskModule.getAll();
                return tasks.filter(t => t.completed).length >= 10;
            }
        },
        MARATHONER: {
            id: 'marathoner',
            name: 'Marathoner',
            description: 'Reach Level 5',
            icon: `<svg viewBox="0 0 24 24"><path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6"/><path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18"/><path d="M4 22h16"/><path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22"/><path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22"/><circle cx="12" cy="9" r="6"/></svg>`,
            check: () => {
                return GamificationModule.getLevel() >= 5;
            }
        },
        NIGHT_OWL: {
            id: 'night_owl',
            name: 'Night Owl',
            description: 'Complete a session after 10 PM',
            icon: `<svg viewBox="0 0 24 24"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>`,
            check: () => {
                const records = HistoryModule.getRecords();
                return records.some(r => {
                    const date = new Date(r.timestamp);
                    const hour = date.getHours();
                    return hour >= 22 || hour < 5;
                });
            }
        }
    };

    let unlockedBadges = [];

    const init = () => {
        const saved = StorageModule.get(StorageModule.KEYS.ACHIEVEMENTS, []);
        unlockedBadges = Array.isArray(saved) ? saved : [];
        checkAllAchievements();
    };

    const save = () => {
        StorageModule.set(StorageModule.KEYS.ACHIEVEMENTS, unlockedBadges);
    };

    const isUnlocked = (badgeId) => {
        return unlockedBadges.some(b => b.id === badgeId);
    };

    const unlockBadge = (badgeId) => {
        if (isUnlocked(badgeId)) return null;

        const badge = Object.values(BADGES).find(b => b.id === badgeId);
        if (!badge) return null;

        const unlockData = {
            id: badgeId,
            unlockedAt: Date.now()
        };

        unlockedBadges.push(unlockData);
        save();

        // Show notification
        UIModule.showAchievementToast(badge.name);

        // Play success sound (beep) - only if SFX enabled
        SFXModule.playIfEnabled(AudioModule.playBeep);

        return badge;
    };

    const checkAllAchievements = () => {
        let newUnlocks = [];

        Object.values(BADGES).forEach(badge => {
            if (!isUnlocked(badge.id)) {
                if (badge.check()) {
                    const unlocked = unlockBadge(badge.id);
                    if (unlocked) newUnlocks.push(unlocked);
                }
            }
        });

        return newUnlocks;
    };

    const checkSpecific = (badgeId) => {
        const badge = BADGES[badgeId];
        if (!badge || isUnlocked(badge.id)) return null;

        if (badge.check()) {
            return unlockBadge(badge.id);
        }

        return null;
    };

    const getAllBadges = () => {
        return Object.values(BADGES).map(badge => ({
            ...badge,
            unlocked: isUnlocked(badge.id),
            unlockedAt: unlockedBadges.find(u => u.id === badge.id)?.unlockedAt
        }));
    };

    const getUnlockedCount = () => unlockedBadges.length;

    const reset = () => {
        unlockedBadges = [];
        save();
    };

    return {
        init,
        checkAllAchievements,
        checkSpecific,
        getAllBadges,
        getUnlockedCount,
        isUnlocked,
        reset,
        BADGES
    };
})();


/* ============================================
    MODULE 21: StreakModule
    Daily Streak System - Track consecutive days of focus sessions
    Algorithm:
    - If LastFocusDate == Yesterday: Increment Streak
    - If LastFocusDate == Today: Maintain Streak
    - If LastFocusDate < Yesterday: Reset Streak to 1
    ============================================ */
const StreakModule = (() => {
    const STREAK_KEY = 'focusflow_streak';
    
    let state = {
        streak: 0,
        lastFocusDate: null
    };

    const init = () => {
        const saved = StorageModule.get(STREAK_KEY, { streak: 0, lastFocusDate: null });
        state.streak = saved.streak || 0;
        state.lastFocusDate = saved.lastFocusDate || null;
        
        // Validate and fix streak on init
        validateStreak();
    };

    const save = () => {
        StorageModule.set(STREAK_KEY, state);
    };

    // Get today's date string (YYYY-MM-DD)
    const getTodayString = () => {
        return new Date().toISOString().split('T')[0];
    };

    // Get yesterday's date string
    const getYesterdayString = () => {
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);
        return yesterday.toISOString().split('T')[0];
    };

    // Validate streak based on last focus date
    const validateStreak = () => {
        const today = getTodayString();
        const yesterday = getYesterdayString();
        
        if (!state.lastFocusDate) {
            // No sessions yet
            state.streak = 0;
        } else if (state.lastFocusDate === today) {
            // Session completed today - streak is valid
            // Streak stays as is
        } else if (state.lastFocusDate === yesterday) {
            // Last session was yesterday - streak is valid
            // Streak stays as is
        } else {
            // Last session was before yesterday - streak broken
            state.streak = 0;
        }
        
        save();
    };

    // Record a focus session and update streak
    const recordSession = () => {
        const today = getTodayString();
        const yesterday = getYesterdayString();
        
        if (state.lastFocusDate === today) {
            // Already completed a session today - maintain streak
            // Don't increment, just update last focus time
        } else if (state.lastFocusDate === yesterday) {
            // Completed yesterday - increment streak
            state.streak += 1;
        } else {
            // Either first session or streak was broken - start at 1
            state.streak = 1;
        }
        
        state.lastFocusDate = today;
        save();
        
        return {
            streak: state.streak,
            isNewDay: state.lastFocusDate !== today
        };
    };

    const getStreak = () => state.streak;

    const getLastFocusDate = () => state.lastFocusDate;

    const reset = () => {
        state = { streak: 0, lastFocusDate: null };
        save();
    };

    return {
        init,
        recordSession,
        getStreak,
        getLastFocusDate,
        validateStreak,
        reset
    };
})();


/* ============================================
    MODULE 22: DailyGoalModule
    Daily Goal Widget - Track 4 focus sessions per day
    Awards 100 XP bonus when goal is reached
    ============================================ */
const DailyGoalModule = (() => {
    const GOAL_KEY = 'focusflow_daily_goal';
    const DAILY_GOAL_TARGET = 4;
    const DAILY_GOAL_BONUS_XP = 100;

    let state = {
        sessionsToday: 0,
        lastResetDate: null,
        goalReachedToday: false
    };

    const init = () => {
        const saved = StorageModule.get(GOAL_KEY, { 
            sessionsToday: 0, 
            lastResetDate: null,
            goalReachedToday: false 
        });
        state.sessionsToday = saved.sessionsToday || 0;
        state.lastResetDate = saved.lastResetDate || null;
        state.goalReachedToday = saved.goalReachedToday || false;
        
        // Check if we need to reset for a new day
        checkDailyReset();
    };

    const save = () => {
        StorageModule.set(GOAL_KEY, state);
    };

    // Get today's date string
    const getTodayString = () => {
        return new Date().toISOString().split('T')[0];
    };

    // Check if we need to reset counter for new day
    const checkDailyReset = () => {
        const today = getTodayString();
        
        if (state.lastResetDate !== today) {
            // New day - reset counter
            state.sessionsToday = 0;
            state.goalReachedToday = false;
            state.lastResetDate = today;
            save();
        }
    };

    // Record a focus session
    const recordSession = () => {
        checkDailyReset();
        
        state.sessionsToday += 1;
        
        // Check if goal just reached
        let goalJustReached = false;
        if (state.sessionsToday === DAILY_GOAL_TARGET && !state.goalReachedToday) {
            state.goalReachedToday = true;
            goalJustReached = true;
        }
        
        save();
        
        return {
            sessionsToday: state.sessionsToday,
            goalTarget: DAILY_GOAL_TARGET,
            progress: Math.min(state.sessionsToday / DAILY_GOAL_TARGET, 1),
            goalReached: state.goalReachedToday,
            goalJustReached: goalJustReached,
            bonusXP: goalJustReached ? DAILY_GOAL_BONUS_XP : 0
        };
    };

    const getProgress = () => {
        checkDailyReset();
        return {
            sessionsToday: state.sessionsToday,
            goalTarget: DAILY_GOAL_TARGET,
            progress: Math.min(state.sessionsToday / DAILY_GOAL_TARGET, 1),
            goalReached: state.goalReachedToday
        };
    };

    const reset = () => {
        state = {
            sessionsToday: 0,
            lastResetDate: null,
            goalReachedToday: false
        };
        save();
    };

    return {
        init,
        recordSession,
        getProgress,
        checkDailyReset,
        reset,
        DAILY_GOAL_TARGET,
        DAILY_GOAL_BONUS_XP
    };
})();


/* ============================================
    MODULE 23: App
    Main application initialization & events
    ============================================ */
const App = (() => {
    let currentMode = 'focus';
    const MODES = ['focus', 'short', 'long'];

    const init = () => {
        UIModule.cache();
        TaskModule.init();
        ChartModule.init('focusChart');
        GamificationModule.init();
        AchievementModule.init();
        StreakModule.init();
        DailyGoalModule.init();
        SFXModule.init();

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

        // Initialize XP display
        UIModule.updateXPDisplay();

        // Initialize streak display
        UIModule.updateStreakDisplay(StreakModule.getStreak());

        // Initialize daily goal display
        UIModule.updateDailyGoalDisplay(DailyGoalModule.getProgress());

        // Initialize Flow Profile display
        UIModule.updateFlowProfileDisplay();

        // Initialize SFX toggle
        UIModule.updateSFXToggle(SFXModule.isEnabled());

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
                
                // Award XP for the completed session
                const xpResult = GamificationModule.awardFocusXP(duration);
                UIModule.updateXPDisplay();
                if (xpResult?.leveledUp) {
                    UIModule.showLevelUpAnimation(xpResult.newLevel);
                    UIModule.triggerLevelUp();
                    AchievementModule.checkSpecific('MARATHONER');
                }
                
                // Update streak
                const streakResult = StreakModule.recordSession();
                UIModule.updateStreakDisplay(streakResult.streak);
                
                // Update daily goal
                const goalResult = DailyGoalModule.recordSession();
                UIModule.updateDailyGoalDisplay(goalResult);
                
                // Award bonus XP if daily goal reached
                if (goalResult.goalJustReached) {
                    const bonusResult = GamificationModule.awardXP(goalResult.bonusXP);
                    UIModule.spawnXPFloat(goalResult.bonusXP, UIModule.elements.dailyGoalProgress);
                    UIModule.updateXPDisplay();
                    if (bonusResult.leveledUp) {
                        UIModule.showLevelUpAnimation(bonusResult.newLevel);
                        UIModule.triggerLevelUp();
                    }
                    SFXModule.playIfEnabled(AudioModule.playBeep); // Play success sound for goal
            }
            
            // Check session-based achievements
                AchievementModule.checkSpecific('NOVICE_FLOW');
                AchievementModule.checkSpecific('NIGHT_OWL');
                
                // Show notification
                UIModule.notify(
                    'Focus Session Complete!',
                    `Great work! You focused for ${duration} minutes while away. +${xpResult?.awarded || 0} XP`
                );
                
                // Launch confetti
                ConfettiModule.launch();
                SFXModule.playIfEnabled(AudioModule.playBeep);
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
        
        // Play completion sound only if SFX enabled
        SFXModule.playIfEnabled(AudioModule.playBeep);
        
        if (mode === 'focus') {
            const activeTask = TaskModule.getActive();
            const duration = TimerModule.getDurationMinutes();
            
            // Record session to ff_history
            HistoryModule.recordSession(
                duration,
                activeTask?.id || null,
                activeTask?.name || null
            );
            
            // Award XP for focus minutes
            const xpResult = GamificationModule.awardFocusXP(duration);
            if (xpResult) {
                UIModule.spawnXPFloat(xpResult.awarded, UIModule.elements.timer);
                UIModule.updateXPDisplay();
                if (xpResult.leveledUp) {
                    UIModule.showLevelUpAnimation(xpResult.newLevel);
                    UIModule.triggerLevelUp();
                    // Check Marathoner achievement on level up
                    AchievementModule.checkSpecific('MARATHONER');
                }
            }
            
            // Update streak
            const streakResult = StreakModule.recordSession();
            UIModule.updateStreakDisplay(streakResult.streak);
            
            // Update daily goal
            const goalResult = DailyGoalModule.recordSession();
            UIModule.updateDailyGoalDisplay(goalResult);
            
            // Award bonus XP if daily goal reached
            if (goalResult.goalJustReached) {
                const bonusResult = GamificationModule.awardXP(goalResult.bonusXP);
                UIModule.spawnXPFloat(goalResult.bonusXP, UIModule.elements.dailyGoalProgress);
                UIModule.updateXPDisplay();
                if (bonusResult.leveledUp) {
                    UIModule.showLevelUpAnimation(bonusResult.newLevel);
                    UIModule.triggerLevelUp();
                }
                    SFXModule.playIfEnabled(AudioModule.playBeep); // Play success sound for goal
                }

                // Check session-based achievements
                AchievementModule.checkSpecific('NOVICE_FLOW');
                AchievementModule.checkSpecific('NIGHT_OWL');

                // Show notification
                UIModule.notify(
                    'Focus Session Complete!',
                `Great work! You focused for ${duration} minutes. +${xpResult?.awarded || 0} XP`
            );
            
            // Auto advance to break
            const todayStats = HistoryModule.getTodayStats();
            const nextMode = todayStats.sessions % 4 === 0 ? 'long' : 'short';
            setMode(nextMode);
        } else {
            UIModule.notify('Break Complete!', 'Ready for another focus session?');
            // Play SFX for break completion
            SFXModule.playIfEnabled(AudioModule.playBeep);
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
                    // Play SFX for task completion
                    SFXModule.playIfEnabled(AudioModule.playBeep);
                    // Award XP for task completion (with anti-cheat rate limiting)
                    const xpResult = GamificationModule.awardTaskXP();
                    if (xpResult) {
                        // Show different feedback based on rate limit status
                        if (xpResult.rateLimited) {
                            // Task completed but XP rate limited
                            UIModule.spawnXPFloat('Task Done!', taskItem);
                            UIModule.showRateLimitToast();
                        } else {
                            // Normal XP award
                            UIModule.spawnXPFloat(xpResult.awarded > 0 ? `+${xpResult.awarded} XP` : 'Task Done!', taskItem);
                            UIModule.updateXPDisplay();
                            if (xpResult.leveledUp) {
                                UIModule.showLevelUpAnimation(xpResult.newLevel);
                                UIModule.triggerLevelUp();
                                AchievementModule.checkSpecific('MARATHONER');
                            }
                        }
                    }
                    // Check Task Master achievement
                    AchievementModule.checkSpecific('TASK_MASTER');
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

        // Achievements modal
        elements.achievementsBtn?.addEventListener('click', () => {
            UIModule.toggleAchievements(true);
        });

        elements.achievementsClose?.addEventListener('click', () => {
            UIModule.toggleAchievements(false);
        });

        elements.achievementsModal?.addEventListener('click', (e) => {
            if (e.target === elements.achievementsModal) {
                UIModule.toggleAchievements(false);
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

        // SFX toggle
        elements.sfxToggle?.addEventListener('click', () => {
            const enabled = SFXModule.toggle();
            UIModule.updateSFXToggle(enabled);
        });

        elements.sfxToggle?.addEventListener('keypress', (e) => {
            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                const enabled = SFXModule.toggle();
                UIModule.updateSFXToggle(enabled);
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
            if (confirm('Clear all focus history, XP progress, and achievements? This action cannot be undone.')) {
                HistoryModule.clearHistory();
                GamificationModule.reset();
                AchievementModule.reset();
                StreakModule.reset();
                DailyGoalModule.reset();
                UIModule.updateStatsDisplay();
                UIModule.updateXPDisplay();
                UIModule.updateStreakDisplay(0);
                UIModule.updateDailyGoalDisplay({ sessionsToday: 0, goalTarget: 4, progress: 0, goalReached: false });
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
            // Update Flow Profile when opening stats
            UIModule.updateFlowProfileDisplay();
        });

        elements.statsClose?.addEventListener('click', () => {
            UIModule.toggleStats(false);
        });

        elements.statsOverlay?.addEventListener('click', (e) => {
            if (e.target === elements.statsOverlay) {
                UIModule.toggleStats(false);
            }
        });

        // Share Progress button
        elements.shareProgressBtn?.addEventListener('click', () => {
            UIModule.shareProgress();
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
                UIModule.toggleAchievements(false);
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
