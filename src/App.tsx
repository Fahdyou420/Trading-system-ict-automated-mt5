import React, { useState, useEffect } from 'react';
import { 
  TrendingUp, 
  Shield, 
  Activity, 
  Layers, 
  BarChart3, 
  Zap, 
  Target, 
  AlertCircle,
  ChevronRight,
  RefreshCw,
  Download,
  Terminal,
  Cpu,
  Waves,
  ShieldAlert
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  AreaChart, 
  Area, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  LineChart,
  Line
} from 'recharts';
import { cn } from '@/src/lib/utils';

// --- Mock Data ---
const PERFORMANCE_DATA = [
  { time: '09:00', equity: 100000, drawdown: 0 },
  { time: '10:00', equity: 100500, drawdown: 0.2 },
  { time: '11:00', equity: 101200, drawdown: 0.1 },
  { time: '12:00', equity: 100800, drawdown: 0.5 },
  { time: '13:00', equity: 102500, drawdown: 0.3 },
  { time: '14:00', equity: 104000, drawdown: 0.1 },
  { time: '15:00', equity: 103800, drawdown: 0.4 },
  { time: '16:00', equity: 105200, drawdown: 0.2 },
];

const ACTIVE_SETUPS = [
  { id: 1, pair: 'EURUSD', type: 'LONG', zone: '1.08450', status: 'Monitoring', confluence: 85 },
  { id: 2, pair: 'GBPUSD', type: 'SHORT', zone: '1.26700', status: 'Pending', confluence: 72 },
  { id: 3, pair: 'XAUUSD', type: 'LONG', zone: '2155.20', status: 'Executing', confluence: 94 },
];

// --- Components ---

const MarketWatchItem = ({ item }: any) => (
  <div className="flex items-center justify-between p-3 border-b border-brand-border last:border-0 hover:bg-white/5 transition-colors">
    <div className="flex flex-col">
      <span className="font-display font-bold text-sm">{item.pair}</span>
      <span className="text-[10px] text-gray-500 font-mono">{item.price}</span>
    </div>
    <div className={cn(
      "text-xs font-bold px-2 py-1 rounded",
      item.trend === 'up' ? "text-green-400 bg-green-400/10" : "text-red-400 bg-red-400/10"
    )}>
      {item.change}
    </div>
  </div>
);

const StatCard = ({ title, value, subValue, icon: Icon, trend }: any) => (
  <div className="glass-panel p-5 flex flex-col gap-3">
    <div className="flex justify-between items-start">
      <div className="p-2 bg-brand-bg rounded-lg border border-brand-border">
        <Icon className="w-5 h-5 text-brand-primary" />
      </div>
      {trend && (
        <span className={cn(
          "text-xs font-medium px-2 py-1 rounded-full",
          trend > 0 ? "bg-green-500/10 text-green-400" : "bg-red-500/10 text-red-400"
        )}>
          {trend > 0 ? '+' : ''}{trend}%
        </span>
      )}
    </div>
    <div>
      <p className="text-gray-400 text-sm font-medium">{title}</p>
      <h3 className="text-2xl font-display font-bold mt-1">{value}</h3>
      <p className="text-xs text-gray-500 mt-1">{subValue}</p>
    </div>
  </div>
);

const SetupRow = ({ setup }: any) => (
  <div className="flex items-center justify-between p-4 border-b border-brand-border last:border-0 hover:bg-white/5 transition-colors group">
    <div className="flex items-center gap-4">
      <div className={cn(
        "w-2 h-10 rounded-full",
        setup.type === 'LONG' ? "bg-brand-primary" : "bg-red-500"
      )} />
      <div>
        <h4 className="font-display font-bold text-lg">{setup.pair}</h4>
        <span className={cn(
          "text-[10px] font-bold tracking-widest uppercase",
          setup.type === 'LONG' ? "text-brand-primary" : "text-red-400"
        )}>
          {setup.type} @ {setup.zone}
        </span>
      </div>
    </div>
    
    <div className="flex items-center gap-8">
      <div className="text-right">
        <p className="text-xs text-gray-500 uppercase tracking-tighter">Confluence</p>
        <div className="flex items-center gap-2">
          <div className="w-24 h-1.5 bg-brand-bg rounded-full overflow-hidden">
            <motion.div 
              initial={{ width: 0 }}
              animate={{ width: `${setup.confluence}%` }}
              className="h-full bg-brand-secondary"
            />
          </div>
          <span className="text-xs font-mono">{setup.confluence}%</span>
        </div>
      </div>
      
      <div className="flex items-center gap-3">
        <span className={cn(
          "px-3 py-1 rounded-md text-[10px] font-bold border",
          setup.status === 'Executing' ? "bg-brand-primary/10 border-brand-primary text-brand-primary animate-pulse" : "bg-brand-bg border-brand-border text-gray-400"
        )}>
          {setup.status}
        </span>
        <ChevronRight className="w-4 h-4 text-gray-600 group-hover:text-brand-primary transition-colors" />
      </div>
    </div>
  </div>
);

export default function App() {
  const [isSyncing, setIsSyncing] = useState(false);
  const [activeStrategy, setActiveStrategy] = useState('SMC');
  const [aiSignal, setAiSignal] = useState<any>(null);
  const [isGeneratingSignal, setIsGeneratingSignal] = useState(false);
  const [activeCharts, setActiveCharts] = useState<any>({});
  const [selectedSymbol, setSelectedSymbol] = useState<string>('');
  const [journal, setJournal] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState<'DASHBOARD' | 'JOURNAL' | 'SURFER'>('DASHBOARD');

  useEffect(() => {
    const interval = setInterval(async () => {
      try {
        const response = await fetch('/api/mt5/charts');
        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(`HTTP ${response.status}: ${errorText.substring(0, 100)}`);
        }
        const data = await response.json();
        setActiveCharts(data);
        if (!selectedSymbol && Object.keys(data).length > 0) {
          setSelectedSymbol(Object.keys(data)[0]);
        }
      } catch (error) {
        console.error('Fetch Charts Error:', error);
      }
    }, 1000);
    return () => clearInterval(interval);
  }, [selectedSymbol]);

  useEffect(() => {
    const fetchJournal = async () => {
      const res = await fetch('/api/journal');
      const data = await res.json();
      setJournal(data);
    };
    fetchJournal();
  }, [activeTab]);

  const handleSync = () => {
    setIsSyncing(true);
    setTimeout(() => setIsSyncing(false), 2000);
  };

  const generateAiSignal = async () => {
    if (!selectedSymbol) return;
    setIsGeneratingSignal(true);
    try {
      const response = await fetch('/api/generate-signal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          symbol: selectedSymbol,
          strategy: activeStrategy
        })
      });
      const data = await response.json();
      setAiSignal(data);
    } catch (error) {
      console.error('Signal Error:', error);
    } finally {
      setIsGeneratingSignal(false);
    }
  };

  const currentChart = activeCharts[selectedSymbol] || { history: [], objects: [] };

  return (
    <div className="min-h-screen flex flex-col">
      {/* Navigation */}
      <nav className="h-16 border-b border-brand-border flex items-center justify-between px-8 sticky top-0 bg-brand-bg/80 backdrop-blur-xl z-50">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-brand-primary rounded-lg flex items-center justify-center shadow-[0_0_20px_rgba(0,255,157,0.4)]">
            <Zap className="w-5 h-5 text-brand-bg fill-brand-bg" />
          </div>
          <h1 className="font-display font-bold text-xl tracking-tight glow-text">
            Quant<span className="text-brand-primary">Nexus</span>
          </h1>
          <div className="h-4 w-[1px] bg-brand-border mx-2" />
          <div className="flex gap-4">
            {['DASHBOARD', 'JOURNAL', 'SURFER'].map(tab => (
              <button 
                key={tab}
                onClick={() => setActiveTab(tab as any)}
                className={cn(
                  "text-[10px] font-bold tracking-widest transition-colors",
                  activeTab === tab ? "text-brand-primary" : "text-gray-500 hover:text-gray-300"
                )}
              >
                {tab}
              </button>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-6">
          <select 
            value={selectedSymbol} 
            onChange={(e) => setSelectedSymbol(e.target.value)}
            className="bg-brand-bg border border-brand-border text-xs font-mono text-brand-primary px-3 py-1 rounded outline-none"
          >
            {Object.keys(activeCharts).map(s => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
          <button onClick={handleSync} className="p-2 hover:bg-white/5 rounded-lg transition-colors">
            <RefreshCw className={cn("w-5 h-5 text-gray-400", isSyncing && "animate-spin text-brand-primary")} />
          </button>
        </div>
      </nav>

      <main className="flex-1 p-8 max-w-7xl mx-auto w-full">
        {activeTab === 'DASHBOARD' && (
          <div className="grid grid-cols-12 gap-6">
            {/* Top Stats */}
            <div className="col-span-12 grid grid-cols-1 md:grid-cols-4 gap-6">
              <StatCard title="Account Balance" value={`$${(currentChart.price * 100000 || 105240).toLocaleString()}`} subValue={`Active Symbol: ${selectedSymbol}`} icon={TrendingUp} trend={5.24} />
              <StatCard title="Current Price" value={currentChart.price || '0.00000'} subValue="Real-time MT5 Feed" icon={Activity} trend={0.1} />
              <StatCard title="Market Wave" value={aiSignal?.marketWave || 'SURFING'} subValue="AI Sentiment Analysis" icon={Waves} />
              <StatCard title="Win Rate" value="68.4%" subValue="Last 30 Days" icon={Target} />
            </div>

            {/* Main Chart */}
            <div className="col-span-12 lg:col-span-8 flex flex-col gap-6">
              <div className="glass-panel p-6 flex-1 flex flex-col min-h-[450px] relative overflow-hidden">
                <div className="flex justify-between items-center mb-8 z-10">
                  <div>
                    <h3 className="font-display font-bold text-lg">{selectedSymbol} Live Feed</h3>
                    <p className="text-xs text-gray-500">Mirrored MT5 Visuals & Objects</p>
                  </div>
                  {aiSignal?.marketWave === 'CRASH_WARNING' && (
                    <div className="px-3 py-1 bg-red-500/20 border border-red-500 text-red-500 text-[10px] font-bold rounded animate-pulse">
                      CRASH WARNING
                    </div>
                  )}
                </div>
                <div className="flex-1 w-full h-full min-h-[350px] relative">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={currentChart.history}>
                      <defs>
                        <linearGradient id="colorPrice" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#00ff9d" stopOpacity={0.2}/>
                          <stop offset="95%" stopColor="#00ff9d" stopOpacity={0}/>
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="#222226" vertical={false} />
                      <XAxis dataKey="time" hide />
                      <YAxis stroke="#444" fontSize={10} tickLine={false} axisLine={false} domain={['auto', 'auto']} />
                      <Tooltip contentStyle={{ backgroundColor: '#141417', border: '1px solid #222226', borderRadius: '8px' }} itemStyle={{ color: '#00ff9d' }} labelFormatter={(v) => new Date(v).toLocaleTimeString()} />
                      <Area type="monotone" dataKey="price" stroke="#00ff9d" strokeWidth={2} fillOpacity={1} fill="url(#colorPrice)" isAnimationActive={false} />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>

            {/* AI Signal Sidebar */}
            <div className="col-span-12 lg:col-span-4 flex flex-col gap-6">
              <div className="glass-panel p-6 border-brand-secondary/30 bg-brand-secondary/5">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-display font-bold text-lg flex items-center gap-2">
                    <Cpu className="w-5 h-5 text-brand-secondary" />
                    Market Surfer AI
                  </h3>
                  <div className="px-2 py-0.5 bg-brand-secondary/20 text-brand-secondary text-[10px] font-bold rounded uppercase">
                    {aiSignal?.setupType || 'Analyzing'}
                  </div>
                </div>

                <AnimatePresence mode="wait">
                  {aiSignal ? (
                    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
                      <div className="flex justify-between items-center">
                        <span className={cn("text-2xl font-display font-bold", aiSignal.signal === 'BUY' ? "text-brand-primary" : "text-red-400")}>
                          {aiSignal.signal}
                        </span>
                        <div className="text-right">
                          <p className="text-[10px] text-gray-500 uppercase tracking-widest">Confidence</p>
                          <p className="text-sm font-mono text-brand-primary">{aiSignal.confidence}%</p>
                        </div>
                      </div>
                      <div className="p-3 bg-brand-bg rounded border border-brand-border">
                        <p className="text-[10px] text-gray-400 leading-relaxed">
                          <span className="text-brand-secondary font-bold uppercase mr-2">AI Insight:</span>
                          {aiSignal.reasoning}
                        </p>
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div className="p-2 bg-brand-bg rounded border border-brand-border text-center">
                          <p className="text-[8px] text-gray-500 uppercase">Target</p>
                          <p className="text-xs font-mono text-green-400">{aiSignal.tp}</p>
                        </div>
                        <div className="p-2 bg-brand-bg rounded border border-brand-border text-center">
                          <p className="text-[8px] text-gray-500 uppercase">Stop Loss</p>
                          <p className="text-xs font-mono text-red-400">{aiSignal.sl}</p>
                        </div>
                      </div>
                      <button onClick={() => setAiSignal(null)} className="w-full py-2 text-[10px] font-bold text-gray-500 hover:text-gray-300 transition-colors">
                        DISMISS SIGNAL
                      </button>
                    </motion.div>
                  ) : (
                    <div className="flex flex-col gap-4 py-8 items-center text-center">
                      <div className="p-4 bg-brand-bg rounded-full border border-brand-border">
                        <RefreshCw className={cn("w-8 h-8 text-brand-secondary/40", isGeneratingSignal && "animate-spin text-brand-secondary")} />
                      </div>
                      <button onClick={generateAiSignal} disabled={isGeneratingSignal} className="w-full py-3 bg-brand-secondary text-brand-bg font-display font-bold rounded-xl shadow-[0_0_20px_rgba(0,212,255,0.2)] hover:shadow-[0_0_30px_rgba(0,212,255,0.4)] transition-all">
                        {isGeneratingSignal ? 'SURFING MARKET...' : 'SURF FOR SIGNALS'}
                      </button>
                    </div>
                  )}
                </AnimatePresence>
              </div>

              <div className="glass-panel p-6">
                <h3 className="font-display font-bold text-sm mb-4 flex items-center gap-2">
                  <Terminal className="w-4 h-4 text-brand-primary" />
                  Strategy Watchdog
                </h3>
                <div className="space-y-3">
                  <div className="flex justify-between items-center text-[10px]">
                    <span className="text-gray-500">Correlation (XAU/USD)</span>
                    <span className="text-red-400">-0.84 (Inverted)</span>
                  </div>
                  <div className="flex justify-between items-center text-[10px]">
                    <span className="text-gray-500">Volatility Index</span>
                    <span className="text-brand-primary">High (Surfing Ready)</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'JOURNAL' && (
          <div className="glass-panel p-8">
            <div className="flex justify-between items-center mb-8">
              <h3 className="font-display font-bold text-2xl">Trade Journal & Self-Learning</h3>
              <div className="flex gap-4">
                <div className="text-right">
                  <p className="text-[10px] text-gray-500 uppercase">Total Profit</p>
                  <p className="text-xl font-mono text-brand-primary">+$12,450.00</p>
                </div>
              </div>
            </div>
            <div className="space-y-4">
              {journal.map((trade, idx) => (
                <div key={idx} className="p-4 bg-brand-bg border border-brand-border rounded-xl flex flex-col gap-3">
                  <div className="flex justify-between items-center">
                    <div className="flex items-center gap-4">
                      <span className={cn("px-2 py-0.5 rounded text-[10px] font-bold", trade.profit > 0 ? "bg-green-500/10 text-green-400" : "bg-red-500/10 text-red-400")}>
                        {trade.profit > 0 ? 'WIN' : 'LOSS'}
                      </span>
                      <span className="text-sm font-bold">{trade.symbol}</span>
                      <span className="text-xs text-gray-500">{trade.timestamp}</span>
                    </div>
                    <span className={cn("font-mono font-bold", trade.profit > 0 ? "text-green-400" : "text-red-400")}>
                      {trade.profit > 0 ? '+' : ''}{trade.profit}
                    </span>
                  </div>
                  <div className="p-3 bg-white/5 rounded-lg border border-white/5">
                    <p className="text-[10px] text-gray-400 italic leading-relaxed">
                      <span className="text-brand-secondary font-bold uppercase mr-2">AI Post-Analysis:</span>
                      {trade.aiInsight || "Analyzing trade performance..."}
                    </p>
                  </div>
                </div>
              ))}
              {journal.length === 0 && (
                <div className="py-20 text-center text-gray-500 italic">
                  No trades recorded yet. Start surfing to build your journal.
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === 'SURFER' && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="glass-panel p-6 border-brand-primary/30">
              <h3 className="font-display font-bold text-lg mb-4 flex items-center gap-2">
                <Zap className="w-5 h-5 text-brand-primary" />
                Breakout Predictions
              </h3>
              <div className="space-y-4">
                <div className="p-3 bg-brand-bg border border-brand-border rounded-lg">
                  <div className="flex justify-between mb-2">
                    <span className="text-xs font-bold">XAUUSD</span>
                    <span className="text-[10px] text-brand-primary font-bold">88% PROB</span>
                  </div>
                  <p className="text-[10px] text-gray-500">Consolidation near resistance. Expecting high-volume breakout in next 4H.</p>
                </div>
              </div>
            </div>
            <div className="glass-panel p-6 border-brand-secondary/30">
              <h3 className="font-display font-bold text-lg mb-4 flex items-center gap-2">
                <RefreshCw className="w-5 h-5 text-brand-secondary" />
                Reversal Alerts
              </h3>
              <div className="space-y-4">
                <div className="p-3 bg-brand-bg border border-brand-border rounded-lg">
                  <div className="flex justify-between mb-2">
                    <span className="text-xs font-bold">EURUSD</span>
                    <span className="text-[10px] text-brand-secondary font-bold">72% PROB</span>
                  </div>
                  <p className="text-[10px] text-gray-500">Overextended rally hitting institutional supply zone. Divergence forming.</p>
                </div>
              </div>
            </div>
            <div className="glass-panel p-6 border-red-500/30">
              <h3 className="font-display font-bold text-lg mb-4 flex items-center gap-2">
                <ShieldAlert className="w-5 h-5 text-red-500" />
                Crash/Rise Watchdog
              </h3>
              <div className="p-4 bg-red-500/5 border border-red-500/20 rounded-xl">
                <p className="text-xs font-bold text-red-400 mb-2">System Status: ALERT</p>
                <p className="text-[10px] text-gray-400 leading-relaxed">
                  Monitoring global liquidity flows. No immediate crash detected, but volatility is spiking in JPY pairs.
                </p>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
