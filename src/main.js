import './style.css'

const words = [
    "bom", "dia", "boa", "tarde", "noite", "oi", "tudo bem ?", "to bem e você?", "nome", "obrigado", 
    "sim", "não", "carro", "sair", "trabalhar", "vou", "vamos", "story", "curtir", "seguir", 
    "bloquear", "apagar", "excluir", "aceitar", "hoje", "amanhã", "ontem", "casa", "eu", "você", 
    "tu", "ele", "ela", "preço", "video", "áudio", "agora", "seu", "sua", "chamada", 
    "lá", "ligação", "reais", "quero", "senha", "ta certo"
];

// Frases contextuais: SOMENTE palavras que já existem no vocabulário do app
// Cada palavra usada aqui está na lista acima
const contextPhrases = [
    // trabalhar + eu / vou / hoje / amanhã / não / vamos / sim
    "eu vou trabalhar",
    "eu vou trabalhar hoje",
    "eu vou trabalhar amanhã",
    "não vou trabalhar hoje",
    "não vou trabalhar amanhã",
    "vamos trabalhar amanhã",
    "vamos trabalhar hoje",
    "sim vou trabalhar",
    // vou + curtir / seguir / bloquear / apagar / excluir / aceitar
    "vou curtir story",
    "vou seguir você",
    "vou bloquear ele",
    "vou bloquear ela",
    "vou apagar story",
    "vou excluir story",
    "não vou aceitar",
    "sim vou aceitar",
    // chamadas e áudio (novas)
    "quero áudio agora",
    "sua chamada agora",
    "vou agora sair",
    "ele quer preço",
    "ela quer preço",
    "preço reais agora",
    "senha agora agora",
    // bom dia / boa tarde
    "bom dia",
    "boa tarde",
    "boa noite",
    "ta certo obrigado",
    "sim obrigado",
    "não obrigado",
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

// -- Typing2: Progressive builder --
function buildTyping2Sequences(wordList) {
    const seqs = [];
    for (const item of wordList) {
        const parts = item.trim().split(/\s+/).filter(p => p.length > 0);
        if (parts.length <= 1) {
            seqs.push([item]);
        } else {
            const steps = [];
            for (let i = 1; i <= parts.length; i++) {
                steps.push(parts.slice(0, i).join(' '));
            }
            seqs.push(steps);
        }
    }
    return seqs;
}

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
    errorMatch: null,
    typingWords: [...words].sort(() => Math.random() - 0.5),
    typingIndex: 0,
    // Digitar 2 focado nas frases contextuais com progressão
    typing2Sequences: buildTyping2Sequences([...contextPhrases].sort(() => Math.random() - 0.5)),
    typing2SeqIndex: 0,
    typing2StepIndex: 0,
    flashcardsPool: [...words].sort(() => Math.random() - 0.5),
    flashcardIndex: 0,
    flashcardFlipped: false,
    flashcardOptions: []
};

// -- Flashcards Logic --
function getFlashcardDistractor(correctWord) {
    const len = correctWord.length;
    // Tenta achar uma palavra com a mesma quantidade de letras, ou próxima
    const distractors = words.filter(w => w !== correctWord && Math.abs(w.length - len) <= 1);
    if (distractors.length === 0) return words.find(w => w !== correctWord);
    return distractors[Math.floor(Math.random() * distractors.length)];
}

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
    if (type === 'success') return; // Silenciado para não atrapalhar a compreensão
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

window.speak = (text, rate = 0.9) => {
    window.speechSynthesis.cancel();
    const msg = new SpeechSynthesisUtterance(text);
    msg.lang = 'pt-BR';
    msg.rate = rate;
    msg.pitch = 1.1; 
    if (preferredVoice) msg.voice = preferredVoice;
    window.speechSynthesis.speak(msg);
    return msg;
};

// Atalho para usar em templates HTML com segurança
const s = (txt) => txt.replace(/'/g, "\\'");

function normalizeText(text) {
    return text.toLowerCase()
        .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
        .replace(/[?]/g, "");
}

// -- Components --

window.handleBack = () => {
    if (state.view === "home") {
        if (confirm("Deseja sair do Thun?")) {
            window.close();
            window.location.href = "about:blank";
        }
    } else {
        window.setView("home");
    }
};

function renderHeader() {
    let title = "";
    if (state.view === 'reading') title = "Ler";
    if (state.view === 'typing') title = "Digitar 1";
    if (state.view === 'typing2') title = "Digitar 2";
    if (state.view === 'matching') title = "Ligar";
    if (state.view === 'flashcards') title = "Flashcards";
    
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
            <div class="nav-item ${state.view === 'home' ? 'active' : ''}" onclick="window.setView('home')" title="Início">
                <span class="nav-icon">🏠</span>
            </div>
            <div class="nav-item ${state.view === 'reading' ? 'active' : ''}" onclick="window.setView('reading')" title="Ler">
                <span class="nav-icon">📖</span>
            </div>
            <div class="nav-item ${state.view === 'typing' ? 'active' : ''}" onclick="window.setView('typing')" title="Digitar 1">
                <span class="nav-icon">⌨️</span>
            </div>
            <div class="nav-item ${state.view === 'typing2' ? 'active' : ''}" onclick="window.setView('typing2')" title="Digitar 2">
                <span class="nav-icon">🎧</span>
            </div>
            <div class="nav-item ${state.view === 'matching' ? 'active' : ''}" onclick="window.setView('matching')" title="Ligar">
                <span class="nav-icon">🔗</span>
            </div>
            <div class="nav-item ${state.view === 'flashcards' ? 'active' : ''}" onclick="window.setView('flashcards')" title="Cards">
                <span class="nav-icon">🎴</span>
            </div>
        </nav>
    `;
}

function HomeView() {
    return `
        <div class="home-container animate-fade" style="display: flex; flex-direction: column; padding-top: 20px; padding-bottom: 40px;">
            <div style="text-align: center; margin-bottom: 20px;">
                <p style="font-size: 0.75rem; color: var(--text-muted); text-transform: uppercase; letter-spacing: 1.5px;">🏆 Recorde</p>
                <h2 style="font-size: 2.8rem; color: #fbbf24;">⭐ ${state.dailyRecord}</h2>
            </div>

            <div class="menu-card ler" onclick="window.setView('reading')">
                <div class="icon-box" style="font-size:2.2rem;">📖</div>
                <div style="display:flex; flex-direction:column; gap:2px;">
                    <span style="font-size:0.7rem; color:var(--text-muted); letter-spacing:1px; text-transform:uppercase;">Modo</span>
                    <h3>📖 Ler</h3>
                </div>
            </div>

            <div class="menu-card ligar" onclick="window.setView('matching')" style="margin-top: 15px; border-color: var(--secondary);">
                <div class="icon-box" style="background: rgba(236, 72, 153, 0.1); color: var(--secondary); font-size:2.2rem;">🔗</div>
                <div style="display:flex; flex-direction:column; gap:2px;">
                    <span style="font-size:0.7rem; color:var(--text-muted); letter-spacing:1px; text-transform:uppercase;">Modo</span>
                    <h3>🔗 Ligar</h3>
                </div>
            </div>

            <div class="menu-card digitar" onclick="window.setView('typing')" style="margin-top: 15px;">
                <div class="icon-box" style="font-size:2.2rem;">⌨️</div>
                <div style="display:flex; flex-direction:column; gap:2px;">
                    <span style="font-size:0.7rem; color:var(--text-muted); letter-spacing:1px; text-transform:uppercase;">Modo</span>
                    <h3>⌨️ Digitar 1</h3>
                </div>
            </div>

            <div class="menu-card" onclick="window.setView('typing2')" style="margin-top: 15px; border-color: rgba(99,102,241,0.5);">
                <div class="icon-box" style="background: rgba(99,102,241,0.15); font-size:2.2rem;">🎧</div>
                <div style="display:flex; flex-direction:column; gap:2px;">
                    <span style="font-size:0.7rem; color:var(--text-muted); letter-spacing:1px; text-transform:uppercase;">Modo</span>
                    <h3>🎧 Digitar 2</h3>
                </div>
            </div>

            <div class="menu-card" onclick="window.setView('flashcards')" style="margin-top: 15px; border-color: #ec4899;">
                <div class="icon-box" style="background: rgba(236, 72, 153, 0.1); color: #ec4899; font-size:2.2rem;">🎴</div>
                <div style="display:flex; flex-direction:column; gap:2px;">
                    <span style="font-size:0.7rem; color:var(--text-muted); letter-spacing:1px; text-transform:uppercase;">Modo</span>
                    <h3>🎴 Flashcards</h3>
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
        <div class="nav-circle pagination-dot" 
             style="${state.readingPage === p ? 'background: var(--primary); border-color: var(--primary); width:18px; height:18px;' : 'width:12px; height:12px;'}"
             onclick="window.setReadingPage(${p})"></div>
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
                    ${'⭐'.repeat(Math.min(state.combo, 5))} ×${state.combo}
                </div>
                <div class="target-word-display" id="target-word" style="margin-bottom: 10px;">${currentWord}</div>
            </div>
            
            <input type="text" id="typing-input" class="typing-input" placeholder="..." 
                   autocomplete="new-password" autocapitalize="none" spellcheck="false"
                   autocorrect="off" inputmode="text" data-lpignore="true" data-form-type="other" name="dummy-field-${Math.random()}"
                   onfocus="document.getElementById('keyboard-hint-container').innerHTML=''">
            
            <div id="typing-feedback" class="feedback-msg" style="margin-top: 5px; height: 20px;"></div>

            <button class="btn-action btn-icon-only" onclick="window.checkTyping()" title="Verificar">✅</button>

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
            "casa": "/assets/casa.png", 
            "seguir": "https://i.postimg.cc/Qx9H3CDQ/Seguir.jpg", 
            "seguir de volta": "https://i.postimg.cc/gkXnWjp3/Seguir-de-volta.jpg",
            "curtir": "❤️", "bloquear": "🚫", "apagar": "🗑️",
            "gasolina": "⛽", "carro": "/assets/carro.png", "moto": "/assets/moto.png", "limão": "/assets/limao.png"
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
        <div class="match-card match-word-card ${state.matchedIds.includes(p.id) ? 'matched' : ''} ${state.selectedMatch?.type === 'word' && state.selectedMatch.id === p.id ? 'selected' : ''} ${isError(p.id) ? 'error animate-shake' : ''}" 
             onclick="window.handleMatch('word', ${p.id})">
            <span class="match-touch-hint">👆</span>
            <span>${p.word}</span>
        </div>
    `).join('');

    const imgsHtml = state.matchImages.map(p => {
        const isUrl = p.emoji.startsWith('http') || p.emoji.startsWith('/');
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
            <p class="match-subtitle">Toque na palavra e depois na imagem</p>
            <div class="match-columns" style="position: relative; z-index: 10;">
                <div class="match-col" id="words-col">${wordsHtml}</div>
                <div class="match-col" id="imgs-col">${imgsHtml}</div>
            </div>
            ${state.matchedIds.length === state.matchPairs.length ? `
                <button class="btn-action match-next-btn btn-icon-only" onclick="window.nextMatch()" title="Próxima fase">▶</button>
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

// -- Typing2 View --
function Typing2View() {
    const seq = state.typing2Sequences[state.typing2SeqIndex];
    const step = state.typing2StepIndex;
    const totalSteps = seq.length;
    const isPhrase = totalSteps > 1;
    const currentTarget = seq[step];

    // Build phrase display: previous words dim, new word highlighted
    const parts = currentTarget.split(' ');
    const phraseHtml = parts.map((word, i) => {
        const isNew = i === parts.length - 1;
        // Se for a última palavra da etapa atual, destaca. Se for anterior, fica cinza.
        return `<span class="${isNew ? 't2-word-new' : 't2-word-old'}" style="${isNew ? '' : 'color: rgba(255,255,255,0.3); font-weight: 400;'}">${word}</span>`;
    }).join(' ');

    // Progress dots (only for multi-step phrases)
    const dotsHtml = isPhrase
        ? seq.map((_, i) => `<div class="t2-dot ${i < step ? 't2-done' : i === step ? 't2-active' : ''}"></div>`).join('')
        : `<span style="color:var(--text-muted); font-size:0.8rem;">${state.typing2SeqIndex + 1} / ${state.typing2Sequences.length}</span>`;

    return `
        <div class="typing-container animate-fade">

            <div id="keyboard-hint-container" style="display: flex; flex-direction: column; align-items: center; justify-content: flex-end; width: 100%; margin-bottom: 5px; min-height: 0;"></div>

            <div style="position: relative; width: 100%;">
                <div class="combo-badge ${state.combo > 1 ? 'combo-active' : ''}" style="top: -10px;">
                    ${'⭐'.repeat(Math.min(state.combo, 5))} ×${state.combo}
                </div>
                <div class="target-word-display t2-phrase-display" id="target-word" style="margin-bottom: 10px;">
                    ${phraseHtml}
                </div>
            </div>

            <input type="text" id="typing2-input" class="typing-input" placeholder="..."
                   autocomplete="new-password" autocapitalize="none" spellcheck="false"
                   autocorrect="off" inputmode="text" data-lpignore="true" data-form-type="other"
                   name="t2-${Math.random()}">

            <div id="typing2-feedback" class="feedback-msg" style="margin-top: 5px; height: 20px;"></div>

            <div class="typing-nav" style="margin-top: 25px;">
                <div class="nav-circle" onclick="window.prevTyping2()" title="Voltar">⬅</div>
                <button class="btn-action pulse-green" onclick="window.checkTyping2(true)" style="width: auto; padding: 15px 35px; border-radius: 40px;">✅</button>
                <div class="nav-circle" onclick="window.skipTyping2()" title="Pular">➡</div>
            </div>
            
            <div class="t2-steps" style="margin-top: 15px;">
                ${dotsHtml}
            </div>
        </div>
    `;
}

window.prevTyping2 = () => {
    if (state.typing2SeqIndex > 0) {
        state.typing2SeqIndex--;
    } else {
        state.typing2SeqIndex = state.typing2Sequences.length - 1;
    }
    state.typing2StepIndex = 0;
    render();
    setTimeout(() => { window.typing2Speak?.(); }, 350);
};

window.typing2Speak = () => {
    const seq = state.typing2Sequences[state.typing2SeqIndex];
    const target = seq[state.typing2StepIndex];
    window.speak(target, target.includes(' ') ? 0.8 : 0.9);
};

window.checkTyping2 = () => {
    const input = document.getElementById('typing2-input');
    const feedback = document.getElementById('typing2-feedback');
    const seq = state.typing2Sequences[state.typing2SeqIndex];
    const target = seq[state.typing2StepIndex];
    const card = document.querySelector('.typing-container');
    const targetClean = normalizeText(target);
    const typedClean = normalizeText(input.value);

    if (typedClean === targetClean) {
        state.combo++;
        state.correctCount++;
        const points = 5;
        state.score += points;
        localStorage.setItem('thun_score', state.score);
        input.value = '';

        if (state.score > state.dailyRecord) {
            state.dailyRecord = state.score;
            localStorage.setItem('thun_daily_record', state.dailyRecord);
        }

        feedback.innerHTML = `<span class="success-text">+${points} estrelas! 🌟</span>`;
        card?.classList.add('animate-success');
        playSound('success');
        if (state.vibrationEnabled && navigator.vibrate) navigator.vibrate(200);

        // Removido fala ao acertar para focar na próxima palavra

        if (window.confetti) {
            window.confetti({ particleCount: 100, spread: 70, origin: { y: 0.6 }, colors: ['#fbbf24','#3b82f6','#10b981'] });
        }

        renderHeaderInPlace();

        setTimeout(() => {
            card?.classList.remove('animate-success');
            // Advance step
            if (state.typing2StepIndex < seq.length - 1) {
                state.typing2StepIndex++;
                render();
                setTimeout(() => document.getElementById('typing2-input')?.focus(), 100);
            } else {
                // Sequence complete
                if (state.typing2SeqIndex < state.typing2Sequences.length - 1) {
                    state.typing2SeqIndex++;
                } else {
                    state.typing2Sequences = buildTyping2Sequences([...contextPhrases].sort(() => Math.random() - 0.5));
                    state.typing2SeqIndex = 0;
                }
                state.typing2StepIndex = 0;
                render();
                setTimeout(() => document.getElementById('typing2-input')?.focus(), 100);
            }
        }, 800);

    } else {
        state.combo = 0;
        input.classList.add('animate-shake');
        document.body.classList.add('bg-error');
        playSound('error');
        if (state.vibrationEnabled && navigator.vibrate) navigator.vibrate([100, 50, 100]);
        setTimeout(() => {
            input.classList.remove('animate-shake');
            document.body.classList.remove('bg-error');
        }, 800);
        input.placeholder = target;
        setTimeout(() => { input.placeholder = '...'; }, 2000);
        render(); // update combo badge

        if (targetClean.includes(' ')) {
            const targetWords = targetClean.split(' ');
            const typedWords = typedClean.split(' ');
            let resultHtml = '<span>';
            let correctWords = [];
            for (let i = 0; i < targetWords.length; i++) {
                if (typedWords[i] === targetWords[i]) {
                    resultHtml += `<span class="success-text">${targetWords[i]} </span>`;
                    correctWords.push(targetWords[i]);
                } else {
                    resultHtml += `<span class="error-char">${typedWords[i] || '_'} </span>`;
                }
            }
            resultHtml += '</span>';
            const fb = document.getElementById('typing2-feedback');
            if (fb) fb.innerHTML = resultHtml;
            if (correctWords.length > 0) speak(correctWords.join(' '));
        } else {
            const fb = document.getElementById('typing2-feedback');
            if (fb) fb.innerHTML = '<span class="error-char">Tente novamente</span>';
        }
    }
};

window.skipTyping2 = () => {
    if (state.typing2SeqIndex < state.typing2Sequences.length - 1) {
        state.typing2SeqIndex++;
    } else {
        state.typing2Sequences = buildTyping2Sequences([...contextPhrases].sort(() => Math.random() - 0.5));
        state.typing2SeqIndex = 0;
    }
    state.typing2StepIndex = 0;
    render();
};

window.resetInactivityTimer2 = () => {
    clearTimeout(state.inactivityTimer);
    if (state.view !== 'typing2') return;
    const container = document.getElementById('keyboard-hint-container');
    if (container) {
        container.innerHTML = '';
        renderHeaderInPlace();
    }
    state.inactivityTimer = setTimeout(() => {
        window.renderHintKeyboard2();
    }, 4000);
};

window.renderHintKeyboard2 = () => {
    const seq = state.typing2Sequences[state.typing2SeqIndex];
    const target = seq[state.typing2StepIndex];
    const input = document.getElementById('typing2-input');
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
            ${rows.map(row => `
                <div class="kbd-row">
                    ${row.map(key => `
                        <div class="kbd-key ${key === nextChar ? 'highlight' : ''}" style="${key === ' ' ? 'width: 60%; max-width: 250px;' : ''}">
                            ${key === ' ' ? '' : key}
                        </div>
                    `).join('')}
                </div>
            `).join('')}
        </div>
    `;
    const container = document.getElementById('keyboard-hint-container');
    if (container) {
        container.innerHTML = keyboardHtml;
        renderHeaderInPlace();
    }
};

// -- Flashcards View --
function FlashcardsView() {
    const currentWord = state.flashcardsPool[state.flashcardIndex];
    
    if (!state.flashcardFlipped) {
        return `
            <div class="flashcard-container animate-fade" style="display:flex; flex-direction:column; align-items:center; justify-content:center; flex:1;">
                <div class="flashcard-front" style="text-align:center;">
                    <button class="btn-listen pulse-slow" onclick="window.speak('${s(currentWord)}', 0.9)" style="width:160px; height:160px; font-size:4rem; border-radius:50%; background:var(--glass); border:4px solid var(--primary); box-shadow:0 0 30px rgba(99,102,241,0.3);">🔊</button>
                    <p style="color:var(--text-muted); margin-top:30px; font-weight:600; font-size:1.2rem;">Ouça e repita</p>
                </div>
                <div class="typing-nav" style="margin-top: 60px;">
                    <div class="nav-circle" style="width:60px; height:60px; font-size:1.5rem;" onclick="window.prevFlashcard()">⬅</div>
                    <button class="btn-action pulse-green" onclick="window.flipFlashcard()" style="width: auto; padding: 18px 45px; border-radius: 50px; font-size:1.1rem;">VER ✅</button>
                    <div class="nav-circle" style="width:60px; height:60px; font-size:1.5rem;" onclick="window.nextFlashcard()">➡</div>
                </div>
            </div>
        `;
    } else {
        return `
            <div class="flashcard-container animate-fade" style="display:flex; flex-direction:column; align-items:center; justify-content:center; flex:1;">
                <div class="flashcard-back" style="width:100%; text-align:center;">
                    <button class="btn-listen" onclick="window.speak('${s(currentWord)}', 0.9)" style="width:100px; height:100px; font-size:2.5rem; border-radius:50%; background:var(--glass); border:2px solid var(--primary); margin-bottom:40px;">🔊</button>
                    <div style="display:flex; flex-direction:column; gap:20px; width:100%;">
                        ${state.flashcardOptions.map(opt => {
                            let statusClass = "";
                            if (state.flashcardChecked === opt) {
                                statusClass = opt === currentWord ? "flashcard-option-correct" : "flashcard-option-wrong";
                            }
                            return `<div class="menu-card animate-pop ${statusClass}" 
                                         onclick="window.checkFlashcard('${opt}')" 
                                         style="justify-content:center; padding:30px; border-width:4px; border-color:rgba(255,255,255,0.1); background:rgba(255,255,255,0.05); pointer-events: ${state.flashcardChecking ? 'none' : 'auto'};">
                                        <h3 style="font-size:2rem; letter-spacing:1px;">${opt}</h3>
                                    </div>`;
                        }).join('')}
                    </div>
                </div>
                <div class="typing-nav" style="margin-top: 40px; justify-content:center;">
                    <div class="nav-circle" style="width:60px; height:60px; font-size:1.8rem;" onclick="state.flashcardFlipped=false; state.flashcardChecking=false; state.flashcardChecked=null; render();">↺</div>
                </div>
            </div>
        `;
    }
}

window.flipFlashcard = () => {
    const currentWord = state.flashcardsPool[state.flashcardIndex];
    const distractor = getFlashcardDistractor(currentWord);
    state.flashcardOptions = [currentWord, distractor].sort(() => Math.random() - 0.5);
    state.flashcardFlipped = true;
    render();
};

window.checkFlashcard = (selected) => {
    if (state.flashcardChecking) return;
    
    const correct = state.flashcardsPool[state.flashcardIndex];
    state.flashcardChecking = true;
    state.flashcardChecked = selected;
    
    if (selected === correct) {
        state.score += 10;
        localStorage.setItem('thun_score', state.score);
        // Sem som de sucesso, apenas visual
        if (window.confetti) window.confetti({ particleCount: 100, spread: 70, origin: { y: 0.6 } });
        if (state.vibrationEnabled && navigator.vibrate) navigator.vibrate(200);
        
        render(); // Mostra o verde imediatamente
        
        setTimeout(() => {
            state.flashcardChecking = false;
            state.flashcardChecked = null;
            window.nextFlashcard();
        }, 2700); // 2.7 segundos para o verde
    } else {
        playSound('error');
        document.body.classList.add('bg-error');
        if (state.vibrationEnabled && navigator.vibrate) navigator.vibrate([100, 50, 100]);
        
        render(); // Mostra o vermelho imediatamente
        
        setTimeout(() => {
            document.body.classList.remove('bg-error');
            state.flashcardChecking = false;
            state.flashcardChecked = null;
            render(); // Reseta para tentar novamente
        }, 2000); // 2.0 segundos para o vermelho
    }
};

window.nextFlashcard = () => {
    state.flashcardFlipped = false;
    if (state.flashcardIndex < state.flashcardsPool.length - 1) {
        state.flashcardIndex++;
    } else {
        state.flashcardsPool = [...words].sort(() => Math.random() - 0.5);
        state.flashcardIndex = 0;
    }
    render();
    setTimeout(() => window.speak(state.flashcardsPool[state.flashcardIndex], 0.9), 300);
};

window.prevFlashcard = () => {
    state.flashcardFlipped = false;
    if (state.flashcardIndex > 0) {
        state.flashcardIndex--;
        render();
        setTimeout(() => window.speak(state.flashcardsPool[state.flashcardIndex], 0.9), 300);
    }
};


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
    if (view === 'typing2') {
        setTimeout(() => {
            document.getElementById('typing2-input')?.focus();
            window.typing2Speak();
        }, 200);
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
        
        window.speak(target, 0.9); // Fala imediata
        
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
            <div style="font-size: 4rem; margin-bottom: 10px;">🏆</div>
            <div class="star-rating">⭐⭐⭐</div>
            <div class="menu-card ler" onclick="window.setView('home')" style="justify-content: center; margin-top: 20px;">
                <span style="font-size: 1.8rem;">🏠</span>
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
            case 'typing2': content = Typing2View(); break;
            case 'matching': content = MatchingView(); break;
            case 'flashcards': content = FlashcardsView(); break;
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

    // Typing2 listeners + auto-speak + all Digitar 1 effects
    if (state.view === 'typing2') {
        const input2 = document.getElementById('typing2-input');
        input2?.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') window.checkTyping2();
        });
        input2?.addEventListener('input', () => {
            input2.value = input2.value.toLowerCase();
            const seq = state.typing2Sequences[state.typing2SeqIndex];
            const target = seq[state.typing2StepIndex];
            const targetClean = normalizeText(target);
            const typedClean = normalizeText(input2.value);
            if (typedClean && !targetClean.startsWith(typedClean)) {
                document.body.classList.add('bg-error');
                if (state.vibrationEnabled && navigator.vibrate) navigator.vibrate(100);
                if (!state.lastCharWasError) {
                    playSound('error');
                    state.lastCharWasError = true;
                }
            } else {
                document.body.classList.remove('bg-error');
                state.lastCharWasError = false;
            }
            window.resetInactivityTimer2();
        });
        input2?.addEventListener('focus', () => {
            document.getElementById('keyboard-hint-container').innerHTML = '';
        });
        // Só fala a palavra se o áudio não estiver ocupado (evita interromper a voz de acerto)
        if (!window.speechSynthesis.speaking) {
            setTimeout(() => { window.typing2Speak?.(); }, 150);
        }
        window.resetInactivityTimer2();
    }

    if (state.view === 'flashcards') {
        // Auto-speak on first entry
        if (!state.flashcardStarted) {
            state.flashcardStarted = true;
            setTimeout(() => window.speak(state.flashcardsPool[state.flashcardIndex], 0.9), 500);
        }
    } else {
        state.flashcardStarted = false;
    }
}

// Desbloqueia vibração e áudio no primeiro toque
window.addEventListener('touchstart', () => {
    if (navigator.vibrate) navigator.vibrate(10);
}, { once: true });

// Initial render
render();
