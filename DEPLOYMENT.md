# QuantNexus AI Trading Bot - Local Deployment Guide

This guide will walk you through deploying the **QuantNexus AI "Market Surfer"** on your local Windows 11 machine.

## 🖥️ System Requirements (Your Setup)
- **CPU**: Intel Core i5-12400F
- **GPU**: NVIDIA GeForce RTX 4060 (8GB) - *Perfect for local AI!*
- **RAM**: 16GB DDR4
- **OS**: Windows 11
- **Network**: LAN with No-IP for mobile access

---

## 🚀 Step 1: Prerequisites
Ensure you have the following installed on your Windows 11 PC:
1. **Docker Desktop**: [Download here](https://www.docker.com/products/docker-desktop/)
2. **MetaTrader 5 (MT5)**: Installed and logged into your broker.
3. **No-IP DUC**: Already installed (as per your setup) to keep your dynamic IP synced.

---

## ⚙️ Step 2: Environment Configuration
1. Create a `.env` file in the root directory (copy from `.env.example`).
2. Add your **OpenRouter API Key** (for Gemini 2.0 Flash).
3. Set your **APP_URL** to your No-IP address (e.g., `http://yourname.no-ip.org:3000`).

```env
OPENROUTER_API_KEY=your_key_here
APP_URL=http://yourname.no-ip.org:3000
```

---

## 🐳 Step 3: Launching with Docker
Open PowerShell or CMD in the project folder and run:

```bash
# Build and start the container
docker-compose up -d --build
```

The dashboard will now be accessible at `http://localhost:3000`.

---

## 📈 Step 4: MetaTrader 5 Integration
1. Open MT5.
2. Go to **Tools > Options > Expert Advisors**.
3. Check **"Allow WebRequest for listed URL"** and add:
   - `http://localhost:3000`
   - `http://127.0.0.1:3000`
   - **CRITICAL**: If you don't add these, the EA will fail to sync!
4. Copy `mql5/QuantNexus_SMC.mq5` to your MT5 `MQL5/Experts` folder.
5. Compile and attach the EA to any chart (e.g., XAUUSD or EURUSD).
6. Set the `InpServerURL` input to `http://localhost:3000`.
7. Check the **Experts** tab in MT5. You should see "Sync OK" every minute.

---

## 📱 Step 5: Mobile Access (No-IP & Port Forwarding)
To access the dashboard from your phone while away:
1. **Router Settings**: Log into your router and forward **Port 3000** to your PC's local IP (e.g., `192.168.1.50`).
2. **Firewall**: Ensure Windows Firewall allows inbound traffic on Port 3000.
3. **Access**: Open `http://yourname.no-ip.org:3000` on your mobile browser.

---

## 🤖 Step 6: Using Local AI (Ollama / LM Studio)
Since you have an **RTX 4060**, you can run models locally to save on API costs!

### Using Ollama (Docker-to-Docker):
Since Ollama is also in Docker, you have two options for connection:

1.  **Option A: host.docker.internal (Easiest)**
    - Set `USE_LOCAL_AI=true`
    - Set `OLLAMA_URL=http://host.docker.internal:11434`
    - This allows the QuantNexus container to reach the Ollama service via your Windows host.

2.  **Option B: Docker Network (Recommended)**
    - Add both containers to the same Docker network.
    - Set `OLLAMA_URL=http://ollama:11434` (replace `ollama` with your Ollama container name).

### Using LM Studio:
1. Load a model in LM Studio.
2. Start the **Local Inference Server** (usually on port 1234).
3. LM Studio provides an OpenAI-compatible API, so you just need to change the `baseURL` in your code.

---

## 🔗 Step 7: n8n Integration (Optional)
Since you have **n8n** running in Docker, you can create powerful workflows:
- **Alerts**: Send signals from QuantNexus to Telegram/Discord via n8n.
- **Data Logging**: Pipe your trade journal to Google Sheets or a local database.
- **Webhook**: Use the `POST /api/journal/add` endpoint as a trigger in n8n.

---

## 🛠️ Troubleshooting
- **WebRequest Error 4014**: This means MT5 is blocking the request. Go to **Tools > Options > Expert Advisors** and ensure `http://localhost:3000` is in the list.
- **Empty Dashboard**: If `http://localhost:3000/api/status` shows `lastRawSync: null`, the server hasn't received anything. Check the MT5 **Experts** tab for errors.
- **Docker Networking**: If MT5 is on the host and QuantNexus is in Docker, `localhost:3000` should work. If not, try using your PC's local IP (e.g., `192.168.1.50:3000`).
- **Rate Limiting**: If you have many charts open, the server might block requests. I've increased the limit to 100 req/sec, which should be plenty.

---
*Happy Surfing! 🌊*
