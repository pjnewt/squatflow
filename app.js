const EXERCISES = [
  { day: 1, key: "back_squat", name: "Back Squat", mode: "double", placement: "Wear the backpack on your back for this exercise." },
  { day: 2, key: "bulgarian_squat", name: "Bulgarian Squat", mode: "single", placement: "Wear the backpack on your chest for this exercise." },
  { day: 3, key: "front_squat", name: "Front Squat", mode: "double", placement: "Wear the backpack on your chest for this exercise." },
  { day: 4, key: "side_step", name: "Side Step", mode: "single", placement: "Wear the backpack on your chest for this exercise." },
  { day: 5, key: "sumo_squat", name: "Sumo Squat", mode: "double", placement: "Wear the backpack on your chest for this exercise." }
];

const state = {
  exercise: null,
  phase: "ready", // ready|countdown|active|rest|complete
  setIndex: 0,
  setTargetMs: 0,
  repCount: 0,
  totalReps: 0,
  timerStart: 0,
  timerId: null,
  progressId: null,
  setResults: [],
  manualEndRequested: false,
  motionEnabled: false,
  deferredPrompt: null,
  pitchBaseline: null,
  lastPitch: null,
  lastValley: null,
  lastRepTs: 0,
  stillStart: null,
  smoothPitch: null,
  lastMotionTs: 0,
  loadKg: 0,
  side: "na",
  speechVoice: null
};

const els = {
  todayExercise: document.getElementById("todayExercise"),
  placementNote: document.getElementById("placementNote"),
  dayPill: document.getElementById("dayPill"),
  bodyWeight: document.getElementById("bodyWeight"),
  packLoad: document.getElementById("packLoad"),
  sideSelect: document.getElementById("sideSelect"),
  sensitivity: document.getElementById("sensitivity"),
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
  setLog: document.getElementById("setLog"),
  installBtn: document.getElementById("installBtn")
};

function todayExerciseFromDate() {
  const now = new Date();
  const jsDay = now.getDay(); // 0 Sun, 1 Mon...
  const mapped = jsDay === 0 ? 5 : Math.min(jsDay, 5); // Sun -> day 5 fallback
  return EXERCISES.find(x => x.day === mapped) || EXERCISES[0];
}

function two(n){ return String(n).padStart(2,"0"); }
function formatMs(ms){
  const total = Math.max(0, Math.round(ms/1000));
  return `${two(Math.floor(total/60))}:${two(total%60)}`;
}
function round1(n){ return Math.round(n*10)/10; }
function weekKey(d = new Date()) {
  const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const dayNum = date.getUTCDay() || 7;
  date.setUTCDate(date.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(),0,1));
  const weekNo = Math.ceil((((date - yearStart) / 86400000) + 1) / 7);
  return `${date.getUTCFullYear()}-W${String(weekNo).padStart(2,"0")}`;
}
function getStore(){
  try { return JSON.parse(localStorage.getItem("squatflow_data") || "{}"); }
  catch(e){ return {}; }
}
function setStore(obj){
  localStorage.setItem("squatflow_data", JSON.stringify(obj));
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
  const preferred = voices.find(v =>
    /en-GB|en_GB|English United Kingdom/i.test(v.lang + " " + v.name)
  ) || voices.find(v => /en/i.test(v.lang)) || null;
  if (preferred) u.voice = preferred;
  u.rate = 0.95;
  u.pitch = 0.95;
  speechSynthesis.speak(u);
}
function setPhase(phase){
  state.phase = phase;
  const labels = {ready:"Ready", countdown:"Countdown", active:"Working", rest:"Rest", complete:"Complete"};
  els.phaseLabel.textContent = labels[phase] || phase;
}
function renderExerciseInfo(){
  state.exercise = todayExerciseFromDate();
  els.todayExercise.textContent = state.exercise.name;
  els.dayPill.textContent = `Day ${state.exercise.day} of 5`;
  els.placementNote.textContent = state.exercise.placement;
  const single = state.exercise.mode === "single";
  els.sideSelect.disabled = !single;
  if (!single) els.sideSelect.value = "na";
}
function canStart(){
  if (!els.bodyWeight.value) return false;
  if (state.exercise.mode === "single" && els.sideSelect.value === "na") return false;
  return true;
}
function updateButtons(){
  els.startBtn.disabled = !canStart() || state.phase === "active" || state.phase === "countdown" || state.phase === "rest";
  els.endSetBtn.disabled = state.phase !== "active";
  const canAdjust = state.phase === "active" || state.phase === "complete";
  els.adjustMinusBtn.disabled = !canAdjust;
  els.adjustPlusBtn.disabled = !canAdjust;
}
function resetMotionCycle(){
  state.pitchBaseline = null;
  state.lastPitch = null;
  state.lastValley = null;
  state.stillStart = null;
  state.smoothPitch = null;
}
function requestMotionAccessIfNeeded(){
  if (typeof DeviceMotionEvent !== "undefined" && typeof DeviceMotionEvent.requestPermission === "function") {
    return DeviceMotionEvent.requestPermission()
      .then(result => {
        state.motionEnabled = result === "granted";
        if (!state.motionEnabled) speak("Motion access was not granted. You can still use manual rep adjustment and End Set.");
      })
      .catch(() => {
        state.motionEnabled = false;
      });
  }
  state.motionEnabled = true;
  return Promise.resolve();
}
function onMotion(e){
  if (state.phase !== "active") return;
  const acc = e.accelerationIncludingGravity || e.acceleration;
  if (!acc) return;
  const x = acc.x || 0, y = acc.y || 0, z = acc.z || 0;
  const mag = Math.sqrt(x*x + y*y + z*z);
  const pitch = Math.atan2(x, Math.sqrt(y*y + z*z)); // rough tilt
  const alpha = 0.15;
  state.smoothPitch = state.smoothPitch == null ? pitch : state.smoothPitch*(1-alpha) + pitch*alpha;
  const p = state.smoothPitch;
  const now = Date.now();
  const thresh = parseFloat(els.sensitivity.value || "0.7");
  if (state.pitchBaseline == null) state.pitchBaseline = p;

  // establish valley and peak based on tilt oscillation
  if (state.lastPitch == null) state.lastPitch = p;

  const deltaFromBase = p - state.pitchBaseline;

  // still/upright detection for automatic set end
  if (Math.abs(deltaFromBase) < 0.08 && mag < 10.6 && mag > 8.4) {
    if (!state.stillStart) state.stillStart = now;
    if ((now - state.stillStart) >= 3000) {
      finishCurrentSet("auto");
      return;
    }
  } else {
    state.stillStart = null;
  }

  // rep detection:
  // when user dips, valley becomes negative
  if (deltaFromBase < -thresh * 0.18) {
    state.lastValley = p;
  }
  // when user rises and crosses above baseline after valley, count a rep
  if (
    state.lastValley != null &&
    deltaFromBase > thresh * 0.08 &&
    now - state.lastRepTs > 650
  ) {
    state.repCount += 1;
    state.totalReps += 1;
    state.lastRepTs = now;
    state.pitchBaseline = state.pitchBaseline * 0.8 + p * 0.2;
    state.lastValley = null;
    els.repCount.textContent = String(state.repCount);
    updateSummary();
    if (state.repCount === 1) {
      els.coachText.textContent = "Good form. Keep a steady rhythm and work toward the onset of fatigue.";
    }
  }
  state.lastPitch = p;
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
      if (elapsed >= targetMs) {
        finishCurrentSet("timed");
      }
    } else {
      els.progressBar.style.width = "0%";
    }
  }, 100);
}
function startRestTicker(durationMs){
  clearTicker();
  const startTs = Date.now();
  state.timerId = setInterval(() => {
    const elapsed = Date.now() - startTs;
    const remain = Math.max(0, durationMs - elapsed);
    els.timer.textContent = formatMs(remain);
    const pct = Math.max(0, Math.min(100, (elapsed / durationMs) * 100));
    els.progressBar.style.width = `${pct}%`;
    if (remain <= 5000 && remain > 4200) speak("Five seconds");
    if (remain <= 0) {
      clearTicker();
      beginSet();
    }
  }, 100);
}
function clearTicker(){
  if (state.timerId) clearInterval(state.timerId);
  state.timerId = null;
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
    if (count > 0) {
      speak(String(count));
    } else if (count === 0) {
      speak("Go");
    } else {
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
  els.coachText.textContent = state.setIndex === 0
    ? "Maintain good form. Move regularly and rhythmically. Keep working until the onset of fatigue."
    : "Stay controlled. Keep good form and work steadily through the timed set.";
  speak(state.setIndex === 0
    ? "Maintain good form. Move regularly and rhythmically. Work to the onset of fatigue."
    : "Set started.");
  startTicker(state.setIndex === 0 ? 0 : state.setTargetMs);
  updateButtons();
}
function finishCurrentSet(reason){
  if (state.phase !== "active") return;
  clearTicker();
  const durationMs = Date.now() - state.timerStart;
  const result = {
    setNumber: state.setIndex + 1,
    reps: state.repCount,
    durationMs,
    endReason: reason
  };
  state.setResults.push(result);
  appendLog(`Set ${result.setNumber}: ${result.reps} reps in ${formatMs(result.durationMs)} (${reason === "auto" ? "auto end" : reason === "timed" ? "timed end" : "manual end"})`);

  const restMs = durationMs;
  const nextTarget = Math.round(durationMs * 0.75);

  speak(`Set complete. Duration ${Math.round(durationMs/1000)} seconds. Rest ${Math.round(restMs/1000)} seconds.`);
  updateSummary();

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
  els.timer.textContent = "00:00";
  els.progressBar.style.width = "100%";
  const summary = buildExerciseSummary();
  saveSession(summary);
  updateWeekly();
  updateSummary();
  speak(`Exercise complete. Total reps ${summary.totalReps}. Exercise volume ${Math.round(summary.totalVolume)}.`);
  els.coachText.textContent = "Exercise complete. Weekly totals have been updated.";
  updateButtons();
}
function buildExerciseSummary(){
  const totalReps = state.setResults.reduce((a,b)=>a+b.reps,0);
  const totalVolume = round1(totalReps * state.loadKg);
  let left = 0, right = 0;
  if (state.exercise.mode === "double") {
    left = totalVolume / 2;
    right = totalVolume / 2;
  } else if (state.side === "left") {
    left = totalVolume;
    right = 0;
  } else if (state.side === "right") {
    left = 0;
    right = totalVolume;
  }
  return {
    exerciseKey: state.exercise.key,
    exerciseName: state.exercise.name,
    side: state.side,
    date: new Date().toISOString(),
    week: weekKey(),
    loadKg: state.loadKg,
    totalReps,
    totalVolume: round1(totalVolume),
    leftVolume: round1(left),
    rightVolume: round1(right),
    sets: state.setResults.slice()
  };
}
function saveSession(summary){
  const store = getStore();
  if (!store.sessions) store.sessions = [];
  store.sessions.push(summary);
  setStore(store);
}
function updateSummary(){
  const summary = state.setResults.length ? buildExerciseSummary() : {
    totalReps: state.totalReps || 0,
    totalVolume: round1((state.totalReps || 0) * state.loadKg),
    leftVolume: state.exercise && state.exercise.mode === "double" ? round1(((state.totalReps || 0) * state.loadKg)/2) : 0,
    rightVolume: state.exercise && state.exercise.mode === "double" ? round1(((state.totalReps || 0) * state.loadKg)/2) : 0
  };
  els.exerciseReps.textContent = String(summary.totalReps || 0);
  els.exerciseVolume.textContent = String(Math.round(summary.totalVolume || 0));
  let left = summary.leftVolume || 0;
  let right = summary.rightVolume || 0;
  if (state.exercise && state.exercise.mode === "single" && !state.setResults.length) {
    const liveVol = round1((state.totalReps || 0) * state.loadKg);
    if (state.side === "left") { left = liveVol; right = 0; }
    if (state.side === "right") { left = 0; right = liveVol; }
  }
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
    const item = document.createElement("div");
    item.className = "weekly-item";
    item.innerHTML = `<span>No sessions saved this week yet.</span><strong>0</strong>`;
    els.weeklyBreakdown.appendChild(item);
    return;
  }
  Object.entries(breakdown).sort((a,b)=>b[1]-a[1]).forEach(([name,val]) => {
    const item = document.createElement("div");
    item.className = "weekly-item";
    item.innerHTML = `<span>${name}</span><strong>${Math.round(val)}</strong>`;
    els.weeklyBreakdown.appendChild(item);
  });
}
function resetSessionState(){
  state.setIndex = 0;
  state.setTargetMs = 0;
  state.repCount = 0;
  state.totalReps = 0;
  state.setResults = [];
  state.side = els.sideSelect.value;
  els.repCount.textContent = "0";
  els.timer.textContent = "00:00";
  els.setLog.innerHTML = "";
  els.progressBar.style.width = "0%";
  updateSummary();
}
async function startWorkout(){
  updateExerciseLoad();
  state.side = els.sideSelect.value;
  if (!canStart()) {
    speak("Please enter body weight and select a side when needed.");
    return;
  }
  await requestMotionAccessIfNeeded();
  resetSessionState();
  countdownThenStart();
  updateButtons();
}
function manualEndSet(){
  finishCurrentSet("manual");
}
function adjustReps(delta){
  if (!(state.phase === "active" || state.phase === "complete")) return;
  const next = Math.max(0, state.repCount + delta);
  const totalNext = Math.max(0, state.totalReps + delta);
  state.repCount = next;
  state.totalReps = totalNext;
  els.repCount.textContent = String(state.repCount);
  updateSummary();
}
function registerSW(){
  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("./sw.js").catch(()=>{});
  }
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
  [els.bodyWeight, els.packLoad].forEach(el => el.addEventListener("input", () => {
    updateExerciseLoad();
    updateButtons();
  }));
  els.sideSelect.addEventListener("change", () => {
    state.side = els.sideSelect.value;
    updateButtons();
    updateSummary();
  });
  els.sensitivity.addEventListener("change", () => {
    appendLog(`Sensitivity set to ${els.sensitivity.options[els.sensitivity.selectedIndex].text}.`);
  });
  els.startBtn.addEventListener("click", startWorkout);
  els.endSetBtn.addEventListener("click", manualEndSet);
  els.adjustMinusBtn.addEventListener("click", () => adjustReps(-1));
  els.adjustPlusBtn.addEventListener("click", () => adjustReps(1));
  window.addEventListener("devicemotion", onMotion);
  document.addEventListener("visibilitychange", () => {
    if (document.hidden && state.phase === "active") appendLog("App was backgrounded during an active set.");
  });
}
function init(){
  renderExerciseInfo();
  updateExerciseLoad();
  updateWeekly();
  setPhase("ready");
  bindEvents();
  updateButtons();
  registerSW();
  installHandling();
  appendLog("Tip: hold the phone consistently at chest height. Start with High sensitivity; use Very High if reps are under-counted.");
}
window.addEventListener("load", init);
