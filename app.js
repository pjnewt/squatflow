const EXERCISES = [
  { day: 1, key: "back_squat", name: "Back Squat", mode: "double", placement: "Wear the backpack on your back for this exercise.", icon: "🏋️" },
  { day: 2, key: "bulgarian_squat", name: "Bulgarian Squat", mode: "single", placement: "Wear the backpack on your chest for this exercise.", icon: "🦵" },
  { day: 3, key: "front_squat", name: "Front Squat", mode: "double", placement: "Wear the backpack on your chest for this exercise.", icon: "🎒" },
  { day: 4, key: "side_step", name: "Side Step", mode: "single", placement: "Wear the backpack on your chest for this exercise.", icon: "↔️" },
  { day: 5, key: "sumo_squat", name: "Sumo Squat", mode: "double", placement: "Wear the backpack on your chest for this exercise.", icon: "⬇️" }
];

const CALIBRATION_SAMPLES = 40;
const SILENCE_MS = 3000;
const MIN_REP_GAP_MS = 350;
const ADAPTIVE_RATE = 0.003;
const TROUGH_FACTOR = 0.88;
const SENS_MAP = { 1: 1.55, 2: 1.45, 3: 1.35, 4: 1.25, 5: 1.18 };

const state = {
  currentScreen: "home",
  mode: "free", // free | programme
  exercise: null,
  phase: "ready",
  setIndex: 0,
  setTargetMs: 0,
  repCount: 0,
  totalReps: 0,
  timerStart: 0,
  timerId: null,
  setResults: [],
  motionEnabled: false,
  deferredPrompt: null,
  loadKg: 0,
  side: "na",
  calibSamples: [],
  baseline: 9.8,
  dynThreshold: 13,
  inPeak: false,
  lastPeakTime: 0,
  silenceTimer: null,
  sampleCount: 0,
  lastSampleTime: 0,
  sampleHz: 0
};

const els = {
  homeBtn: document.getElementById("homeBtn"),
  installBtn: document.getElementById("installBtn"),
  homeScreen: document.getElementById("homeScreen"),
  programmeScreen: document.getElementById("programmeScreen"),
  workoutScreen: document.getElementById("workoutScreen"),
  freeModeBtn: document.getElementById("freeModeBtn"),
  programmeModeBtn: document.getElementById("programmeModeBtn"),
  exerciseGrid: document.getElementById("exerciseGrid"),
  programmeList: document.getElementById("programmeList"),
  programmeStatus: document.getElementById("programmeStatus"),
  programmeCoach: document.getElementById("programmeCoach"),
  programmeLog: document.getElementById("programmeLog"),
  resetProgrammeBtn: document.getElementById("resetProgrammeBtn"),
  todayExercise: document.getElementById("todayExercise"),
  placementNote: document.getElementById("placementNote"),
  dayPill: document.getElementById("dayPill"),
  bodyWeight: document.getElementById("bodyWeight"),
  packLoad: document.getElementById("packLoad"),
  sideSelect: document.getElementById("sideSelect"),
  sensitivity: document.getElementById("sensitivity"),
  sensitivityValue: document.getElementById("sensitivityValue"),
  exerciseLoad: document.getElementById("exerciseLoad"),
  weeklyTotal: document.getElementById("weeklyTotal"),
  phaseLabel: document.getElementById("phaseLabel"),
  setLabel: document.getElementById("setLabel"),
  timer: document.getElementById("timer"),
  repCount: document.getElementById("repCount"),
  progressBar: document.getElementById("progressBar"),
  coachText: document.getElementById("coachText"),
  startBtn: document.getElementById("startBtn"),
  endSetBtn: document.getElementById("endSetBtn"),
  adjustMinusBtn: document.getElementById("adjustMinusBtn"),
  adjustPlusBtn: document.getElementById("adjustPlusBtn"),
  exerciseReps: document.getElementById("exerciseReps"),
  exerciseVolume: document.getElementById("exerciseVolume"),
  leftVolume: document.getElementById("leftVolume"),
  rightVolume: document.getElementById("rightVolume"),
  imbalance: document.getElementById("imbalance"),
  weeklyBreakdown: document.getElementById("weeklyBreakdown"),
  setLog: document.getElementById("setLog")
};

function getStore(){
  try { return JSON.parse(localStorage.getItem("squatflow_data") || "{}"); }
  catch(e){ return {}; }
}
function setStore(obj){ localStorage.setItem("squatflow_data", JSON.stringify(obj)); }

function two(n){ return String(n).padStart(2,"0"); }
function formatMs(ms){
  const total = Math.max(0, Math.round(ms/1000));
  return `${two(Math.floor(total/60))}:${two(total%60)}`;
}
function round1(n){ return Math.round(n*10)/10; }
function toDateStr(d){ return new Date(d).toISOString().slice(0,10); }
function parseDateOnly(str){ return new Date(`${str}T00:00:00`); }
function diffDays(a,b){
  const ms = parseDateOnly(a) - parseDateOnly(b);
  return Math.round(ms / 86400000);
}
function todayStr(){ return new Date().toISOString().slice(0,10); }
function prettyDate(s){
  const d = new Date(`${s}T12:00:00`);
  return d.toLocaleDateString(undefined, { weekday:"short", day:"numeric", month:"short", year:"numeric" });
}
function weekKey(d = new Date()) {
  const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const dayNum = date.getUTCDay() || 7;
  date.setUTCDate(date.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(),0,1));
  const weekNo = Math.ceil((((date - yearStart) / 86400000) + 1) / 7);
  return `${date.getUTCFullYear()}-W${String(weekNo).padStart(2,"0")}`;
}
function peakFactor(){
  const val = parseInt(els.sensitivity.value || "3", 10);
  return SENS_MAP[val] || 1.35;
}
function updateSensitivityLabel(){
  els.sensitivityValue.textContent = String(els.sensitivity.value || "3");
}
function loadCalculatedKg(){
  const bw = parseFloat(els.bodyWeight.value) || 0;
  const pack = parseFloat(els.packLoad.value) || 0;
  return round1((bw * 0.70) + pack);
}
function updateExerciseLoad(){
  state.loadKg = loadCalculatedKg();
  els.exerciseLoad.textContent = `${state.loadKg.toFixed(1)} kg`;
  updateSummary();
}
function speak(text){
  els.coachText.textContent = text;
  if (!("speechSynthesis" in window)) return;
  window.speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(text);
  const voices = speechSynthesis.getVoices();
  const preferred = voices.find(v => /en-GB|en_GB|English United Kingdom/i.test(v.lang + " " + v.name))
    || voices.find(v => /en/i.test(v.lang)) || null;
  if (preferred) u.voice = preferred;
  u.rate = 0.95;
  u.pitch = 0.95;
  speechSynthesis.speak(u);
}
function showScreen(name){
  state.currentScreen = name;
  ["homeScreen","programmeScreen","workoutScreen"].forEach(id => {
    document.getElementById(id).classList.toggle("active", id === `${name}Screen`);
  });
  els.homeBtn.hidden = name === "home";
}
function setPhase(phase){
  state.phase = phase;
  const labels = {ready:"Ready", countdown:"Countdown", active:"Working", rest:"Rest", complete:"Complete"};
  els.phaseLabel.textContent = labels[phase] || phase;
}
function setSessionExercise(exercise, mode){
  state.exercise = exercise;
  state.mode = mode || "free";
  els.todayExercise.textContent = exercise.name;
  els.placementNote.textContent = exercise.placement;
  els.dayPill.textContent = state.mode === "programme" ? `Day ${exercise.day}` : "Free";
  const single = exercise.mode === "single";
  els.sideSelect.disabled = !single;
  if (!single) els.sideSelect.value = "na";
  resetSessionUI();
  updateButtons();
}
function resetSessionUI(){
  state.setIndex = 0;
  state.setTargetMs = 0;
  state.repCount = 0;
  state.totalReps = 0;
  state.setResults = [];
  clearTicker();
  if (state.silenceTimer) clearTimeout(state.silenceTimer);
  state.silenceTimer = null;
  els.repCount.textContent = "0";
  els.timer.textContent = "00:00";
  els.setLabel.textContent = "0 / 4";
  els.progressBar.style.width = "0%";
  els.setLog.innerHTML = "";
  setPhase("ready");
  els.coachText.textContent = "Enter your details, then press Start.";
  updateSummary();
}
function exerciseCardHtml(ex){
  const sideTxt = ex.mode === "single" ? "Left / Right" : "Both legs";
  return `
    <div class="exercise-card">
      <div class="exercise-illus">${ex.icon}</div>
      <div class="exercise-body">
        <div class="exercise-name">${ex.name}</div>
        <div class="exercise-meta">${sideTxt}<br>${ex.placement}</div>
        <div class="inline-actions">
          <button data-free="${ex.key}">Free Selection</button>
        </div>
      </div>
    </div>`;
}
function renderHome(){
  els.exerciseGrid.innerHTML = EXERCISES.map(exerciseCardHtml).join("");
  els.exerciseGrid.querySelectorAll("[data-free]").forEach(btn => {
    btn.addEventListener("click", () => {
      const ex = EXERCISES.find(x => x.key === btn.dataset.free);
      setSessionExercise(ex, "free");
      showScreen("workout");
      speak(`Free selection. ${ex.name}.`);
    });
  });
}
function getProgrammeState(){
  const store = getStore();
  if (!store.programme) {
    store.programme = { nextDay: 1, lastCompletedDate: null, log: [], lastResetReason: null };
    setStore(store);
  }
  return store.programme;
}
function setProgrammeState(prog){
  const store = getStore();
  store.programme = prog;
  setStore(store);
}
function resetProgramme(reason = "manual"){
  const prog = { nextDay: 1, lastCompletedDate: null, log: [], lastResetReason: reason };
  setProgrammeState(prog);
  renderProgramme();
}
function evaluateProgrammeState(){
  const prog = getProgrammeState();
  if (!prog.lastCompletedDate) return { status: "ready", currentDay: 1, available: true, message: "Day 1 ready" };

  const elapsed = diffDays(todayStr(), prog.lastCompletedDate);
  if (prog.nextDay > 5) {
    return { status: "complete", currentDay: 5, available: false, message: "5 day programme complete" };
  }
  if (elapsed <= 0) {
    return { status: "wait", currentDay: prog.nextDay, available: false, message: `Next available tomorrow for Day ${prog.nextDay}` };
  }
  if (elapsed <= 2) {
    return { status: "ready", currentDay: prog.nextDay, available: true, message: `Day ${prog.nextDay} available` };
  }
  prog.nextDay = 1;
  prog.lastCompletedDate = null;
  prog.log = [];
  prog.lastResetReason = "missed window";
  setProgrammeState(prog);
  return { status: "restart", currentDay: 1, available: true, message: "More than 2 days elapsed. Restart from Day 1." };
}
function renderProgramme(){
  const prog = getProgrammeState();
  const evalState = evaluateProgrammeState();
  els.programmeStatus.textContent = evalState.message;
  els.programmeCoach.textContent = evalState.status === "wait"
    ? `You completed the last programme exercise on ${prettyDate(prog.lastCompletedDate)}. The next exercise becomes available tomorrow and remains valid for one additional day.`
    : evalState.status === "restart"
      ? "More than 2 days passed between programme sessions, so the programme has been reset to Day 1."
      : "Complete one exercise per day. The next day becomes available the following day and stays valid for up to 2 days.";

  const logByDay = {};
  (prog.log || []).forEach(item => { logByDay[item.day] = item; });

  els.programmeList.innerHTML = EXERCISES.map(ex => {
    const done = !!logByDay[ex.day];
    const current = evalState.available && evalState.currentDay === ex.day;
    const locked = !done && !current;
    const note = done
      ? `Completed ${prettyDate(logByDay[ex.day].date)}`
      : current
        ? `Available now`
        : ex.day < evalState.currentDay && prog.nextDay > 1
          ? "Waiting for logged completion"
          : "Locked";
    return `
      <div class="programme-item ${done ? "done" : ""} ${current ? "current" : ""} ${locked ? "locked" : ""}">
        <div class="row">
          <div class="exercise-name">Day ${ex.day} · ${ex.name}</div>
          <div class="pill">${done ? "Done" : current ? "Ready" : "Locked"}</div>
        </div>
        <div class="small-note">${note}</div>
        <div class="small-note">${ex.placement}</div>
        <div class="inline-actions">
          ${current ? `<button data-programme-start="${ex.day}">Start Day ${ex.day}</button>` : ""}
        </div>
      </div>`;
  }).join("");

  els.programmeList.querySelectorAll("[data-programme-start]").forEach(btn => {
    btn.addEventListener("click", () => {
      const day = parseInt(btn.dataset.programmeStart, 10);
      const ex = EXERCISES.find(x => x.day === day);
      setSessionExercise(ex, "programme");
      showScreen("workout");
      speak(`Programme mode. Day ${day}. ${ex.name}.`);
    });
  });

  const log = prog.log || [];
  els.programmeLog.innerHTML = log.length
    ? log.slice().reverse().map(item => `<div class="log-item">Day ${item.day}: ${item.exerciseName} · ${prettyDate(item.date)}</div>`).join("")
    : `<div class="log-item">No programme sessions logged yet.</div>`;
}
function canStart(){
  if (!state.exercise) return false;
  if (!els.bodyWeight.value) return false;
  if (state.exercise.mode === "single" && els.sideSelect.value === "na") return false;
  return true;
}
function updateButtons(){
  els.startBtn.disabled = !canStart() || ["active","countdown","rest"].includes(state.phase);
  els.endSetBtn.disabled = state.phase !== "active";
  const canAdjust = state.phase === "active" || state.phase === "complete";
  els.adjustMinusBtn.disabled = !canAdjust;
  els.adjustPlusBtn.disabled = !canAdjust;
}
function updateSummary(){
  let totalReps = state.setResults.reduce((a,b)=>a+b.reps,0);
  if (!state.setResults.length) totalReps = state.totalReps || 0;
  const totalVolume = round1(totalReps * state.loadKg);
  let left = 0, right = 0;
  if (state.exercise?.mode === "double") {
    left = totalVolume / 2; right = totalVolume / 2;
  } else if (state.side === "left") {
    left = totalVolume;
  } else if (state.side === "right") {
    right = totalVolume;
  }
  els.exerciseReps.textContent = String(totalReps);
  els.exerciseVolume.textContent = String(Math.round(totalVolume));
  els.leftVolume.textContent = String(Math.round(left));
  els.rightVolume.textContent = String(Math.round(right));
  updateImbalance(left, right);
}
function updateImbalance(left, right){
  const total = left + right;
  if (total <= 0) {
    els.imbalance.textContent = "Balanced";
    els.imbalance.className = "flag ok";
    return;
  }
  const leftPct = (left / total) * 100;
  const rightPct = (right / total) * 100;
  const diff = Math.abs(leftPct - rightPct);
  if (diff > 10) {
    els.imbalance.textContent = `Imbalance flagged: Left ${leftPct.toFixed(1)}% / Right ${rightPct.toFixed(1)}%`;
    els.imbalance.className = "flag warn";
  } else {
    els.imbalance.textContent = `Balanced: Left ${leftPct.toFixed(1)}% / Right ${rightPct.toFixed(1)}%`;
    els.imbalance.className = "flag ok";
  }
}
function appendLog(text){
  const div = document.createElement("div");
  div.className = "log-item";
  div.textContent = text;
  els.setLog.prepend(div);
}
function buildSessionSummary(){
  const totalReps = state.setResults.reduce((a,b)=>a+b.reps,0);
  const totalVolume = round1(totalReps * state.loadKg);
  let left = 0, right = 0;
  if (state.exercise.mode === "double") {
    left = totalVolume / 2; right = totalVolume / 2;
  } else if (state.side === "left") left = totalVolume;
  else if (state.side === "right") right = totalVolume;
  return {
    exerciseKey: state.exercise.key,
    exerciseName: state.exercise.name,
    side: state.side,
    date: new Date().toISOString(),
    week: weekKey(),
    loadKg: state.loadKg,
    totalReps,
    totalVolume,
    leftVolume: round1(left),
    rightVolume: round1(right),
    mode: state.mode,
    sets: state.setResults.slice()
  };
}
function saveSession(summary){
  const store = getStore();
  if (!store.sessions) store.sessions = [];
  store.sessions.push(summary);

  if (summary.mode === "programme") {
    const prog = getProgrammeState();
    const d = todayStr();
    prog.log = (prog.log || []).filter(item => item.day !== state.exercise.day);
    prog.log.push({ day: state.exercise.day, exerciseName: state.exercise.name, date: d });
    prog.lastCompletedDate = d;
    prog.nextDay = Math.min(6, state.exercise.day + 1);
    prog.lastResetReason = null;
    store.programme = prog;
  }
  setStore(store);
}
function updateWeekly(){
  const store = getStore();
  const sessions = (store.sessions || []).filter(s => s.week === weekKey());
  const breakdown = {};
  let total = 0;
  sessions.forEach(s => {
    const label = s.exerciseName + (s.side && s.side !== "na" ? ` (${s.side})` : "");
    breakdown[label] = (breakdown[label] || 0) + (s.totalVolume || 0);
    total += (s.totalVolume || 0);
  });
  els.weeklyTotal.textContent = String(Math.round(total));
  els.weeklyBreakdown.innerHTML = "";
  if (!sessions.length) {
    els.weeklyBreakdown.innerHTML = `<div class="weekly-item"><span>No sessions saved this week yet.</span><strong>0</strong></div>`;
    return;
  }
  Object.entries(breakdown).sort((a,b)=>b[1]-a[1]).forEach(([name,val]) => {
    const item = document.createElement("div");
    item.className = "weekly-item";
    item.innerHTML = `<span>${name}</span><strong>${Math.round(val)}</strong>`;
    els.weeklyBreakdown.appendChild(item);
  });
}
function requestMotionAccessIfNeeded(){
  if (typeof DeviceMotionEvent !== "undefined" && typeof DeviceMotionEvent.requestPermission === "function") {
    return DeviceMotionEvent.requestPermission().then(result => {
      state.motionEnabled = result === "granted";
      if (!state.motionEnabled) speak("Motion access was not granted. You can still use manual rep adjustment and End Set.");
    }).catch(() => { state.motionEnabled = false; });
  }
  state.motionEnabled = true;
  return Promise.resolve();
}
function armSilenceTimer(){
  if (state.silenceTimer) clearTimeout(state.silenceTimer);
  if (state.phase !== "active") return;
  state.silenceTimer = setTimeout(() => {
    if (state.phase === "active" && state.repCount > 0) finishCurrentSet("auto");
  }, SILENCE_MS);
}
function resetMotionCycle(){
  state.calibSamples = [];
  state.baseline = 9.8;
  state.dynThreshold = 13;
  state.inPeak = false;
  state.lastPeakTime = 0;
  state.sampleCount = 0;
  state.lastSampleTime = 0;
  state.sampleHz = 0;
  if (state.silenceTimer) clearTimeout(state.silenceTimer);
  state.silenceTimer = null;
}
function onMotion(e){
  if (state.phase !== "active") return;
  const a = e.accelerationIncludingGravity || e.acceleration;
  if (!a) return;

  const x = a.x || 0, y = a.y || 0, z = a.z || 0;
  const mag = Math.sqrt(x*x + y*y + z*z);
  const now = Date.now();

  state.sampleCount++;
  if (!state.lastSampleTime) state.lastSampleTime = now;
  if (now - state.lastSampleTime >= 1000) {
    state.sampleHz = state.sampleCount;
    state.sampleCount = 0;
    state.lastSampleTime = now;
  }

  if (state.calibSamples.length < CALIBRATION_SAMPLES) {
    state.calibSamples.push(mag);
    const progress = Math.round((state.calibSamples.length / CALIBRATION_SAMPLES) * 100);
    els.coachText.textContent = `Calibrating... ${progress}% — hold the phone in your normal chest-height position.`;
    if (state.calibSamples.length >= CALIBRATION_SAMPLES) {
      state.baseline = state.calibSamples.reduce((a,b)=>a+b,0) / state.calibSamples.length;
      state.dynThreshold = state.baseline * peakFactor();
      els.coachText.textContent = "Sensor active. Start squatting with regular rhythm and good form.";
      armSilenceTimer();
    }
    return;
  }

  const pf = peakFactor();

  if (!state.inPeak && mag > state.dynThreshold) {
    if (now - state.lastPeakTime > MIN_REP_GAP_MS) {
      state.inPeak = true;
      state.lastPeakTime = now;
    }
  } else if (state.inPeak && mag < state.baseline * TROUGH_FACTOR) {
    state.inPeak = false;
    state.repCount += 1;
    state.totalReps += 1;
    els.repCount.textContent = String(state.repCount);
    updateSummary();
    armSilenceTimer();
    if (state.repCount === 1) {
      els.coachText.textContent = "Good form. Keep a steady rhythm and work toward the onset of fatigue.";
    }
  }

  state.baseline = state.baseline * (1 - ADAPTIVE_RATE) + mag * ADAPTIVE_RATE;
  state.dynThreshold = state.baseline * pf;
}
function clearTicker(){
  if (state.timerId) clearInterval(state.timerId);
  state.timerId = null;
}
function startTicker(targetMs = 0){
  clearTicker();
  const startTs = state.timerStart;
  state.timerId = setInterval(() => {
    const elapsed = Date.now() - startTs;
    els.timer.textContent = formatMs(elapsed);
    if (targetMs > 0) {
      const pct = Math.max(0, Math.min(100, (elapsed / targetMs) * 100));
      els.progressBar.style.width = `${pct}%`;
      if (elapsed >= targetMs) finishCurrentSet("timed");
    } else {
      els.progressBar.style.width = "0%";
    }
  }, 100);
}
function startRestTicker(durationMs){
  clearTicker();
  const startTs = Date.now();
  let warned5 = false;
  state.timerId = setInterval(() => {
    const elapsed = Date.now() - startTs;
    const remain = Math.max(0, durationMs - elapsed);
    els.timer.textContent = formatMs(remain);
    const pct = Math.max(0, Math.min(100, (elapsed / durationMs) * 100));
    els.progressBar.style.width = `${pct}%`;
    if (!warned5 && remain <= 5000) {
      warned5 = true;
      speak("Five seconds");
    }
    if (remain <= 0) {
      clearTicker();
      beginSet();
    }
  }, 100);
}
function countdownThenStart(){
  setPhase("countdown");
  els.setLabel.textContent = `${state.setIndex + 1} / 4`;
  els.repCount.textContent = "0";
  els.timer.textContent = "00:00";
  els.progressBar.style.width = "0%";
  let count = 3;
  speak("Three");
  const id = setInterval(() => {
    count -= 1;
    if (count > 0) speak(String(count));
    else if (count === 0) speak("Go");
    else {
      clearInterval(id);
      beginSet();
    }
  }, 1000);
}
function beginSet(){
  setPhase("active");
  resetMotionCycle();
  state.repCount = 0;
  state.timerStart = Date.now();
  els.repCount.textContent = "0";
  els.setLabel.textContent = `${state.setIndex + 1} / 4`;
  els.coachText.textContent = "Calibrating from your held position, then begin the set.";
  startTicker(state.setIndex === 0 ? 0 : state.setTargetMs);
  updateButtons();
}
function finishCurrentSet(reason){
  if (state.phase !== "active") return;
  clearTicker();
  if (state.silenceTimer) clearTimeout(state.silenceTimer);
  state.silenceTimer = null;
  const durationMs = Date.now() - state.timerStart;
  const result = { setNumber: state.setIndex + 1, reps: state.repCount, durationMs, endReason: reason };
  state.setResults.push(result);
  appendLog(`Set ${result.setNumber}: ${result.reps} reps in ${formatMs(result.durationMs)} (${reason})`);
  updateSummary();

  const restMs = durationMs;
  const nextTarget = Math.round(durationMs * 0.75);
  speak(`Set complete. Duration ${Math.round(durationMs/1000)} seconds. Rest ${Math.round(restMs/1000)} seconds.`);

  state.setIndex += 1;
  if (state.setIndex >= 4) {
    finalizeExercise();
    return;
  }
  state.setTargetMs = nextTarget;
  setPhase("rest");
  els.setLabel.textContent = `${state.setIndex} / 4 complete`;
  els.progressBar.style.width = "0%";
  els.coachText.textContent = `Rest for ${Math.round(restMs/1000)} seconds. Next set duration is ${Math.round(nextTarget/1000)} seconds.`;
  startRestTicker(restMs);
  updateButtons();
}
function finalizeExercise(){
  setPhase("complete");
  clearTicker();
  if (state.silenceTimer) clearTimeout(state.silenceTimer);
  state.silenceTimer = null;
  els.timer.textContent = "00:00";
  els.progressBar.style.width = "100%";
  const summary = buildSessionSummary();
  saveSession(summary);
  updateWeekly();
  updateSummary();

  if (state.mode === "programme") {
    renderProgramme();
  }
  speak(`Exercise complete. Total reps ${summary.totalReps}. Exercise volume ${Math.round(summary.totalVolume)}.`);
  els.coachText.textContent = state.mode === "programme"
    ? "Exercise complete. Session logged to the 5 day programme."
    : "Exercise complete. Session saved.";
  updateButtons();
}
function startWorkout(){
  updateExerciseLoad();
  state.side = els.sideSelect.value;
  if (!canStart()) {
    speak("Please enter body weight and select a side when needed.");
    return;
  }
  requestMotionAccessIfNeeded().then(() => {
    state.side = els.sideSelect.value;
    countdownThenStart();
    updateButtons();
  });
}
function manualEndSet(){ finishCurrentSet("manual"); }
function adjustReps(delta){
  if (!(state.phase === "active" || state.phase === "complete")) return;
  state.repCount = Math.max(0, state.repCount + delta);
  state.totalReps = Math.max(0, state.totalReps + delta);
  els.repCount.textContent = String(state.repCount);
  updateSummary();
}
function registerSW(){
  if (!("serviceWorker" in navigator)) return;
  navigator.serviceWorker.register("./sw.js").then(reg => {
    if (reg.waiting) reg.waiting.postMessage({ type: "SKIP_WAITING" });
    reg.addEventListener("updatefound", () => {
      const newWorker = reg.installing;
      if (!newWorker) return;
      newWorker.addEventListener("statechange", () => {
        if (newWorker.state === "installed" && navigator.serviceWorker.controller) {
          newWorker.postMessage({ type: "SKIP_WAITING" });
        }
      });
    });
    let refreshed = false;
    navigator.serviceWorker.addEventListener("controllerchange", () => {
      if (refreshed) return;
      refreshed = true;
      window.location.reload();
    });
  }).catch(()=>{});
}
function installHandling(){
  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault();
    state.deferredPrompt = e;
    els.installBtn.hidden = false;
  });
  els.installBtn.addEventListener("click", async () => {
    if (!state.deferredPrompt) return;
    state.deferredPrompt.prompt();
    await state.deferredPrompt.userChoice;
    state.deferredPrompt = null;
    els.installBtn.hidden = true;
  });
}
function bindEvents(){
  els.homeBtn.addEventListener("click", () => showScreen("home"));
  els.freeModeBtn.addEventListener("click", () => {
    state.mode = "free";
    showScreen("home");
    speak("Free Selection mode.");
  });
  els.programmeModeBtn.addEventListener("click", () => {
    state.mode = "programme";
    renderProgramme();
    showScreen("programme");
    speak("5 Day Programme.");
  });
  els.resetProgrammeBtn.addEventListener("click", () => {
    resetProgramme("manual");
    speak("Programme reset to Day 1.");
  });

  [els.bodyWeight, els.packLoad].forEach(el => el.addEventListener("input", () => {
    updateExerciseLoad();
    updateButtons();
  }));
  els.sideSelect.addEventListener("change", () => {
    state.side = els.sideSelect.value;
    updateButtons();
    updateSummary();
  });
  els.sensitivity.addEventListener("input", () => {
    updateSensitivityLabel();
    appendLog(`Sensitivity set to ${els.sensitivity.value}.`);
  });
  els.startBtn.addEventListener("click", startWorkout);
  els.endSetBtn.addEventListener("click", manualEndSet);
  els.adjustMinusBtn.addEventListener("click", () => adjustReps(-1));
  els.adjustPlusBtn.addEventListener("click", () => adjustReps(1));

  window.addEventListener("devicemotion", onMotion);
}
function init(){
  renderHome();
  renderProgramme();
  updateSensitivityLabel();
  updateExerciseLoad();
  updateWeekly();
  bindEvents();
  setPhase("ready");
  updateButtons();
  registerSW();
  installHandling();
}
window.addEventListener("load", init);
