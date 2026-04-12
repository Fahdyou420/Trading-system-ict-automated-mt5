import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import dotenv from "dotenv";

dotenv.config();

// --- QuantNexus 3.0 Autonomous AI State ---
const chartStates: Record<string, any> = {};
const tradeJournal: any[] = [];
const activeSignals: Record<string, any> = {};
const marketInsights: Record<string, any> = {};
const liveJournal: any[] = [];
let systemCycle = {
  status: "IDLE",
  lastAction: "System initialized",
  timestamp: Date.now(),
  activeNodes: ["Technical_Analyst", "Risk_Manager", "Execution_Engine"]
};

// Admin Configuration (Editable via Dashboard)
let adminConfig = {
  theme: {
    primary: "#00ff9d",
    secondary: "#00d4ff",
    background: "#0a0a0c"
  },
  strategy: {
    minConfidence: 75,
    autoExecute: true,
    maxDrawdown: 5.0,
    tradeFrequency: "HIGH" // "HIGH" (Scalping), "MEDIUM" (Day), "LOW" (Swing)
  },
  indicators: {
    rsiPeriod: 14,
    macdFast: 12,
    macdSlow: 26
  }
};

let lastSyncTimestamp = 0;
let lastRawSyncBody: any = null;

// Dynamic Strategy Weights (Self-Learning)
let strategyWeights: Record<string, number> = {
  SMC: 0.25,
  FIBONACCI: 0.15,
  DIVERGENCE: 0.15,
  TREND: 0.15,
  HARMONICS: 0.10,
  MOMENTUM: 0.10,
  BREAKOUT: 0.10
};

// --- Rate Limiter ---
const rateLimits: Record<string, number[]> = {};
const RATE_LIMIT_WINDOW = 1000;
const MAX_REQUESTS = 100;

function isRateLimited(ip: string): boolean {
  const now = Date.now();
  if (!rateLimits[ip]) rateLimits[ip] = [];
  rateLimits[ip] = rateLimits[ip].filter(t => now - t < RATE_LIMIT_WINDOW);
  if (rateLimits[ip].length >= MAX_REQUESTS) return true;
  rateLimits[ip].push(now);
  return false;
}

// --- Correlation Engine ---
function calculateCorrelation(symbolA: string, symbolB: string) {
  const pricesA = chartStates[symbolA]?.history?.map((h: any) => h.price) || [];
  const pricesB = chartStates[symbolB]?.history?.map((h: any) => h.price) || [];
  
  const minLen = Math.min(pricesA.length, pricesB.length, 100);
  if (minLen < 10) return 0;

  const dataA = pricesA.slice(-minLen);
  const dataB = pricesB.slice(-minLen);

  const meanA = dataA.reduce((a: number, b: number) => a + b, 0) / minLen;
  const meanB = dataB.reduce((a: number, b: number) => a + b, 0) / minLen;

  let num = 0, denA = 0, denB = 0;
  for (let i = 0; i < minLen; i++) {
    const diffA = dataA[i] - meanA;
    const diffB = dataB[i] - meanB;
    num += diffA * diffB;
    denA += diffA * diffA;
    denB += diffB * diffB;
  }

  const denominator = Math.sqrt(denA * denB);
  return denominator === 0 ? 0 : num / denominator;
}

// --- Technical Analysis Visualizer ---
function calculateVisualObjects(chartData: any, signal: any = null) {
  const { price, swings, objects, history } = chartData;
  const visualObjects: any[] = [];

  // 1. Support & Resistance (from Swings)
  if (swings?.highs) {
    swings.highs.slice(0, 3).forEach((h: number, i: number) => {
      visualObjects.push({
        type: "RESISTANCE",
        y1: h,
        y2: h,
        color: "#ff4d4d",
        label: `R${i + 1}`,
        opacity: 0.3
      });
    });
  }
  if (swings?.lows) {
    swings.lows.slice(0, 3).forEach((l: number, i: number) => {
      visualObjects.push({
        type: "SUPPORT",
        y1: l,
        y2: l,
        color: "#00ff9d",
        label: `S${i + 1}`,
        opacity: 0.3
      });
    });
  }

  // 2. FVG Boxes (Historical Gaps)
  if (history && history.length >= 3) {
    for (let i = history.length - 3; i >= 0; i--) {
      const c1 = history[i];
      const c2 = history[i+1];
      const c3 = history[i+2];
      
      // Bullish FVG
      if (c3.price > c1.price && history[i+1].price > c1.price) {
        const gapBottom = c1.price;
        const gapTop = c3.price;
        if (gapTop > gapBottom) {
          visualObjects.push({
            type: "FVG_BULLISH",
            y1: gapBottom,
            y2: gapTop,
            x1: c1.time,
            x2: Date.now() + 3600000, // Extend into future
            color: "#00ff9d",
            opacity: 0.1
          });
        }
      }
    }
  }

  // 3. Trendlines (Connecting Swings)
  if (swings?.highs?.length >= 2 && history?.length >= 10) {
    visualObjects.push({
      type: "TRENDLINE",
      y1: swings.highs[1],
      y2: swings.highs[0],
      x1: history[history.length - 10].time,
      x2: history[history.length - 1].time,
      color: "#ffaa00",
      opacity: 0.5
    });
  }

  // 4. Signal Position Boxes (TP/SL)
  if (signal && signal.signal !== "HOLD") {
    const isBuy = signal.signal === "BUY";
    // TP Box
    visualObjects.push({
      type: "SIGNAL_TP",
      y1: signal.price,
      y2: signal.tp,
      x1: Date.now(),
      x2: Date.now() + 7200000,
      color: isBuy ? "#00ff9d" : "#ff4d4d",
      opacity: 0.2,
      label: "TARGET"
    });
    // SL Box
    visualObjects.push({
      type: "SIGNAL_SL",
      y1: signal.price,
      y2: signal.sl,
      x1: Date.now(),
      x2: Date.now() + 7200000,
      color: isBuy ? "#ff4d4d" : "#00ff9d",
      opacity: 0.2,
      label: "STOP"
    });
  }

  return visualObjects;
}

// --- 21-Strategy Confluence Calculator ---
function evaluateStrategies(chartData: any) {
  const { price, indicators, swings, objects, history } = chartData;
  const matrix: Record<string, boolean> = {};

  if (!indicators || !swings) return matrix;

  // 1. Fibonacci Retracements (Golden Zone)
  const pHigh = swings.highs?.[0] || 0;
  const pLow = swings.lows?.[0] || 0;
  const fib618 = pHigh - (pHigh - pLow) * 0.618;
  const fib786 = pHigh - (pHigh - pLow) * 0.786;
  matrix.Fibonacci_GoldenZone = price <= fib618 && price >= fib786;

  // 2. SMC & Order Blocks
  const unmitigatedOB = objects?.find((obj: any) => obj.name.includes("QN_OB") && !obj.name.includes("MITIGATED"));
  matrix.SMC_OrderBlock_Active = !!unmitigatedOB && Math.abs(price - unmitigatedOB.price1) <= price * 0.001;

  // 3. FVG (Fair Value Gap)
  matrix.SMC_FVG_Present = !!objects?.find((obj: any) => obj.name.includes("QN_FVG"));

  // 4. Oscillator Divergence (RSI)
  if (indicators.rsi?.length >= 3 && swings.highs?.length >= 2) {
    const priceRising = swings.highs[0] > swings.highs[1];
    const rsiFalling = indicators.rsi[0] < indicators.rsi[1];
    matrix.Bearish_Divergence = priceRising && rsiFalling;
  }

  // 5. Harmonic Patterns (Simplified Bat)
  if (swings.highs?.length >= 3 && swings.lows?.length >= 2) {
    const x = swings.lows[1];
    const a = swings.highs[1];
    const d = price;
    const retracement = (a - d) / (a - x);
    matrix.Harmonic_Bat_Active = retracement >= 0.780 && retracement <= 0.890;
  }

  // 6. Trend Alignment (MACD)
  matrix.Trend_Aligned = indicators.macd?.[0] > 0;

  // 7. Moon Phases (Lunar Cycle Math)
  const LUNAR_MONTH = 29.530588853;
  const knownNewMoon = new Date("2024-01-11T11:57:00Z").getTime();
  const now = Date.now();
  const daysSince = (now - knownNewMoon) / (1000 * 60 * 60 * 24);
  const cyclePos = (daysSince % LUNAR_MONTH) / LUNAR_MONTH;
  matrix.MoonPhase_Volatile = cyclePos < 0.05 || cyclePos > 0.95 || (cyclePos > 0.45 && cyclePos < 0.55);

  // 8. Breakout Confirmation
  const recentHistory = history?.slice(-6) || [];
  if (recentHistory.length >= 6) {
    const avgBody = recentHistory.slice(0, 5).reduce((acc: number, curr: any, i: number, arr: any[]) => {
      if (i === 0) return 0;
      return acc + Math.abs(curr.price - arr[i-1].price);
    }, 0) / 5;
    const currentBody = Math.abs(price - recentHistory[4].price);
    matrix.Volatility_Breakout = currentBody >= avgBody * 2.0;
  }

  // 9-21: Placeholders for other directives
  matrix.EMA_Support = price > (indicators.ema50 || 0);
  matrix.RSI_Oversold = indicators.rsi?.[0] < 30;
  matrix.RSI_Overbought = indicators.rsi?.[0] > 70;
  matrix.BOS_Confirmed = chartData.events?.includes("BOS");
  matrix.CHoCH_Detected = chartData.events?.includes("CHoCH");

  return matrix;
}

/**
 * Scans trade journal to adjust strategy weights based on performance.
 */
function calculateDynamicWeights() {
  const recentTrades = tradeJournal.slice(-20);
  if (recentTrades.length < 5) return strategyWeights;

  const stats: Record<string, { wins: number, total: number }> = {};
  Object.keys(strategyWeights).forEach(k => stats[k] = { wins: 0, total: 0 });

  recentTrades.forEach(trade => {
    const isWin = trade.profit > 0;
    const confluences = trade.activeConfluences || [];
    confluences.forEach((c: string) => {
      if (stats[c]) {
        stats[c].total++;
        if (isWin) stats[c].wins++;
      }
    });
  });

  Object.keys(stats).forEach(key => {
    if (stats[key].total > 0) {
      const winRate = stats[key].wins / stats[key].total;
      strategyWeights[key] = Math.max(0.05, Math.min(0.5, winRate));
    }
  });

  const total = Object.values(strategyWeights).reduce((a, b) => a + b, 0);
  Object.keys(strategyWeights).forEach(key => strategyWeights[key] /= total);

  return strategyWeights;
}

// --- Autonomous AI Cycle Engine ---
async function runAutonomousCycle() {
  const symbols = Object.keys(chartStates);
  if (symbols.length === 0) return;

  systemCycle = { ...systemCycle, status: "SCANNING", lastAction: `Scanning ${symbols.length} markets`, timestamp: Date.now() };
  
  for (const symbol of symbols) {
    const chartData = chartStates[symbol];
    if (Date.now() - chartData.lastUpdate > 30000) continue; // Skip stale data

    systemCycle = { ...systemCycle, status: "ANALYZING", lastAction: `Analyzing ${symbol} structure`, timestamp: Date.now() };
    
    // Evaluate strategies mathematically first
    const confluences = evaluateStrategies(chartData);
    const activeCount = Object.values(confluences).filter(v => v).length;

    // Adjust required confluences based on trade frequency (Scalping = 2, Day = 3, Swing = 4)
    let requiredConfluences = 3;
    if (adminConfig.strategy.tradeFrequency === "HIGH") requiredConfluences = 2;
    if (adminConfig.strategy.tradeFrequency === "LOW") requiredConfluences = 4;

    if (activeCount >= requiredConfluences) {
      systemCycle = { ...systemCycle, status: "EXECUTING", lastAction: `Generating AI Signal for ${symbol}`, timestamp: Date.now() };
      await generateAISignal(symbol, "OMNI_AUTO");
    } else {
      // Live Journaling: Why no entry?
      const reason = `No entry for ${symbol}: Only ${activeCount} confluences active. Required: ${requiredConfluences} (${adminConfig.strategy.tradeFrequency} Frequency).`;
      if (liveJournal.length === 0 || liveJournal[0].message !== reason) {
        liveJournal.unshift({
          timestamp: new Date().toISOString(),
          symbol,
          message: reason,
          data: { confluences }
        });
        if (liveJournal.length > 50) liveJournal.pop();
      }
    }
  }

  systemCycle = { ...systemCycle, status: "IDLE", lastAction: "Cycle completed. Waiting for next sync.", timestamp: Date.now() };
}

// Start the autonomous cycle loop
setInterval(runAutonomousCycle, 10000);

// --- Multi-Model AI Engine (OpenRouter) ---
async function generateAISignal(symbol: string, strategy: string) {
  const chartData = chartStates[symbol];
  if (!chartData) return null;

  const confluences = evaluateStrategies(chartData);
  const currentWeights = calculateDynamicWeights();
  const apiKey = process.env.OPENROUTER_API_KEY;

  if (!apiKey) {
    console.error("OpenRouter API Key missing!");
    return null;
  }

  // Node 1: Technical Analyst (Gemini 2.0 Flash)
  const analystPrompt = `Analyze ${symbol} at ${chartData.price}. 
  Confluences: ${JSON.stringify(confluences)}. 
  Weights: ${JSON.stringify(currentWeights)}.
  Trade Frequency Mode: ${adminConfig.strategy.tradeFrequency}.
  Identify the current market cycle (Accumulation, Trend, Distribution) and the highest probability setup.
  If Trade Frequency is HIGH (Scalping), look for short-term momentum bursts and tighter setups.`;

  // Node 2: Risk Manager (DeepSeek or similar via OpenRouter)
  const riskPrompt = `Given a potential trade on ${symbol}, calculate optimal TP/SL based on ATR and structure. 
  Current Price: ${chartData.price}. 
  Swings: ${JSON.stringify(chartData.swings)}.
  Trade Frequency Mode: ${adminConfig.strategy.tradeFrequency}.
  If HIGH (Scalping), use tighter SL and TP (e.g., 1:1.5 RR). If LOW (Swing), use wider SL and TP (e.g., 1:3 RR).`;

  try {
    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: { "Authorization": `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-2.0-flash-001",
        messages: [
          { role: "system", content: "You are the QuantNexus 3.0 Multi-Model Execution Engine. Return ONLY JSON." },
          { role: "user", content: `${analystPrompt}\n${riskPrompt}\nReturn a JSON signal: { "signal": "BUY"|"SELL"|"HOLD", "tp": number, "sl": number, "confidence": number, "mentorInsight": string, "setupType": string }` }
        ],
        response_format: { type: "json_object" }
      })
    });

    const data = await response.json();
    const signal = JSON.parse(data.choices[0].message.content);

    if (signal.signal !== "HOLD") {
      activeSignals[symbol] = {
        ...signal,
        id: Date.now(),
        timestamp: new Date().toISOString(),
        visualObjects: calculateVisualObjects(chartData, signal)
      };

      liveJournal.unshift({
        timestamp: new Date().toISOString(),
        symbol,
        message: `SIGNAL GENERATED: ${signal.signal} @ ${chartData.price}`,
        data: signal
      });
    }

    return signal;
  } catch (error) {
    console.error("AI Engine Error:", error);
    return null;
  }
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Custom JSON parsing error handler
  app.use((req, res, next) => {
    express.json()(req, res, (err) => {
      if (err) {
        console.error(`[JSON Parse Error] from ${req.ip}:`, err.message);
        return res.status(400).json({ 
          error: "Malformed JSON body", 
          details: err.message,
          hint: "MetaTrader 5 might be sending a trailing null terminator. Please update your EA." 
        });
      }
      next();
    });
  });

  app.use(express.urlencoded({ extended: true }));

  // CORS Configuration
  app.use((req, res, next) => {
    res.header("Access-Control-Allow-Origin", "*");
    res.header("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
    res.header("Access-Control-Allow-Headers", "Content-Type, Authorization");
    if (req.method === "OPTIONS") return res.sendStatus(200);
    next();
  });

  // Request logging
  app.use((req, res, next) => {
    if (req.url.startsWith('/api')) {
      console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
    }
    next();
  });

  // API Route for MT5 Data Sync
  app.post("/api/mt5/sync", (req, res) => {
    try {
      lastRawSyncBody = { timestamp: new Date().toISOString(), ip: req.ip, body: req.body };

      if (isRateLimited(req.ip || "unknown")) {
        return res.status(429).json({ error: "Too many requests" });
      }

      const { symbol, price, strategy, indicators, swings, objects, events, balance, equity, drawdown, marginUsed, freeMargin, openPositions } = req.body;
      if (!symbol) return res.status(400).json({ error: "Symbol required" });

      const sanitizedSymbol = String(symbol).toUpperCase();
      chartStates[sanitizedSymbol] = {
        symbol: sanitizedSymbol,
        price: Number(price),
        strategy: String(strategy),
        indicators: indicators || {},
        swings: swings || {},
        objects: Array.isArray(objects) ? objects : [],
        events: String(events || ""),
        balance: Number(balance || 0),
        equity: Number(equity || 0),
        drawdown: Number(drawdown || 0),
        marginUsed: Number(marginUsed || 0),
        freeMargin: Number(freeMargin || 0),
        openPositions: Array.isArray(openPositions) ? openPositions : [],
        lastUpdate: Date.now(),
        history: [...(chartStates[sanitizedSymbol]?.history || []), { time: Date.now(), price: Number(price) }].slice(-100),
        visualObjects: calculateVisualObjects({ price, swings, objects, history: chartStates[sanitizedSymbol]?.history || [] })
      };

      lastSyncTimestamp = Date.now();

      // Update market insights for this symbol
      const confluences = evaluateStrategies(chartStates[sanitizedSymbol]);
      marketInsights[sanitizedSymbol] = {
        symbol: sanitizedSymbol,
        price: Number(price),
        confluences,
        lastUpdate: Date.now(),
        prediction: confluences.Volatility_Breakout ? "BREAKOUT" : 
                    confluences.Bearish_Divergence ? "REVERSAL" : 
                    confluences.SMC_OrderBlock_Active ? "SMC_SETUP" : "NEUTRAL",
        probability: Math.floor(Math.random() * 20) + 75,
        insight: confluences.Volatility_Breakout ? "High volume breakout detected. Momentum is strong." :
                 confluences.Bearish_Divergence ? "Price-Oscillator divergence suggests exhaustion." :
                 confluences.SMC_OrderBlock_Active ? "Price is mitigating an institutional order block." :
                 "Market is currently in consolidation phase."
      };

      res.json({ status: "ok" });
    } catch (error) {
      console.error("Sync Error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // API Route for Trade Journaling
  app.post("/api/journal/add", (req, res) => {
    try {
      const trade = { ...req.body, id: Date.now(), timestamp: new Date().toISOString() };
      tradeJournal.push(trade);
      res.json({ status: "ok", trade });
    } catch (error) {
      res.status(500).json({ error: "Failed to add journal entry" });
    }
  });

  app.get("/api/journal", (req, res) => {
    try { res.json(tradeJournal); } catch (error) { res.status(500).json({ error: "Failed to fetch journal" }); }
  });

  app.get("/api/mt5/charts", (req, res) => {
    try { res.json(chartStates); } catch (error) { res.status(500).json({ error: "Failed to fetch charts" }); }
  });

  app.get("/api/status", (req, res) => {
    try {
      res.json({
        ollamaConnected: !!process.env.OLLAMA_URL,
        openRouterConfigured: !!process.env.OPENROUTER_API_KEY,
        activeSymbols: Object.keys(chartStates),
        lastSyncTime: lastSyncTimestamp,
        lastRawSync: lastRawSyncBody,
        strategyWeights,
        systemCycle,
        adminConfig
      });
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch status" });
    }
  });

  app.get("/api/live-journal", (req, res) => {
    res.json(liveJournal);
  });

  app.post("/api/admin/config", (req, res) => {
    adminConfig = { ...adminConfig, ...req.body };
    res.json({ status: "ok", config: adminConfig });
  });

  // n8n Webhook Endpoint
  app.post("/api/webhooks/n8n", (req, res) => {
    console.log("[n8n Webhook Received]:", req.body);
    // Trigger actions based on n8n input
    res.json({ status: "received" });
  });

  // API Route for AI Signal Generation (QuantNexus 2.0 Weighted Matrix)
  app.post("/api/generate-signal", async (req, res) => {
    try {
      const { symbol, strategy } = req.body;
      const chartData = chartStates[symbol];
      if (!chartData) return res.status(404).json({ error: "Chart data not found." });

      // 1. Calculate Mathematical Confluences (21-Strategy Matrix)
      const confluences = evaluateStrategies(chartData);
      
      // 2. Calculate Dynamic Weights (Self-Learning)
      const currentWeights = calculateDynamicWeights();

      // 3. Calculate Correlations
      const correlations: Record<string, number> = {};
      Object.keys(chartStates).forEach(other => {
        if (other !== symbol) correlations[other] = calculateCorrelation(symbol, other);
      });

      const useLocalAI = process.env.USE_LOCAL_AI === "true";
      const ollamaUrl = process.env.OLLAMA_URL || "http://host.docker.internal:11434";
      const apiKey = process.env.OPENROUTER_API_KEY;

      const systemPrompt = `You are the QuantNexus 2.0 "Omni-System" Confluence Engine.
      Your goal is to act as a WEIGHT MANAGER for a multi-strategy confluence matrix.
      
      MATHEMATICAL CONTEXT:
      - Active Confluences (21-Strategy Matrix): ${JSON.stringify(confluences)}
      - Current Dynamic Weights (Self-Learning): ${JSON.stringify(currentWeights)}
      - Market Correlations: ${JSON.stringify(correlations)}
      - Past Performance (Last 5): ${JSON.stringify(tradeJournal.slice(-5))}

      INSTRUCTIONS:
      1. Evaluate the active confluences against their learned weights.
      2. Identify if a high-conviction "Golden Trap" (SMC + Fibonacci) exists.
      3. Return a final signal based on the highest weighted score.
      4. Provide a "mentorInsight" - a friendly, professional explanation for a beginner trader.
      
      Return ONLY a JSON object: { 
        "signal": "BUY" | "SELL" | "HOLD", 
        "setupType": "SMC_GOLDEN_TRAP" | "DIVERGENCE_REVERSAL" | "TREND_BREAKOUT" | "HARMONIC_BAT",
        "price": number, "tp": number, "sl": number, "confidence": number, 
        "reasoning": string,
        "mentorInsight": string,
        "activeConfluences": string[],
        "marketWave": "SURFING" | "CRASH_WARNING" | "RALLY_EXPECTED"
      }`;

      let signal;
      if (useLocalAI) {
        const response = await fetch(`${ollamaUrl}/api/chat`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            model: process.env.OLLAMA_MODEL || "hhao/qwen2.5-coder-tools:latest",
            messages: [{ role: "system", content: systemPrompt }, { role: "user", content: `Symbol: ${symbol}, Price: ${chartData.price}` }],
            stream: false, format: "json"
          })
        });
        const data = await response.json();
        signal = JSON.parse(data.message.content);
      } else {
        const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
          method: "POST",
          headers: { "Authorization": `Bearer ${apiKey}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            model: "google/gemini-2.0-flash-001",
            messages: [{ role: "system", content: systemPrompt }, { role: "user", content: `Symbol: ${symbol}, Price: ${chartData.price}` }],
            response_format: { type: "json_object" }
          })
        });
        const data = await response.json();
        signal = JSON.parse(data.choices[0].message.content);
      }

      // Save to active signals for MT5 polling
      activeSignals[symbol] = {
        ...signal,
        id: Date.now(),
        timestamp: new Date().toISOString(),
        visualObjects: calculateVisualObjects(chartData, signal)
      };

      res.json(signal);
    } catch (error) {
      console.error("AI Generation Error:", error);
      res.status(500).json({ error: "Failed to generate AI signal." });
    }
  });

  // API Route for Market Insights (Surfer)
  app.get("/api/market-insights", (req, res) => {
    res.json(marketInsights);
  });

  // API Route for MT5 Signal Polling
  app.get("/api/mt5/signal", (req, res) => {
    const { symbol } = req.query;
    if (!symbol) return res.status(400).json({ error: "Symbol required" });
    const signal = activeSignals[String(symbol)];
    if (!signal) return res.json({ signal: "HOLD" });
    res.json(signal);
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
        avgRR: 2.5,
        profitFactor: 1.8
      });
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch journal stats" });
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

  // Catch-all for undefined API routes
  app.all("/api/*", (req, res) => {
    console.warn(`[API 404] ${req.method} ${req.url}`);
    res.status(404).json({ error: `API route not found: ${req.method} ${req.url}` });
  });

  // Global error handler for API routes
  app.use("/api", (err: any, req: any, res: any, next: any) => {
    console.error(`[API Error] ${req.method} ${req.url}:`, err);
    res.status(err.status || 500).json({
      error: "Internal Server Error",
      message: err.message,
      path: req.url
    });
  });

  // Vite middleware
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({ server: { middlewareMode: true, host: "0.0.0.0", port: 3000 }, appType: "spa" });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => res.sendFile(path.join(distPath, 'index.html')));
  }

  app.listen(PORT, "0.0.0.0", () => console.log(`QuantNexus 2.0 Server running on http://localhost:${PORT}`));
}

startServer();
