# 🗜️ MediaShrink

> **Free, in-browser video & image compressor to exact target file sizes.**
> 100% Client-Side • Zero Server Uploads • Strict Target Limit (< 8MB, 2MB, 1MB, 500KB)

[![Deploy to GitHub Pages](https://github.com/madhuraj0/mediashrink-xp/actions/workflows/deploy.yml/badge.svg)](https://github.com/madhuraj0/mediashrink-xp/actions/workflows/deploy.yml)

🌐 **Live App:** [https://madhuraj0.github.io/mediashrink-xp/](https://madhuraj0.github.io/mediashrink-xp/)

---

## ⚡ Key Capabilities

* **Strict Target Size Guarantee**:
  * Presets: `500 KB`, `1 MB`, `2 MB`, `8 MB (Discord)`, `25 MB`, `50 MB`, or custom values in KB/MB.
  * Strict VBV buffer caps and adaptive calibration ensure files **strictly fall under the target size**.
* **Smart Adaptive Downscaling**:
  * Automatically balances bitrate, resolution (1080p / 720p / 480p / 360p), and audio channels to keep ultra-small videos clear and artifact-free.
* **Unified Image & Video Support**:
  * **Videos**: MP4 (H.264 / AAC), WebM (VP8), MOV, MKV, AVI.
  * **Images**: WebP, JPEG, PNG, GIF.
* **Batch Processing & ZIP Export**:
  * Compress multiple files and download them together in a single `.zip` archive.
* **100% Client-Side Privacy**:
  * Powered by `@ffmpeg/ffmpeg` (WebAssembly) and HTML5 Canvas.
  * Files never leave your device.

---

## 💻 Local Development

```bash
git clone https://github.com/madhuraj0/mediashrink-xp.git
cd mediashrink-xp
npm install
npm run dev
```

---

## 📄 License
MIT License • Created by [Madhuraj](https://github.com/madhuraj0).
