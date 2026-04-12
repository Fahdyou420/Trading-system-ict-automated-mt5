import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import dotenv from "dotenv";

dotenv.config();

// In-memory store for MT5 chart data and journal
const chartStates: Record<string, any> = {};
const tradeJournal: any[] = [];

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // Request logging for debugging
  app.use((req, res, next) => {
    if (req.url.startsWith('/api')) {
      console.log(`[API Request] ${req.method} ${req.url}`);
    }
    next();
  });

  // API Route for MT5 Data Sync
  app.post("/api/mt5/sync", (req, res) => {
    const { symbol, price, strategy, objects, events } = req.body;
    if (!symbol) return res.status(400).json({ error: "Symbol required" });

    chartStates[symbol] = {
      symbol,
      price,
      strategy,
      objects,
      events: events || [],
      lastUpdate: Date.now(),
      history: [...(chartStates[symbol]?.history || []), { time: Date.now(), price }].slice(-100)
    };

    res.json({ status: "ok" });
  });

  // API Route for Trade Journaling
  app.post("/api/journal/add", (req, res) => {
    const trade = {
      ...req.body,
      id: Date.now(),
      timestamp: new Date().toISOString()
    };
    tradeJournal.push(trade);
    res.json({ status: "ok", trade });
  });

  app.get("/api/journal", (req, res) => {
    res.json(tradeJournal);
  });

  // API Route to get all active charts
  app.get("/api/mt5/charts", (req, res) => {
    res.json(chartStates);
  });

  // API Route for AI Signal Generation with Self-Learning
  app.post("/api/generate-signal", async (req, res) => {
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

    try {
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
    const { tradeId } = req.body;
    const trade = tradeJournal.find(t => t.id === tradeId);
    if (!trade) return res.status(404).json({ error: "Trade not found" });

    const apiKey = process.env.OPENROUTER_API_KEY;
    try {
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
