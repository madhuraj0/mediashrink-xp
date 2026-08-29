# 🗜️ MediaShrink

> **In-browser media compressor & converter.**
> 100% Client-Side. Zero server uploads. Strictly hits any target file size (including < 8 MB, < 2 MB, and < 500 KB).

[![Deploy to GitHub Pages](https://github.com/madhuraj0/mediashrink-xp/actions/workflows/deploy.yml/badge.svg)](https://github.com/madhuraj0/mediashrink-xp/actions/workflows/deploy.yml)

🌐 **Live Demo:** [https://madhuraj0.github.io/mediashrink-xp/](https://madhuraj0.github.io/mediashrink-xp/)

---

## ✨ Features

- **Unified Single Interface**: Compress, resize, and convert both **images** and **videos** in one place.
- **Strict Target Size Guarantee (Hard Limit)**:
  - Presets: `500 KB`, `1 MB`, `2 MB`, `8 MB (Discord)`, `25 MB`, `50 MB`, `Custom`.
  - Enforces strict VBV bitrates, downscaling, and auto-verification so output is guaranteed to fall **strictly under the target limit**.
- **Smart Adaptive Resolution**:
  - Automatically downscales video dimensions (e.g. 1080p $\rightarrow$ 720p/480p/360p) and audio bitrates for small targets so videos stay sharp and artifact-free.
- **Image Compression Engine**:
  - Binary search quality optimization and dimensional downscaling on Canvas/WebP.
  - Formats: WebP, JPEG, PNG, Original.
- **Video Compression Engine**:
  - Full client-side FFmpeg WebAssembly (`@ffmpeg/ffmpeg`).
  - Converts MP4 (H.264/AAC) and WebM (VP8).
- **Retro Personality & User-Friendly Design**:
  - Clean, spacious layout with large clickable touch-friendly preset buttons.
  - Classic desktop aesthetic with optional synthesized audio feedback.
- **Batch Processing & ZIP Download**:
  - Queue multiple images and videos.
  - Export all compressed results into a single `.zip` archive via JSZip.
- **100% Private & Free**:
  - All processing runs inside your browser sandbox.

---

## 🛠️ Local Development

```bash
# Clone the repository
git clone https://github.com/madhuraj0/mediashrink-xp.git

# Install dependencies
npm install

# Run development server
npm run dev

# Build production bundle
npm run build
```

---

## 📄 License
MIT License. Created by [Madhuraj](https://github.com/madhuraj0).
