import { useState, useEffect, useCallback } from "react";
import {
  AreaChart, Area, BarChart, Bar, LineChart, Line,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend
} from "recharts";

// ─── API CONFIG — change this to your Render URL after deploying ──────────────
const API = "http://localhost:8000";

// ─── Palette ──────────────────────────────────────────────────────────────────
const C = {
  bg:"#0a0c10",surface:"#111318",card:"#161b22",border:"#21262d",
  accent:"#f0a500",accentDim:"#f0a50022",green:"#3fb950",red:"#f85149",
  blue:"#58a6ff",purple:"#bc8cff",text:"#e6edf3",muted:"#7d8590",dim:"#30363d",
};

const months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

// ─── API Helpers ──────────────────────────────────────────────────────────────
async function apiFetch(path, options = {}) {
  const res = await fetch(`${API}${path}`, {
    headers: { "Content-Type": "application/json" },
    ...options,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || `API error ${res.status}`);
  }
  return res.json();
}

const apiGet    = (path)       => apiFetch(path);
const apiPost   = (path, body) => apiFetch(path, { method: "POST",   body: JSON.stringify(body) });
const apiPatch  = (path, body) => apiFetch(path, { method: "PATCH",  body: JSON.stringify(body) });
const apiDelete = (path)       => apiFetch(path, { method: "DELETE" });

// ─── Data Aggregators ─────────────────────────────────────────────────────────
const aggregateSalesByMonth = (sales) => {
  const map = {};
  months.forEach(m => { map[m] = { month: m, revenue: 0, units: 0 }; });
  sales.forEach(s => { if (map[s.month]) { map[s.month].revenue += s.amount; map[s.month].units += s.units; } });
  return months.map(m => map[m]);
};

const aggregateExpensesByMonth = (expenses) => {
  const map = {};
  months.forEach(m => { map[m] = { month: m, Operations: 0, Marketing: 0, Payroll: 0, Other: 0 }; });
  expenses.forEach(e => {
    if (!map[e.month]) return;
    const key = ["Operations","Marketing","Payroll"].includes(e.category) ? e.category : "Other";
    map[e.month][key] += e.amount;
  });
  return months.map(m => map[m]);
};

// ─── Helpers ──────────────────────────────────────────────────────────────────
const fmt     = n => n >= 1e6 ? `$${(n/1e6).toFixed(1)}M` : n >= 1000 ? `$${(n/1000).toFixed(0)}K` : `$${n}`;
const fmtFull = n => `$${Number(n).toLocaleString()}`;
const todayStr = () => new Date().toISOString().split("T")[0];

const employeeList = [
  "Sarah Mitchell","James Okonkwo","Priya Sharma","David Chen",
  "Amara Diallo","Tom Larsen","Fatima Al-Rashid","Marcus Webb",
];

// ─── UI Atoms ─────────────────────────────────────────────────────────────────
const KpiCard = ({ label, value, sub, color = C.accent, trend }) => (
  <div style={{ background:C.card,border:`1px solid ${C.border}`,borderRadius:8,padding:"18px 22px",position:"relative",overflow:"hidden" }}>
    <div style={{ position:"absolute",top:0,left:0,width:3,height:"100%",background:color }} />
    <div style={{ fontSize:10,color:C.muted,letterSpacing:2,textTransform:"uppercase",marginBottom:6 }}>{label}</div>
    <div style={{ fontSize:24,fontWeight:700,color:C.text,fontFamily:"'DM Mono',monospace" }}>{value}</div>
    <div style={{ fontSize:12,color:trend==="up"?C.green:trend==="down"?C.red:C.muted,marginTop:4 }}>
      {trend==="up"?"▲ ":trend==="down"?"▼ ":""}{sub}
    </div>
  </div>
);

const SectionHeader = ({ title, subtitle }) => (
  <div style={{ marginBottom:20 }}>
    <div style={{ display:"flex",alignItems:"center",gap:10 }}>
      <div style={{ width:4,height:20,background:C.accent,borderRadius:2 }} />
      <h2 style={{ margin:0,fontSize:16,fontWeight:700,color:C.text }}>{title}</h2>
    </div>
    {subtitle && <div style={{ fontSize:12,color:C.muted,marginTop:4,paddingLeft:14 }}>{subtitle}</div>}
  </div>
);

const Badge = ({ status }) => {
  const map = { ok:["In Stock",C.green],low:["Low Stock",C.accent],out:["Out",C.red] };
  const [label,color] = map[status]||[status,C.muted];
  return <span style={{ fontSize:10,fontWeight:600,letterSpacing:1,textTransform:"uppercase",padding:"3px 8px",borderRadius:4,background:color+"22",color }}>{label}</span>;
};

const ChartCard = ({ title, children, height=220 }) => (
  <div style={{ background:C.card,border:`1px solid ${C.border}`,borderRadius:8,padding:"18px 18px 10px" }}>
    <div style={{ fontSize:11,color:C.muted,letterSpacing:1.5,textTransform:"uppercase",marginBottom:14 }}>{title}</div>
    <div style={{ height }}>{children}</div>
  </div>
);

const Tip = ({ active, payload, label }) => {
  if (!active||!payload?.length) return null;
  return (
    <div style={{ background:C.surface,border:`1px solid ${C.border}`,borderRadius:6,padding:"10px 14px",fontSize:12 }}>
      <div style={{ color:C.muted,marginBottom:6 }}>{label}</div>
      {payload.map((p,i)=><div key={i} style={{ color:p.color,marginBottom:2 }}>{p.name}: <strong>{typeof p.value==="number"&&p.value>999?fmtFull(p.value):p.value}</strong></div>)}
    </div>
  );
};

const Toast = ({ msg, color }) => (
  <div style={{ position:"fixed",bottom:28,right:28,background:C.card,border:`1px solid ${color}`,color,borderRadius:8,padding:"12px 20px",fontSize:13,fontWeight:600,boxShadow:`0 4px 20px ${color}33`,zIndex:9999,animation:"fadeIn 0.2s ease" }}>
    {msg}
  </div>
);

const Spinner = () => (
  <div style={{ display:"flex",alignItems:"center",gap:8,color:C.muted,fontSize:13 }}>
    <div style={{ width:14,height:14,border:`2px solid ${C.dim}`,borderTop:`2px solid ${C.accent}`,borderRadius:"50%",animation:"spin 0.8s linear infinite" }} />
    Loading…
  </div>
);

const inputStyle = { width:"100%",background:C.surface,border:`1px solid ${C.border}`,borderRadius:6,color:C.text,padding:"9px 12px",fontSize:13,outline:"none",boxSizing:"border-box",fontFamily:"'IBM Plex Sans',sans-serif" };
const Field = ({ label, children }) => (
  <div style={{ marginBottom:14 }}>
    <label style={{ fontSize:11,color:C.muted,letterSpacing:1,textTransform:"uppercase",marginBottom:5,display:"block" }}>{label}</label>
    {children}
  </div>
);

// ── API Status Banner ─────────────────────────────────────────────────────────
const ApiBanner = ({ status }) => {
  const cfg = {
    ok:      { color: C.green,  icon: "●", text: `Connected to API — ${API}` },
    error:   { color: C.red,    icon: "✕", text: `API offline — start the server at ${API}` },
    loading: { color: C.accent, icon: "◌", text: "Connecting to API…" },
  }[status];
  return (
    <div style={{ padding:"9px 16px",background:cfg.color+"10",border:`1px solid ${cfg.color}33`,borderRadius:7,fontSize:12,color:cfg.color,display:"flex",alignItems:"center",gap:8,marginBottom:20 }}>
      <span>{cfg.icon}</span>{cfg.text}
    </div>
  );
};

// ─── DATA ENTRY ───────────────────────────────────────────────────────────────
const DataEntry = ({ inventory, onRefresh, apiStatus }) => {
  const [tab, setTab]         = useState("sale");
  const [toast, setToast]     = useState(null);
  const [loading, setLoading] = useState(false);
  const [sale, setSale]       = useState({ date:todayStr(),product:"",amount:"",units:"",rep:"",notes:"" });
  const [expense, setExpense] = useState({ date:todayStr(),category:"Operations",amount:"",vendor:"",description:"",submitted_by:"" });
  const [stock, setStock]     = useState({ sku:"",qty:"",movement_type:"add",reason:"",received_by:"" });

  const showToast = (msg, color=C.green) => { setToast({msg,color}); setTimeout(()=>setToast(null),3000); };

  const submitSale = async () => {
    if (!sale.product||!sale.amount||!sale.units) return showToast("✕ Fill in all required fields", C.red);
    setLoading(true);
    try {
      await apiPost("/sales", { ...sale, amount:Number(sale.amount), units:Number(sale.units) });
      setSale({ date:todayStr(),product:"",amount:"",units:"",rep:"",notes:"" });
      showToast("✓ Sale saved to database");
      onRefresh();
    } catch(e) { showToast(`✕ ${e.message}`, C.red); }
    setLoading(false);
  };

  const submitExpense = async () => {
    if (!expense.amount||!expense.vendor||!expense.description) return showToast("✕ Fill in all required fields", C.red);
    setLoading(true);
    try {
      await apiPost("/expenses", { ...expense, amount:Number(expense.amount) });
      setExpense({ date:todayStr(),category:"Operations",amount:"",vendor:"",description:"",submitted_by:"" });
      showToast("✓ Expense saved to database");
      onRefresh();
    } catch(e) { showToast(`✕ ${e.message}`, C.red); }
    setLoading(false);
  };

  const submitStock = async () => {
    if (!stock.sku||!stock.qty) return showToast("✕ Fill in all required fields", C.red);
    setLoading(true);
    try {
      await apiPatch(`/inventory/${stock.sku}/stock`, { movement_type:stock.movement_type, qty:Number(stock.qty), reason:stock.reason, received_by:stock.received_by });
      setStock({ sku:"",qty:"",movement_type:"add",reason:"",received_by:"" });
      showToast("✓ Stock updated in database");
      onRefresh();
    } catch(e) { showToast(`✕ ${e.message}`, C.red); }
    setLoading(false);
  };

  const selectedItem = inventory.find(i=>i.sku===stock.sku);
  const previewStock = selectedItem && stock.qty
    ? Math.max(0, selectedItem.stock + (stock.movement_type==="remove" ? -Number(stock.qty) : Number(stock.qty)))
    : null;

  return (
    <div>
      {toast && <Toast msg={toast.msg} color={toast.color} />}
      <SectionHeader title="Data Entry" subtitle="Entries are written directly to the database via the API" />
      <ApiBanner status={apiStatus} />

      <div style={{ display:"flex",gap:8,marginBottom:24 }}>
        {[["sale","↑ Log a Sale",C.green],["expense","↓ Record Expense",C.red],["stock","▣ Update Stock",C.blue]].map(([id,label,color])=>(
          <button key={id} onClick={()=>setTab(id)} style={{ padding:"10px 20px",borderRadius:7,border:`1px solid ${tab===id?color:C.border}`,background:tab===id?color+"18":"transparent",color:tab===id?color:C.muted,fontWeight:tab===id?700:400,fontSize:13,cursor:"pointer",fontFamily:"'IBM Plex Sans',sans-serif" }}>{label}</button>
        ))}
      </div>

      <div style={{ display:"grid",gridTemplateColumns:"1fr 1fr",gap:20 }}>

        {tab==="sale" && (<>
          <div style={{ background:C.card,border:`1px solid ${C.border}`,borderRadius:10,padding:24 }}>
            <div style={{ fontSize:13,fontWeight:700,color:C.green,marginBottom:20 }}><span style={{ background:C.green+"18",padding:"4px 12px",borderRadius:6 }}>↑ New Sale Entry</span></div>
            <Field label="Date *"><input type="date" style={inputStyle} value={sale.date} onChange={e=>setSale({...sale,date:e.target.value})} /></Field>
            <Field label="Product / Service *"><input type="text" style={inputStyle} placeholder="e.g. Premium Widget A" value={sale.product} onChange={e=>setSale({...sale,product:e.target.value})} /></Field>
            <div style={{ display:"grid",gridTemplateColumns:"1fr 1fr",gap:12 }}>
              <Field label="Revenue ($) *"><input type="number" style={inputStyle} placeholder="0.00" value={sale.amount} onChange={e=>setSale({...sale,amount:e.target.value})} /></Field>
              <Field label="Units Sold *"><input type="number" style={inputStyle} placeholder="0" value={sale.units} onChange={e=>setSale({...sale,units:e.target.value})} /></Field>
            </div>
            <Field label="Sales Rep">
              <select style={inputStyle} value={sale.rep} onChange={e=>setSale({...sale,rep:e.target.value})}>
                <option value="">— Select rep —</option>
                {employeeList.map(e=><option key={e}>{e}</option>)}
              </select>
            </Field>
            <Field label="Notes"><textarea style={{...inputStyle,resize:"vertical",minHeight:64}} placeholder="Additional details..." value={sale.notes} onChange={e=>setSale({...sale,notes:e.target.value})} /></Field>
            <button onClick={submitSale} disabled={loading||apiStatus!=="ok"} style={{ width:"100%",padding:"11px",borderRadius:7,border:"none",background:apiStatus==="ok"?C.green:C.dim,color:"#000",fontWeight:700,fontSize:14,cursor:apiStatus==="ok"?"pointer":"not-allowed",opacity:loading?0.7:1 }}>
              {loading?"Saving…":"💾 Submit to Database"}
            </button>
          </div>
          <div style={{ background:C.card,border:`1px solid ${C.border}`,borderRadius:10,padding:24 }}>
            <div style={{ fontSize:11,color:C.muted,letterSpacing:1.5,textTransform:"uppercase",marginBottom:14 }}>API Endpoint</div>
            <div style={{ background:C.surface,borderRadius:7,padding:"14px 16px",fontFamily:"'DM Mono',monospace",fontSize:12,color:C.blue,marginBottom:16 }}>
              POST {API}/sales
            </div>
            <div style={{ fontSize:11,color:C.muted,letterSpacing:1.5,textTransform:"uppercase",marginBottom:10 }}>Request Body</div>
            <pre style={{ background:C.surface,borderRadius:7,padding:"14px 16px",fontSize:11,color:C.muted,margin:0,overflowX:"auto" }}>{JSON.stringify({date:"2024-12-01",product:"Widget A",amount:5000,units:50,rep:"Name",notes:"optional"},null,2)}</pre>
            <div style={{ marginTop:14,padding:"12px 14px",background:C.accentDim,borderRadius:7,fontSize:12,color:C.accent }}>
              💡 Entries go straight to the SQLite database via FastAPI. View all at <strong>{API}/docs</strong>
            </div>
          </div>
        </>)}

        {tab==="expense" && (<>
          <div style={{ background:C.card,border:`1px solid ${C.border}`,borderRadius:10,padding:24 }}>
            <div style={{ fontSize:13,fontWeight:700,color:C.red,marginBottom:20 }}><span style={{ background:C.red+"18",padding:"4px 12px",borderRadius:6 }}>↓ New Expense Entry</span></div>
            <Field label="Date *"><input type="date" style={inputStyle} value={expense.date} onChange={e=>setExpense({...expense,date:e.target.value})} /></Field>
            <Field label="Category *">
              <select style={inputStyle} value={expense.category} onChange={e=>setExpense({...expense,category:e.target.value})}>
                {["Operations","Marketing","Payroll","Travel","Utilities","Office Supplies","Software","Other"].map(c=><option key={c}>{c}</option>)}
              </select>
            </Field>
            <Field label="Amount ($) *"><input type="number" style={inputStyle} placeholder="0.00" value={expense.amount} onChange={e=>setExpense({...expense,amount:e.target.value})} /></Field>
            <Field label="Vendor *"><input type="text" style={inputStyle} placeholder="e.g. AWS, Office Depot" value={expense.vendor} onChange={e=>setExpense({...expense,vendor:e.target.value})} /></Field>
            <Field label="Description *"><textarea style={{...inputStyle,resize:"vertical",minHeight:64}} placeholder="What was this for?" value={expense.description} onChange={e=>setExpense({...expense,description:e.target.value})} /></Field>
            <Field label="Submitted By">
              <select style={inputStyle} value={expense.submitted_by} onChange={e=>setExpense({...expense,submitted_by:e.target.value})}>
                <option value="">— Select employee —</option>
                {employeeList.map(e=><option key={e}>{e}</option>)}
              </select>
            </Field>
            <button onClick={submitExpense} disabled={loading||apiStatus!=="ok"} style={{ width:"100%",padding:"11px",borderRadius:7,border:"none",background:apiStatus==="ok"?C.red:C.dim,color:"#fff",fontWeight:700,fontSize:14,cursor:apiStatus==="ok"?"pointer":"not-allowed",opacity:loading?0.7:1 }}>
              {loading?"Saving…":"💾 Submit to Database"}
            </button>
          </div>
          <div style={{ background:C.card,border:`1px solid ${C.border}`,borderRadius:10,padding:24 }}>
            <div style={{ fontSize:11,color:C.muted,letterSpacing:1.5,textTransform:"uppercase",marginBottom:14 }}>API Endpoint</div>
            <div style={{ background:C.surface,borderRadius:7,padding:"14px 16px",fontFamily:"'DM Mono',monospace",fontSize:12,color:C.blue,marginBottom:16 }}>POST {API}/expenses</div>
            <pre style={{ background:C.surface,borderRadius:7,padding:"14px 16px",fontSize:11,color:C.muted,margin:0,overflowX:"auto" }}>{JSON.stringify({date:"2024-12-01",category:"Operations",amount:2500,vendor:"AWS",description:"Cloud hosting",submitted_by:"Name"},null,2)}</pre>
          </div>
        </>)}

        {tab==="stock" && (<>
          <div style={{ background:C.card,border:`1px solid ${C.border}`,borderRadius:10,padding:24 }}>
            <div style={{ fontSize:13,fontWeight:700,color:C.blue,marginBottom:20 }}><span style={{ background:C.blue+"18",padding:"4px 12px",borderRadius:6 }}>▣ Stock Movement</span></div>
            <Field label="Product (SKU) *">
              <select style={inputStyle} value={stock.sku} onChange={e=>setStock({...stock,sku:e.target.value})}>
                <option value="">— Select product —</option>
                {inventory.map(i=><option key={i.sku} value={i.sku}>{i.sku} — {i.name} (Stock: {i.stock})</option>)}
              </select>
            </Field>
            <Field label="Movement Type *">
              <div style={{ display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:8 }}>
                {[["add","Received",C.green],["remove","Dispatched",C.red],["adjust","Adjust",C.accent]].map(([val,label,color])=>(
                  <button key={val} onClick={()=>setStock({...stock,movement_type:val})} style={{ padding:"9px",borderRadius:6,border:`1px solid ${stock.movement_type===val?color:C.border}`,background:stock.movement_type===val?color+"22":"transparent",color:stock.movement_type===val?color:C.muted,fontSize:12,fontWeight:600,cursor:"pointer",fontFamily:"'IBM Plex Sans',sans-serif" }}>{label}</button>
                ))}
              </div>
            </Field>
            <Field label="Quantity *"><input type="number" style={inputStyle} placeholder="Enter quantity" value={stock.qty} onChange={e=>setStock({...stock,qty:e.target.value})} /></Field>
            <Field label="Reason / Reference"><input type="text" style={inputStyle} placeholder="e.g. PO-2024-045" value={stock.reason} onChange={e=>setStock({...stock,reason:e.target.value})} /></Field>
            <Field label="Processed By">
              <select style={inputStyle} value={stock.received_by} onChange={e=>setStock({...stock,received_by:e.target.value})}>
                <option value="">— Select employee —</option>
                {employeeList.map(e=><option key={e}>{e}</option>)}
              </select>
            </Field>
            {selectedItem && stock.qty && previewStock!==null && (
              <div style={{ background:C.surface,border:`1px solid ${C.border}`,borderRadius:7,padding:"12px 14px",marginBottom:14,fontSize:12 }}>
                <div style={{ color:C.muted,marginBottom:6,fontSize:11,textTransform:"uppercase",letterSpacing:1 }}>Preview</div>
                <div style={{ display:"flex",justifyContent:"space-between" }}>
                  <span style={{ color:C.text }}>{selectedItem.name}</span>
                  <span style={{ fontFamily:"'DM Mono',monospace" }}>
                    <span style={{ color:C.muted }}>{selectedItem.stock}</span>
                    <span style={{ color:C.accent }}> → </span>
                    <span style={{ color:previewStock===0?C.red:previewStock<selectedItem.reorder?C.accent:C.green }}>{previewStock}</span>
                  </span>
                </div>
              </div>
            )}
            <button onClick={submitStock} disabled={loading||apiStatus!=="ok"} style={{ width:"100%",padding:"11px",borderRadius:7,border:"none",background:apiStatus==="ok"?C.blue:C.dim,color:"#000",fontWeight:700,fontSize:14,cursor:apiStatus==="ok"?"pointer":"not-allowed",opacity:loading?0.7:1 }}>
              {loading?"Saving…":"💾 Update Database"}
            </button>
          </div>
          <div style={{ background:C.card,border:`1px solid ${C.border}`,borderRadius:10,padding:24 }}>
            <div style={{ fontSize:11,color:C.muted,letterSpacing:1.5,textTransform:"uppercase",marginBottom:14 }}>Current Stock</div>
            <div style={{ display:"grid",gap:8 }}>
              {inventory.map(item=>(
                <div key={item.sku} style={{ display:"flex",justifyContent:"space-between",alignItems:"center",padding:"10px 14px",background:C.surface,borderRadius:6,border:`1px solid ${item.sku===stock.sku?C.blue:C.border}` }}>
                  <div>
                    <div style={{ fontSize:12,color:C.text }}>{item.name}</div>
                    <div style={{ fontSize:10,color:C.muted,marginTop:2 }}>{item.sku} · Reorder at {item.reorder}</div>
                  </div>
                  <div style={{ textAlign:"right" }}>
                    <div style={{ fontFamily:"'DM Mono',monospace",fontSize:15,color:item.status==="out"?C.red:item.status==="low"?C.accent:C.text }}>{item.stock.toLocaleString()}</div>
                    <Badge status={item.status} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </>)}
      </div>
    </div>
  );
};

// ─── DASHBOARD PAGES ──────────────────────────────────────────────────────────
const Overview = ({ sales, expenses, inventory, summary }) => {
  const sd = aggregateSalesByMonth(sales);
  const ed = aggregateExpensesByMonth(expenses);
  const plData = sd.map((s,i)=>{ const exp=ed[i].Operations+ed[i].Marketing+ed[i].Payroll+ed[i].Other; return { month:s.month,revenue:s.revenue,expenses:exp,profit:s.revenue-exp }; });
  return (
    <div>
      <SectionHeader title="Business Overview" subtitle="Live data from the database" />
      <div style={{ display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:12,marginBottom:22 }}>
        <KpiCard label="Total Revenue" value={fmt(summary?.total_revenue||0)} sub="All time" trend="up" color={C.green} />
        <KpiCard label="Total Expenses" value={fmt(summary?.total_expenses||0)} sub="All time" color={C.red} />
        <KpiCard label="Net Profit" value={fmt(summary?.net_profit||0)} sub={`Margin ${summary?.profit_margin||0}%`} trend="up" color={C.accent} />
        <KpiCard label="Inventory Value" value={fmt(summary?.inventory_value||0)} sub="At cost" color={C.blue} />
      </div>
      <div style={{ display:"grid",gridTemplateColumns:"2fr 1fr",gap:16 }}>
        <ChartCard title="Revenue vs Expenses — Monthly" height={240}>
          <ResponsiveContainer>
            <AreaChart data={plData}>
              <defs>
                <linearGradient id="rg" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor={C.green} stopOpacity={0.3}/><stop offset="95%" stopColor={C.green} stopOpacity={0}/></linearGradient>
                <linearGradient id="eg" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor={C.red} stopOpacity={0.2}/><stop offset="95%" stopColor={C.red} stopOpacity={0}/></linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke={C.dim} />
              <XAxis dataKey="month" tick={{fill:C.muted,fontSize:11}} axisLine={false} tickLine={false} />
              <YAxis tick={{fill:C.muted,fontSize:11}} axisLine={false} tickLine={false} tickFormatter={v=>`$${v/1000}K`} />
              <Tooltip content={<Tip />} />
              <Area type="monotone" dataKey="revenue" stroke={C.green} fill="url(#rg)" strokeWidth={2} name="Revenue" />
              <Area type="monotone" dataKey="expenses" stroke={C.red} fill="url(#eg)" strokeWidth={2} name="Expenses" />
            </AreaChart>
          </ResponsiveContainer>
        </ChartCard>
        <ChartCard title="Stock Alerts" height={240}>
          <div style={{ display:"grid",gap:7,paddingTop:4 }}>
            {inventory.map(item=>(
              <div key={item.sku} style={{ display:"flex",justifyContent:"space-between",alignItems:"center",padding:"8px 12px",background:C.surface,borderRadius:6 }}>
                <div style={{ fontSize:12,color:C.text }}>{item.name.split(" ").slice(0,2).join(" ")}</div>
                <div style={{ display:"flex",alignItems:"center",gap:8 }}>
                  <span style={{ fontFamily:"'DM Mono',monospace",fontSize:12,color:item.status==="out"?C.red:item.status==="low"?C.accent:C.muted }}>{item.stock}</span>
                  <Badge status={item.status} />
                </div>
              </div>
            ))}
          </div>
        </ChartCard>
      </div>
    </div>
  );
};

const Sales = ({ sales }) => {
  const sd = aggregateSalesByMonth(sales);
  return (
    <div>
      <SectionHeader title="Sales & Revenue" subtitle="All sales from the database" />
      <div style={{ display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:12,marginBottom:22 }}>
        <KpiCard label="Total Revenue" value={fmt(sales.reduce((s,d)=>s+d.amount,0))} sub="All entries" trend="up" color={C.green} />
        <KpiCard label="Total Units" value={sales.reduce((s,d)=>s+d.units,0).toLocaleString()} sub="All time" color={C.blue} />
        <KpiCard label="Sale Entries" value={sales.length} sub="In database" color={C.accent} />
      </div>
      <div style={{ display:"grid",gridTemplateColumns:"1fr 1fr",gap:16,marginBottom:16 }}>
        <ChartCard title="Monthly Revenue" height={230}>
          <ResponsiveContainer>
            <BarChart data={sd}>
              <CartesianGrid strokeDasharray="3 3" stroke={C.dim} />
              <XAxis dataKey="month" tick={{fill:C.muted,fontSize:11}} axisLine={false} tickLine={false} />
              <YAxis tick={{fill:C.muted,fontSize:11}} axisLine={false} tickLine={false} tickFormatter={v=>`$${v/1000}K`} />
              <Tooltip content={<Tip />} />
              <Bar dataKey="revenue" fill={C.green} name="Revenue" radius={[3,3,0,0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
        <ChartCard title="Units Sold" height={230}>
          <ResponsiveContainer>
            <LineChart data={sd}>
              <CartesianGrid strokeDasharray="3 3" stroke={C.dim} />
              <XAxis dataKey="month" tick={{fill:C.muted,fontSize:11}} axisLine={false} tickLine={false} />
              <YAxis tick={{fill:C.muted,fontSize:11}} axisLine={false} tickLine={false} />
              <Tooltip content={<Tip />} />
              <Line type="monotone" dataKey="units" stroke={C.accent} strokeWidth={2} dot={{fill:C.accent,r:3}} name="Units" />
            </LineChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>
      <div style={{ background:C.card,border:`1px solid ${C.border}`,borderRadius:8,overflow:"hidden" }}>
        <div style={{ maxHeight:320,overflowY:"auto" }}>
          <table style={{ width:"100%",borderCollapse:"collapse",fontSize:13 }}>
            <thead style={{ position:"sticky",top:0,background:C.surface }}>
              <tr>{["Date","Product","Amount","Units","Rep","Notes"].map(h=><th key={h} style={{ padding:"10px 16px",textAlign:"left",color:C.muted,fontWeight:600,fontSize:11,letterSpacing:1,textTransform:"uppercase" }}>{h}</th>)}</tr>
            </thead>
            <tbody>
              {sales.map(s=>(
                <tr key={s.id} style={{ borderTop:`1px solid ${C.border}` }}>
                  <td style={{ padding:"10px 16px",color:C.muted,fontFamily:"'DM Mono',monospace",fontSize:12 }}>{String(s.date)}</td>
                  <td style={{ padding:"10px 16px",color:C.text }}>{s.product}</td>
                  <td style={{ padding:"10px 16px",color:C.green,fontFamily:"'DM Mono',monospace" }}>{fmtFull(s.amount)}</td>
                  <td style={{ padding:"10px 16px",color:C.text }}>{s.units}</td>
                  <td style={{ padding:"10px 16px",color:C.muted }}>{s.rep||"—"}</td>
                  <td style={{ padding:"10px 16px",color:C.muted,fontSize:12 }}>{s.notes||"—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

const Expenses = ({ expenses }) => {
  const ed = aggregateExpensesByMonth(expenses);
  const catTotal = cat => expenses.filter(e=>(["Operations","Marketing","Payroll"].includes(e.category)?e.category:"Other")===cat).reduce((s,e)=>s+e.amount,0);
  return (
    <div>
      <SectionHeader title="Expenses" subtitle="All expenses from the database" />
      <div style={{ display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:12,marginBottom:22 }}>
        {[["Operations",C.blue],["Marketing",C.purple],["Payroll",C.accent],["Other",C.muted]].map(([cat,color])=>(
          <KpiCard key={cat} label={cat} value={fmt(catTotal(cat))} sub="Total" color={color} />
        ))}
      </div>
      <ChartCard title="Monthly Expense Breakdown" height={260}>
        <ResponsiveContainer>
          <BarChart data={ed}>
            <CartesianGrid strokeDasharray="3 3" stroke={C.dim} />
            <XAxis dataKey="month" tick={{fill:C.muted,fontSize:11}} axisLine={false} tickLine={false} />
            <YAxis tick={{fill:C.muted,fontSize:11}} axisLine={false} tickLine={false} tickFormatter={v=>`$${v/1000}K`} />
            <Tooltip content={<Tip />} />
            <Bar dataKey="Payroll"    stackId="a" fill={C.accent} name="Payroll" />
            <Bar dataKey="Operations" stackId="a" fill={C.blue}   name="Operations" />
            <Bar dataKey="Marketing"  stackId="a" fill={C.purple} name="Marketing" />
            <Bar dataKey="Other"      stackId="a" fill={C.dim}    name="Other" radius={[3,3,0,0]} />
          </BarChart>
        </ResponsiveContainer>
      </ChartCard>
      <div style={{ marginTop:16,background:C.card,border:`1px solid ${C.border}`,borderRadius:8,overflow:"hidden" }}>
        <div style={{ maxHeight:300,overflowY:"auto" }}>
          <table style={{ width:"100%",borderCollapse:"collapse",fontSize:13 }}>
            <thead style={{ position:"sticky",top:0,background:C.surface }}>
              <tr>{["Date","Category","Amount","Vendor","Description","By"].map(h=><th key={h} style={{ padding:"10px 16px",textAlign:"left",color:C.muted,fontWeight:600,fontSize:11,letterSpacing:1,textTransform:"uppercase" }}>{h}</th>)}</tr>
            </thead>
            <tbody>
              {expenses.map(e=>(
                <tr key={e.id} style={{ borderTop:`1px solid ${C.border}` }}>
                  <td style={{ padding:"10px 16px",color:C.muted,fontFamily:"'DM Mono',monospace",fontSize:12 }}>{String(e.date)}</td>
                  <td style={{ padding:"10px 16px" }}><span style={{ fontSize:11,padding:"2px 8px",borderRadius:4,background:C.blue+"22",color:C.blue }}>{e.category}</span></td>
                  <td style={{ padding:"10px 16px",color:C.red,fontFamily:"'DM Mono',monospace" }}>{fmtFull(e.amount)}</td>
                  <td style={{ padding:"10px 16px",color:C.text }}>{e.vendor}</td>
                  <td style={{ padding:"10px 16px",color:C.muted,fontSize:12 }}>{e.description}</td>
                  <td style={{ padding:"10px 16px",color:C.muted }}>{e.submitted_by||"—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

const Inventory = ({ inventory }) => (
  <div>
    <SectionHeader title="Inventory & Stock" subtitle="Live from database — updated via API" />
    <div style={{ display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:12,marginBottom:22 }}>
      <KpiCard label="Total SKUs" value={inventory.length} sub="Products" color={C.blue} />
      <KpiCard label="Total Value" value={fmt(inventory.reduce((s,i)=>s+i.stock*i.unit_cost,0))} sub="At cost" color={C.green} />
      <KpiCard label="Low Stock" value={inventory.filter(i=>i.status==="low").length} sub="Below reorder" color={C.accent} trend="down" />
      <KpiCard label="Out of Stock" value={inventory.filter(i=>i.status==="out").length} sub="Action needed" color={C.red} trend="down" />
    </div>
    <div style={{ background:C.card,border:`1px solid ${C.border}`,borderRadius:8,overflow:"hidden",marginBottom:16 }}>
      <table style={{ width:"100%",borderCollapse:"collapse",fontSize:13 }}>
        <thead><tr style={{ background:C.surface }}>{["SKU","Product","Stock","Reorder","Unit Cost","Value","Status"].map(h=><th key={h} style={{ padding:"12px 16px",textAlign:"left",color:C.muted,fontWeight:600,fontSize:11,letterSpacing:1,textTransform:"uppercase" }}>{h}</th>)}</tr></thead>
        <tbody>
          {inventory.map(item=>(
            <tr key={item.id} style={{ borderTop:`1px solid ${C.border}` }}>
              <td style={{ padding:"12px 16px",color:C.muted,fontFamily:"'DM Mono',monospace",fontSize:12 }}>{item.sku}</td>
              <td style={{ padding:"12px 16px",color:C.text }}>{item.name}</td>
              <td style={{ padding:"12px 16px",color:item.stock===0?C.red:item.stock<item.reorder?C.accent:C.text,fontFamily:"'DM Mono',monospace" }}>{item.stock.toLocaleString()}</td>
              <td style={{ padding:"12px 16px",color:C.muted,fontFamily:"'DM Mono',monospace" }}>{item.reorder}</td>
              <td style={{ padding:"12px 16px",color:C.muted,fontFamily:"'DM Mono',monospace" }}>{fmtFull(item.unit_cost)}</td>
              <td style={{ padding:"12px 16px",color:C.green,fontFamily:"'DM Mono',monospace" }}>{fmtFull(item.stock*item.unit_cost)}</td>
              <td style={{ padding:"12px 16px" }}><Badge status={item.status} /></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
    <ChartCard title="Stock vs Reorder Points" height={200}>
      <ResponsiveContainer>
        <BarChart data={inventory.map(i=>({name:i.sku,stock:i.stock,reorder:i.reorder}))}>
          <CartesianGrid strokeDasharray="3 3" stroke={C.dim} />
          <XAxis dataKey="name" tick={{fill:C.muted,fontSize:11}} axisLine={false} tickLine={false} />
          <YAxis tick={{fill:C.muted,fontSize:11}} axisLine={false} tickLine={false} />
          <Tooltip content={<Tip />} />
          <Bar dataKey="stock"   fill={C.blue}   name="Stock"   radius={[3,3,0,0]} />
          <Bar dataKey="reorder" fill={C.accent} name="Reorder" radius={[3,3,0,0]} />
        </BarChart>
      </ResponsiveContainer>
    </ChartCard>
  </div>
);

const ProfitLoss = ({ sales, expenses }) => {
  const sd = aggregateSalesByMonth(sales);
  const ed = aggregateExpensesByMonth(expenses);
  const plData = sd.map((s,i)=>{ const exp=ed[i].Operations+ed[i].Marketing+ed[i].Payroll+ed[i].Other; return { month:s.month,revenue:s.revenue,expenses:exp,profit:s.revenue-exp }; });
  const ytdRev=plData.reduce((s,d)=>s+d.revenue,0), ytdExp=plData.reduce((s,d)=>s+d.expenses,0);
  return (
    <div>
      <SectionHeader title="Profit & Loss" subtitle="Calculated from all database entries" />
      <div style={{ display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:12,marginBottom:22 }}>
        <KpiCard label="Total Revenue" value={fmt(ytdRev)} sub="All sales" trend="up" color={C.green} />
        <KpiCard label="Total Expenses" value={fmt(ytdExp)} sub="All categories" color={C.red} />
        <KpiCard label="Net Profit" value={fmt(ytdRev-ytdExp)} sub={`Margin ${ytdRev?((ytdRev-ytdExp)/ytdRev*100).toFixed(1):0}%`} trend="up" color={C.accent} />
      </div>
      <ChartCard title="Monthly P&L" height={270}>
        <ResponsiveContainer>
          <BarChart data={plData}>
            <CartesianGrid strokeDasharray="3 3" stroke={C.dim} />
            <XAxis dataKey="month" tick={{fill:C.muted,fontSize:11}} axisLine={false} tickLine={false} />
            <YAxis tick={{fill:C.muted,fontSize:11}} axisLine={false} tickLine={false} tickFormatter={v=>`$${v/1000}K`} />
            <Tooltip content={<Tip />} />
            <Bar dataKey="revenue"  fill={C.green}  name="Revenue"  radius={[3,3,0,0]} />
            <Bar dataKey="expenses" fill={C.red}    name="Expenses" radius={[3,3,0,0]} />
            <Bar dataKey="profit"   fill={C.accent} name="Profit"   radius={[3,3,0,0]} />
          </BarChart>
        </ResponsiveContainer>
      </ChartCard>
    </div>
  );
};

// ─── MAIN APP ─────────────────────────────────────────────────────────────────
const PAGES = [
  { id:"overview",  label:"Overview",   icon:"⬡", highlight:false },
  { id:"entry",     label:"Data Entry", icon:"✎", highlight:true  },
  { id:"sales",     label:"Sales",      icon:"↑", highlight:false },
  { id:"expenses",  label:"Expenses",   icon:"↓", highlight:false },
  { id:"inventory", label:"Inventory",  icon:"▣", highlight:false },
  { id:"pl",        label:"P&L",        icon:"≋", highlight:false },
];

export default function BizMonitor() {
  const [active, setActive]       = useState("overview");
  const [sales, setSales]         = useState([]);
  const [expenses, setExpenses]   = useState([]);
  const [inventory, setInventory] = useState([]);
  const [summary, setSummary]     = useState(null);
  const [apiStatus, setApiStatus] = useState("loading");
  const [lastRefresh, setLastRefresh] = useState(null);

  const loadAll = useCallback(async () => {
    try {
      const [s, e, inv, sum] = await Promise.all([
        apiGet("/sales"),
        apiGet("/expenses"),
        apiGet("/inventory"),
        apiGet("/summary"),
      ]);
      setSales(s);
      setExpenses(e);
      setInventory(inv);
      setSummary(sum);
      setApiStatus("ok");
      setLastRefresh(new Date());
    } catch {
      setApiStatus("error");
    }
  }, []);

  useEffect(() => { loadAll(); }, [loadAll]);

  useEffect(() => {
    const t = setInterval(loadAll, 30000);
    return () => clearInterval(t);
  }, [loadAll]);

  const pageMap = {
    overview:  <Overview  sales={sales} expenses={expenses} inventory={inventory} summary={summary} />,
    entry:     <DataEntry inventory={inventory} onRefresh={loadAll} apiStatus={apiStatus} />,
    sales:     <Sales     sales={sales} />,
    expenses:  <Expenses  expenses={expenses} />,
    inventory: <Inventory inventory={inventory} />,
    pl:        <ProfitLoss sales={sales} expenses={expenses} />,
  };

  return (
    <div style={{ display:"flex",height:"100vh",background:C.bg,color:C.text,fontFamily:"'IBM Plex Sans',system-ui,sans-serif",fontSize:14 }}>
      <link href="https://fonts.googleapis.com/css2?family=IBM+Plex+Sans:wght@400;500;600;700&family=DM+Mono:wght@400;500&display=swap" rel="stylesheet" />
      <style>{`*{box-sizing:border-box}@keyframes fadeIn{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:translateY(0)}}@keyframes spin{to{transform:rotate(360deg)}}input[type=date]::-webkit-calendar-picker-indicator{filter:invert(0.5)}select option{background:#161b22}`}</style>

      {/* Sidebar */}
      <div style={{ width:220,background:C.surface,borderRight:`1px solid ${C.border}`,display:"flex",flexDirection:"column",flexShrink:0 }}>
        <div style={{ padding:"22px 20px 18px",borderBottom:`1px solid ${C.border}` }}>
          <div style={{ display:"flex",alignItems:"center",gap:10 }}>
            <div style={{ width:32,height:32,background:C.accent,borderRadius:6,display:"flex",alignItems:"center",justifyContent:"center",fontSize:16,fontWeight:700,color:"#000" }}>B</div>
            <div>
              <div style={{ fontWeight:700,fontSize:15 }}>BizMonitor</div>
              <div style={{ fontSize:10,color:C.muted,letterSpacing:1 }}>ENTERPRISE</div>
            </div>
          </div>
        </div>

        <nav style={{ flex:1,padding:"14px 10px" }}>
          <div style={{ fontSize:10,color:C.muted,letterSpacing:1.5,textTransform:"uppercase",padding:"0 12px 6px" }}>Employee</div>
          {PAGES.filter(p=>p.highlight).map(p=>(
            <button key={p.id} onClick={()=>setActive(p.id)} style={{ width:"100%",display:"flex",alignItems:"center",gap:10,padding:"10px 12px",borderRadius:6,border:"none",cursor:"pointer",background:active===p.id?C.accent:C.accentDim,color:active===p.id?"#000":C.accent,fontSize:13,fontWeight:700,marginBottom:12,borderLeft:`2px solid ${C.accent}`,fontFamily:"'IBM Plex Sans',sans-serif" }}>
              <span style={{ fontFamily:"monospace",fontSize:14 }}>{p.icon}</span>{p.label}
            </button>
          ))}
          <div style={{ fontSize:10,color:C.muted,letterSpacing:1.5,textTransform:"uppercase",padding:"0 12px 6px" }}>Dashboards</div>
          {PAGES.filter(p=>!p.highlight).map(p=>(
            <button key={p.id} onClick={()=>setActive(p.id)} style={{ width:"100%",display:"flex",alignItems:"center",gap:10,padding:"9px 12px",borderRadius:6,border:"none",cursor:"pointer",background:active===p.id?C.accentDim:"transparent",color:active===p.id?C.accent:C.muted,fontSize:13,fontWeight:active===p.id?600:400,marginBottom:2,borderLeft:active===p.id?`2px solid ${C.accent}`:"2px solid transparent",fontFamily:"'IBM Plex Sans',sans-serif" }}>
              <span style={{ fontFamily:"monospace",fontSize:14,width:16,textAlign:"center" }}>{p.icon}</span>{p.label}
            </button>
          ))}
        </nav>

        <div style={{ padding:"14px 20px",borderTop:`1px solid ${C.border}`,fontSize:11 }}>
          <div style={{ display:"flex",alignItems:"center",gap:6,marginBottom:4 }}>
            <span style={{ color:apiStatus==="ok"?C.green:apiStatus==="error"?C.red:C.accent,fontSize:10 }}>●</span>
            <span style={{ color:apiStatus==="ok"?C.green:apiStatus==="error"?C.red:C.accent }}>
              {apiStatus==="ok"?"API Connected":apiStatus==="error"?"API Offline":"Connecting…"}
            </span>
          </div>
          <button onClick={loadAll} style={{ fontSize:11,color:C.muted,background:"transparent",border:"none",cursor:"pointer",padding:0,fontFamily:"'IBM Plex Sans',sans-serif" }}>
            ↻ {lastRefresh?`Last synced ${lastRefresh.toLocaleTimeString([],{hour:"2-digit",minute:"2-digit"})}`:"Refresh"}
          </button>
        </div>
      </div>

      {/* Main */}
      <div style={{ flex:1,overflowY:"auto",padding:28 }}>
        <div style={{ display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:26 }}>
          <div style={{ fontSize:11,color:C.muted,letterSpacing:1.5,textTransform:"uppercase" }}>
            BizMonitor / {PAGES.find(p=>p.id===active)?.label}
          </div>
          <div style={{ display:"flex",alignItems:"center",gap:10,fontSize:12,color:C.muted }}>
            {apiStatus==="loading" && <Spinner />}
            <span>{sales.length} sales · {expenses.length} expenses · {inventory.length} SKUs</span>
          </div>
        </div>
        {pageMap[active]}
      </div>
    </div>
  );
}