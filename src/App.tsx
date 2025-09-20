import React, { useMemo, useState, useEffect } from "react";
import { compute, DayType } from "./modules/civils";

/* ============ Helpers ============ */
const pad = (n: number) => String(n).padStart(2, "0");

function addMinutes(d: Date, m: number) { return new Date(d.getTime() + m * 60000); }
function asHM(min: number) { const h = Math.floor(min/60), m = min%60; return `${pad(h)}:${pad(m)}`; }
function asHMstrict(min: number) { const h = Math.floor(min/60), m = min%60; return `${pad(h)}:${pad(m)}`; }

function formatTypingHHMM(raw: string): string {
  const d = raw.replace(/[^\d]/g, "").slice(0, 4);
  if (d.length <= 2) return d;
  return d.slice(0, 2) + ":" + d.slice(2);
}
function finalizeHHMM(raw: string): string {
  const d = raw.replace(/[^\d]/g, "");
  if (d.length === 0) return "";
  let h = 0, m = 0;
  if (d.length === 1) { h = Number(d); m = 0; }
  else if (d.length === 2) { h = Number(d); m = 0; }
  else if (d.length === 3) { h = Number(d.slice(0,2)); m = Number("0"+d.slice(2)); }
  else { h = Number(d.slice(0,2)); m = Number(d.slice(2,4)); }
  if (h > 23) h = 23;
  if (m > 59) m = 59;
  return `${pad(h)}:${pad(m)}`;
}
function isValidHHMM(v: string) {
  const m = /^(\d{2}):(\d{2})$/.exec(v);
  if (!m) return false;
  const h = +m[1], mm = +m[2];
  return h >= 0 && h <= 23 && mm >= 0 && mm <= 59;
}

function plus1hLabel(dateISO: string, hhmm: string, fallbackDateISO?: string) {
  const useDate = dateISO || fallbackDateISO || "";
  if (!useDate || !isValidHHMM(hhmm)) return "";
  const [h, m] = hhmm.split(":").map(Number);
  const d = new Date(`${useDate}T${pad(h)}:${pad(m)}`);
  const e = addMinutes(d, 60);
  return `${pad(e.getHours())}:${pad(e.getMinutes())}`;
}

function fmtSmart(d: Date, refStart?: Date, refEnd?: Date) {
  const hm = `${pad(d.getHours())}:${pad(d.getMinutes())}`;
  const sd = refStart ? refStart.toDateString() : "";
  const ed = refEnd ? refEnd.toDateString() : "";
  const same = d.toDateString() === sd || d.toDateString() === ed;
  if (same) return <strong>{hm}</strong>;
  return <>{pad(d.getDate())}/{pad(d.getMonth()+1)}/{d.getFullYear()} <strong>{hm}</strong></>;
}

/* ---- Helpers locaux pour éviter l’import manquant ---- */
function computeAccountingDate(start: Date, end: Date, ..._rest: any[]): Date {
  const s = new Date(start), e = new Date(end);
  let d0 = new Date(s); d0.setHours(0,0,0,0);

  const perDay = new Map<number, number>();
  while (d0 < e) {
    const d1 = new Date(d0); d1.setDate(d1.getDate() + 1);
    const segStart = new Date(Math.max(d0.getTime(), s.getTime()));
    const segEnd   = new Date(Math.min(d1.getTime(), e.getTime()));
    const mins = Math.max(0, Math.round((segEnd.getTime() - segStart.getTime()) / 60000));
    perDay.set(d0.getTime(), (perDay.get(d0.getTime()) ?? 0) + mins);
    d0 = d1;
  }

  let bestKey = Array.from(perDay.keys())[0];
  let bestVal = perDay.get(bestKey) ?? 0;
  for (const [k, v] of perDay) { if (v > bestVal) { bestVal = v; bestKey = k; } }
  return new Date(bestKey);
}

function dayTypeFromAccountingDate(accountingDate: Date): DayType {
  const dow = accountingDate.getDay(); // 0=Dimanche, 6=Samedi
  if (dow === 6) return "R";
  if (dow === 0) return "RH";
  return "SO";
}

/* ============ App ============ */
export default function App() {
  const [startDate, setStartDate] = useState<string>("");
  const [startTime, setStartTime] = useState<string>("");
  const [endDate, setEndDate] = useState<string>("");
  const [endTime, setEndTime] = useState<string>("");

  const [breakDate, setBreakDate] = useState<string>("");
  const [breakStartTime, setBreakStartTime] = useState<string>("");
  const [breakEndTime, setBreakEndTime] = useState<string>("");

  const [noonDate, setNoonDate] = useState<string>("");
  const [noonStart, setNoonStart] = useState<string>("");
  const [eveDate, setEveDate] = useState<string>("");
  const [eveStart, setEveStart] = useState<string>("");

  const [dayType, setDayType] = useState<DayType>("SO");

  const startDT = useMemo(() => {
    if (!startDate || !isValidHHMM(startTime)) return null;
    const [h,m] = startTime.split(":").map(Number);
    return new Date(`${startDate}T${pad(h)}:${pad(m)}`);
  }, [startDate, startTime]);

  const endDT = useMemo(() => {
    if (!endDate || !isValidHHMM(endTime)) return null;
    const [h,m] = endTime.split(":").map(Number);
    return new Date(`${endDate}T${pad(h)}:${pad(m)}`);
  }, [endDate, endTime]);

  const breakStartDT = useMemo(() => {
    const dISO = breakDate || startDate;
    if (!dISO || !isValidHHMM(breakStartTime)) return null;
    const [h,m] = breakStartTime.split(":").map(Number);
    return new Date(`${dISO}T${pad(h)}:${pad(m)}`);
  }, [breakDate, breakStartTime, startDate]);

  const breakEndDT = useMemo(() => {
    const dISO = breakDate || startDate;
    if (!dISO || !isValidHHMM(breakEndTime)) return null;
    const [h,m] = breakEndTime.split(":").map(Number);
    return new Date(`${dISO}T${pad(h)}:${pad(m)}`);
  }, [breakDate, breakEndTime, startDate]);

  const noonStartDT = useMemo(() => {
    const dISO = noonDate || startDate;
    if (!dISO || !isValidHHMM(noonStart)) return null;
    const [h,m] = noonStart.split(":").map(Number);
    return new Date(`${dISO}T${pad(h)}:${pad(m)}`);
  }, [noonDate, noonStart, startDate]);

  const eveStartDT = useMemo(() => {
    const dISO = eveDate || startDate;
    if (!dISO || !isValidHHMM(eveStart)) return null;
    const [h,m] = eveStart.split(":").map(Number);
    return new Date(`${dISO}T${pad(h)}:${pad(m)}`);
  }, [eveDate, eveStart, startDate]);

  useEffect(() => {
    if (!startDT || !endDT) return;
    const meals: Array<{start:Date; end:Date}> = [];
    if (noonStartDT) meals.push({ start: noonStartDT, end: addMinutes(noonStartDT, 60) });
    if (eveStartDT)  meals.push({ start: eveStartDT,  end: addMinutes(eveStartDT,  60) });
    const breaks = (breakStartDT && breakEndDT) ? [{ start: breakStartDT, end: breakEndDT }] : [];
    const acc = computeAccountingDate(startDT, endDT, meals, breaks);
    setDayType(dayTypeFromAccountingDate(acc));
  }, [startDT, endDT, noonStartDT, eveStartDT, breakStartDT, breakEndDT]);

  const out = useMemo(() => {
    if (!startDT || !endDT) return null;
    return compute({
      date: startDT,
      start: startDT,
      end: endDT,
      theBreak: breakStartDT && breakEndDT ? { start: breakStartDT, end: breakEndDT } : undefined,
      mealNoon:   noonStartDT ? { start: noonStartDT, end: addMinutes(noonStartDT,60) } : undefined,
      mealEvening: eveStartDT ? { start: eveStartDT,  end: addMinutes(eveStartDT, 60) } : undefined,
      dayType,
    });
  }, [startDT, endDT, breakStartDT, breakEndDT, noonStartDT, eveStartDT, dayType]);

  /* ============ rendu (inchangé, je ne recopie pas tout pour raccourcir) ============ */
  return (
    <div>
      {/* ton rendu ici (les cartes, ventilation, frises, etc.) */}
    </div>
  );
}
