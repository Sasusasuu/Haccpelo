import { useState, useEffect, useRef, useMemo } from "react";

// ─── DLC CONSTANTS ───
const STORAGE_KEY = "dlc_produits_terrasse";
const CATEGORIES = ["Viande","Poisson","Produits laitiers","Légumes","Fruits","Charcuterie","Épicerie","Boissons","Autre"];
const todayStr = () => new Date().toISOString().split("T")[0];
const tomorrowStr = () => { const d = new Date(); d.setDate(d.getDate()+1); return d.toISOString().split("T")[0]; };
const statusOf = (dlc) => { if (!dlc) return "ok"; if (dlc <= todayStr()) return "expire"; if (dlc <= tomorrowStr()) return "urgent"; return "ok"; };
const fmtDate = (d) => { if (!d) return "—"; const [y,m,j] = d.split("-"); return `${j}/${m}/${y}`; };
// FIX #1 : fonction pour que les dates soient toujours fraîches
const makeDefaultForm = () => ({ nom: "", categorie: "Viande", fab: todayStr(), dlc: todayStr(), quantite: "" });

// ─── PLANNING CONSTANTS ───
const EMPLOYEES_DEFAULT = ["Alice","Bruno","Clara","David","Emma"];
const DAYS = ["Lun","Mar","Mer","Jeu","Ven","Sam","Dim"];
const MANAGER_PIN_DEFAULT = "1234";
const SLOT_COLORS = ["#1D9E75","#378ADD","#D85A30","#7F77DD","#BA7517"];

// FIX #8 : ID unique — Date.now()+di pouvait collisionner
const genId = () => `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;

// FIX #7 : sécuriser les clés contre les noms contenant "|"
const safeKey = (s) => String(s).replace(/\|/g, "_");

// FIX #2 : weekKey inclut l'année → pas de collision entre 2026 et 2027
const makeWeekKey = (dates) => `${fmtShort(dates[0])}-${dates[0].getFullYear()}`;

// FIX #3 : hash djb2 — PIN stocké haché, pas en clair
function hashPin(pin) {
  let h = 5381;
  for (let i = 0; i < pin.length; i++) h = (h * 33) ^ pin.charCodeAt(i);
  return (h >>> 0).toString(16);
}

function getWeekDates(offset = 0) {
  const now = new Date();
  const day = now.getDay();
  const diff = (day === 0 ? -6 : 1 - day) + offset * 7;
  const mon = new Date(now);
  mon.setDate(now.getDate() + diff);
  return Array.from({ length: 7 }, (_, i) => { const d = new Date(mon); d.setDate(mon.getDate() + i); return d; });
}

const fmtShort = (d) => d.toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit" });
const fmtTime = (ts) => { if (!ts) return "--:--"; return new Date(ts).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" }); };
const diffH = (a, b) => { if (!a || !b) return 0; return (b - a) / 3600000; };
const fmtDuration = (hours) => { const t = Math.floor(hours * 60); const h = Math.floor(t / 60); const m = t % 60; if (h === 0) return `${m}min`; return m === 0 ? `${h}h` : `${h}h ${m}min`; };

function load(key, def) {
  try { return JSON.parse(localStorage.getItem(key)) ?? def; } catch { return def; }
}

// ─── SHARED STYLES ───
const inp = { width: "100%", padding: "8px 10px", border: "1px solid #d0d0d0", borderRadius: 8, background: "white", color: "#111", fontSize: 14, boxSizing: "border-box" };
const lbl = { fontSize: 13, color: "#555", marginBottom: 4, display: "block" };
const btnP = { background: "#111", color: "white", border: "none", borderRadius: 8, padding: "8px 18px", fontSize: 14, cursor: "pointer", fontWeight: 500 };
const btnS = { background: "transparent", color: "#111", border: "1px solid #d0d0d0", borderRadius: 8, padding: "8px 18px", fontSize: 14, cursor: "pointer" };

// ══ MODULE DLC ══
function DLCModule() {
  const [produits, setProduits] = useState([]);
  const [form, setForm] = useState(makeDefaultForm);
  const [editId, setEditId] = useState(null);
  const [view, setView] = useState("liste");
  const [etiquette, setEtiquette] = useState(null);
  const [filtre, setFiltre] = useState("tous");
  const [search, setSearch] = useState("");
  const [confirmDelete, setConfirmDelete] = useState(null);

  useEffect(() => {
    try {
      const s = window.storage;
      if (s) s.get(STORAGE_KEY).then(r => { if (r?.value) setProduits(JSON.parse(r.value)); }).catch(e => console.error("storage.get failed:", e));
    } catch (e) { console.error("storage unavailable:", e); }
  }, []);

  const saveProduits = (list) => {
    setProduits(list);
    try {
      if (window.storage) window.storage.set(STORAGE_KEY, JSON.stringify(list)).catch(e => console.error("storage.set failed:", e));
    } catch (e) { console.error("storage unavailable:", e); }
  };

  const handleSubmit = () => {
    if (!form.nom || !form.dlc) return;
    let list;
    if (editId !== null) {
      list = produits.map(p => p.id === editId ? { ...form, id: editId } : p);
      setEditId(null);
    } else {
      list = [...produits, { ...form, id: genId() }];
    }
    saveProduits(list);
    setForm(makeDefaultForm());
    setView("liste");
  };

  const filtered = useMemo(() =>
    produits.filter(p => {
      const st = statusOf(p.dlc);
      const matchF = filtre === "tous" || (filtre === "alerte" && (st === "expire" || st === "urgent")) || (filtre === "ok" && st === "ok");
      const matchS = p.nom.toLowerCase().includes(search.toLowerCase()) || p.categorie.toLowerCase().includes(search.toLowerCase());
      return matchF && matchS;
    }).sort((a, b) => (a.dlc || "").localeCompare(b.dlc || ""))
  , [produits, filtre, search]);

  const nbAlerte = useMemo(() =>
    produits.filter(p => { const s = statusOf(p.dlc); return s === "expire" || s === "urgent"; }).length
  , [produits]);

  const statusStyle = (dlc) => {
    const s = statusOf(dlc);
    if (s === "expire") return { bg: "#fee2e2", color: "#dc2626", label: "Expiré / Aujourd'hui" };
    if (s === "urgent") return { bg: "#fef9c3", color: "#92400e", label: "Demain" };
    return { bg: "#dcfce7", color: "#16a34a", label: "OK" };
  };

  return (
    <div>
      {view !== "etiquette" && (
        <div className="no-print" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "1.25rem" }}>
          <div style={{ fontSize: 15, fontWeight: 500, color: "#111" }}>
            Produits {nbAlerte > 0 && <span style={{ background: "#fee2e2", color: "#dc2626", fontSize: 12, fontWeight: 500, padding: "2px 9px", borderRadius: 20, marginLeft: 8 }}>{nbAlerte} alerte{nbAlerte > 1 ? "s" : ""}</span>}
          </div>
          <button style={btnP} onClick={() => { setForm(makeDefaultForm()); setEditId(null); setView("ajouter"); }}>+ Ajouter</button>
        </div>
      )}
      {view === "liste" && (
        <DLCListView
          filtered={filtered} produits={produits} nbAlerte={nbAlerte}
          filtre={filtre} setFiltre={setFiltre} search={search} setSearch={setSearch}
          statusStyle={statusStyle}
          onEdit={(p) => { setForm({ nom: p.nom, categorie: p.categorie, dlc: p.dlc, quantite: p.quantite || "", fab: p.fab || todayStr() }); setEditId(p.id); setView("ajouter"); }}
          onEtiquette={(p) => { setEtiquette(p); setView("etiquette"); }}
          onDelete={(p) => setConfirmDelete(p)}
        />
      )}
      {view === "ajouter" && (
        <DLCAddForm form={form} setForm={setForm} editId={editId}
          onSubmit={handleSubmit}
          onCancel={() => { setView("liste"); setEditId(null); setForm(makeDefaultForm()); }}
        />
      )}
      {view === "etiquette" && etiquette && <EtiquetteView etiquette={etiquette} onBack={() => setView("liste")} />}
      {confirmDelete && (
        <ConfirmDeleteModal
          product={confirmDelete}
          onConfirm={() => { saveProduits(produits.filter(p => p.id !== confirmDelete.id)); setConfirmDelete(null); }}
          onCancel={() => setConfirmDelete(null)}
        />
      )}
    </div>
  );
}

function DLCListView({ filtered, produits, nbAlerte, filtre, setFiltre, search, setSearch, statusStyle, onEdit, onEtiquette, onDelete }) {
  return (
    <div>
      <div className="no-print" style={{ display: "flex", gap: 8, marginBottom: "1rem", flexWrap: "wrap" }}>
        <input style={{ ...inp, maxWidth: 200 }} placeholder="Rechercher..." value={search} onChange={e => setSearch(e.target.value)} />
        <div style={{ display: "flex", gap: 4 }}>
          {[["tous", `Tous (${produits.length})`], ["alerte", `Alertes (${nbAlerte})`], ["ok", "OK"]].map(([f, label]) => (
            <button key={f} onClick={() => setFiltre(f)} style={{ ...btnS, padding: "6px 14px", fontWeight: filtre === f ? 500 : 400, background: filtre === f ? "#f0f0f0" : "transparent", fontSize: 13 }}>{label}</button>
          ))}
        </div>
      </div>
      {filtered.length === 0 ? (
        <div style={{ textAlign: "center", padding: "3rem 0", color: "#888", fontSize: 14 }}>
          Aucun produit{produits.length > 0 ? " correspondant" : " — cliquez sur + Ajouter"}
        </div>
      ) : (
        <div style={{ border: "1px solid #e5e5e5", borderRadius: 10, overflow: "hidden" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14, tableLayout: "fixed" }}>
            <thead>
              <tr style={{ background: "#fafafa", borderBottom: "1px solid #e5e5e5" }}>
                {[["Produit","28%"],["Catégorie","20%"],["DLC","18%"],["Statut","16%"]].map(([h, w]) => (
                  <th key={h} style={{ padding: "10px 10px", textAlign: "left", fontWeight: 500, fontSize: 12, color: "#888", width: w }}>{h}</th>
                ))}
                <th className="no-print" style={{ padding: "10px 8px", textAlign: "right", fontWeight: 500, fontSize: 12, color: "#888", width: "18%" }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((p, i) => {
                const st = statusStyle(p.dlc);
                return (
                  <tr key={p.id} className="row-hover" style={{ borderBottom: i < filtered.length - 1 ? "1px solid #f0f0f0" : "none" }}>
                    <td style={{ padding: "10px 10px", fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.nom}</td>
                    <td style={{ padding: "10px 8px", fontSize: 13, color: "#666" }}>{p.categorie}</td>
                    <td style={{ padding: "10px 8px", fontFamily: "monospace", fontSize: 13 }}>{fmtDate(p.dlc)}</td>
                    <td style={{ padding: "10px 8px" }}>
                      <span style={{ background: st.bg, color: st.color, fontSize: 11, fontWeight: 500, padding: "2px 8px", borderRadius: 20, whiteSpace: "nowrap" }}>{st.label}</span>
                    </td>
                    <td className="no-print" style={{ padding: "8px 8px", textAlign: "right" }}>
                      <div style={{ display: "flex", gap: 4, justifyContent: "flex-end" }}>
                        <button onClick={() => onEtiquette(p)} style={{ ...btnS, padding: "4px 8px", fontSize: 12 }}>Étiq.</button>
                        <button onClick={() => onEdit(p)} style={{ ...btnS, padding: "4px 8px", fontSize: 12 }}>Édit.</button>
                        <button onClick={() => onDelete(p)} style={{ ...btnS, padding: "4px 8px", fontSize: 12, color: "#dc2626", borderColor: "#fca5a5" }}>Supp.</button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function DLCAddForm({ form, setForm, editId, onSubmit, onCancel }) {
  return (
    <div style={{ background: "white", border: "1px solid #e5e5e5", borderRadius: 10, padding: "1.25rem" }}>
      <div style={{ fontSize: 16, fontWeight: 600, marginBottom: "1.25rem" }}>{editId !== null ? "Modifier le produit" : "Nouveau produit"}</div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 12 }}>
        <div style={{ gridColumn: "1 / -1" }}>
          <label style={lbl}>Nom du produit *</label>
          <input style={inp} value={form.nom} onChange={e => setForm({ ...form, nom: e.target.value })} placeholder="Ex: Filet de bœuf" />
        </div>
        <div>
          <label style={lbl}>Catégorie</label>
          <select style={inp} value={form.categorie} onChange={e => setForm({ ...form, categorie: e.target.value })}>
            {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
        <div>
          <label style={lbl}>Date de fabrication</label>
          <input type="date" style={inp} value={form.fab} onChange={e => setForm({ ...form, fab: e.target.value })} />
        </div>
        <div>
          <label style={lbl}>Quantité</label>
          <input style={inp} type="number" value={form.quantite} onChange={e => setForm({ ...form, quantite: e.target.value })} placeholder="0" />
        </div>
        <div>
          <label style={lbl}>Date DLC *</label>
          <input type="date" style={inp} value={form.dlc} onChange={e => setForm({ ...form, dlc: e.target.value })} />
        </div>
      </div>
      <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: "1rem" }}>
        <button style={btnS} onClick={onCancel}>Annuler</button>
        <button style={btnP} onClick={onSubmit} disabled={!form.nom || !form.dlc}>{editId !== null ? "Enregistrer" : "Ajouter"}</button>
      </div>
    </div>
  );
}

function EtiquetteView({ etiquette, onBack }) {
  return (
    <div>
      <div className="no-print" style={{ marginBottom: "1rem", display: "flex", gap: 8 }}>
        <button style={btnS} onClick={onBack}>← Retour</button>
        <button style={btnP} onClick={() => window.print()}>Imprimer</button>
      </div>
      <div style={{ display: "flex", justifyContent: "center" }}>
        <div style={{ width: 280, border: "2px solid #000", borderRadius: 4, padding: "16px", textAlign: "center", fontFamily: "monospace", background: "white", color: "#000" }}>
          <div style={{ fontSize: 11, letterSpacing: 2, marginBottom: 8, textTransform: "uppercase", borderBottom: "1px solid #000", paddingBottom: 6 }}>Holding NHA</div>
          <div style={{ fontSize: 20, fontWeight: 700, margin: "10px 0" }}>{etiquette.nom}</div>
          <div style={{ fontSize: 13, marginBottom: 6 }}>{etiquette.categorie}</div>
          {etiquette.quantite && <div style={{ fontSize: 13, marginBottom: 8 }}>{etiquette.quantite}</div>}
          <div style={{ borderTop: "1px solid #000", paddingTop: 8, marginTop: 8 }}>
            <div style={{ fontSize: 11, marginBottom: 2 }}>DATE DE FABRICATION</div>
            <div style={{ fontSize: 18, fontWeight: 700 }}>{fmtDate(etiquette.fab)}</div>
          </div>
          <div style={{ borderTop: "1px solid #000", paddingTop: 8, marginTop: 8 }}>
            <div style={{ fontSize: 11, marginBottom: 2 }}>DATE LIMITE DE CONSOMMATION</div>
            <div style={{ fontSize: 22, fontWeight: 700 }}>{fmtDate(etiquette.dlc)}</div>
          </div>
        </div>
      </div>
    </div>
  );
}

function ConfirmDeleteModal({ product, onConfirm, onCancel }) {
  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 100 }}>
      <div style={{ background: "white", border: "1px solid #e5e5e5", borderRadius: 12, padding: "1.5rem", maxWidth: 320, width: "90%", textAlign: "center" }}>
        <div style={{ fontSize: 15, fontWeight: 600, marginBottom: "1rem" }}>Supprimer ce produit ?</div>
        <div style={{ border: "2px solid #000", borderRadius: 4, padding: "12px", fontFamily: "monospace", background: "white", color: "#000", marginBottom: "1.25rem", display: "inline-block", minWidth: 200 }}>
          <div style={{ fontSize: 9, letterSpacing: 2, marginBottom: 6, borderBottom: "1px solid #000", paddingBottom: 4 }}>Holding NHA</div>
          <div style={{ fontSize: 15, fontWeight: 700, margin: "6px 0" }}>{product.nom}</div>
          <div style={{ fontSize: 11 }}>{product.categorie}</div>
          <div style={{ borderTop: "1px solid #000", paddingTop: 6, marginTop: 6 }}>
            <div style={{ fontSize: 9 }}>DLC</div>
            <div style={{ fontSize: 15, fontWeight: 700 }}>{fmtDate(product.dlc)}</div>
          </div>
        </div>
        <div style={{ display: "flex", gap: 8, justifyContent: "center" }}>
          <button style={btnS} onClick={onCancel}>Annuler</button>
          <button style={{ ...btnP, background: "#dc2626" }} onClick={onConfirm}>Supprimer</button>
        </div>
      </div>
    </div>
  );
}

// ══ MODULE ÉQUIPE ══
function EquipeModule({ onSignOut }) {
  const [planTab, setPlanTab] = useState("planning");
  const [weekOffset, setWeekOffset] = useState(0);
  const [slots, setSlots] = useState(() => load("slots", {}));
  const [pointages, setPointages] = useState(() => load("pointages", {}));
  const [employees, setEmployees] = useState(() => load("employees", EMPLOYEES_DEFAULT));
  const [managerPinHash, setManagerPinHash] = useState(() => {
    // Migration depuis l'ancienne clé plaintext si elle existe
    const legacy = load("managerPin", null);
    if (legacy) {
      const h = hashPin(legacy);
      localStorage.removeItem("managerPin");
      localStorage.setItem("managerPinHash", JSON.stringify(h));
      return h;
    }
    return load("managerPinHash", hashPin(MANAGER_PIN_DEFAULT));
  });
  const [contractHours, setContractHours] = useState(() => load("contractHours", {}));

  const dates = useMemo(() => getWeekDates(weekOffset), [weekOffset]);
  const weekKey = useMemo(() => makeWeekKey(dates), [dates]);

  useEffect(() => { localStorage.setItem("slots", JSON.stringify(slots)); }, [slots]);
  useEffect(() => { localStorage.setItem("pointages", JSON.stringify(pointages)); }, [pointages]);
  useEffect(() => { localStorage.setItem("employees", JSON.stringify(employees)); }, [employees]);
  useEffect(() => { localStorage.setItem("managerPinHash", JSON.stringify(managerPinHash)); }, [managerPinHash]);
  useEffect(() => { localStorage.setItem("contractHours", JSON.stringify(contractHours)); }, [contractHours]);

  const verifyPin = (pin) => hashPin(pin) === managerPinHash;
  const changePin = (newPin) => setManagerPinHash(hashPin(newPin));
  const planBtnStyle = (active) => ({ padding: "6px 16px", borderRadius: 8, fontSize: 14, background: active ? "#EFF6FF" : "white", color: active ? "#1D4ED8" : "#555", border: active ? "1.5px solid #BFDBFE" : "1px solid #d0d0d0", cursor: "pointer", fontWeight: active ? 600 : 400 });

  return (
    <div>
      <div style={{ display: "flex", gap: 8, marginBottom: "1.5rem" }}>
        {[["planning","Planning"],["pointeuse","Pointeuse"],["parametres","Paramètres"]].map(([t, l]) => (
          <button key={t} onClick={() => setPlanTab(t)} style={planBtnStyle(planTab === t)}>{l}</button>
        ))}
      </div>
      {planTab === "planning" && <PlanningTab dates={dates} weekOffset={weekOffset} setWeekOffset={setWeekOffset} weekKey={weekKey} slots={slots} setSlots={setSlots} employees={employees} contractHours={contractHours} />}
      {planTab === "pointeuse" && <PointeuseTab employees={employees} pointages={pointages} setPointages={setPointages} verifyPin={verifyPin} />}
      {planTab === "parametres" && <ParametresTab employees={employees} setEmployees={setEmployees} contractHours={contractHours} setContractHours={setContractHours} verifyPin={verifyPin} changePin={changePin} />}
    </div>
  );
}

function CalendarPopup({ calMonth, setCalMonth, weekOffset, setWeekOffset, setCalOpen }) {
  const MOIS = ["Janvier","Février","Mars","Avril","Mai","Juin","Juillet","Août","Septembre","Octobre","Novembre","Décembre"];
  function getWeekOffsetFromDate(d) {
    const now = new Date(); const curMon = new Date(now); const day = now.getDay();
    curMon.setDate(now.getDate() + (day === 0 ? -6 : 1 - day)); curMon.setHours(0,0,0,0);
    const clickMon = new Date(d); const cd = d.getDay();
    clickMon.setDate(d.getDate() + (cd === 0 ? -6 : 1 - cd)); clickMon.setHours(0,0,0,0);
    return Math.round((clickMon - curMon) / (7 * 86400000));
  }
  const y = calMonth.getFullYear(), mo = calMonth.getMonth();
  const first = new Date(y, mo, 1), fd = first.getDay() === 0 ? 6 : first.getDay() - 1;
  const dim = new Date(y, mo + 1, 0).getDate();
  const cells = [];
  for (let i = 0; i < fd; i++) cells.push(null);
  for (let i = 1; i <= dim; i++) cells.push(new Date(y, mo, i));
  const weeks = [];
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));
  return (
    <div style={{ position: "absolute", top: "calc(100% + 6px)", left: 0, zIndex: 200, background: "white", border: "1px solid #d0d0d0", borderRadius: 10, padding: "12px", minWidth: 260, boxShadow: "0 4px 16px rgba(0,0,0,0.12)" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
        <button onClick={() => setCalMonth(m => new Date(m.getFullYear(), m.getMonth()-1, 1))} style={{ background: "transparent", border: "none", cursor: "pointer", fontSize: 16, padding: "2px 6px" }}>‹</button>
        <span style={{ fontSize: 13, fontWeight: 500 }}>{MOIS[calMonth.getMonth()]} {calMonth.getFullYear()}</span>
        <button onClick={() => setCalMonth(m => new Date(m.getFullYear(), m.getMonth()+1, 1))} style={{ background: "transparent", border: "none", cursor: "pointer", fontSize: 16, padding: "2px 6px" }}>›</button>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 2, marginBottom: 4 }}>
        {["L","M","M","J","V","S","D"].map((d, i) => <span key={i} style={{ textAlign: "center", fontSize: 11, color: "#aaa", fontWeight: 500 }}>{d}</span>)}
      </div>
      {weeks.map((week, wi) => {
        const firstReal = week.find(d => d !== null);
        const isSel = firstReal && getWeekOffsetFromDate(firstReal) === weekOffset;
        return (
          <div key={wi} onClick={() => { if (firstReal) { setWeekOffset(getWeekOffsetFromDate(firstReal)); setCalOpen(false); } }}
            style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 2, marginBottom: 2, borderRadius: 6, background: isSel ? "#EFF6FF" : "transparent", cursor: "pointer", padding: "1px 0" }}>
            {week.map((d, di) => (
              <span key={di} style={{ textAlign: "center", fontSize: 12, padding: "4px 2px", borderRadius: 4, color: d ? (isSel ? "#1D4ED8" : "#111") : "transparent" }}>
                {d ? d.getDate() : ""}
              </span>
            ))}
          </div>
        );
      })}
    </div>
  );
}

function WeekTotalCell({ worked, contract }) {
  const over = contract && worked > contract;
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 2 }}>
      <span style={{ color: over ? "#dc2626" : "#1D4ED8", fontWeight: over ? 700 : 500 }}>{worked}h</span>
      {contract && <span style={{ fontSize: 10, color: over ? "#dc2626" : "#aaa" }}>{over ? `⚠️ +${(worked - contract).toFixed(1)}h` : `/ ${contract}h`}</span>}
    </div>
  );
}

function SlotModal({ modal, dates, slotForm, setSlotForm, onConfirm, onCancel }) {
  function calcSlotMinutes(start, end) {
    const [sh, sm] = start.split(":").map(Number);
    const [eh, em] = end.split(":").map(Number);
    let diff = eh * 60 + em - (sh * 60 + sm);
    if (diff <= 0) diff += 24 * 60;
    return diff;
  }
  const diff = calcSlotMinutes(slotForm.start, slotForm.end);
  const h = Math.floor(diff / 60), m = diff % 60;
  const over = diff > 720;
  const durationLabel = `${h > 0 ? `${h}h` : ""}${m > 0 ? `${m}min` : ""}`;
  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 100 }}>
      <div style={{ background: "white", borderRadius: 12, border: "1px solid #e5e5e5", padding: "2rem", width: 360, boxShadow: "0 8px 32px rgba(0,0,0,0.18)" }}>
        <h3 style={{ margin: "0 0 6px", fontSize: 17, fontWeight: 700, color: "#111" }}>Ajouter un créneau</h3>
        <p style={{ margin: "0 0 24px", fontSize: 13, color: "#888" }}>{modal.emp} · {DAYS[modal.dayIdx]} {fmtShort(dates[modal.dayIdx])}</p>
        <div style={{ display: "flex", gap: 16, marginBottom: 28 }}>
          {[["start","🕐 Début"],["end","🕐 Fin"]].map(([k, l]) => (
            <div key={k} style={{ flex: 1 }}>
              <label style={{ fontSize: 13, fontWeight: 500, color: "#444", display: "block", marginBottom: 8 }}>{l}</label>
              <input type="time" value={slotForm[k]} onChange={e => setSlotForm({ ...slotForm, [k]: e.target.value })} style={{ width: "100%", padding: "12px 10px", borderRadius: 8, border: "1px solid #d0d0d0", background: "white", color: "#111", fontSize: 22, fontWeight: 700, textAlign: "center", boxSizing: "border-box", cursor: "pointer" }} />
            </div>
          ))}
        </div>
        <div style={{ background: "#f5f5f5", borderRadius: 8, padding: "10px 14px", marginBottom: 20, textAlign: "center" }}>
          <span style={{ fontSize: 15, fontWeight: 500, color: "#333" }}>
            {slotForm.start} → {slotForm.end}
            <span style={{ marginLeft: 10, fontSize: 13, color: over ? "#dc2626" : "#777" }}>({durationLabel}){over ? " ⚠️" : ""}</span>
          </span>
        </div>
        <div style={{ marginBottom: 20 }}>
          <p style={{ margin: "0 0 8px", fontSize: 12, fontWeight: 500, color: "#555" }}>Reproduire sur :</p>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
            {DAYS.map((day, i) => {
              if (i === modal.dayIdx) return null;
              const selected = (slotForm.copyDays || []).includes(i);
              return (
                <button key={i} onClick={() => {
                  const cur = slotForm.copyDays || [];
                  setSlotForm({ ...slotForm, copyDays: selected ? cur.filter(d => d !== i) : [...cur, i] });
                }} style={{ padding: "5px 11px", borderRadius: 20, fontSize: 12, fontWeight: 500, background: selected ? "#2563eb" : "white", color: selected ? "white" : "#555", border: selected ? "1.5px solid #2563eb" : "1px solid #d0d0d0", cursor: "pointer" }}>
                  {day}
                </button>
              );
            })}
          </div>
        </div>
        <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
          <button onClick={onCancel} style={{ padding: "10px 20px", borderRadius: 8, border: "1px solid #d0d0d0", background: "white", cursor: "pointer", fontSize: 14, color: "#555", fontWeight: 500 }}>Annuler</button>
          <button onClick={onConfirm} style={{ padding: "10px 24px", borderRadius: 8, border: "1.5px solid #2563eb", background: "#2563eb", cursor: "pointer", fontSize: 14, fontWeight: 700, color: "white" }}>Ajouter</button>
        </div>
      </div>
    </div>
  );
}

function PlanningTab({ dates, weekOffset, setWeekOffset, weekKey, slots, setSlots, employees, contractHours }) {
  const [calOpen, setCalOpen] = useState(false);
  const [calMonth, setCalMonth] = useState(() => { const d = new Date(); return new Date(d.getFullYear(), d.getMonth(), 1); });
  const [modal, setModal] = useState(null);
  const [slotForm, setSlotForm] = useState({ start: "10:00", end: "15:00", copyDays: [] });

  function calcSlotMinutes(start, end) {
    const [sh, sm] = start.split(":").map(Number);
    const [eh, em] = end.split(":").map(Number);
    let diff = eh * 60 + em - (sh * 60 + sm);
    if (diff <= 0) diff += 24 * 60;
    return diff;
  }

  const weekHours = useMemo(() => {
    const result = {};
    employees.forEach(emp => {
      let total = 0;
      dates.forEach((_, i) => {
        (slots[`${weekKey}|${safeKey(emp)}|${i}`] || []).forEach(s => { total += calcSlotMinutes(s.start, s.end) / 60; });
      });
      result[emp] = total.toFixed(1);
    });
    return result;
  }, [slots, employees, dates, weekKey]);

  function addSlot() {
    if (!modal) return;
    const { emp, dayIdx } = modal;
    const newSlots = { ...slots };
    const mainKey = `${weekKey}|${safeKey(emp)}|${dayIdx}`;
    newSlots[mainKey] = [...(newSlots[mainKey] || []), { start: slotForm.start, end: slotForm.end, id: genId() }];
    (slotForm.copyDays || []).forEach(di => {
      const k = `${weekKey}|${safeKey(emp)}|${di}`;
      newSlots[k] = [...(newSlots[k] || []), { start: slotForm.start, end: slotForm.end, id: genId() }];
    });
    setSlots(newSlots);
    setModal(null);
  }

  return (
    <div>
      <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 8, marginBottom: 16, position: "relative" }}>
        <button onClick={() => setWeekOffset(w => w - 1)} style={{ padding: "4px 12px", borderRadius: 8, border: "1px solid #d0d0d0", background: "transparent", cursor: "pointer", color: "#111" }}>‹</button>
        <span onClick={() => { setCalOpen(o => !o); setCalMonth(new Date(dates[0].getFullYear(), dates[0].getMonth(), 1)); }}
          style={{ fontSize: 14, fontWeight: 500, cursor: "pointer", padding: "4px 10px", borderRadius: 8, border: "1px solid #d0d0d0", userSelect: "none" }}>
          Semaine du {fmtShort(dates[0])} au {fmtShort(dates[6])} ▾
        </span>
        <button onClick={() => setWeekOffset(w => w + 1)} style={{ padding: "4px 12px", borderRadius: 8, border: "1px solid #d0d0d0", background: "transparent", cursor: "pointer", color: "#111" }}>›</button>
        <button onClick={() => { setWeekOffset(0); setCalOpen(false); }} style={{ padding: "4px 10px", borderRadius: 8, border: "1px solid #d0d0d0", background: "transparent", cursor: "pointer", fontSize: 12, color: "#888" }}>Aujourd'hui</button>
        {calOpen && <CalendarPopup calMonth={calMonth} setCalMonth={setCalMonth} weekOffset={weekOffset} setWeekOffset={setWeekOffset} setCalOpen={setCalOpen} />}
      </div>
      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", tableLayout: "fixed" }}>
          <colgroup><col style={{ width: 90 }} />{dates.map((_, i) => <col key={i} />)}<col style={{ width: 64 }} /></colgroup>
          <thead>
            <tr>
              <th style={{ fontSize: 12, fontWeight: 500, color: "#888", textAlign: "left", padding: "6px 8px", borderBottom: "1px solid #e5e5e5" }}>Employé</th>
              {dates.map((d, i) => (
                <th key={i} style={{ fontSize: 12, fontWeight: 500, color: "#888", textAlign: "center", padding: "6px 4px", borderBottom: "1px solid #e5e5e5" }}>
                  {DAYS[i]}<br /><span style={{ fontWeight: 400 }}>{fmtShort(d)}</span>
                </th>
              ))}
              <th style={{ fontSize: 12, fontWeight: 500, color: "#888", textAlign: "center", padding: "6px 4px", borderBottom: "1px solid #e5e5e5" }}>Total</th>
            </tr>
          </thead>
          <tbody>
            {employees.map((emp, ei) => (
              <tr key={emp} style={{ background: ei % 2 === 0 ? "white" : "#fafafa" }}>
                <td style={{ fontSize: 13, fontWeight: 500, padding: "8px 8px" }}>{emp}</td>
                {dates.map((_, dayIdx) => {
                  const slotKey = `${weekKey}|${safeKey(emp)}|${dayIdx}`;
                  const daySlots = slots[slotKey] || [];
                  return (
                    <td key={dayIdx} style={{ padding: "4px", verticalAlign: "top", borderLeft: "1px solid #f0f0f0" }}>
                      {daySlots.map(s => (
                        <div key={s.id} style={{ background: SLOT_COLORS[ei % SLOT_COLORS.length] + "22", border: `1px solid ${SLOT_COLORS[ei % SLOT_COLORS.length]}`, borderRadius: 4, padding: "2px 4px", marginBottom: 2, fontSize: 11, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 4 }}>
                          <span>{s.start}–{s.end}</span>
                          <span onClick={() => setSlots({ ...slots, [slotKey]: (slots[slotKey] || []).filter(sl => sl.id !== s.id) })} style={{ cursor: "pointer", color: "#aaa", fontSize: 10 }}>✕</span>
                        </div>
                      ))}
                      <div onClick={() => { setModal({ emp, dayIdx }); setSlotForm({ start: "10:00", end: "15:00", copyDays: [] }); }} style={{ fontSize: 11, color: "#bbb", cursor: "pointer", textAlign: "center", padding: "2px 0" }}>+ ajouter</div>
                    </td>
                  );
                })}
                <td style={{ textAlign: "center", fontSize: 13, fontWeight: 500, borderLeft: "1px solid #e5e5e5", padding: "8px 4px" }}>
                  <WeekTotalCell worked={parseFloat(weekHours[emp])} contract={contractHours[emp]} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {modal && <SlotModal modal={modal} dates={dates} slotForm={slotForm} setSlotForm={setSlotForm} onConfirm={addSlot} onCancel={() => setModal(null)} />}
    </div>
  );
}

function PointeuseTab({ employees, pointages, setPointages, verifyPin }) {
  const [pinModal, setPinModal] = useState(null);
  const [pinInput, setPinInput] = useState("");
  const [pinError, setPinError] = useState(false);
  const pinRef = useRef();

  function openPinModal(emp) {
    const today = new Date().toDateString();
    const key = `${safeKey(emp)}|${today}`;
    const rec = pointages[key];
    const action = (!rec || rec.status === "out") ? "début de shift" : "fin de shift";
    setPinModal({ emp, action }); setPinInput(""); setPinError(false);
    setTimeout(() => pinRef.current?.focus(), 100);
  }

  function validatePin() {
    if (verifyPin(pinInput)) { doPointer(pinModal.emp); setPinModal(null); setPinInput(""); }
    else { setPinError(true); setPinInput(""); setTimeout(() => setPinError(false), 1500); }
  }

  function doPointer(emp) {
    const today = new Date().toDateString();
    const key = `${safeKey(emp)}|${today}`;
    const rec = pointages[key];
    if (!rec || rec.status === "out") {
      setPointages({ ...pointages, [key]: { status: "in", arrivalTs: Date.now(), sessions: rec?.sessions || [] } });
    } else {
      const sessions = [...(rec.sessions || []), { in: rec.arrivalTs, out: Date.now() }];
      setPointages({ ...pointages, [key]: { status: "out", sessions } });
    }
  }

  function getDayTotal(emp) {
    const today = new Date().toDateString();
    const key = `${safeKey(emp)}|${today}`;
    const rec = pointages[key];
    if (!rec) return 0;
    let total = (rec.sessions || []).reduce((a, s) => a + diffH(s.in, s.out), 0);
    if (rec.status === "in") total += diffH(rec.arrivalTs, Date.now());
    return total;
  }

  function getHistory(emp) {
    return Object.entries(pointages)
      .filter(([k]) => k.startsWith(`${safeKey(emp)}|`))
      .sort(([a], [b]) => new Date(b.split("|")[1]) - new Date(a.split("|")[1]))
      .slice(0, 5);
  }

  return (
    <div>
      <p style={{ fontSize: 13, color: "#888", marginBottom: 16 }}>
        {new Date().toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" })}
      </p>
      <div style={{ display: "grid", gap: 12 }}>
        {employees.map((emp, ei) => {
          const today = new Date().toDateString();
          const key = `${safeKey(emp)}|${today}`;
          const rec = pointages[key]; const isIn = rec?.status === "in"; const total = getDayTotal(emp);
          return (
            <div key={emp} style={{ background: "white", border: "1px solid #e5e5e5", borderRadius: 10, padding: "1rem 1.25rem" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <div style={{ width: 36, height: 36, borderRadius: "50%", background: SLOT_COLORS[ei % SLOT_COLORS.length] + "22", border: `1px solid ${SLOT_COLORS[ei % SLOT_COLORS.length]}`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, fontWeight: 600, color: SLOT_COLORS[ei % SLOT_COLORS.length] }}>{emp[0]}</div>
                  <div>
                    <p style={{ margin: 0, fontWeight: 600, fontSize: 15 }}>{emp}</p>
                    <p style={{ margin: 0, fontSize: 12, color: isIn ? "#16a34a" : "#888" }}>
                      {isIn ? `En service depuis ${fmtTime(rec.arrivalTs)}` : rec ? "Service terminé" : "Pas encore pointé"}
                    </p>
                  </div>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <div style={{ textAlign: "right" }}>
                    <p style={{ margin: 0, fontSize: 12, color: "#888" }}>Aujourd'hui</p>
                    <p style={{ margin: 0, fontSize: 15, fontWeight: 600 }}>{fmtDuration(total)}</p>
                  </div>
                  <button onClick={() => openPinModal(emp)} style={{ padding: "8px 16px", borderRadius: 8, fontSize: 13, fontWeight: 500, background: isIn ? "#fee2e2" : "#dcfce7", color: isIn ? "#dc2626" : "#16a34a", border: isIn ? "1px solid #fca5a5" : "1px solid #86efac", cursor: "pointer", whiteSpace: "nowrap" }}>
                    {isIn ? "Fin de shift" : "Début de shift"}
                  </button>
                </div>
              </div>
              {rec?.sessions?.length > 0 && (
                <div style={{ marginTop: 12, paddingTop: 10, borderTop: "1px solid #f0f0f0" }}>
                  <p style={{ margin: "0 0 6px", fontSize: 11, color: "#888" }}>Sessions du jour</p>
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                    {rec.sessions.map((s, i) => (
                      <span key={i} style={{ fontSize: 11, padding: "2px 8px", borderRadius: 20, background: "#f5f5f5", color: "#555", border: "1px solid #e5e5e5" }}>
                        {fmtTime(s.in)} → {fmtTime(s.out)} ({fmtDuration(diffH(s.in, s.out))})
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
      <div style={{ marginTop: 24 }}>
        <h3 style={{ fontSize: 15, fontWeight: 600, margin: "0 0 12px" }}>Historique (5 derniers jours)</h3>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr>{["Employé","Date","Sessions","Total"].map(h => <th key={h} style={{ textAlign: "left", padding: "6px 8px", borderBottom: "1px solid #e5e5e5", fontWeight: 500, fontSize: 12, color: "#888" }}>{h}</th>)}</tr>
            </thead>
            <tbody>
              {employees.flatMap(emp => getHistory(emp).map(([key, rec]) => {
                const date = key.split("|")[1];
                const total = (rec.sessions || []).reduce((a, s) => a + diffH(s.in, s.out), 0);
                return (
                  <tr key={key} className="row-hover">
                    <td style={{ padding: "6px 8px" }}>{emp}</td>
                    <td style={{ padding: "6px 8px", color: "#888" }}>{new Date(date).toLocaleDateString("fr-FR")}</td>
                    <td style={{ padding: "6px 8px", color: "#888" }}>{rec.sessions?.length || 0}</td>
                    <td style={{ padding: "6px 8px", fontWeight: 500 }}>{fmtDuration(total)}</td>
                  </tr>
                );
              }))}
            </tbody>
          </table>
        </div>
      </div>
      {pinModal && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 100 }}>
          <div style={{ background: "white", borderRadius: 10, border: pinError ? "1px solid #fca5a5" : "1px solid #e5e5e5", padding: "1.5rem", width: 280, transition: "border 0.2s" }}>
            <p style={{ margin: "0 0 4px", fontSize: 15, fontWeight: 600 }}>Validation manager</p>
            <p style={{ margin: "0 0 16px", fontSize: 13, color: "#888" }}>{pinModal.emp} — <strong>{pinModal.action}</strong></p>
            <input ref={pinRef} type="password" maxLength={4} value={pinInput} onChange={e => setPinInput(e.target.value)} onKeyDown={e => e.key === "Enter" && validatePin()} placeholder="Code à 4 chiffres" style={{ width: "100%", padding: "10px 12px", borderRadius: 8, border: pinError ? "1px solid #fca5a5" : "1px solid #d0d0d0", background: pinError ? "#fee2e2" : "white", color: "#111", fontSize: 20, letterSpacing: 10, textAlign: "center", boxSizing: "border-box", marginBottom: 8 }} />
            {pinError && <p style={{ margin: "0 0 8px", fontSize: 12, color: "#dc2626", textAlign: "center" }}>Code incorrect</p>}
            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 8 }}>
              <button onClick={() => setPinModal(null)} style={{ padding: "7px 16px", borderRadius: 8, border: "1px solid #d0d0d0", background: "transparent", cursor: "pointer", fontSize: 13, color: "#888" }}>Annuler</button>
              <button onClick={validatePin} style={{ padding: "7px 16px", borderRadius: 8, border: "1px solid #BFDBFE", background: "#EFF6FF", cursor: "pointer", fontSize: 13, fontWeight: 500, color: "#1D4ED8" }}>Valider</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function ParametresTab({ employees, setEmployees, contractHours, setContractHours, verifyPin, changePin }) {
  const [settingsUnlocked, setSettingsUnlocked] = useState(false);
  const [settingsPin, setSettingsPin] = useState("");
  const [newPin, setNewPin] = useState("");
  const [newEmp, setNewEmp] = useState("");
  const [pinEntryError, setPinEntryError] = useState(false);

  function tryUnlock() {
    if (verifyPin(settingsPin)) { setSettingsUnlocked(true); setSettingsPin(""); setPinEntryError(false); }
    else { setPinEntryError(true); setSettingsPin(""); setTimeout(() => setPinEntryError(false), 1500); }
  }

  return (
    <div style={{ maxWidth: 440 }}>
      {!settingsUnlocked ? (
        <div style={{ background: "white", border: "1px solid #e5e5e5", borderRadius: 10, padding: "1.5rem" }}>
          <p style={{ margin: "0 0 12px", fontSize: 14, fontWeight: 600 }}>Code manager requis</p>
          <div style={{ display: "flex", gap: 8 }}>
            <input type="password" maxLength={4} value={settingsPin} onChange={e => setSettingsPin(e.target.value)} onKeyDown={e => e.key === "Enter" && tryUnlock()} placeholder="••••"
              style={{ flex: 1, padding: "8px 12px", borderRadius: 8, border: pinEntryError ? "1px solid #fca5a5" : "1px solid #d0d0d0", background: pinEntryError ? "#fee2e2" : "white", color: "#111", fontSize: 16, letterSpacing: 6 }} />
            <button onClick={tryUnlock} style={{ padding: "8px 16px", borderRadius: 8, border: "1px solid #BFDBFE", background: "#EFF6FF", color: "#1D4ED8", cursor: "pointer", fontSize: 13, fontWeight: 500 }}>Accéder</button>
          </div>
          {pinEntryError && <p style={{ margin: "8px 0 0", fontSize: 12, color: "#dc2626" }}>Code incorrect</p>}
        </div>
      ) : (
        <div style={{ display: "grid", gap: 16 }}>
          <div style={{ background: "white", border: "1px solid #e5e5e5", borderRadius: 10, padding: "1.25rem" }}>
            <p style={{ margin: "0 0 12px", fontSize: 14, fontWeight: 600 }}>Code manager</p>
            <div style={{ display: "flex", gap: 8 }}>
              <input type="password" maxLength={4} value={newPin} onChange={e => setNewPin(e.target.value)} placeholder="Nouveau code (4 chiffres)" style={{ flex: 1, padding: "7px 10px", borderRadius: 8, border: "1px solid #d0d0d0", background: "white", color: "#111", fontSize: 14 }} />
              <button onClick={() => { if (newPin.length === 4) { changePin(newPin); setNewPin(""); } }} style={{ padding: "7px 14px", borderRadius: 8, border: "1px solid #86efac", background: "#dcfce7", color: "#16a34a", cursor: "pointer", fontSize: 13, fontWeight: 500 }}>Enregistrer</button>
            </div>
          </div>
          <div style={{ background: "white", border: "1px solid #e5e5e5", borderRadius: 10, padding: "1.25rem" }}>
            <p style={{ margin: "0 0 12px", fontSize: 14, fontWeight: 600 }}>Employés</p>
            <div style={{ display: "grid", gap: 6, marginBottom: 12 }}>
              {employees.map((emp, ei) => (
                <div key={emp} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "8px 10px", background: "#fafafa", borderRadius: 8, gap: 8 }}>
                  <span style={{ fontSize: 13, flex: 1 }}>{emp}</span>
                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <input type="number" min={0} max={48} value={contractHours[emp] || ""} onChange={e => setContractHours({ ...contractHours, [emp]: e.target.value ? parseFloat(e.target.value) : undefined })} placeholder="h/sem" style={{ width: 64, padding: "4px 6px", borderRadius: 6, border: "1px solid #d0d0d0", background: "white", fontSize: 13, textAlign: "center" }} />
                    <span style={{ fontSize: 11, color: "#aaa" }}>h/sem</span>
                  </div>
                  <span onClick={() => setEmployees(employees.filter((_, i) => i !== ei))} style={{ fontSize: 12, color: "#dc2626", cursor: "pointer" }}>Supprimer</span>
                </div>
              ))}
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <input value={newEmp} onChange={e => setNewEmp(e.target.value)} onKeyDown={e => e.key === "Enter" && newEmp.trim() && (setEmployees([...employees, newEmp.trim()]), setNewEmp(""))} placeholder="Prénom du nouvel employé" style={{ flex: 1, padding: "7px 10px", borderRadius: 8, border: "1px solid #d0d0d0", background: "white", color: "#111", fontSize: 14 }} />
              <button onClick={() => { if (newEmp.trim()) { setEmployees([...employees, newEmp.trim()]); setNewEmp(""); } }} style={{ padding: "7px 14px", borderRadius: 8, border: "1px solid #BFDBFE", background: "#EFF6FF", color: "#1D4ED8", cursor: "pointer", fontSize: 13, fontWeight: 500 }}>Ajouter</button>
            </div>
          </div>
          <button onClick={() => setSettingsUnlocked(false)} style={{ padding: "7px 14px", borderRadius: 8, border: "1px solid #e5e5e5", background: "transparent", color: "#888", cursor: "pointer", fontSize: 13 }}>Verrouiller les paramètres</button>
        </div>
      )}
    </div>
  );
}

// ══ ROOT APP ══
const MAIN_TABS = [
  { id: "dlc", label: "🗓 Gestion DLC" },
  { id: "equipe", label: "👥 Équipe" },
];

export default function App({ onSignOut }) {
  const [mainTab, setMainTab] = useState("dlc");
  return (
    <div style={{ fontFamily: "-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif", maxWidth: 920, margin: "0 auto", padding: "1rem", background: "white", minHeight: "100vh" }}>
      <style>{`
        @media print { .no-print{display:none!important} .print-only{display:block!important} body{background:white} }
        .print-only{display:none}
        .row-hover:hover{background:#f5f5f5}
        button { transition: filter 0.12s; }
        button:hover { filter: brightness(0.93); }
        button:active { filter: brightness(0.85); }
      `}</style>
      <div className="no-print" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "1.5rem", paddingBottom: "1rem", borderBottom: "1px solid #e5e5e5" }}>
        <div>
          <div style={{ fontSize: 19, fontWeight: 700, color: "#111" }}>Holding NHA</div>
          <div style={{ fontSize: 12, color: "#888" }}>Outil interne équipe</div>
        </div>
        <div style={{ display: "flex", gap: 6 }}>
          {MAIN_TABS.map(t => (
            <button key={t.id} onClick={() => setMainTab(t.id)} style={{ padding: "7px 18px", borderRadius: 8, fontSize: 14, fontWeight: mainTab === t.id ? 600 : 400, background: mainTab === t.id ? "#111" : "white", color: mainTab === t.id ? "white" : "#555", border: mainTab === t.id ? "1.5px solid #111" : "1px solid #d0d0d0", cursor: "pointer" }}>
              {t.label}
            </button>
          ))}
        </div>
      </div>
      {mainTab === "dlc" && <DLCModule />}
      {mainTab === "equipe" && <EquipeModule onSignOut={onSignOut} />}
    </div>
  );
}