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
  // persisted playback position (session-only so it resets when the browser session ends)
  const savedTime = parseFloat(sessionStorage.getItem('webapex-audio-time'));
  const savedPlaying = sessionStorage.getItem('webapex-audio-playing') === 'true';

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
    tryUnmutedAutoplay();
  };

  restorePosition();

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
  document.addEventListener('click', playOnInteraction, { once: true });
  document.addEventListener('keydown', playOnInteraction, { once: true });

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
})();