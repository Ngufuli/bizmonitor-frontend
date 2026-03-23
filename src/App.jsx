import { useState, useEffect, useCallback } from "react";
import { AreaChart, Area, BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from "recharts";

const API = import.meta.env.VITE_API_URL || "http://localhost:8000";

const C = {
  bg:"#0a0c10",surface:"#111318",card:"#161b22",border:"#21262d",
  accent:"#f0a500",accentDim:"#f0a50022",green:"#3fb950",red:"#f85149",
  blue:"#58a6ff",purple:"#bc8cff",text:"#e6edf3",muted:"#7d8590",dim:"#30363d",
};

const months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
const saveToken = t  => localStorage.setItem("biz_token", t);
const getToken  = () => localStorage.getItem("biz_token");
const clearToken = () => localStorage.removeItem("biz_token");

async function apiFetch(path, options = {}) {
  const token = getToken();
  const res = await fetch(`${API}${path}`, {
    headers: { "Content-Type": "application/json", ...(token ? { "Authorization": `Bearer ${token}` } : {}) },
    ...options,
  });
  if (res.status === 401) { clearToken(); window.location.reload(); }
  if (!res.ok) { const err = await res.json().catch(() => ({})); throw new Error(err.detail || `API error ${res.status}`); }
  return res.json();
}
const apiGet    = p      => apiFetch(p);
const apiPost   = (p, b) => apiFetch(p, { method:"POST",   body:JSON.stringify(b) });
const apiPatch  = (p, b) => apiFetch(p, { method:"PATCH",  body:JSON.stringify(b) });
const apiDelete = p      => apiFetch(p, { method:"DELETE" });

const fmt     = n => n>=1e6?`$${(n/1e6).toFixed(1)}M`:n>=1000?`$${(n/1000).toFixed(0)}K`:`$${n}`;
const fmtFull = n => `$${Number(n).toLocaleString()}`;
const todayStr = () => new Date().toISOString().split("T")[0];
const timeAgo  = d => { const s=Math.floor((Date.now()-new Date(d))/1000); return s<60?`${s}s ago`:s<3600?`${Math.floor(s/60)}m ago`:s<86400?`${Math.floor(s/3600)}h ago`:`${Math.floor(s/86400)}d ago`; };

const aggregateSalesByMonth = sales => {
  const map={}; months.forEach(m=>{map[m]={month:m,revenue:0,units:0};});
  sales.forEach(s=>{if(map[s.month]){map[s.month].revenue+=s.amount;map[s.month].units+=s.units;}});
  return months.map(m=>map[m]);
};
const aggregateExpensesByMonth = expenses => {
  const map={}; months.forEach(m=>{map[m]={month:m,Operations:0,Marketing:0,Payroll:0,Other:0};});
  expenses.forEach(e=>{if(!map[e.month])return;const k=["Operations","Marketing","Payroll"].includes(e.category)?e.category:"Other";map[e.month][k]+=e.amount;});
  return months.map(m=>map[m]);
};

// ── UI Atoms ──────────────────────────────────────────────────────────────────
const KpiCard = ({label,value,sub,color=C.accent,trend}) => (
  <div style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:8,padding:"18px 22px",position:"relative",overflow:"hidden"}}>
    <div style={{position:"absolute",top:0,left:0,width:3,height:"100%",background:color}}/>
    <div style={{fontSize:10,color:C.muted,letterSpacing:2,textTransform:"uppercase",marginBottom:6}}>{label}</div>
    <div style={{fontSize:24,fontWeight:700,color:C.text,fontFamily:"'DM Mono',monospace"}}>{value}</div>
    <div style={{fontSize:12,color:trend==="up"?C.green:trend==="down"?C.red:C.muted,marginTop:4}}>{trend==="up"?"▲ ":trend==="down"?"▼ ":""}{sub}</div>
  </div>
);
const SectionHeader = ({title,subtitle}) => (
  <div style={{marginBottom:20}}>
    <div style={{display:"flex",alignItems:"center",gap:10}}>
      <div style={{width:4,height:20,background:C.accent,borderRadius:2}}/>
      <h2 style={{margin:0,fontSize:16,fontWeight:700,color:C.text}}>{title}</h2>
    </div>
    {subtitle&&<div style={{fontSize:12,color:C.muted,marginTop:4,paddingLeft:14}}>{subtitle}</div>}
  </div>
);
const Badge = ({status}) => {
  const map={ok:["In Stock",C.green],low:["Low",C.accent],out:["Out",C.red],active:["Active",C.green],inactive:["Inactive",C.red],admin:["Admin",C.accent],manager:["Manager",C.blue],employee:["Employee",C.muted]};
  const [label,color]=map[status]||[status,C.muted];
  return <span style={{fontSize:10,fontWeight:600,letterSpacing:1,textTransform:"uppercase",padding:"3px 8px",borderRadius:4,background:color+"22",color}}>{label}</span>;
};
const ChartCard = ({title,children,height=220}) => (
  <div style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:8,padding:"18px 18px 10px"}}>
    <div style={{fontSize:11,color:C.muted,letterSpacing:1.5,textTransform:"uppercase",marginBottom:14}}>{title}</div>
    <div style={{height}}>{children}</div>
  </div>
);
const Tip = ({active,payload,label}) => {
  if(!active||!payload?.length) return null;
  return <div style={{background:C.surface,border:`1px solid ${C.border}`,borderRadius:6,padding:"10px 14px",fontSize:12}}><div style={{color:C.muted,marginBottom:6}}>{label}</div>{payload.map((p,i)=><div key={i} style={{color:p.color,marginBottom:2}}>{p.name}: <strong>{typeof p.value==="number"&&p.value>999?fmtFull(p.value):p.value}</strong></div>)}</div>;
};
const Toast = ({msg,color}) => <div style={{position:"fixed",bottom:28,right:28,background:C.card,border:`1px solid ${color}`,color,borderRadius:8,padding:"12px 20px",fontSize:13,fontWeight:600,boxShadow:`0 4px 20px ${color}33`,zIndex:9999,animation:"fadeIn 0.2s ease"}}>{msg}</div>;
const Spinner = () => <div style={{display:"flex",alignItems:"center",gap:8,color:C.muted,fontSize:13}}><div style={{width:14,height:14,border:`2px solid ${C.dim}`,borderTop:`2px solid ${C.accent}`,borderRadius:"50%",animation:"spin 0.8s linear infinite"}}/> Loading…</div>;
const iStyle  = {width:"100%",background:C.surface,border:`1px solid ${C.border}`,borderRadius:6,color:C.text,padding:"9px 12px",fontSize:13,outline:"none",boxSizing:"border-box",fontFamily:"'IBM Plex Sans',sans-serif"};
const Field   = ({label,children}) => <div style={{marginBottom:14}}><label style={{fontSize:11,color:C.muted,letterSpacing:1,textTransform:"uppercase",marginBottom:5,display:"block"}}>{label}</label>{children}</div>;
const Btn     = ({onClick,color=C.accent,textColor="#000",children,disabled,style={}}) => <button onClick={onClick} disabled={disabled} style={{padding:"9px 18px",borderRadius:6,border:"none",background:disabled?C.dim:color,color:disabled?C.muted:textColor,fontWeight:600,fontSize:13,cursor:disabled?"not-allowed":"pointer",fontFamily:"'IBM Plex Sans',sans-serif",...style}}>{children}</button>;

// ── Confirm Delete Dialog ─────────────────────────────────────────────────────
const ConfirmDelete = ({message, onConfirm, onCancel}) => (
  <div style={{position:"fixed",inset:0,background:"#000a",zIndex:10000,display:"flex",alignItems:"center",justifyContent:"center"}}>
    <div style={{background:C.card,border:`1px solid ${C.red}`,borderRadius:10,padding:28,width:360,boxShadow:`0 8px 40px ${C.red}33`}}>
      <div style={{fontSize:18,marginBottom:10}}>⚠️</div>
      <div style={{fontWeight:700,color:C.text,fontSize:15,marginBottom:8}}>Confirm Delete</div>
      <div style={{color:C.muted,fontSize:13,marginBottom:22,lineHeight:1.6}}>{message}</div>
      <div style={{display:"flex",gap:10}}>
        <button onClick={onConfirm} style={{flex:1,padding:"10px",borderRadius:6,border:"none",background:C.red,color:"#fff",fontWeight:700,fontSize:13,cursor:"pointer",fontFamily:"'IBM Plex Sans',sans-serif"}}>Yes, Delete</button>
        <button onClick={onCancel}  style={{flex:1,padding:"10px",borderRadius:6,border:`1px solid ${C.border}`,background:"transparent",color:C.muted,fontWeight:600,fontSize:13,cursor:"pointer",fontFamily:"'IBM Plex Sans',sans-serif"}}>Cancel</button>
      </div>
    </div>
  </div>
);

const DelBtn = ({onClick}) => (
  <button onClick={onClick} style={{padding:"3px 8px",borderRadius:4,border:`1px solid ${C.red}33`,background:C.red+"11",color:C.red,fontSize:11,cursor:"pointer",fontFamily:"'IBM Plex Sans',sans-serif",fontWeight:600}}>✕</button>
);

// ── Login ─────────────────────────────────────────────────────────────────────
const LoginScreen = ({onLogin}) => {
  const [email,setEmail]=useState(""); const [pw,setPw]=useState(""); const [err,setErr]=useState(""); const [loading,setLoading]=useState(false);
  const go = async () => {
    if(!email||!pw) return setErr("Enter email and password.");
    setLoading(true); setErr("");
    try {
      const form=new URLSearchParams(); form.append("username",email); form.append("password",pw);
      const res=await fetch(`${API}/auth/login`,{method:"POST",body:form});
      const data=await res.json();
      if(!res.ok) throw new Error(data.detail||"Login failed");
      saveToken(data.access_token); onLogin(data.user);
    } catch(e){setErr(e.message);} setLoading(false);
  };
  return (
    <div style={{height:"100vh",background:C.bg,display:"flex",alignItems:"center",justifyContent:"center",fontFamily:"'IBM Plex Sans',system-ui,sans-serif"}}>
      <link href="https://fonts.googleapis.com/css2?family=IBM+Plex+Sans:wght@400;500;600;700&family=DM+Mono:wght@400;500&display=swap" rel="stylesheet"/>
      <div style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:12,padding:40,width:360}}>
        <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:28}}>
          <div style={{width:36,height:36,background:C.accent,borderRadius:8,display:"flex",alignItems:"center",justifyContent:"center",fontSize:18,fontWeight:700,color:"#000"}}>B</div>
          <div><div style={{fontWeight:700,fontSize:16,color:C.text}}>BizMonitor</div><div style={{fontSize:10,color:C.muted,letterSpacing:1}}>ENTERPRISE</div></div>
        </div>
        {err&&<div style={{background:C.red+"18",border:`1px solid ${C.red}33`,borderRadius:6,padding:"10px 14px",fontSize:13,color:C.red,marginBottom:16}}>{err}</div>}
        <Field label="Email"><input type="email" placeholder="you@company.com" value={email} onChange={e=>setEmail(e.target.value)} onKeyDown={e=>e.key==="Enter"&&go()} style={iStyle}/></Field>
        <Field label="Password"><input type="password" placeholder="••••••••" value={pw} onChange={e=>setPw(e.target.value)} onKeyDown={e=>e.key==="Enter"&&go()} style={iStyle}/></Field>
        <button onClick={go} disabled={loading} style={{width:"100%",padding:"11px",borderRadius:7,border:"none",background:C.accent,color:"#000",fontWeight:700,fontSize:14,cursor:loading?"not-allowed":"pointer",opacity:loading?0.7:1,marginTop:6,fontFamily:"'IBM Plex Sans',sans-serif"}}>{loading?"Signing in…":"Sign In"}</button>
        <div style={{marginTop:16,fontSize:11,color:C.dim,textAlign:"center"}}>Contact your admin to create an account</div>
      </div>
    </div>
  );
};

// ── Business Picker ───────────────────────────────────────────────────────────
const BusinessPicker = ({businesses, onSelect, user}) => (
  <div style={{height:"100vh",background:C.bg,display:"flex",alignItems:"center",justifyContent:"center",fontFamily:"'IBM Plex Sans',system-ui,sans-serif"}}>
    <link href="https://fonts.googleapis.com/css2?family=IBM+Plex+Sans:wght@400;500;600;700&family=DM+Mono:wght@400;500&display=swap" rel="stylesheet"/>
    <div style={{width:480}}>
      <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:32}}>
        <div style={{width:36,height:36,background:C.accent,borderRadius:8,display:"flex",alignItems:"center",justifyContent:"center",fontSize:18,fontWeight:700,color:"#000"}}>B</div>
        <div><div style={{fontWeight:700,fontSize:16,color:C.text}}>BizMonitor</div><div style={{fontSize:11,color:C.muted}}>Welcome, {user.full_name}</div></div>
      </div>
      <div style={{fontSize:13,color:C.muted,marginBottom:16,letterSpacing:1,textTransform:"uppercase"}}>Select a Business</div>
      {businesses.length===0
        ? <div style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:10,padding:32,textAlign:"center",color:C.muted}}>No businesses yet. Ask your admin to create one and add you.</div>
        : <div style={{display:"grid",gap:10}}>
            {businesses.map(b=>(
              <button key={b.id} onClick={()=>onSelect(b)} style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:10,padding:"18px 22px",cursor:"pointer",textAlign:"left",display:"flex",justifyContent:"space-between",alignItems:"center",fontFamily:"'IBM Plex Sans',sans-serif"}}>
                <div>
                  <div style={{fontWeight:700,fontSize:15,color:C.text}}>{b.name}</div>
                  <div style={{fontSize:12,color:C.muted,marginTop:3}}>{b.industry||"General"} · {b.currency}</div>
                </div>
                <span style={{color:C.accent,fontSize:20}}>→</span>
              </button>
            ))}
          </div>
      }
    </div>
  </div>
);

// ── Admin Panel ───────────────────────────────────────────────────────────────
const AdminPanel = ({user, businesses, onBusinessCreated}) => {
  const [tab, setTab]         = useState("users");
  const [users, setUsers]     = useState([]);
  const [activity, setActivity] = useState([]);
  const [toast, setToast]     = useState(null);
  const [loading, setLoading] = useState(false);
  const [editUser, setEditUser]   = useState(null);
  const [newUser, setNewUser]     = useState({email:"",full_name:"",password:"",role:"employee",department:""});
  const [newBiz, setNewBiz]       = useState({name:"",industry:"",currency:"USD"});
  const [resetPw, setResetPw]     = useState({userId:null,password:""});

  const showToast = (msg,color=C.green)=>{setToast({msg,color});setTimeout(()=>setToast(null),3000);};

  const loadUsers    = async()=>{ try{setUsers(await apiGet("/admin/users"));}catch(e){showToast(e.message,C.red);} };
  const loadActivity = async()=>{ try{setActivity(await apiGet("/admin/activity"));}catch(e){showToast(e.message,C.red);} };

  useEffect(()=>{ loadUsers(); loadActivity(); },[]);

  const createUser = async()=>{
    if(!newUser.email||!newUser.password||!newUser.full_name) return showToast("Fill in all required fields",C.red);
    setLoading(true);
    try{ await apiPost("/admin/users",newUser); setNewUser({email:"",full_name:"",password:"",role:"employee",department:""}); loadUsers(); showToast("✓ User created"); }
    catch(e){showToast(e.message,C.red);}
    setLoading(false);
  };

  const toggleActive = async(u)=>{
    try{ await apiPatch(`/admin/users/${u.id}`,{is_active:!u.is_active}); loadUsers(); showToast(`✓ User ${u.is_active?"deactivated":"activated"}`); }
    catch(e){showToast(e.message,C.red);}
  };

  const saveRole = async(u, role)=>{
    try{ await apiPatch(`/admin/users/${u.id}`,{role}); loadUsers(); setEditUser(null); showToast("✓ Role updated"); }
    catch(e){showToast(e.message,C.red);}
  };

  const doResetPw = async()=>{
    if(!resetPw.password) return showToast("Enter a new password",C.red);
    try{ await apiPost(`/admin/users/${resetPw.userId}/reset-password`,{new_password:resetPw.password}); setResetPw({userId:null,password:""}); showToast("✓ Password reset"); }
    catch(e){showToast(e.message,C.red);}
  };

  const createBusiness = async()=>{
    if(!newBiz.name) return showToast("Enter a business name",C.red);
    try{ const b=await apiPost("/businesses",newBiz); setNewBiz({name:"",industry:"",currency:"USD"}); onBusinessCreated(b); showToast("✓ Business created"); }
    catch(e){showToast(e.message,C.red);}
  };

  const tabs = [["users","👥 Users"],["businesses","🏢 Businesses"],["activity","📋 Activity Log"]];

  return (
    <div>
      {toast&&<Toast msg={toast.msg} color={toast.color}/>}
      {confirmBiz&&<ConfirmDelete message={`Deactivate "${confirmBiz.name}"? It will be hidden from all users. Data is preserved.`} onConfirm={()=>deleteBusiness(confirmBiz.id)} onCancel={()=>setConfirmBiz(null)}/>}
      <SectionHeader title="Admin Panel" subtitle="Manage users, businesses, and view system activity"/>

      <div style={{display:"flex",gap:8,marginBottom:24}}>
        {tabs.map(([id,label])=>(
          <button key={id} onClick={()=>setTab(id)} style={{padding:"9px 18px",borderRadius:7,border:`1px solid ${tab===id?C.accent:C.border}`,background:tab===id?C.accentDim:"transparent",color:tab===id?C.accent:C.muted,fontWeight:tab===id?700:400,fontSize:13,cursor:"pointer",fontFamily:"'IBM Plex Sans',sans-serif"}}>{label}</button>
        ))}
      </div>

      {/* ── USERS TAB ── */}
      {tab==="users"&&(
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:20}}>
          {/* Create user */}
          <div style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:10,padding:24}}>
            <div style={{fontSize:13,fontWeight:700,color:C.accent,marginBottom:20}}><span style={{background:C.accentDim,padding:"4px 12px",borderRadius:6}}>+ Create New User</span></div>
            <Field label="Full Name *"><input type="text" style={iStyle} placeholder="John Smith" value={newUser.full_name} onChange={e=>setNewUser({...newUser,full_name:e.target.value})}/></Field>
            <Field label="Email *"><input type="email" style={iStyle} placeholder="user@company.com" value={newUser.email} onChange={e=>setNewUser({...newUser,email:e.target.value})}/></Field>
            <Field label="Temporary Password *"><input type="password" style={iStyle} placeholder="Min 8 characters" value={newUser.password} onChange={e=>setNewUser({...newUser,password:e.target.value})}/></Field>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
              <Field label="Role">
                <select style={iStyle} value={newUser.role} onChange={e=>setNewUser({...newUser,role:e.target.value})}>
                  {["employee","manager","admin"].map(r=><option key={r}>{r}</option>)}
                </select>
              </Field>
              <Field label="Department"><input type="text" style={iStyle} placeholder="Sales, HR…" value={newUser.department} onChange={e=>setNewUser({...newUser,department:e.target.value})}/></Field>
            </div>
            <Btn onClick={createUser} color={C.accent} disabled={loading} style={{width:"100%",padding:"11px"}}>{loading?"Creating…":"Create User"}</Btn>
          </div>

          {/* User list */}
          <div style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:10,padding:24}}>
            <div style={{fontSize:11,color:C.muted,letterSpacing:1.5,textTransform:"uppercase",marginBottom:16}}>All Users ({users.length})</div>
            <div style={{display:"grid",gap:8,maxHeight:480,overflowY:"auto"}}>
              {users.map(u=>(
                <div key={u.id} style={{background:C.surface,borderRadius:8,padding:"12px 14px",border:`1px solid ${C.border}`}}>
                  <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start"}}>
                    <div>
                      <div style={{fontSize:13,fontWeight:600,color:u.is_active?C.text:C.muted}}>{u.full_name}</div>
                      <div style={{fontSize:11,color:C.muted,marginTop:2}}>{u.email}{u.department?` · ${u.department}`:""}</div>
                    </div>
                    <div style={{display:"flex",gap:6,alignItems:"center"}}>
                      <Badge status={u.role}/>
                      <Badge status={u.is_active?"active":"inactive"}/>
                    </div>
                  </div>
                  <div style={{display:"flex",gap:8,marginTop:10}}>
                    {/* Role selector */}
                    {editUser===u.id
                      ? <>
                          <select style={{...iStyle,fontSize:11,padding:"4px 8px",width:"auto"}} defaultValue={u.role} onChange={e=>saveRole(u,e.target.value)}>
                            {["employee","manager","admin"].map(r=><option key={r}>{r}</option>)}
                          </select>
                          <Btn onClick={()=>setEditUser(null)} color={C.dim} textColor={C.muted} style={{padding:"4px 10px",fontSize:11}}>Cancel</Btn>
                        </>
                      : <Btn onClick={()=>setEditUser(u.id)} color={C.blue+"22"} textColor={C.blue} style={{padding:"4px 10px",fontSize:11}}>Change Role</Btn>
                    }
                    {/* Reset password */}
                    {resetPw.userId===u.id
                      ? <div style={{display:"flex",gap:6,flex:1}}>
                          <input type="password" style={{...iStyle,fontSize:11,padding:"4px 8px"}} placeholder="New password" value={resetPw.password} onChange={e=>setResetPw({...resetPw,password:e.target.value})}/>
                          <Btn onClick={doResetPw} color={C.accent} style={{padding:"4px 10px",fontSize:11}}>Set</Btn>
                          <Btn onClick={()=>setResetPw({userId:null,password:""})} color={C.dim} textColor={C.muted} style={{padding:"4px 10px",fontSize:11}}>✕</Btn>
                        </div>
                      : <Btn onClick={()=>setResetPw({userId:u.id,password:""})} color={C.purple+"22"} textColor={C.purple} style={{padding:"4px 10px",fontSize:11}}>Reset PW</Btn>
                    }
                    {u.id!==user.id&&(
                      <Btn onClick={()=>toggleActive(u)} color={u.is_active?C.red+"22":C.green+"22"} textColor={u.is_active?C.red:C.green} style={{padding:"4px 10px",fontSize:11,marginLeft:"auto"}}>{u.is_active?"Deactivate":"Activate"}</Btn>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── BUSINESSES TAB ── */}
      {tab==="businesses"&&(
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:20}}>
          <div style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:10,padding:24}}>
            <div style={{fontSize:13,fontWeight:700,color:C.accent,marginBottom:20}}><span style={{background:C.accentDim,padding:"4px 12px",borderRadius:6}}>+ Create Business</span></div>
            <Field label="Business Name *"><input type="text" style={iStyle} placeholder="Acme Ltd" value={newBiz.name} onChange={e=>setNewBiz({...newBiz,name:e.target.value})}/></Field>
            <Field label="Industry"><input type="text" style={iStyle} placeholder="Retail, Manufacturing…" value={newBiz.industry} onChange={e=>setNewBiz({...newBiz,industry:e.target.value})}/></Field>
            <Field label="Currency">
              <select style={iStyle} value={newBiz.currency} onChange={e=>setNewBiz({...newBiz,currency:e.target.value})}>
                {["USD","TZS","KES","GBP","EUR","ZAR"].map(c=><option key={c}>{c}</option>)}
              </select>
            </Field>
            <Btn onClick={createBusiness} color={C.accent} style={{width:"100%",padding:"11px"}}>Create Business</Btn>
          </div>
          <div style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:10,padding:24}}>
            <div style={{fontSize:11,color:C.muted,letterSpacing:1.5,textTransform:"uppercase",marginBottom:16}}>All Businesses ({businesses.length})</div>
            <div style={{display:"grid",gap:10}}>
              {businesses.map(b=>(
                <div key={b.id} style={{background:C.surface,borderRadius:8,padding:"14px 16px",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                  <div>
                    <div style={{fontWeight:600,color:C.text,fontSize:14}}>{b.name}</div>
                    <div style={{fontSize:12,color:C.muted,marginTop:3}}>{b.industry||"General"} · {b.currency} · ID: {b.id}</div>
                  </div>
                  <DelBtn onClick={()=>setConfirmBiz(b)}/>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── ACTIVITY LOG TAB ── */}
      {tab==="activity"&&(
        <div style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:10,overflow:"hidden"}}>
          <div style={{padding:"14px 20px",borderBottom:`1px solid ${C.border}`,fontSize:11,color:C.muted,letterSpacing:1.5,textTransform:"uppercase"}}>System Activity Log — Last 200 events</div>
          <div style={{maxHeight:600,overflowY:"auto"}}>
            <table style={{width:"100%",borderCollapse:"collapse",fontSize:13}}>
              <thead style={{position:"sticky",top:0,background:C.surface}}>
                <tr>{["Time","Action","Detail","User","Business"].map(h=><th key={h} style={{padding:"10px 16px",textAlign:"left",color:C.muted,fontWeight:600,fontSize:11,letterSpacing:1,textTransform:"uppercase"}}>{h}</th>)}</tr>
              </thead>
              <tbody>
                {activity.map(a=>(
                  <tr key={a.id} style={{borderTop:`1px solid ${C.border}`}}>
                    <td style={{padding:"10px 16px",color:C.muted,fontSize:11,fontFamily:"'DM Mono',monospace",whiteSpace:"nowrap"}}>{timeAgo(a.created_at)}</td>
                    <td style={{padding:"10px 16px"}}><span style={{fontSize:11,padding:"2px 8px",borderRadius:4,background:C.blue+"22",color:C.blue}}>{a.action}</span></td>
                    <td style={{padding:"10px 16px",color:C.muted,fontSize:12}}>{a.detail||"—"}</td>
                    <td style={{padding:"10px 16px",color:C.muted,fontSize:12}}>{a.user_id||"—"}</td>
                    <td style={{padding:"10px 16px",color:C.muted,fontSize:12}}>{a.business_id||"—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};

// ── Data Entry ────────────────────────────────────────────────────────────────
const DataEntry = ({inventory, onRefresh, bizId, apiStatus}) => {
  const [tab, setTab]         = useState("sale");
  const [toast, setToast]     = useState(null);
  const [loading, setLoading] = useState(false);

  // Sale — unit price + units → auto-total
  const [sale, setSale] = useState({
    date: todayStr(), product: "", unit_price: "", units: "", rep: "", notes: ""
  });

  // Expense
  const [expense, setExpense] = useState({
    date: todayStr(), category: "Operations", amount: "", vendor: "", description: "", submitted_by: ""
  });

  // Stock movement
  const [stock, setStock] = useState({
    sku: "", qty: "", movement_type: "add", reason: "", received_by: ""
  });

  // Add new product
  const [product, setProduct] = useState({
    sku: "", name: "", stock: "", reorder: "", unit_cost: ""
  });

  const showToast = (msg, color=C.green) => { setToast({msg,color}); setTimeout(()=>setToast(null),3000); };
  const ok = apiStatus === "ok";

  // Auto-calculate sale total
  const saleTotal = sale.unit_price && sale.units
    ? Number(sale.unit_price) * Number(sale.units)
    : null;

  const submitSale = async () => {
    if (!sale.product || !sale.unit_price || !sale.units)
      return showToast("✕ Fill in product, unit price and units", C.red);
    if (Number(sale.unit_price) <= 0 || Number(sale.units) <= 0)
      return showToast("✕ Price and units must be greater than zero", C.red);
    setLoading(true);
    try {
      await apiPost(`/businesses/${bizId}/sales`, {
        date: sale.date, product: sale.product,
        amount: saleTotal,           // total = price × units
        units: Number(sale.units),
        rep: sale.rep, notes: sale.notes,
      });
      setSale({ date: todayStr(), product: "", unit_price: "", units: "", rep: "", notes: "" });
      showToast("✓ Sale saved");
      onRefresh();
    } catch(e) { showToast(`✕ ${e.message}`, C.red); }
    setLoading(false);
  };

  const submitExpense = async () => {
    if (!expense.amount || !expense.vendor || !expense.description)
      return showToast("✕ Fill required fields", C.red);
    setLoading(true);
    try {
      await apiPost(`/businesses/${bizId}/expenses`, { ...expense, amount: Number(expense.amount) });
      setExpense({ date: todayStr(), category: "Operations", amount: "", vendor: "", description: "", submitted_by: "" });
      showToast("✓ Expense saved");
      onRefresh();
    } catch(e) { showToast(`✕ ${e.message}`, C.red); }
    setLoading(false);
  };

  const submitStock = async () => {
    if (!stock.sku || !stock.qty) return showToast("✕ Fill required fields", C.red);
    setLoading(true);
    try {
      await apiPatch(`/businesses/${bizId}/inventory/${stock.sku}/stock`, {
        movement_type: stock.movement_type, qty: Number(stock.qty),
        reason: stock.reason, received_by: stock.received_by
      });
      setStock({ sku: "", qty: "", movement_type: "add", reason: "", received_by: "" });
      showToast("✓ Stock updated");
      onRefresh();
    } catch(e) { showToast(`✕ ${e.message}`, C.red); }
    setLoading(false);
  };

  const submitProduct = async () => {
    if (!product.sku || !product.name) return showToast("✕ SKU and name are required", C.red);
    setLoading(true);
    try {
      await apiPost(`/businesses/${bizId}/inventory`, {
        sku:       product.sku.toUpperCase(),
        name:      product.name,
        stock:     Number(product.stock)     || 0,
        reorder:   Number(product.reorder)   || 50,
        unit_cost: Number(product.unit_cost) || 0,
      });
      setProduct({ sku: "", name: "", stock: "", reorder: "", unit_cost: "" });
      showToast("✓ Product added to inventory");
      onRefresh();
    } catch(e) { showToast(`✕ ${e.message}`, C.red); }
    setLoading(false);
  };

  const sel  = inventory.find(i => i.sku === stock.sku);
  const prev = sel && stock.qty
    ? Math.max(0, sel.stock + (stock.movement_type === "remove" ? -Number(stock.qty) : Number(stock.qty)))
    : null;

  const TABS = [
    ["sale",    "↑ Log Sale",       C.green],
    ["expense", "↓ Record Expense", C.red],
    ["stock",   "▣ Update Stock",   C.blue],
    ["product", "＋ Add Product",    C.purple],
  ];

  return (
    <div>
      {toast && <Toast msg={toast.msg} color={toast.color}/>}
      <SectionHeader title="Data Entry" subtitle="Log sales, expenses, stock movements and add new products"/>

      {/* Tab bar */}
      <div style={{display:"flex",gap:8,marginBottom:24,flexWrap:"wrap"}}>
        {TABS.map(([id,label,color])=>(
          <button key={id} onClick={()=>setTab(id)} style={{
            padding:"10px 18px",borderRadius:7,
            border:`1px solid ${tab===id?color:C.border}`,
            background:tab===id?color+"18":"transparent",
            color:tab===id?color:C.muted,
            fontWeight:tab===id?700:400,fontSize:13,cursor:"pointer",
            fontFamily:"'IBM Plex Sans',sans-serif"
          }}>{label}</button>
        ))}
      </div>

      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:20}}>

        {/* ── SALE FORM ── */}
        {tab==="sale" && <>
          <div style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:10,padding:24}}>
            <div style={{fontSize:13,fontWeight:700,color:C.green,marginBottom:20}}>
              <span style={{background:C.green+"18",padding:"4px 12px",borderRadius:6}}>↑ New Sale Entry</span>
            </div>
            <Field label="Date *">
              <input type="date" style={iStyle} value={sale.date} onChange={e=>setSale({...sale,date:e.target.value})}/>
            </Field>
            <Field label="Product / Service *">
              <input type="text" style={iStyle} placeholder="e.g. Reasdun Tshirt" value={sale.product} onChange={e=>setSale({...sale,product:e.target.value})}/>
            </Field>

            {/* Price × Units = Total */}
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
              <Field label="Unit Price *">
                <input type="number" style={iStyle} placeholder="Price per unit" value={sale.unit_price} onChange={e=>setSale({...sale,unit_price:e.target.value})}/>
              </Field>
              <Field label="Units Sold *">
                <input type="number" style={iStyle} placeholder="Qty" value={sale.units} onChange={e=>setSale({...sale,units:e.target.value})}/>
              </Field>
            </div>

            {/* Live total preview */}
            {saleTotal !== null && (
              <div style={{
                background: C.green+"12", border:`1px solid ${C.green}44`,
                borderRadius:7, padding:"12px 16px", marginBottom:14,
                display:"flex", justifyContent:"space-between", alignItems:"center"
              }}>
                <div style={{fontSize:12,color:C.muted}}>
                  {fmtFull(Number(sale.unit_price))} × {sale.units} units
                </div>
                <div style={{fontSize:18,fontWeight:700,color:C.green,fontFamily:"'DM Mono',monospace"}}>
                  = {fmtFull(saleTotal)}
                </div>
              </div>
            )}

            <Field label="Sales Rep">
              <input type="text" style={iStyle} placeholder="Staff name (optional)" value={sale.rep} onChange={e=>setSale({...sale,rep:e.target.value})}/>
            </Field>
            <Field label="Notes">
              <textarea style={{...iStyle,resize:"vertical",minHeight:52}} placeholder="Optional notes" value={sale.notes} onChange={e=>setSale({...sale,notes:e.target.value})}/>
            </Field>
            <button onClick={submitSale} disabled={loading||!ok} style={{
              width:"100%",padding:"11px",borderRadius:7,border:"none",
              background:ok?C.green:C.dim,color:"#000",fontWeight:700,fontSize:14,
              cursor:ok?"pointer":"not-allowed",opacity:loading?0.7:1
            }}>{loading?"Saving…":"💾 Submit Sale"}</button>
          </div>

          {/* Right panel — tips */}
          <div style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:10,padding:24}}>
            <div style={{fontSize:11,color:C.muted,letterSpacing:1.5,textTransform:"uppercase",marginBottom:16}}>How It Works</div>
            <div style={{display:"grid",gap:12}}>
              {[
                ["Unit Price","Enter the selling price of one item — e.g. 5000"],
                ["Units","How many were sold — e.g. 3"],
                ["Total","Auto-calculated: 5000 × 3 = 15,000. This is what gets recorded as revenue."],
                ["Rep","Which staff member made the sale (optional)"],
                ["Date","The date the sale happened — affects monthly charts"],
              ].map(([title,desc])=>(
                <div key={title} style={{padding:"10px 14px",background:C.surface,borderRadius:7}}>
                  <div style={{fontSize:12,fontWeight:600,color:C.text,marginBottom:3}}>{title}</div>
                  <div style={{fontSize:12,color:C.muted}}>{desc}</div>
                </div>
              ))}
            </div>
          </div>
        </>}

        {/* ── EXPENSE FORM ── */}
        {tab==="expense" && <>
          <div style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:10,padding:24}}>
            <div style={{fontSize:13,fontWeight:700,color:C.red,marginBottom:20}}>
              <span style={{background:C.red+"18",padding:"4px 12px",borderRadius:6}}>↓ New Expense</span>
            </div>
            <Field label="Date *"><input type="date" style={iStyle} value={expense.date} onChange={e=>setExpense({...expense,date:e.target.value})}/></Field>
            <Field label="Category *">
              <select style={iStyle} value={expense.category} onChange={e=>setExpense({...expense,category:e.target.value})}>
                {["Operations","Marketing","Payroll","Travel","Utilities","Office Supplies","Software","Other"].map(c=><option key={c}>{c}</option>)}
              </select>
            </Field>
            <Field label="Amount *"><input type="number" style={iStyle} placeholder="0.00" value={expense.amount} onChange={e=>setExpense({...expense,amount:e.target.value})}/></Field>
            <Field label="Vendor / Supplier *"><input type="text" style={iStyle} placeholder="Who was paid?" value={expense.vendor} onChange={e=>setExpense({...expense,vendor:e.target.value})}/></Field>
            <Field label="Description *"><textarea style={{...iStyle,resize:"vertical",minHeight:56}} placeholder="What was this expense for?" value={expense.description} onChange={e=>setExpense({...expense,description:e.target.value})}/></Field>
            <Field label="Submitted By"><input type="text" style={iStyle} placeholder="Staff name (optional)" value={expense.submitted_by} onChange={e=>setExpense({...expense,submitted_by:e.target.value})}/></Field>
            <button onClick={submitExpense} disabled={loading||!ok} style={{width:"100%",padding:"11px",borderRadius:7,border:"none",background:ok?C.red:C.dim,color:"#fff",fontWeight:700,fontSize:14,cursor:ok?"pointer":"not-allowed",opacity:loading?0.7:1}}>{loading?"Saving…":"💾 Submit Expense"}</button>
          </div>
          <div style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:10,padding:24,fontSize:12,color:C.muted}}>
            <div style={{marginBottom:12,fontSize:11,letterSpacing:1.5,textTransform:"uppercase"}}>Category Guide</div>
            {[["Operations","Day-to-day running costs"],["Marketing","Ads, campaigns, promotions"],["Payroll","Salaries and wages"],["Travel","Transport and accommodation"],["Utilities","Power, water, internet"],["Software","Subscriptions and tools"],["Office Supplies","Stationery, equipment"],["Other","Anything else"]].map(([c,d])=>(
              <div key={c} style={{marginBottom:8,padding:"6px 10px",background:C.surface,borderRadius:5}}>
                <span style={{color:C.text,fontWeight:600}}>{c}</span><span style={{color:C.dim}}> — {d}</span>
              </div>
            ))}
          </div>
        </>}

        {/* ── STOCK MOVEMENT ── */}
        {tab==="stock" && <>
          <div style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:10,padding:24}}>
            <div style={{fontSize:13,fontWeight:700,color:C.blue,marginBottom:20}}>
              <span style={{background:C.blue+"18",padding:"4px 12px",borderRadius:6}}>▣ Stock Movement</span>
            </div>
            <Field label="Product *">
              <select style={iStyle} value={stock.sku} onChange={e=>setStock({...stock,sku:e.target.value})}>
                <option value="">— Select product —</option>
                {inventory.map(i=><option key={i.sku} value={i.sku}>{i.sku} — {i.name} (stock: {i.stock})</option>)}
              </select>
            </Field>
            <Field label="Movement Type *">
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:8}}>
                {[["add","Received",C.green],["remove","Dispatched",C.red],["adjust","Adjust",C.accent]].map(([v,l,c])=>(
                  <button key={v} onClick={()=>setStock({...stock,movement_type:v})} style={{padding:"9px",borderRadius:6,border:`1px solid ${stock.movement_type===v?c:C.border}`,background:stock.movement_type===v?c+"22":"transparent",color:stock.movement_type===v?c:C.muted,fontSize:12,fontWeight:600,cursor:"pointer",fontFamily:"'IBM Plex Sans',sans-serif"}}>{l}</button>
                ))}
              </div>
            </Field>
            <Field label="Quantity *"><input type="number" style={iStyle} placeholder="How many?" value={stock.qty} onChange={e=>setStock({...stock,qty:e.target.value})}/></Field>
            <Field label="Reason / Reference"><input type="text" style={iStyle} placeholder="e.g. PO-045, damaged" value={stock.reason} onChange={e=>setStock({...stock,reason:e.target.value})}/></Field>
            {sel && stock.qty && prev !== null && (
              <div style={{background:C.surface,border:`1px solid ${C.border}`,borderRadius:7,padding:"12px 14px",marginBottom:14,fontSize:12,display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                <span style={{color:C.muted}}>Preview: {sel.name}</span>
                <span style={{fontFamily:"'DM Mono',monospace"}}>
                  <span style={{color:C.muted}}>{sel.stock}</span>
                  <span style={{color:C.accent}}> → </span>
                  <span style={{color:prev===0?C.red:prev<sel.reorder?C.accent:C.green,fontWeight:700}}>{prev}</span>
                </span>
              </div>
            )}
            <button onClick={submitStock} disabled={loading||!ok} style={{width:"100%",padding:"11px",borderRadius:7,border:"none",background:ok?C.blue:C.dim,color:"#000",fontWeight:700,fontSize:14,cursor:ok?"pointer":"not-allowed",opacity:loading?0.7:1}}>{loading?"Saving…":"💾 Update Stock"}</button>
          </div>
          <div style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:10,padding:24}}>
            <div style={{fontSize:11,color:C.muted,letterSpacing:1.5,textTransform:"uppercase",marginBottom:14}}>Current Stock Levels</div>
            {inventory.length === 0
              ? <div style={{color:C.muted,fontSize:13,textAlign:"center",padding:24}}>No products yet. Add one using the <strong style={{color:C.purple}}>＋ Add Product</strong> tab.</div>
              : <div style={{display:"grid",gap:8,maxHeight:420,overflowY:"auto"}}>
                  {inventory.map(item=>(
                    <div key={item.sku} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"10px 14px",background:C.surface,borderRadius:6,border:`1px solid ${item.sku===stock.sku?C.blue:C.border}`}}>
                      <div>
                        <div style={{fontSize:12,color:C.text,fontWeight:600}}>{item.name}</div>
                        <div style={{fontSize:10,color:C.muted,marginTop:2}}>{item.sku} · reorder at {item.reorder}</div>
                      </div>
                      <div style={{textAlign:"right"}}>
                        <div style={{fontFamily:"'DM Mono',monospace",fontSize:16,color:item.status==="out"?C.red:item.status==="low"?C.accent:C.text}}>{item.stock.toLocaleString()}</div>
                        <Badge status={item.status}/>
                      </div>
                    </div>
                  ))}
                </div>
            }
          </div>
        </>}

        {/* ── ADD NEW PRODUCT ── */}
        {tab==="product" && <>
          <div style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:10,padding:24}}>
            <div style={{fontSize:13,fontWeight:700,color:C.purple,marginBottom:20}}>
              <span style={{background:C.purple+"18",padding:"4px 12px",borderRadius:6}}>＋ Add New Product</span>
            </div>
            <Field label="SKU (Stock Keeping Unit) *">
              <input type="text" style={iStyle} placeholder="e.g. SHIRT-RED-L" value={product.sku} onChange={e=>setProduct({...product,sku:e.target.value.toUpperCase()})}/>
            </Field>
            <Field label="Product Name *">
              <input type="text" style={iStyle} placeholder="e.g. Reasdun Tshirt Red Large" value={product.name} onChange={e=>setProduct({...product,name:e.target.value})}/>
            </Field>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
              <Field label="Initial Stock">
                <input type="number" style={iStyle} placeholder="0" value={product.stock} onChange={e=>setProduct({...product,stock:e.target.value})}/>
              </Field>
              <Field label="Reorder Point">
                <input type="number" style={iStyle} placeholder="50" value={product.reorder} onChange={e=>setProduct({...product,reorder:e.target.value})}/>
              </Field>
            </div>
            <Field label="Unit Cost (what you paid per unit)">
              <input type="number" style={iStyle} placeholder="0.00" value={product.unit_cost} onChange={e=>setProduct({...product,unit_cost:e.target.value})}/>
            </Field>

            {/* Preview */}
            {product.sku && product.name && (
              <div style={{background:C.surface,border:`1px solid ${C.border}`,borderRadius:7,padding:"12px 14px",marginBottom:14,fontSize:12}}>
                <div style={{color:C.muted,marginBottom:8,fontSize:11,letterSpacing:1,textTransform:"uppercase"}}>Preview</div>
                <div style={{display:"flex",justifyContent:"space-between",marginBottom:4}}>
                  <span style={{color:C.muted}}>SKU</span><span style={{color:C.purple,fontFamily:"'DM Mono',monospace"}}>{product.sku}</span>
                </div>
                <div style={{display:"flex",justifyContent:"space-between",marginBottom:4}}>
                  <span style={{color:C.muted}}>Name</span><span style={{color:C.text}}>{product.name}</span>
                </div>
                <div style={{display:"flex",justifyContent:"space-between",marginBottom:4}}>
                  <span style={{color:C.muted}}>Opening stock</span><span style={{color:C.text}}>{product.stock||0}</span>
                </div>
                <div style={{display:"flex",justifyContent:"space-between",marginBottom:4}}>
                  <span style={{color:C.muted}}>Reorder at</span><span style={{color:C.accent}}>{product.reorder||50}</span>
                </div>
                <div style={{display:"flex",justifyContent:"space-between"}}>
                  <span style={{color:C.muted}}>Unit cost</span>
                  <span style={{color:C.green,fontFamily:"'DM Mono',monospace"}}>{fmtFull(Number(product.unit_cost)||0)}</span>
                </div>
              </div>
            )}

            <button onClick={submitProduct} disabled={loading||!ok} style={{width:"100%",padding:"11px",borderRadius:7,border:"none",background:ok?C.purple:C.dim,color:"#fff",fontWeight:700,fontSize:14,cursor:ok?"pointer":"not-allowed",opacity:loading?0.7:1}}>
              {loading?"Adding…":"＋ Add to Inventory"}
            </button>
          </div>

          {/* Right — existing products */}
          <div style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:10,padding:24}}>
            <div style={{fontSize:11,color:C.muted,letterSpacing:1.5,textTransform:"uppercase",marginBottom:14}}>
              Existing Products ({inventory.length})
            </div>
            {inventory.length === 0
              ? <div style={{color:C.muted,fontSize:13,textAlign:"center",padding:24}}>No products yet. Add your first one!</div>
              : <div style={{display:"grid",gap:8,maxHeight:480,overflowY:"auto"}}>
                  {inventory.map(item=>(
                    <div key={item.sku} style={{background:C.surface,borderRadius:7,padding:"12px 14px"}}>
                      <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start"}}>
                        <div>
                          <div style={{fontSize:13,fontWeight:600,color:C.text}}>{item.name}</div>
                          <div style={{fontSize:10,color:C.muted,marginTop:2,fontFamily:"'DM Mono',monospace"}}>{item.sku}</div>
                        </div>
                        <Badge status={item.status}/>
                      </div>
                      <div style={{display:"flex",gap:16,marginTop:8,fontSize:11,color:C.muted}}>
                        <span>Stock: <strong style={{color:C.text}}>{item.stock}</strong></span>
                        <span>Reorder: <strong style={{color:C.accent}}>{item.reorder}</strong></span>
                        <span>Cost: <strong style={{color:C.green}}>{fmtFull(item.unit_cost)}</strong></span>
                      </div>
                    </div>
                  ))}
                </div>
            }
            <div style={{marginTop:14,padding:"10px 14px",background:C.accentDim,borderRadius:7,fontSize:12,color:C.accent}}>
              💡 To update stock levels for an existing product, use the <strong>▣ Update Stock</strong> tab.
            </div>
          </div>
        </>}

      </div>
    </div>
  );
};

// ── Dashboard Pages ───────────────────────────────────────────────────────────
const Overview = ({sales,expenses,inventory,summary}) => {
  const sd=aggregateSalesByMonth(sales); const ed=aggregateExpensesByMonth(expenses);
  const plData=sd.map((s,i)=>{const exp=ed[i].Operations+ed[i].Marketing+ed[i].Payroll+ed[i].Other;return{month:s.month,revenue:s.revenue,expenses:exp,profit:s.revenue-exp};});
  return (
    <div>
      <SectionHeader title="Overview" subtitle="Live business snapshot"/>
      <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:12,marginBottom:22}}>
        <KpiCard label="Total Revenue"   value={fmt(summary?.total_revenue||0)}   sub="All time" trend="up" color={C.green}/>
        <KpiCard label="Total Expenses"  value={fmt(summary?.total_expenses||0)}  sub="All time" color={C.red}/>
        <KpiCard label="Net Profit"      value={fmt(summary?.net_profit||0)}      sub={`Margin ${summary?.profit_margin||0}%`} trend="up" color={C.accent}/>
        <KpiCard label="Inventory Value" value={fmt(summary?.inventory_value||0)} sub="At cost"  color={C.blue}/>
      </div>
      <div style={{display:"grid",gridTemplateColumns:"2fr 1fr",gap:16}}>
        <ChartCard title="Revenue vs Expenses" height={240}>
          <ResponsiveContainer>
            <AreaChart data={plData}>
              <defs>
                <linearGradient id="rg" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor={C.green} stopOpacity={0.3}/><stop offset="95%" stopColor={C.green} stopOpacity={0}/></linearGradient>
                <linearGradient id="eg" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor={C.red} stopOpacity={0.2}/><stop offset="95%" stopColor={C.red} stopOpacity={0}/></linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke={C.dim}/>
              <XAxis dataKey="month" tick={{fill:C.muted,fontSize:11}} axisLine={false} tickLine={false}/>
              <YAxis tick={{fill:C.muted,fontSize:11}} axisLine={false} tickLine={false} tickFormatter={v=>`$${v/1000}K`}/>
              <Tooltip content={<Tip/>}/>
              <Area type="monotone" dataKey="revenue" stroke={C.green} fill="url(#rg)" strokeWidth={2} name="Revenue"/>
              <Area type="monotone" dataKey="expenses" stroke={C.red} fill="url(#eg)" strokeWidth={2} name="Expenses"/>
            </AreaChart>
          </ResponsiveContainer>
        </ChartCard>
        <ChartCard title="Stock Alerts" height={240}>
          <div style={{display:"grid",gap:7,paddingTop:4}}>
            {inventory.map(item=>(
              <div key={item.sku} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"8px 12px",background:C.surface,borderRadius:6}}>
                <div style={{fontSize:12,color:C.text}}>{item.name.split(" ").slice(0,2).join(" ")}</div>
                <div style={{display:"flex",alignItems:"center",gap:8}}>
                  <span style={{fontFamily:"'DM Mono',monospace",fontSize:12,color:item.status==="out"?C.red:item.status==="low"?C.accent:C.muted}}>{item.stock}</span>
                  <Badge status={item.status}/>
                </div>
              </div>
            ))}
          </div>
        </ChartCard>
      </div>
    </div>
  );
};

const Sales = ({sales, bizId, userRole, onRefresh}) => {
  const sd=aggregateSalesByMonth(sales);
  const [confirm, setConfirm] = useState(null);
  const [toast, setToast]     = useState(null);
  const showToast = (msg,color=C.green)=>{setToast({msg,color});setTimeout(()=>setToast(null),3000);};
  const canDelete = userRole==="manager"||userRole==="admin";

  const doDelete = async (id) => {
    try {
      await apiDelete(`/businesses/${bizId}/sales/${id}`);
      showToast("✓ Sale deleted"); onRefresh();
    } catch(e) { showToast(`✕ ${e.message}`, C.red); }
    setConfirm(null);
  };

  return (
    <div>
      {toast&&<Toast msg={toast.msg} color={toast.color}/>}
      {confirm&&<ConfirmDelete message={`Delete sale: "${confirm.product}" — ${fmtFull(confirm.amount)}? This cannot be undone.`} onConfirm={()=>doDelete(confirm.id)} onCancel={()=>setConfirm(null)}/>}
      <SectionHeader title="Sales & Revenue"/>
      <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:12,marginBottom:22}}>
        <KpiCard label="Total Revenue" value={fmt(sales.reduce((s,d)=>s+d.amount,0))} sub="All entries" trend="up" color={C.green}/>
        <KpiCard label="Total Units"   value={sales.reduce((s,d)=>s+d.units,0).toLocaleString()} sub="All time" color={C.blue}/>
        <KpiCard label="Entries"       value={sales.length} sub="In database" color={C.accent}/>
      </div>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:16,marginBottom:16}}>
        <ChartCard title="Monthly Revenue" height={230}><ResponsiveContainer><BarChart data={sd}><CartesianGrid strokeDasharray="3 3" stroke={C.dim}/><XAxis dataKey="month" tick={{fill:C.muted,fontSize:11}} axisLine={false} tickLine={false}/><YAxis tick={{fill:C.muted,fontSize:11}} axisLine={false} tickLine={false} tickFormatter={v=>`$${v/1000}K`}/><Tooltip content={<Tip/>}/><Bar dataKey="revenue" fill={C.green} name="Revenue" radius={[3,3,0,0]}/></BarChart></ResponsiveContainer></ChartCard>
        <ChartCard title="Units Sold" height={230}><ResponsiveContainer><LineChart data={sd}><CartesianGrid strokeDasharray="3 3" stroke={C.dim}/><XAxis dataKey="month" tick={{fill:C.muted,fontSize:11}} axisLine={false} tickLine={false}/><YAxis tick={{fill:C.muted,fontSize:11}} axisLine={false} tickLine={false}/><Tooltip content={<Tip/>}/><Line type="monotone" dataKey="units" stroke={C.accent} strokeWidth={2} dot={{fill:C.accent,r:3}} name="Units"/></LineChart></ResponsiveContainer></ChartCard>
      </div>
      <div style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:8,overflow:"hidden"}}>
        {canDelete&&<div style={{padding:"8px 16px",background:C.red+"0a",borderBottom:`1px solid ${C.border}`,fontSize:11,color:C.muted}}>Managers and admins can delete entries using the ✕ button</div>}
        <div style={{maxHeight:340,overflowY:"auto"}}>
          <table style={{width:"100%",borderCollapse:"collapse",fontSize:13}}>
            <thead style={{position:"sticky",top:0,background:C.surface}}>
              <tr>{["Date","Product","Amount","Units","Rep","Notes",...(canDelete?[""]:[])].map(h=><th key={h} style={{padding:"10px 16px",textAlign:"left",color:C.muted,fontWeight:600,fontSize:11,letterSpacing:1,textTransform:"uppercase"}}>{h}</th>)}</tr>
            </thead>
            <tbody>
              {sales.map(s=>(
                <tr key={s.id} style={{borderTop:`1px solid ${C.border}`}}>
                  <td style={{padding:"10px 16px",color:C.muted,fontFamily:"'DM Mono',monospace",fontSize:12}}>{String(s.date)}</td>
                  <td style={{padding:"10px 16px",color:C.text}}>{s.product}</td>
                  <td style={{padding:"10px 16px",color:C.green,fontFamily:"'DM Mono',monospace"}}>{fmtFull(s.amount)}</td>
                  <td style={{padding:"10px 16px",color:C.text}}>{s.units}</td>
                  <td style={{padding:"10px 16px",color:C.muted}}>{s.rep||"—"}</td>
                  <td style={{padding:"10px 16px",color:C.muted,fontSize:12}}>{s.notes||"—"}</td>
                  {canDelete&&<td style={{padding:"10px 16px"}}><DelBtn onClick={()=>setConfirm(s)}/></td>}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

const Expenses = ({expenses, bizId, userRole, onRefresh}) => {
  const ed=aggregateExpensesByMonth(expenses);
  const catTotal=cat=>expenses.filter(e=>(["Operations","Marketing","Payroll"].includes(e.category)?e.category:"Other")===cat).reduce((s,e)=>s+e.amount,0);
  const [confirm, setConfirm] = useState(null);
  const [toast, setToast]     = useState(null);
  const showToast = (msg,color=C.green)=>{setToast({msg,color});setTimeout(()=>setToast(null),3000);};
  const canDelete = userRole==="manager"||userRole==="admin";

  const doDelete = async (id) => {
    try {
      await apiDelete(`/businesses/${bizId}/expenses/${id}`);
      showToast("✓ Expense deleted"); onRefresh();
    } catch(e) { showToast(`✕ ${e.message}`, C.red); }
    setConfirm(null);
  };

  return (
    <div>
      {toast&&<Toast msg={toast.msg} color={toast.color}/>}
      {confirm&&<ConfirmDelete message={`Delete expense: "${confirm.description}" — ${fmtFull(confirm.amount)}? This cannot be undone.`} onConfirm={()=>doDelete(confirm.id)} onCancel={()=>setConfirm(null)}/>}
      <SectionHeader title="Expenses"/>
      <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:12,marginBottom:22}}>
        {[["Operations",C.blue],["Marketing",C.purple],["Payroll",C.accent],["Other",C.muted]].map(([cat,color])=><KpiCard key={cat} label={cat} value={fmt(catTotal(cat))} sub="Total" color={color}/>)}
      </div>
      <ChartCard title="Monthly Breakdown" height={260}><ResponsiveContainer><BarChart data={ed}><CartesianGrid strokeDasharray="3 3" stroke={C.dim}/><XAxis dataKey="month" tick={{fill:C.muted,fontSize:11}} axisLine={false} tickLine={false}/><YAxis tick={{fill:C.muted,fontSize:11}} axisLine={false} tickLine={false} tickFormatter={v=>`$${v/1000}K`}/><Tooltip content={<Tip/>}/><Bar dataKey="Payroll" stackId="a" fill={C.accent} name="Payroll"/><Bar dataKey="Operations" stackId="a" fill={C.blue} name="Operations"/><Bar dataKey="Marketing" stackId="a" fill={C.purple} name="Marketing"/><Bar dataKey="Other" stackId="a" fill={C.dim} name="Other" radius={[3,3,0,0]}/></BarChart></ResponsiveContainer></ChartCard>
      <div style={{marginTop:16,background:C.card,border:`1px solid ${C.border}`,borderRadius:8,overflow:"hidden"}}>
        {canDelete&&<div style={{padding:"8px 16px",background:C.red+"0a",borderBottom:`1px solid ${C.border}`,fontSize:11,color:C.muted}}>Managers and admins can delete entries using the ✕ button</div>}
        <div style={{maxHeight:300,overflowY:"auto"}}>
          <table style={{width:"100%",borderCollapse:"collapse",fontSize:13}}>
            <thead style={{position:"sticky",top:0,background:C.surface}}>
              <tr>{["Date","Category","Amount","Vendor","Description","By",...(canDelete?[""]:[])].map(h=><th key={h} style={{padding:"10px 16px",textAlign:"left",color:C.muted,fontWeight:600,fontSize:11,letterSpacing:1,textTransform:"uppercase"}}>{h}</th>)}</tr>
            </thead>
            <tbody>
              {expenses.map(e=>(
                <tr key={e.id} style={{borderTop:`1px solid ${C.border}`}}>
                  <td style={{padding:"10px 16px",color:C.muted,fontFamily:"'DM Mono',monospace",fontSize:12}}>{String(e.date)}</td>
                  <td style={{padding:"10px 16px"}}><span style={{fontSize:11,padding:"2px 8px",borderRadius:4,background:C.blue+"22",color:C.blue}}>{e.category}</span></td>
                  <td style={{padding:"10px 16px",color:C.red,fontFamily:"'DM Mono',monospace"}}>{fmtFull(e.amount)}</td>
                  <td style={{padding:"10px 16px",color:C.text}}>{e.vendor}</td>
                  <td style={{padding:"10px 16px",color:C.muted,fontSize:12}}>{e.description}</td>
                  <td style={{padding:"10px 16px",color:C.muted}}>{e.submitted_by||"—"}</td>
                  {canDelete&&<td style={{padding:"10px 16px"}}><DelBtn onClick={()=>setConfirm(e)}/></td>}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

const Inventory = ({inventory, bizId, userRole, onRefresh}) => {
  const [confirm, setConfirm] = useState(null);
  const [toast, setToast]     = useState(null);
  const showToast = (msg,color=C.green)=>{setToast({msg,color});setTimeout(()=>setToast(null),3000);};
  const canDelete = userRole==="admin";

  const doDelete = async (sku) => {
    try {
      await apiDelete(`/businesses/${bizId}/inventory/${sku}`);
      showToast("✓ Product deleted"); onRefresh();
    } catch(e) { showToast(`✕ ${e.message}`, C.red); }
    setConfirm(null);
  };

  return (
    <div>
      {toast&&<Toast msg={toast.msg} color={toast.color}/>}
      {confirm&&<ConfirmDelete message={`Delete product "${confirm.name}" (${confirm.sku})? All stock history for this item will be removed. This cannot be undone.`} onConfirm={()=>doDelete(confirm.sku)} onCancel={()=>setConfirm(null)}/>}
      <SectionHeader title="Inventory & Stock"/>
      <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:12,marginBottom:22}}>
        <KpiCard label="SKUs"         value={inventory.length} sub="Products" color={C.blue}/>
        <KpiCard label="Total Value"  value={fmt(inventory.reduce((s,i)=>s+i.stock*i.unit_cost,0))} sub="At cost" color={C.green}/>
        <KpiCard label="Low Stock"    value={inventory.filter(i=>i.status==="low").length} sub="Below reorder" color={C.accent} trend="down"/>
        <KpiCard label="Out of Stock" value={inventory.filter(i=>i.status==="out").length} sub="Action needed" color={C.red} trend="down"/>
      </div>
      <div style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:8,overflow:"hidden",marginBottom:16}}>
        {canDelete&&<div style={{padding:"8px 16px",background:C.red+"0a",borderBottom:`1px solid ${C.border}`,fontSize:11,color:C.muted}}>Admins can delete products using the ✕ button — this removes the product entirely</div>}
        <table style={{width:"100%",borderCollapse:"collapse",fontSize:13}}>
          <thead><tr style={{background:C.surface}}>{["SKU","Product","Stock","Reorder","Unit Cost","Value","Status",...(canDelete?[""]:[])].map(h=><th key={h} style={{padding:"12px 16px",textAlign:"left",color:C.muted,fontWeight:600,fontSize:11,letterSpacing:1,textTransform:"uppercase"}}>{h}</th>)}</tr></thead>
          <tbody>
            {inventory.map(item=>(
              <tr key={item.id} style={{borderTop:`1px solid ${C.border}`}}>
                <td style={{padding:"12px 16px",color:C.muted,fontFamily:"'DM Mono',monospace",fontSize:12}}>{item.sku}</td>
                <td style={{padding:"12px 16px",color:C.text}}>{item.name}</td>
                <td style={{padding:"12px 16px",color:item.stock===0?C.red:item.stock<item.reorder?C.accent:C.text,fontFamily:"'DM Mono',monospace"}}>{item.stock.toLocaleString()}</td>
                <td style={{padding:"12px 16px",color:C.muted,fontFamily:"'DM Mono',monospace"}}>{item.reorder}</td>
                <td style={{padding:"12px 16px",color:C.muted,fontFamily:"'DM Mono',monospace"}}>{fmtFull(item.unit_cost)}</td>
                <td style={{padding:"12px 16px",color:C.green,fontFamily:"'DM Mono',monospace"}}>{fmtFull(item.stock*item.unit_cost)}</td>
                <td style={{padding:"12px 16px"}}><Badge status={item.status}/></td>
                {canDelete&&<td style={{padding:"12px 16px"}}><DelBtn onClick={()=>setConfirm(item)}/></td>}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <ChartCard title="Stock vs Reorder Points" height={200}><ResponsiveContainer><BarChart data={inventory.map(i=>({name:i.sku,stock:i.stock,reorder:i.reorder}))}><CartesianGrid strokeDasharray="3 3" stroke={C.dim}/><XAxis dataKey="name" tick={{fill:C.muted,fontSize:11}} axisLine={false} tickLine={false}/><YAxis tick={{fill:C.muted,fontSize:11}} axisLine={false} tickLine={false}/><Tooltip content={<Tip/>}/><Bar dataKey="stock" fill={C.blue} name="Stock" radius={[3,3,0,0]}/><Bar dataKey="reorder" fill={C.accent} name="Reorder" radius={[3,3,0,0]}/></BarChart></ResponsiveContainer></ChartCard>
    </div>
  );
};

const PL = ({sales,expenses}) => {
  const sd=aggregateSalesByMonth(sales); const ed=aggregateExpensesByMonth(expenses);
  const plData=sd.map((s,i)=>{const exp=ed[i].Operations+ed[i].Marketing+ed[i].Payroll+ed[i].Other;return{month:s.month,revenue:s.revenue,expenses:exp,profit:s.revenue-exp};});
  const ytdRev=plData.reduce((s,d)=>s+d.revenue,0),ytdExp=plData.reduce((s,d)=>s+d.expenses,0);
  return (
    <div>
      <SectionHeader title="Profit & Loss"/>
      <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:12,marginBottom:22}}>
        <KpiCard label="Revenue"  value={fmt(ytdRev)}        sub="All sales"      trend="up" color={C.green}/>
        <KpiCard label="Expenses" value={fmt(ytdExp)}        sub="All categories"            color={C.red}/>
        <KpiCard label="Profit"   value={fmt(ytdRev-ytdExp)} sub={`Margin ${ytdRev?((ytdRev-ytdExp)/ytdRev*100).toFixed(1):0}%`} trend="up" color={C.accent}/>
      </div>
      <ChartCard title="Monthly P&L" height={270}><ResponsiveContainer><BarChart data={plData}><CartesianGrid strokeDasharray="3 3" stroke={C.dim}/><XAxis dataKey="month" tick={{fill:C.muted,fontSize:11}} axisLine={false} tickLine={false}/><YAxis tick={{fill:C.muted,fontSize:11}} axisLine={false} tickLine={false} tickFormatter={v=>`$${v/1000}K`}/><Tooltip content={<Tip/>}/><Bar dataKey="revenue" fill={C.green} name="Revenue" radius={[3,3,0,0]}/><Bar dataKey="expenses" fill={C.red} name="Expenses" radius={[3,3,0,0]}/><Bar dataKey="profit" fill={C.accent} name="Profit" radius={[3,3,0,0]}/></BarChart></ResponsiveContainer></ChartCard>
    </div>
  );
};

// ── Cash Balance Page ─────────────────────────────────────────────────────────
const CashPage = ({bizId, user, userRole}) => {
  const canDelete = userRole==="manager"||userRole==="admin";
  const [confirmCash, setConfirmCash] = useState(null);
  const [balances, setBalances]   = useState([]);
  const [loading, setLoading]     = useState(true);
  const [toast, setToast]         = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm]           = useState({
    date: todayStr(), opening_balance: "", closing_balance: "", notes: ""
  });

  const [confirmBiz, setConfirmBiz]   = useState(null);

  const deleteBusiness = async (id) => {
    try {
      await apiPatch(`/businesses/${id}`, {is_active: false});
      showToast("✓ Business deactivated");
      onBusinessCreated(null); // trigger refresh
    } catch(e) { showToast(e.message, C.red); }
    setConfirmBiz(null);
  };

  const showToast = (msg, color=C.green) => { setToast({msg,color}); setTimeout(()=>setToast(null),3000); };

  const load = async () => {
    try { setBalances(await apiGet(`/businesses/${bizId}/cash`)); }
    catch(e) { showToast(e.message, C.red); }
    setLoading(false);
  };

  useEffect(() => { load(); }, [bizId]);

  const submit = async () => {
    if (!form.opening_balance || !form.closing_balance) return showToast("Enter both opening and closing balance", C.red);
    setSubmitting(true);
    try {
      await apiPost(`/businesses/${bizId}/cash`, {
        ...form,
        opening_balance: Number(form.opening_balance),
        closing_balance: Number(form.closing_balance),
      });
      setForm({ date: todayStr(), opening_balance: "", closing_balance: "", notes: "" });
      showToast("✓ Balance recorded");
      load();
    } catch(e) { showToast(`✕ ${e.message}`, C.red); }
    setSubmitting(false);
  };

  // Build chart data from balances (last 30 days, oldest first)
  const chartData = balances.slice(0, 30).reverse().map(b => ({
    date: String(b.date).slice(5), // MM-DD
    opening: b.opening_balance,
    closing: b.closing_balance,
    movement: b.closing_balance - b.opening_balance,
  }));

  // Summary stats
  const latest      = balances[0] || null;
  const prev        = balances[1] || null;
  const avgClosing  = balances.length ? balances.reduce((s,b)=>s+b.closing_balance,0)/balances.length : 0;
  const bestDay     = balances.length ? balances.reduce((best,b)=>b.closing_balance>best.closing_balance?b:best, balances[0]) : null;
  const movement    = latest ? latest.closing_balance - latest.opening_balance : 0;

  const deleteCash = async (id) => {
    try {
      await apiDelete(`/businesses/${bizId}/cash/${id}`);
      showToast("✓ Record deleted"); load();
    } catch(e) { showToast(`✕ ${e.message}`, C.red); }
    setConfirmCash(null);
  };

  return (
    <div>
      {toast && <Toast msg={toast.msg} color={toast.color}/>}
      {confirmCash&&<ConfirmDelete message={`Delete cash balance record for ${confirmCash.date}? This cannot be undone.`} onConfirm={()=>deleteCash(confirmCash.id)} onCancel={()=>setConfirmCash(null)}/>}
      <SectionHeader title="Cash Balance" subtitle="Daily opening and closing cash position"/>

      {/* KPI cards */}
      <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:12,marginBottom:22}}>
        <KpiCard label="Latest Closing" value={latest?fmtFull(latest.closing_balance):"—"} sub={latest?String(latest.date):"No records yet"} color={C.green} trend={movement>=0?"up":"down"}/>
        <KpiCard label="Latest Opening" value={latest?fmtFull(latest.opening_balance):"—"} sub="Most recent day" color={C.blue}/>
        <KpiCard label="Daily Movement" value={latest?`${movement>=0?"+":""}${fmtFull(movement)}`:"—"} sub="Close minus open" color={movement>=0?C.green:C.red} trend={movement>=0?"up":"down"}/>
        <KpiCard label="Avg Closing" value={fmtFull(Math.round(avgClosing))} sub={`Over ${balances.length} days`} color={C.accent}/>
      </div>

      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:20,marginBottom:20}}>

        {/* Entry form */}
        <div style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:10,padding:24}}>
          <div style={{fontSize:13,fontWeight:700,color:C.accent,marginBottom:20}}>
            <span style={{background:C.accentDim,padding:"4px 12px",borderRadius:6}}>💵 Record Daily Balance</span>
          </div>
          <Field label="Date *">
            <input type="date" style={iStyle} value={form.date} onChange={e=>setForm({...form,date:e.target.value})}/>
          </Field>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
            <Field label="Opening Balance *">
              <input type="number" style={iStyle} placeholder="0.00" value={form.opening_balance} onChange={e=>setForm({...form,opening_balance:e.target.value})}/>
            </Field>
            <Field label="Closing Balance *">
              <input type="number" style={iStyle} placeholder="0.00" value={form.closing_balance} onChange={e=>setForm({...form,closing_balance:e.target.value})}/>
            </Field>
          </div>
          {/* Live movement preview */}
          {form.opening_balance && form.closing_balance && (() => {
            const diff = Number(form.closing_balance) - Number(form.opening_balance);
            return (
              <div style={{background:C.surface,border:`1px solid ${C.border}`,borderRadius:7,padding:"10px 14px",marginBottom:14,fontSize:12,display:"flex",justifyContent:"space-between"}}>
                <span style={{color:C.muted}}>Daily movement</span>
                <span style={{fontFamily:"'DM Mono',monospace",color:diff>=0?C.green:C.red,fontWeight:700}}>
                  {diff>=0?"+":""}{fmtFull(diff)}
                </span>
              </div>
            );
          })()}
          <Field label="Notes">
            <textarea style={{...iStyle,resize:"vertical",minHeight:60}} placeholder="e.g. Market day, payday, etc." value={form.notes} onChange={e=>setForm({...form,notes:e.target.value})}/>
          </Field>
          <div style={{fontSize:11,color:C.muted,marginBottom:12}}>
            💡 Submitting for a date that already exists will update that record.
          </div>
          <button onClick={submit} disabled={submitting} style={{width:"100%",padding:"11px",borderRadius:7,border:"none",background:C.accent,color:"#000",fontWeight:700,fontSize:14,cursor:submitting?"not-allowed":"pointer",opacity:submitting?0.7:1}}>
            {submitting?"Saving…":"💾 Save Balance"}
          </button>
        </div>

        {/* Recent records */}
        <div style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:10,padding:24}}>
          <div style={{fontSize:11,color:C.muted,letterSpacing:1.5,textTransform:"uppercase",marginBottom:16}}>Recent Records</div>
          {loading ? <Spinner/> : balances.length === 0
            ? <div style={{color:C.muted,fontSize:13,textAlign:"center",paddingTop:40}}>No records yet.<br/>Record today's balance above.</div>
            : <div style={{display:"grid",gap:8,maxHeight:400,overflowY:"auto"}}>
                {balances.slice(0,15).map(b => {
                  const diff = b.closing_balance - b.opening_balance;
                  return (
                    <div key={b.id} style={{background:C.surface,borderRadius:7,padding:"12px 14px"}}>
                      <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start"}}>
                        <div>
                          <div style={{fontSize:12,color:C.muted,fontFamily:"'DM Mono',monospace"}}>{String(b.date)}</div>
                          {b.notes && <div style={{fontSize:11,color:C.dim,marginTop:2}}>{b.notes}</div>}
                        </div>
                        <div style={{textAlign:"right"}}>
                          <div style={{fontSize:13,fontWeight:600,color:diff>=0?C.green:C.red}}>
                            {diff>=0?"+":""}{fmtFull(diff)}
                          </div>
                          <div style={{fontSize:10,color:C.muted,marginTop:2}}>close: {fmtFull(b.closing_balance)}</div>
                        </div>
                      </div>
                      <div style={{display:"flex",gap:16,marginTop:8,fontSize:11}}>
                        <span style={{color:C.muted}}>Open: <span style={{color:C.blue,fontFamily:"'DM Mono',monospace"}}>{fmtFull(b.opening_balance)}</span></span>
                        <span style={{color:C.muted}}>Close: <span style={{color:C.green,fontFamily:"'DM Mono',monospace"}}>{fmtFull(b.closing_balance)}</span></span>
                      </div>
                    </div>
                  );
                })}
              </div>
          }
        </div>
      </div>

      {/* Chart */}
      {chartData.length > 1 && (
        <ChartCard title="Opening vs Closing Balance — Last 30 Days" height={240}>
          <ResponsiveContainer>
            <AreaChart data={chartData}>
              <defs>
                <linearGradient id="og" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor={C.blue} stopOpacity={0.3}/><stop offset="95%" stopColor={C.blue} stopOpacity={0}/></linearGradient>
                <linearGradient id="cg" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor={C.green} stopOpacity={0.3}/><stop offset="95%" stopColor={C.green} stopOpacity={0}/></linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke={C.dim}/>
              <XAxis dataKey="date" tick={{fill:C.muted,fontSize:11}} axisLine={false} tickLine={false}/>
              <YAxis tick={{fill:C.muted,fontSize:11}} axisLine={false} tickLine={false} tickFormatter={v=>fmt(v)}/>
              <Tooltip content={<Tip/>}/>
              <Area type="monotone" dataKey="opening" stroke={C.blue}  fill="url(#og)" strokeWidth={2} name="Opening"/>
              <Area type="monotone" dataKey="closing" stroke={C.green} fill="url(#cg)" strokeWidth={2} name="Closing"/>
            </AreaChart>
          </ResponsiveContainer>
        </ChartCard>
      )}

      {/* Full table */}
      {balances.length > 0 && (
        <div style={{marginTop:16,background:C.card,border:`1px solid ${C.border}`,borderRadius:8,overflow:"hidden"}}>
          <div style={{maxHeight:320,overflowY:"auto"}}>
            <table style={{width:"100%",borderCollapse:"collapse",fontSize:13}}>
              <thead style={{position:"sticky",top:0,background:C.surface}}>
                <tr>{["Date","Opening","Closing","Movement","Notes",...(canDelete?[""]:[])].map(h=><th key={h} style={{padding:"10px 16px",textAlign:"left",color:C.muted,fontWeight:600,fontSize:11,letterSpacing:1,textTransform:"uppercase"}}>{h}</th>)}</tr>
              </thead>
              <tbody>
                {balances.map(b=>{
                  const diff = b.closing_balance - b.opening_balance;
                  return (
                    <tr key={b.id} style={{borderTop:`1px solid ${C.border}`}}>
                      <td style={{padding:"10px 16px",color:C.muted,fontFamily:"'DM Mono',monospace",fontSize:12}}>{String(b.date)}</td>
                      <td style={{padding:"10px 16px",color:C.blue,fontFamily:"'DM Mono',monospace"}}>{fmtFull(b.opening_balance)}</td>
                      <td style={{padding:"10px 16px",color:C.green,fontFamily:"'DM Mono',monospace"}}>{fmtFull(b.closing_balance)}</td>
                      <td style={{padding:"10px 16px",color:diff>=0?C.green:C.red,fontFamily:"'DM Mono',monospace"}}>{diff>=0?"+":""}{fmtFull(diff)}</td>
                      <td style={{padding:"10px 16px",color:C.muted,fontSize:12}}>{b.notes||"—"}</td>
                      {canDelete&&<td style={{padding:"10px 16px"}}><DelBtn onClick={()=>setConfirmCash(b)}/></td>}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};

// ── Main App ──────────────────────────────────────────────────────────────────
export default function BizMonitor() {
  const [user, setUser]               = useState(null);
  const [authChecked, setAuthChecked] = useState(false);
  const [businesses, setBusinesses]   = useState([]);
  const [activeBiz, setActiveBiz]     = useState(null);
  const [page, setPage]               = useState("overview");
  const [sales, setSales]             = useState([]);
  const [expenses, setExpenses]       = useState([]);
  const [inventory, setInventory]     = useState([]);
  const [summary, setSummary]         = useState(null);
  const [apiStatus, setApiStatus]     = useState("loading");
  const [lastRefresh, setLastRefresh] = useState(null);

  // Auth check on load
  useEffect(()=>{
    const token=getToken();
    if(token){ apiGet("/auth/me").then(u=>{setUser(u);setAuthChecked(true);}).catch(()=>{clearToken();setAuthChecked(true);}); }
    else setAuthChecked(true);
  },[]);

  // Load businesses after login
  useEffect(()=>{
    if(user) apiGet("/businesses").then(b=>{setBusinesses(b);if(b.length===1)setActiveBiz(b[0]);}).catch(()=>{});
  },[user]);

  // Load business data
  const loadBizData = useCallback(async()=>{
    if(!activeBiz) return;
    try{
      const [s,e,inv,sum]=await Promise.all([
        apiGet(`/businesses/${activeBiz.id}/sales`),
        apiGet(`/businesses/${activeBiz.id}/expenses`),
        apiGet(`/businesses/${activeBiz.id}/inventory`),
        apiGet(`/businesses/${activeBiz.id}/summary`),
      ]);
      setSales(s); setExpenses(e); setInventory(inv); setSummary(sum);
      setApiStatus("ok"); setLastRefresh(new Date());
    }catch{ setApiStatus("error"); }
  },[activeBiz]);

  useEffect(()=>{
    if(activeBiz){ loadBizData(); const t=setInterval(loadBizData,30000); return()=>clearInterval(t); }
  },[activeBiz,loadBizData]);

  const handleLogout=()=>{ clearToken(); setUser(null); setActiveBiz(null); setBusinesses([]); setSales([]); setExpenses([]); setInventory([]); setSummary(null); setApiStatus("loading"); };
  const switchBusiness=()=>{ setActiveBiz(null); setPage("overview"); };

  if(!authChecked) return null;
  if(!user) return <LoginScreen onLogin={setUser}/>;
  if(!activeBiz && user.role!=="admin") return <BusinessPicker businesses={businesses} onSelect={setActiveBiz} user={user}/>;
  if(!activeBiz && user.role==="admin") {
    // Admin can pick a business or go straight to admin panel
    if(businesses.length>0 && page!=="admin") return <BusinessPicker businesses={[...businesses,{id:"__admin__",name:"⚙ Admin Panel",industry:"System",currency:""}]} onSelect={b=>b.id==="__admin__"?setPage("admin"):setActiveBiz(b)} user={user}/>;
  }

  const isAdmin = user.role==="admin";

  const PAGES = [
    ...(isAdmin ? [{id:"admin",label:"Admin",icon:"⚙",admin:true}] : []),
    {id:"entry",    label:"Data Entry", icon:"✎", highlight:true},
    {id:"overview", label:"Overview",   icon:"⬡"},
    {id:"sales",    label:"Sales",      icon:"↑"},
    {id:"expenses", label:"Expenses",   icon:"↓"},
    {id:"inventory",label:"Inventory",  icon:"▣"},
    {id:"pl",       label:"P&L",        icon:"≋"},
  ];

  const bizRole = activeBiz ? crud_get_role() : user.role;

  // helper — get user's role in the active business
  function crud_get_role() {
    if (user.role === "admin") return "admin";
    return user.role; // fallback to global role
  }

  const pageMap = {
    admin:    <AdminPanel user={user} businesses={businesses} onBusinessCreated={b=>{if(b)setBusinesses(p=>[...p,b]);else apiGet("/businesses").then(setBusinesses).catch(()=>{});}}/>,
    entry:    <DataEntry  inventory={inventory} onRefresh={loadBizData} bizId={activeBiz?.id} apiStatus={apiStatus}/>,
    overview: <Overview   sales={sales} expenses={expenses} inventory={inventory} summary={summary}/>,
    sales:    <Sales      sales={sales} bizId={activeBiz?.id} userRole={bizRole} onRefresh={loadBizData}/>,
    expenses: <Expenses   expenses={expenses} bizId={activeBiz?.id} userRole={bizRole} onRefresh={loadBizData}/>,
    inventory:<Inventory  inventory={inventory} bizId={activeBiz?.id} userRole={bizRole} onRefresh={loadBizData}/>,
    pl:       <PL         sales={sales} expenses={expenses}/>,
    cash:     <CashPage   bizId={activeBiz?.id} user={user} userRole={bizRole}/>,
  };

  return (
    <div style={{display:"flex",height:"100vh",background:C.bg,color:C.text,fontFamily:"'IBM Plex Sans',system-ui,sans-serif",fontSize:14}}>
      <link href="https://fonts.googleapis.com/css2?family=IBM+Plex+Sans:wght@400;500;600;700&family=DM+Mono:wght@400;500&display=swap" rel="stylesheet"/>
      <style>{`*{box-sizing:border-box}@keyframes fadeIn{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:translateY(0)}}@keyframes spin{to{transform:rotate(360deg)}}input[type=date]::-webkit-calendar-picker-indicator{filter:invert(0.5)}select option{background:#161b22}`}</style>

      {/* Sidebar */}
      <div style={{width:220,background:C.surface,borderRight:`1px solid ${C.border}`,display:"flex",flexDirection:"column",flexShrink:0}}>
        {/* Logo + business name */}
        <div style={{padding:"18px 20px",borderBottom:`1px solid ${C.border}`}}>
          <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:activeBiz?10:0}}>
            <div style={{width:32,height:32,background:C.accent,borderRadius:6,display:"flex",alignItems:"center",justifyContent:"center",fontSize:16,fontWeight:700,color:"#000"}}>B</div>
            <div><div style={{fontWeight:700,fontSize:15}}>BizMonitor</div><div style={{fontSize:10,color:C.muted,letterSpacing:1}}>ENTERPRISE</div></div>
          </div>
          {activeBiz&&(
            <button onClick={switchBusiness} style={{width:"100%",background:C.accentDim,border:`1px solid ${C.accent}33`,borderRadius:6,padding:"7px 10px",cursor:"pointer",textAlign:"left",fontFamily:"'IBM Plex Sans',sans-serif"}}>
              <div style={{fontSize:12,fontWeight:600,color:C.accent,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{activeBiz.name}</div>
              <div style={{fontSize:10,color:C.muted,marginTop:1}}>Switch business →</div>
            </button>
          )}
        </div>

        <nav style={{flex:1,padding:"12px 10px",overflowY:"auto"}}>
          {isAdmin&&<>
            <div style={{fontSize:10,color:C.muted,letterSpacing:1.5,textTransform:"uppercase",padding:"0 12px 6px"}}>Admin</div>
            <button onClick={()=>{setPage("admin");setActiveBiz(null);}} style={{width:"100%",display:"flex",alignItems:"center",gap:10,padding:"10px 12px",borderRadius:6,border:"none",cursor:"pointer",background:page==="admin"?C.accent:C.accentDim,color:page==="admin"?"#000":C.accent,fontSize:13,fontWeight:700,marginBottom:12,borderLeft:`2px solid ${C.accent}`,fontFamily:"'IBM Plex Sans',sans-serif"}}>
              <span style={{fontFamily:"monospace"}}>⚙</span> Admin Panel
            </button>
          </>}
          {activeBiz&&<>
            <div style={{fontSize:10,color:C.muted,letterSpacing:1.5,textTransform:"uppercase",padding:"0 12px 6px"}}>Employee</div>
            <button onClick={()=>setPage("entry")} style={{width:"100%",display:"flex",alignItems:"center",gap:10,padding:"10px 12px",borderRadius:6,border:"none",cursor:"pointer",background:page==="entry"?C.accent:C.accentDim,color:page==="entry"?"#000":C.accent,fontSize:13,fontWeight:700,marginBottom:12,borderLeft:`2px solid ${C.accent}`,fontFamily:"'IBM Plex Sans',sans-serif"}}>
              <span style={{fontFamily:"monospace"}}>✎</span> Data Entry
            </button>
            <div style={{fontSize:10,color:C.muted,letterSpacing:1.5,textTransform:"uppercase",padding:"0 12px 6px"}}>Dashboards</div>
            {["overview","sales","expenses","inventory","pl","cash"].map(id=>{
              const icons={overview:"⬡",sales:"↑",expenses:"↓",inventory:"▣",pl:"≋",cash:"💵"};
              const labels={overview:"Overview",sales:"Sales",expenses:"Expenses",inventory:"Inventory",pl:"P&L",cash:"Cash Balance"};
              return <button key={id} onClick={()=>setPage(id)} style={{width:"100%",display:"flex",alignItems:"center",gap:10,padding:"9px 12px",borderRadius:6,border:"none",cursor:"pointer",background:page===id?C.accentDim:"transparent",color:page===id?C.accent:C.muted,fontSize:13,fontWeight:page===id?600:400,marginBottom:2,borderLeft:page===id?`2px solid ${C.accent}`:"2px solid transparent",fontFamily:"'IBM Plex Sans',sans-serif"}}>
                <span style={{fontFamily:"monospace",width:16,textAlign:"center"}}>{icons[id]}</span>{labels[id]}
              </button>;
            })}
          </>}
        </nav>

        {/* User footer */}
        <div style={{padding:"14px 20px",borderTop:`1px solid ${C.border}`,fontSize:11}}>
          <div style={{color:C.text,fontWeight:600,marginBottom:1}}>{user.full_name}</div>
          <div style={{color:C.muted,marginBottom:8,textTransform:"capitalize"}}>{user.role}{user.department?` · ${user.department}`:""}</div>
          <div style={{display:"flex",alignItems:"center",gap:6,marginBottom:6}}>
            <span style={{color:apiStatus==="ok"?C.green:apiStatus==="error"?C.red:C.accent,fontSize:10}}>●</span>
            <span style={{color:apiStatus==="ok"?C.green:apiStatus==="error"?C.red:C.accent}}>{apiStatus==="ok"?"Connected":apiStatus==="error"?"API Offline":"Connecting…"}</span>
          </div>
          <div style={{display:"flex",justifyContent:"space-between"}}>
            <button onClick={loadBizData} style={{fontSize:11,color:C.muted,background:"transparent",border:"none",cursor:"pointer",padding:0,fontFamily:"'IBM Plex Sans',sans-serif"}}>↻ {lastRefresh?lastRefresh.toLocaleTimeString([],{hour:"2-digit",minute:"2-digit"}):"Refresh"}</button>
            <button onClick={handleLogout} style={{fontSize:11,color:C.red,background:"transparent",border:"none",cursor:"pointer",padding:0,fontFamily:"'IBM Plex Sans',sans-serif"}}>Sign out</button>
          </div>
        </div>
      </div>

      {/* Main */}
      <div style={{flex:1,overflowY:"auto",padding:28}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:26}}>
          <div style={{fontSize:11,color:C.muted,letterSpacing:1.5,textTransform:"uppercase"}}>
            {activeBiz?`${activeBiz.name} / `:""}BizMonitor / {page.charAt(0).toUpperCase()+page.slice(1)}
          </div>
          <div style={{display:"flex",alignItems:"center",gap:10,fontSize:12,color:C.muted}}>
            {apiStatus==="loading"&&<Spinner/>}
            {activeBiz&&<span>{sales.length} sales · {expenses.length} expenses · {inventory.length} SKUs</span>}
          </div>
        </div>
        {pageMap[page]||<div style={{color:C.muted}}>Select a page</div>}
      </div>
    </div>
  );
}
