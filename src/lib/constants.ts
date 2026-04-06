// Shared constants and utility functions for the NHA app

// ─── Business Constants ───
export const TEMP_THRESHOLD_FREEZER = -15; // °C — seuil congélateur
export const TEMP_THRESHOLD_FRIDGE = 5;    // °C — seuil réfrigérateur
export const DLC_ALERT_DAYS = 3;           // jours avant expiration

export const CATEGORIES = ["Viande","Poisson","Produits laitiers","Légumes","Fruits","Charcuterie","Épicerie","Boissons","Autre"];
export const DAYS = ["Lun","Mar","Mer","Jeu","Ven","Sam","Dim"];
export const SLOT_COLORS = ["#1D9E75","#378ADD","#D85A30","#7F77DD","#BA7517"];
export const PRESET_COLORS = ["#2563eb","#7c3aed","#dc2626","#d97706","#0891b2","#16a34a","#e11d48","#7c2d12","#4338ca","#065f46"];
export const FREQUENCIES = [
  { value: "quotidien", label: "Quotidien", emoji: "🔄" },
  { value: "hebdomadaire", label: "Hebdo", emoji: "📅" },
  { value: "mensuel", label: "Mensuel", emoji: "🗓" },
];

export const todayStr = (): string => new Date().toISOString().split("T")[0];
export const tomorrowStr = (): string => { const d = new Date(); d.setDate(d.getDate()+1); return d.toISOString().split("T")[0]; };

export const statusOf = (dlc: string | null): "ok" | "expire" | "urgent" => {
  if (!dlc) return "ok";
  if (dlc <= todayStr()) return "expire";
  if (dlc <= tomorrowStr()) return "urgent";
  return "ok";
};

export const fmtDate = (d: string | null): string => {
  if (!d) return "—";
  const [y,m,j] = d.split("-");
  return `${j}/${m}/${y}`;
};

export const fmtShort = (d: Date): string => d.toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit" });
export const fmtTime = (ts: number | null): string => { if (!ts) return "--:--"; return new Date(ts).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" }); };
export const diffH = (a: number | null, b: number | null): number => { if (!a || !b) return 0; return (b - a) / 3600000; };
export const fmtDuration = (hours: number): string => { const t = Math.floor(hours * 60); const h = Math.floor(t / 60); const m = t % 60; if (h === 0) return `${m}min`; return m === 0 ? `${h}h` : `${h}h ${m}min`; };

export const getRoleColor = (role: string, roles: { label: string; color: string }[]): string => {
  const found = roles.find(r => r.label === role);
  return found ? found.color : "#888";
};

export function getWeekDates(offset = 0): Date[] {
  const now = new Date();
  const day = now.getDay();
  const diff = (day === 0 ? -6 : 1 - day) + offset * 7;
  const mon = new Date(now);
  mon.setDate(now.getDate() + diff);
  return Array.from({ length: 7 }, (_, i) => { const d = new Date(mon); d.setDate(mon.getDate() + i); return d; });
}

export const makeWeekKey = (dates: Date[]): string => `${fmtShort(dates[0])}-${dates[0].getFullYear()}`;

export const makeDefaultForm = () => ({ nom: "", categorie: "Viande", fab: todayStr(), dlc: todayStr(), quantite: "", photo_url: "" });

export function calcSlotMinutes(start: string, end: string): number {
  const [sh, sm] = start.split(":").map(Number);
  const [eh, em] = end.split(":").map(Number);
  let diff = eh * 60 + em - (sh * 60 + sm);
  if (diff <= 0) diff += 24 * 60;
  return diff;
}

/** Check if a temperature is out of range for the given equipment type */
export function isTempAlert(temperature: number, equipmentType: string): boolean {
  if (equipmentType === "congelateur") return temperature > TEMP_THRESHOLD_FREEZER;
  return temperature > TEMP_THRESHOLD_FRIDGE;
}
