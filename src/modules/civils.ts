/* ===========================================
   CHECKPOINT: Frise OK — 2025-09-20
   Base stable (UI + frise + acronymes)
   + Nettoyage chambre (REM. COND. LOCAUX HEBERG.)
   =========================================== */

// src/modules/civils.ts
export type DayType = 'SO' | 'R' | 'RH';

export interface Meal { start: Date; end: Date }
export interface Break { start: Date; end: Date }

export interface Input {
  date: Date;            // (non utilisé pour l’instant, conservé pour compat)
  start: Date;           // prise de service
  end: Date;             // fin de service (peut être le lendemain)
  mealNoon?: Meal;       // repas midi (optionnel)
  mealEvening?: Meal;    // repas soir (optionnel)
  theBreak?: Break;      // coupure (unique) optionnelle
  dayType: DayType;      // SO/R/RH

  /** Minutes de nettoyage effectuées PENDANT le service (0–20).
   *  Règles :
   *   - la DMJ n’est pas décalée (le ménage compte comme travail effectif)
   *   - l’amplitude (T13) est décalée d’autant
   *   - pour l’arrondi des HS, on enlève ces minutes au dépassement
   *     (le ménage ne doit pas engendrer d’HS).
   */
  cleaningMinutesInside?: number;
}

export interface Output {
  dmjEnd: Date;          // fin de DMJ (7h48 de travail effectif)
  t13: Date;             // prise + 13h (+ nettoyage pendant le service)
  Bmin_min: number;      // dépassement effectif en minutes (DMJ→fin, pauses déduites, ménage inclus)
  Amin_min: number;      // minutes effectives entre DMJ et t13 (seule la coupure déduite)
  A_hours: number;       // heures non majorées (règle Amin vs Bmin — minutes seules, sur Bmin corrigé ménage)
  B_total_h: number;     // dépassement total ARRONDI (après abattement ménage)
  HS: number; HSN: number; HSM: number; HNM: number; // comptage par “bacs”
}

/* ---------- Helpers temps ---------- */
function minutesBetween(a: Date, b: Date){ 
  return Math.max(0, Math.round((b.getTime()-a.getTime())/60000)); 
}
function addMin(d: Date, m: number){ 
  return new Date(d.getTime()+m*60000); 
}
function ceilH(m: number){
  if(m<=0) return 0;
  const h=Math.floor(m/60), r=m%60;
  return r? h+1 : h;
}

function normalize(ints: Array<{start:Date; end:Date}>){
  if(!ints.length) return [];
  const arr = ints
    .map(x=>({start:new Date(x.start), end:new Date(x.end)}))
    .filter(x=> x.end>x.start)
    .sort((a,b)=> a.start.getTime()-b.start.getTime());
  const out=[arr[0]];
  for(let i=1;i<arr.length;i++){
    const p=out[out.length-1], c=arr[i];
    if(c.start<=p.end) {
      p.end = new Date(Math.max(p.end.getTime(), c.end.getTime()));
    } else {
      out.push(c);
    }
  }
  return out;
}

function subtract(baseStart: Date, baseEnd: Date, remove: Array<{start:Date; end:Date}>){
  const rem = normalize(
    remove
      .map(r=>({
        start:new Date(Math.max(r.start.getTime(), baseStart.getTime())),
        end:  new Date(Math.min(r.end.getTime(),   baseEnd.getTime()))
      }))
      .filter(r=> r.end>r.start)
  );
  const segs: Array<{start:Date; end:Date}>=[];
  let cur=new Date(baseStart);
  for(const r of rem){
    if(r.start>cur) segs.push({start:cur,end:r.start});
    cur = new Date(Math.max(cur.getTime(), r.end.getTime()));
  }
  if(cur<baseEnd) segs.push({start:cur,end:baseEnd});
  return segs;
}

/** DMJ = 7h48 (468 min) de travail effectif à partir de la prise ;
 *  pauses/coupure la repoussent si elles la chevauchent.
 *  ⚠ Le ménage n’est PAS une pause : il compte pour la DMJ.
 */
function computeDMJ(
  start: Date, 
  pauses: Array<{start:Date; end:Date}>, 
  targetMin=468
){
  const merged = normalize(pauses);
  // on déroule jusqu’à +48h par sécurité
  const endWindow = addMin(start, 2*24*60);
  const workSegs = subtract(start, endWindow, merged);
  let rest = targetMin;
  for(const seg of workSegs){
    const d = minutesBetween(seg.start, seg.end);
    if(d>=rest) return addMin(seg.start, rest);
    rest -= d;
  }
  return endWindow; // garde-fou
}

/** Heure entière dans la plage nuit [21:00, 06:00) ? */
function isFullNightHour(s: Date, e: Date){
  const spans: Array<{sd:Date; ed:Date}>=[];
  const midnight = new Date(s); midnight.setHours(24,0,0,0);
  if(e<=midnight) spans.push({sd:s,ed:e});
  else {
    spans.push({sd:s,ed:midnight});
    spans.push({sd:midnight,ed:e});
  }
  for(const sp of spans){
    const d0 = new Date(sp.sd); d0.setHours(0,0,0,0);
    const h06=new Date(d0); h06.setHours(6,0,0,0);
    const h21=new Date(d0); h21.setHours(21,0,0,0);
    const interStart = new Date(Math.max(sp.sd.getTime(), h06.getTime()));
    const interEnd   = new Date(Math.min(sp.ed.getTime(), h21.getTime()));
    if(interEnd>interStart) return false; // touche la zone jour
  }
  return true;
}

/* ---------- API principale ---------- */
export function compute(input: Input): Output {
  const start=input.start, end=input.end;

  // Nettoyage pendant le service (borné 0–20 min)
  const cleaningInside = Math.max(
    0, 
    Math.min(20, input.cleaningMinutesInside ?? 0)
  );

  // Amplitude brute = prise + 13h, puis décalée du ménage pendant service
  const t13Base = addMin(start, 13*60);
  const t13 = addMin(t13Base, cleaningInside);

  // Pauses "classiques"
  const meals: Array<{start:Date; end:Date}>= [];
  if(input.mealNoon)    meals.push({start: input.mealNoon.start,    end: input.mealNoon.end});
  if(input.mealEvening) meals.push({start: input.mealEvening.start, end: input.mealEvening.end});
  const breaks: Array<{start:Date; end:Date}>= 
    input.theBreak ? [{start:input.theBreak.start, end:input.theBreak.end}] : [];
  const allPauses = meals.concat(breaks); // ⚠ ménage n’est pas une pause

  // DMJ repoussée par pauses/coupure seulement si elles la chevauchent
  const dmjEnd = computeDMJ(start, allPauses);

  // Bmin = travail effectif (DMJ→fin) en minutes, pauses déduites
  // (le ménage qui tombe après la DMJ reste inclus dans ce Bmin brut)
  const Bmin_min = subtract(dmjEnd, end, allPauses)
    .reduce((acc,s)=> acc + minutesBetween(s.start,s.end), 0);

  // On enlève le ménage pour l’ARRONDI : il ne doit pas engendrer d’HS
  const Bmin_effective = Math.max(0, Bmin_min - cleaningInside);

  // Amin = travail effectif entre DMJ et t13, en déduisant UNIQUEMENT la coupure
  const Amin_min = subtract(dmjEnd, t13, breaks)
    .reduce((acc,s)=> acc + minutesBetween(s.start,s.end), 0);

  // Arrondis / arbitrage (minutes seules) basés sur Bmin_effective
  const A_hours = (Amin_min % 60) >= (Bmin_effective % 60)
    ? Math.ceil(Amin_min/60)
    : Math.floor(Amin_min/60);

  const B_total_h = ceilH(Bmin_effective);

  // Découpage en “bacs” (heures pleines) à partir de ces A/B
  const nonMaj = Math.min(A_hours, B_total_h);
  const maj    = Math.max(0, B_total_h - nonMaj);

  let HS=0, HSN=0, HSM=0, HNM=0;

  // Non majorées : depuis DMJ
  let cur = new Date(dmjEnd);
  for(let i=0;i<nonMaj;i++){
    const s = new Date(cur), e = addMin(s,60);
    if(isFullNightHour(s,e)) HSN++; else HS++;
    cur = e;
  }

  // Majorées : depuis t13 (décalé du ménage)
  cur = new Date(t13);
  for(let i=0;i<maj;i++){
    const s = new Date(cur), e = addMin(s,60);
    if(isFullNightHour(s,e)) HNM++; else HSM++;
    cur = e;
  }

  return { dmjEnd, t13, Bmin_min, Amin_min, A_hours, B_total_h, HS, HSN, HSM, HNM };
}

/* ---------- Calcul “journée comptable” & TSr ---------- */
/** Renvoie la date (à minuit) du jour comptable = le jour qui porte le plus d’heures du service */
export function computeAccountingDate(
  start: Date,
  end: Date,
  meals: Meal[] = [],
  breaks: Break[] = []
): Date {
  const s = new Date(start), e = new Date(end);
  let cur = new Date(s);
  cur.setHours(0,0,0,0);

  const perDay = new Map<number, number>(); // timestamp minuit -> minutes
  while(cur < e){
    const next = new Date(cur); next.setDate(next.getDate()+1);
    const segS = new Date(Math.max(cur.getTime(),   s.getTime()));
    const segE = new Date(Math.min(next.getTime(), e.getTime()));
    const mins = minutesBetween(segS, segE);
    perDay.set(cur.getTime(), (perDay.get(cur.getTime()) ?? 0) + mins);
    cur = next;
  }

  let bestKey = Array.from(perDay.keys())[0];
  let bestVal = perDay.get(bestKey) ?? 0;
  for(const [k,v] of perDay){ 
    if(v>bestVal){ bestVal=v; bestKey=k; } 
  }
  return new Date(bestKey);
}

/** Déduit SO / R / RH depuis la “journée comptable” (Lun–Ven = SO, Sam = R, Dim = RH) */
export function dayTypeFromAccountingDate(accountingDate: Date): DayType {
  const dow = accountingDate.getDay(); // 0=Dim … 6=Sam
  if(dow===6) return 'R';
  if(dow===0) return 'RH';
  return 'SO';
}
