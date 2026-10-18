import { FormEvent, useEffect, useMemo, useState } from "react";
import {
  Activity, ArrowDownLeft, ArrowRight, ArrowUpRight, Bot, BookOpen,
  Check, CheckCircle2, ChevronDown, CircleHelp, CreditCard, Eye, EyeOff,
  FileText, HandCoins, LayoutDashboard, LockKeyhole, LogIn, LogOut,
  Menu, MessageCircle, Plus, Search, Send, Settings, ShieldCheck,
  Sparkles, User, UserRound, Users, Wallet, X, Zap
} from "lucide-react";
import "./App.css";

const API = "http://localhost:4000";
type Mijoz = { id: number; ism: string; telefon: string; manzil: string; izoh: string };
type Qarz = { id: number; mijoz_id: number; mijoz_ismi: string; summa: number; qoldiq: number; izoh: string; sana: string };
type Sahifa = "Bosh sahifa" | "Mijozlar" | "Qarzlar" | "AI yordamchi";

const pul = (n: number) => `${Number(n || 0).toLocaleString("uz-UZ")} so‘m`;
const sana = (v: string) => v ? new Date(v).toLocaleDateString("uz-UZ") : "—";

async function api<T>(path: string, options: RequestInit = {}): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`${API}${path}`, {
      ...options,
      headers: { "Content-Type": "application/json", ...(options.headers || {}) },
    });
  } catch {
    throw new Error("Serverga ulanib bo‘lmadi. Go backend ishga tushganini tekshiring.");
  }
  const text = await response.text();
  let body: any = {};
  try { body = text ? JSON.parse(text) : {}; } catch { /* javob JSON bo'lmasligi mumkin */ }
  if (!response.ok) throw new Error(body.xabar || `Server xatosi: ${response.status}`);
  return body as T;
}

// Bu yordamchi internetdagi barcha savollarga kafolatli javob bermaydi.
// API ulanmaganda qarz daftarchasi bo'yicha sodda mahalliy maslahat beradi.
function mahalliyAI(savol: string, mijozlar: Mijoz[], qarzlar: Qarz[]) {
  const s = savol.toLowerCase();
  const jami = qarzlar.reduce((a, q) => a + q.summa, 0);
  const qoldiq = qarzlar.reduce((a, q) => a + q.qoldiq, 0);
  const tolangan = jami - qoldiq;
  if (/(salom|assalom|hello)/.test(s)) return "Assalomu alaykum! Men QarzDaftar yordamchisiman. Mijozlar, qarz qoldig‘i, to‘lovlar yoki ilovadan foydalanish haqida so‘rashingiz mumkin.";
  if (/(jami|umumiy).*(qarz|summa)|(qarz|summa).*(jami|umumiy)/.test(s)) return `Bazadagi jami qarzlar: ${pul(jami)}. Qolgan qarz: ${pul(qoldiq)}. Qaytarilgan to‘lovlar: ${pul(tolangan)}.`;
  if (/(qoldiq|hali|qaytarilmagan)/.test(s)) return `Hozirgi ma’lumotlar bo‘yicha mijozlardan qaytarilishi kerak bo‘lgan jami qoldiq ${pul(qoldiq)}.`;
  if (/(to‘langan|tolangan|qaytarilgan|to'langan)/.test(s)) return `Kiritilgan to‘lovlar bo‘yicha jami qaytarilgan summa ${pul(tolangan)}.`;
  if (/(nechta|soni|qancha).*(mijoz|odam)/.test(s)) return `Hozir bazada ${mijozlar.length} ta mijoz bor.`;
  if (/(nechta|soni|qancha).*(qarz)/.test(s)) return `Hozir bazada ${qarzlar.length} ta qarz yozuvi bor.`;
  if (/(eng katta|katta qarz)/.test(s)) {
    const q = [...qarzlar].sort((a, b) => b.qoldiq - a.qoldiq)[0];
    return q ? `Eng katta qolgan qarz: ${q.mijoz_ismi} — ${pul(q.qoldiq)} (qarz #${q.id}).` : "Hozircha qarz ma’lumoti yo‘q.";
  }
  if (/(qanday|qanaqa).*(foydalan|qarz qo‘sh|mijoz qo‘sh)/.test(s) || /(yordam|yo‘riqnoma|qanday ishlaydi)/.test(s)) return "Foydalanish tartibi: 1) Mijozlar bo‘limidan mijoz qo‘shing. 2) Qarzlar bo‘limida mijozni tanlab qarz summasini kiriting. 3) Qarz qatoridagi To‘lov tugmasi orqali qaytarilgan pulni yozing. Bitta mijozga bir nechta qarz qo‘shish mumkin.";
  return "Bu savolga aniq javob berish uchun tashqi AI xizmatiga ulanish kerak. Hozir men ilovadagi qarz va mijoz statistikasi hamda foydalanish bo‘yicha yordam bera olaman. Masalan: “Jami qarz qancha?”, “Nechta mijoz bor?” yoki “Qanday qilib to‘lov kiritaman?” deb so‘rang.";
}

export default function App() {
  const [sahifa, setSahifa] = useState<Sahifa>("Bosh sahifa");
  const [mijozlar, setMijozlar] = useState<Mijoz[]>([]);
  const [qarzlar, setQarzlar] = useState<Qarz[]>([]);
  const [yuklanmoqda, setYuklanmoqda] = useState(true);
  const [xato, setXato] = useState("");
  const [xabarnoma, setXabarnoma] = useState("");
  const [qidiruv, setQidiruv] = useState("");
  const [mobilMenyu, setMobilMenyu] = useState(false);
  const [modal, setModal] = useState<"mijoz" | "qarz" | "tolov" | null>(null);
  const [tanlangan, setTanlangan] = useState<Qarz | null>(null);
  const [band, setBand] = useState(false);

  // Demo login: haqiqiy ko‘p foydalanuvchili himoya uchun backendda autentifikatsiya kerak.
  const [kirgan, setKirgan] = useState(() => sessionStorage.getItem("qd_demo_kirdi") === "ha");
  const [login, setLogin] = useState("");
  const [parol, setParol] = useState("");
  const [parolKorinsin, setParolKorinsin] = useState(false);
  const [loginXato, setLoginXato] = useState("");

  const [ism, setIsm] = useState("");
  const [telefon, setTelefon] = useState("");
  const [manzil, setManzil] = useState("");
  const [mijozIzoh, setMijozIzoh] = useState("");
  const [mijozID, setMijozID] = useState("");
  const [qarzSumma, setQarzSumma] = useState("");
  const [qarzIzoh, setQarzIzoh] = useState("");
  const [tolovSumma, setTolovSumma] = useState("");
  const [tolovIzoh, setTolovIzoh] = useState("");
  const [savol, setSavol] = useState("");
  const [chat, setChat] = useState<{kim: "ai" | "siz"; matn: string}[]>([
    { kim: "ai", matn: "Assalomu alaykum! Men QarzDaftar AI yordamchisiman. Qarz statistikasi yoki ilovadan foydalanish haqida savol bering." }
  ]);

  async function yukla() {
    setYuklanmoqda(true); setXato("");
    try {
      const [m, q] = await Promise.all([api<Mijoz[]>("/api/mijozlar"), api<Qarz[]>("/api/qarzlar")]);
      setMijozlar(m); setQarzlar(q);
    } catch (e) { setXato(e instanceof Error ? e.message : "Ma’lumotlarni olishda xato"); }
    finally { setYuklanmoqda(false); }
  }
  useEffect(() => { if (kirgan) void yukla(); }, [kirgan]);

  const jami = useMemo(() => qarzlar.reduce((a, q) => a + q.summa, 0), [qarzlar]);
  const qoldiq = useMemo(() => qarzlar.reduce((a, q) => a + q.qoldiq, 0), [qarzlar]);
  const qaytgan = jami - qoldiq;
  const topMijozlar = mijozlar.filter(m => `${m.ism} ${m.telefon} ${m.manzil}`.toLowerCase().includes(qidiruv.toLowerCase()));
  const topQarzlar = qarzlar.filter(q => `${q.mijoz_ismi} ${q.izoh} ${q.id}`.toLowerCase().includes(qidiruv.toLowerCase()));

  function kirish(e: FormEvent) {
    e.preventDefault(); setLoginXato("");
    if (!login.trim() || !parol.trim()) { setLoginXato("Login va parolni kiriting."); return; }
    // Faqat interfeys namoyishi. Bu haqiqiy server autentifikatsiyasi emas.
    sessionStorage.setItem("qd_demo_kirdi", "ha");
    setKirgan(true);
  }
  function chiqish() {
    sessionStorage.removeItem("qd_demo_kirdi");
    setKirgan(false); setLogin(""); setParol(""); setSahifa("Bosh sahifa");
  }
  function modalniYop() {
    setModal(null); setTanlangan(null);
    setIsm(""); setTelefon(""); setManzil(""); setMijozIzoh(""); setMijozID("");
    setQarzSumma(""); setQarzIzoh(""); setTolovSumma(""); setTolovIzoh("");
  }
  async function mijozSaqlash(e: FormEvent) {
    e.preventDefault(); setBand(true); setXato(""); setXabarnoma("");
    try {
      await api<Mijoz>("/api/mijozlar", { method: "POST", body: JSON.stringify({ ism: ism.trim(), telefon: telefon.trim(), manzil: manzil.trim(), izoh: mijozIzoh.trim() }) });
      await yukla(); setXabarnoma("Mijoz saqlandi."); modalniYop(); setSahifa("Mijozlar");
    } catch (e) { setXato(e instanceof Error ? e.message : "Mijoz saqlanmadi"); }
    finally { setBand(false); }
  }
  async function qarzSaqlash(e: FormEvent) {
    e.preventDefault(); setBand(true); setXato(""); setXabarnoma("");
    try {
      await api<Qarz>("/api/qarzlar", { method: "POST", body: JSON.stringify({ mijoz_id: Number(mijozID), summa: Number(qarzSumma), izoh: qarzIzoh.trim() }) });
      await yukla(); setXabarnoma("Qarz saqlandi."); modalniYop(); setSahifa("Qarzlar");
    } catch (e) { setXato(e instanceof Error ? e.message : "Qarz saqlanmadi"); }
    finally { setBand(false); }
  }
  async function tolovSaqlash(e: FormEvent) {
    e.preventDefault(); if (!tanlangan) return; setBand(true); setXato(""); setXabarnoma("");
    try {
      const javob = await api<{xabar: string; qoldiq: number}>(`/api/qarzlar/${tanlangan.id}/tolovlar`, { method: "POST", body: JSON.stringify({ summa: Number(tolovSumma), izoh: tolovIzoh.trim() }) });
      await yukla(); setXabarnoma(`${javob.xabar}. Qoldiq: ${pul(javob.qoldiq)}`); modalniYop();
    } catch (e) { setXato(e instanceof Error ? e.message : "To‘lov saqlanmadi"); }
    finally { setBand(false); }
  }
  function aiYubor(e?: FormEvent) {
    e?.preventDefault();
    const matn = savol.trim(); if (!matn) return;
    setChat(old => [...old, {kim: "siz", matn}, {kim: "ai", matn: mahalliyAI(matn, mijozlar, qarzlar)}]);
    setSavol("");
  }

  if (!kirgan) return <div className="kirish-sahifa">
    <div className="kirish-chap"><div className="kirish-brend"><span className="logo-belgi"><BookOpen/></span><span>QarzDaftar<span className="logo-online">ONLINE</span></span></div><div className="kirish-matn"><span className="kichik-badge"><Sparkles size={14}/> MOLIYANI OSON BOSHQARING</span><h1>Qarzlaringiz,<br/><em>tartib bilan.</em></h1><p>Mijozlar, qarzlar va to‘lovlarni bitta qulay boshqaruv panelida kuzating.</p><div className="kirish-xususiyat"><span><CheckCircle2/> Mijoz va qarzlar bir joyda</span><span><CheckCircle2/> To‘lovlar va qoldiq nazorati</span><span><CheckCircle2/> AI yordamchi</span></div></div><div className="kirish-past">© 2026 QarzDaftar · O‘zbekistonda yaratilgan</div><div className="bezak doira1"/><div className="bezak doira2"/></div>
    <div className="kirish-ong"><form className="kirish-karta" onSubmit={kirish}><div className="telefon-logo"><LockKeyhole size={23}/></div><h2>Xush kelibsiz!</h2><p>Davom etish uchun login ma’lumotlarini kiriting.</p>{loginXato && <div className="form-xato">{loginXato}</div>}<label>Login yoki elektron pochta<div className="kirish-input"><UserRound size={18}/><input autoComplete="username" value={login} onChange={e=>setLogin(e.target.value)} placeholder="Loginni kiriting" required/></div></label><label>Parol<div className="kirish-input"><LockKeyhole size={18}/><input autoComplete="current-password" type={parolKorinsin?"text":"password"} value={parol} onChange={e=>setParol(e.target.value)} placeholder="Parolni kiriting" required/><button type="button" onClick={()=>setParolKorinsin(!parolKorinsin)} aria-label="Parolni ko‘rsatish">{parolKorinsin?<EyeOff size={17}/>:<Eye size={17}/>}</button></div></label><button className="kirish-tugma" type="submit"><LogIn size={18}/> Kirish <ArrowRight size={17}/></button><div className="xavfsiz-eslatma"><ShieldCheck size={16}/> Kirish oynasi hozircha namoyish uchun</div><p className="demo-eslatma">Istalgan login va parol bilan interfeysga kirishingiz mumkin. Haqiqiy akkauntlar uchun backendda ro‘yxatdan o‘tish, parolni xeshlash va tokenli himoya qo‘shish kerak.</p></form></div>
  </div>;

  const menyu: {nom: Sahifa; icon: typeof LayoutDashboard}[] = [
    {nom:"Bosh sahifa",icon:LayoutDashboard},{nom:"Mijozlar",icon:Users},{nom:"Qarzlar",icon:FileText},{nom:"AI yordamchi",icon:Bot}
  ];

  return <div className="ilova">
    {mobilMenyu && <button className="qoplama" onClick={()=>setMobilMenyu(false)} aria-label="Menyuni yopish"/>}
    <aside className={`yon-panel ${mobilMenyu?"ochiq":""}`}><div className="brend"><span className="logo-belgi"><BookOpen/></span><span>QarzDaftar<small>ONLINE</small></span><button className="mobil-yopish" onClick={()=>setMobilMenyu(false)}><X/></button></div><div className="profil-mini"><div className="profil-rasm">Q</div><div><strong>{login || "Foydalanuvchi"}</strong><span>Shaxsiy kabinet</span></div><span className="online-nuqta"/></div><p className="menyu-yorliq">ISH JOYI</p><nav>{menyu.map(({nom,icon:Icon})=><button key={nom} className={`menyu-tugma ${sahifa===nom?"faol":""}`} onClick={()=>{setSahifa(nom);setQidiruv("");setMobilMenyu(false);}}><Icon size={19}/><span>{nom}</span>{nom==="AI yordamchi"&&<span className="ai-mini">AI</span>}</button>)}</nav><div className="yon-ai"><div className="ai-yulduz"><Sparkles/></div><strong>AI yordamchi</strong><p>Qarzlaringiz bo‘yicha savollaringizga javob oling.</p><button onClick={()=>setSahifa("AI yordamchi")}>Savol berish <ArrowRight size={15}/></button></div><div className="yon-past"><div><ShieldCheck size={16}/> Ma’lumotlar serverdan</div><button onClick={chiqish}><LogOut size={16}/> Hisobdan chiqish</button></div></aside>

    <main className="asosiy"><header className="yuqori-panel"><div className="sarlavha-qismi"><button className="menyu-och" onClick={()=>setMobilMenyu(true)}><Menu/></button><div><div className="breadcrumb">ISH JOYI <span>/</span> {sahifa.toUpperCase()}</div><h1>{sahifa}</h1></div></div><div className="yuqori-amallar"><span className="server-holati"><i/> Server bilan ishlash</span><button className="avatar-tugma" title="Hisobdan chiqish" onClick={chiqish}><span className="avatar">{(login[0]||"Q").toUpperCase()}</span><ChevronDown size={15}/></button></div></header>
      <section className="kontent">
        {(xato||xabarnoma)&&<div className={`xabarnoma ${xato?"xato":"yaxshi"}`}>{xato?<CircleHelp size={18}/>:<CheckCircle2 size={18}/>}<span>{xato||xabarnoma}</span><button onClick={()=>{setXato("");setXabarnoma("");}}><X size={16}/></button></div>}
        {yuklanmoqda&&<div className="yuklanish">Server ma’lumotlari yuklanmoqda...</div>}
        {sahifa==="Bosh sahifa"&&<><div className="salom-banner"><div><span className="kichik-badge"><Zap size={13}/> MOLIYAVIY NAZORAT</span><h2>Salom, {login || "foydalanuvchi"}! <span>👋</span></h2><p>Bugungi qarzlar holatini ko‘rib chiqing va hisobingizni tartibda saqlang.</p><button onClick={()=>setSahifa("Qarzlar")}>Qarzlarni ko‘rish <ArrowRight size={16}/></button></div><div className="banner-rasm"><div className="banner-doira"><Wallet size={45}/></div><div className="uchuvchi-karta"><ArrowUpRight size={16}/><span>Qarz nazorati</span><strong>Hammasi bir joyda</strong></div></div></div>
          <div className="statistika"><Stat nom="Jami qarz" qiymat={pul(jami)} icon={Wallet} rang="yashil" past="Barcha qarzlar yig‘indisi"/><Stat nom="Qolgan qarz" qiymat={pul(qoldiq)} icon={HandCoins} rang="kok" past="Qaytarilishi kerak"/><Stat nom="Qaytarilgan" qiymat={pul(qaytgan)} icon={ArrowDownLeft} rang="binafsha" past="Kiritilgan to‘lovlar"/><Stat nom="Mijozlar" qiymat= {String(mijozlar.length)} icon={Users} rang="sariq" past="Ro‘yxatdagi mijozlar"/></div>
          <div className="ikki-ustun"><section className="karta"><div className="karta-sarlavha"><div><Activity/><h2>Qarzlar tahlili</h2></div><span className="jonli"><i/> Jonli ma’lumot</span></div><div className="tahlil-summa"><div><span>Qaytarilgan ulush</span><strong>{jami?Math.round(qaytgan/jami*100):0}%</strong></div><span>{pul(qaytgan)} / {pul(jami)}</span></div><div className="progress"><span style={{width:`${jami?Math.min(100,qaytgan/jami*100):0}%`}}/></div><div className="tahlil-izoh"><span><i className="nuqta yashil-nuqta"/> To‘langan <b>{pul(qaytgan)}</b></span><span><i className="nuqta kok-nuqta"/> Qolgan <b>{pul(qoldiq)}</b></span></div></section><section className="karta tezkor"><div className="karta-sarlavha"><div><Zap/><h2>Tezkor amallar</h2></div></div><button className="tezkor-tugma" onClick={()=>setModal("mijoz")}><span className="tezkor-belgi yashil"><UserRound/></span><span><strong>Mijoz qo‘shish</strong><small>Yangi mijozni ro‘yxatga olish</small></span><Plus/></button><button className="tezkor-tugma" onClick={()=>setModal("qarz")}><span className="tezkor-belgi kok"><CreditCard/></span><span><strong>Yangi qarz</strong><small>Mavjud mijozga qarz yozish</small></span><Plus/></button></section></div>
        </>}
        {sahifa==="Mijozlar"&&<section className="karta"><div className="karta-sarlavha"><div><Users/><h2>Mijozlar ro‘yxati</h2></div><button className="asosiy-tugma" onClick={()=>setModal("mijoz")}><Plus size={17}/> Mijoz qo‘shish</button></div><label className="qidiruv keng"><Search/><input placeholder="Ism, telefon yoki manzil bo‘yicha qidirish..." value={qidiruv} onChange={e=>setQidiruv(e.target.value)}/></label><div className="mijoz-grid">{topMijozlar.map(m=><article className="mijoz-karta" key={m.id}><div className="mijoz-avatar">{m.ism[0]?.toUpperCase()}</div><div className="mijoz-info"><strong>{m.ism}</strong><span>{m.telefon||"Telefon kiritilmagan"}</span><small>{m.manzil||"Manzil kiritilmagan"}</small></div><button className="kichik-tugma" onClick={()=>{setMijozID(String(m.id));setModal("qarz");}}>+ Qarz</button></article>)}</div>{!yuklanmoqda&&topMijozlar.length===0&&<Empty matn={qidiruv?"Mijoz topilmadi.":"Hozircha mijoz yo‘q. Birinchi mijozni qo‘shing."}/>}</section>}
        {sahifa==="Qarzlar"&&<section className="karta"><div className="karta-sarlavha"><div><FileText/><h2>Qarzlar ro‘yxati</h2></div><button className="asosiy-tugma" onClick={()=>setModal("qarz")}><Plus size={17}/> Qarz qo‘shish</button></div><label className="qidiruv keng"><Search/><input placeholder="Mijoz ismi yoki izohni qidirish..." value={qidiruv} onChange={e=>setQidiruv(e.target.value)}/></label><div className="jadval-aylantir"><table><thead><tr><th>MIJOZ</th><th>QARZ SUMMASI</th><th>QOLDIQ</th><th>SANA</th><th>HOLAT</th><th>AMAL</th></tr></thead><tbody>{topQarzlar.map(q=><tr key={q.id}><td><div className="mijoz"><span className="mijoz-avatar">{q.mijoz_ismi[0]?.toUpperCase()}</span><span><strong>{q.mijoz_ismi}</strong><small>Qarz #{q.id}</small></span></div></td><td className="summa">{pul(q.summa)}</td><td className="summa">{pul(q.qoldiq)}</td><td>{sana(q.sana)}</td><td><span className={`holat ${q.qoldiq===0?"yopilgan":q.qoldiq<q.summa?"qisman":""}`}>{q.qoldiq===0?"Yopilgan":q.qoldiq<q.summa?"Qisman":"Kutilmoqda"}</span></td><td>{q.qoldiq>0?<button className="kichik-tugma" onClick={()=>{setTanlangan(q);setModal("tolov");}}>To‘lov kiritish</button>:<span className="yashil-matn"><Check size={15}/> Yakunlangan</span>}</td></tr>)}</tbody></table>{!yuklanmoqda&&topQarzlar.length===0&&<Empty matn={qidiruv?"Qarz topilmadi.":"Hozircha qarz yo‘q. Avval mijoz qo‘shing."}/>}</div></section>}
        {sahifa==="AI yordamchi"&&<section className="ai-sahifa"><div className="ai-sarlavha"><div className="ai-katta-belgi"><Bot size={29}/></div><div><span className="kichik-badge"><Sparkles size={13}/> QARZDAFTAR AI</span><h2>Qanday yordam bera olaman?</h2><p>Qarzlaringiz statistikasi yoki dasturdan foydalanish haqida so‘rang.</p></div></div><div className="chat-oyna">{chat.map((m,i)=><div key={i} className={`chat-qator ${m.kim==="siz"?"meniki":""}`}><div className="chat-avatar">{m.kim==="ai"?<Bot size={18}/>:<User size={18}/>}</div><div className="chat-pufak">{m.matn}</div></div>)}</div><div className="namuna-savollar"><span>TEZKOR SAVOLLAR</span><div>{["Jami qarz qancha?","Nechta mijoz bor?","Eng katta qarz qaysi?","Qanday to‘lov kiritaman?"].map(s=><button key={s} onClick={()=>{setSavol(s);setChat(old=>[...old,{kim:"siz",matn:s},{kim:"ai",matn:mahalliyAI(s,mijozlar,qarzlar)}]);setSavol("");}}>{s}<ArrowRight size={14}/></button>)}</div></div><form className="chat-kiritish" onSubmit={aiYubor}><input value={savol} onChange={e=>setSavol(e.target.value)} placeholder="Savolingizni shu yerga yozing..." aria-label="AI savoli"/><button type="submit" disabled={!savol.trim()}><Send size={18}/> Yuborish</button></form><p className="ai-cheklov"><ShieldCheck size={15}/> Hozirgi yordamchi ilova ma’lumotlari va qo‘llanma asosida ishlaydi. Umumiy savollarga AI javobi uchun alohida AI API va backend kerak.</p></section>}
      </section>
    </main>
    {modal&&<div className="modal-orqa" onClick={modalniYop}><section className="modal" onClick={e=>e.stopPropagation()}><div className="modal-sarlavha"><div><h2>{modal==="mijoz"?"Yangi mijoz":modal==="qarz"?"Yangi qarz":"To‘lov kiritish"}</h2><p>{modal==="mijoz"?"Mijoz ma’lumotlari serverga saqlanadi.":modal==="qarz"?"Qarz mavjud mijozga biriktiriladi.":`Qarz #${tanlangan?.id} uchun to‘lov`}</p></div><button className="yopish-modal" onClick={modalniYop}><X/></button></div>
      {modal==="mijoz"&&<form onSubmit={mijozSaqlash}><label>To‘liq ism *<input required value={ism} onChange={e=>setIsm(e.target.value)} placeholder="Ali Valiyev"/></label><label>Telefon raqami<input value={telefon} onChange={e=>setTelefon(e.target.value)} placeholder="+998 90 123 45 67"/></label><label>Manzil<input value={manzil} onChange={e=>setManzil(e.target.value)} placeholder="Manzil"/></label><label>Izoh<input value={mijozIzoh} onChange={e=>setMijozIzoh(e.target.value)} placeholder="Qo‘shimcha ma’lumot"/></label><ModalButtons band={band} yop={modalniYop} matn="Mijozni saqlash"/></form>}
      {modal==="qarz"&&<form onSubmit={qarzSaqlash}><label>Mijoz *</label><select required value={mijozID} onChange={e=>setMijozID(e.target.value)}><option value="">Mijozni tanlang</option>{mijozlar.map(m=><option key={m.id} value={m.id}>{m.ism} {m.telefon?`— ${m.telefon}`:""}</option>)}</select>{mijozlar.length===0&&<p className="form-eslatma">Avval mijoz qo‘shing.</p>}<label>Qarz summasi (so‘m) *<input required type="number" min="1" step="1" value={qarzSumma} onChange={e=>setQarzSumma(e.target.value)} placeholder="500000"/></label><label>Izoh<input value={qarzIzoh} onChange={e=>setQarzIzoh(e.target.value)} placeholder="Qarz haqida izoh"/></label><ModalButtons band={band||mijozlar.length===0} yop={modalniYop} matn="Qarzni saqlash"/></form>}
      {modal==="tolov"&&tanlangan&&<form onSubmit={tolovSaqlash}><div className="qarz-eslatma"><span>{tanlangan.mijoz_ismi}</span><strong>Qoldiq: {pul(tanlangan.qoldiq)}</strong></div><label>To‘lov summasi (so‘m) *<input required type="number" min="1" max={tanlangan.qoldiq} step="1" value={tolovSumma} onChange={e=>setTolovSumma(e.target.value)} placeholder="100000"/></label><label>Izoh<input value={tolovIzoh} onChange={e=>setTolovIzoh(e.target.value)} placeholder="To‘lov haqida izoh"/></label><ModalButtons band={band} yop={modalniYop} matn="To‘lovni saqlash"/></form>}
    </section></div>}
  </div>;
}

function Stat({nom,qiymat,icon:Icon,rang,past}:{nom:string;qiymat:string;icon:typeof Wallet;rang:string;past:string}) {
  return <article className="stat-karta"><div className={`stat-icon ${rang}`}><Icon size={21}/></div><span className="stat-nom">{nom}</span><strong>{qiymat}</strong><small>{past}</small></article>;
}
function Empty({matn}:{matn:string}) { return <div className="topilmadi"><BookOpen size={28}/><p>{matn}</p></div>; }
function ModalButtons({band,yop,matn}:{band:boolean;yop:()=>void;matn:string}) { return <div className="modal-amallar"><button type="button" className="bekor" onClick={yop}>Bekor qilish</button><button disabled={band} type="submit" className="asosiy-tugma">{band?"Saqlanmoqda...":matn}</button></div>; }
