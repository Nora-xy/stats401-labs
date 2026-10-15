# Lab 10: Novel Interaction

Extends Lab 9's existing linked GDP choropleth and Dorling cartogram with voice control. Loads the original `../lab9/lab9.js`, stylesheet, local D3, and unchanged datasets directly; the adapter invokes existing dropdown and map-button handlers.

Run `python -m http.server 8000` from the repository root and open http://localhost:8000/lab10/ (or use the deployed HTTPS course site).

Click **Start listening**, grant microphone permission, and speak one English command. Click again for each subsequent command. **Stop listening** cancels recognition. Commands include `Highlight Japan`, `Show United States`, `Select Singapore`, `Zoom in`, `Zoom out`, `Clear selection`, and `Reset`. All 50 dropdown economy names are supported, along with USA/US and UK aliases. Country commands select and center, rather than filter.

The transcript and resulting action are visible. Typed commands use the same parser; dropdown, map buttons, mouse, and keyboard remain available without speech support or permission. Microphone activation requires a click; camera access is never requested. Browser speech providers may process audio remotely. API behavior and compatibility reference: [MDN SpeechRecognition](https://developer.mozilla.org/en-US/docs/Web/API/SpeechRecognition).

The page includes a 174-word design reflection. Actual microphone accuracy has not been measured; recognition tests use a mock speech service.

Validation: `node lab10/validate_lab10.cjs` and `node lab9/validate_lab9.cjs`. They use the existing jsdom installation in `.lab8-cache/test/node_modules` (on a fresh checkout, `npm install --prefix .lab8-cache/test jsdom`). Lab 10 checks linked selection, country aliases, unknown commands, zoom/reset, unsupported browsers, explicit activation, transcript feedback, permission errors, cancellation, synchronous start failure, and reflection length. Lab 9 checks the reused visualizations and data joins.
