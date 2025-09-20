import React, { useMemo, useState, useEffect } from "react";
import {
  compute,
  DayType,
  computeAccountingDate,
  dayTypeFromAccountingDate,
} from "./modules/civils";

// helpers
function toLocal(d: Date) {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(
    d.getHours()
  )}:${p(d.getMinutes())}`;
}
function fmtDateTime(d: Date) {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${p(d.getDate())}/${p(d.getMonth() + 1)}/${d.getFullYear()} ${p(
    d.getHours()
  )}:${p(d.getMinutes())}`;
}
function asHM(min: number) {
  const h = Math.floor(min / 60),
    m = min % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}
function plus1hISO(dt?: string) {
  if (!dt) return "";
  const d = new Date(dt);
  d.setHours(d.getHours() + 1);
  return toLocal(d);
}

export default function App() {
  // valeurs par défaut
  const base = new Date();
  base.setHours(7, 0, 0, 0);
  const [start, setStart] = useState<Date>(new Date(base));
  const [end, setEnd] = useState<Date>(new Date(base.getTime() + 13.5 * 3600 * 1000));

  // Coupure (une ligne)
  const [breakStart, setBreakStart] = useState<string>("");
  const [breakEnd, setBreakEnd] = useState<string>("");

  // Repas: on saisit juste le début; la fin = début + 1h
  const [noonS, setNoonS] = useState<string>("");
  const noonE = plus1hISO(noonS);
  const [eveS, setEveS] = useState<string>("");
  const eveE = plus1hISO(eveS);

  // Type de jour déduit automatiquement (journée comptable)
  const [dayType, setDayType] = useState<DayType>("SO");

  useEffect(() => {
    const meals: Array<{ start: Date; end: Date }> = [];
    if (noonS) meals.push({ start: new Date(noonS), end: new Date(noonE) });
    if (eveS) meals.push({ start: new Date(eveS), end: new Date(eveE) });
    const breaks =
      breakStart && breakEnd ? [{ start: new Date(breakStart), end: new Date(breakEnd) }] : [];
    const acc = computeAccountingDate(start, end, meals, breaks);
    setDayType(dayTypeFromAccountingDate(acc));
  }, [start, end, noonS, noonE, eveS, eveE, breakStart, breakEnd]);

  // calcul principal
  const out = useMemo(
    () =>
      compute({
        date: new Date(start.getFullYear(), start.getMonth(), start.getDate()),
        start,
        end,
        theBreak:
          breakStart && breakEnd
            ? { start: new Date(breakStart), end: new Date(breakEnd) }
            : undefined,
        mealNoon: noonS ? { start: new Date(noonS), end: new Date(noonE) } : undefined,
        mealEvening: eveS ? { start: new Date(eveS), end: new Date(eveE) } : undefined,
        dayType,
      }),
    [start, end, breakStart, breakEnd, noonS, noonE, eveS, eveE, dayType]
  );

  // libellés & facteur (s’applique UNIQUEMENT aux majorées)
  const HS_label = dayType === "RH" ? "HSD" : "HS";
  const HSM_label = dayType === "RH" ? "HDM" : "HSM";
  const factor = dayType === "SO" ? 1.5 : dayType === "R" ? 2 : 3;

  // répartition arrondie
  const nonMaj = Math.min(out.A_hours, out.B_total_h); // HS/HSD
  const maj = Math.max(0, out.B_total_h - nonMaj); // HSM/HDM

  // Comparateur minutes-only pour Amin vs Bmin
  const aMin = out.Amin_min % 60;
  const bMin = out.Bmin_min % 60;
  const cmp = aMin > bMin ? ">" : aMin < bMin ? "<" : "=";

  // styles
  const box: React.CSSProperties = {
    margin: "16px auto",
    maxWidth: 900,
    padding: 16,
    fontFamily: "system-ui,-apple-system,Segoe UI,Roboto,sans-serif",
  };
  const card: React.CSSProperties = {
    background: "#fff",
    border: "1px solid #e5e7eb",
    borderRadius: 12,
    padding: 12,
  };
  const row: React.CSSProperties = { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 };
  const btn: React.CSSProperties = {
    padding: "6px 10px",
    border: "1px solid #e5e7eb",
    borderRadius: 8,
    background: "#f8fafc",
  };

  return (
    <div style={box}>
      <h1 style={{ fontSize: 24, margin: "0 0 12px" }}>Civils Déplacés v6</h1>

      {/* JOURNÉE COMPTABLE détectée */}
      <div style={{ ...card, marginBottom: 12 }}>
        Jour détecté (journée comptable) :{" "}
        <strong>
          {dayType} {dayType === "SO" ? "(Lun–Ven)" : dayType === "R" ? "(Samedi)" : "(Dimanche)"}
        </strong>
      </div>

      {/* FORMULAIRE allégé */}
      <div style={{ ...card, display: "grid", gap: 12 }}>
        <div>
          <label>Prise de service</label>
          <div style={row}>
            <input
              type="datetime-local"
              value={toLocal(start)}
              onChange={(e) => setStart(new Date(e.target.value))}
            />
            <button style={btn} onClick={() => setStart(new Date())}>
              Maintenant
            </button>
          </div>
        </div>

        <div>
          <label>Fin de service</label>
          <div style={row}>
            <input
              type="datetime-local"
              value={toLocal(end)}
              onChange={(e) => setEnd(new Date(e.target.value))}
            />
            <button style={btn} onClick={() => setEnd(new Date())}>
              Maintenant
            </button>
          </div>
        </div>

        {/* Coupure : une ligne + bouton effacer */}
        <div>
          <div style={{ marginBottom: 4, display: "flex", justifyContent: "space-between" }}>
            <span>Coupure</span>
            <button
              style={btn}
              onClick={() => {
                setBreakStart("");
                setBreakEnd("");
              }}
            >
              Effacer
            </button>
          </div>
          <div style={row}>
            <input
              type="datetime-local"
              placeholder="Début"
              value={breakStart}
              onChange={(e) => setBreakStart(e.target.value)}
            />
            <input
              type="datetime-local"
              placeholder="Fin"
              value={breakEnd}
              onChange={(e) => setBreakEnd(e.target.value)}
            />
          </div>
        </div>

        {/* Repas méridien : début seul, fin auto (+1h), mais sans texte */}
        <div>
          <div style={{ marginBottom: 4, display: "flex", justifyContent: "space-between" }}>
            <span>Repas méridien</span>
            <button
              style={btn}
              onClick={() => {
                setNoonS("");
              }}
            >
              Effacer
            </button>
          </div>
          <div style={row}>
            <input
              type="datetime-local"
              placeholder="Début"
              value={noonS}
              onChange={(e) => setNoonS(e.target.value)}
            />
            <input type="datetime-local" value={noonE} readOnly />
          </div>
        </div>

        {/* Repas vespéral : début seul, fin auto (+1h), sans texte */}
        <div>
          <div style={{ marginBottom: 4, display: "flex", justifyContent: "space-between" }}>
            <span>Repas vespéral</span>
            <button
              style={btn}
              onClick={() => {
                setEveS("");
              }}
            >
              Effacer
            </button>
          </div>
          <div style={row}>
            <input
              type="datetime-local"
              placeholder="Début"
              value={eveS}
              onChange={(e) => setEveS(e.target.value)}
            />
            <input type="datetime-local" value={eveE} readOnly />
          </div>
        </div>
      </div>

      {/* REPÈRES */}
      <div style={{ ...card, marginTop: 12 }}>
        <div style={row}>
          <div>DMJ atteinte à</div>
          <div>{fmtDateTime(out.dmjEnd)}</div>
          <div>Amplitude atteinte à</div>
          <div>{fmtDateTime(out.t13)}</div>
          <div>Dépassement total</div>
          <div>
            {asHM(out.Bmin_min)} → arrondi à {out.B_total_h}:00
          </div>
        </div>
      </div>

      {/* AMIN / BMIN */}
      <div style={{ ...card, marginTop: 12 }}>
        <div style={row}>
          <div>Amin</div>
          <div>
            {Math.floor(out.Amin_min / 60)} h {String(out.Amin_min % 60).padStart(2, "0")}
          </div>
          <div>Bmin</div>
          <div>
            {Math.floor(out.Bmin_min / 60)} h {String(out.Bmin_min % 60).padStart(2, "0")}
          </div>
        </div>
        <div style={{ marginTop: 8, textAlign: "center", fontSize: 18 }}>
          Amin {cmp} Bmin
        </div>
      </div>

      {/* VENTILATION / RÉPARTITION */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <div style={{ ...card, marginTop: 12 }}>
          <div style={{ fontWeight: 600, marginBottom: 8 }}>Ventilation des heures</div>
          <div style={{ display: "grid", gridTemplateColumns: "auto 1fr", gap: 6 }}>
            <div>
              {nonMaj} {HS_label}
            </div>
            <div />
            {maj > 0 && (
              <>
                <div>1 HS × {factor * 100}% soit</div>
                <div>
                  {maj} {HSM_label} ({dayType})
                </div>
              </>
            )}
          </div>
        </div>

        <div style={{ ...card, marginTop: 12 }}>
          <div style={{ fontWeight: 600, marginBottom: 8 }}>Répartition des heures</div>
          <div style={{ display: "grid", gridTemplateColumns: "auto 1fr", gap: 6 }}>
            <div>
              {nonMaj} {HS_label}
            </div>
            <div />
            {maj > 0 && (
              <>
                <div>
                  {maj} {HSM_label}
                </div>
                <div />
              </>
            )}
          </div>
          {/* Crédit RCJ / RL déplacé ici */}
          <div style={{ marginTop: 8, color: "#b91c1c", fontWeight: 600 }}>
            {dayType === "R" && "Crédit de 1 RCJ au titre du DP sur le R"}
            {dayType === "RH" && "Crédit de 1,5 RCJ ou 2 RCJ + 1 RL au titre du DP sur le RH"}
          </div>
        </div>
      </div>
    </div>
  );
}
