// Improved audio controller: muted autoplay fallback, robust checks, logs.

(() => {
  const audio = document.getElementById('bg-audio');
  const controlRoot = document.querySelector('.audio-control');
  const toggleBtn = document.getElementById('audio-toggle');
  const panel = document.getElementById('audio-panel');
  const volSlider = document.getElementById('audio-volume');
  const muteBtn = document.getElementById('audio-mute');

  // Basic existence check
  if (!audio) { console.warn('audio.js: #bg-audio not found'); return; }

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
  audio.volume = !isNaN(savedVol) ? savedVol : 0.6;

  // Try muted autoplay first (most browsers allow muted autoplay)
  audio.muted = true;
  audio.play().then(() => {
    console.info('audio.js: autoplay (muted) succeeded');
    // restore saved mute state only after user gesture — keep muted until user interacts if savedMuted==false
    if (savedMuted) {
      // keep muted and update UI
      muteBtn.textContent = 'Muted';
    } else {
      // remain muted for now; will unmute on first user gesture via playOnInteraction()
      muteBtn.textContent = 'Mute';
    }
  }).catch((err) => {
    console.warn('audio.js: autoplay failed (expected on many browsers):', err);
  });

  // Init UI values
  volSlider.value = audio.volume;
  muteBtn.textContent = savedMuted ? 'Muted' : 'Mute';

  // Play/unmute on first user gesture if saved not-muted
  const playOnInteraction = () => {
    document.removeEventListener('click', playOnInteraction);
    document.removeEventListener('keydown', playOnInteraction);
    if (!savedMuted) {
      audio.muted = false;
      audio.play().catch(e => console.warn('audio.js: play after gesture failed', e));
      muteBtn.textContent = 'Mute';
    }
  };
  document.addEventListener('click', playOnInteraction, { once: true });
  document.addEventListener('keydown', playOnInteraction, { once: true });

  // Toggle panel open/close
  const setOpen = (open) => {
    controlRoot.classList.toggle('open', open);
    panel.setAttribute('aria-hidden', String(!open));
    panel.style.display = open ? 'flex' : 'none';
  };

  toggleBtn.addEventListener('click', (e) => {
    const isOpen = controlRoot.classList.toggle('open');
    setOpen(isOpen);
    // if audio paused, try to play (user gesture)
    audio.play().catch(()=>{});
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
})();