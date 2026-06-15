const COLORS = [
    '#f87171', '#fb923c', '#fbbf24', '#a3e635',
    '#4ade80', '#34d399', '#22d3ee', '#38bdf8',
    '#60a5fa', '#818cf8', '#a78bfa', '#c084fc',
    '#e879f9', '#f472b6', '#fb7185'
];

const ROW_HEIGHT = 32;
const MIN_GAP = 24;
const SPEED_BASE = 80;
const SPEED_VARIANCE = 60;
const MAX_POOL_SIZE = 50;
const SAFETY_MARGIN = 16;

function escapeHtml(text) {
    if (!text) return '';
    return String(text)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

export class DanmakuEngine {
    constructor(container, options = {}) {
        this.container = container;
        this.options = {
            opacity: 0.9,
            speedScale: 1,
            fontSize: 16,
            onDestroy: null,
            ...options
        };

        this.stage = null;
        this.controls = null;
        this.activeDanmakus = [];
        this.pool = [];
        this.tracks = [];
        this.trackLastRight = [];
        this.stageWidth = 0;
        this.stageHeight = 0;
        this.trackCount = 0;

        this.isRunning = false;
        this.isPaused = false;
        this.rafId = null;
        this.lastTime = 0;

        this._pendingQueue = [];
        this._seenIds = new Set();
        this._onVisibilityChange = null;

        this._init();
    }

    _init() {
        this.stage = document.createElement('div');
        this.stage.className = 'danmaku-stage';
        this.container.style.position = 'relative';
        this.container.style.overflow = 'hidden';
        this.container.appendChild(this.stage);

        this._measure();
        this._initTracks();
        this._bindVisibility();
        this._startLoop();
    }

    _bindVisibility() {
        this._onVisibilityChange = () => {
            if (document.hidden) {
                this._pauseLoop();
            } else if (this.isRunning && !this.isPaused) {
                this._resumeLoop();
            }
        };
        document.addEventListener('visibilitychange', this._onVisibilityChange);
    }

    _measure() {
        const rect = this.container.getBoundingClientRect();
        this.stageWidth = Math.max(rect.width, 320);
        this.stageHeight = Math.max(rect.height, 200);
        this.stage.style.width = this.stageWidth + 'px';
        this.stage.style.height = this.stageHeight + 'px';
    }

    _initTracks() {
        this.trackCount = Math.max(2, Math.floor((this.stageHeight - SAFETY_MARGIN * 2) / ROW_HEIGHT));
        this.tracks = new Array(this.trackCount).fill(null);
        this.trackLastRight = new Array(this.trackCount).fill(-Infinity);
    }

    resize() {
        this._measure();
        const oldCount = this.trackCount;
        this._initTracks();
        if (oldCount !== this.trackCount) {
            this.activeDanmakus.forEach(d => {
                if (d.track >= this.trackCount) {
                    d.track = d.track % this.trackCount;
                }
            });
        }
    }

    addComment(comment, priority = false) {
        if (!comment || !comment.content) return;
        const id = String(comment.id ?? comment.tempId ?? Math.random());
        if (this._seenIds.has(id)) return;
        this._seenIds.add(id);

        const item = {
            id,
            text: comment.content,
            author: comment.author_name || '匿名',
            color: COLORS[Math.floor(Math.random() * COLORS.length)],
            speed: SPEED_BASE + Math.random() * SPEED_VARIANCE,
            track: -1,
            x: 0,
            width: 0,
            el: null,
            priority
        };
        this._pendingQueue.push(item);
        this._flushPending();
    }

    _flushPending() {
        while (this._pendingQueue.length > 0) {
            const item = this._pendingQueue.shift();
            this._launch(item);
        }
    }

    _launch(item) {
        const el = this._acquireEl();
        item.el = el;

        const authorPart = item.author ? `${escapeHtml(item.author)}：` : '';
        const fullText = authorPart + escapeHtml(item.text);
        el.innerHTML = fullText;
        el.style.color = item.color;
        el.style.fontSize = this.options.fontSize + 'px';
        el.style.opacity = this.options.opacity;

        this.stage.appendChild(el);
        item.width = el.offsetWidth;

        const track = this._allocateTrack(item.width);
        item.track = track;
        item.x = this.stageWidth;
        el.style.transform = this._buildTransform(item.x, track);
        el.style.top = (SAFETY_MARGIN + track * ROW_HEIGHT) + 'px';
        el.classList.add('danmaku-item-enter');

        this.activeDanmakus.push(item);
        this._updateTrackRight(track, item.x + item.width + MIN_GAP);
    }

    _allocateTrack(danmakuWidth) {
        let bestIdx = -1;
        let bestRightMost = Infinity;

        for (let i = 0; i < this.trackCount; i++) {
            const right = this.trackLastRight[i] || 0;
            if (right <= 0) return i;
            if (right < bestRightMost) {
                bestRightMost = right;
                bestIdx = i;
            }
        }

        if (bestIdx !== -1 && this.trackLastRight[bestIdx] + danmakuWidth + MIN_GAP < this.stageWidth) {
            return bestIdx;
        }

        if (bestIdx !== -1) return bestIdx;

        return Math.floor(Math.random() * this.trackCount);
    }

    _updateTrackRight(track, rightVal) {
        if (track >= 0 && track < this.trackCount) {
            if (rightVal > (this.trackLastRight[track] || 0)) {
                this.trackLastRight[track] = rightVal;
            }
        }
    }

    _buildTransform(x, track) {
        const y = SAFETY_MARGIN + track * ROW_HEIGHT;
        return `translate3d(${x}px, 0, 0)`;
    }

    _acquireEl() {
        if (this.pool.length > 0) {
            return this.pool.pop();
        }
        const el = document.createElement('div');
        el.className = 'danmaku-item';
        el.style.willChange = 'transform';
        el.addEventListener('animationend', () => {
            el.classList.remove('danmaku-item-enter');
        });
        return el;
    }

    _releaseEl(el) {
        if (!el) return;
        el.classList.remove('danmaku-item-enter');
        el.removeAttribute('style');
        if (el.parentNode) {
            el.parentNode.removeChild(el);
        }
        if (this.pool.length < MAX_POOL_SIZE) {
            this.pool.push(el);
        }
    }

    _startLoop() {
        if (this.isRunning) return;
        this.isRunning = true;
        this.isPaused = false;
        this.lastTime = performance.now();
        this._tick();
    }

    _pauseLoop() {
        if (this.rafId) {
            cancelAnimationFrame(this.rafId);
            this.rafId = null;
        }
    }

    _resumeLoop() {
        if (this.isRunning && !this.rafId) {
            this.lastTime = performance.now();
            this._tick();
        }
    }

    _tick = () => {
        const now = performance.now();
        const dt = Math.min(100, (now - this.lastTime) / 1000);
        this.lastTime = now;

        if (!this.isPaused) {
            this._update(dt);
        }

        this.rafId = requestAnimationFrame(this._tick);
    };

    _update(dt) {
        const scale = this.options.speedScale;
        const alive = [];
        const trackMax = new Array(this.trackCount).fill(-Infinity);

        for (const d of this.activeDanmakus) {
            d.x -= d.speed * scale * dt;
            if (d.el) {
                d.el.style.transform = this._buildTransform(d.x, d.track);
            }
            const rightEdge = d.x + d.width;
            if (rightEdge > 0) {
                alive.push(d);
                if (rightEdge > trackMax[d.track]) {
                    trackMax[d.track] = rightEdge;
                }
            } else {
                this._releaseEl(d.el);
            }
        }

        for (let i = 0; i < this.trackCount; i++) {
            this.trackLastRight[i] = trackMax[i] === -Infinity ? 0 : trackMax[i];
        }

        this.activeDanmakus = alive;
    }

    pause() {
        this.isPaused = true;
    }

    resume() {
        this.isPaused = false;
        this.lastTime = performance.now();
    }

    togglePause() {
        if (this.isPaused) {
            this.resume();
        } else {
            this.pause();
        }
        return !this.isPaused;
    }

    setSpeedScale(scale) {
        this.options.speedScale = Math.max(0.2, Math.min(3, Number(scale) || 1));
    }

    setOpacity(opacity) {
        this.options.opacity = Math.max(0.1, Math.min(1, Number(opacity) || 0.9));
        this.activeDanmakus.forEach(d => {
            if (d.el) d.el.style.opacity = this.options.opacity;
        });
    }

    setFontSize(size) {
        this.options.fontSize = Math.max(12, Math.min(24, Number(size) || 16));
        this.activeDanmakus.forEach(d => {
            if (d.el) {
                d.el.style.fontSize = this.options.fontSize + 'px';
                d.width = d.el.offsetWidth;
            }
        });
    }

    destroy() {
        this.isRunning = false;
        this.isPaused = true;
        this._pauseLoop();

        if (this._onVisibilityChange) {
            document.removeEventListener('visibilitychange', this._onVisibilityChange);
            this._onVisibilityChange = null;
        }

        for (const d of this.activeDanmakus) {
            this._releaseEl(d.el);
        }
        this.activeDanmakus = [];

        for (const el of this.pool) {
            if (el.parentNode) el.parentNode.removeChild(el);
        }
        this.pool = [];

        if (this.stage && this.stage.parentNode) {
            this.stage.parentNode.removeChild(this.stage);
        }
        this.stage = null;

        this._pendingQueue = [];
        this._seenIds.clear();

        if (typeof this.options.onDestroy === 'function') {
            this.options.onDestroy();
        }
    }
}

export { escapeHtml as danmakuEscapeHtml };
