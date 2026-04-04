import { useState, useEffect, useCallback, useRef } from "react";
import { AreaChart, Area, BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";

const API = import.meta.env.VITE_API_URL || "http://localhost:8000";

const C = {
  bg:"#0a0c10",surface:"#111318",card:"#161b22",border:"#21262d",
  accent:"#f0a500",accentDim:"#f0a50022",green:"#3fb950",red:"#f85149",
  blue:"#58a6ff",purple:"#bc8cff",text:"#e6edf3",muted:"#7d8590",dim:"#30363d",
};

const months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
const saveToken  = t => localStorage.setItem("biz_token", t);
const getToken   = () => localStorage.getItem("biz_token");
const clearToken = () => localStorage.removeItem("biz_token");

async function apiFetch(path, options = {}) {
  const token = getToken();
  const { headers: extraHeaders, ...restOptions } = options;
  const res = await fetch(`${API}${path}`, {
    headers: {
      "Content-Type": "application/json",
      ...(token ? { "Authorization": `Bearer ${token}` } : {}),
      ...(extraHeaders || {}),
    },
    ...restOptions,
  });
  if (res.status === 401) { clearToken(); window.location.reload(); }
  if (!res.ok) { const err = await res.json().catch(()=>({})); throw new Error(err.detail || `API error ${res.status}`); }
  return res.json();
}
const apiGet    = p      => apiFetch(p);
const apiPost   = (p,b)  => apiFetch(p,{method:"POST",  body:JSON.stringify(b)});
const apiPatch  = (p,b)  => apiFetch(p,{method:"PATCH", body:JSON.stringify(b)});
const apiDelete = p      => apiFetch(p,{method:"DELETE"});

const fmtFull = n => Number(n).toLocaleString(undefined,{minimumFractionDigits:2,maximumFractionDigits:2});
const todayStr = () => new Date().toISOString().split("T")[0];
const timeAgo  = d => { const s=Math.floor((Date.now()-new Date(d))/1000); return s<60?`${s}s ago`:s<3600?`${Math.floor(s/60)}m ago`:s<86400?`${Math.floor(s/3600)}h ago`:`${Math.floor(s/86400)}d ago`; };

const canSeeCost = role => role==="admin"||role==="manager";

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
const css = `
  *{box-sizing:border-box;-webkit-tap-highlight-color:transparent}
  @keyframes fadeIn{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:translateY(0)}}
  @keyframes spin{to{transform:rotate(360deg)}}
  @keyframes pulse{0%,100%{opacity:1}50%{opacity:0.4}}
  input[type=date]::-webkit-calendar-picker-indicator{filter:invert(0.5)}
  select option{background:#161b22}
  body{margin:0;overflow-x:hidden}
  ::-webkit-scrollbar{width:4px;height:4px}
  ::-webkit-scrollbar-track{background:transparent}
  ::-webkit-scrollbar-thumb{background:#30363d;border-radius:4px}
  .bm-page{animation:fadeIn 0.2s ease}
`;

const iStyle = {
  width:"100%",background:C.surface,border:`1px solid ${C.border}`,borderRadius:8,
  color:C.text,padding:"11px 14px",fontSize:14,fontWeight:500,outline:"none",
  boxSizing:"border-box",fontFamily:"'IBM Plex Sans',sans-serif",
  WebkitAppearance:"none",
};

const Field = ({label,children,required}) => (
  <div style={{marginBottom:16}}>
    <label style={{fontSize:12,color:C.muted,fontWeight:700,letterSpacing:0.5,marginBottom:6,display:"block"}}>
      {label}{required&&<span style={{color:C.red,marginLeft:2}}>*</span>}
    </label>
    {children}
  </div>
);

const KpiCard = ({label,value,sub,color=C.accent,trend}) => (
  <div style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:10,padding:"16px 18px",position:"relative",overflow:"hidden"}}>
    <div style={{position:"absolute",top:0,left:0,width:3,height:"100%",background:color,borderRadius:"3px 0 0 3px"}}/>
    <div style={{fontSize:11,color:C.muted,fontWeight:700,letterSpacing:1,textTransform:"uppercase",marginBottom:8}}>{label}</div>
    <div style={{fontSize:20,fontWeight:800,color:C.text,fontFamily:"'DM Mono',monospace",letterSpacing:-0.5,wordBreak:"break-all"}}>{value}</div>
    <div style={{fontSize:12,fontWeight:600,color:trend==="up"?C.green:trend==="down"?C.red:C.muted,marginTop:5}}>
      {trend==="up"?"▲ ":trend==="down"?"▼ ":""}{sub}
    </div>
  </div>
);

const SectionHeader = ({title,subtitle}) => (
  <div style={{marginBottom:22}}>
    <div style={{display:"flex",alignItems:"center",gap:10}}>
      <div style={{width:4,height:22,background:C.accent,borderRadius:2}}/>
      <h2 style={{margin:0,fontSize:18,fontWeight:800,color:C.text}}>{title}</h2>
    </div>
    {subtitle&&<div style={{fontSize:13,fontWeight:500,color:C.muted,marginTop:4,paddingLeft:14}}>{subtitle}</div>}
  </div>
);

const Badge = ({status}) => {
  const map={ok:["In Stock",C.green],low:["Low",C.accent],out:["Out",C.red],active:["Active",C.green],inactive:["Inactive",C.red],admin:["Admin",C.accent],manager:["Manager",C.blue],employee:["Employee",C.muted]};
  const [label,color]=map[status]||[status,C.muted];
  return <span style={{fontSize:10,fontWeight:800,letterSpacing:0.8,textTransform:"uppercase",padding:"3px 8px",borderRadius:5,background:color+"22",color}}>{label}</span>;
};

const ChartCard = ({title,children,height=220}) => (
  <div style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:10,padding:"18px 18px 10px"}}>
    <div style={{fontSize:11,fontWeight:700,color:C.muted,letterSpacing:1.5,textTransform:"uppercase",marginBottom:14}}>{title}</div>
    <div style={{height}}>{children}</div>
  </div>
);

const Tip = ({active,payload,label}) => {
  if(!active||!payload?.length) return null;
  return (
    <div style={{background:C.surface,border:`1px solid ${C.border}`,borderRadius:8,padding:"10px 14px",fontSize:12}}>
      <div style={{color:C.muted,marginBottom:6,fontWeight:600}}>{label}</div>
      {payload.map((p,i)=><div key={i} style={{color:p.color,marginBottom:2,fontWeight:600}}>{p.name}: <strong>{typeof p.value==="number"?fmtFull(p.value):p.value}</strong></div>)}
    </div>
  );
};

const Toast = ({msg,color}) => (
  <div style={{position:"fixed",bottom:24,left:"50%",transform:"translateX(-50%)",background:C.card,border:`1px solid ${color}`,color,borderRadius:10,padding:"12px 22px",fontSize:14,fontWeight:700,boxShadow:`0 4px 24px ${color}44`,zIndex:9999,animation:"fadeIn 0.2s ease",whiteSpace:"nowrap",maxWidth:"90vw",textAlign:"center"}}>
    {msg}
  </div>
);

const LoadingScreen = () => (
  <div style={{position:"fixed",inset:0,background:C.bg,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",zIndex:9998,gap:28}}>
    {/* BizMonitor logo mark */}
    <div style={{width:56,height:56,background:C.accent,borderRadius:14,display:"flex",alignItems:"center",justifyContent:"center",fontSize:28,fontWeight:800,color:"#000",boxShadow:`0 0 32px ${C.accent}44`}}>B</div>
    {/* Pulsing dots */}
    <div style={{display:"flex",gap:8,alignItems:"center"}}>
      {[0,1,2].map(i=>(
        <div key={i} style={{width:8,height:8,borderRadius:"50%",background:C.accent,animation:"pulse 1.2s ease-in-out infinite",animationDelay:`${i*0.2}s`,opacity:0.3}}/>
      ))}
    </div>
    <div style={{fontSize:13,fontWeight:700,color:C.muted,letterSpacing:2,textTransform:"uppercase"}}>BizMonitor</div>
  </div>
);

const Spinner = ({size=16,color=C.accent}) => (
  <div style={{display:"inline-flex",gap:3,alignItems:"center"}}>
    {[0,1,2].map(i=>(
      <div key={i} style={{width:size/4,height:size/4,borderRadius:"50%",background:color,animation:"pulse 0.8s ease-in-out infinite",animationDelay:`${i*0.15}s`,opacity:0.4}}/>
    ))}
  </div>
);

const DelBtn = ({onClick}) => (
  <button onClick={onClick} style={{padding:"4px 10px",borderRadius:5,border:`1px solid ${C.red}33`,background:C.red+"11",color:C.red,fontSize:11,fontWeight:700,cursor:"pointer",fontFamily:"'IBM Plex Sans',sans-serif"}}>✕</button>
);

const PeriodFilter = ({value, onChange, options=[["all","All Time"],["year","This Year"],["month","This Month"],["week","This Week"]]}) => (
  <div style={{display:"flex",gap:6,flexWrap:"wrap",marginBottom:18}}>
    {options.map(([val,label])=>(
      <button key={val} onClick={()=>onChange(val)} style={{
        padding:"7px 14px",borderRadius:7,fontSize:12,fontWeight:700,cursor:"pointer",
        fontFamily:"'IBM Plex Sans',sans-serif",border:`1px solid ${value===val?C.accent:C.border}`,
        background:value===val?C.accentDim:"transparent",color:value===val?C.accent:C.muted,
      }}>{label}</button>
    ))}
  </div>
);

const ConfirmDelete = ({message,onConfirm,onCancel}) => (
  <div style={{position:"fixed",inset:0,background:"#000b",zIndex:10000,display:"flex",alignItems:"center",justifyContent:"center",padding:16}}>
    <div style={{background:C.card,border:`1px solid ${C.red}`,borderRadius:12,padding:28,width:"100%",maxWidth:360,boxShadow:`0 8px 40px ${C.red}33`}}>
      <div style={{fontSize:20,marginBottom:10}}>⚠️</div>
      <div style={{fontWeight:800,color:C.text,fontSize:16,marginBottom:10}}>Confirm Delete</div>
      <div style={{color:C.muted,fontSize:13,fontWeight:500,marginBottom:24,lineHeight:1.6}}>{message}</div>
      <div style={{display:"flex",gap:10}}>
        <button onClick={onConfirm} style={{flex:1,padding:"11px",borderRadius:8,border:"none",background:C.red,color:"#fff",fontWeight:800,fontSize:14,cursor:"pointer",fontFamily:"'IBM Plex Sans',sans-serif"}}>Yes, Delete</button>
        <button onClick={onCancel}  style={{flex:1,padding:"11px",borderRadius:8,border:`1px solid ${C.border}`,background:"transparent",color:C.muted,fontWeight:700,fontSize:14,cursor:"pointer",fontFamily:"'IBM Plex Sans',sans-serif"}}>Cancel</button>
      </div>
    </div>
  </div>
);

// ── Login ─────────────────────────────────────────────────────────────────────
const LoginScreen = ({onLogin}) => {
  const [email,setEmail]=useState(""); const [pw,setPw]=useState("");
  const [err,setErr]=useState(""); const [loading,setLoading]=useState(false);
  const go = async () => {
    if(!email||!pw) return setErr("Enter email and password.");
    setLoading(true); setErr("");
    try {
      const form=new URLSearchParams(); form.append("username",email); form.append("password",pw);
      const res=await fetch(`${API}/auth/login`,{method:"POST",body:form});
      const data=await res.json();
      if(!res.ok) throw new Error(data.detail||"Login failed");
      saveToken(data.access_token); onLogin(data.user);
    } catch(e){setErr(e.message);}
    setLoading(false);
  };
  return (
    <div style={{minHeight:"100vh",background:C.bg,display:"flex",alignItems:"center",justifyContent:"center",padding:16,fontFamily:"'IBM Plex Sans',system-ui,sans-serif"}}>
      <link href="https://fonts.googleapis.com/css2?family=IBM+Plex+Sans:wght@400;500;600;700;800&family=DM+Mono:wght@400;500&display=swap" rel="stylesheet"/>
      <style>{css}</style>
      <div style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:14,padding:36,width:"100%",maxWidth:380}}>
        <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:32}}>
          <div style={{width:40,height:40,background:C.accent,borderRadius:10,display:"flex",alignItems:"center",justifyContent:"center",fontSize:20,fontWeight:800,color:"#000"}}>B</div>
          <div><div style={{fontWeight:800,fontSize:18,color:C.text}}>BizMonitor</div><div style={{fontSize:11,fontWeight:700,color:C.muted,letterSpacing:1}}>ENTERPRISE</div></div>
        </div>
        {err&&<div style={{background:C.red+"18",border:`1px solid ${C.red}33`,borderRadius:8,padding:"11px 14px",fontSize:13,fontWeight:600,color:C.red,marginBottom:18}}>{err}</div>}
        <Field label="Email" required><input type="email" placeholder="you@company.com" value={email} onChange={e=>setEmail(e.target.value)} onKeyDown={e=>e.key==="Enter"&&go()} style={iStyle}/></Field>
        <Field label="Password" required><input type="password" placeholder="••••••••" value={pw} onChange={e=>setPw(e.target.value)} onKeyDown={e=>e.key==="Enter"&&go()} style={iStyle}/></Field>
        <button onClick={go} disabled={loading} style={{width:"100%",padding:"13px",borderRadius:9,border:"none",background:C.accent,color:"#000",fontWeight:800,fontSize:15,cursor:loading?"not-allowed":"pointer",opacity:loading?0.7:1,display:"flex",alignItems:"center",justifyContent:"center",gap:10,fontFamily:"'IBM Plex Sans',sans-serif"}}>
          {loading?<><Spinner size={16}/> Signing in…</>:"Sign In →"}
        </button>
        <div style={{marginTop:18,fontSize:12,fontWeight:500,color:C.dim,textAlign:"center"}}>Contact your admin to create an account</div>
      </div>
    </div>
  );
};

// ── Business Picker ───────────────────────────────────────────────────────────
const BusinessPicker = ({businesses, onSelect, user}) => (
  <div style={{minHeight:"100vh",background:C.bg,display:"flex",alignItems:"center",justifyContent:"center",padding:16,fontFamily:"'IBM Plex Sans',system-ui,sans-serif"}}>
    <link href="https://fonts.googleapis.com/css2?family=IBM+Plex+Sans:wght@400;500;600;700;800&family=DM+Mono:wght@400;500&display=swap" rel="stylesheet"/>
    <style>{css}</style>
    <div style={{width:"100%",maxWidth:480}}>
      <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:36}}>
        <div style={{width:40,height:40,background:C.accent,borderRadius:10,display:"flex",alignItems:"center",justifyContent:"center",fontSize:20,fontWeight:800,color:"#000"}}>B</div>
        <div><div style={{fontWeight:800,fontSize:18,color:C.text}}>BizMonitor</div><div style={{fontSize:12,fontWeight:600,color:C.muted}}>Welcome, {user.full_name}</div></div>
      </div>
      <div style={{fontSize:12,fontWeight:800,color:C.muted,marginBottom:16,letterSpacing:1.5,textTransform:"uppercase"}}>Select a Business</div>
      {businesses.length===0
        ? <div style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:12,padding:36,textAlign:"center"}}>
            <div style={{fontSize:32,marginBottom:12}}>🏢</div>
            <div style={{fontWeight:700,fontSize:15,color:C.text,marginBottom:8}}>No businesses assigned yet</div>
            <div style={{fontSize:13,fontWeight:500,color:C.muted,lineHeight:1.6}}>Your account is set up but hasn't been added to a business yet.<br/>Please contact your admin to be assigned to a business.</div>
          </div>
        : <div style={{display:"grid",gap:12}}>
            {businesses.map(b=>(
              <button key={b.id} onClick={()=>onSelect(b)} style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:12,padding:"20px 22px",cursor:"pointer",textAlign:"left",display:"flex",justifyContent:"space-between",alignItems:"center",fontFamily:"'IBM Plex Sans',sans-serif",width:"100%"}}>
                <div>
                  <div style={{fontWeight:800,fontSize:16,color:C.text}}>{b.name}</div>
                  <div style={{fontSize:13,fontWeight:500,color:C.muted,marginTop:3}}>{b.industry||"General"} · {b.currency}</div>
                </div>
                <span style={{color:C.accent,fontSize:22,fontWeight:700}}>→</span>
              </button>
            ))}
          </div>
      }
    </div>
  </div>
);

// ── Admin Panel ───────────────────────────────────────────────────────────────
const AdminPanel = ({user, businesses, onBusinessCreated}) => {
  const [tab,setTab]=useState("users");
  const [users,setUsers]=useState([]); const [activity,setActivity]=useState([]);
  const [toast,setToast]=useState(null); const [loading,setLoading]=useState(false);
  const [editUser,setEditUser]=useState(null);
  const [newUser,setNewUser]=useState({email:"",full_name:"",password:"",role:"employee",department:""});
  const [newBiz,setNewBiz]=useState({name:"",industry:"",currency:"USD"});
  const [resetPw,setResetPw]=useState({userId:null,password:""});
  const [selectedBiz,setSelectedBiz]=useState(null); const [members,setMembers]=useState([]);
  const [memberToAdd,setMemberToAdd]=useState({userId:"",role:"employee"});
  const [confirmMember,setConfirmMember]=useState(null); const [confirmBiz,setConfirmBiz]=useState(null);

  const showToast=(msg,color=C.green)=>{setToast({msg,color});setTimeout(()=>setToast(null),3000);};
  const loadUsers=async()=>{ try{setUsers(await apiGet("/admin/users"));}catch(e){showToast(e.message,C.red);}};
  const loadActivity=async()=>{ try{setActivity(await apiGet("/admin/activity"));}catch(e){showToast(e.message,C.red);}};

  useEffect(()=>{loadUsers();loadActivity();},[]);

  const createUser=async()=>{
    if(!newUser.email||!newUser.password||!newUser.full_name) return showToast("Fill all required fields",C.red);
    setLoading(true);
    try{await apiPost("/admin/users",newUser);setNewUser({email:"",full_name:"",password:"",role:"employee",department:""});loadUsers();showToast("✓ User created");}
    catch(e){showToast(e.message,C.red);}
    setLoading(false);
  };

  const toggleActive=async(u)=>{
    try{await apiPatch(`/admin/users/${u.id}`,{is_active:!u.is_active});loadUsers();showToast(`✓ User ${u.is_active?"deactivated":"activated"}`);}
    catch(e){showToast(e.message,C.red);}
  };

  const saveRole=async(u,role)=>{
    try{await apiPatch(`/admin/users/${u.id}`,{role});loadUsers();setEditUser(null);showToast("✓ Role updated");}
    catch(e){showToast(e.message,C.red);}
  };

  const doResetPw=async()=>{
    if(!resetPw.password) return showToast("Enter new password",C.red);
    try{await apiPost(`/admin/users/${resetPw.userId}/reset-password`,{new_password:resetPw.password});setResetPw({userId:null,password:""});showToast("✓ Password reset");}
    catch(e){showToast(e.message,C.red);}
  };

  const createBusiness=async()=>{
    if(!newBiz.name) return showToast("Enter business name",C.red);
    try{const b=await apiPost("/businesses",newBiz);setNewBiz({name:"",industry:"",currency:"USD"});onBusinessCreated(b);showToast("✓ Business created");}
    catch(e){showToast(e.message,C.red);}
  };

  const deleteBusiness=async(id)=>{
    try{await apiPatch(`/businesses/${id}`,{is_active:false});showToast("✓ Business deactivated");onBusinessCreated(null);}
    catch(e){showToast(e.message,C.red);}
    setConfirmBiz(null);
  };

  const loadMembers=async(bizId)=>{
    try{setMembers(await apiGet(`/businesses/${bizId}/members`));}catch(e){showToast(e.message,C.red);}
  };

  const selectBiz=(b)=>{setSelectedBiz(b);loadMembers(b.id);setMemberToAdd({userId:"",role:"employee"});};

  const addMember=async()=>{
    if(!memberToAdd.userId) return showToast("Select an employee",C.red);
    try{await apiPost(`/businesses/${selectedBiz.id}/members`,{user_id:Number(memberToAdd.userId),role:memberToAdd.role});loadMembers(selectedBiz.id);setMemberToAdd({userId:"",role:"employee"});showToast("✓ Employee added");}
    catch(e){showToast(e.message,C.red);}
  };

  const removeMember=async(userId)=>{
    try{await apiDelete(`/businesses/${selectedBiz.id}/members/${userId}`);loadMembers(selectedBiz.id);showToast("✓ Employee removed");}
    catch(e){showToast(e.message,C.red);}
    setConfirmMember(null);
  };

  const nonMembers=users.filter(u=>!members.some(m=>m.user_id===u.id));
  const ROLE_COLORS={admin:C.accent,manager:C.blue,employee:C.muted};
  const TABS=[["users","👥 Users"],["businesses","🏢 Businesses"],["members","🔗 Members"],["activity","📋 Activity"]];

  return (
    <div>
      {toast&&<Toast msg={toast.msg} color={toast.color}/>}
      {confirmBiz&&<ConfirmDelete message={`Deactivate "${confirmBiz.name}"? Data is preserved.`} onConfirm={()=>deleteBusiness(confirmBiz.id)} onCancel={()=>setConfirmBiz(null)}/>}
      {confirmMember&&<ConfirmDelete message={`Remove ${confirmMember.name} from ${selectedBiz?.name}?`} onConfirm={()=>removeMember(confirmMember.userId)} onCancel={()=>setConfirmMember(null)}/>}
      <SectionHeader title="Admin Panel" subtitle="Manage users, businesses and view activity"/>
      <div style={{display:"flex",gap:8,marginBottom:24,flexWrap:"wrap"}}>
        {TABS.map(([id,label])=>(
          <button key={id} onClick={()=>setTab(id)} style={{padding:"9px 16px",borderRadius:8,border:`1px solid ${tab===id?C.accent:C.border}`,background:tab===id?C.accentDim:"transparent",color:tab===id?C.accent:C.muted,fontWeight:700,fontSize:13,cursor:"pointer",fontFamily:"'IBM Plex Sans',sans-serif"}}>{label}</button>
        ))}
      </div>

      {/* USERS */}
      {tab==="users"&&(
        <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(320px,1fr))",gap:20}}>
          <div style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:12,padding:24}}>
            <div style={{fontSize:13,fontWeight:800,color:C.accent,marginBottom:20}}><span style={{background:C.accentDim,padding:"4px 12px",borderRadius:6}}>+ Create New User</span></div>
            <Field label="Full Name" required><input type="text" style={iStyle} placeholder="John Smith" value={newUser.full_name} onChange={e=>setNewUser({...newUser,full_name:e.target.value})}/></Field>
            <Field label="Email" required><input type="email" style={iStyle} placeholder="user@company.com" value={newUser.email} onChange={e=>setNewUser({...newUser,email:e.target.value})}/></Field>
            <Field label="Password" required><input type="password" style={iStyle} placeholder="Min 8 characters" value={newUser.password} onChange={e=>setNewUser({...newUser,password:e.target.value})}/></Field>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
              <Field label="Role">
                <select style={iStyle} value={newUser.role} onChange={e=>setNewUser({...newUser,role:e.target.value})}>
                  {["employee","manager","admin"].map(r=><option key={r}>{r}</option>)}
                </select>
              </Field>
              <Field label="Department"><input type="text" style={iStyle} placeholder="Sales, HR…" value={newUser.department} onChange={e=>setNewUser({...newUser,department:e.target.value})}/></Field>
            </div>
            <button onClick={createUser} disabled={loading} style={{width:"100%",padding:"12px",borderRadius:8,border:"none",background:loading?C.dim:C.accent,color:loading?C.muted:"#000",fontWeight:800,fontSize:14,cursor:loading?"not-allowed":"pointer",fontFamily:"'IBM Plex Sans',sans-serif",display:"flex",alignItems:"center",justifyContent:"center",gap:8}}>
              {loading?<><Spinner size={14}/> Creating…</>:"Create User"}
            </button>
          </div>
          <div style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:12,padding:24}}>
            <div style={{fontSize:11,fontWeight:800,color:C.muted,letterSpacing:1.5,textTransform:"uppercase",marginBottom:16}}>All Users ({users.length})</div>
            <div style={{display:"grid",gap:8,maxHeight:520,overflowY:"auto"}}>
              {users.map(u=>(
                <div key={u.id} style={{background:C.surface,borderRadius:10,padding:"12px 14px",border:`1px solid ${C.border}`}}>
                  <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:10}}>
                    <div>
                      <div style={{fontSize:14,fontWeight:700,color:u.is_active?C.text:C.muted}}>{u.full_name}</div>
                      <div style={{fontSize:12,fontWeight:500,color:C.muted,marginTop:2}}>{u.email}{u.department?` · ${u.department}`:""}</div>
                    </div>
                    <div style={{display:"flex",gap:6}}><Badge status={u.role}/><Badge status={u.is_active?"active":"inactive"}/></div>
                  </div>
                  <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
                    {editUser===u.id
                      ? <><select style={{...iStyle,fontSize:12,padding:"5px 8px",width:"auto"}} defaultValue={u.role} onChange={e=>saveRole(u,e.target.value)}>{["employee","manager","admin"].map(r=><option key={r}>{r}</option>)}</select><button onClick={()=>setEditUser(null)} style={{padding:"5px 10px",borderRadius:6,border:`1px solid ${C.border}`,background:"transparent",color:C.muted,fontSize:12,fontWeight:600,cursor:"pointer",fontFamily:"'IBM Plex Sans',sans-serif"}}>Cancel</button></>
                      : <button onClick={()=>setEditUser(u.id)} style={{padding:"5px 12px",borderRadius:6,border:`1px solid ${C.blue}`,background:C.blue+"18",color:C.blue,fontSize:12,fontWeight:700,cursor:"pointer",fontFamily:"'IBM Plex Sans',sans-serif"}}>Change Role</button>
                    }
                    {resetPw.userId===u.id
                      ? <div style={{display:"flex",gap:6,flex:1}}><input type="password" style={{...iStyle,fontSize:12,padding:"5px 10px"}} placeholder="New password" value={resetPw.password} onChange={e=>setResetPw({...resetPw,password:e.target.value})}/><button onClick={doResetPw} style={{padding:"5px 10px",borderRadius:6,border:"none",background:C.accent,color:"#000",fontSize:12,fontWeight:700,cursor:"pointer",fontFamily:"'IBM Plex Sans',sans-serif"}}>Set</button><button onClick={()=>setResetPw({userId:null,password:""})} style={{padding:"5px 8px",borderRadius:6,border:`1px solid ${C.border}`,background:"transparent",color:C.muted,fontSize:12,cursor:"pointer",fontFamily:"'IBM Plex Sans',sans-serif"}}>✕</button></div>
                      : <button onClick={()=>setResetPw({userId:u.id,password:""})} style={{padding:"5px 12px",borderRadius:6,border:`1px solid ${C.purple}`,background:C.purple+"18",color:C.purple,fontSize:12,fontWeight:700,cursor:"pointer",fontFamily:"'IBM Plex Sans',sans-serif"}}>Reset PW</button>
                    }
                    {u.id!==user.id&&<button onClick={()=>toggleActive(u)} style={{padding:"5px 12px",borderRadius:6,border:`1px solid ${u.is_active?C.red:C.green}`,background:u.is_active?C.red+"18":C.green+"18",color:u.is_active?C.red:C.green,fontSize:12,fontWeight:700,cursor:"pointer",marginLeft:"auto",fontFamily:"'IBM Plex Sans',sans-serif"}}>{u.is_active?"Deactivate":"Activate"}</button>}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* BUSINESSES */}
      {tab==="businesses"&&(
        <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(300px,1fr))",gap:20}}>
          <div style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:12,padding:24}}>
            <div style={{fontSize:13,fontWeight:800,color:C.accent,marginBottom:20}}><span style={{background:C.accentDim,padding:"4px 12px",borderRadius:6}}>+ Create Business</span></div>
            <Field label="Business Name" required><input type="text" style={iStyle} placeholder="e.g. Pius Shop" value={newBiz.name} onChange={e=>setNewBiz({...newBiz,name:e.target.value})}/></Field>
            <Field label="Industry"><input type="text" style={iStyle} placeholder="Retail, Manufacturing…" value={newBiz.industry} onChange={e=>setNewBiz({...newBiz,industry:e.target.value})}/></Field>
            <Field label="Currency">
              <select style={iStyle} value={newBiz.currency} onChange={e=>setNewBiz({...newBiz,currency:e.target.value})}>
                {["USD","TZS","KES","GBP","EUR","ZAR"].map(c=><option key={c}>{c}</option>)}
              </select>
            </Field>
            <button onClick={createBusiness} style={{width:"100%",padding:"12px",borderRadius:8,border:"none",background:C.accent,color:"#000",fontWeight:800,fontSize:14,cursor:"pointer",fontFamily:"'IBM Plex Sans',sans-serif"}}>Create Business</button>
            <div style={{marginTop:14,padding:"10px 14px",background:C.blue+"10",borderRadius:8,fontSize:12,fontWeight:600,color:C.blue}}>
              💡 After creating, go to 🔗 Members to assign employees.
            </div>
          </div>
          <div style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:12,padding:24}}>
            <div style={{fontSize:11,fontWeight:800,color:C.muted,letterSpacing:1.5,textTransform:"uppercase",marginBottom:16}}>All Businesses ({businesses.length})</div>
            <div style={{display:"grid",gap:10}}>
              {businesses.map(b=>(
                <div key={b.id} style={{background:C.surface,borderRadius:10,padding:"14px 16px",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                  <div>
                    <div style={{fontWeight:700,color:C.text,fontSize:15}}>{b.name}</div>
                    <div style={{fontSize:12,fontWeight:500,color:C.muted,marginTop:3}}>{b.industry||"General"} · {b.currency} · ID: {b.id}</div>
                  </div>
                  <div style={{display:"flex",gap:8,alignItems:"center"}}>
                    <button onClick={()=>{selectBiz(b);setTab("members");}} style={{fontSize:12,fontWeight:700,padding:"5px 12px",borderRadius:6,border:`1px solid ${C.blue}`,background:C.blue+"18",color:C.blue,cursor:"pointer",fontFamily:"'IBM Plex Sans',sans-serif"}}>Members →</button>
                    <DelBtn onClick={()=>setConfirmBiz(b)}/>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* MEMBERS */}
      {tab==="members"&&(
        <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(300px,1fr))",gap:20}}>
          <div style={{display:"grid",gap:16}}>
            <div style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:12,padding:24}}>
              <div style={{fontSize:11,fontWeight:800,color:C.muted,letterSpacing:1.5,textTransform:"uppercase",marginBottom:14}}>Select Business</div>
              <div style={{display:"grid",gap:8}}>
                {businesses.map(b=>(
                  <button key={b.id} onClick={()=>selectBiz(b)} style={{padding:"12px 16px",borderRadius:8,border:`1px solid ${selectedBiz?.id===b.id?C.accent:C.border}`,background:selectedBiz?.id===b.id?C.accentDim:"transparent",color:selectedBiz?.id===b.id?C.accent:C.text,textAlign:"left",cursor:"pointer",fontFamily:"'IBM Plex Sans',sans-serif",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                    <div><div style={{fontWeight:700,fontSize:14}}>{b.name}</div><div style={{fontSize:12,fontWeight:500,color:C.muted,marginTop:2}}>{b.industry||"General"}</div></div>
                    {selectedBiz?.id===b.id&&<span style={{fontSize:16}}>✓</span>}
                  </button>
                ))}
              </div>
            </div>
            {selectedBiz&&(
              <div style={{background:C.card,border:`1px solid ${C.accent}33`,borderRadius:12,padding:24}}>
                <div style={{fontSize:13,fontWeight:800,color:C.accent,marginBottom:16}}><span style={{background:C.accentDim,padding:"4px 12px",borderRadius:6}}>+ Add to {selectedBiz.name}</span></div>
                <Field label="Select Employee">
                  <select style={iStyle} value={memberToAdd.userId} onChange={e=>setMemberToAdd({...memberToAdd,userId:e.target.value})}>
                    <option value="">— Choose employee —</option>
                    {nonMembers.filter(u=>u.is_active).map(u=><option key={u.id} value={u.id}>{u.full_name} ({u.email})</option>)}
                  </select>
                </Field>
                <Field label="Role in this Business">
                  <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:8}}>
                    {[["employee","Employee",C.muted],["manager","Manager",C.blue],["admin","Admin",C.accent]].map(([val,label,color])=>(
                      <button key={val} onClick={()=>setMemberToAdd({...memberToAdd,role:val})} style={{padding:"9px",borderRadius:7,border:`1px solid ${memberToAdd.role===val?color:C.border}`,background:memberToAdd.role===val?color+"22":"transparent",color:memberToAdd.role===val?color:C.muted,fontSize:12,fontWeight:700,cursor:"pointer",fontFamily:"'IBM Plex Sans',sans-serif"}}>{label}</button>
                    ))}
                  </div>
                </Field>
                <div style={{background:C.surface,borderRadius:8,padding:"10px 14px",marginBottom:14,fontSize:12,fontWeight:600,color:C.muted}}>
                  {memberToAdd.role==="employee"?"Can log sales and expenses. Cannot delete records."
                  :memberToAdd.role==="manager"?"Sees all dashboards. Can delete records. Cannot manage users."
                  :"Full access including user management."}
                </div>
                <button onClick={addMember} style={{width:"100%",padding:"12px",borderRadius:8,border:"none",background:C.accent,color:"#000",fontWeight:800,fontSize:14,cursor:"pointer",fontFamily:"'IBM Plex Sans',sans-serif"}}>+ Add Member</button>
              </div>
            )}
          </div>
          <div style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:12,padding:24}}>
            {!selectedBiz
              ? <div style={{display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",height:260,color:C.muted,gap:12}}><div style={{fontSize:36}}>🏢</div><div style={{fontSize:14,fontWeight:600}}>Select a business</div></div>
              : <>
                  <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16}}>
                    <div style={{fontSize:14,fontWeight:800,color:C.text}}>{selectedBiz.name}</div>
                    <span style={{fontSize:12,fontWeight:600,color:C.muted}}>{members.length} member{members.length!==1?"s":""}</span>
                  </div>
                  {members.length===0
                    ? <div style={{textAlign:"center",padding:32,color:C.muted,fontWeight:600}}><div style={{fontSize:28,marginBottom:8}}>👤</div>No members yet.</div>
                    : <div style={{display:"grid",gap:10}}>
                        {members.map(m=>{
                          const userInfo=users.find(u=>u.id===m.user_id);
                          const roleColor=ROLE_COLORS[m.role]||C.muted;
                          return (
                            <div key={m.id} style={{background:C.surface,borderRadius:10,padding:"12px 14px",border:`1px solid ${C.border}`}}>
                              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                                <div style={{display:"flex",alignItems:"center",gap:10}}>
                                  <div style={{width:32,height:32,borderRadius:"50%",background:roleColor+"33",display:"flex",alignItems:"center",justifyContent:"center",fontSize:13,fontWeight:800,color:roleColor,flexShrink:0}}>
                                    {(userInfo?.full_name||"?")[0].toUpperCase()}
                                  </div>
                                  <div>
                                    <div style={{fontSize:13,fontWeight:700,color:C.text}}>{userInfo?.full_name||`User #${m.user_id}`}</div>
                                    <div style={{fontSize:11,fontWeight:500,color:C.muted}}>{userInfo?.email}</div>
                                  </div>
                                </div>
                                <div style={{display:"flex",alignItems:"center",gap:8}}>
                                  <select value={m.role} onChange={async e=>{try{await apiPost(`/businesses/${selectedBiz.id}/members`,{user_id:m.user_id,role:e.target.value});loadMembers(selectedBiz.id);}catch(err){showToast(err.message,C.red);}}} style={{...iStyle,width:"auto",padding:"4px 8px",fontSize:11,color:roleColor,background:roleColor+"18",border:`1px solid ${roleColor}44`}}>
                                    <option value="employee">Employee</option>
                                    <option value="manager">Manager</option>
                                    <option value="admin">Admin</option>
                                  </select>
                                  <DelBtn onClick={()=>setConfirmMember({userId:m.user_id,name:userInfo?.full_name||`User #${m.user_id}`})}/>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                  }
                </>
            }
          </div>
        </div>
      )}

      {/* ACTIVITY */}
      {tab==="activity"&&(
        <div style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:12,overflow:"hidden"}}>
          <div style={{padding:"14px 20px",borderBottom:`1px solid ${C.border}`,fontSize:11,fontWeight:800,color:C.muted,letterSpacing:1.5,textTransform:"uppercase"}}>System Activity — Last 200 Events</div>
          <div style={{maxHeight:600,overflowY:"auto"}}>
            <table style={{width:"100%",borderCollapse:"collapse",fontSize:13}}>
              <thead style={{position:"sticky",top:0,background:C.surface}}>
                <tr>{["Time","Action","Detail","User","Business"].map(h=><th key={h} style={{padding:"10px 16px",textAlign:"left",color:C.muted,fontWeight:700,fontSize:11,letterSpacing:1,textTransform:"uppercase"}}>{h}</th>)}</tr>
              </thead>
              <tbody>
                {activity.map(a=>(
                  <tr key={a.id} style={{borderTop:`1px solid ${C.border}`}}>
                    <td style={{padding:"10px 16px",color:C.muted,fontSize:11,fontFamily:"'DM Mono',monospace",whiteSpace:"nowrap"}}>{timeAgo(a.created_at)}</td>
                    <td style={{padding:"10px 16px"}}><span style={{fontSize:11,fontWeight:700,padding:"2px 8px",borderRadius:5,background:C.blue+"22",color:C.blue}}>{a.action}</span></td>
                    <td style={{padding:"10px 16px",color:C.muted,fontSize:12,fontWeight:500}}>{a.detail||"—"}</td>
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
const DataEntry = ({inventory, onRefresh, bizId, apiStatus, recentSales, recentExpenses, userRole}) => {
  const [tab,setTab]=useState("sale");
  const [toast,setToast]=useState(null); const [loading,setLoading]=useState(false);
  const [editEntry,setEditEntry]=useState(null);

  const [sale,setSale]=useState({date:todayStr(),sku:"",product:"",unit_price:"",units:"",rep:"",notes:""});
  const [expense,setExpense]=useState({date:todayStr(),category:"Operations",amount:"",vendor:"",description:"",submitted_by:""});
  const [stock,setStock]=useState({sku:"",qty:"",movement_type:"add",reason:"",received_by:"",date:todayStr(),new_unit_cost:""});
  const [product,setProduct]=useState({sku:"",name:"",stock:"",reorder:"",unit_cost:""});

  const showToast=(msg,color=C.green)=>{setToast({msg,color});setTimeout(()=>setToast(null),3000);};
  const ok = apiStatus==="ok";

  const selItem = inventory.find(i=>i.sku===sale.sku);
  const saleTotal  = sale.unit_price && sale.units ? Number(sale.unit_price)*Number(sale.units) : null;
  const saleCost   = selItem && sale.units ? selItem.unit_cost*Number(sale.units) : null;
  const saleProfit = saleTotal!==null && saleCost!==null ? saleTotal-saleCost : null;
  const saleMargin = saleTotal && saleProfit!==null ? (saleProfit/saleTotal*100).toFixed(1) : null;

  const handleSkuSelect=(sku)=>{
    const item=inventory.find(i=>i.sku===sku);
    setSale(prev=>({...prev,sku,product:item?item.name:prev.product}));
  };

  const submitSale=async()=>{
    if(!sale.product||!sale.unit_price||!sale.units) return showToast("✕ Fill product, price and units",C.red);
    if(Number(sale.unit_price)<=0||Number(sale.units)<=0) return showToast("✕ Price and units must be > 0",C.red);
    if(selItem && Number(sale.units)>selItem.stock) return showToast(`✕ Only ${selItem.stock} in stock`,C.red);
    setLoading(true);
    try{
      await apiPost(`/businesses/${bizId}/sales`,{date:sale.date,sku:sale.sku||null,product:sale.product,unit_price:Number(sale.unit_price),amount:saleTotal,units:Number(sale.units),rep:sale.rep,notes:sale.notes});
      setSale({date:todayStr(),sku:"",product:"",unit_price:"",units:"",rep:"",notes:""});
      showToast(selItem?`✓ Sale saved — ${sale.units} units deducted`:"✓ Sale saved");
      onRefresh();
    }catch(e){showToast(`✕ ${e.message}`,C.red);}
    setLoading(false);
  };

  const submitExpense=async()=>{
    if(!expense.amount||!expense.vendor||!expense.description) return showToast("✕ Fill required fields",C.red);
    setLoading(true);
    try{
      await apiPost(`/businesses/${bizId}/expenses`,{...expense,amount:Number(expense.amount)});
      setExpense({date:todayStr(),category:"Operations",amount:"",vendor:"",description:"",submitted_by:""});
      showToast("✓ Expense saved"); onRefresh();
    }catch(e){showToast(`✕ ${e.message}`,C.red);}
    setLoading(false);
  };

  const submitStock=async()=>{
    if(!stock.sku||!stock.qty) return showToast("✕ Fill required fields",C.red);
    setLoading(true);
    try{
      await apiPatch(`/businesses/${bizId}/inventory/${stock.sku}/stock`,{movement_type:stock.movement_type,qty:Number(stock.qty),reason:stock.reason,received_by:stock.received_by,new_unit_cost:stock.new_unit_cost?Number(stock.new_unit_cost):null});
      setStock({sku:"",qty:"",movement_type:"add",reason:"",received_by:"",date:todayStr(),new_unit_cost:""});
      showToast("✓ Stock updated"); onRefresh();
    }catch(e){showToast(`✕ ${e.message}`,C.red);}
    setLoading(false);
  };

  const submitProduct=async()=>{
    if(!product.sku||!product.name) return showToast("✕ SKU and name required",C.red);
    setLoading(true);
    try{
      await apiPost(`/businesses/${bizId}/inventory`,{sku:product.sku.toUpperCase(),name:product.name,stock:Number(product.stock)||0,reorder:Number(product.reorder)||50,unit_cost:Number(product.unit_cost)||0});
      setProduct({sku:"",name:"",stock:"",reorder:"",unit_cost:""});
      showToast("✓ Product added"); onRefresh();
    }catch(e){showToast(`✕ ${e.message}`,C.red);}
    setLoading(false);
  };

  const sel  = inventory.find(i=>i.sku===stock.sku);
  const prev = sel && stock.qty ? Math.max(0,sel.stock+(stock.movement_type==="remove"?-Number(stock.qty):Number(stock.qty))) : null;

  const TABS=[["sale","↑ Sale",C.green],["expense","↓ Expense",C.red],["stock","▣ Stock",C.blue],["product","＋ Product",C.purple]];

  // Sort recent entries by category/product name
  // Recent entries — newest first (by entry time)
  const sortedSales    = [...(recentSales||[])];
  const sortedExpenses = [...(recentExpenses||[])];

  const RecentPanel = () => {
    const items = tab==="sale" ? sortedSales.slice(0,8) : tab==="expense" ? sortedExpenses.slice(0,8) : null;
    if(!items) return (
      <div style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:12,padding:24,fontSize:13,fontWeight:500,color:C.muted}}>
        <div style={{fontSize:11,fontWeight:800,letterSpacing:1.5,textTransform:"uppercase",marginBottom:14}}>Tips</div>
        {tab==="stock"?<>• Select product to see live stock<br/><br/>• Received = adds stock<br/>• Dispatched = removes stock<br/>• Adjust = manual correction<br/><br/>• You can update unit cost when receiving new stock</>:<>• Add products first using ＋ Product<br/><br/>• SKU must be unique per business<br/>• Unit cost is what you paid per unit</>}
      </div>
    );
    return (
      <div style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:12,padding:20}}>
        <div style={{fontSize:11,fontWeight:800,color:C.muted,letterSpacing:1.5,textTransform:"uppercase",marginBottom:14}}>
          Recent {tab==="sale"?"Sales":"Expenses"} — most recent first
        </div>
        {items.length===0
          ? <div style={{color:C.muted,fontSize:13,fontWeight:600,textAlign:"center",padding:24}}>No entries yet.</div>
          : <div style={{display:"grid",gap:8,maxHeight:480,overflowY:"auto"}}>
              {items.map(item=>(
                <div key={item.id} style={{background:C.surface,borderRadius:9,padding:"12px 14px",border:`1px solid ${C.border}`}}>
                  <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start"}}>
                    <div style={{flex:1,minWidth:0}}>
                      <div style={{fontSize:14,fontWeight:700,color:C.text,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>
                        {tab==="sale"?item.product:item.vendor}
                      </div>
                      <div style={{fontSize:11,fontWeight:600,color:C.muted,marginTop:3}}>
                        {String(item.date)} · {tab==="sale"?`${item.units} units`:item.category}
                      </div>
                    </div>
                    <div style={{textAlign:"right",flexShrink:0,marginLeft:10}}>
                      <div style={{fontFamily:"'DM Mono',monospace",fontSize:14,fontWeight:700,color:tab==="sale"?C.green:C.red}}>
                        {fmtFull(item.amount)}
                      </div>
                      <button onClick={()=>setEditEntry({type:tab,id:item.id,date:String(item.date),sku:item.sku||"",product:item.product,unit_price:item.unit_price||"",units:item.units,rep:item.rep||"",notes:item.notes||"",category:item.category,vendor:item.vendor,description:item.description,amount:item.amount,submitted_by:item.submitted_by||"",original:item})}
                        style={{fontSize:11,fontWeight:700,color:C.accent,background:"transparent",border:`1px solid ${C.accent}33`,borderRadius:5,padding:"3px 8px",cursor:"pointer",marginTop:5,fontFamily:"'IBM Plex Sans',sans-serif"}}>
                        ✎ Edit
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
        }
      </div>
    );
  };

  return (
    <div>
      {toast&&<Toast msg={toast.msg} color={toast.color}/>}

      {/* Edit Entry Modal */}
      {editEntry&&(
        <div style={{position:"fixed",inset:0,background:"#000c",zIndex:10000,display:"flex",alignItems:"center",justifyContent:"center",padding:16}}>
          <div style={{background:C.card,border:`1px solid ${C.accent}`,borderRadius:14,padding:28,width:"100%",maxWidth:420,maxHeight:"90vh",overflowY:"auto"}}>
            <div style={{fontSize:16,fontWeight:800,color:C.text,marginBottom:4}}>Edit {editEntry.type==="sale"?"Sale":"Expense"}</div>
            <div style={{fontSize:12,fontWeight:600,color:C.muted,marginBottom:20}}>
              {editEntry.type==="sale"?editEntry.original?.product:editEntry.original?.vendor} — {fmtFull(editEntry.original?.amount)}
            </div>

            <Field label="Date">
              <input type="date" style={iStyle} value={editEntry.date} onChange={e=>setEditEntry({...editEntry,date:e.target.value})}/>
            </Field>

            {editEntry.type==="sale"&&<>
              <Field label="Product Name">
                <input type="text" style={iStyle} value={editEntry.product} onChange={e=>setEditEntry({...editEntry,product:e.target.value})}/>
              </Field>
              <Field label="SKU (leave blank if none)">
                <input type="text" style={iStyle} value={editEntry.sku} onChange={e=>setEditEntry({...editEntry,sku:e.target.value.toUpperCase()})}/>
              </Field>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
                <Field label="Unit Price"><input type="number" style={iStyle} value={editEntry.unit_price} onChange={e=>setEditEntry({...editEntry,unit_price:e.target.value})}/></Field>
                <Field label="Units"><input type="number" style={iStyle} value={editEntry.units} onChange={e=>setEditEntry({...editEntry,units:e.target.value})}/></Field>
              </div>
              <Field label="Rep"><input type="text" style={iStyle} value={editEntry.rep} onChange={e=>setEditEntry({...editEntry,rep:e.target.value})}/></Field>
              <Field label="Notes"><textarea style={{...iStyle,resize:"vertical",minHeight:60}} value={editEntry.notes} onChange={e=>setEditEntry({...editEntry,notes:e.target.value})}/></Field>
            </>}

            {editEntry.type==="expense"&&<>
              <Field label="Category">
                <select style={iStyle} value={editEntry.category} onChange={e=>setEditEntry({...editEntry,category:e.target.value})}>
                  {["Operations","Marketing","Payroll","Travel","Utilities","Office Supplies","Software","Other"].map(c=><option key={c}>{c}</option>)}
                </select>
              </Field>
              <Field label="Amount"><input type="number" style={iStyle} value={editEntry.amount} onChange={e=>setEditEntry({...editEntry,amount:e.target.value})}/></Field>
              <Field label="Vendor"><input type="text" style={iStyle} value={editEntry.vendor} onChange={e=>setEditEntry({...editEntry,vendor:e.target.value})}/></Field>
              <Field label="Description"><textarea style={{...iStyle,resize:"vertical",minHeight:60}} value={editEntry.description} onChange={e=>setEditEntry({...editEntry,description:e.target.value})}/></Field>
              <Field label="Submitted By"><input type="text" style={iStyle} value={editEntry.submitted_by} onChange={e=>setEditEntry({...editEntry,submitted_by:e.target.value})}/></Field>
            </>}

            <div style={{fontSize:11,fontWeight:600,color:C.muted,marginBottom:16,padding:"8px 12px",background:C.surface,borderRadius:7}}>
              ⚠ Editing recreates this entry. {editEntry.type==="sale"?"Inventory stock will NOT change.":""}
            </div>
            <div style={{display:"flex",gap:10}}>
              <button onClick={async()=>{
                setLoading(true);
                try{
                  const e=editEntry;
                  if(e.type==="sale"){
                    await apiDelete(`/businesses/${bizId}/sales/${e.id}`);
                    const newAmt = e.unit_price && e.units ? Number(e.unit_price)*Number(e.units) : e.amount;
                    await apiPost(`/businesses/${bizId}/sales`,{date:e.date,sku:null,product:e.product,unit_price:Number(e.unit_price)||null,amount:Number(newAmt),units:Number(e.units),rep:e.rep||null,notes:e.notes||null});
                  } else {
                    await apiDelete(`/businesses/${bizId}/expenses/${e.id}`);
                    await apiPost(`/businesses/${bizId}/expenses`,{date:e.date,category:e.category,amount:Number(e.amount),vendor:e.vendor,description:e.description,submitted_by:e.submitted_by||null});
                  }
                  setEditEntry(null);
                  showToast("✓ Entry updated");
                  onRefresh();
                }catch(err){showToast(`✕ ${err.message}`,C.red);}
                setLoading(false);
              }} disabled={loading} style={{flex:1,padding:"12px",borderRadius:8,border:"none",background:C.accent,color:"#000",fontWeight:800,fontSize:14,cursor:"pointer",fontFamily:"'IBM Plex Sans',sans-serif",display:"flex",alignItems:"center",justifyContent:"center",gap:8}}>
                {loading?<><Spinner size={14}/> Saving…</>:"💾 Save Changes"}
              </button>
              <button onClick={()=>setEditEntry(null)} style={{flex:1,padding:"12px",borderRadius:8,border:`1px solid ${C.border}`,background:"transparent",color:C.muted,fontWeight:700,fontSize:14,cursor:"pointer",fontFamily:"'IBM Plex Sans',sans-serif"}}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      <SectionHeader title="Data Entry" subtitle="Log sales, expenses, stock and add products"/>
      <div style={{display:"flex",gap:8,marginBottom:22,flexWrap:"wrap"}}>
        {TABS.map(([id,label,color])=>(
          <button key={id} onClick={()=>setTab(id)} style={{padding:"10px 18px",borderRadius:8,border:`1px solid ${tab===id?color:C.border}`,background:tab===id?color+"18":"transparent",color:tab===id?color:C.muted,fontWeight:700,fontSize:14,cursor:"pointer",fontFamily:"'IBM Plex Sans',sans-serif"}}>{label}</button>
        ))}
      </div>

      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(300px,1fr))",gap:20}}>

        {/* SALE */}
        {tab==="sale"&&<>
          <div style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:12,padding:24}}>
            <div style={{fontSize:14,fontWeight:800,color:C.green,marginBottom:20}}><span style={{background:C.green+"18",padding:"5px 14px",borderRadius:7}}>↑ New Sale</span></div>
            <Field label="Date" required><input type="date" style={iStyle} value={sale.date} onChange={e=>setSale({...sale,date:e.target.value})}/></Field>
            <Field label="Product from Inventory" required>
              <select style={iStyle} value={sale.sku} onChange={e=>handleSkuSelect(e.target.value)}>
                <option value="">— Select product —</option>
                {inventory.map(i=><option key={i.sku} value={i.sku}>{i.name} ({i.sku}) — {i.stock} in stock</option>)}
                <option value="__manual__">✎ Enter manually</option>
              </select>
            </Field>
            {sale.sku==="__manual__"&&<Field label="Product Name" required><input type="text" style={iStyle} placeholder="Product/service name" value={sale.product} onChange={e=>setSale({...sale,product:e.target.value})}/></Field>}
            {selItem&&(
              <div style={{padding:"9px 12px",borderRadius:8,marginBottom:16,fontSize:13,fontWeight:600,background:selItem.status==="out"?C.red+"18":selItem.status==="low"?C.accent+"18":C.green+"10",color:selItem.status==="out"?C.red:selItem.status==="low"?C.accent:C.green,border:`1px solid ${selItem.status==="out"?C.red:selItem.status==="low"?C.accent:C.green}33`}}>
                {selItem.status==="out"?"⚠ Out of stock":selItem.status==="low"?`⚠ Low — ${selItem.stock} left`:`✓ ${selItem.stock} in stock`}
                {canSeeCost(userRole)&&` · Cost: ${fmtFull(selItem.unit_cost)}`}
              </div>
            )}
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
              <Field label="Selling Price" required><input type="number" style={iStyle} placeholder="Per unit" value={sale.unit_price} onChange={e=>setSale({...sale,unit_price:e.target.value})}/></Field>
              <Field label="Units Sold" required><input type="number" style={iStyle} placeholder="Qty" value={sale.units} onChange={e=>setSale({...sale,units:e.target.value})}/></Field>
            </div>
            {saleTotal!==null&&(
              <div style={{background:C.surface,border:`1px solid ${C.border}`,borderRadius:9,padding:"14px 16px",marginBottom:16}}>
                <div style={{display:"flex",justifyContent:"space-between",marginBottom:canSeeCost(userRole)?8:0}}>
                  <span style={{fontSize:13,fontWeight:600,color:C.muted}}>Revenue ({fmtFull(Number(sale.unit_price))} × {sale.units})</span>
                  <span style={{fontSize:15,fontWeight:800,color:C.green,fontFamily:"'DM Mono',monospace"}}>{fmtFull(saleTotal)}</span>
                </div>
                {canSeeCost(userRole)&&saleCost!==null&&<>
                  <div style={{display:"flex",justifyContent:"space-between",marginBottom:8}}>
                    <span style={{fontSize:13,fontWeight:600,color:C.muted}}>Cost ({fmtFull(selItem.unit_cost)} × {sale.units})</span>
                    <span style={{fontSize:15,fontWeight:800,color:C.red,fontFamily:"'DM Mono',monospace"}}>− {fmtFull(saleCost)}</span>
                  </div>
                  <div style={{borderTop:`1px solid ${C.border}`,paddingTop:8,display:"flex",justifyContent:"space-between"}}>
                    <span style={{fontSize:13,fontWeight:700,color:C.muted}}>Gross Profit <span style={{color:C.dim,fontWeight:500}}>({saleMargin}%)</span></span>
                    <span style={{fontSize:16,fontWeight:800,color:saleProfit>=0?C.accent:C.red,fontFamily:"'DM Mono',monospace"}}>{fmtFull(Math.abs(saleProfit))}</span>
                  </div>
                </>}
              </div>
            )}
            <Field label="Sales Rep"><input type="text" style={iStyle} placeholder="Staff name (optional)" value={sale.rep} onChange={e=>setSale({...sale,rep:e.target.value})}/></Field>
            <Field label="Notes"><textarea style={{...iStyle,resize:"vertical",minHeight:52}} value={sale.notes} onChange={e=>setSale({...sale,notes:e.target.value})}/></Field>
            <button onClick={submitSale} disabled={loading||!ok||selItem?.status==="out"} style={{width:"100%",padding:"13px",borderRadius:9,border:"none",background:ok&&selItem?.status!=="out"?C.green:C.dim,color:"#000",fontWeight:800,fontSize:15,cursor:ok&&selItem?.status!=="out"?"pointer":"not-allowed",display:"flex",alignItems:"center",justifyContent:"center",gap:8,fontFamily:"'IBM Plex Sans',sans-serif"}}>
              {loading?<><Spinner size={16}/> Saving…</>:"💾 Submit Sale"}
            </button>
          </div>
          <RecentPanel/>
        </>}

        {/* EXPENSE */}
        {tab==="expense"&&<>
          <div style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:12,padding:24}}>
            <div style={{fontSize:14,fontWeight:800,color:C.red,marginBottom:20}}><span style={{background:C.red+"18",padding:"5px 14px",borderRadius:7}}>↓ New Expense</span></div>
            <Field label="Date" required><input type="date" style={iStyle} value={expense.date} onChange={e=>setExpense({...expense,date:e.target.value})}/></Field>
            <Field label="Category" required>
              <select style={iStyle} value={expense.category} onChange={e=>setExpense({...expense,category:e.target.value})}>
                {["Operations","Marketing","Payroll","Travel","Utilities","Office Supplies","Software","Other"].map(c=><option key={c}>{c}</option>)}
              </select>
            </Field>
            <Field label="Amount" required><input type="number" style={iStyle} placeholder="0.00" value={expense.amount} onChange={e=>setExpense({...expense,amount:e.target.value})}/></Field>
            <Field label="Vendor / Supplier" required><input type="text" style={iStyle} placeholder="Who was paid?" value={expense.vendor} onChange={e=>setExpense({...expense,vendor:e.target.value})}/></Field>
            <Field label="Description" required><textarea style={{...iStyle,resize:"vertical",minHeight:60}} placeholder="What for?" value={expense.description} onChange={e=>setExpense({...expense,description:e.target.value})}/></Field>
            <Field label="Submitted By"><input type="text" style={iStyle} placeholder="Staff name (optional)" value={expense.submitted_by} onChange={e=>setExpense({...expense,submitted_by:e.target.value})}/></Field>
            <button onClick={submitExpense} disabled={loading||!ok} style={{width:"100%",padding:"13px",borderRadius:9,border:"none",background:ok?C.red:C.dim,color:"#fff",fontWeight:800,fontSize:15,cursor:ok?"pointer":"not-allowed",display:"flex",alignItems:"center",justifyContent:"center",gap:8,fontFamily:"'IBM Plex Sans',sans-serif"}}>
              {loading?<><Spinner size={16}/> Saving…</>:"💾 Submit Expense"}
            </button>
          </div>
          <RecentPanel/>
        </>}

        {/* STOCK */}
        {tab==="stock"&&<>
          <div style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:12,padding:24}}>
            <div style={{fontSize:14,fontWeight:800,color:C.blue,marginBottom:20}}><span style={{background:C.blue+"18",padding:"5px 14px",borderRadius:7}}>▣ Stock Movement</span></div>
            <Field label="Date" required><input type="date" style={iStyle} value={stock.date} onChange={e=>setStock({...stock,date:e.target.value})}/></Field>
            <Field label="Product" required>
              <select style={iStyle} value={stock.sku} onChange={e=>setStock({...stock,sku:e.target.value})}>
                <option value="">— Select product —</option>
                {inventory.map(i=><option key={i.sku} value={i.sku}>{i.sku} — {i.name} ({i.stock})</option>)}
              </select>
            </Field>
            <Field label="Movement Type" required>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:8}}>
                {[["add","Received",C.green],["remove","Dispatched",C.red],["adjust","Adjust",C.accent]].map(([v,l,c])=>(
                  <button key={v} onClick={()=>setStock({...stock,movement_type:v})} style={{padding:"10px",borderRadius:7,border:`1px solid ${stock.movement_type===v?c:C.border}`,background:stock.movement_type===v?c+"22":"transparent",color:stock.movement_type===v?c:C.muted,fontSize:13,fontWeight:700,cursor:"pointer",fontFamily:"'IBM Plex Sans',sans-serif"}}>{l}</button>
                ))}
              </div>
            </Field>
            <Field label="Quantity" required><input type="number" style={iStyle} placeholder="How many?" value={stock.qty} onChange={e=>setStock({...stock,qty:e.target.value})}/></Field>
            {stock.movement_type==="add"&&(
              <Field label="Update Unit Cost (optional)">
                <input type="number" style={iStyle} placeholder={sel?`Current: ${fmtFull(sel.unit_cost)}`:"Leave blank to keep current"} value={stock.new_unit_cost} onChange={e=>setStock({...stock,new_unit_cost:e.target.value})}/>
              </Field>
            )}
            <Field label="Reason / Reference"><input type="text" style={iStyle} placeholder="e.g. PO-045" value={stock.reason} onChange={e=>setStock({...stock,reason:e.target.value})}/></Field>
            {sel&&stock.qty&&prev!==null&&(
              <div style={{background:C.surface,border:`1px solid ${C.border}`,borderRadius:9,padding:"12px 16px",marginBottom:16,display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                <span style={{fontSize:13,fontWeight:600,color:C.muted}}>{sel.name}</span>
                <span style={{fontFamily:"'DM Mono',monospace",fontSize:15}}>
                  <span style={{color:C.muted}}>{sel.stock}</span>
                  <span style={{color:C.accent}}> → </span>
                  <span style={{color:prev===0?C.red:prev<sel.reorder?C.accent:C.green,fontWeight:800}}>{prev}</span>
                </span>
              </div>
            )}
            <button onClick={submitStock} disabled={loading||!ok} style={{width:"100%",padding:"13px",borderRadius:9,border:"none",background:ok?C.blue:C.dim,color:"#000",fontWeight:800,fontSize:15,cursor:ok?"pointer":"not-allowed",display:"flex",alignItems:"center",justifyContent:"center",gap:8,fontFamily:"'IBM Plex Sans',sans-serif"}}>
              {loading?<><Spinner size={16}/> Saving…</>:"💾 Update Stock"}
            </button>
          </div>
          <div style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:12,padding:24}}>
            <div style={{fontSize:11,fontWeight:800,color:C.muted,letterSpacing:1.5,textTransform:"uppercase",marginBottom:14}}>Current Stock</div>
            {inventory.length===0
              ? <div style={{color:C.muted,fontSize:13,fontWeight:600,textAlign:"center",padding:24}}>No products. Add using ＋ Product tab.</div>
              : <div style={{display:"grid",gap:8,maxHeight:460,overflowY:"auto"}}>
                  {inventory.map(item=>(
                    <div key={item.sku} onClick={()=>setStock({...stock,sku:item.sku})} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"12px 14px",background:C.surface,borderRadius:8,cursor:"pointer",border:`1px solid ${stock.sku===item.sku?C.blue:C.border}`}}>
                      <div>
                        <div style={{fontSize:13,fontWeight:700,color:C.text}}>{item.name}</div>
                        <div style={{fontSize:11,fontWeight:600,color:C.muted,marginTop:2}}>{item.sku}{canSeeCost(userRole)?` · cost: ${fmtFull(item.unit_cost)}`:""}</div>
                      </div>
                      <div style={{textAlign:"right"}}>
                        <div style={{fontFamily:"'DM Mono',monospace",fontSize:16,fontWeight:700,color:item.status==="out"?C.red:item.status==="low"?C.accent:C.text}}>{item.stock}</div>
                        <Badge status={item.status}/>
                      </div>
                    </div>
                  ))}
                </div>
            }
          </div>
        </>}

        {/* ADD PRODUCT */}
        {tab==="product"&&<>
          <div style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:12,padding:24}}>
            <div style={{fontSize:14,fontWeight:800,color:C.purple,marginBottom:20}}><span style={{background:C.purple+"18",padding:"5px 14px",borderRadius:7}}>＋ Add New Product</span></div>
            <Field label="SKU" required><input type="text" style={iStyle} placeholder="e.g. SHIRT-RED-L" value={product.sku} onChange={e=>setProduct({...product,sku:e.target.value.toUpperCase()})}/></Field>
            <Field label="Product Name" required><input type="text" style={iStyle} placeholder="e.g. Reasdun Tshirt Red L" value={product.name} onChange={e=>setProduct({...product,name:e.target.value})}/></Field>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
              <Field label="Initial Stock"><input type="number" style={iStyle} placeholder="0" value={product.stock} onChange={e=>setProduct({...product,stock:e.target.value})}/></Field>
              <Field label="Reorder Point"><input type="number" style={iStyle} placeholder="50" value={product.reorder} onChange={e=>setProduct({...product,reorder:e.target.value})}/></Field>
            </div>
            <Field label="Unit Cost (buying price)"><input type="number" style={iStyle} placeholder="0.00" value={product.unit_cost} onChange={e=>setProduct({...product,unit_cost:e.target.value})}/></Field>
            {product.sku&&product.name&&(
              <div style={{background:C.surface,border:`1px solid ${C.border}`,borderRadius:9,padding:"14px 16px",marginBottom:16}}>
                <div style={{fontSize:11,fontWeight:800,color:C.muted,letterSpacing:1,textTransform:"uppercase",marginBottom:10}}>Preview</div>
                {[["SKU",product.sku,C.purple],["Name",product.name,C.text],["Opening stock",product.stock||0,C.text],["Reorder at",product.reorder||50,C.accent],["Unit cost",fmtFull(Number(product.unit_cost)||0),C.green]].map(([l,v,c])=>(
                  <div key={l} style={{display:"flex",justifyContent:"space-between",marginBottom:6}}>
                    <span style={{fontSize:13,fontWeight:600,color:C.muted}}>{l}</span>
                    <span style={{fontSize:13,fontWeight:700,color:c,fontFamily:typeof v==="number"?"'DM Mono',monospace":"'IBM Plex Sans',sans-serif"}}>{v}</span>
                  </div>
                ))}
              </div>
            )}
            <button onClick={submitProduct} disabled={loading||!ok} style={{width:"100%",padding:"13px",borderRadius:9,border:"none",background:ok?C.purple:C.dim,color:"#fff",fontWeight:800,fontSize:15,cursor:ok?"pointer":"not-allowed",display:"flex",alignItems:"center",justifyContent:"center",gap:8,fontFamily:"'IBM Plex Sans',sans-serif"}}>
              {loading?<><Spinner size={16}/> Adding…</>:"＋ Add to Inventory"}
            </button>
          </div>
          <div style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:12,padding:24}}>
            <div style={{fontSize:11,fontWeight:800,color:C.muted,letterSpacing:1.5,textTransform:"uppercase",marginBottom:14}}>Existing Products ({inventory.length})</div>
            {inventory.length===0
              ? <div style={{color:C.muted,fontSize:13,fontWeight:600,textAlign:"center",padding:24}}>No products yet!</div>
              : <div style={{display:"grid",gap:8,maxHeight:520,overflowY:"auto"}}>
                  {inventory.map(item=>(
                    <div key={item.sku} style={{background:C.surface,borderRadius:9,padding:"12px 14px"}}>
                      <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start"}}>
                        <div><div style={{fontSize:14,fontWeight:700,color:C.text}}>{item.name}</div><div style={{fontSize:11,fontWeight:600,color:C.muted,marginTop:2,fontFamily:"'DM Mono',monospace"}}>{item.sku}</div></div>
                        <Badge status={item.status}/>
                      </div>
                      <div style={{display:"flex",gap:16,marginTop:10,fontSize:12,fontWeight:600,color:C.muted}}>
                        <span>Stock: <strong style={{color:C.text}}>{item.stock}</strong></span>
                        <span>Reorder: <strong style={{color:C.accent}}>{item.reorder}</strong></span>
                        {canSeeCost(userRole)&&<span>Cost: <strong style={{color:C.green}}>{fmtFull(item.unit_cost)}</strong></span>}
                      </div>
                    </div>
                  ))}
                </div>
            }
            <div style={{marginTop:14,padding:"10px 14px",background:C.accentDim,borderRadius:8,fontSize:12,fontWeight:600,color:C.accent}}>
              💡 To update stock for an existing product, use the ▣ Stock tab.
            </div>
          </div>
        </>}
      </div>
    </div>
  );
};

// ── Overview ──────────────────────────────────────────────────────────────────
const Overview = ({sales, expenses, inventory, userRole}) => {
  const [period,setPeriod]=useState("all");
  const now=new Date();

  const filterByDate=items=>{
    if(period==="all") return items;
    return items.filter(item=>{
      const d=new Date(item.date);
      if(period==="week"){const w=new Date(now);w.setDate(w.getDate()-7);return d>=w;}
      if(period==="month"){return d.getMonth()===now.getMonth()&&d.getFullYear()===now.getFullYear();}
      if(period==="year"){return d.getFullYear()===now.getFullYear();}
      return true;
    });
  };

  const fSales=filterByDate(sales); const fExp=filterByDate(expenses);
  const totalRevenue  = fSales.reduce((s,d)=>s+d.amount,0);
  const totalCOGS     = fSales.reduce((s,d)=>s+(d.unit_cost||0)*d.units,0);
  const grossProfit   = totalRevenue-totalCOGS;
  const totalExpenses = fExp.reduce((s,d)=>s+d.amount,0);
  const netProfit     = grossProfit-totalExpenses;
  const totalUnits    = fSales.reduce((s,d)=>s+d.units,0);
  const invValue      = inventory.reduce((s,i)=>s+i.stock*i.unit_cost,0);
  const grossMgn      = totalRevenue?(grossProfit/totalRevenue*100).toFixed(1):0;
  const netMgn        = totalRevenue?(netProfit/totalRevenue*100).toFixed(1):0;

  const sd=aggregateSalesByMonth(fSales); const ed=aggregateExpensesByMonth(fExp);
  const plData=sd.map((s,i)=>{const exp=ed[i].Operations+ed[i].Marketing+ed[i].Payroll+ed[i].Other;return{month:s.month,revenue:s.revenue,expenses:exp,profit:s.revenue-exp};});

  return (
    <div>
      <SectionHeader title="Overview" subtitle="Live business snapshot"/>
      <PeriodFilter value={period} onChange={setPeriod}/>
      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(150px,1fr))",gap:12,marginBottom:22}}>
        <KpiCard label="Total Revenue"   value={fmtFull(totalRevenue)}  sub={period==="all"?"All time":period} trend="up" color={C.green}/>
        <KpiCard label="Total Expenses"  value={fmtFull(totalExpenses)} sub={period==="all"?"All time":period} color={C.red}/>
        {canSeeCost(userRole)&&<KpiCard label="Gross Profit" value={fmtFull(grossProfit)} sub={`${grossMgn}% margin`} trend={grossProfit>=0?"up":"down"} color={grossProfit>=0?C.green:C.red}/>}
        <KpiCard label="Net Profit"      value={fmtFull(netProfit)}     sub={`${netMgn}% net`} trend={netProfit>=0?"up":"down"} color={netProfit>=0?C.green:C.red}/>
        <KpiCard label="Stocks Sold"     value={totalUnits.toLocaleString()} sub={`${fSales.length} sales`} color={C.blue}/>
        {canSeeCost(userRole)&&<KpiCard label="Inventory Value" value={fmtFull(invValue)} sub="At cost" color={C.accent}/>}
      </div>
      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(280px,1fr))",gap:16}}>
        <ChartCard title="Revenue vs Expenses" height={240}>
          <ResponsiveContainer><AreaChart data={plData}>
            <defs>
              <linearGradient id="rg" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor={C.green} stopOpacity={0.3}/><stop offset="95%" stopColor={C.green} stopOpacity={0}/></linearGradient>
              <linearGradient id="eg" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor={C.red} stopOpacity={0.2}/><stop offset="95%" stopColor={C.red} stopOpacity={0}/></linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke={C.dim}/>
            <XAxis dataKey="month" tick={{fill:C.muted,fontSize:10}} axisLine={false} tickLine={false}/>
            <YAxis tick={{fill:C.muted,fontSize:10}} axisLine={false} tickLine={false} tickFormatter={v=>fmtFull(v)}/>
            <Tooltip content={<Tip/>}/>
            <Area type="monotone" dataKey="revenue"  stroke={C.green} fill="url(#rg)" strokeWidth={2} name="Revenue"/>
            <Area type="monotone" dataKey="expenses" stroke={C.red}   fill="url(#eg)" strokeWidth={2} name="Expenses"/>
          </AreaChart></ResponsiveContainer>
        </ChartCard>
        <ChartCard title="Stock Alerts" height={240}>
          <div style={{display:"grid",gap:7,paddingTop:4,maxHeight:220,overflowY:"auto"}}>
            {inventory.map(item=>(
              <div key={item.sku} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"9px 12px",background:C.surface,borderRadius:7}}>
                <div style={{fontSize:13,fontWeight:600,color:C.text,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",maxWidth:"60%"}}>{item.name}</div>
                <div style={{display:"flex",alignItems:"center",gap:8,flexShrink:0}}>
                  <span style={{fontFamily:"'DM Mono',monospace",fontSize:13,fontWeight:700,color:item.status==="out"?C.red:item.status==="low"?C.accent:C.muted}}>{item.stock}</span>
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

// ── Sales ─────────────────────────────────────────────────────────────────────
const Sales = ({sales, bizId, userRole, onRefresh}) => {
  const sd=aggregateSalesByMonth(sales);
  const [confirm,setConfirm]=useState(null); const [toast,setToast]=useState(null);
  const [filter,setFilter]=useState("all");
  const showToast=(msg,color=C.green)=>{setToast({msg,color});setTimeout(()=>setToast(null),3000);};
  const canDelete=userRole==="manager"||userRole==="admin";

  const doDelete=async(id)=>{
    try{await apiDelete(`/businesses/${bizId}/sales/${id}`);showToast("✓ Sale deleted");onRefresh();}
    catch(e){showToast(`✕ ${e.message}`,C.red);}
    setConfirm(null);
  };

  const now=new Date();
  const filteredSales=sales.filter(s=>{
    if(filter==="all") return true;
    const d=new Date(s.date);
    if(filter==="today"){return d.toDateString()===now.toDateString();}
    if(filter==="week"){const w=new Date(now);w.setDate(w.getDate()-7);return d>=w;}
    if(filter==="month"){return d.getMonth()===now.getMonth()&&d.getFullYear()===now.getFullYear();}
    return true;
  });

  const totalRevenue=filteredSales.reduce((s,d)=>s+d.amount,0);
  const totalCOGS=filteredSales.reduce((s,d)=>s+(d.unit_cost||0)*d.units,0);
  const grossProfit=totalRevenue-totalCOGS;

  // Daily chart for this month
  const dailyData = (() => {
    const map = {};
    sales.filter(s=>{const d=new Date(s.date);return d.getMonth()===now.getMonth()&&d.getFullYear()===now.getFullYear();})
      .forEach(s=>{const day=String(s.date);map[day]=(map[day]||0)+s.amount;});
    return Object.entries(map).sort(([a],[b])=>a.localeCompare(b)).map(([date,revenue])=>({date:date.slice(5),revenue}));
  })();

  return (
    <div>
      {toast&&<Toast msg={toast.msg} color={toast.color}/>}
      {confirm&&<ConfirmDelete message={`Delete sale: "${confirm.product}" — ${fmtFull(confirm.amount)}?`} onConfirm={()=>doDelete(confirm.id)} onCancel={()=>setConfirm(null)}/>}
      <SectionHeader title="Sales & Revenue"/>
      <PeriodFilter value={filter} onChange={setFilter} options={[["all","All Time"],["month","This Month"],["week","This Week"],["today","Today"]]}/>
      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(150px,1fr))",gap:12,marginBottom:22}}>
        <KpiCard label="Revenue"      value={fmtFull(totalRevenue)}  sub="Total sales" trend="up" color={C.green}/>
        {canSeeCost(userRole)&&<KpiCard label="COGS" value={fmtFull(totalCOGS)} sub="Cost of goods" color={C.red}/>}
        {canSeeCost(userRole)&&<KpiCard label="Gross Profit" value={fmtFull(grossProfit)} sub={`${totalRevenue?(grossProfit/totalRevenue*100).toFixed(1):0}% margin`} trend={grossProfit>=0?"up":"down"} color={grossProfit>=0?C.green:C.red}/>}
        <KpiCard label="Units Sold"   value={filteredSales.reduce((s,d)=>s+d.units,0).toLocaleString()} sub="Total units" color={C.blue}/>
      </div>
      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(280px,1fr))",gap:16,marginBottom:16}}>
        <ChartCard title="Monthly Revenue" height={220}><ResponsiveContainer><BarChart data={sd}><CartesianGrid strokeDasharray="3 3" stroke={C.dim}/><XAxis dataKey="month" tick={{fill:C.muted,fontSize:10}} axisLine={false} tickLine={false}/><YAxis tick={{fill:C.muted,fontSize:10}} axisLine={false} tickLine={false} tickFormatter={v=>fmtFull(v)}/><Tooltip content={<Tip/>}/><Bar dataKey="revenue" fill={C.green} name="Revenue" radius={[3,3,0,0]}/></BarChart></ResponsiveContainer></ChartCard>
        {dailyData.length>0&&<ChartCard title="Daily Sales — This Month" height={220}><ResponsiveContainer><BarChart data={dailyData}><CartesianGrid strokeDasharray="3 3" stroke={C.dim}/><XAxis dataKey="date" tick={{fill:C.muted,fontSize:9}} axisLine={false} tickLine={false}/><YAxis tick={{fill:C.muted,fontSize:10}} axisLine={false} tickLine={false} tickFormatter={v=>fmtFull(v)}/><Tooltip content={<Tip/>}/><Bar dataKey="revenue" fill={C.accent} name="Revenue" radius={[3,3,0,0]}/></BarChart></ResponsiveContainer></ChartCard>}
        <ChartCard title="Units Sold" height={220}><ResponsiveContainer><LineChart data={sd}><CartesianGrid strokeDasharray="3 3" stroke={C.dim}/><XAxis dataKey="month" tick={{fill:C.muted,fontSize:10}} axisLine={false} tickLine={false}/><YAxis tick={{fill:C.muted,fontSize:10}} axisLine={false} tickLine={false}/><Tooltip content={<Tip/>}/><Line type="monotone" dataKey="units" stroke={C.accent} strokeWidth={2} dot={{fill:C.accent,r:3}} name="Units"/></LineChart></ResponsiveContainer></ChartCard>
      </div>
      <div style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:10,overflow:"hidden"}}>
        {canDelete&&<div style={{padding:"8px 16px",background:C.red+"0a",borderBottom:`1px solid ${C.border}`,fontSize:12,fontWeight:600,color:C.muted}}>Managers and admins can delete using ✕</div>}
        <div style={{overflowX:"auto"}}>
          <table style={{width:"100%",borderCollapse:"collapse",fontSize:13,minWidth:500}}>
            <thead style={{position:"sticky",top:0,background:C.surface}}>
              <tr>{["Date","Product","Price","Units","Revenue",...(canSeeCost(userRole)?["COGS","Profit","Margin"]:[]),"Rep",...(canDelete?[""]:[])].map(h=><th key={h} style={{padding:"11px 12px",textAlign:"left",color:C.muted,fontWeight:700,fontSize:11,letterSpacing:1,textTransform:"uppercase",whiteSpace:"nowrap"}}>{h}</th>)}</tr>
            </thead>
            <tbody>
              {filteredSales.map(s=>{
                const cogs=(s.unit_cost||0)*s.units;
                const profit=s.amount-cogs;
                const margin=s.amount?(profit/s.amount*100).toFixed(1):"—";
                return (
                  <tr key={s.id} style={{borderTop:`1px solid ${C.border}`}}>
                    <td style={{padding:"11px 12px",color:C.muted,fontFamily:"'DM Mono',monospace",fontSize:12,whiteSpace:"nowrap"}}>{String(s.date)}</td>
                    <td style={{padding:"11px 12px",color:C.text,fontWeight:600}}>{s.product}{s.sku&&<span style={{fontSize:10,fontWeight:500,color:C.dim,marginLeft:4}}>({s.sku})</span>}</td>
                    <td style={{padding:"11px 12px",color:C.muted,fontFamily:"'DM Mono',monospace",fontSize:12}}>{s.unit_price?fmtFull(s.unit_price):"—"}</td>
                    <td style={{padding:"11px 12px",color:C.text,fontWeight:600}}>{s.units}</td>
                    <td style={{padding:"11px 12px",color:C.green,fontFamily:"'DM Mono',monospace",fontWeight:700}}>{fmtFull(s.amount)}</td>
                    {canSeeCost(userRole)&&<td style={{padding:"11px 12px",color:C.red,fontFamily:"'DM Mono',monospace",fontSize:12}}>{cogs?fmtFull(cogs):"—"}</td>}
                    {canSeeCost(userRole)&&<td style={{padding:"11px 12px",color:profit>=0?C.accent:C.red,fontFamily:"'DM Mono',monospace",fontWeight:700}}>{cogs?fmtFull(profit):"—"}</td>}
                    {canSeeCost(userRole)&&<td style={{padding:"11px 12px",color:C.muted,fontSize:12}}>{cogs?`${margin}%`:"—"}</td>}
                    <td style={{padding:"11px 12px",color:C.muted,fontSize:12}}>{s.rep||"—"}</td>
                    {canDelete&&<td style={{padding:"11px 12px"}}><DelBtn onClick={()=>setConfirm(s)}/></td>}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

// ── Expenses ──────────────────────────────────────────────────────────────────
const Expenses = ({expenses, bizId, userRole, onRefresh}) => {
  const ed=aggregateExpensesByMonth(expenses);
  const catTotal=cat=>expenses.filter(e=>(["Operations","Marketing","Payroll"].includes(e.category)?e.category:"Other")===cat).reduce((s,e)=>s+e.amount,0);
  const [confirm,setConfirm]=useState(null); const [toast,setToast]=useState(null);
  const [filter,setFilter]=useState("all");
  const showToast=(msg,color=C.green)=>{setToast({msg,color});setTimeout(()=>setToast(null),3000);};
  const canDelete=userRole==="manager"||userRole==="admin";
  const now=new Date();

  const filteredExpenses=expenses.filter(e=>{
    if(filter==="all") return true;
    const d=new Date(e.date);
    if(filter==="today"){return d.toDateString()===now.toDateString();}
    if(filter==="week"){const w=new Date(now);w.setDate(w.getDate()-7);return d>=w;}
    if(filter==="month"){return d.getMonth()===now.getMonth()&&d.getFullYear()===now.getFullYear();}
    return true;
  });

  // Daily breakdown for this month
  const dailyExpData = (() => {
    const map={};
    expenses.filter(e=>{const d=new Date(e.date);return d.getMonth()===now.getMonth()&&d.getFullYear()===now.getFullYear();})
      .forEach(e=>{const day=String(e.date);map[day]=(map[day]||0)+e.amount;});
    return Object.entries(map).sort(([a],[b])=>a.localeCompare(b)).map(([date,amount])=>({date:date.slice(5),amount}));
  })();

  const doDelete=async(id)=>{
    try{await apiDelete(`/businesses/${bizId}/expenses/${id}`);showToast("✓ Expense deleted");onRefresh();}
    catch(e){showToast(`✕ ${e.message}`,C.red);}
    setConfirm(null);
  };

  return (
    <div>
      {toast&&<Toast msg={toast.msg} color={toast.color}/>}
      {confirm&&<ConfirmDelete message={`Delete expense: "${confirm.description}" — ${fmtFull(confirm.amount)}?`} onConfirm={()=>doDelete(confirm.id)} onCancel={()=>setConfirm(null)}/>}
      <SectionHeader title="Expenses"/>
      <PeriodFilter value={filter} onChange={setFilter} options={[["all","All Time"],["month","This Month"],["week","This Week"],["today","Today"]]}/>
      <div style={{background:C.card,border:`1px solid ${C.red}33`,borderRadius:10,padding:"16px 20px",marginBottom:18,display:"flex",justifyContent:"space-between",alignItems:"center"}}>
        <div style={{fontSize:13,fontWeight:700,color:C.muted}}>Total Expenses {filter!=="all"?`(${filter})`:"(all time)"}</div>
        <div style={{fontFamily:"'DM Mono',monospace",fontSize:24,fontWeight:800,color:C.red}}>{fmtFull(filteredExpenses.reduce((s,e)=>s+e.amount,0))}</div>
      </div>
      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(140px,1fr))",gap:12,marginBottom:22}}>
        {[["Operations",C.blue],["Marketing",C.purple],["Payroll",C.accent],["Other",C.muted]].map(([cat,color])=><KpiCard key={cat} label={cat} value={fmtFull(catTotal(cat))} sub="Total" color={color}/>)}
      </div>
      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(280px,1fr))",gap:16,marginBottom:16}}>
        <ChartCard title="Monthly Breakdown" height={240}><ResponsiveContainer><BarChart data={ed}><CartesianGrid strokeDasharray="3 3" stroke={C.dim}/><XAxis dataKey="month" tick={{fill:C.muted,fontSize:10}} axisLine={false} tickLine={false}/><YAxis tick={{fill:C.muted,fontSize:10}} axisLine={false} tickLine={false} tickFormatter={v=>fmtFull(v)}/><Tooltip content={<Tip/>}/><Bar dataKey="Payroll" stackId="a" fill={C.accent} name="Payroll"/><Bar dataKey="Operations" stackId="a" fill={C.blue} name="Operations"/><Bar dataKey="Marketing" stackId="a" fill={C.purple} name="Marketing"/><Bar dataKey="Other" stackId="a" fill={C.dim} name="Other" radius={[3,3,0,0]}/></BarChart></ResponsiveContainer></ChartCard>
        {dailyExpData.length>0&&<ChartCard title="Daily Expenses — This Month" height={240}><ResponsiveContainer><BarChart data={dailyExpData}><CartesianGrid strokeDasharray="3 3" stroke={C.dim}/><XAxis dataKey="date" tick={{fill:C.muted,fontSize:9}} axisLine={false} tickLine={false}/><YAxis tick={{fill:C.muted,fontSize:10}} axisLine={false} tickLine={false} tickFormatter={v=>fmtFull(v)}/><Tooltip content={<Tip/>}/><Bar dataKey="amount" fill={C.red} name="Expenses" radius={[3,3,0,0]}/></BarChart></ResponsiveContainer></ChartCard>}
      </div>
      <div style={{marginTop:16,background:C.card,border:`1px solid ${C.border}`,borderRadius:10,overflow:"hidden"}}>
        {canDelete&&<div style={{padding:"8px 16px",background:C.red+"0a",borderBottom:`1px solid ${C.border}`,fontSize:12,fontWeight:600,color:C.muted}}>Managers and admins can delete using ✕</div>}
        <div style={{overflowX:"auto"}}>
          <table style={{width:"100%",borderCollapse:"collapse",fontSize:13,minWidth:500}}>
            <thead style={{position:"sticky",top:0,background:C.surface}}>
              <tr>{["Date","Category","Amount","Vendor","Description","By",...(canDelete?[""]:[])].map(h=><th key={h} style={{padding:"11px 16px",textAlign:"left",color:C.muted,fontWeight:700,fontSize:11,letterSpacing:1,textTransform:"uppercase",whiteSpace:"nowrap"}}>{h}</th>)}</tr>
            </thead>
            <tbody>
              {filteredExpenses.map(e=>(
                <tr key={e.id} style={{borderTop:`1px solid ${C.border}`}}>
                  <td style={{padding:"11px 16px",color:C.muted,fontFamily:"'DM Mono',monospace",fontSize:12,whiteSpace:"nowrap"}}>{String(e.date)}</td>
                  <td style={{padding:"11px 16px"}}><span style={{fontSize:11,fontWeight:700,padding:"3px 9px",borderRadius:5,background:C.blue+"22",color:C.blue}}>{e.category}</span></td>
                  <td style={{padding:"11px 16px",color:C.red,fontFamily:"'DM Mono',monospace",fontWeight:700}}>{fmtFull(e.amount)}</td>
                  <td style={{padding:"11px 16px",color:C.text,fontWeight:600}}>{e.vendor}</td>
                  <td style={{padding:"11px 16px",color:C.muted,fontSize:12,fontWeight:500}}>{e.description}</td>
                  <td style={{padding:"11px 16px",color:C.muted,fontSize:12,fontWeight:500}}>{e.submitted_by||"—"}</td>
                  {canDelete&&<td style={{padding:"11px 16px"}}><DelBtn onClick={()=>setConfirm(e)}/></td>}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

// ── Inventory ─────────────────────────────────────────────────────────────────
const Inventory = ({inventory, bizId, userRole, onRefresh}) => {
  const [confirm,setConfirm]=useState(null); const [toast,setToast]=useState(null);
  const [movements,setMovements]=useState([]); const [movFilter,setMovFilter]=useState("all");
  const showToast=(msg,color=C.green)=>{setToast({msg,color});setTimeout(()=>setToast(null),3000);};
  const canDelete=userRole==="admin";

  useEffect(()=>{apiGet(`/businesses/${bizId}/stock-movements`).then(setMovements).catch(()=>{});},[bizId]);

  const doDelete=async(sku)=>{
    try{await apiDelete(`/businesses/${bizId}/inventory/${sku}`);showToast("✓ Product deleted");onRefresh();}
    catch(e){showToast(`✕ ${e.message}`,C.red);}
    setConfirm(null);
  };

  const now=new Date();
  const filteredMovements=[...movements].sort((a,b)=>new Date(b.created_at)-new Date(a.created_at)).filter(m=>{
    if(movFilter==="all") return true;
    const d=new Date(m.created_at);
    if(movFilter==="week"){const w=new Date(now);w.setDate(w.getDate()-7);return d>=w;}
    if(movFilter==="month"){return d.getMonth()===now.getMonth()&&d.getFullYear()===now.getFullYear();}
    if(movFilter==="today"){return d.toDateString()===now.toDateString();}
    return true;
  });

  const mvStyle=t=>({add:{color:C.green,label:"Received"},remove:{color:C.red,label:"Dispatched"},adjust:{color:C.accent,label:"Adjusted"}})[t]||{color:C.muted,label:t};

  return (
    <div>
      {toast&&<Toast msg={toast.msg} color={toast.color}/>}
      {confirm&&<ConfirmDelete message={`Delete "${confirm.name}" (${confirm.sku})? Cannot be undone.`} onConfirm={()=>doDelete(confirm.sku)} onCancel={()=>setConfirm(null)}/>}
      <SectionHeader title="Inventory & Stock"/>
      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(140px,1fr))",gap:12,marginBottom:22}}>
        <KpiCard label="SKUs"         value={inventory.length} sub="Products" color={C.blue}/>
        {canSeeCost(userRole)&&<KpiCard label="Total Value" value={fmtFull(inventory.reduce((s,i)=>s+i.stock*i.unit_cost,0))} sub="At cost" color={C.green}/>}
        <KpiCard label="Low Stock"    value={inventory.filter(i=>i.status==="low").length} sub="Below reorder" color={C.accent} trend="down"/>
        <KpiCard label="Out of Stock" value={inventory.filter(i=>i.status==="out").length} sub="Action needed" color={C.red} trend="down"/>
      </div>
      <div style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:10,overflow:"hidden",marginBottom:16}}>
        {canDelete&&<div style={{padding:"8px 16px",background:C.red+"0a",borderBottom:`1px solid ${C.border}`,fontSize:12,fontWeight:600,color:C.muted}}>Admins can delete products using ✕</div>}
        <div style={{overflowX:"auto"}}>
          <table style={{width:"100%",borderCollapse:"collapse",fontSize:13,minWidth:420}}>
            <thead><tr style={{background:C.surface}}>{["SKU","Product","Stock","Reorder",...(canSeeCost(userRole)?["Unit Cost","Value"]:[]),"Status",...(canDelete?[""]:[])].map(h=><th key={h} style={{padding:"12px 14px",textAlign:"left",color:C.muted,fontWeight:700,fontSize:11,letterSpacing:1,textTransform:"uppercase",whiteSpace:"nowrap"}}>{h}</th>)}</tr></thead>
            <tbody>
              {inventory.map(item=>(
                <tr key={item.id} style={{borderTop:`1px solid ${C.border}`}}>
                  <td style={{padding:"12px 14px",color:C.muted,fontFamily:"'DM Mono',monospace",fontSize:12}}>{item.sku}</td>
                  <td style={{padding:"12px 14px",color:C.text,fontWeight:600}}>{item.name}</td>
                  <td style={{padding:"12px 14px",color:item.stock===0?C.red:item.stock<item.reorder?C.accent:C.text,fontFamily:"'DM Mono',monospace",fontWeight:700}}>{item.stock.toLocaleString()}</td>
                  <td style={{padding:"12px 14px",color:C.muted,fontFamily:"'DM Mono',monospace"}}>{item.reorder}</td>
                  {canSeeCost(userRole)&&<td style={{padding:"12px 14px",color:C.muted,fontFamily:"'DM Mono',monospace"}}>{fmtFull(item.unit_cost)}</td>}
                  {canSeeCost(userRole)&&<td style={{padding:"12px 14px",color:C.green,fontFamily:"'DM Mono',monospace",fontWeight:700}}>{fmtFull(item.stock*item.unit_cost)}</td>}
                  <td style={{padding:"12px 14px"}}><Badge status={item.status}/></td>
                  {canDelete&&<td style={{padding:"12px 14px"}}><DelBtn onClick={()=>setConfirm(item)}/></td>}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      <ChartCard title="Stock vs Reorder Points" height={200}><ResponsiveContainer><BarChart data={inventory.map(i=>({name:i.sku,stock:i.stock,reorder:i.reorder}))}><CartesianGrid strokeDasharray="3 3" stroke={C.dim}/><XAxis dataKey="name" tick={{fill:C.muted,fontSize:10}} axisLine={false} tickLine={false}/><YAxis tick={{fill:C.muted,fontSize:10}} axisLine={false} tickLine={false}/><Tooltip content={<Tip/>}/><Bar dataKey="stock" fill={C.blue} name="Stock" radius={[3,3,0,0]}/><Bar dataKey="reorder" fill={C.accent} name="Reorder" radius={[3,3,0,0]}/></BarChart></ResponsiveContainer></ChartCard>

      {/* Stock Movement History */}
      <div style={{marginTop:20}}>
        <SectionHeader title="Stock Movement History" subtitle="All additions, dispatches and adjustments"/>
        <PeriodFilter value={movFilter} onChange={setMovFilter} options={[["all","All Time"],["month","This Month"],["week","This Week"],["today","Today"]]}/>
        <div style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:10,overflow:"hidden"}}>
          <div style={{overflowX:"auto",maxHeight:380,overflowY:"auto"}}>
            <table style={{width:"100%",borderCollapse:"collapse",fontSize:13,minWidth:500}}>
              <thead style={{position:"sticky",top:0,background:C.surface}}>
                <tr>{["Date & Time","SKU","Type","Qty","Before","After","Reason"].map(h=><th key={h} style={{padding:"10px 14px",textAlign:"left",color:C.muted,fontWeight:700,fontSize:11,letterSpacing:1,textTransform:"uppercase",whiteSpace:"nowrap"}}>{h}</th>)}</tr>
              </thead>
              <tbody>
                {filteredMovements.length===0
                  ? <tr><td colSpan={7} style={{padding:24,textAlign:"center",color:C.muted,fontWeight:600}}>No movements in this period</td></tr>
                  : filteredMovements.map(m=>{
                      const ts=mvStyle(m.movement_type);
                      const dt=new Date(m.created_at);
                      return(
                        <tr key={m.id} style={{borderTop:`1px solid ${C.border}`}}>
                          <td style={{padding:"10px 14px",color:C.muted,fontFamily:"'DM Mono',monospace",fontSize:11,whiteSpace:"nowrap"}}>{dt.toLocaleDateString()}<br/><span style={{fontSize:10}}>{dt.toLocaleTimeString([],{hour:"2-digit",minute:"2-digit"})}</span></td>
                          <td style={{padding:"10px 14px",color:C.purple,fontFamily:"'DM Mono',monospace",fontSize:12,fontWeight:700}}>{m.sku}</td>
                          <td style={{padding:"10px 14px"}}><span style={{fontSize:11,fontWeight:700,padding:"2px 8px",borderRadius:5,background:ts.color+"22",color:ts.color}}>{ts.label}</span></td>
                          <td style={{padding:"10px 14px",color:m.movement_type==="remove"?C.red:C.green,fontFamily:"'DM Mono',monospace",fontWeight:800}}>{m.movement_type==="remove"?"-":"+"}{m.qty}</td>
                          <td style={{padding:"10px 14px",color:C.muted,fontFamily:"'DM Mono',monospace"}}>{m.stock_before}</td>
                          <td style={{padding:"10px 14px",color:C.text,fontFamily:"'DM Mono',monospace",fontWeight:700}}>{m.stock_after}</td>
                          <td style={{padding:"10px 14px",color:C.muted,fontSize:12,fontWeight:500}}>{m.reason||"—"}</td>
                        </tr>
                      );
                    })
                }
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};

// ── P&L ───────────────────────────────────────────────────────────────────────
const PL = ({sales, expenses, summary, userRole}) => {
  const sd=aggregateSalesByMonth(sales); const ed=aggregateExpensesByMonth(expenses);
  const cogsMap={}; months.forEach(m=>{cogsMap[m]=0;}); sales.forEach(s=>{if(cogsMap[s.month]!==undefined)cogsMap[s.month]+=(s.unit_cost||0)*s.units;});
  const plData=sd.map((s,i)=>{const exp=ed[i].Operations+ed[i].Marketing+ed[i].Payroll+ed[i].Other;const cogs=cogsMap[s.month]||0;const gross=s.revenue-cogs;return{month:s.month,revenue:s.revenue,cogs,gross_profit:gross,expenses:exp,net_profit:gross-exp};});

  const ytdRev=summary?.total_revenue||plData.reduce((s,d)=>s+d.revenue,0);
  const ytdCOGS=summary?.total_cogs||plData.reduce((s,d)=>s+d.cogs,0);
  const ytdGross=summary?.gross_profit||ytdRev-ytdCOGS;
  const ytdExp=summary?.total_expenses||plData.reduce((s,d)=>s+d.expenses,0);
  const ytdNet=summary?.net_profit||ytdGross-ytdExp;
  const grossMgn=ytdRev?(ytdGross/ytdRev*100).toFixed(1):0;
  const netMgn=ytdRev?(ytdNet/ytdRev*100).toFixed(1):0;

  return (
    <div>
      <SectionHeader title="Profit & Loss" subtitle="True gross profit = Revenue minus COGS"/>
      {/* Income Statement */}
      <div style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:12,padding:22,marginBottom:22}}>
        <div style={{fontSize:11,fontWeight:800,color:C.muted,letterSpacing:1.5,textTransform:"uppercase",marginBottom:18}}>Income Statement</div>
        {[
          {label:"Revenue (Sales)",    value:ytdRev,   color:C.green,                   indent:0,bold:false},
          ...(canSeeCost(userRole)?[{label:"Cost of Goods Sold",value:-ytdCOGS,color:C.red,indent:1,bold:false}]:[]),
          ...(canSeeCost(userRole)?[{label:"Gross Profit",value:ytdGross,color:ytdGross>=0?C.green:C.red,indent:0,bold:true,sub:`${grossMgn}% gross margin`}]:[]),
          {label:"Operating Expenses", value:-ytdExp,  color:C.red,                     indent:1,bold:false},
          {label:"Net Profit",         value:ytdNet,   color:ytdNet>=0?C.green:C.red,   indent:0,bold:true, sub:`${netMgn}% net margin`},
        ].map((row,i)=>(
          <div key={i} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:`${row.bold?"14px":"9px"} ${row.indent?28:16}px`,borderTop:row.bold?`1px solid ${C.border}`:"none",marginTop:row.bold?4:0}}>
            <div>
              <div style={{fontSize:row.bold?15:13,fontWeight:row.bold?800:600,color:row.bold?C.text:C.muted}}>{row.label}</div>
              {row.sub&&<div style={{fontSize:11,fontWeight:600,color:C.dim,marginTop:2}}>{row.sub}</div>}
            </div>
            <div style={{fontFamily:"'DM Mono',monospace",fontSize:row.bold?18:14,fontWeight:row.bold?800:600,color:row.value>=0?row.color:C.red}}>
              {row.value<0&&row.label!=="Net Profit"?"− ":""}{fmtFull(Math.abs(row.value))}
            </div>
          </div>
        ))}
      </div>
      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(140px,1fr))",gap:12,marginBottom:22}}>
        <KpiCard label="Revenue"      value={fmtFull(ytdRev)}   sub="Total sales"    trend="up" color={C.green}/>
        {canSeeCost(userRole)&&<KpiCard label="COGS"         value={fmtFull(ytdCOGS)}  sub="Cost of goods"           color={C.red}/>}
        {canSeeCost(userRole)&&<KpiCard label="Gross Profit" value={fmtFull(ytdGross)} sub={`${grossMgn}% margin`} trend={ytdGross>=0?"up":"down"} color={ytdGross>=0?C.green:C.red}/>}
        <KpiCard label="Net Profit"   value={fmtFull(ytdNet)}   sub={`${netMgn}% net margin`} trend={ytdNet>=0?"up":"down"} color={ytdNet>=0?C.green:C.red}/>
      </div>
      <ChartCard title="Monthly P&L" height={280}>
        <ResponsiveContainer><BarChart data={plData}>
          <CartesianGrid strokeDasharray="3 3" stroke={C.dim}/>
          <XAxis dataKey="month" tick={{fill:C.muted,fontSize:10}} axisLine={false} tickLine={false}/>
          <YAxis tick={{fill:C.muted,fontSize:10}} axisLine={false} tickLine={false} tickFormatter={v=>fmtFull(v)}/>
          <Tooltip content={<Tip/>}/>
          <Bar dataKey="revenue"      fill={C.green}  name="Revenue"      radius={[3,3,0,0]}/>
          {canSeeCost(userRole)&&<Bar dataKey="gross_profit" fill={C.accent} name="Gross Profit" radius={[3,3,0,0]}/>}
          <Bar dataKey="net_profit"   fill={C.blue}   name="Net Profit"   radius={[3,3,0,0]}/>
        </BarChart></ResponsiveContainer>
      </ChartCard>
      <div style={{marginTop:16,background:C.card,border:`1px solid ${C.border}`,borderRadius:10,overflow:"hidden"}}>
        <div style={{overflowX:"auto"}}>
          <table style={{width:"100%",borderCollapse:"collapse",fontSize:13,minWidth:400}}>
            <thead><tr style={{background:C.surface}}>{["Month","Revenue",...(canSeeCost(userRole)?["COGS","Gross Profit"]:[]),"Expenses","Net Profit","Margin"].map(h=><th key={h} style={{padding:"12px 14px",textAlign:"left",color:C.muted,fontWeight:700,fontSize:11,letterSpacing:1,textTransform:"uppercase",whiteSpace:"nowrap"}}>{h}</th>)}</tr></thead>
            <tbody>
              {plData.filter(r=>r.revenue>0||r.expenses>0).map((row,i)=>(
                <tr key={i} style={{borderTop:`1px solid ${C.border}`}}>
                  <td style={{padding:"11px 14px",color:C.text,fontWeight:700}}>{row.month}</td>
                  <td style={{padding:"11px 14px",color:C.green,fontFamily:"'DM Mono',monospace",fontWeight:700}}>{fmtFull(row.revenue)}</td>
                  {canSeeCost(userRole)&&<td style={{padding:"11px 14px",color:C.red,fontFamily:"'DM Mono',monospace"}}>{fmtFull(row.cogs)}</td>}
                  {canSeeCost(userRole)&&<td style={{padding:"11px 14px",color:row.gross_profit>=0?C.green:C.red,fontFamily:"'DM Mono',monospace",fontWeight:700}}>{fmtFull(row.gross_profit)}</td>}
                  <td style={{padding:"11px 14px",color:C.red,fontFamily:"'DM Mono',monospace"}}>{fmtFull(row.expenses)}</td>
                  <td style={{padding:"11px 14px",color:row.net_profit>=0?C.green:C.red,fontFamily:"'DM Mono',monospace",fontWeight:800}}>{fmtFull(row.net_profit)}</td>
                  <td style={{padding:"11px 14px",color:C.muted,fontWeight:600}}>{row.revenue?(row.net_profit/row.revenue*100).toFixed(1):0}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

// ── Cash Balance ──────────────────────────────────────────────────────────────
const CashPage = ({bizId, userRole}) => {
  const canDelete=userRole==="manager"||userRole==="admin";
  const [confirmCash,setConfirmCash]=useState(null);
  const [balances,setBalances]=useState([]); const [loading,setLoading]=useState(true);
  const [toast,setToast]=useState(null); const [submitting,setSubmitting]=useState(false);
  const [form,setForm]=useState({date:todayStr(),opening_balance:"",closing_balance:"",bank_balance:"",notes:""});

  const showToast=(msg,color=C.green)=>{setToast({msg,color});setTimeout(()=>setToast(null),3000);};
  const load=async()=>{try{setBalances(await apiGet(`/businesses/${bizId}/cash`));}catch(e){showToast(e.message,C.red);}setLoading(false);};
  useEffect(()=>{load();},[bizId]);

  const submit=async()=>{
    if(!form.opening_balance||!form.closing_balance) return showToast("Enter opening and closing balance",C.red);
    setSubmitting(true);
    try{
      await apiPost(`/businesses/${bizId}/cash`,{
        ...form,
        opening_balance:Number(form.opening_balance),
        closing_balance:Number(form.closing_balance),
        bank_balance:form.bank_balance?Number(form.bank_balance):0,
      });
      setForm({date:todayStr(),opening_balance:"",closing_balance:"",bank_balance:"",notes:""});
      showToast("✓ Balance recorded"); load();
    }catch(e){showToast(`✕ ${e.message}`,C.red);}
    setSubmitting(false);
  };

  const deleteCash=async(id)=>{
    try{await apiDelete(`/businesses/${bizId}/cash/${id}`);showToast("✓ Record deleted");load();}
    catch(e){showToast(`✕ ${e.message}`,C.red);}
    setConfirmCash(null);
  };

  const latest=balances[0]||null;
  const movement=latest?latest.closing_balance-latest.opening_balance:0;
  const avgClosing=balances.length?balances.reduce((s,b)=>s+b.closing_balance,0)/balances.length:0;
  const latestCash=latest?.closing_balance||0;
  const latestBank=latest?.bank_balance||0;
  const totalBalance=latestCash+latestBank;
  const chartData=balances.slice(0,30).reverse().map(b=>({
    date:String(b.date).slice(5),
    cash:b.closing_balance,
    bank:b.bank_balance||0,
    total:(b.closing_balance||0)+(b.bank_balance||0),
  }));

  return (
    <div>
      {toast&&<Toast msg={toast.msg} color={toast.color}/>}
      {confirmCash&&<ConfirmDelete message={`Delete balance record for ${confirmCash.date}?`} onConfirm={()=>deleteCash(confirmCash.id)} onCancel={()=>setConfirmCash(null)}/>}
      <SectionHeader title="Cash & Bank Balance" subtitle="Daily cash position, bank balance and totals"/>

      {/* Total balance banner — managers/admins see full, employees see cash only */}
      <div style={{background:`linear-gradient(135deg,${C.accent}22,${C.green}11)`,border:`1px solid ${C.accent}44`,borderRadius:12,padding:"18px 24px",marginBottom:20,display:"flex",justifyContent:"space-between",alignItems:"center",flexWrap:"wrap",gap:12}}>
        <div>
          <div style={{fontSize:11,fontWeight:800,color:C.accent,letterSpacing:1.5,textTransform:"uppercase",marginBottom:4}}>
            {canSeeCost(userRole)?"Total Balance (Cash + Bank)":"Cash Balance"}
          </div>
          <div style={{fontSize:32,fontWeight:800,color:C.text,fontFamily:"'DM Mono',monospace"}}>{fmtFull(canSeeCost(userRole)?totalBalance:latestCash)}</div>
        </div>
        {canSeeCost(userRole)&&<div style={{display:"flex",gap:24}}>
          <div style={{textAlign:"right"}}>
            <div style={{fontSize:11,fontWeight:700,color:C.muted}}>Cash in Hand</div>
            <div style={{fontSize:18,fontWeight:800,color:C.green,fontFamily:"'DM Mono',monospace"}}>{fmtFull(latestCash)}</div>
          </div>
          <div style={{textAlign:"right"}}>
            <div style={{fontSize:11,fontWeight:700,color:C.muted}}>Bank Balance</div>
            <div style={{fontSize:18,fontWeight:800,color:C.blue,fontFamily:"'DM Mono',monospace"}}>{fmtFull(latestBank)}</div>
          </div>
        </div>}
      </div>

      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(140px,1fr))",gap:12,marginBottom:22}}>
        <KpiCard label="Closing Cash"  value={fmtFull(latestCash)}  sub={latest?String(latest.date):"No records"} color={C.green} trend={movement>=0?"up":"down"}/>
        {canSeeCost(userRole)&&<KpiCard label="Bank Balance"  value={fmtFull(latestBank)}  sub="Latest recorded" color={C.blue}/>}
        {canSeeCost(userRole)&&<KpiCard label="Total Balance" value={fmtFull(totalBalance)} sub="Cash + Bank" color={C.accent}/>}
        <KpiCard label="Avg Closing"   value={fmtFull(Math.round(avgClosing))} sub={`${balances.length} days`} color={C.muted}/>
      </div>

      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(300px,1fr))",gap:20,marginBottom:20}}>
        {/* Entry form */}
        <div style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:12,padding:24}}>
          <div style={{fontSize:14,fontWeight:800,color:C.accent,marginBottom:20}}><span style={{background:C.accentDim,padding:"5px 14px",borderRadius:7}}>💵 Record Daily Balance</span></div>
          <Field label="Date" required><input type="date" style={iStyle} value={form.date} onChange={e=>setForm({...form,date:e.target.value})}/></Field>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
            <Field label="Opening Cash" required><input type="number" style={iStyle} placeholder="0.00" value={form.opening_balance} onChange={e=>setForm({...form,opening_balance:e.target.value})}/></Field>
            <Field label="Closing Cash" required><input type="number" style={iStyle} placeholder="0.00" value={form.closing_balance} onChange={e=>setForm({...form,closing_balance:e.target.value})}/></Field>
          </div>
          {canSeeCost(userRole)&&<Field label="Bank Balance">
            <input type="number" style={iStyle} placeholder="0.00 (optional)" value={form.bank_balance} onChange={e=>setForm({...form,bank_balance:e.target.value})}/>
          </Field>}
          {form.opening_balance&&form.closing_balance&&(()=>{
            const cashDiff=Number(form.closing_balance)-Number(form.opening_balance);
            const total=(Number(form.closing_balance)||0)+(Number(form.bank_balance)||0);
            return(
              <div style={{background:C.surface,border:`1px solid ${C.border}`,borderRadius:8,padding:"12px 14px",marginBottom:14}}>
                <div style={{display:"flex",justifyContent:"space-between",marginBottom:6}}>
                  <span style={{fontSize:13,fontWeight:600,color:C.muted}}>Cash movement</span>
                  <span style={{fontFamily:"'DM Mono',monospace",fontWeight:800,color:cashDiff>=0?C.green:C.red}}>{cashDiff>=0?"+":""}{fmtFull(cashDiff)}</span>
                </div>
                {form.bank_balance&&<div style={{display:"flex",justifyContent:"space-between",paddingTop:6,borderTop:`1px solid ${C.border}`}}>
                  <span style={{fontSize:13,fontWeight:700,color:C.muted}}>Total (cash + bank)</span>
                  <span style={{fontFamily:"'DM Mono',monospace",fontWeight:800,color:C.accent}}>{fmtFull(total)}</span>
                </div>}
              </div>
            );
          })()}
          <Field label="Notes"><textarea style={{...iStyle,resize:"vertical",minHeight:56}} placeholder="e.g. Market day, payday" value={form.notes} onChange={e=>setForm({...form,notes:e.target.value})}/></Field>
          <button onClick={submit} disabled={submitting} style={{width:"100%",padding:"13px",borderRadius:9,border:"none",background:C.accent,color:"#000",fontWeight:800,fontSize:15,cursor:submitting?"not-allowed":"pointer",opacity:submitting?0.7:1,display:"flex",alignItems:"center",justifyContent:"center",gap:8,fontFamily:"'IBM Plex Sans',sans-serif"}}>
            {submitting?<><Spinner size={16}/> Saving…</>:"💾 Save Balance"}
          </button>
        </div>

        {/* Recent records */}
        <div style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:12,padding:24}}>
          <div style={{fontSize:11,fontWeight:800,color:C.muted,letterSpacing:1.5,textTransform:"uppercase",marginBottom:16}}>Recent Records</div>
          {loading?<div style={{display:"flex",justifyContent:"center",padding:24}}><Spinner size={24}/></div>
          :balances.length===0?<div style={{color:C.muted,fontSize:13,fontWeight:600,textAlign:"center",padding:24}}>No records yet.</div>
          :<div style={{display:"grid",gap:8,maxHeight:440,overflowY:"auto"}}>
            {balances.slice(0,15).map(b=>{
              const cashDiff=b.closing_balance-b.opening_balance;
              const bankBal=b.bank_balance||0;
              const total=b.closing_balance+bankBal;
              return(
                <div key={b.id} style={{background:C.surface,borderRadius:9,padding:"12px 14px"}}>
                  <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:6}}>
                    <div>
                      <div style={{fontSize:12,fontWeight:700,color:C.muted,fontFamily:"'DM Mono',monospace"}}>{String(b.date)}</div>
                      {b.notes&&<div style={{fontSize:11,fontWeight:500,color:C.dim,marginTop:2}}>{b.notes}</div>}
                    </div>
                    <div style={{textAlign:"right"}}>
                      <div style={{fontSize:14,fontWeight:800,color:cashDiff>=0?C.green:C.red}}>{cashDiff>=0?"+":""}{fmtFull(cashDiff)}</div>
                      {canDelete&&<button onClick={()=>setConfirmCash(b)} style={{fontSize:10,fontWeight:700,color:C.red,background:"transparent",border:`1px solid ${C.red}33`,borderRadius:4,padding:"2px 6px",cursor:"pointer",marginTop:4,fontFamily:"'IBM Plex Sans',sans-serif"}}>✕</button>}
                    </div>
                  </div>
                  <div style={{display:"grid",gridTemplateColumns:canSeeCost(userRole)?"1fr 1fr 1fr":"1fr",gap:6,fontSize:11,fontWeight:600}}>
                    <div style={{background:C.green+"11",borderRadius:5,padding:"4px 8px",textAlign:"center"}}>
                      <div style={{color:C.muted,fontSize:10}}>Cash</div>
                      <div style={{color:C.green,fontFamily:"'DM Mono',monospace"}}>{fmtFull(b.closing_balance)}</div>
                    </div>
                    {canSeeCost(userRole)&&<div style={{background:C.blue+"11",borderRadius:5,padding:"4px 8px",textAlign:"center"}}>
                      <div style={{color:C.muted,fontSize:10}}>Bank</div>
                      <div style={{color:C.blue,fontFamily:"'DM Mono',monospace"}}>{fmtFull(bankBal)}</div>
                    </div>}
                    {canSeeCost(userRole)&&<div style={{background:C.accent+"11",borderRadius:5,padding:"4px 8px",textAlign:"center"}}>
                      <div style={{color:C.muted,fontSize:10}}>Total</div>
                      <div style={{color:C.accent,fontFamily:"'DM Mono',monospace"}}>{fmtFull(total)}</div>
                    </div>}
                  </div>
                </div>
              );
            })}
          </div>}
        </div>
      </div>

      {chartData.length>1&&<ChartCard title="Cash vs Bank vs Total — Last 30 Days" height={260}>
        <ResponsiveContainer><AreaChart data={chartData}>
          <defs>
            <linearGradient id="cg2" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor={C.green} stopOpacity={0.3}/><stop offset="95%" stopColor={C.green} stopOpacity={0}/></linearGradient>
            <linearGradient id="bg2" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor={C.blue} stopOpacity={0.25}/><stop offset="95%" stopColor={C.blue} stopOpacity={0}/></linearGradient>
            <linearGradient id="tg2" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor={C.accent} stopOpacity={0.2}/><stop offset="95%" stopColor={C.accent} stopOpacity={0}/></linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke={C.dim}/>
          <XAxis dataKey="date" tick={{fill:C.muted,fontSize:10}} axisLine={false} tickLine={false}/>
          <YAxis tick={{fill:C.muted,fontSize:10}} axisLine={false} tickLine={false} tickFormatter={v=>fmtFull(v)}/>
          <Tooltip content={<Tip/>}/>
          <Area type="monotone" dataKey="cash"  stroke={C.green}  fill="url(#cg2)" strokeWidth={2} name="Cash"/>
          {canSeeCost(userRole)&&<Area type="monotone" dataKey="bank"  stroke={C.blue}   fill="url(#bg2)" strokeWidth={2} name="Bank"/>}
          {canSeeCost(userRole)&&<Area type="monotone" dataKey="total" stroke={C.accent} fill="url(#tg2)" strokeWidth={2} name="Total"/>}
        </AreaChart></ResponsiveContainer>
      </ChartCard>}
    </div>
  );
};

// ── Reports Page ──────────────────────────────────────────────────────────────
const Reports = ({sales, expenses, balances, userRole}) => {
  const [period,setPeriod]=useState("month");
  const now=new Date();

  const filterByDate=items=>{
    return items.filter(item=>{
      const d=new Date(item.date);
      if(period==="today") return d.toDateString()===now.toDateString();
      if(period==="week"){const w=new Date(now);w.setDate(w.getDate()-7);return d>=w;}
      if(period==="month") return d.getMonth()===now.getMonth()&&d.getFullYear()===now.getFullYear();
      if(period==="year") return d.getFullYear()===now.getFullYear();
      return true;
    });
  };

  const fSales=filterByDate(sales);
  const fExp=filterByDate(expenses);
  const totalIncome=fSales.reduce((s,d)=>s+d.amount,0);
  const totalCOGS=fSales.reduce((s,d)=>s+(d.unit_cost||0)*d.units,0);
  const grossProfit=totalIncome-totalCOGS;
  const totalExpenses=fExp.reduce((s,d)=>s+d.amount,0);
  const netProfit=grossProfit-totalExpenses;
  const latestBalance=balances?.[0];
  const cashBalance=latestBalance?.closing_balance||0;
  const bankBalance=latestBalance?.bank_balance||0;
  const totalBalance=cashBalance+bankBalance;
  const grossMargin=totalIncome?(grossProfit/totalIncome*100).toFixed(1):0;
  const netMargin=totalIncome?(netProfit/totalIncome*100).toFixed(1):0;

  const PERIODS=[["today","Today"],["week","This Week"],["month","This Month"],["year","This Year"]];

  return (
    <div>
      <SectionHeader title="Reports" subtitle="Income, expenses and balance summary"/>
      <PeriodFilter value={period} onChange={setPeriod} options={PERIODS}/>

      {/* Summary cards */}
      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(150px,1fr))",gap:12,marginBottom:24}}>
        <KpiCard label="Total Income"   value={fmtFull(totalIncome)}   sub={`${fSales.length} sales`}    trend="up" color={C.green}/>
        <KpiCard label="Total Expenses" value={fmtFull(totalExpenses)} sub={`${fExp.length} entries`}   color={C.red}/>
        <KpiCard label="Net Profit"     value={fmtFull(netProfit)}     sub={`${netMargin}% margin`} trend={netProfit>=0?"up":"down"} color={netProfit>=0?C.green:C.red}/>
        <KpiCard label="Cash Balance"   value={fmtFull(cashBalance)}   sub="Latest closing" color={C.blue}/>
        <KpiCard label="Bank Balance"   value={fmtFull(bankBalance)}   sub="Latest recorded" color={C.purple}/>
        <KpiCard label="Total Balance"  value={fmtFull(totalBalance)}  sub="Cash + Bank" color={C.accent}/>
      </div>

      {/* Income vs Expenses summary */}
      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(300px,1fr))",gap:16,marginBottom:20}}>
        {/* Income breakdown */}
        <div style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:12,padding:24}}>
          <div style={{fontSize:11,fontWeight:800,color:C.muted,letterSpacing:1.5,textTransform:"uppercase",marginBottom:16}}>Income Summary</div>
          {[
            ["Total Sales Revenue", fmtFull(totalIncome), C.green],
            ...(canSeeCost(userRole)?[["Cost of Goods Sold", `− ${fmtFull(totalCOGS)}`, C.red]]:[] ),
            ...(canSeeCost(userRole)?[["Gross Profit", fmtFull(grossProfit), grossProfit>=0?C.accent:C.red]]:[] ),
          ].map(([label,value,color])=>(
            <div key={label} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"10px 0",borderBottom:`1px solid ${C.border}`}}>
              <span style={{fontSize:13,fontWeight:600,color:C.muted}}>{label}</span>
              <span style={{fontSize:14,fontWeight:800,color,fontFamily:"'DM Mono',monospace"}}>{value}</span>
            </div>
          ))}
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"12px 0 0"}}>
            <span style={{fontSize:14,fontWeight:800,color:C.text}}>Net Profit</span>
            <span style={{fontSize:16,fontWeight:800,color:netProfit>=0?C.green:C.red,fontFamily:"'DM Mono',monospace"}}>{fmtFull(netProfit)}</span>
          </div>
        </div>

        {/* Expense breakdown */}
        <div style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:12,padding:24}}>
          <div style={{fontSize:11,fontWeight:800,color:C.muted,letterSpacing:1.5,textTransform:"uppercase",marginBottom:16}}>Expense Breakdown</div>
          {["Operations","Marketing","Payroll","Travel","Utilities","Office Supplies","Software","Other"].map(cat=>{
            const total=fExp.filter(e=>e.category===cat).reduce((s,e)=>s+e.amount,0);
            if(!total) return null;
            const pct=totalExpenses?(total/totalExpenses*100).toFixed(0):0;
            return(
              <div key={cat} style={{marginBottom:10}}>
                <div style={{display:"flex",justifyContent:"space-between",marginBottom:4}}>
                  <span style={{fontSize:13,fontWeight:600,color:C.muted}}>{cat}</span>
                  <span style={{fontSize:13,fontWeight:700,color:C.text,fontFamily:"'DM Mono',monospace"}}>{fmtFull(total)}</span>
                </div>
                <div style={{background:C.surface,borderRadius:4,height:6,overflow:"hidden"}}>
                  <div style={{width:`${pct}%`,height:"100%",background:C.red,borderRadius:4,transition:"width 0.3s"}}/>
                </div>
              </div>
            );
          })}
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"12px 0 0",borderTop:`1px solid ${C.border}`,marginTop:8}}>
            <span style={{fontSize:14,fontWeight:800,color:C.text}}>Total</span>
            <span style={{fontSize:16,fontWeight:800,color:C.red,fontFamily:"'DM Mono',monospace"}}>{fmtFull(totalExpenses)}</span>
          </div>
        </div>
      </div>

      {/* Balance section */}
      <div style={{background:C.card,border:`1px solid ${C.accent}33`,borderRadius:12,padding:24}}>
        <div style={{fontSize:11,fontWeight:800,color:C.accent,letterSpacing:1.5,textTransform:"uppercase",marginBottom:16}}>Balance Position (Latest Record — {latestBalance?String(latestBalance.date):"No data"})</div>
        <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(160px,1fr))",gap:12}}>
          {[
            ["Cash in Hand",  fmtFull(cashBalance),  C.green,  "Closing cash balance"],
            ["Bank Balance",  fmtFull(bankBalance),  C.blue,   "As recorded"],
            ["Total Balance", fmtFull(totalBalance), C.accent, "Cash + Bank combined"],
          ].map(([label,value,color,sub])=>(
            <div key={label} style={{background:C.surface,borderRadius:10,padding:"16px 18px"}}>
              <div style={{fontSize:11,fontWeight:700,color:C.muted,letterSpacing:1,textTransform:"uppercase",marginBottom:8}}>{label}</div>
              <div style={{fontSize:20,fontWeight:800,color,fontFamily:"'DM Mono',monospace",wordBreak:"break-all"}}>{value}</div>
              <div style={{fontSize:11,fontWeight:600,color:C.dim,marginTop:4}}>{sub}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

// ── Main App ──────────────────────────────────────────────────────────────────
export default function BizMonitor() {
  const [user,setUser]=useState(null); const [authChecked,setAuthChecked]=useState(false);
  const [businesses,setBusinesses]=useState([]); const [activeBiz,setActiveBiz]=useState(null);
  const [businessesLoaded,setBusinessesLoaded]=useState(false);
  const [page,setPage]=useState("overview");
  const [sales,setSales]=useState([]); const [expenses,setExpenses]=useState([]);
  const [inventory,setInventory]=useState([]); const [summary,setSummary]=useState(null);
  const [cashBalances,setCashBalances]=useState([]);
  const [apiStatus,setApiStatus]=useState("loading"); const [lastRefresh,setLastRefresh]=useState(null);
  const [sidebarOpen,setSidebarOpen]=useState(false);

  useEffect(()=>{
    const token=getToken();
    if(token){apiGet("/auth/me").then(u=>{setUser(u);setAuthChecked(true);}).catch(()=>{clearToken();setAuthChecked(true);});}
    else setAuthChecked(true);
  },[]);

  useEffect(()=>{
    if(user){
      setBusinessesLoaded(false);
      apiGet("/businesses")
        .then(b=>{
          setBusinesses(b);
          if(b.length===1) setActiveBiz(b[0]);
        })
        .catch(()=>{})
        .finally(()=>setBusinessesLoaded(true));
    }
  },[user]);

  const loadBizData=useCallback(async()=>{
    if(!activeBiz){setApiStatus("ok");return;}
    try{
      // Core data — sales/expenses/inventory must succeed
      const [s,e,inv]=await Promise.all([
        apiGet(`/businesses/${activeBiz.id}/sales`),
        apiGet(`/businesses/${activeBiz.id}/expenses`),
        apiGet(`/businesses/${activeBiz.id}/inventory`),
      ]);
      setSales(s);setExpenses(e);setInventory(inv);
      setApiStatus("ok");setLastRefresh(new Date());
    }catch{setApiStatus("error");return;}
    // Summary — optional, some roles may not have access
    try{setSummary(await apiGet(`/businesses/${activeBiz.id}/summary`));}
    catch{setSummary(null);}
    // Cash — optional, won't break the app if it fails
    try{setCashBalances(await apiGet(`/businesses/${activeBiz.id}/cash`));}
    catch{setCashBalances([]);}
  },[activeBiz]);

  useEffect(()=>{
    if(activeBiz){loadBizData();const t=setInterval(loadBizData,30000);return()=>clearInterval(t);}
    else setApiStatus("ok");
  },[activeBiz,loadBizData]);

  const handleLogout=()=>{clearToken();setUser(null);setActiveBiz(null);setBusinesses([]);setSales([]);setExpenses([]);setInventory([]);setSummary(null);setCashBalances([]);setApiStatus("loading");setBusinessesLoaded(false);};
  const switchBusiness=()=>{setActiveBiz(null);setPage("overview");setSidebarOpen(false);};

  if(!authChecked) return <LoadingScreen/>;
  if(!user) return <LoginScreen onLogin={setUser}/>;
  // Wait for businesses to finish loading before showing picker
  if(!businessesLoaded && !activeBiz) return <LoadingScreen/>;
  if(!activeBiz&&user.role!=="admin") return <BusinessPicker businesses={businesses} onSelect={b=>{setActiveBiz(b);setSidebarOpen(false);}} user={user}/>;
  if(!activeBiz&&user.role==="admin"&&businesses.length>0&&page!=="admin") return <BusinessPicker businesses={[...businesses,{id:"__admin__",name:"⚙ Admin Panel",industry:"System",currency:""}]} onSelect={b=>b.id==="__admin__"?setPage("admin"):setActiveBiz(b)} user={user}/>;

  const isAdmin=user.role==="admin";

  const bizRole=()=>{
    if(user.role==="admin") return "admin";
    return user.role;
  };
  const role=bizRole();

  const sortByDate=arr=>[...arr].sort((a,b)=>new Date(b.created_at||b.date)-new Date(a.created_at||a.date));

  const pageMap={
    admin:    <AdminPanel user={user} businesses={businesses} onBusinessCreated={b=>{if(b)setBusinesses(p=>[...p,b]);else apiGet("/businesses").then(setBusinesses).catch(()=>{});}}/>,
    entry:    <DataEntry inventory={inventory} onRefresh={loadBizData} bizId={activeBiz?.id} apiStatus={apiStatus} userRole={role} recentSales={sortByDate(sales).slice(0,8)} recentExpenses={sortByDate(expenses).slice(0,8)}/>,
    overview: <Overview  sales={sales} expenses={expenses} inventory={inventory} userRole={role}/>,
    sales:    <Sales     sales={sortByDate(sales)} bizId={activeBiz?.id} userRole={role} onRefresh={loadBizData}/>,
    expenses: <Expenses  expenses={sortByDate(expenses)} bizId={activeBiz?.id} userRole={role} onRefresh={loadBizData}/>,
    inventory:<Inventory inventory={inventory} bizId={activeBiz?.id} userRole={role} onRefresh={loadBizData}/>,
    pl:       <PL        sales={sales} expenses={expenses} summary={summary} userRole={role}/>,
    cash:     <CashPage  bizId={activeBiz?.id} userRole={role}/>,
    reports:  <Reports   sales={sales} expenses={expenses} balances={cashBalances} userRole={role}/>,
  };

  const NAV_ITEMS=[
    ...(isAdmin?[{id:"admin",label:"Admin Panel",icon:"⚙",color:C.accent}]:[]),
    {id:"entry",    label:"Data Entry",  icon:"✎", color:C.accent, highlight:true},
    {id:"overview", label:"Overview",    icon:"⬡"},
    {id:"sales",    label:"Sales",       icon:"↑"},
    {id:"expenses", label:"Expenses",    icon:"↓"},
    {id:"inventory",label:"Inventory",   icon:"▣"},
    ...(role!=="employee"?[{id:"pl",label:"P&L",icon:"≋"}]:[]),
    {id:"cash",     label:"Cash & Bank", icon:"💵"},
    {id:"reports",  label:"Reports",     icon:"📊", color:C.blue},
  ];

  const NavBtn=({item})=>(
    <button onClick={()=>{setPage(item.id);if(item.id==="admin")setActiveBiz(null);setSidebarOpen(false);}} style={{
      width:"100%",display:"flex",alignItems:"center",gap:12,padding:"12px 14px",borderRadius:8,border:"none",
      cursor:"pointer",background:page===item.id?(item.color||C.accent)+"18":"transparent",
      color:page===item.id?(item.color||C.accent):C.muted,
      fontSize:14,fontWeight:page===item.id?700:500,
      marginBottom:3,borderLeft:page===item.id?`3px solid ${item.color||C.accent}`:"3px solid transparent",
      fontFamily:"'IBM Plex Sans',sans-serif",textAlign:"left",
    }}>
      <span style={{fontFamily:"monospace",width:18,textAlign:"center",flexShrink:0}}>{item.icon}</span>
      {item.label}
    </button>
  );

  const Sidebar=()=>(
    <div style={{display:"flex",flexDirection:"column",height:"100%"}}>
      {/* Logo */}
      <div style={{padding:"18px 20px",borderBottom:`1px solid ${C.border}`}}>
        <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:activeBiz?12:0}}>
          <div style={{width:34,height:34,background:C.accent,borderRadius:8,display:"flex",alignItems:"center",justifyContent:"center",fontSize:18,fontWeight:800,color:"#000",flexShrink:0}}>B</div>
          <div><div style={{fontWeight:800,fontSize:15,color:C.text}}>BizMonitor</div><div style={{fontSize:10,fontWeight:700,color:C.muted,letterSpacing:1}}>ENTERPRISE</div></div>
        </div>
        {activeBiz&&(
          <button onClick={switchBusiness} style={{width:"100%",background:C.accentDim,border:`1px solid ${C.accent}33`,borderRadius:8,padding:"9px 12px",cursor:"pointer",textAlign:"left",fontFamily:"'IBM Plex Sans',sans-serif"}}>
            <div style={{fontSize:13,fontWeight:700,color:C.accent,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{activeBiz.name}</div>
            <div style={{fontSize:11,fontWeight:600,color:C.muted,marginTop:2}}>↩ Switch business</div>
          </button>
        )}
      </div>
      {/* Nav */}
      <nav style={{flex:1,padding:"12px 10px",overflowY:"auto"}}>
        {isAdmin&&<><div style={{fontSize:10,fontWeight:800,color:C.muted,letterSpacing:1.5,textTransform:"uppercase",padding:"0 14px 8px"}}>Admin</div><NavBtn item={NAV_ITEMS.find(n=>n.id==="admin")}/><div style={{fontSize:10,fontWeight:800,color:C.muted,letterSpacing:1.5,textTransform:"uppercase",padding:"8px 14px"}}>Dashboards</div></>}
        {activeBiz&&<>
          <div style={{fontSize:10,fontWeight:800,color:C.muted,letterSpacing:1.5,textTransform:"uppercase",padding:"0 14px 8px"}}>Data</div>
          <NavBtn item={{id:"entry",label:"Data Entry",icon:"✎",color:C.accent}}/>
          <div style={{fontSize:10,fontWeight:800,color:C.muted,letterSpacing:1.5,textTransform:"uppercase",padding:"8px 14px"}}>Dashboards</div>
          {["overview","sales","expenses","inventory"].map(id=><NavBtn key={id} item={NAV_ITEMS.find(n=>n.id===id)||{id,label:id,icon:"·"}}/>)}
          {role!=="employee"&&<NavBtn item={NAV_ITEMS.find(n=>n.id==="pl")||{id:"pl",label:"P&L",icon:"≋"}}/>}
          <div style={{fontSize:10,fontWeight:800,color:C.muted,letterSpacing:1.5,textTransform:"uppercase",padding:"8px 14px"}}>Finance</div>
          {["cash","reports"].map(id=><NavBtn key={id} item={NAV_ITEMS.find(n=>n.id===id)||{id,label:id,icon:"·"}}/>)}
        </>}
      </nav>
      {/* Footer */}
      <div style={{padding:"14px 16px",borderTop:`1px solid ${C.border}`}}>
        <div style={{fontSize:14,fontWeight:700,color:C.text,marginBottom:2}}>{user.full_name}</div>
        <div style={{fontSize:12,fontWeight:600,color:C.muted,marginBottom:10,textTransform:"capitalize"}}>{user.role}{user.department?` · ${user.department}`:""}</div>
        <div style={{display:"flex",alignItems:"center",gap:6,marginBottom:10}}>
          {apiStatus==="loading"?<Spinner size={12}/>:<span style={{color:apiStatus==="ok"?C.green:C.red,fontSize:12}}>●</span>}
          <span style={{fontSize:12,fontWeight:600,color:apiStatus==="ok"?C.green:apiStatus==="error"?C.red:C.muted}}>
            {apiStatus==="ok"?"Connected":apiStatus==="error"?"Offline":"Connecting…"}
          </span>
        </div>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
          <button onClick={loadBizData} style={{fontSize:12,fontWeight:600,color:C.muted,background:"transparent",border:"none",cursor:"pointer",padding:0,fontFamily:"'IBM Plex Sans',sans-serif",display:"flex",alignItems:"center",gap:4}}>
            <Spinner size={10}/> {lastRefresh?lastRefresh.toLocaleTimeString([],{hour:"2-digit",minute:"2-digit"}):"Refresh"}
          </button>
          <button onClick={handleLogout} style={{fontSize:12,fontWeight:700,color:C.red,background:"transparent",border:"none",cursor:"pointer",padding:0,fontFamily:"'IBM Plex Sans',sans-serif"}}>Sign out</button>
        </div>
      </div>
    </div>
  );

  return (
    <div style={{display:"flex",height:"100vh",background:C.bg,color:C.text,fontFamily:"'IBM Plex Sans',system-ui,sans-serif",fontSize:14,overflow:"hidden"}}>
      <link href="https://fonts.googleapis.com/css2?family=IBM+Plex+Sans:wght@400;500;600;700;800&family=DM+Mono:wght@400;500&display=swap" rel="stylesheet"/>
      <style>{css}</style>

      {/* Desktop Sidebar */}
      <div style={{width:230,background:C.surface,borderRight:`1px solid ${C.border}`,flexShrink:0,display:"flex",flexDirection:"column"}} className="desktop-sidebar">
        <style>{`@media(max-width:768px){.desktop-sidebar{display:none!important}}`}</style>
        <Sidebar/>
      </div>

      {/* Mobile Sidebar Overlay */}
      {sidebarOpen&&(
        <div style={{position:"fixed",inset:0,zIndex:1000,display:"flex"}}>
          <div onClick={()=>setSidebarOpen(false)} style={{position:"absolute",inset:0,background:"#000a"}}/>
          <div style={{position:"relative",width:260,background:C.surface,borderRight:`1px solid ${C.border}`,display:"flex",flexDirection:"column",zIndex:1}}>
            <Sidebar/>
          </div>
        </div>
      )}

      {/* Main Content */}
      <div style={{flex:1,overflowY:"auto",display:"flex",flexDirection:"column",minWidth:0}}>
        {/* Top bar */}
        <div style={{padding:"12px 16px",borderBottom:`1px solid ${C.border}`,display:"flex",justifyContent:"space-between",alignItems:"center",background:C.surface,flexShrink:0,gap:12}}>
          <div style={{display:"flex",alignItems:"center",gap:12}}>
            {/* Hamburger for mobile */}
            <button onClick={()=>setSidebarOpen(true)} style={{background:"transparent",border:"none",cursor:"pointer",padding:4,color:C.text,fontSize:18,lineHeight:1,fontFamily:"monospace"}} className="mobile-menu-btn">
              ☰
            </button>
            <style>{`@media(min-width:769px){.mobile-menu-btn{display:none!important}}`}</style>
            <div style={{fontSize:12,fontWeight:700,color:C.muted,letterSpacing:1,textTransform:"uppercase"}}>
              {activeBiz?`${activeBiz.name} · `:""}{page.charAt(0).toUpperCase()+page.slice(1)}
            </div>
          </div>
          <div style={{display:"flex",alignItems:"center",gap:10,fontSize:12,fontWeight:600,color:C.muted,flexShrink:0}}>
            {apiStatus==="loading"&&<Spinner size={14}/>}
            {activeBiz&&<span style={{display:"none"}} className="stats-bar">{sales.length} sales</span>}
            <style>{`@media(min-width:769px){.stats-bar{display:inline!important}}`}</style>
          </div>
        </div>

        {/* Page Content */}
        <div style={{flex:1,padding:"20px 16px",overflowY:"auto"}} className="bm-page">
          <style>{`@media(min-width:769px){.bm-page{padding:28px!important}}`}</style>
          {pageMap[page]||<div style={{color:C.muted,fontWeight:600}}>Select a page</div>}
        </div>
      </div>
    </div>
  );
}
