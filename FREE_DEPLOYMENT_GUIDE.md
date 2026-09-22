# Vikola AI - 100% Free Mobile App & Zero-Cost Deployment Guide

Vikola has been converted into a **Progressive Web App (PWA)** that can be installed on Android, iOS, Windows, and macOS as a native standalone app — with **zero Google Play ($25) or Apple Developer ($99/yr) fees**.

---

## 📱 How Users Download & Install the App

### 1. On Android (Google Chrome, Edge, Samsung Internet)
1. Open the website URL in mobile Chrome.
2. Tap the **"Install App"** button at the top or in the **Bottom Navigation Bar** (or the browser banner).
3. Tap **"Install"** in the browser prompt.
4. **Result:** Vikola is installed as a native app on the Home Screen and in the App Drawer. It opens in fullscreen standalone mode (no browser address bar), caches assets for instant offline load, and acts like a native APK.

### 2. On iOS (iPhone / iPad - Safari)
1. Open the website URL in mobile Safari.
2. Tap the **Install** button in the bottom navigation bar (or tap the **Share button** `⎙` / `⎋` at the bottom of Safari).
3. Scroll down and tap **"Add to Home Screen"** `➕`.
4. Tap **"Add"** in the upper right.
5. **Result:** An app icon is added to the iPhone Home Screen that launches Vikola in fullscreen standalone mode.

### 3. On Desktop (Chrome, Edge, Brave)
1. Click the **"Install App"** button in the top navigation bar (or the install icon in the browser address bar).
2. The app installs into your OS Applications menu and runs in its own native desktop window.

---

## 🚀 100% Free Hosting Deployment (Zero Cost)

The repository is pre-configured with `vercel.json`, `netlify.toml`, and `firebase.json`.

### Option A: Deploy to Vercel (Recommended - 100% Free)
1. Create a free account on [vercel.com](https://vercel.com).
2. Install Vercel CLI (optional) or connect your GitHub repository:
   ```bash
   npx vercel
   ```
3. Vercel automatically detects `vercel.json`, configures the edge CDN, enables SSL/HTTPS, and routes all PWA manifest and service worker headers.

### Option B: Deploy to Netlify (100% Free)
1. Create a free account on [netlify.com](https://netlify.com).
2. Drag and drop this project folder into Netlify Drop, or connect via Git:
   ```bash
   npx netlify deploy --prod
   ```
3. Netlify automatically reads `netlify.toml` and activates PWA caching with free HTTPS.

### Option C: Deploy to Firebase Hosting Spark Plan (100% Free)
1. Install Firebase tools:
   ```bash
   npm install -g firebase-tools
   firebase login
   firebase init hosting
   firebase deploy
   ```
2. The provided `firebase.json` handles rewrites and caching headers.

### Option D: Keep Running Locally / On Render
- Run locally with `run_server.bat` or `python server.py`.
- Or deploy backend on Render using the included `render.yaml` free tier web service.

---

## 🤖 Free AI Engine Configuration
- Vikola runs in **Free AI Mode** out of the box with offline knowledge capabilities.
- To enable Google Gemini multimodal reasoning, users can connect their free Google Gemini API key via **Settings (⚙️)** in the app. The key is securely preserved directly in the browser/PWA storage.
