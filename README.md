# Vikola AI — Intelligent Multimodal Assistant

**Vikola AI** is a state-of-the-art multimodal AI assistant powered by Google Gemini, equipped with offline knowledge fallbacks, voice recognition, image analysis, math & LaTeX rendering, and code syntax highlighting.

It is cross-platform: run it as a responsive web app, install it instantly as a zero-cost **Progressive Web App (PWA)** on Android/iOS/Desktop, or build the standalone native **Android APK**.

---

## 🌟 Key Features

- **Google Gemini Multimodal AI**: High-reasoning chat with vision (image analysis) and voice transcription.
- **Offline & Fallback Knowledge**: Built-in instant answers and Wikipedia fallback when offline or without an API key.
- **Progressive Web App (PWA)**: Installable directly to phone or desktop home screen with zero app store fees.
- **Automated Android APK Build**: GitHub Actions CI workflow compiles `vikola-ai-assistant.apk` on every push to `master`.
- **Zero-Cost Deployment**: Pre-configured configs for Render, Vercel, Netlify, and Firebase Hosting.
- **Modern Responsive Interface**: Dark/light theme, math/LaTeX formatting with KaTeX, code block copy buttons, and smooth animations.

---

## 🚀 Quick Start (Local Run)

1. Double-click `run_server.bat` or run:
   ```bash
   python server.py
   ```
2. Open in your browser:
   ```
   http://127.0.0.1:8000
   ```
3. (Optional) Click the **Settings (⚙️)** icon in the top right to configure your Google Gemini API key.

---

## 📱 Mobile Installation & Deployment

Refer to [FREE_DEPLOYMENT_GUIDE.md](FREE_DEPLOYMENT_GUIDE.md) for full instructions:
- **PWA on Android / iOS / Desktop**: Add to Home Screen directly from your browser.
- **GitHub Actions APK Build**: Automated builds under `.github/workflows/build-apk.yml`.
- **Free Web Hosting**: Deploy via Render (`render.yaml`), Vercel (`vercel.json`), or Netlify (`netlify.toml`).

