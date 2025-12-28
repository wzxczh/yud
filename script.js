const app = {
    // --- 1. 核心配置 ---
    targetDate: new Date('2026-01-01T00:00:00+08:00').getTime(),
    state: 'INTRO', // 状态机: INTRO -> LOCKED -> IDENTITY -> MAIN -> DRAW -> GAME
    isDay: false,
    dpr: window.devicePixelRatio || 1,
    brushColor: '#ffd700',
    identity: null,
    particles: [],
    gameItems: [],
    score: 0,
    gameTimer: null,
    pendingBlessing: false,

    // --- 2. 初始化 ---
    init() {
        this.canvas = document.getElementById('world');
        this.ctx = this.canvas.getContext('2d');
        this.resize();
        window.addEventListener('resize', () => this.resize());
        this.bindEvents();
        this.checkUrlParams();
        this.checkCapsule();
        this.loop();
        this.startCountdown();
    },

    resize() {
        this.width = window.innerWidth;
        this.height = window.innerHeight;
        this.canvas.width = this.width * this.dpr;
        this.canvas.height = this.height * this.dpr;
        this.canvas.style.width = this.width + 'px';
        this.canvas.style.height = this.height + 'px';
        this.ctx.scale(this.dpr, this.dpr);
    },

    // --- 3. 状态流转 ---
    
    // 入场解锁
    unlockSite() {
        if(navigator.vibrate) navigator.vibrate(50);
        
        const gate = document.getElementById('intro-gate');
        gate.style.transform = 'scale(1.5)';
        gate.style.opacity = '0';
        
        // 注意：这里删除了播放音乐的代码，改在按下瞬间播放
        
        setTimeout(() => {
            gate.style.display = 'none';
            this.state = 'LOCKED'; // 进入倒计时状态
            if(this.pendingBlessing) setTimeout(() => this.openModal('modal-receive'), 1000);
        }, 1000);
    },

    // 倒计时结束
    timeReached() {
        document.getElementById('page-lock').classList.remove('active');
        document.getElementById('page-identity').classList.add('active');
        this.state = 'IDENTITY';
    },

    // 身份选择
    setIdentity(type) {
        this.identity = type;
        const root = document.documentElement;
        if (type === 'star') {
            root.style.setProperty('--accent', '#00f2ff');
            this.brushColor = '#00f2ff';
        } else {
            root.style.setProperty('--accent', '#ff69b4');
            this.brushColor = '#ff69b4';
        }
        document.getElementById('page-identity').classList.remove('active');
        document.getElementById('bottom-controls').style.display = 'flex';
        this.state = 'MAIN';
    },

    // --- 4. 交互逻辑 (核心修复) ---
    bindEvents() {
        const unlockBtn = document.getElementById('unlock-btn');
        let pressTimer;
        let isUnlocked = false;

        const startPress = (e) => {
            if(e.cancelable && e.type !== 'mousedown') e.preventDefault();
            
            // 核心修复：按下瞬间播放本地音乐 a.mp3
            this.toggleMusic(true);

            unlockBtn.style.transform = 'scale(0.9)';
            pressTimer = setTimeout(() => {
                isUnlocked = true;
                this.unlockSite();
            }, 800);
        };

        const endPress = () => {
            clearTimeout(pressTimer);
            unlockBtn.style.transform = 'scale(1)';
            if (!isUnlocked) {
                const bgm = document.getElementById('bgm');
                bgm.pause();
                bgm.currentTime = 0;
            }
        };

        unlockBtn.addEventListener('mousedown', startPress);
        unlockBtn.addEventListener('touchstart', startPress, {passive: false});
        unlockBtn.addEventListener('mouseup', endPress);
        unlockBtn.addEventListener('touchend', endPress);
        unlockBtn.addEventListener('mouseleave', endPress); 

        // 画布交互
        let isDown = false;
        const getPos = (e) => {
            const t = e.touches ? e.touches[0] : e;
            return { x: t.clientX, y: t.clientY };
        };

        const onStart = (e) => {
            if(e.target.closest('button') || e.target.closest('.modal-content') || e.target.closest('.color-picker') || e.target.closest('.id-card')) return;
            const {x, y} = getPos(e);
            
            if(this.state === 'GAME') {
                this.checkGameHit(x, y);
            } else if(this.state === 'MAIN') {
                isDown = true;
                this.createParticles(x, y, 'burst'); // 主界面：允许烟花
            } else if(this.state === 'DRAW') {
                isDown = true;
                this.createParticles(x, y, 'trail'); // 画画模式：仅拖尾
            }
        };

        const onMove = (e) => {
            if(!isDown) return;
            if(e.cancelable) e.preventDefault();
            const {x, y} = getPos(e);
            if(this.state === 'MAIN' || this.state === 'DRAW') {
                this.createParticles(x, y, 'trail');
            }
        };

        const onEnd = () => isDown = false;

        window.addEventListener('mousedown', onStart);
        window.addEventListener('mousemove', onMove);
        window.addEventListener('mouseup', onEnd);
        window.addEventListener('touchstart', onStart, {passive:false});
        window.addEventListener('touchmove', onMove, {passive:false});
        window.addEventListener('touchend', onEnd);
    },

    // --- 5. 粒子系统 ---
    createParticles(x, y, type) {
        if (this.state === 'DRAW' && type === 'burst') type = 'trail';

        const count = type === 'burst' ? 15 : 2;
        let color;
        
        if (this.state === 'DRAW') {
            color = this.brushColor;
        } else {
            if (type === 'burst') {
                color = this.identity === 'flower' ? '#ff69b4' : '#00f2ff';
            } else {
                color = this.isDay ? '#333' : '#fff';
            }
        }
        
        for(let i=0; i<count; i++) {
            this.particles.push({
                x, y,
                vx: (Math.random()-0.5) * (type==='burst'?10:2),
                vy: (Math.random()-0.5) * (type==='burst'?10:2),
                life: 1,
                decay: Math.random()*0.02 + 0.01,
                color: color,
                size: Math.random()*3 + (type==='burst'?2:1)
            });
        }
    },

    // --- 6. 链接生成 (兼容修复) ---
    createShareLink() {
        const name = document.getElementById('share-name').value;
        const msg = document.getElementById('share-msg').value;
        if(!name || !msg) return alert('请先填写名字和祝福语哦！');
        
        let baseUrl = window.location.href.split('?')[0];
        const fullUrl = `${baseUrl}?from=${encodeURIComponent(name)}&msg=${encodeURIComponent(msg)}`;
        
        if (navigator.clipboard && window.isSecureContext) {
            navigator.clipboard.writeText(fullUrl).then(() => {
                alert('✅ 链接已复制！\n\n快去粘贴发送给朋友吧！');
            }).catch(() => {
                this.showManualCopy(fullUrl);
            });
        } else {
            this.showManualCopy(fullUrl);
        }
    },
    showManualCopy(url) {
        prompt("自动复制受限，请长按下方链接全选复制：", url);
    },

    // --- 7. 其他逻辑 ---
    checkUrlParams() {
        const params = new URLSearchParams(window.location.search);
        const from = params.get('from'); const msg = params.get('msg');
        if(from && msg) {
            this.pendingBlessing = true;
            document.getElementById('recv-name').innerText = decodeURIComponent(from);
            document.getElementById('recv-msg').innerText = decodeURIComponent(msg);
        }
    },
    openShare() { this.openModal('modal-share'); },

    enterDrawingMode() {
        this.state = 'DRAW';
        document.getElementById('bottom-controls').style.display = 'none';
        document.getElementById('page-draw').classList.add('active');
    },
    exitDrawingMode() {
        this.state = 'MAIN';
        document.getElementById('page-draw').classList.remove('active');
        document.getElementById('bottom-controls').style.display = 'flex';
    },
    setBrushColor(c) {
        this.brushColor = c;
        document.querySelectorAll('.color-dot').forEach(d => {
            const isActive = d.style.background.includes(c) || (c==='#ffffff' && d.style.background.includes('255'));
            d.classList.toggle('active', isActive);
        });
    },

    checkCapsule() {
        const saved = localStorage.getItem('2026_capsule');
        if(saved) {
            const data = JSON.parse(saved);
            document.getElementById('capsule-state-empty').style.display = 'none';
            document.getElementById('capsule-state-sealed').style.display = 'block';
            document.getElementById('capsule-date-display').innerText = '封存时间: ' + data.date;
            document.getElementById('capsule-content-display').innerText = data.text;
        }
    },
    sealCapsule() {
        const text = document.getElementById('capsule-input').value;
        if(!text) return;
        const data = { text: text, date: new Date().toLocaleString() };
        localStorage.setItem('2026_capsule', JSON.stringify(data));
        alert('胶囊已封存。');
        this.checkCapsule();
    },
    resetCapsule() {
        if(confirm('销毁旧胶囊？')) {
            localStorage.removeItem('2026_capsule');
            document.getElementById('capsule-state-sealed').style.display = 'none';
            document.getElementById('capsule-state-empty').style.display = 'block';
            document.getElementById('capsule-input').value = '';
        }
    },
    openCapsule() { this.openModal('modal-capsule'); },

    startGame() {
        if(this.state === 'GAME') return;
        this.state = 'GAME'; this.score = 0;
        document.getElementById('game-ui').style.display = 'block';
        document.getElementById('bottom-controls').style.display = 'none';
        let t = 15;
        this.gameTimer = setInterval(() => {
            t--; document.getElementById('game-time').innerText = t;
            if(t<=0) {
                clearInterval(this.gameTimer); alert(`时间到！获得 ${this.score} 欧气值`);
                this.state = 'MAIN';
                document.getElementById('game-ui').style.display = 'none';
                document.getElementById('bottom-controls').style.display = 'flex';
                this.gameItems = [];
            }
        }, 1000);
    },
    checkGameHit(x, y) {
        for(let i=this.gameItems.length-1; i>=0; i--) {
            const item = this.gameItems[i];
            const dist = Math.sqrt((x-item.x)**2 + (y-item.y)**2);
            if(dist < 50) {
                this.score += 10; document.getElementById('score-val').innerText = this.score;
                this.createParticles(item.x, item.y, 'burst'); this.gameItems.splice(i, 1);
            }
        }
    },

    loop() {
        this.ctx.fillStyle = this.isDay ? 'rgba(255,255,255,0.2)' : 'rgba(5,5,16,0.2)';
        this.ctx.fillRect(0,0,this.width, this.height);
        for(let i=this.particles.length-1; i>=0; i--) {
            const p = this.particles[i];
            p.x += p.vx; p.y += p.vy; p.life -= p.decay;
            this.ctx.globalAlpha = p.life; this.ctx.fillStyle = p.color;
            this.ctx.beginPath(); this.ctx.arc(p.x, p.y, p.size, 0, Math.PI*2); this.ctx.fill();
            if(p.life<=0) this.particles.splice(i,1);
        }
        if(this.state === 'GAME') {
            if(Math.random()<0.05) this.gameItems.push({ x: Math.random()*this.width, y: -50, content: ['🧧','✨','🍊'][Math.floor(Math.random()*3)], speed: Math.random()*3+2 });
            this.ctx.globalAlpha = 1; this.ctx.font = "30px Arial"; this.ctx.textAlign = "center";
            for(let i=this.gameItems.length-1; i>=0; i--) {
                const it = this.gameItems[i]; it.y += it.speed;
                this.ctx.fillText(it.content, it.x, it.y);
                if(it.y > this.height) this.gameItems.splice(i,1);
            }
        }
        requestAnimationFrame(() => this.loop());
    },

    startCountdown() {
        const update = () => {
            const now = new Date().getTime();
            const dist = this.targetDate - now;
            
            if(dist > 0) {
                const h = Math.floor(dist/3600000);
                const m = Math.floor((dist%3600000)/60000);
                const s = Math.floor((dist%60000)/1000);
                const days = Math.floor(dist/86400000);
                let timeStr = days > 0 ? `${days}d ${h%24}:${m<10?'0'+m:m}:${s<10?'0'+s:s}` : `${h%24}:${m<10?'0'+m:m}:${s<10?'0'+s:s}`;
                document.getElementById('timer').innerText = timeStr;
                requestAnimationFrame(update);
            } else {
                if (this.state === 'LOCKED') this.timeReached();
                else if (this.state === 'INTRO') requestAnimationFrame(update);
            }
        };
        update();
    },

    toggleMusic(force) { const a = document.getElementById('bgm'); if(force || a.paused) a.play().catch(()=>{}); else a.pause(); },
    toggleDayNight() {
        this.isDay = !this.isDay;
        document.documentElement.setAttribute('data-theme', this.isDay ? 'light' : 'dark');
        document.getElementById('theme-icon').innerText = this.isDay ? '☀️' : '🌙';
    },
    openMovie() { if(confirm('元旦放松一下，去放映室看看？')) window.open('https://wzxtv.leleosd.top/', '_blank'); },
    openModal(id) { document.getElementById(id).classList.add('show'); },
    closeModal(id) { document.getElementById(id).classList.remove('show'); },
    clearCanvas() { this.particles = []; this.ctx.clearRect(0,0,this.width, this.height); }
};

let debugCount = 0;
document.getElementById('timer').addEventListener('click', () => {
    debugCount++;
    if(debugCount === 5) {
        app.targetDate = new Date().getTime() - 1000;
        alert('⏱️ 开发者模式：时间封印解除！');
    }
});

app.init();