// Improved audio controller: muted autoplay fallback, robust checks, logs.

(() => {
  // Try to use a page-provided background audio element if available.
  // Use `let` so we can create a lightweight fallback when it's missing.
  let audio = document.getElementById('bg-audio');
  let controlRoot = document.querySelector('.audio-control');
  let toggleBtn = document.getElementById('audio-toggle');
  let panel = document.getElementById('audio-panel');
  let volSlider = document.getElementById('audio-volume');
  let muteBtn = document.getElementById('audio-mute');

  // If there is no background audio element on the page, create a minimal
  // in-memory fallback so the rest of the controller can initialize and
  // the praise API (`playPraise` / `playPraiseKey`) is always available.
  if (!audio) {
    console.warn('audio.js: #bg-audio not found — creating lightweight fallback audio');
    audio = document.createElement('audio');
    // keep it off-screen (do not append) and provide enough of the API
    // so the controller code can interact with it without errors.
    audio.id = 'bg-audio-fallback';
    audio.muted = false;
    audio.volume = 0.6;
    audio.paused = true;
    audio.play = () => Promise.resolve();
    audio.pause = () => {};
    audio.addEventListener = () => {};
    audio.removeEventListener = () => {};
  }

  // Only allow automatic background playback on specific pages.
  // This prevents the site's bg music from playing on every HTML page after deploy.
  const pageFile = (window.location.pathname.split('/').pop() || 'index.html').toLowerCase();
  const allowedPages = ['index.html', 'home.html', '']; // '' covers root `/`
  const audioAllowed = allowedPages.includes(pageFile);
  if (!audioAllowed) {
    // Mute and pause the audio to ensure it won't autoplay on disallowed pages.
    try { if (audio && audio.pause) audio.pause(); } catch(e){}
    try { if (audio) audio.muted = true; } catch(e){}
    // If there is a visible audio control, hide it so users don't get a confusing UI on other pages.
    if (controlRoot) controlRoot.style.display = 'none';
  }

  // If UI pieces are missing, create a minimal control so user can start playback
  if (!controlRoot || !toggleBtn || !panel || !volSlider || !muteBtn) {
    console.warn('audio.js: some audio control elements missing. Creating minimal control...');
    // create minimal UI appended to body
    const root = document.createElement('div');
    root.className = 'audio-control';
    root.style.position = 'fixed';
    root.style.right = '16px';
    root.style.bottom = '16px';
    root.style.zIndex = '9999';

    const btn = document.createElement('button');
    btn.id = 'audio-toggle';
    btn.className = 'audio-btn';
    btn.title = 'Sound';
    btn.innerText = '🔊';
    root.appendChild(btn);

    const panelEl = document.createElement('div');
    panelEl.id = 'audio-panel';
    panelEl.className = 'audio-panel';
    panelEl.style.display = 'none';

    const slider = document.createElement('input');
    slider.type = 'range';
    slider.id = 'audio-volume';
    slider.className = 'audio-volume';
    slider.min = 0; slider.max = 1; slider.step = 0.01;
    panelEl.appendChild(slider);

    const mute = document.createElement('button');
    mute.id = 'audio-mute';
    mute.className = 'audio-mute';
    mute.textContent = 'Mute';
    panelEl.appendChild(mute);

    root.appendChild(panelEl);
    document.body.appendChild(root);

    // rebind
    controlRoot = root;
    toggleBtn = document.getElementById('audio-toggle');
    panel = document.getElementById('audio-panel');
    volSlider = document.getElementById('audio-volume');
    muteBtn = document.getElementById('audio-mute');
  }

  // Load saved settings
  const savedVol = parseFloat(localStorage.getItem('webapex-audio-volume'));
  const savedMuted = localStorage.getItem('webapex-audio-muted') === 'true';
  // separate sound effects (praise) mute setting so SFX can play even when
  // background music is muted. Default: false (SFX enabled).
  let sfxMuted = localStorage.getItem('webapex-sfx-muted') === 'true';
  // shared AudioContext for short SFX fallback; will be resumed on user interaction
  let sfxCtx = null;
  function getSfxContext(){
    if (!sfxCtx){
      const Ctx = window.AudioContext || window.webkitAudioContext;
      if (!Ctx) return null;
      try{ sfxCtx = new Ctx(); }catch(e){ sfxCtx = null; }
    }
    return sfxCtx;
  }
  function resumeSfxContext(){
    try{
      const c = getSfxContext();
      if (c && c.state === 'suspended') c.resume().catch(()=>{});
    }catch(e){}
  }
  // resume SFX audio context on first user gesture (click/keydown)
  document.addEventListener('click', resumeSfxContext, { once: true, capture: true });
  document.addEventListener('keydown', resumeSfxContext, { once: true, capture: true });
  audio.volume = !isNaN(savedVol) ? savedVol : 0.6;
  // persisted playback position (session-only so it resets when the browser session ends)
  const savedTime = parseFloat(sessionStorage.getItem('webapex-audio-time'));
  const savedPlaying = sessionStorage.getItem('webapex-audio-playing') === 'true';
  // If the user previously allowed sound during this browser session, remember it
  const priorGesture = sessionStorage.getItem('webapex-audio-user-gesture') === 'true';

  // Prefer unmuted autoplay first; if blocked, fall back to muted autoplay (many browsers block unmuted autoplay)
  const tryUnmutedAutoplay = () => {
    audio.muted = false;
    return audio.play().then(() => {
      console.info('audio.js: autoplay (unmuted) succeeded');
      muteBtn.textContent = audio.muted ? 'Muted' : 'Mute';
      localStorage.setItem('webapex-audio-muted', String(audio.muted));
      return true;
    }).catch((err) => {
      console.warn('audio.js: unmuted autoplay blocked, attempting muted autoplay...', err);
      audio.muted = true;
      return audio.play().then(() => {
        console.info('audio.js: autoplay (muted) succeeded');
        muteBtn.textContent = 'Muted';
        localStorage.setItem('webapex-audio-muted', 'true');
        return false;
      }).catch((err2) => {
        console.warn('audio.js: muted autoplay also failed (user gesture required)', err2);
        return false;
      });
    });
  };

  // Restore playback position (if any) before attempting autoplay so we don't restart from 0
  const restorePosition = () => {
    if (!isNaN(savedTime)) {
      const setTime = () => {
        try {
          // clamp to duration if available
          if (audio.duration && savedTime >= audio.duration) {
            audio.currentTime = Math.max(0, audio.duration - 0.1);
          } else {
            audio.currentTime = savedTime;
          }
        } catch (e) {
          console.warn('audio.js: could not restore time', e);
        }
      };
      if (audio.readyState >= 1) setTime(); else audio.addEventListener('loadedmetadata', setTime, { once: true });
    }
    // then try autoplay/resume only after position restored
    if (priorGesture) {
      audio.muted = false;
      tryUnmutedAutoplay().then((ok) => { if (!ok) showEnableSoundPrompt(); });
    } else {
      tryUnmutedAutoplay().then((ok) => { if (!ok) showEnableSoundPrompt(); });
    }
  };

  // Restore position and attempt autoplay only on allowed pages.
  if (audioAllowed) restorePosition();

  // Init UI values
  volSlider.value = audio.volume;
  muteBtn.textContent = savedMuted ? 'Muted' : 'Mute';

  // Play/unmute on first user gesture if saved not-muted (ensures unmuted playback when user interacts)
  const playOnInteraction = () => {
    document.removeEventListener('click', playOnInteraction);
    document.removeEventListener('keydown', playOnInteraction);
    if (!savedMuted) {
      audio.muted = false;
      audio.play().catch(e => console.warn('audio.js: play after gesture failed', e));
      muteBtn.textContent = 'Mute';
      localStorage.setItem('webapex-audio-muted', 'false');
    }
  };
  // Only attach first-user-gesture listeners to trigger playback on allowed pages.
  if (audioAllowed) {
    document.addEventListener('click', playOnInteraction, { once: true });
    document.addEventListener('keydown', playOnInteraction, { once: true });
  }

  // Toggle panel open/close
  const setOpen = (open) => {
    controlRoot.classList.toggle('open', open);
    panel.setAttribute('aria-hidden', String(!open));
    panel.style.display = open ? 'flex' : 'none';
  };

  // Single click on the main toggle button now toggles mute/unmute (user requested simple mute behavior)
  toggleBtn.addEventListener('click', (e) => {
    // If the control panel is open, a click should first close it. Otherwise toggle mute.
    if (controlRoot.classList.contains('open')) {
      setOpen(false);
      return;
    }
    audio.muted = !audio.muted;
    muteBtn.textContent = audio.muted ? 'Muted' : 'Mute';
    localStorage.setItem('webapex-audio-muted', String(audio.muted));
    // ensure audio is playing when unmuted
    if (!audio.muted) audio.play().catch(()=>{});
    updateToggleOpacity();
  });

  // Volume slider
  volSlider.addEventListener('input', (e) => {
    const v = parseFloat(e.target.value);
    audio.volume = v;
    audio.muted = false;
    muteBtn.textContent = 'Mute';
    localStorage.setItem('webapex-audio-volume', String(v));
    localStorage.setItem('webapex-audio-muted', 'false');
  });

  // Mute toggle
  muteBtn.addEventListener('click', () => {
    audio.muted = !audio.muted;
    muteBtn.textContent = audio.muted ? 'Muted' : 'Mute';
    localStorage.setItem('webapex-audio-muted', String(audio.muted));
    if (!audio.muted) audio.play().catch(()=>{});
  });

  // visual hint
  const updateToggleOpacity = () => {
    toggleBtn.style.opacity = audio.muted ? '0.6' : '1';
  };
  audio.addEventListener('volumechange', updateToggleOpacity);
  updateToggleOpacity();

  // Persist playback time and playing state periodically so other pages can resume without restarting
  const persistState = () => {
    try {
      sessionStorage.setItem('webapex-audio-time', String(audio.currentTime || 0));
      // consider playing if not paused and not muted
      sessionStorage.setItem('webapex-audio-playing', String(!audio.paused && !audio.muted));
    } catch (e) {
      // sessionStorage may be unavailable in some privacy modes
    }
  };
  const persistInterval = setInterval(persistState, 1000);
  // also persist on visibility change and before unload
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') persistState(); });
  window.addEventListener('beforeunload', () => { persistState(); clearInterval(persistInterval); });

  // click outside closes panel
  document.addEventListener('click', (e) => {
    if (!controlRoot.contains(e.target) && controlRoot.classList.contains('open')) {
      setOpen(false);
    }
  });

  // safety logs
  audio.addEventListener('error', (ev) => {
    console.error('audio.js: audio error', ev);
  });

  // Praise / feedback sound API
  // Uses SpeechSynthesis when available; falls back to a short beep via WebAudio.
  function _speakPhrase(text, opts){
    try{
      if (sfxMuted) return;
      // Attempt SpeechSynthesis first, but guard with a timeout to fallback
      if ('speechSynthesis' in window){
        const u = new SpeechSynthesisUtterance(text);
        opts = opts || {};
        u.lang = opts.lang || 'en-US';
        // speak at a near-normal rate but slightly brighter pitch for a happy tone
        u.rate = (typeof opts.rate === 'number') ? opts.rate : 1.0;
        u.pitch = (typeof opts.pitch === 'number') ? opts.pitch : 1.2;
        u.volume = (typeof opts.volume === 'number') ? opts.volume : 1;
        try {
          const voices = window.speechSynthesis.getVoices() || [];
          let preferred = null;
          const namePriority = [/google/i, /zira/i, /samantha/i, /joanna/i, /emma/i, /olivia/i, /alloy/i, /female/i, /en-us/i];
          for (const re of namePriority) {
            preferred = voices.find(v => v && v.name && re.test(v.name));
            if (preferred) break;
          }
          if (!preferred) preferred = voices.find(v => v && v.lang && String(v.lang).toLowerCase().startsWith('en')) || voices[0];
          if (preferred) u.voice = preferred;
        } catch (e) {
        }

        // cancel previous short utterances so praises don't queue
        try{ window.speechSynthesis.cancel(); }catch(e){}

        let started = false;
        const startHandler = () => { started = true; clearTimeout(fbTimeout); u.removeEventListener('start', startHandler); };
        const errHandler = () => { started = false; clearTimeout(fbTimeout); u.removeEventListener('error', errHandler); fallbackBeep(); };
        u.addEventListener('start', startHandler);
        u.addEventListener('error', errHandler);
        // if speech doesn't start within 700ms, fallback to short melody
        const fbTimeout = setTimeout(() => { if (!started) try{ window.speechSynthesis.cancel(); }catch(e){} fallbackBeep(); }, 700);

        try{ window.speechSynthesis.speak(u); }catch(e){ clearTimeout(fbTimeout); fallbackBeep(); }
        return;
      }
    }catch(e){
      console.warn('audio.js: speechSynthesis failed', e);
    }

    // fallback: short melodic figure via shared AudioContext (resumed on user gesture)
    try{
      fallbackBeep();
    }catch(e){}
  }

  // Play a short, pleasant melody using WebAudio as a fallback for praise.
  function fallbackBeep(){
    if (sfxMuted) return;
    const ctx = getSfxContext();
    if (!ctx) return;
    if (ctx.state === 'suspended') try{ ctx.resume(); }catch(e){}
    try{
      const now = ctx.currentTime + 0.01;
      const notes = [880, 988, 1047]; // simple arpeggio
      const gain = ctx.createGain();
      gain.gain.value = 0.00001;
      gain.connect(ctx.destination);
      let offset = 0;
      notes.forEach((freq, i) => {
        const o = ctx.createOscillator();
        o.type = 'sine';
        o.frequency.value = freq;
        const g = ctx.createGain();
        g.gain.value = 0.00001;
        o.connect(g);
        g.connect(gain);
        const startAt = now + offset;
        o.start(startAt);
        g.gain.exponentialRampToValueAtTime(0.12, startAt + 0.01);
        g.gain.exponentialRampToValueAtTime(0.00001, startAt + 0.18);
        setTimeout(()=>{ try{ o.stop(); }catch(e){} }, (offset + 0.25) * 1000);
        offset += 0.12;
      });
    }catch(e){ }
  }

  // Public API: praise helpers.
  // - `playPraise()`                : speak a random praise phrase
  // - `playPraise(keyOrText)`       : if `keyOrText` matches a known key (e.g. 'amazing','correct','goodjob','excellent'), speak the mapped phrase; otherwise speak the provided text
  // - `playPraiseKey(key)`          : speak a phrase for a known key (convenience)
  // - `getPraiseKeys()`             : returns available keys
  // All functions respect the site's mute setting (`audio.muted`).

  const praiseKeyMap = {
    amazing: 'Amazing! That was awesome!',
    correct: 'Correct! Nice work!',
    goodjob: 'Good job! Keep it up!',
    excellent: 'Excellent! You\'re on fire!',
    'well done': 'Well done! Fantastic!',
    nicework: 'Nice work! Brilliant!',
    'good': 'Good job! 👍',
    brilliant: 'Brilliant! Amazing!',
    fantastic: 'Fantastic! Wow!',
    superb: 'Superb! Great effort!',
    terrific: 'Terrific! Nice!',
    outstanding: 'Outstanding! Excellent!',
    fabulous: 'Fabulous! Well done!',
    great: 'Great! Keep going!',
    wonderful: 'Wonderful! You did it!'
  };

  // Shuffle-play state and API
  // Usage: window.playPraiseShuffle({count: 5, interval: 700}) -> returns controller { stop(), phrases }
  // Calls respect site mute; multiple calls stop prior shuffle.
  const _praiseShuffleState = {
    timers: [],
    running: false,
    lastShuffle: [],
    stop() {
      this.timers.forEach(id => clearTimeout(id));
      this.timers.length = 0;
      this.running = false;
      this.lastShuffle.length = 0;
      try{ if (window.speechSynthesis) window.speechSynthesis.cancel(); } catch(e){}
    }
  };

  window.playPraiseShuffle = function(options){
    try{
      if (sfxMuted) return;
      options = options || {};
      const interval = (typeof options.interval === 'number') ? options.interval : 700;
      const count = (typeof options.count === 'number' && options.count > 0) ? options.count : null;
      // stop any existing shuffle
      if (_praiseShuffleState.running) _praiseShuffleState.stop();

      // build phrases array and apply excludes (Fisher-Yates shuffle applied after filtering)
      let phrases = Object.values(praiseKeyMap).slice();
      // support exclude options: array of keys (`excludeKeys`) or phrase texts (`excludeValues`) or `exclude` (alias)
       const excludeKeys = Array.isArray(options.excludeKeys) ? options.excludeKeys.map(s=>String(s).toLowerCase()) : [];
      const excludeValues = Array.isArray(options.excludeValues) ? options.excludeValues.map(s=>String(s).toLowerCase()) : [];
      const exclude = Array.isArray(options.exclude) ? options.exclude.map(s=>String(s).toLowerCase()) : [];
      const allExcludes = excludeKeys.concat(excludeValues).concat(exclude);
      if (allExcludes.length) {
        // remove phrases that match mapped values for exclude keys, or match exclude texts
        const mappedExcludes = new Set();
        allExcludes.forEach(e => {
          // if entry matches a key in praiseKeyMap, add mapped phrase
          for (const k in praiseKeyMap) {
            if (k.toLowerCase() === e) mappedExcludes.add(String(praiseKeyMap[k]).toLowerCase());
          }
          // also treat e as a phrase value to exclude
          mappedExcludes.add(e);
        });
        phrases = phrases.filter(p => !mappedExcludes.has(String(p).toLowerCase()));
      }

      // if nothing left after filtering, fall back to full list
      if (!phrases.length) phrases = Object.values(praiseKeyMap).slice();

      // shuffle (Fisher-Yates)
      for (let i = phrases.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        const tmp = phrases[i]; phrases[i] = phrases[j]; phrases[j] = tmp;
      }
      for (let i = phrases.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        const tmp = phrases[i]; phrases[i] = phrases[j]; phrases[j] = tmp;
      }

      const total = count ? Math.min(count, phrases.length) : phrases.length;
      _praiseShuffleState.running = true;
      _praiseShuffleState.lastShuffle = phrases.slice(0, total);

      for (let i = 0; i < total; i++){
        const text = _praiseShuffleState.lastShuffle[i];
        const t = setTimeout(((txt) => () => { if (!sfxMuted) _speakPhrase(txt); })(text), i * interval);
        _praiseShuffleState.timers.push(t);
      }

      // cleanup timer to reset running flag after sequence
      const cleanup = setTimeout(() => { _praiseShuffleState.running = false; _praiseShuffleState.timers.length = 0; }, total * interval + 100);
      _praiseShuffleState.timers.push(cleanup);

      return {
        stop: () => { _praiseShuffleState.stop(); },
        phrases: _praiseShuffleState.lastShuffle.slice()
      };
    }catch(e){ console.warn('audio.js: playPraiseShuffle failed', e); }
  };

  window.stopPraiseShuffle = function(){ try{ _praiseShuffleState.stop(); }catch(e){} };

  window.getPraiseKeys = function(){
    try{ return Object.keys(praiseKeyMap); }catch(e){ return []; }
  };

  window.playPraiseKey = function(key){
    try{
      try{ console.debug && console.debug('audio.js: playPraiseKey called', { sfxMuted: !!sfxMuted, audioMuted: !!(audio && audio.muted), key: key }); }catch(e){}
      if (sfxMuted) { try{ console.debug && console.debug('audio.js: playPraiseKey aborted (sfxMuted)'); }catch(e){}; return; }
      if (!key) return window.playPraise();
      const k = String(key).toLowerCase().trim();
      let text;
      // When quizzes call 'correct', choose a random praise phrase for variety
      if (k === 'correct'){
        const vals = Object.values(praiseKeyMap);
        text = vals[Math.floor(Math.random() * vals.length)];
      } else {
        const resolved = praiseKeyMap[k] || praiseKeyMap[k.replace(/\s+/g,'')];
        text = resolved || String(key);
      }
      try{ console.debug && console.debug('audio.js: playPraiseKey ->', k, text); }catch(e){}
      // Use a slightly energetic but not rushed delivery for keyed praise
      _speakPhrase(text, { rate: 1.05, pitch: 1.25, volume: 1 });
    }catch(e){ console.warn('audio.js: playPraiseKey failed', e); }
  };

  window.playPraise = function(preferredPhraseOrKey){
    try{
      try{ console.debug && console.debug('audio.js: playPraise called', { sfxMuted: !!sfxMuted, audioMuted: !!(audio && audio.muted), arg: preferredPhraseOrKey }); }catch(e){}
      if (sfxMuted) { try{ console.debug && console.debug('audio.js: playPraise aborted (sfxMuted)'); }catch(e){}; return; } // respect user's SFX mute
      // no argument: random known praise
      if (!preferredPhraseOrKey){
        const phrases = Object.values(praiseKeyMap);
        const text = phrases[Math.floor(Math.random()*phrases.length)];
        _speakPhrase(text);
        return;
      }
      // if argument matches a key, use mapped phrase
      const maybe = String(preferredPhraseOrKey);
      const key = maybe.toLowerCase().trim();
      if (praiseKeyMap[key]) { _speakPhrase(praiseKeyMap[key]); return; }
      if (praiseKeyMap[key.replace(/\s+/g,'')]) { _speakPhrase(praiseKeyMap[key.replace(/\s+/g,'')]); return; }
      // otherwise speak provided text directly
      _speakPhrase(maybe);
    }catch(e){
      console.warn('audio.js: playPraise failed', e);
    }
  };

  // Play a short 'Try again' feedback (speech when available, WebAudio fallback)
  window.playTryAgain = function(){
    try{
      if (sfxMuted) return;
      const text = 'Try again!';
      if ('speechSynthesis' in window){
        try{ window.speechSynthesis.cancel(); }catch(e){}
        const u = new SpeechSynthesisUtterance(text);
        u.lang = 'en-US';
        u.rate = 1.0;
        u.pitch = 1.15;
        u.volume = 1;
        try{ window.speechSynthesis.speak(u); return; }catch(e){}
      }
    }catch(e){}

    // fallback short two-tone chirp
    try{
      const ctx = getSfxContext();
      if (!ctx) return;
      if (ctx.state === 'suspended') try{ ctx.resume(); }catch(e){}
      const now = ctx.currentTime + 0.01;
      const freqs = [880, 660];
      freqs.forEach((f,i)=>{
        const o = ctx.createOscillator();
        const g = ctx.createGain();
        o.type = 'sine';
        o.frequency.value = f;
        g.gain.value = 0.00001;
        o.connect(g); g.connect(ctx.destination);
        const startAt = now + i * 0.12;
        o.start(startAt);
        g.gain.exponentialRampToValueAtTime(0.12, startAt + 0.01);
        g.gain.exponentialRampToValueAtTime(0.00001, startAt + 0.12);
        setTimeout(()=>{ try{ o.stop(); }catch(e){} }, (i * 0.12 + 0.18) * 1000);
      });
    }catch(e){}
  };
})();