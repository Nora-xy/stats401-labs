/* Voice adapter: reuse Lab 9's existing selection and zoom handlers. */
"use strict";
(() => {
  const q = s => document.querySelector(s);
  const start = q('#voice-start'), stop = q('#voice-stop');
  const status = (message, error = false) => {
    q('#voice-status').textContent = message;
    q('#voice-status').dataset.state = error ? 'error' : 'idle';
  };
  const normalize = text => text.toLowerCase().replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim();
  const aliases = {usa:'united states', 'u s a':'united states', 'us':'united states', 'united states of america':'united states', uk:'united kingdom', 'u k':'united kingdom', britain:'united kingdom', korea:'south korea'};
  let ready = false, recognition = null, active = false, cancelled = false;
  function runCommand(transcript, source) {
    q('#voice-heard').textContent = `${source}: ${transcript}`;
    const action = message => { q('#voice-action').textContent = `Action: ${message}`; };
    if (!ready) { action('Maps are unavailable. Wait for loading or reload.'); return; }
    const command = normalize(transcript);
    if (command === 'reset' || command === 'reset visualization' || command === 'reset map') {
      q('#clear').click(); q('[data-zoom="reset"]').click(); action('Selection cleared; map reset.');
    } else if (command === 'clear selection') {
      q('#clear').click(); action('Selection cleared.');
    } else if (command === 'zoom in' || command === 'zoom out') {
      q(`[data-zoom="${command === 'zoom in' ? 'in' : 'out'}"]`).click(); action(command === 'zoom in' ? 'Zoomed in (maximum 8×).' : 'Zoomed out (minimum 1×).');
    } else {
      const match = command.match(/^(?:highlight|show|select) (.+)$/);
      const name = match && (aliases[match[1]] || match[1]);
      const option = name && [...q('#country-select').options].find(o => o.value && normalize(o.textContent) === name);
      if (!option) { action('Command not recognized. Try “Highlight Japan”, “Zoom in”, or “Reset”. Selection unchanged.'); return; }
      q('#country-select').value = option.value;
      q('#country-select').dispatchEvent(new Event('change', {bubbles:true}));
      action(`Selected ${option.textContent} in both views; geographic map centered at 3×.`);
    }
  }
  q('#command-form').addEventListener('submit', event => { event.preventDefault(); runCommand(q('#command-input').value, 'Typed'); });
  function initialize() {
    if (document.documentElement.dataset.lab9Ready !== 'true') return;
    observer.disconnect(); ready = true; q('#command-run').disabled = false;
    q('#voice-action').textContent = 'Action: Ready to explore.';
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) { status('Speech recognition is unavailable in this browser. Use typed commands or the map controls.'); return; }
    try { recognition = new SpeechRecognition(); } catch { status('Speech service unavailable. Use typed commands or map controls.', true); return; }
    recognition.lang = 'en-US'; recognition.continuous = false; recognition.interimResults = false;
    start.disabled = false; status('Microphone inactive. Click Start listening for one command.');
    const inactive = () => { active = false; start.disabled = false; stop.disabled = true; };
    recognition.onstart = () => { if (!cancelled) status('Listening… Say one command.'); };
    recognition.onresult = event => {
      if (cancelled) return;
      const transcript = event.results[0][0].transcript.trim();
      runCommand(transcript, 'Heard'); status('Command received. Listening will end automatically.');
    };
    recognition.onnomatch = () => status('No speech match. Try again or type a command.', true);
    recognition.onerror = event => {
      const errors = {'not-allowed':'Microphone permission denied.', 'service-not-allowed':'Speech service is blocked.', 'audio-capture':'No working microphone found.', 'no-speech':'No speech detected.', network:'Speech service network error.', aborted:'Listening cancelled.'};
      status(`${errors[event.error] || 'Speech recognition failed.'} Use typed commands or try again.`, true);
    };
    recognition.onend = () => { inactive(); if (q('#voice-status').dataset.state !== 'error') status('Microphone inactive. Click Start listening for another command.'); };
    start.addEventListener('click', () => {
      if (active) return;
      active = true; cancelled = false; start.disabled = true; stop.disabled = false;
      q('#voice-heard').textContent = 'Heard: —'; status('Requesting microphone…');
      try { recognition.start(); } catch { inactive(); status('Could not start speech recognition. Try again or type a command.', true); }
    });
    stop.addEventListener('click', () => { cancelled = true; recognition.abort(); status('Listening cancelled. Microphone stopping.'); });
    const cancel = () => { if (active) { cancelled = true; recognition.abort(); } };
    window.addEventListener('pagehide', cancel);
    document.addEventListener('visibilitychange', () => { if (document.hidden) cancel(); });
  }
  const observer = new MutationObserver(initialize);
  observer.observe(document.documentElement, {attributes:true, attributeFilter:['data-lab9-ready']});
  initialize();
})();
