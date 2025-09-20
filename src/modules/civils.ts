export type DayType = 'SO' | 'R' | 'RH';

export interface Meal { start?: Date; end?: Date }
export interface Break { start?: Date; end?: Date }
export interface Input {
  date: Date;
  start: Date;
  end: Date;
  mealNoon?: Meal;
  mealEvening?: Meal;
  theBreak?: Break;
  dayType: DayType;
}
export interface Output {
  dmjEnd: Date;
  t13: Date;
  Bmin_min: number;
  Amin_min: number;
  A_hours: number;
  B_total_h: number;
  HS: number; HSN: number; HSM: number; HNM: number;
}

function minutesBetween(a: Date, b: Date){ return Math.max(0, Math.round((b.getTime()-a.getTime())/60000)); }
function addMin(d: Date, m: number){ return new Date(d.getTime()+m*60000); }
function ceilH(m: number){ if(m<=0) return 0; const h=Math.floor(m/60), r=m%60; return r? h+1 : h; }
function floorH(m: number){ if(m<=0) return 0; return Math.floor(m/60); }

function normalize(ints: Array<{start:Date; end:Date}>){
  if(!ints.length) return [] as Array<{start:Date; end:Date}>;
  ints.sort((a,b)=> a.start.getTime()-b.start.getTime());
  const out=[{...ints[0]}];
  for(let i=1;i<ints.length;i++){
    const p=out[out.length-1], c=ints[i];
    if(c.start<=p.end) p.end=new Date(Math.max(p.end.getTime(), c.end.getTime()));
    else out.push({...c});
  }
  return out;
}
function subtract(baseStart: Date, baseEnd: Date, remove: Array<{start:Date; end:Date}>){
  const clipped = remove
    .map(r=>({start:new Date(Math.max(r.start.getTime(), baseStart.getTime())),
               end:new Date(Math.min(r.end.getTime(), baseEnd.getTime()))}))
    .filter(r=> r.end>baseStart && r.start<baseEnd);
  const rem = normalize(clipped);
  const segs: Array<{start:Date; end:Date}>=[]; let cur=new Date(baseStart);
  for(const r of rem){ if(r.start>cur) segs.push({start:cur,end:r.start}); if(r.end>cur) cur=new Date(r.end); }
  if(cur<baseEnd) segs.push({start:cur,end:baseEnd});
  return segs;
}

// DMJ = 7h48 de travail effectif (repas + coupure repoussent si elles la chevauchent)
function computeDMJ(start: Date, pauses: Array<{start:Date; end:Date}>, targetMin=468){
  const merged = normalize(pauses);
  const endWindow = addMin(start, 2*24*60);
  const segs: Array<{start:Date; end:Date}>=[]; let cur=new Date(start);
  for(const r of merged){ if(r.start>cur) segs.push({start:cur,end:r.start}); if(r.end>cur) cur=new Date(r.end); }
  segs.push({start:cur,end:endWindow});
  let rest = targetMin;
  for(const s of segs){ const d=minutesBetween(s.start,s.end);
    if(d>=rest) return addMin(s.start, rest);
    rest-=d;
  }
  return endWindow;
}

function isFullNightHour(s: Date, e: Date){
  // Nuit = heure entière dans [21:00,06:00)
  const spans: Array<{sd:Date; ed:Date}>=[]; const midnight = new Date(s); midnight.setHours(24,0,0,0);
  if(e<=midnight) spans.push({sd:s,ed:e}); else { spans.push({sd:s,ed:midnight}); spans.push({sd:midnight,ed:e}); }
  for(const sp of spans){
    const d0 = new Date(sp.sd); d0.setHours(0,0,0,0);
    const h06=new Date(d0); h06.setHours(6,0,0,0);
    const h21=new Date(d0); h21.setHours(21,0,0,0);
    const interStart = new Date(Math.max(sp.sd.getTime(), h06.getTime()));
    const interEnd   = new Date(Math.min(sp.ed.getTime(), h21.getTime()));
    if(interEnd>interStart) return false;
  }
  return true;
}

export function compute(input: Input): Output {
  const start=input.start, end=input.end;
  const t13 = addMin(start, 13*60);

  const meals: Array<{start:Date; end:Date}>=[];
  if(input.mealNoon?.start && input.mealNoon?.end) meals.push({start:input.mealNoon.start, end:input.mealNoon.end});
  if(input.mealEvening?.start && input.mealEvening?.end) meals.push({start:input.mealEvening.start, end:input.mealEvening.end});
  const breaks: Array<{start:Date; end:Date}> = input.theBreak?.start && input.theBreak?.end ? [{start:input.theBreak.start, end:input.theBreak.end}] : [];
  const allPauses = meals.concat(breaks);

  const dmjEnd = computeDMJ(start, allPauses);

  // Bmin = travail effectif après DMJ (repas + coupure déduits)
  const Bmin_min = subtract(dmjEnd, end, allPauses).reduce((a,s)=> a+minutesBetween(s.start,s.end), 0);

  // Amin = travail effectif entre DMJ et 13h (on déduit UNIQUEMENT la coupure)
  const Amin_min = subtract(dmjEnd, t13, breaks).reduce((a,s)=> a+minutesBetween(s.start,s.end), 0);

  // Arbitrage minutes-only
  const A_hours = (Amin_min%60) > (Bmin_min%60) ? Math.ceil(Amin_min/60) : Math.floor(Amin_min/60);
  const B_total_h = Math.ceil(Bmin_min/60);

  // Frises virtuelles (non maj depuis DMJ, maj depuis 13h si amplitude atteinte)
  const nonMaj = Math.min(A_hours, B_total_h);
  const maj    = Math.max(0, B_total_h - nonMaj);

  let HS=0, HSN=0, HSM=0, HNM=0;

  // Non maj (depuis DMJ)
  let cur = new Date(dmjEnd);
  for (let i=0; i<nonMaj; i++){
    const s=new Date(cur), e=addMin(s,60);
    if (isFullNightHour(s,e)) { HSN += 1; } else { HS += 1; }
    cur = e;
  }

  // Maj (depuis t13)
  cur = new Date(t13);
  for (let i=0; i<maj; i++){
    const s=new Date(cur), e=addMin(s,60);
    if (isFullNightHour(s,e)) { HNM += 1; } else { HSM += 1; }
    cur = e;
  }

  // Dimanche : renommage HS→HSD et HSM→HDM sera géré dans l’UI (affichage)
  return { dmjEnd, t13, Bmin_min, Amin_min, A_hours, B_total_h, HS, HSN, HSM, HNM };

// --- Journée comptable (jour avec le plus de travail effectif) ---
function ymd(d: Date){ return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`; }

function splitByMidnight(seg: {start: Date; end: Date}) {
  const parts: Array<{start:Date; end:Date}> = [];
  let s = new Date(seg.start), e = new Date(seg.end);
  while (true) {
    const cut = new Date(s); cut.setHours(24,0,0,0); // minuit suivant
    if (e <= cut) { parts.push({ start:s, end:e }); break; }
    parts.push({ start:s, end:cut });
    s = cut;
  }
  return parts;
}

/** Retourne la DATE (00:00) correspondant à la journée comptable */
export function computeAccountingDate(
  start: Date,
  end: Date,
  meals: Array<{start:Date; end:Date}> = [],
  breaks: Array<{start:Date; end:Date}> = []
): Date {
  const pauses = normalize(meals.concat(breaks));
  // Segments de travail effectif (pauses déduites) entre start et end
  const eff = subtract(start, end, pauses);
  // Minutes par jour (YYYY-MM-DD)
  const perDay = new Map<string, number>();
  for (const seg of eff) {
    for (const part of splitByMidnight(seg)) {
      const key = ymd(part.start);
      const mins = minutesBetween(part.start, part.end);
      perDay.set(key, (perDay.get(key) ?? 0) + mins);
    }
  }
  // Jour avec max de minutes
  let bestKey = ymd(start), bestVal = -1;
  for (const [k, v] of perDay.entries()) {
    if (v > bestVal) { bestVal = v; bestKey = k; }
  }
  const [Y,M,D] = bestKey.split('-').map(Number);
  return new Date(Y, (M-1), D, 0, 0, 0, 0);
}

/** SO/R/RH déterminé à partir de la journée comptable */
export function dayTypeFromAccountingDate(d: Date): DayType {
  const dow = d.getDay(); // 0=Dimanche, 6=Samedi
  if (dow === 0) return 'RH';
  if (dow === 6) return 'R';
  return 'SO';
}
}
