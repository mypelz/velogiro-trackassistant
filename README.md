# Velogiro - Power-Based Speed Prediction

**Predict Your Ride with Power-Perfect Precision**

Transform any GPX track into an accurate speed forecast. Import your route from Komoot or any GPS app, input your average power output, and get a realistic velocity prediction that accounts for every climb, descent, and flat stretch.

👉 Live demo: [https://mypelz.github.io/velogiro-trackassistant/](https://mypelz.github.io/velogiro-trackassistant/)

---

### Your ride, calculated down to the watt

- Analyzes elevation profiles and distance from your GPX data  
- Factors in your bike type, total weight (gear, cargo, and all), and body weight  
- Calculates precise speed estimates based on your sustainable power output  
- No more guessing—know your pace before you pedal

Whether you're planning a bikepacking adventure, training for an event, or just curious how fast you'll actually go on that mountain pass, get the answer in watts and kilometers per hour.

---

### Status & Limitations

> This is a proof-of-concept. It is **not production ready** and still lacks extensive validation for edge cases.

- GPX files without elevation data are not gracefully handled yet.
- Very long tracks (≈400 km and above) will load, but the UI isn’t optimized for that scale and can glitch.

Use it as a planning aid, double-check with your own experience, and feel free to open issues or PRs if you want to help improve it.

---

### Local Development

```bash
npm install
npm run start
```

Open [http://localhost:4200](http://localhost:4200) to load the app in development mode. The GPX example bundled in `src/assets` is loaded automatically.

---

### Deployment

Deployments are hosted on GitHub Pages. To publish a new build:

```bash
npm run deploy
```

This runs `ng build --base-href=/velogiro-trackassistant/` and pushes the contents of `dist/velogiro-trackassistant/browser` using `angular-cli-ghpages`.

---

### License

MIT License

Copyright (c) 2026 Christoph Pelz

Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.

All intellectual property rights in this software remain with Christoph Pelz, pelz@mypelz.de. Status 01.2026.
