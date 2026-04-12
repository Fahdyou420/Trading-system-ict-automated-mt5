/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

//+------------------------------------------------------------------+
//|                                              QuantNexus_SMC.mq5 |
//|                                  Copyright 2024, QuantNexus Ltd. |
//|                                       https://www.quantnexus.ai |
//+------------------------------------------------------------------+
#property copyright "Copyright 2024, QuantNexus Ltd."
#property link      "https://www.quantnexus.ai"
#property version   "1.00"
#property strict

//--- Input Parameters
input group "=== Risk Management ==="
input double InpRiskPerTrade    = 1.0;      // Risk per trade (%)
input double InpMaxDailyLoss    = 5.0;      // Max Daily Loss (%)
input double InpMaxDrawdown     = 10.0;     // Max Drawdown (%)
input double InpRRRatio         = 2.5;      // Target Risk:Reward

input group "=== Strategy Parameters ==="
input ENUM_TIMEFRAMES InpHTF    = PERIOD_H1; // Higher Timeframe for Structure
input int InpOrderBlockLookback = 100;      // Candles to scan for OBs
input double InpATRMultiplier   = 1.5;      // ATR Multiplier for SL Buffer

enum ENUM_STRATEGY {
   STRAT_SMC,        // Smart Money Concepts
   STRAT_TREND,      // Trend Following
   STRAT_AI_SIGNAL,  // AI Signal Driven
   STRAT_OMNI_AI     // Omni-Strategy AI (Weighted Matrix)
};

input ENUM_STRATEGY InpStrategy = STRAT_SMC; // Active Strategy

input group "=== Momentum & Volatility ==="
input int InpStochK             = 14;       // Stochastic %K
input int InpStochD             = 3;        // Stochastic %D
input int InpStochSlowing       = 3;        // Stochastic Slowing
input int InpVixFixPeriod       = 22;       // VIX Fix Lookback

input group "=== Visualization Module ==="
input bool InpShowVisuals       = true;     // Enable On-Chart Visuals
input bool InpShowStats         = true;     // Show Account Statistics
input bool InpShowHistory       = true;     // Show Trade History
input color InpColorBullishOB   = clrMediumSpringGreen; // Bullish OB Color
input color InpColorBearishOB   = clrTomato;            // Bearish OB Color
input int InpFontSize           = 10;       // UI Font Size

input group "=== Connectivity ==="
input string InpServerURL        = "http://localhost:3000"; // Web App API URL
input int InpSyncInterval       = 1000;     // Sync Interval (ms)

//--- Global Variables
int handleHTF_OB;
int handleStoch;
int handleATR;
int handleRSI;
int handleMACD;
double stochMain[], stochSig[];
double rsiBuffer[];
double macdMain[], macdSig[];
double vixFixBuffer[];
long lastSyncTime = 0;
string lastAISignalID = "";

//+------------------------------------------------------------------+
//| Expert initialization function                                   |
//+------------------------------------------------------------------+
int OnInit()
{
   // Initialize handles for indicators
   handleStoch = iStochastic(_Symbol, _Period, InpStochK, InpStochD, InpStochSlowing, MODE_SMA, STO_LOWHIGH);
   handleATR = iATR(_Symbol, _Period, 14);
   handleRSI = iRSI(_Symbol, _Period, 14, PRICE_CLOSE);
   handleMACD = iMACD(_Symbol, _Period, 12, 26, 9, PRICE_CLOSE);
   
   if(handleStoch == INVALID_HANDLE || handleATR == INVALID_HANDLE || handleRSI == INVALID_HANDLE || handleMACD == INVALID_HANDLE) {
      Print("Failed to create indicator handles");
      return(INIT_FAILED);
   }
   
   if(InpShowVisuals) {
      ChartSetInteger(0, CHART_SHOW_GRID, false);
      DrawHistoricalStructure();
   }
   
   EventSetMillisecondTimer(InpSyncInterval);
   
   Print("QuantNexus 2.0 Initialized - Omni-Strategy Active");
   return(INIT_SUCCEEDED);
}

//+------------------------------------------------------------------+
//| Expert deinitialization function                                 |
//+------------------------------------------------------------------+
void OnDeinit(const int reason)
{
   ObjectsDeleteAll(0, "QN_");
   EventKillTimer();
   IndicatorRelease(handleStoch);
   IndicatorRelease(handleATR);
   IndicatorRelease(handleRSI);
   IndicatorRelease(handleMACD);
}

//+------------------------------------------------------------------+
//| Timer function for data sync                                     |
//+------------------------------------------------------------------+
void OnTimer()
{
   SyncDataWithServer();
}

//+------------------------------------------------------------------+
//| Expert tick function                                             |
//+------------------------------------------------------------------+
void OnTick()
{
   // 1. Check Prop Firm Risk Constraints
   if(CheckRiskLimits()) return;

   bool triggerEntry = false;
   bool isHTFBullish = IdentifyStructure(InpHTF);
   double obLevel = FindUnmitigatedOB(InpHTF);

   // 2. Strategy Execution Logic
   switch(InpStrategy) {
      case STRAT_SMC:
         triggerEntry = CheckConfluence(obLevel, isHTFBullish);
         break;
      case STRAT_TREND:
         triggerEntry = CheckTrendFollowing();
         break;
      case STRAT_AI_SIGNAL:
      case STRAT_OMNI_AI:
         triggerEntry = CheckExternalAISignal();
         break;
   }
   
   // 3. Execution
   if(triggerEntry) {
      ExecuteTrade(isHTFBullish);
      SendJournalEntry("ENTRY", _Symbol, "AI_OMNI_SIGNAL", 0);
   }
   
   // 4. Check for Trade Closures (Journaling)
   CheckTradeClosures();
   
   // 5. Update On-Chart Visuals
   if(InpShowVisuals) UpdateChartVisuals(obLevel, isHTFBullish);
}

//+------------------------------------------------------------------+
//| Detect Market Events (Breakouts/Reversals)                       |
//+------------------------------------------------------------------+
string DetectMarketEvents() {
   string events = "";
   double high = iHigh(_Symbol, _Period, 1);
   double low = iLow(_Symbol, _Period, 1);
   double close = iClose(_Symbol, _Period, 0);
   
   if(close > high) events += "BREAKOUT_UP ";
   if(close < low) events += "BREAKOUT_DOWN ";
   
   // Simple Reversal (Pin Bar)
   double body = MathAbs(iOpen(_Symbol, _Period, 1) - iClose(_Symbol, _Period, 1));
   double range = iHigh(_Symbol, _Period, 1) - iLow(_Symbol, _Period, 1);
   if(body < range * 0.3) events += "POTENTIAL_REVERSAL ";
   
   return events;
}

void SendJournalEntry(string type, string symbol, string setup, double profit) {
   string url = InpServerURL + "/api/journal/add";
   string payload = "{";
   payload += "\"type\":\"" + type + "\",";
   payload += "\"symbol\":\"" + symbol + "\",";
   payload += "\"setupType\":\"" + setup + "\",";
   payload += "\"profit\":" + DoubleToString(profit, 2);
   payload += "}";

   char post[], result[];
   string headers;
   StringToCharArray(payload, post);
   WebRequest("POST", url, "Content-Type: application/json\r\n", 500, post, result, headers);
}

void CheckTradeClosures() {
   // Logic to detect closed trades and send to journal
   // We'll check the history for the last closed trade
   if(HistorySelect(TimeCurrent()-86400, TimeCurrent())) {
      int total = HistoryDealsTotal();
      for(int i=total-1; i>=0; i--) {
         ulong ticket = HistoryDealGetTicket(i);
         if(HistoryDealGetInteger(ticket, DEAL_ENTRY) == DEAL_ENTRY_OUT) {
            long magic = HistoryDealGetInteger(ticket, DEAL_MAGIC);
            // Only process if it's our EA's trade (optional, but good practice)
            double profit = HistoryDealGetDouble(ticket, DEAL_PROFIT) + HistoryDealGetDouble(ticket, DEAL_COMMISSION) + HistoryDealGetDouble(ticket, DEAL_SWAP);
            string symbol = HistoryDealGetString(ticket, DEAL_SYMBOL);
            
            // To prevent duplicate sends, we could store the last ticket ID
            static ulong lastProcessedTicket = 0;
            if(ticket > lastProcessedTicket) {
               SendJournalEntry("EXIT", symbol, "SMC_EXIT", profit);
               lastProcessedTicket = ticket;
            }
            break;
         }
      }
   }
}

//+------------------------------------------------------------------+
//| Data Synchronization Logic                                       |
//+------------------------------------------------------------------+
void SyncDataWithServer() {
   string url = InpServerURL + "/api/mt5/sync";
   
   // Fetch Indicator Data
   CopyBuffer(handleRSI, 0, 0, 5, rsiBuffer);
   CopyBuffer(handleMACD, 0, 0, 5, macdMain);
   CopyBuffer(handleMACD, 1, 0, 5, macdSig);
   ArraySetAsSeries(rsiBuffer, true);
   ArraySetAsSeries(macdMain, true);
   ArraySetAsSeries(macdSig, true);

   // Fetch Price Data for Swing Analysis
   double High[], Low[];
   ArraySetAsSeries(High, true);
   ArraySetAsSeries(Low, true);
   CopyHigh(_Symbol, _Period, 0, 105, High);
   CopyLow(_Symbol, _Period, 0, 105, Low);

   // Find Swing Highs/Lows (Last 3)
   double swingHighs[3], swingLows[3];
   int shCount=0, slCount=0;
   for(int i=2; i<100 && (shCount<3 || slCount<3); i++) {
      if(shCount < 3 && High[i] > High[i-1] && High[i] > High[i+1] && High[i] > High[i-2] && High[i] > High[i+2]) {
         swingHighs[shCount++] = High[i];
      }
      if(slCount < 3 && Low[i] < Low[i-1] && Low[i] < Low[i+1] && Low[i] < Low[i-2] && Low[i] < Low[i+2]) {
         swingLows[slCount++] = Low[i];
      }
   }

   string payload = "{";
   payload += "\"symbol\":\"" + _Symbol + "\",";
   payload += "\"price\":" + DoubleToString(SymbolInfoDouble(_Symbol, SYMBOL_BID), _Digits) + ",";
   payload += "\"strategy\":\"" + EnumToString(InpStrategy) + "\",";
   
   // Indicators Array
   payload += "\"indicators\":{";
   payload += "\"rsi\":[" + DoubleToString(rsiBuffer[0],2) + "," + DoubleToString(rsiBuffer[1],2) + "," + DoubleToString(rsiBuffer[2],2) + "," + DoubleToString(rsiBuffer[3],2) + "," + DoubleToString(rsiBuffer[4],2) + "],";
   payload += "\"macd\":[" + DoubleToString(macdMain[0],_Digits) + "," + DoubleToString(macdMain[1],_Digits) + "," + DoubleToString(macdMain[2],_Digits) + "," + DoubleToString(macdMain[3],_Digits) + "," + DoubleToString(macdMain[4],_Digits) + "]";
   payload += "},";

   // Swings Array
   payload += "\"swings\":{";
   payload += "\"highs\":[" + DoubleToString(swingHighs[0],_Digits) + "," + DoubleToString(swingHighs[1],_Digits) + "," + DoubleToString(swingHighs[2],_Digits) + "],";
   payload += "\"lows\":[" + DoubleToString(swingLows[0],_Digits) + "," + DoubleToString(swingLows[1],_Digits) + "," + DoubleToString(swingLows[2],_Digits) + "]";
   payload += "},";

   payload += "\"events\":\"" + DetectMarketEvents() + "\",";
   payload += "\"balance\":" + DoubleToString(AccountInfoDouble(ACCOUNT_BALANCE), 2) + ",";
   payload += "\"equity\":" + DoubleToString(AccountInfoDouble(ACCOUNT_EQUITY), 2) + ",";
   payload += "\"drawdown\":" + DoubleToString((1.0 - AccountInfoDouble(ACCOUNT_EQUITY)/AccountInfoDouble(ACCOUNT_BALANCE)) * 100.0, 2) + ",";
   payload += "\"marginUsed\":" + DoubleToString(AccountInfoDouble(ACCOUNT_MARGIN), 2) + ",";
   payload += "\"freeMargin\":" + DoubleToString(AccountInfoDouble(ACCOUNT_MARGIN_FREE), 2) + ",";
   
   // Add Open Positions
   payload += "\"openPositions\":[";
   bool firstPos = true;
   for(int i=0; i<PositionsTotal(); i++) {
      if(PositionSelectByTicket(PositionGetTicket(i))) {
         string posSymbol = PositionGetString(POSITION_SYMBOL);
         if(!firstPos) payload += ",";
         payload += "{";
         payload += "\"symbol\":\"" + posSymbol + "\",";
         payload += "\"type\":\"" + (PositionGetInteger(POSITION_TYPE) == POSITION_TYPE_BUY ? "BUY" : "SELL") + "\",";
         payload += "\"volume\":" + DoubleToString(PositionGetDouble(POSITION_VOLUME), 2) + ",";
         payload += "\"openPrice\":" + DoubleToString(PositionGetDouble(POSITION_PRICE_OPEN), (int)SymbolInfoInteger(posSymbol, SYMBOL_DIGITS)) + ",";
         payload += "\"currentPrice\":" + DoubleToString(PositionGetDouble(POSITION_PRICE_CURRENT), (int)SymbolInfoInteger(posSymbol, SYMBOL_DIGITS)) + ",";
         payload += "\"profit\":" + DoubleToString(PositionGetDouble(POSITION_PROFIT), 2) + ",";
         payload += "\"sl\":" + DoubleToString(PositionGetDouble(POSITION_SL), (int)SymbolInfoInteger(posSymbol, SYMBOL_DIGITS)) + ",";
         payload += "\"tp\":" + DoubleToString(PositionGetDouble(POSITION_TP), (int)SymbolInfoInteger(posSymbol, SYMBOL_DIGITS)) + "";
         payload += "}";
         firstPos = false;
      }
   }
   payload += "],";
   
   // Add Objects (FVG, OB, etc)
   payload += "\"objects\":[";
   int total = ObjectsTotal(0, 0, -1);
   bool first = true;
   for(int i=0; i<total; i++) {
      string name = ObjectName(0, i, 0, -1);
      if(StringFind(name, "QN_") == 0) {
         if(!first) payload += ",";
         payload += "{";
         payload += "\"name\":\"" + name + "\",";
         payload += "\"type\":" + IntegerToString(ObjectGetInteger(0, name, OBJPROP_TYPE)) + ",";
         payload += "\"time1\":" + IntegerToString(ObjectGetInteger(0, name, OBJPROP_TIME, 0)) + ",";
         payload += "\"price1\":" + DoubleToString(ObjectGetDouble(0, name, OBJPROP_PRICE, 0), _Digits) + ",";
         payload += "\"time2\":" + IntegerToString(ObjectGetInteger(0, name, OBJPROP_TIME, 1)) + ",";
         payload += "\"price2\":" + DoubleToString(ObjectGetDouble(0, name, OBJPROP_PRICE, 1), _Digits) + ",";
         payload += "\"color\":\"" + ColorToString((color)ObjectGetInteger(0, name, OBJPROP_COLOR)) + "\"";
         payload += "}";
         first = false;
      }
   }
   payload += "]}";

   char post[], result[];
   string headers;
   // Convert string to char array WITHOUT the null terminator to avoid "Unexpected non-whitespace character" error on server
   int len = StringLen(payload);
   ArrayResize(post, len);
   StringToCharArray(payload, post, 0, len);
   
   ResetLastError();
   int res = WebRequest("POST", url, "Content-Type: application/json\r\n", 500, post, result, headers);
   
   if(res == -1) {
      int error = GetLastError();
      if(error == 4014) {
         Print("CRITICAL: WebRequest NOT allowed. Go to Tools -> Options -> Expert Advisors and add '", InpServerURL, "' to the list.");
      } else {
         Print("Sync Error: ", error, " URL: ", url);
      }
   } else if(res != 200) {
      string response = CharArrayToString(result);
      Print("Server Error (", res, "): ", response);
   } else {
      // Success
      if(TimeCurrent() % 60 == 0) Print("Sync OK: ", _Symbol, " @ ", DoubleToString(SymbolInfoDouble(_Symbol, SYMBOL_BID), _Digits));
   }
}

bool CheckTrendFollowing() {
   // Implementation for trend following logic (e.g. EMA crossover)
   return false;
}

bool CheckExternalAISignal() {
   string url = InpServerURL + "/api/mt5/signal?symbol=" + _Symbol;
   char post[], result[];
   string headers;
   
   ResetLastError();
   int res = WebRequest("GET", url, NULL, 500, post, result, headers);
   
   if(res == 200) {
      string response = CharArrayToString(result);
      // Simple JSON parsing for signal, tp, sl, id, mentorInsight
      string signal = GetJsonValue(response, "signal");
      string signalID = GetJsonValue(response, "id");
      string insight = GetJsonValue(response, "mentorInsight");
      
      if(signalID != lastAISignalID && (signal == "BUY" || signal == "SELL")) {
         lastAISignalID = signalID;
         DrawMentorUI(insight);
         Alert("QuantNexus AI Signal: ", signal, " for ", _Symbol);
         PlaySound("expert.wav");
         return true;
      }
      
      if(signal == "HOLD") {
         DrawMentorUI("Market condition: HOLD. " + insight);
      }
   }
   return false;
}

string GetJsonValue(string json, string key) {
   string search = "\"" + key + "\":\"";
   int start = StringFind(json, search);
   if(start == -1) {
      search = "\"" + key + "\":";
      start = StringFind(json, search);
      if(start == -1) return "";
      start += StringLen(search);
      int end = StringFind(json, ",", start);
      if(end == -1) end = StringFind(json, "}", start);
      return StringSubstr(json, start, end - start);
   }
   start += StringLen(search);
   int end = StringFind(json, "\"", start);
   return StringSubstr(json, start, end - start);
}

//+------------------------------------------------------------------+
//| Visuals & Mentor UI                                              |
//+------------------------------------------------------------------+
void DrawHistoricalStructure() {
   Print("Calculating Historical Market Structure...");

   double High[];
   datetime Time[];
   ArraySetAsSeries(High, true);
   ArraySetAsSeries(Time, true);
   CopyHigh(_Symbol, _Period, 0, 505, High);
   CopyTime(_Symbol, _Period, 0, 505, Time);

   // Logic to draw last 5 BOS/CHoCH lines
   for(int i=5; i<500; i++) {
      if(High[i] > High[i-1] && High[i] > High[i+1] && High[i] > High[i-2] && High[i] > High[i+2]) {
         string name = "QN_H_BOS_" + IntegerToString(i);
         ObjectCreate(0, name, OBJ_TREND, 0, Time[i], High[i], Time[i-5], High[i]);
         ObjectSetInteger(0, name, OBJPROP_COLOR, clrGray);
         ObjectSetInteger(0, name, OBJPROP_STYLE, STYLE_DOT);
         ObjectSetInteger(0, name, OBJPROP_RAY_RIGHT, false);
      }
   }
}

void DrawMentorUI(string insight) {
   string name = "QN_Mentor_Box";
   string labelName = "QN_Mentor_Text";
   
   int x = 20, y = 100;
   int width = 350, height = 80;
   
   if(ObjectFind(0, name) < 0) {
      ObjectCreate(0, name, OBJ_RECTANGLE_LABEL, 0, 0, 0);
      ObjectSetInteger(0, name, OBJPROP_XDISTANCE, x);
      ObjectSetInteger(0, name, OBJPROP_YDISTANCE, y);
      ObjectSetInteger(0, name, OBJPROP_XSIZE, width);
      ObjectSetInteger(0, name, OBJPROP_YSIZE, height);
      ObjectSetInteger(0, name, OBJPROP_BGCOLOR, C'20,20,23');
      ObjectSetInteger(0, name, OBJPROP_BORDER_COLOR, clrDeepSkyBlue);
      ObjectSetInteger(0, name, OBJPROP_BORDER_TYPE, BORDER_FLAT);
      ObjectSetInteger(0, name, OBJPROP_CORNER, CORNER_LEFT_UPPER);
   }
   
   if(ObjectFind(0, labelName) < 0) {
      ObjectCreate(0, labelName, OBJ_LABEL, 0, 0, 0);
      ObjectSetInteger(0, labelName, OBJPROP_XDISTANCE, x + 10);
      ObjectSetInteger(0, labelName, OBJPROP_YDISTANCE, y + 10);
      ObjectSetInteger(0, labelName, OBJPROP_COLOR, clrWhite);
      ObjectSetString(0, labelName, OBJPROP_FONT, "JetBrains Mono");
      ObjectSetInteger(0, labelName, OBJPROP_FONTSIZE, 9);
   }
   
   // Wrap text if too long
   string wrapped = "AI MENTOR: " + insight;
   if(StringLen(wrapped) > 60) wrapped = StringSubstr(wrapped, 0, 57) + "...";
   
   ObjectSetString(0, labelName, OBJPROP_TEXT, wrapped);
}

//+------------------------------------------------------------------+
//| Visualization Logic                                              |
//+------------------------------------------------------------------+
void UpdateChartVisuals(double obLevel, bool bullish) {
   // Draw Statistics Dashboard
   if(InpShowStats) {
      string stats = StringFormat("QuantNexus Terminal | Equity: $%.2f | Drawdown: %.2f%%", 
                                  AccountInfoDouble(ACCOUNT_EQUITY),
                                  (1.0 - AccountInfoDouble(ACCOUNT_EQUITY)/AccountInfoDouble(ACCOUNT_BALANCE))*100.0);
      DrawLabel("QN_Stats", stats, 10, 30, clrWhite);
   }
   
   // Draw Potential Setup Zone
   if(obLevel > 0) {
      color obColor = bullish ? InpColorBullishOB : InpColorBearishOB;
      DrawRectangle("QN_OB_Zone", TimeCurrent(), obLevel, TimeCurrent() + PeriodSeconds(InpHTF)*5, obLevel * 1.002, obColor);
      DrawLabel("QN_Setup_Info", StringFormat("POTENTIAL %s SETUP DETECTED", bullish ? "LONG" : "SHORT"), 10, 50, obColor);
   }
}

void DrawLabel(string name, string text, int x, int y, color clr) {
   if(ObjectFind(0, name) < 0) {
      ObjectCreate(0, name, OBJ_LABEL, 0, 0, 0);
   }
   ObjectSetString(0, name, OBJPROP_TEXT, text);
   ObjectSetInteger(0, name, OBJPROP_XDISTANCE, x);
   ObjectSetInteger(0, name, OBJPROP_YDISTANCE, y);
   ObjectSetInteger(0, name, OBJPROP_COLOR, clr);
   ObjectSetString(0, name, OBJPROP_FONT, "JetBrains Mono");
   ObjectSetInteger(0, name, OBJPROP_FONTSIZE, InpFontSize);
}

void DrawRectangle(string name, datetime t1, double p1, datetime t2, double p2, color clr) {
   if(ObjectFind(0, name) < 0) {
      ObjectCreate(0, name, OBJ_RECTANGLE, 0, t1, p1, t2, p2);
   } else {
      ObjectSetInteger(0, name, OBJPROP_TIME, 0, t1);
      ObjectSetDouble(0, name, OBJPROP_PRICE, 0, p1);
      ObjectSetInteger(0, name, OBJPROP_TIME, 1, t2);
      ObjectSetDouble(0, name, OBJPROP_PRICE, 1, p2);
   }
   ObjectSetInteger(0, name, OBJPROP_COLOR, clr);
   ObjectSetInteger(0, name, OBJPROP_FILL, true);
   ObjectSetInteger(0, name, OBJPROP_BACK, true);
}

//+------------------------------------------------------------------+
//| Risk Management Logic                                            |
//+------------------------------------------------------------------+
bool CheckRiskLimits() {
   double dailyProfit = AccountInfoDouble(ACCOUNT_PROFIT); 
   double equity = AccountInfoDouble(ACCOUNT_EQUITY);
   double balance = AccountInfoDouble(ACCOUNT_BALANCE);
   
   if(dailyProfit < -(balance * InpMaxDailyLoss / 100.0)) {
      Print("Daily Loss Limit Reached. Trading Halted.");
      return true;
   }
   return false;
}

//+------------------------------------------------------------------+
//| Market Structure Logic                                           |
//+------------------------------------------------------------------+
bool IdentifyStructure(ENUM_TIMEFRAMES tf) {
   MqlRates rates[];
   ArraySetAsSeries(rates, true);
   if(CopyRates(_Symbol, tf, 0, 100, rates) < 100) return false;
   
   bool isBullish = rates[1].close > rates[2].high; 
   return isBullish;
}

double FindUnmitigatedOB(ENUM_TIMEFRAMES tf) {
   MqlRates rates[];
   ArraySetAsSeries(rates, true);
   if(CopyRates(_Symbol, tf, 0, InpOrderBlockLookback, rates) < InpOrderBlockLookback) return 0;
   
   for(int i=1; i < InpOrderBlockLookback - 1; i++) {
      double bodySize = MathAbs(rates[i].open - rates[i].close);
      double prevBody = MathAbs(rates[i+1].open - rates[i+1].close);
      
      if(bodySize > prevBody * 2.0) {
         // Return the low of the candle before the impulsive move
         return rates[i+1].low; 
      }
   }
   return 0.0;
}

double FindOpposingLiquidity(bool buy) {
   MqlRates rates[];
   ArraySetAsSeries(rates, true);
   if(CopyRates(_Symbol, InpHTF, 0, InpOrderBlockLookback, rates) < InpOrderBlockLookback) return 0;
   
   double currentPrice = SymbolInfoDouble(_Symbol, SYMBOL_BID);
   
   for(int i=1; i < InpOrderBlockLookback - 1; i++) {
      // For a BUY trade, we look for Bearish OBs above (potential targets)
      if(buy) {
         if(rates[i].close < rates[i].open) { // Bearish candle
            double bodySize = rates[i].open - rates[i].close;
            double prevBody = MathAbs(rates[i+1].open - rates[i+1].close);
            if(bodySize > prevBody * 1.5) { 
               double target = rates[i+1].high;
               if(target > currentPrice) return target;
            }
         }
      }
      // For a SELL trade, we look for Bullish OBs below (potential targets)
      else {
         if(rates[i].close > rates[i].open) { // Bullish candle
            double bodySize = rates[i].close - rates[i].open;
            double prevBody = MathAbs(rates[i+1].open - rates[i+1].close);
            if(bodySize > prevBody * 1.5) {
               double target = rates[i+1].low;
               if(target < currentPrice && target > 0) return target;
            }
         }
      }
   }
   return 0;
}

//+------------------------------------------------------------------+
//| Confluence & Execution                                           |
//+------------------------------------------------------------------+
bool CheckConfluence(double obLevel, bool bullish) {
   if(obLevel <= 0) return false;
   
   double main[], sig[];
   CopyBuffer(handleStoch, 0, 0, 2, main);
   CopyBuffer(handleStoch, 1, 0, 2, sig);
   
   if(bullish && SymbolInfoDouble(_Symbol, SYMBOL_BID) <= obLevel * 1.001) {
      if(main[0] < 20 && main[0] > sig[0]) return true;
   }
   
   return false;
}

void ExecuteTrade(bool buy) {
   double riskAmount = AccountInfoDouble(ACCOUNT_BALANCE) * InpRiskPerTrade / 100.0;
   double atr[];
   CopyBuffer(handleATR, 0, 0, 1, atr);
   
   double entryPrice = buy ? SymbolInfoDouble(_Symbol, SYMBOL_ASK) : SymbolInfoDouble(_Symbol, SYMBOL_BID);
   double slDistance = atr[0] * InpATRMultiplier;
   double slPrice = buy ? (entryPrice - slDistance) : (entryPrice + slDistance);
   
   // Dynamic TP Calculation: Initially 2x SL distance
   double tpDistance = slDistance * 2.0;
   double tpPrice = buy ? (entryPrice + tpDistance) : (entryPrice - tpDistance);
   
   // Option to target opposing liquidity if it's closer
   double opposingLiquidity = FindOpposingLiquidity(buy);
   if(opposingLiquidity > 0) {
      if(buy && opposingLiquidity < tpPrice && opposingLiquidity > entryPrice) {
         tpPrice = opposingLiquidity;
         Print("Dynamic TP: Target adjusted to Bearish OB at ", tpPrice);
      } else if(!buy && opposingLiquidity > tpPrice && opposingLiquidity < entryPrice) {
         tpPrice = opposingLiquidity;
         Print("Dynamic TP: Target adjusted to Bullish OB at ", tpPrice);
      }
   }

   double tickSize = SymbolInfoDouble(_Symbol, SYMBOL_TRADE_TICK_SIZE);
   double lotSize = NormalizeDouble(riskAmount / (slDistance / tickSize * SymbolInfoDouble(_Symbol, SYMBOL_TRADE_TICK_VALUE)), 2);
   
   PrintFormat("QuantNexus EXECUTION | %s | Lots: %.2f | Entry: %.5f | SL: %.5f | TP: %.5f", 
               buy ? "BUY" : "SELL", lotSize, entryPrice, slPrice, tpPrice);
}
