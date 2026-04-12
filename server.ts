import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import dotenv from "dotenv";

dotenv.config();

// In-memory store for MT5 chart data and journal
const chartStates: Record<string, any> = {};
const tradeJournal: any[] = [];
let lastSyncTimestamp = 0;

// Simple rate limiter
const rateLimits: Record<string, number[]> = {};
const RATE_LIMIT_WINDOW = 1000; // 1 second
const MAX_REQUESTS = 100; // Increased for multiple symbols

let lastRawSyncBody: any = null;

function isRateLimited(ip: string): boolean {
  const now = Date.now();
  if (!rateLimits[ip]) rateLimits[ip] = [];
  rateLimits[ip] = rateLimits[ip].filter(t => now - t < RATE_LIMIT_WINDOW);
  if (rateLimits[ip].length >= MAX_REQUESTS) return true;
  rateLimits[ip].push(now);
  return false;
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // CORS Configuration
  app.use((req, res, next) => {
    res.header("Access-Control-Allow-Origin", "*");
    res.header("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
    res.header("Access-Control-Allow-Headers", "Content-Type, Authorization");
    if (req.method === "OPTIONS") return res.sendStatus(200);
    next();
  });

  // Request logging for debugging
  app.use((req, res, next) => {
    if (req.url.startsWith('/api')) {
      console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
    }
    next();
  });

  // API Route for MT5 Data Sync
  app.post("/api/mt5/sync", (req, res) => {
    try {
      lastRawSyncBody = {
        timestamp: new Date().toISOString(),
        ip: req.ip,
        body: req.body
      };

      if (isRateLimited(req.ip || "unknown")) {
        console.warn(`[Sync Rejected] Rate limited: ${req.ip}`);
        return res.status(429).json({ error: "Too many requests" });
      }

      const { symbol, price, strategy, objects, events, balance, equity, drawdown, marginUsed, freeMargin, openPositions } = req.body;
      
      if (!symbol) {
        console.warn("[Sync Rejected] Missing symbol in body:", req.body);
        return res.status(400).json({ error: "Symbol required" });
      }

      // Sanitize inputs
      const sanitizedSymbol = String(symbol).toUpperCase();
      const sanitizedPrice = Number(price);

      chartStates[sanitizedSymbol] = {
        symbol: sanitizedSymbol,
        price: sanitizedPrice,
        strategy: String(strategy),
        objects: Array.isArray(objects) ? objects : [],
        events: String(events || ""),
        balance: Number(balance || 0),
        equity: Number(equity || 0),
        drawdown: Number(drawdown || 0),
        marginUsed: Number(marginUsed || 0),
        freeMargin: Number(freeMargin || 0),
        openPositions: Array.isArray(openPositions) ? openPositions : [],
        lastUpdate: Date.now(),
        history: [...(chartStates[sanitizedSymbol]?.history || []), { time: Date.now(), price: sanitizedPrice }].slice(-100)
      };

      lastSyncTimestamp = Date.now();
      res.json({ status: "ok" });
    } catch (error) {
      console.error("Sync Error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // API Route for Trade Journaling
  app.post("/api/journal/add", (req, res) => {
    try {
      const trade = {
        ...req.body,
        id: Date.now(),
        timestamp: new Date().toISOString()
      };
      tradeJournal.push(trade);
      res.json({ status: "ok", trade });
    } catch (error) {
      res.status(500).json({ error: "Failed to add journal entry" });
    }
  });

  app.get("/api/journal", (req, res) => {
    try {
      res.json(tradeJournal);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch journal" });
    }
  });

  // API Route to get all active charts
  app.get("/api/mt5/charts", (req, res) => {
    try {
      res.json(chartStates);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch charts" });
    }
  });

  // API Route for Status
  app.get("/api/status", (req, res) => {
    try {
      res.json({
        ollamaConnected: !!process.env.OLLAMA_URL,
        openRouterConfigured: !!process.env.OPENROUTER_API_KEY,
        activeSymbols: Object.keys(chartStates),
        lastSyncTime: lastSyncTimestamp,
        lastRawSync: lastRawSyncBody
      });
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch status" });
    }
  });

  // API Route for Ollama Models
  app.get("/api/ollama/models", async (req, res) => {
    try {
      const ollamaUrl = process.env.OLLAMA_URL || "http://host.docker.internal:11434";
      const response = await fetch(`${ollamaUrl}/api/tags`);
      if (!response.ok) throw new Error("Ollama not reachable");
      const data = await response.json();
      res.json(data);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch Ollama models" });
    }
  });

  // API Route for Journal Stats
  app.get("/api/journal/stats", (req, res) => {
    try {
      const totalTrades = tradeJournal.length;
      const winningTrades = tradeJournal.filter(t => t.profit > 0).length;
      const totalProfit = tradeJournal.reduce((sum, t) => sum + (t.profit || 0), 0);
      const winRate = totalTrades > 0 ? (winningTrades / totalTrades) * 100 : 0;
      
      res.json({
        totalTrades,
        winRate,
        totalProfit,
        avgRR: 2.5, // Placeholder or calculate if data available
        profitFactor: 1.8 // Placeholder or calculate if data available
      });
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch journal stats" });
    }
  });

  // API Route for AI Signal Generation with Self-Learning
  app.post("/api/generate-signal", async (req, res) => {
    try {
      const { symbol, strategy } = req.body;
      const chartData = chartStates[symbol];
      
      if (!chartData) {
        return res.status(404).json({ error: "Chart data not found for symbol." });
      }

      // Get past successes/failures for self-learning
      const recentJournal = tradeJournal.slice(-5).map(t => ({
        result: t.profit > 0 ? "SUCCESS" : "FAILURE",
        reason: t.aiInsight,
        setup: t.setupType
      }));

      const useLocalAI = process.env.USE_LOCAL_AI === "true";
      const ollamaUrl = process.env.OLLAMA_URL || "http://host.docker.internal:11434";
      const apiKey = process.env.OPENROUTER_API_KEY;

      if (!useLocalAI && !apiKey) {
        return res.status(500).json({ error: "Neither OPENROUTER_API_KEY nor Local AI is configured." });
      }

      let signal;
      
      if (useLocalAI) {
        // Local Ollama Logic
        const response = await fetch(`${ollamaUrl}/api/chat`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            model: process.env.OLLAMA_MODEL || "llama3",
            messages: [
              {
                role: "system",
                content: `You are the QuantNexus "Market Surfer" AI. Return ONLY a JSON object: { 
                  "signal": "BUY" | "SELL" | "HOLD", 
                  "setupType": "BREAKOUT" | "REVERSAL" | "SMC_MITIGATION",
                  "price": number, "tp": number, "sl": number, "confidence": number, 
                  "reasoning": string,
                  "marketWave": "SURFING" | "CRASH_WARNING" | "RALLY_EXPECTED"
                }`
              },
              {
                role: "user",
                content: `Symbol: ${symbol}, Price: ${chartData.price}, Strategy: ${strategy}, Objects: ${JSON.stringify(chartData.objects)}`
              }
            ],
            stream: false,
            format: "json"
          })
        });
        const data = await response.json();
        signal = JSON.parse(data.message.content);
      } else {
        // OpenRouter Logic
        const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${apiKey}`,
            "Content-Type": "application/json",
            "HTTP-Referer": process.env.APP_URL || "http://localhost:3000",
            "X-Title": "QuantNexus AI",
          },
          body: JSON.stringify({
            model: "google/gemini-2.0-flash-001",
            messages: [
              {
                role: "system",
                content: `You are the QuantNexus "Market Surfer" AI. Your goal is maximum daily/weekly profit.
                Expertise: Breakout prediction, Reversal detection, Black Swan/Crash protection, and Correlation analysis.
                
                SELF-LEARNING CONTEXT (Past Trades):
                ${JSON.stringify(recentJournal)}

                Analyze the MT5 data and provide a high-conviction signal. 
                Predict if a BIG RISE or MARKET CRASH is imminent.
                Return JSON format: { 
                  "signal": "BUY" | "SELL" | "HOLD", 
                  "setupType": "BREAKOUT" | "REVERSAL" | "SMC_MITIGATION",
                  "price": number, "tp": number, "sl": number, "confidence": number, 
                  "reasoning": string,
                  "marketWave": "SURFING" | "CRASH_WARNING" | "RALLY_EXPECTED"
                }`
              },
              {
                role: "user",
                content: `Symbol: ${symbol}
                Current Price: ${chartData.price}
                Strategy: ${strategy}
                MT5 Objects: ${JSON.stringify(chartData.objects)}
                Price History: ${JSON.stringify(chartData.history.map((h: any) => h.price))}`
              }
            ],
            response_format: { type: "json_object" }
          })
        });
        const data = await response.json();
        signal = JSON.parse(data.choices[0].message.content);
      }

      res.json(signal);
    } catch (error) {
      console.error("AI Generation Error:", error);
      res.status(500).json({ error: "Failed to generate AI signal." });
    }
  });

  // API Route for Post-Trade AI Insight
  app.post("/api/journal/analyze", async (req, res) => {
    try {
      const { tradeId } = req.body;
      const trade = tradeJournal.find(t => t.id === tradeId);
      if (!trade) return res.status(404).json({ error: "Trade not found" });

      const apiKey = process.env.OPENROUTER_API_KEY;
      const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
        method: "POST",
        headers: { "Authorization": `Bearer ${apiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "google/gemini-2.0-flash-001",
          messages: [{
            role: "system",
            content: "Analyze this completed trade. Why did it succeed or fail? Provide 1 sentence of 'Self-Learning' advice for the next trade."
          }, {
            role: "user",
            content: JSON.stringify(trade)
          }]
        })
      });
      const data = await response.json();
      trade.aiInsight = data.choices[0].message.content;
      res.json({ status: "ok", insight: trade.aiInsight });
    } catch (error) {
      res.status(500).json({ error: "AI Analysis failed" });
    }
  });

  // Catch-all for undefined API routes to prevent falling through to SPA fallback
  app.all("/api/*", (req, res) => {
    console.warn(`[API 404] ${req.method} ${req.url}`);
    res.status(404).json({ error: `API route not found: ${req.method} ${req.url}` });
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { 
        middlewareMode: true,
        host: "0.0.0.0",
        port: 3000
      },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
