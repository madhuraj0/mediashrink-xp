# 🗜️ MediaShrink XP

> **Retro Windows XP-styled in-browser media compressor & converter.**
> 100% Client-Side. No server uploads. Hit any target file size (including < 8 MB, < 2 MB, and < 500 KB).

[![Deploy to GitHub Pages](https://github.com/madhuraj0/mediashrink-xp/actions/workflows/deploy.yml/badge.svg)](https://github.com/madhuraj0/mediashrink-xp/actions/workflows/deploy.yml)

🌐 **Live Demo:** [https://madhuraj0.github.io/mediashrink-xp/](https://madhuraj0.github.io/mediashrink-xp/)

---

## ✨ Features

- **Unified Single Interface**: Compress, resize, and convert both **images** and **videos** in one place.
- **Arbitrary Target Size (< 8MB & Custom)**:
  - Presets: `500 KB`, `1 MB`, `2 MB`, `8 MB (Discord Free)`, `25 MB (Discord Nitro/Email)`, `50 MB`, `Custom`.
  - Smart Bitrate & Resolution Math automatically scales video dimensions (e.g. 1080p $\rightarrow$ 720p/480p/360p) and audio bitrates so small targets don't degrade into pixelated artifacts.
- **Image Compression Engine**:
  - Binary search quality optimization on HTML5 Canvas / WebP.
  - Progressive dimensional downscaling for extreme target sizes.
  - Formats: WebP, JPEG, PNG, Original.
- **Video Compression Engine**:
  - Full client-side FFmpeg WebAssembly (`@ffmpeg/ffmpeg`).
  - Converts MP4 (H.264/AAC), WebM (VP8/Vorbis).
  - Audio bitrate optimization and optional audio stripping for maximum size savings.
- **Retro Windows XP Luna Blue Aesthetic**:
  - Authentic Windows XP titlebars, 3D buttons, dialogs, and animated segmented green progress bars.
  - Bliss rolling hills backdrop and classic desktop icons.
  - Synthesized Web Audio API sound effects (XP Startup, Clicks, Chords, Dings) with instant mute toggle.
- **Batch Processing & ZIP Download**:
  - Queue multiple images and videos.
  - Export all compressed results into a single `.zip` archive via JSZip.
- **100% Private & Free**:
  - All encoding executes locally in your browser sandbox using Web Workers and WebAssembly.
  - Zero server uploads or bandwidth charges.

---

## 🛠️ Local Development

```bash
# Clone the repository
git clone https://github.com/madhuraj0/mediashrink-xp.git

# Install dependencies
npm install

# Run Vite development server
npm run dev

# Build production bundle
npm run build
```

---

## 📄 License
MIT License. Created by [Madhuraj](https://github.com/madhuraj0).
