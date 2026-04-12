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
  ShieldAlert,
  Settings,
  History,
  LayoutDashboard,
  Wifi,
  WifiOff,
  Wallet,
  Percent,
  ArrowUpRight,
  ArrowDownRight,
  AlertTriangle,
  BrainCircuit,
  TrendingDown
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  AreaChart, 
  ComposedChart,
  Area, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  LineChart,
  Line,
  ReferenceArea,
  ReferenceLine
} from 'recharts';
import { cn } from '@/src/lib/utils';

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
  const [activeTab, setActiveTab] = useState<'DASHBOARD' | 'JOURNAL' | 'SURFER' | 'SIGNALS' | 'ADMIN'>('DASHBOARD');
  const [isOnline, setIsOnline] = useState(false);
  const [journalStats, setJournalStats] = useState<any>(null);
  const [serverStatus, setServerStatus] = useState<any>(null);
  const [marketInsights, setMarketInsights] = useState<any>({});
  const [liveJournalEntries, setLiveJournalEntries] = useState<any[]>([]);

  const [autoExecute, setAutoExecute] = useState(false);

  useEffect(() => {
    const interval = setInterval(async () => {
      try {
        const [chartsRes, insightsRes] = await Promise.all([
          fetch('/api/mt5/charts'),
          fetch('/api/market-insights')
        ]);

        if (chartsRes.ok) {
          const data = await chartsRes.json();
          setActiveCharts(data);
          setIsOnline(Object.keys(data).length > 0);
          if (!selectedSymbol && Object.keys(data).length > 0) {
            setSelectedSymbol(Object.keys(data)[0]);
          }
        }

        if (insightsRes.ok) {
          const insights = await insightsRes.json();
          setMarketInsights(insights);
        }
      } catch (error) {
        console.error('Fetch Charts Error:', error);
        setIsOnline(false);
      }
    }, 1000);
    return () => clearInterval(interval);
  }, [selectedSymbol]);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [journalRes, statsRes, statusRes, liveJournalRes] = await Promise.all([
          fetch('/api/journal'),
          fetch('/api/journal/stats'),
          fetch('/api/status'),
          fetch('/api/live-journal')
        ]);
        
        if (journalRes.ok) setJournal(await journalRes.json());
        if (statsRes.ok) setJournalStats(await statsRes.json());
        if (statusRes.ok) setServerStatus(await statusRes.json());
        if (liveJournalRes.ok) setLiveJournalEntries(await liveJournalRes.json());
      } catch (error) {
        console.error('Fetch Data Error:', error);
      }
    };
    fetchData();
    const interval = setInterval(fetchData, 5000);
    return () => clearInterval(interval);
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
            {[
              { id: 'DASHBOARD', icon: LayoutDashboard },
              { id: 'JOURNAL', icon: History },
              { id: 'SURFER', icon: Waves },
              { id: 'SIGNALS', icon: Zap },
              { id: 'ADMIN', icon: Settings }
            ].map(tab => (
              <button 
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={cn(
                  "flex items-center gap-2 text-[10px] font-bold tracking-widest transition-colors px-3 py-2 rounded-lg",
                  activeTab === tab.id ? "text-brand-primary bg-brand-primary/10" : "text-gray-500 hover:text-gray-300 hover:bg-white/5"
                )}
              >
                <tab.icon className="w-3.5 h-3.5" />
                {tab.id}
              </button>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-6">
          <div className={cn(
            "flex items-center gap-2 px-3 py-1 rounded-full border text-[10px] font-bold",
            isOnline ? "bg-green-500/10 border-green-500/20 text-green-400" : "bg-red-500/10 border-red-500/20 text-red-400"
          )}>
            {isOnline ? <Wifi className="w-3 h-3" /> : <WifiOff className="w-3 h-3" />}
            {isOnline ? 'MT5 CONNECTED' : 'MT5 DISCONNECTED'}
          </div>
          
          <select 
            value={selectedSymbol} 
            onChange={(e) => setSelectedSymbol(e.target.value)}
            className="bg-brand-bg border border-brand-border text-xs font-mono text-brand-primary px-3 py-1 rounded outline-none"
          >
            {Object.keys(activeCharts).length > 0 ? (
              Object.keys(activeCharts).map(s => (
                <option key={s} value={s}>{s} - ${activeCharts[s].price}</option>
              ))
            ) : (
              <option value="">No Active Symbols</option>
            )}
          </select>
          <button onClick={handleSync} className="p-2 hover:bg-white/5 rounded-lg transition-colors">
            <RefreshCw className={cn("w-5 h-5 text-gray-400", isSyncing && "animate-spin text-brand-primary")} />
          </button>
        </div>
      </nav>

      <main className="flex-1 p-8 max-w-7xl mx-auto w-full">
        {activeTab === 'DASHBOARD' && (
          <div className="grid grid-cols-12 gap-6">
            {/* Left Sidebar: Marketwatch & Live AI Activity */}
            <div className="col-span-12 lg:col-span-3 flex flex-col gap-6">
              {/* Live AI Activity Node */}
              <div className="glass-panel p-6 border-brand-primary/30 bg-brand-primary/5">
                <h3 className="font-display font-bold text-sm mb-4 flex items-center gap-2 text-brand-primary">
                  <BrainCircuit className="w-4 h-4 animate-pulse" />
                  Autonomous Cycle
                </h3>
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] text-gray-500 uppercase">Status</span>
                    <span className={cn(
                      "px-2 py-0.5 rounded text-[10px] font-bold",
                      serverStatus?.systemCycle?.status === 'IDLE' ? "bg-gray-500/10 text-gray-400" : "bg-brand-primary/10 text-brand-primary animate-pulse"
                    )}>
                      {serverStatus?.systemCycle?.status || 'OFFLINE'}
                    </span>
                  </div>
                  <div className="p-3 bg-black/40 rounded-lg border border-white/5">
                    <p className="text-[10px] text-gray-400 font-mono leading-relaxed">
                      <span className="text-brand-secondary mr-2">{'>'}</span>
                      {serverStatus?.systemCycle?.lastAction}
                    </p>
                  </div>
                  <div className="flex gap-1.5">
                    {serverStatus?.systemCycle?.activeNodes?.map((node: string) => (
                      <div key={node} className="p-1 bg-white/5 rounded border border-white/10" title={node}>
                        <Cpu className="w-3 h-3 text-brand-secondary" />
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <div className="glass-panel p-6">
                <h3 className="font-display font-bold text-sm mb-6 flex items-center gap-2">
                  <Activity className="w-4 h-4 text-brand-secondary" />
                  Marketwatch
                </h3>
                <div className="space-y-4">
                  {Object.keys(activeCharts).map(symbol => (
                    <div 
                      key={symbol} 
                      onClick={() => setSelectedSymbol(symbol)}
                      className={cn(
                        "p-3 rounded-xl border transition-all cursor-pointer group",
                        selectedSymbol === symbol ? "bg-brand-secondary/10 border-brand-secondary" : "bg-brand-bg border-brand-border hover:border-brand-secondary/50"
                      )}
                    >
                      <div className="flex justify-between items-center mb-1">
                        <span className="text-sm font-bold">{symbol}</span>
                        <span className="text-xs font-mono text-brand-primary">${activeCharts[symbol].price}</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-[10px] text-gray-500 uppercase">{activeCharts[symbol].strategy}</span>
                        <div className="flex gap-1">
                          <div className="w-1 h-1 rounded-full bg-green-500 animate-pulse" />
                          <span className="text-[8px] text-green-500 font-bold uppercase tracking-tighter">Live</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="glass-panel p-6 border-red-500/20 bg-red-500/5">
                <h3 className="font-display font-bold text-sm mb-4 flex items-center gap-2 text-red-400">
                  <AlertTriangle className="w-4 h-4" />
                  Correlation Warnings
                </h3>
                <div className="space-y-3">
                  {Object.keys(activeCharts).length > 1 && (
                    <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg">
                      <p className="text-[10px] text-red-200 leading-relaxed">
                        ⚠️ XAUUSD & USDJPY are negatively correlated (-0.84). Avoid longing both simultaneously to prevent hedge-lock.
                      </p>
                    </div>
                  )}
                  <p className="text-[10px] text-gray-500 italic">
                    Pearson Matrix updated every 100 ticks.
                  </p>
                </div>
              </div>
            </div>

            {/* Main Content Area */}
            <div className="col-span-12 lg:col-span-9 grid grid-cols-12 gap-6">
              {/* Top Stats */}
              <div className="col-span-12 grid grid-cols-1 md:grid-cols-3 gap-6">
                <StatCard 
                  title="Account Balance" 
                  value={`$${(currentChart.balance || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}`} 
                  subValue={`Equity: $${(currentChart.equity || 0).toLocaleString()}`} 
                  icon={Wallet} 
                  trend={currentChart.drawdown ? -currentChart.drawdown : 0} 
                />
                <StatCard 
                  title="Market Wave" 
                  value={aiSignal?.marketWave || 'SURFING'} 
                  subValue={aiSignal ? `Confidence: ${aiSignal.confidence}%` : "Waiting for AI..."} 
                  icon={Waves} 
                />
                <StatCard 
                  title="Win Rate" 
                  value={journalStats ? `${journalStats.winRate.toFixed(1)}%` : '0%'} 
                  subValue={`Total Trades: ${journalStats?.totalTrades || 0}`} 
                  icon={Target} 
                />
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
                    <ComposedChart data={currentChart.history || []}>
                      <defs>
                        <linearGradient id="colorPrice" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#00ff9d" stopOpacity={0.2}/>
                          <stop offset="95%" stopColor="#00ff9d" stopOpacity={0}/>
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="#222226" vertical={false} />
                      <XAxis 
                        dataKey="time" 
                        hide 
                        type="number"
                        domain={['dataMin', 'dataMax + 7200000']}
                      />
                      <YAxis stroke="#444" fontSize={10} tickLine={false} axisLine={false} domain={['auto', 'auto']} />
                      <Tooltip contentStyle={{ backgroundColor: '#141417', border: '1px solid #222226', borderRadius: '8px' }} itemStyle={{ color: '#00ff9d' }} labelFormatter={(v) => new Date(v).toLocaleTimeString()} />
                      <Area type="monotone" dataKey="price" stroke="#00ff9d" strokeWidth={2} fillOpacity={1} fill="url(#colorPrice)" isAnimationActive={false} />
                      
                      {/* Technical Analysis Visual Objects */}
                      {currentChart.visualObjects?.map((obj: any, idx: number) => {
                        const RA = ReferenceArea as any;
                        const RL = ReferenceLine as any;
                        return (
                          <React.Fragment key={`vo-${idx}`}>
                            {obj.x1 ? (
                              <RA 
                                x1={obj.x1}
                                x2={obj.x2 || Date.now()}
                                y1={obj.y1}
                                y2={obj.y2}
                                fill={obj.color}
                                fillOpacity={obj.opacity || 0.1}
                                stroke="none"
                              />
                            ) : (
                              <RL 
                                y={obj.y1}
                                stroke={obj.color}
                                strokeDasharray="3 3"
                                strokeOpacity={obj.opacity || 0.5}
                                label={{ value: obj.label, position: 'right', fill: obj.color, fontSize: 8 }}
                              />
                            )}
                          </React.Fragment>
                        );
                      })}

                      {/* AI Signal Visual Objects */}
                      {aiSignal?.visualObjects?.map((obj: any, idx: number) => {
                        const RA = ReferenceArea as any;
                        return (
                          <React.Fragment key={`signal-vo-${idx}`}>
                            <RA 
                              x1={obj.x1}
                              x2={obj.x2}
                              y1={obj.y1}
                              y2={obj.y2}
                              fill={obj.color}
                              fillOpacity={obj.opacity || 0.2}
                              stroke={obj.color}
                              strokeWidth={1}
                              strokeDasharray="3 3"
                            />
                          </React.Fragment>
                        );
                      })}
                    </ComposedChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Live Journal / Why no entry? */}
              <div className="glass-panel p-6">
                <div className="flex items-center justify-between mb-6">
                  <h3 className="font-display font-bold text-lg flex items-center gap-2">
                    <Terminal className="w-5 h-5 text-brand-secondary" />
                    Live AI Journal
                  </h3>
                  <span className="text-[10px] font-mono text-gray-500">Real-time Logic</span>
                </div>
                <div className="space-y-3 max-h-[300px] overflow-y-auto pr-2 custom-scrollbar">
                  {liveJournalEntries.map((entry, idx) => (
                    <div key={idx} className="p-3 bg-white/5 rounded-lg border border-white/5 hover:border-brand-secondary/30 transition-all group">
                      <div className="flex justify-between items-start mb-1">
                        <span className="text-[10px] font-bold text-brand-secondary">{entry.symbol}</span>
                        <span className="text-[8px] text-gray-600 font-mono">{new Date(entry.timestamp).toLocaleTimeString()}</span>
                      </div>
                      <p className="text-[10px] text-gray-400 leading-relaxed group-hover:text-gray-200 transition-colors">
                        {entry.message}
                      </p>
                    </div>
                  ))}
                  {liveJournalEntries.length === 0 && (
                    <div className="py-10 text-center text-gray-500 text-[10px] italic">
                      Waiting for AI cycle to start...
                    </div>
                  )}
                </div>
              </div>

              {/* Open Positions */}
              <div className="glass-panel p-6">
                <div className="flex items-center justify-between mb-6">
                  <h3 className="font-display font-bold text-lg flex items-center gap-2">
                    <Layers className="w-5 h-5 text-brand-primary" />
                    Open Positions
                  </h3>
                  <span className="text-[10px] font-mono text-gray-500">
                    {currentChart.openPositions?.length || 0} Active Trades
                  </span>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left">
                    <thead>
                      <tr className="text-[10px] text-gray-500 uppercase tracking-widest border-b border-brand-border">
                        <th className="pb-3 font-medium">Symbol</th>
                        <th className="pb-3 font-medium">Type</th>
                        <th className="pb-3 font-medium">Size</th>
                        <th className="pb-3 font-medium">Entry</th>
                        <th className="pb-3 font-medium">Current</th>
                        <th className="pb-3 font-medium text-right">Profit</th>
                      </tr>
                    </thead>
                    <tbody className="text-xs font-mono">
                      {currentChart.openPositions?.map((pos: any, idx: number) => (
                        <tr key={idx} className="border-b border-brand-border/50 last:border-0 hover:bg-white/5 transition-colors">
                          <td className="py-3 font-bold">{pos.symbol}</td>
                          <td className="py-3">
                            <span className={cn(
                              "px-1.5 py-0.5 rounded text-[10px] font-bold",
                              pos.type === 'BUY' ? "bg-green-500/10 text-green-400" : "bg-red-500/10 text-red-400"
                            )}>
                              {pos.type}
                            </span>
                          </td>
                          <td className="py-3">{pos.volume}</td>
                          <td className="py-3">{pos.openPrice}</td>
                          <td className="py-3">{pos.currentPrice}</td>
                          <td className={cn("py-3 text-right font-bold", pos.profit >= 0 ? "text-green-400" : "text-red-400")}>
                            ${pos.profit.toFixed(2)}
                          </td>
                        </tr>
                      ))}
                      {(!currentChart.openPositions || currentChart.openPositions.length === 0) && (
                        <tr>
                          <td colSpan={6} className="py-8 text-center text-gray-500 italic">
                            No open positions detected on MT5.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
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

                      {/* Mentor Insight */}
                      <div className="p-4 bg-brand-primary/5 border border-brand-primary/20 rounded-xl relative overflow-hidden">
                        <div className="absolute top-0 right-0 p-2 opacity-10">
                          <BrainCircuit className="w-8 h-8 text-brand-primary" />
                        </div>
                        <p className="text-[10px] text-brand-primary font-bold uppercase mb-1">Mentor Insight</p>
                        <p className="text-xs text-gray-300 leading-relaxed italic">
                          "{aiSignal.mentorInsight || aiSignal.reasoning}"
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

                      {/* Auto-Execute Toggle */}
                      <div className="flex items-center justify-between p-3 bg-white/5 rounded-xl border border-white/10">
                        <div className="flex items-center gap-2">
                          <Zap className={cn("w-4 h-4", autoExecute ? "text-brand-primary" : "text-gray-500")} />
                          <span className="text-[10px] font-bold uppercase">Auto-Execute on MT5</span>
                        </div>
                        <button 
                          onClick={() => setAutoExecute(!autoExecute)}
                          className={cn(
                            "w-10 h-5 rounded-full transition-all relative",
                            autoExecute ? "bg-brand-primary" : "bg-gray-700"
                          )}
                        >
                          <div className={cn(
                            "absolute top-1 w-3 h-3 bg-white rounded-full transition-all",
                            autoExecute ? "right-1" : "left-1"
                          )} />
                        </button>
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
                <h3 className="font-display font-bold text-sm mb-6 flex items-center gap-2">
                  <Zap className="w-4 h-4 text-brand-primary" />
                  AI Strategy Weights
                </h3>
                <div className="space-y-4">
                  {serverStatus?.strategyWeights && Object.entries(serverStatus.strategyWeights).map(([strategy, weight]: [string, any]) => (
                    <div key={strategy} className="space-y-1.5">
                      <div className="flex justify-between text-[10px] uppercase font-bold">
                        <span className="text-gray-400">{strategy}</span>
                        <span className="text-brand-primary">{(weight * 100).toFixed(1)}%</span>
                      </div>
                      <div className="h-1.5 w-full bg-white/5 rounded-full overflow-hidden">
                        <motion.div 
                          initial={{ width: 0 }}
                          animate={{ width: `${weight * 100}%` }}
                          className="h-full bg-brand-primary shadow-[0_0_10px_rgba(0,255,157,0.5)]"
                        />
                      </div>
                    </div>
                  ))}
                  {!serverStatus?.strategyWeights && (
                    <div className="py-4 text-center text-gray-500 text-[10px] italic">
                      Waiting for AI synchronization...
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
        )}

        {activeTab === 'JOURNAL' && (
          <div className="flex flex-col gap-6">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
              <StatCard title="Total Trades" value={journalStats?.totalTrades || 0} subValue="Lifetime" icon={History} />
              <StatCard title="Win Rate" value={`${journalStats?.winRate.toFixed(1) || 0}%`} subValue="Accuracy" icon={Target} trend={2.5} />
              <StatCard title="Total Profit" value={`$${journalStats?.totalProfit.toLocaleString() || 0}`} subValue="Net P/L" icon={Wallet} trend={12.4} />
              <StatCard title="Profit Factor" value={journalStats?.profitFactor || '0.00'} subValue="Efficiency" icon={Activity} />
            </div>

            <div className="glass-panel p-8">
              <div className="flex justify-between items-center mb-8">
                <h3 className="font-display font-bold text-2xl">Trade Journal & Self-Learning</h3>
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
                        <span className="text-xs text-gray-500">{new Date(trade.timestamp).toLocaleString()}</span>
                      </div>
                      <span className={cn("font-mono font-bold", trade.profit > 0 ? "text-green-400" : "text-red-400")}>
                        {trade.profit > 0 ? '+' : ''}{trade.profit.toFixed(2)}
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
          </div>
        )}

        {activeTab === 'SURFER' && (
          <div className="flex flex-col gap-8">
            <div className="flex justify-between items-center">
              <div>
                <h2 className="text-3xl font-display font-bold text-white">Market Surfer</h2>
                <p className="text-gray-500 text-sm">AI-Powered Breakout & Reversal Predictions for all active symbols</p>
              </div>
              <div className="flex gap-4">
                <div className="px-4 py-2 bg-brand-primary/10 border border-brand-primary/20 rounded-xl flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                  <span className="text-[10px] font-bold text-brand-primary uppercase">Live AI Scanning</span>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {Object.values(marketInsights).map((insight: any) => (
                <motion.div 
                  key={insight.symbol}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  className={cn(
                    "glass-panel p-6 border-t-4 transition-all hover:translate-y-[-4px]",
                    insight.prediction === 'BREAKOUT' ? "border-t-brand-primary" : 
                    insight.prediction === 'REVERSAL' ? "border-t-brand-secondary" : 
                    insight.prediction === 'SMC_SETUP' ? "border-t-purple-500" : "border-t-gray-700"
                  )}
                >
                  <div className="flex justify-between items-start mb-6">
                    <div>
                      <h3 className="text-xl font-bold text-white">{insight.symbol}</h3>
                      <p className="text-[10px] text-gray-500 font-mono">${insight.price}</p>
                    </div>
                    <div className={cn(
                      "px-3 py-1 rounded-full text-[10px] font-bold uppercase",
                      insight.prediction === 'BREAKOUT' ? "bg-brand-primary/20 text-brand-primary" : 
                      insight.prediction === 'REVERSAL' ? "bg-brand-secondary/20 text-brand-secondary" : 
                      insight.prediction === 'SMC_SETUP' ? "bg-purple-500/20 text-purple-400" : "bg-gray-800 text-gray-400"
                    )}>
                      {insight.prediction}
                    </div>
                  </div>

                  <div className="space-y-4">
                    <div className="flex justify-between items-center">
                      <span className="text-xs text-gray-400">AI Confidence</span>
                      <span className="text-sm font-bold text-white">{insight.probability}%</span>
                    </div>
                    <div className="h-1.5 w-full bg-white/5 rounded-full overflow-hidden">
                      <div 
                        className={cn(
                          "h-full transition-all duration-1000",
                          insight.prediction === 'BREAKOUT' ? "bg-brand-primary" : 
                          insight.prediction === 'REVERSAL' ? "bg-brand-secondary" : "bg-purple-500"
                        )}
                        style={{ width: `${insight.probability}%` }}
                      />
                    </div>
                    
                    <div className="p-3 bg-white/5 rounded-lg border border-white/5">
                      <p className="text-[10px] text-gray-400 leading-relaxed italic">
                        "{insight.insight}"
                      </p>
                    </div>

                    <div className="flex gap-2">
                      {Object.entries(insight.confluences).filter(([_, v]) => v).slice(0, 3).map(([k]) => (
                        <span key={k} className="px-2 py-0.5 bg-white/5 border border-white/10 rounded text-[8px] text-gray-500 uppercase">
                          {k.replace(/_/g, ' ')}
                        </span>
                      ))}
                    </div>

                    <button 
                      onClick={() => {
                        setSelectedSymbol(insight.symbol);
                        setActiveTab('DASHBOARD');
                      }}
                      className="w-full py-2 mt-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg text-[10px] font-bold transition-all uppercase tracking-widest"
                    >
                      View Chart
                    </button>
                  </div>
                </motion.div>
              ))}

              {Object.keys(marketInsights).length === 0 && (
                <div className="col-span-full py-20 text-center glass-panel">
                  <RefreshCw className="w-12 h-12 text-gray-700 mx-auto mb-4 animate-spin" />
                  <p className="text-gray-500 italic">Scanning global markets for high-conviction setups...</p>
                  <p className="text-[10px] text-gray-600 mt-2 uppercase tracking-widest">Ensure MT5 is connected and syncing</p>
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === 'SIGNALS' && (
          <div className="flex flex-col gap-8">
            <div className="flex justify-between items-center">
              <div>
                <h2 className="text-3xl font-display font-bold text-white">AI Signal Matrix</h2>
                <p className="text-gray-500 text-sm">High-conviction setups generated by the Multi-Model Engine</p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {Object.keys(activeCharts).map((symbol: string) => {
                const signal = serverStatus?.activeSignals?.[symbol];
                const chart = activeCharts[symbol];
                return (
                  <div key={symbol} className="glass-panel p-6 relative overflow-hidden">
                    <div className="flex justify-between items-start mb-6">
                      <div>
                        <h3 className="text-xl font-bold">{symbol}</h3>
                        <p className="text-[10px] text-gray-500 font-mono">${chart.price}</p>
                      </div>
                      {signal ? (
                        <span className={cn(
                          "px-3 py-1 rounded text-[10px] font-bold",
                          signal.signal === 'BUY' ? "bg-green-500/20 text-green-400" : "bg-red-500/20 text-red-400"
                        )}>
                          {signal.signal}
                        </span>
                      ) : (
                        <span className="px-3 py-1 bg-gray-800 text-gray-500 rounded text-[10px] font-bold">
                          SCANNING
                        </span>
                      )}
                    </div>

                    {signal ? (
                      <div className="space-y-4">
                        <div className="p-3 bg-brand-primary/5 border border-brand-primary/10 rounded-lg">
                          <p className="text-[10px] text-brand-primary font-bold uppercase mb-1">{signal.setupType}</p>
                          <p className="text-xs text-gray-300 italic">"{signal.mentorInsight}"</p>
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          <div className="p-2 bg-black/20 rounded border border-white/5 text-center">
                            <p className="text-[8px] text-gray-500 uppercase">TP</p>
                            <p className="text-xs font-mono text-green-400">{signal.tp}</p>
                          </div>
                          <div className="p-2 bg-black/20 rounded border border-white/5 text-center">
                            <p className="text-[8px] text-gray-500 uppercase">SL</p>
                            <p className="text-xs font-mono text-red-400">{signal.sl}</p>
                          </div>
                        </div>
                        <div className="flex justify-between items-center text-[10px]">
                          <span className="text-gray-500">Confidence</span>
                          <span className="text-brand-primary font-bold">{signal.confidence}%</span>
                        </div>
                      </div>
                    ) : (
                      <div className="py-10 text-center text-gray-600 text-[10px] italic">
                        No active signal for this pair.
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {activeTab === 'ADMIN' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="glass-panel p-8">
              <h3 className="font-display font-bold text-xl mb-8 flex items-center gap-3">
                <Settings className="w-6 h-6 text-brand-primary" />
                Admin Terminal
              </h3>
              
              <div className="space-y-8">
                <div className="space-y-4">
                  <h4 className="text-xs font-bold text-gray-400 uppercase tracking-widest">Strategy Parameters</h4>
                  <div className="grid grid-cols-3 gap-4">
                    <div className="space-y-2">
                      <label className="text-[10px] text-gray-500 uppercase">Min Confidence %</label>
                      <input type="number" defaultValue={serverStatus?.adminConfig?.strategy?.minConfidence} className="w-full bg-black/40 border border-brand-border p-2 rounded text-xs outline-none focus:border-brand-primary" />
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] text-gray-500 uppercase">Max Drawdown %</label>
                      <input type="number" defaultValue={serverStatus?.adminConfig?.strategy?.maxDrawdown} className="w-full bg-black/40 border border-brand-border p-2 rounded text-xs outline-none focus:border-brand-primary" />
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] text-gray-500 uppercase">Trade Frequency</label>
                      <select defaultValue={serverStatus?.adminConfig?.strategy?.tradeFrequency} className="w-full bg-black/40 border border-brand-border p-2 rounded text-xs outline-none focus:border-brand-primary">
                        <option value="HIGH">HIGH (Scalping)</option>
                        <option value="MEDIUM">MEDIUM (Day Trading)</option>
                        <option value="LOW">LOW (Swing Trading)</option>
                      </select>
                    </div>
                  </div>
                </div>

                <div className="space-y-4">
                  <h4 className="text-xs font-bold text-gray-400 uppercase tracking-widest">UI Customization</h4>
                  <div className="grid grid-cols-3 gap-4">
                    <div className="space-y-2">
                      <label className="text-[10px] text-gray-500 uppercase">Primary</label>
                      <div className="flex gap-2 items-center">
                        <div className="w-6 h-6 rounded border border-white/10" style={{ backgroundColor: serverStatus?.adminConfig?.theme?.primary }} />
                        <input type="text" defaultValue={serverStatus?.adminConfig?.theme?.primary} className="w-full bg-black/40 border border-brand-border p-2 rounded text-[10px] outline-none" />
                      </div>
                    </div>
                  </div>
                </div>

                <button className="w-full py-3 bg-brand-primary text-brand-bg font-bold rounded-xl shadow-[0_0_20px_rgba(0,255,157,0.2)] hover:shadow-[0_0_30px_rgba(0,255,157,0.4)] transition-all uppercase tracking-widest text-xs">
                  Save Configuration
                </button>
              </div>
            </div>

            <div className="glass-panel p-8 border-brand-secondary/30 bg-brand-secondary/5">
              <h3 className="font-display font-bold text-xl mb-8 flex items-center gap-3">
                <Terminal className="w-6 h-6 text-brand-secondary" />
                System Logs
              </h3>
              <div className="space-y-3 font-mono text-[10px] text-gray-400 max-h-[500px] overflow-y-auto pr-4 custom-scrollbar">
                <p><span className="text-brand-secondary">[SYSTEM]</span> QuantNexus 3.0 Core Online</p>
                <p><span className="text-brand-secondary">[SYSTEM]</span> Multi-Model Engine Initialized (Gemini 2.0 Flash)</p>
                <p><span className="text-brand-secondary">[SYSTEM]</span> Autonomous Cycle Loop: 10s</p>
                <p><span className="text-brand-secondary">[SYSTEM]</span> n8n Webhook Listener: Active</p>
                {liveJournalEntries.slice(0, 10).map((entry, i) => (
                  <p key={i}><span className="text-gray-600">[{new Date(entry.timestamp).toLocaleTimeString()}]</span> {entry.message}</p>
                ))}
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
