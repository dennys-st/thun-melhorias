import './style.css'

const words = [
    "ele", "ela", "minha",
    "bom dia", "boa noite", "oi", 
    "beijo", "não", "Deus", 
    "que hora", 
    "casa", 
    "seguir", "seguir de volta", "curtir", "bloquear", "apagar",
    "gasolina", "carro", "moto", "limão",
    "mangabeira", "você", "tu", "que dia", "sim", "amanhã", "vamos", "eu", 
    "cruz das almas", "excluir", "bom", "hoje", "boa tarde", "status", "aceitar", 
    "ontem", "cabaceiras", "boa", "meu", "lá", "obrigado", "estou em casa", 
    "vou sair", "story", "trabalhar", "vou", "tudo bem ?", "to bem e você?", "nome"
];

function getDailyShuffledWords() {
    const data = new Date();
    if (data.getHours() < 2) data.setDate(data.getDate() - 1);
    let seed = data.getFullYear() + (data.getMonth() + 1) + data.getDate();
    let shuffled = [...words];
    for (let i = shuffled.length - 1; i > 0; i--) {
        seed = (seed * 9301 + 49297) % 233280;
        let j = Math.floor((seed / 233280) * (i + 1));
        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
}

const readingWords = getDailyShuffledWords();
const typingWords = [...words].sort(() => Math.random() - 0.5);

// -- State --
function getInitialScore() {
    const today = new Date().toDateString();
    const lastDate = localStorage.getItem('thun_last_date');
    if (lastDate !== today) {
        localStorage.setItem('thun_last_date', today);
        localStorage.setItem('thun_score', '0');
        localStorage.setItem('thun_daily_record', '0'); // RESET DIÁRIO DO RECORDE
        return 0;
    }
    // FORÇAR ZERO AGORA (A PEDIDO DO USUÁRIO)
    localStorage.setItem('thun_score', '0');
    localStorage.setItem('thun_daily_record', '0');
    return 0;
}

let state = {
    view: 'home',
    readingPage: 1,
    typingIndex: 0,
    typingWords: typingWords,
    timers: [],
    score: getInitialScore(),
    dailyRecord: parseInt(localStorage.getItem('thun_daily_record') || '0'),
    combo: 0,
    correctCount: 0,
    inactivityTimer: null,
    selectedVoiceIndex: localStorage.getItem('thun_voice_index'),
    vibrationEnabled: localStorage.getItem('thun_vibrate') !== 'false',
    matchPairs: [],
    selectedMatch: null,
    matchedIds: [],
    errorMatch: null
};

// -- Utilities --
let preferredVoice = null;

function loadVoices() {
    const voices = window.speechSynthesis.getVoices().filter(v => v.lang.includes('pt'));
    
    if (state.selectedVoiceIndex !== null && voices[state.selectedVoiceIndex]) {
        preferredVoice = voices[state.selectedVoiceIndex];
    } else {
        // Fallback para voz feminina do Google
        preferredVoice = voices.find(v => v.name.includes('Google')) || voices[0];
    }
}

// Garante que as vozes sejam carregadas
window.speechSynthesis.onvoiceschanged = loadVoices;
loadVoices();

function playSound(type) {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    
    osc.connect(gain);
    gain.connect(ctx.destination);
    
    if (type === 'success') {
        osc.frequency.setValueAtTime(600, ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(1200, ctx.currentTime + 0.1);
        gain.gain.setValueAtTime(0.1, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.3);
        
        // Segundo pulso para som de "moeda"
        setTimeout(() => {
            const osc2 = ctx.createOscillator();
            const gain2 = ctx.createGain();
            osc2.connect(gain2);
            gain2.connect(ctx.destination);
            osc2.frequency.setValueAtTime(800, ctx.currentTime);
            osc2.frequency.exponentialRampToValueAtTime(1600, ctx.currentTime + 0.1);
            gain2.gain.setValueAtTime(0.1, ctx.currentTime);
            gain2.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.3);
            osc2.start();
            osc2.stop(ctx.currentTime + 0.3);
        }, 100);
    } else {
        osc.frequency.setValueAtTime(150, ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(50, ctx.currentTime + 0.1);
        gain.gain.setValueAtTime(0.1, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.2);
        
        // Vibração tripla padrão de erro - Simplificada para maior compatibilidade
        if (state.vibrationEnabled && navigator.vibrate) {
            navigator.vibrate(200); 
            try { navigator.vibrate([100, 50, 100]); } catch(e) {}
        }
    }
    
    osc.start();
    osc.stop(ctx.currentTime + 0.2);
}

function speak(text, rate = 0.6) {
    window.speechSynthesis.cancel();
    const msg = new SpeechSynthesisUtterance(text);
    msg.lang = 'pt-BR';
    msg.rate = rate;
    msg.pitch = 1.1; // Sutilmente mais agudo para soar mais feminino/suave
    if (preferredVoice) msg.voice = preferredVoice;
    window.speechSynthesis.speak(msg);
    return msg;
}

function normalizeText(text) {
    return text.toLowerCase()
        .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
        .replace(/[?]/g, "");
}

// -- Components --

window.handleBack = () => {
    if (state.view === 'home') {
        if (confirm("Deseja sair do Thun?")) {
            window.close();
            window.location.href = "about:blank";
        }
    } else {
        window.setView('home');
    }
};

function renderHeader() {
    let title = "";
    if (state.view === 'reading') title = "Ler";
    if (state.view === 'typing') title = "Digitar";
    if (state.view === 'matching') title = "Ligar";
    
    const isHintVisible = !!document.getElementById('keyboard-hint-container')?.innerHTML;

    const scoreHtml = state.view !== 'home' ? `
        <div class="score-pill" style="${(state.view === 'typing' && isHintVisible) ? 'display:none' : ''}">
            <span>⭐</span>
            <span>${state.score}</span>
        </div>
    ` : '';

    const voiceBtn = state.view !== 'typing' ? `
        <div class="nav-item" onclick="window.setView('settings')" style="flex-direction: row; gap: 8px; font-size: 1.2rem; color: #fbbf24;">
            <span>🔊</span>
        </div>
    ` : '';

    return `
        <header style="${state.view === 'typing' ? 'padding: 10px; min-height: 40px;' : ''}">
            <div class="stats-header" style="display: grid; grid-template-columns: 1fr auto 1fr; align-items: center; width: 100%;">
                <div onclick="window.handleBack()" style="cursor: pointer; font-size: 1.5rem; display: flex; align-items: center;">
                    ⬅️
                </div>
                
                <div style="display:flex; align-items:center; gap: 10px; justify-content: center;">
                    <h1 style="${state.view === 'typing' || !title ? 'display:none' : ''}; margin: 0;">${title || 'Thun'}</h1>
                    ${voiceBtn}
                </div>
                
                <div style="display: flex; justify-content: flex-end;">
                    ${scoreHtml}
                </div>
            </div>
        </header>
    `;
}

function renderBottomNav() {
    return `
        <nav class="bottom-nav">
            <div class="nav-item ${state.view === 'home' ? 'active' : ''}" onclick="window.setView('home')">
                <span class="nav-icon">🏠</span>
                <span>Home</span>
            </div>
            <div class="nav-item ${state.view === 'reading' ? 'active' : ''}" onclick="window.setView('reading')">
                <span class="nav-icon">📖</span>
                <span>Ler</span>
            </div>
            <div class="nav-item ${state.view === 'typing' ? 'active' : ''}" onclick="window.setView('typing')">
                <span class="nav-icon">⌨️</span>
                <span>Digitar</span>
            </div>
            <div class="nav-item ${state.view === 'matching' ? 'active' : ''}" onclick="window.setView('matching')">
                <span class="nav-icon">🔗</span>
                <span>Ligar</span>
            </div>
        </nav>
    `;
}

function HomeView() {
    return `
        <div class="home-container animate-fade" style="justify-content: center; height: 100%; display: flex; flex-direction: column; padding-top: 20px;">
            <div style="text-align: center; margin-bottom: 20px;">
                <p style="font-size: 0.8rem; color: var(--text-muted); text-transform: uppercase; letter-spacing: 1px;">Recorde de Hoje</p>
                <h2 style="font-size: 2.5rem; color: #fbbf24;">⭐ ${state.dailyRecord}</h2>
            </div>

            <div class="menu-card ler" onclick="window.setView('reading')">
                <div class="icon-box">📖</div>
                <div>
                    <h3>Ler</h3>
                </div>
            </div>

            <div class="menu-card ligar" onclick="window.setView('matching')" style="margin-top: 15px; border-color: var(--secondary);">
                <div class="icon-box" style="background: rgba(236, 72, 153, 0.1); color: var(--secondary);">🔗</div>
                <div>
                    <h3>Ligar</h3>
                </div>
            </div>

            <div class="menu-card digitar" onclick="window.setView('typing')" style="margin-top: 15px;">
                <div class="icon-box">⌨️</div>
                <div>
                    <h3>Digitar</h3>
                </div>
            </div>
        </div>
    `;
}

function ReadingView() {
    const itemsPerPage = 12;
    const startIndex = (state.readingPage - 1) * itemsPerPage;
    const pageWords = readingWords.slice(startIndex, startIndex + itemsPerPage);
    
    let gridHtml = pageWords.map((word, i) => {
        const parts = word.split(' ');
        const wordSpans = parts.map((p, idx) => `<span class="word-span" id="span-${i}-${idx}">${p}${idx < parts.length - 1 ? '&nbsp;' : ''}</span>`).join('');
        return `
            <div class="word-card" id="word-${i}" onclick="window.handleReadingClick('${word}', ${i}, ${parts.length})">
                ${wordSpans}
            </div>
        `;
    }).join('');

    let paginationHtml = [1, 2, 3, 4].map(p => `
        <div class="nav-circle" 
             style="${state.readingPage === p ? 'background: var(--primary); border-color: var(--primary);' : ''}"
             onclick="window.setReadingPage(${p})">${p}</div>
    `).join('');

    return `
        <div class="animate-fade">
            <div class="reading-grid">
                ${gridHtml}
            </div>
            <div class="typing-nav" style="margin-top: 30px; justify-content: center; gap: 15px;">
                ${paginationHtml}
            </div>
        </div>
    `;
}

function TypingView() {
    const currentWord = state.typingWords[state.typingIndex];
    const progress = ((state.typingIndex) / state.typingWords.length) * 100;
    
    return `
        <div class="typing-container animate-fade">


            <div id="keyboard-hint-container" style="display: flex; flex-direction: column; align-items: center; justify-content: flex-end; width: 100%; margin-bottom: 5px; min-height: 0;"></div>

            <div style="position: relative; width: 100%;">
                <div class="combo-badge ${state.combo > 1 ? 'combo-active' : ''}" style="top: -10px;">
                    ${state.combo}x COMBO!
                </div>
                <div class="target-word-display" id="target-word" style="margin-bottom: 10px;">${currentWord}</div>
            </div>
            
            <input type="text" id="typing-input" class="typing-input" placeholder="..." 
                   autocomplete="new-password" autocapitalize="none" spellcheck="false"
                   autocorrect="off" inputmode="text" data-lpignore="true" data-form-type="other" name="dummy-field-${Math.random()}"
                   onfocus="document.getElementById('keyboard-hint-container').innerHTML=''">
            
            <div id="typing-feedback" class="feedback-msg" style="margin-top: 5px; height: 20px;"></div>

            <button class="btn-action" onclick="window.checkTyping()" style="padding: 15px;">OK ✅</button>

            <div class="typing-nav" style="margin-top: 10px;">
                <div class="nav-circle" style="width: 50px; height: 50px; font-size: 1.2rem;" onclick="window.prevTyping()">⬅</div>
                <div class="counter" style="color: var(--text-muted); font-weight: 600;">
                    ${state.typingIndex + 1} / ${state.typingWords.length}
                </div>
                <div class="nav-circle" style="width: 50px; height: 50px; font-size: 1.2rem;" onclick="window.nextTyping()">➡</div>
            </div>
        </div>
    `;
}

function MatchingView() {
    if (state.matchPairs.length === 0) {
        // TRAVA DE ÍCONES: Mapeamento fixo definido pelo usuário.
        const wordEmojis = {
            "ele": "👨", "ela": "👩", "minha": "🖐️",
            "bom dia": "☀️", "boa noite": "🌙", "oi": "👋", 
            "beijo": "💋", "não": "❌", "Deus": "✝️", 
            "que hora": "⌚", 
            "casa": "🏠", 
            "seguir": "https://i.postimg.cc/Qx9H3CDQ/Seguir.jpg", 
            "seguir de volta": "https://i.postimg.cc/gkXnWjp3/Seguir-de-volta.jpg",
            "curtir": "❤️", "bloquear": "🚫", "apagar": "🗑️",
            "gasolina": "⛽", "carro": "🚗", "moto": "🏍️", "limão": "🍋"
        };
        const allWords = Object.keys(wordEmojis);
        const selected = allWords.sort(() => Math.random() - 0.5).slice(0, 2);
        
        state.matchPairs = selected.map((w, index) => ({
            id: index,
            word: w,
            emoji: wordEmojis[w]
        }));
        
        state.matchWords = [...state.matchPairs].sort(() => Math.random() - 0.5);
        state.matchImages = [...state.matchPairs].sort(() => Math.random() - 0.5);
        state.matchedIds = [];
    }

    const isError = (id) => state.errorMatch && (state.errorMatch.id1 === id || state.errorMatch.id2 === id);

    const wordsHtml = state.matchWords.map(p => `
        <div class="match-card ${state.matchedIds.includes(p.id) ? 'matched' : ''} ${state.selectedMatch?.type === 'word' && state.selectedMatch.id === p.id ? 'selected' : ''} ${isError(p.id) ? 'error animate-shake' : ''}" 
             onclick="window.handleMatch('word', ${p.id})">
            ${p.word}
        </div>
    `).join('');

    const imgsHtml = state.matchImages.map(p => {
        const isUrl = p.emoji.startsWith('http');
        const content = isUrl 
            ? `<img src="${p.emoji}" style="width: 100%; height: 100%; object-fit: cover; border-radius: 10px;">`
            : p.emoji;
            
        return `
            <div class="match-card img-card ${state.matchedIds.includes(p.id) ? 'matched' : ''} ${state.selectedMatch?.type === 'img' && state.selectedMatch.id === p.id ? 'selected' : ''} ${isError(p.id) ? 'error animate-shake' : ''}" 
                 style="background: var(--glass); font-size: 4.5rem; display: flex; align-items: center; justify-content: center; padding: 0; overflow: hidden;"
                 onclick="window.handleMatch('img', ${p.id})">
                ${content}
            </div>
        `;
    }).join('');

    return `
        <div class="matching-container animate-fade" style="position: relative;">
            <svg id="match-svg" style="position: absolute; top: 0; left: 0; width: 100%; height: 100%; pointer-events: none; z-index: 5;"></svg>
            <h2 style="text-align: center; margin-bottom: 20px; font-size: 1.2rem; color: var(--text-muted);">Ligue a palavra à imagem</h2>
            <div style="display: flex; gap: 40px; justify-content: center; width: 100%; padding: 0 20px; position: relative; z-index: 10;">
                <div style="display: flex; flex-direction: column; gap: 15px; flex: 1;" id="words-col">${wordsHtml}</div>
                <div style="display: flex; flex-direction: column; gap: 15px; flex: 1;" id="imgs-col">${imgsHtml}</div>
            </div>
            ${state.matchedIds.length === 2 ? `
                <button class="btn-action" style="margin-top: 30px; position: relative; z-index: 20;" onclick="window.nextMatch()">Próxima Fase ➡</button>
            ` : ''}
        </div>
    `;
}

window.drawMatchLines = () => {
    const svg = document.getElementById('match-svg');
    if (!svg) return;
    svg.innerHTML = '';
    
    const containerRect = svg.getBoundingClientRect();

    state.matchedIds.forEach(id => {
        const wordEl = document.querySelector(`.match-card[onclick*="word"][onclick*="${id}"]`);
        const imgEl = document.querySelector(`.match-card[onclick*="img"][onclick*="${id}"]`);
        
        if (wordEl && imgEl) {
            const wRect = wordEl.getBoundingClientRect();
            const iRect = imgEl.getBoundingClientRect();
            
            const x1 = (wRect.left + wRect.width) - containerRect.left;
            const y1 = (wRect.top + wRect.height/2) - containerRect.top;
            const x2 = iRect.left - containerRect.left;
            const y2 = (iRect.top + iRect.height/2) - containerRect.top;
            
            const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
            line.setAttribute('x1', x1);
            line.setAttribute('y1', y1);
            line.setAttribute('x2', x2);
            line.setAttribute('y2', y2);
            line.setAttribute('stroke', '#10b981');
            line.setAttribute('stroke-width', '4');
            line.setAttribute('stroke-linecap', 'round');
            line.setAttribute('class', 'match-line-anim');
            svg.appendChild(line);
        }
    });
};

window.handleMatch = (type, id) => {
    if (state.matchedIds.includes(id)) return;
    
    // Som ao clicar
    const pair = state.matchPairs.find(p => p.id === id);
    if (pair && type === 'word') speak(pair.word);

    if (!state.selectedMatch) {
        state.selectedMatch = { type, id };
    } else {
        if (state.selectedMatch.type !== type && state.selectedMatch.id === id) {
            // ACERTO
            state.matchedIds.push(id);
            state.selectedMatch = null;
            state.score += 5;
            localStorage.setItem('thun_score', state.score);
            playSound('success');
            if (state.vibrationEnabled && navigator.vibrate) navigator.vibrate(200);
            
            if (state.matchedIds.length === 2 && window.confetti) {
                window.confetti({ particleCount: 50, spread: 40, origin: { y: 0.7 } });
            }
        } else {
            // ERRO ou troca de lado
            if (state.selectedMatch.type === type) {
                state.selectedMatch = { type, id };
            } else {
                playSound('error');
                if (state.vibrationEnabled && navigator.vibrate) navigator.vibrate([100, 50, 100]);
                
                state.errorMatch = { id1: state.selectedMatch.id, id2: id };
                state.selectedMatch = null;
                
                // Remove o estado de erro após meio segundo
                setTimeout(() => {
                    state.errorMatch = null;
                    render();
                }, 500);
            }
        }
    }
    render();
};

window.nextMatch = () => {
    state.matchPairs = [];
    render();
};

// -- Controller --

window.setView = (view) => {
    state.view = view;
    clearTimeout(state.inactivityTimer);
    render();
    if (view === 'typing') {
        setTimeout(() => {
            const input = document.getElementById('typing-input');
            input?.focus();
            window.resetInactivityTimer();
        }, 100);
    }
};

window.resetInactivityTimer = () => {
    clearTimeout(state.inactivityTimer);
    if (state.view !== 'typing') return;
    
    const container = document.getElementById('keyboard-hint-container');
    if (container) {
        container.innerHTML = '';
        renderHeaderInPlace();
    }

    state.inactivityTimer = setTimeout(() => {
        window.renderHintKeyboard();
    }, 4000);
};

window.renderHintKeyboard = () => {
    const target = state.typingWords[state.typingIndex];
    const input = document.getElementById('typing-input');
    if (!input) return;
    
    const typed = normalizeText(input.value);
    const targetNorm = normalizeText(target);
    const nextChar = targetNorm[typed.length];
    
    if (!nextChar) return;

    const rows = [
        ['q','w','e','r','t','y','u','i','o','p'],
        ['a','s','d','f','g','h','j','k','l'],
        ['z','x','c','v','b','n','m',' ']
    ];

    const keyboardHtml = `
        <div class="virtual-keyboard">
            <p style="font-size: 0.8rem; color: var(--text-muted); margin-bottom: 8px; text-align: center;">Procure esta tecla:</p>
            ${rows.map((row, i) => `
                <div class="kbd-row">
                    ${row.map(key => `
                        <div class="kbd-key ${key === nextChar ? 'highlight' : ''}" style="${key === ' ' ? 'width: 60%; max-width: 250px;' : ''}">
                            ${key === ' ' ? '' : key.toLowerCase()}
                        </div>
                    `).join('')}
                </div>
            `).join('')}
        </div>
    `;
    
    const container = document.getElementById('keyboard-hint-container');
    if (container) {
        container.innerHTML = keyboardHtml;
        renderHeaderInPlace(); // Re-render header to hide/show score
    }
};

window.setReadingPage = (page) => {
    state.readingPage = page;
    render();
};

window.handleReadingClick = (word, wordIdx, partsCount) => {
    state.timers.forEach(t => clearTimeout(t));
    state.timers = [];
    
    // Clear all highlights
    document.querySelectorAll('.word-span').forEach(s => s.classList.remove('word-highlight'));
    document.querySelectorAll('.word-card').forEach(c => c.classList.remove('active-reading'));
    
    const card = document.getElementById(`word-${wordIdx}`);
    if (card) card.classList.add('active-reading');
    
    const ehFrase = partsCount > 1;
    speak(word, ehFrase ? 0.45 : 0.65);
    
    const delay = ehFrase ? 750 : 500;
    for (let i = 0; i < partsCount; i++) {
        let t = setTimeout(() => {
            document.querySelectorAll('.word-span').forEach(s => s.classList.remove('word-highlight'));
            const span = document.getElementById(`span-${wordIdx}-${i}`);
            if (span) span.classList.add('word-highlight');
        }, i * delay);
        state.timers.push(t);
    }
    
    // Final clear
    let finalT = setTimeout(() => {
        document.querySelectorAll('.word-span').forEach(s => s.classList.remove('word-highlight'));
        if (card) card.classList.remove('active-reading');
    }, partsCount * delay + 500);
    state.timers.push(finalT);
};

window.checkTyping = () => {
    const input = document.getElementById('typing-input');
    const feedback = document.getElementById('typing-feedback');
    const target = state.typingWords[state.typingIndex];
    const card = document.querySelector('.typing-container');
    
    const targetClean = normalizeText(target);
    const typedClean = normalizeText(input.value);

    if (typedClean === targetClean) {
        state.combo++;
        state.correctCount++;
        const points = 5;
        state.score += points;
        localStorage.setItem('thun_score', state.score);
        input.value = ""; // Limpa para a próxima
        
        if (state.score > state.dailyRecord) {
            state.dailyRecord = state.score;
            localStorage.setItem('thun_daily_record', state.dailyRecord);
        }
        
        feedback.innerHTML = `<span class="success-text">+${points} estrelas! 🌟</span>`;
        card.classList.add('animate-success');
        
        playSound('success');
        if (state.vibrationEnabled && navigator.vibrate) navigator.vibrate(200);
        
        setTimeout(() => {
            speak(target);
        }, 800);
        
        if (window.confetti) {
            window.confetti({
                particleCount: 100,
                spread: 70,
                origin: { y: 0.6 },
                colors: ['#fbbf24', '#3b82f6', '#10b981']
            });
        }
        
        renderHeaderInPlace();
        
        setTimeout(() => {
            card.classList.remove('animate-success');
            window.nextTyping();
        }, 1600);

    } else {
        state.combo = 0;
        input.classList.add('animate-shake');
        document.body.classList.add('bg-error'); // Flash vermelho no fundo
        
        playSound('error');
        
        setTimeout(() => {
            input.classList.remove('animate-shake');
            document.body.classList.remove('bg-error');
        }, 800);
        
        // Dica visual rápida: mostra a palavra no placeholder por um momento
        input.placeholder = target;
        setTimeout(() => { input.placeholder = '...'; }, 2000);

        render(); // To update combo badge
        
        if (targetClean.includes(' ')) {
            let targetWords = targetClean.split(' ');
            let typedWords = typedClean.split(' ');
            let resultHtml = '<span>';
            let correctWordsToSpeak = [];
            
            for (let i = 0; i < targetWords.length; i++) {
                if (typedWords[i] === targetWords[i]) {
                    resultHtml += '<span class="success-text">' + targetWords[i] + ' </span>';
                    correctWordsToSpeak.push(targetWords[i]);
                } else {
                    resultHtml += '<span class="error-char">' + (typedWords[i] || '_') + ' </span>';
                }
            }
            resultHtml += '</span>';
            feedback.innerHTML = resultHtml;
            
            if (correctWordsToSpeak.length > 0) {
                speak(correctWordsToSpeak.join(' '));
            }
        } else {
            feedback.innerHTML = '<span class="error-char">Tente novamente</span>';
        }
    }
};

window.nextTyping = () => {
    if (state.typingIndex < state.typingWords.length - 1) {
        state.typingIndex++;
        render();
        setTimeout(() => document.getElementById('typing-input')?.focus(), 100);
    } else {
        state.view = 'summary';
        render();
        state.typingIndex = 0;
        state.typingWords = [...words].sort(() => Math.random() - 0.5);
    }
};

window.prevTyping = () => {
    if (state.typingIndex > 0) {
        state.typingIndex--;
        render();
    }
};

function SummaryView() {
    return `
        <div class="summary-card animate-fade">
            <h2>Sessão Concluída!</h2>
            <div class="star-rating">⭐⭐⭐</div>
            <p style="margin-bottom: 20px;">Você mandou muito bem!</p>
            <div class="menu-card ler" onclick="window.setView('home')" style="justify-content: center;">
                <h3>Voltar ao Início</h3>
            </div>
        </div>
    `;
}

function renderHeaderInPlace() {
    const header = document.querySelector('header');
    if (header) {
        header.innerHTML = renderHeader().replace('<header>', '').replace('</header>', '');
    }
}

function VoiceSettingsView() {
    const voices = window.speechSynthesis.getVoices().filter(v => v.lang.includes('pt'));
    
    return `
        <div class="summary-card animate-fade" style="text-align: left;">
            <h2 style="margin-bottom: 20px;">Escolha a Voz</h2>
            <div style="display: flex; flex-direction: column; gap: 10px; max-height: 400px; overflow-y: auto; padding-right: 10px;">
                ${voices.map((v, i) => `
                    <div class="menu-card" 
                         style="padding: 15px; background: ${state.selectedVoiceIndex == i ? 'var(--primary)' : 'var(--glass)'}; border-color: ${state.selectedVoiceIndex == i ? 'white' : 'var(--glass-border)'}"
                         onclick="window.setVoice(${i})">
                        <div style="font-size: 1rem;">${v.name}</div>
                    </div>
                `).join('')}
            </div>

            <div class="menu-card" style="margin-top: 20px; background: ${state.vibrationEnabled ? 'rgba(16, 185, 129, 0.2)' : 'rgba(239, 68, 68, 0.2)'}" onclick="window.toggleVibrate()">
                <div style="font-size: 1.2rem;">${state.vibrationEnabled ? '📳 Vibração Ligada' : '📴 Vibração Desligada'}</div>
            </div>

            <button class="btn-action" style="margin-top: 20px;" onclick="window.setView('home')">Pronto</button>
        </div>
    `;
}

window.toggleVibrate = () => {
    state.vibrationEnabled = !state.vibrationEnabled;
    localStorage.setItem('thun_vibrate', state.vibrationEnabled);
    if (state.vibrationEnabled && navigator.vibrate) navigator.vibrate(100);
    render();
};

window.setVoice = (index) => {
    state.selectedVoiceIndex = index;
    localStorage.setItem('thun_voice_index', index);
    const voices = window.speechSynthesis.getVoices().filter(v => v.lang.includes('pt'));
    preferredVoice = voices[index];
    speak("Essa é a voz selecionada");
    render();
};

function render() {
    const app = document.getElementById('app');
    let content = '';
    
    if (state.view === 'summary') {
        content = SummaryView();
    } else if (state.view === 'settings') {
        content = VoiceSettingsView();
    } else {
        switch(state.view) {
            case 'home': content = HomeView(); break;
            case 'reading': content = ReadingView(); break;
            case 'typing': content = TypingView(); break;
            case 'matching': content = MatchingView(); break;
        }
    }

    app.innerHTML = `
        ${renderHeader()}
        <main>
            ${content}
            <div style="height: 20px;"></div>
        </main>
        ${renderBottomNav()}
    `;

    // Linhas do modo Ligar
    if (state.view === 'matching') {
        setTimeout(window.drawMatchLines, 50);
    }

    // Re-attach listeners for enter key in typing
    if (state.view === 'typing') {
        const input = document.getElementById('typing-input');
        input?.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') window.checkTyping();
        });
        input?.addEventListener('input', () => {
            // Garante que o texto seja sempre minúsculo
            input.value = input.value.toLowerCase();
            
            const target = state.typingWords[state.typingIndex];
            const targetClean = normalizeText(target);
            const typedClean = normalizeText(input.value);
            
            // Verifica se o que foi digitado até agora está correto
            if (typedClean && !targetClean.startsWith(typedClean)) {
                // ERRO - Sempre vibra ao digitar uma letra errada nova
                document.body.classList.add('bg-error');
                if (state.vibrationEnabled && navigator.vibrate) navigator.vibrate(100); 
                
                // Só toca o som de erro se for a primeira vez para não ficar irritante
                if (!state.lastCharWasError) {
                    playSound('error');
                    state.lastCharWasError = true;
                }
            } else {
                // CORRETO
                document.body.classList.remove('bg-error');
                state.lastCharWasError = false;
            }
            
            window.resetInactivityTimer();
        });
        window.resetInactivityTimer();
    }
}

// Desbloqueia vibração e áudio no primeiro toque
window.addEventListener('touchstart', () => {
    if (navigator.vibrate) navigator.vibrate(10);
}, { once: true });

// Initial render
render();
