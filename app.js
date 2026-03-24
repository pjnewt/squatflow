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
  speechVoice: null,
  motionPhase: "idle",
  valleyDelta: 0,
  peakDelta: 0,
  descendStartTs: 0
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
  installBtn: document.getElementById("installBtn"),
  resetProgrammeBtn: document.getElementById("resetProgrammeBtn")
};

function getProgrammeDay(){
  const store = getStore();
  const programmeDay = parseInt(store.programmeDay || "1", 10);
  if (Number.isNaN(programmeDay) || programmeDay < 1 || programmeDay > 5) return 1;
  return programmeDay;
}
function setProgrammeDay(day){
  const store = getStore();
  store.programmeDay = Math.max(1, Math.min(5, day));
  setStore(store);
}
function currentExerciseFromProgramme() {
  const day = getProgrammeDay();
  return EXERCISES.find(x => x.day === day) || EXERCISES[0];
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
  state.exercise = currentExerciseFromProgramme();
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
  state.motionPhase = "idle";
  state.valleyDelta = 0;
  state.peakDelta = 0;
  state.descendStartTs = 0;
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
  const raw = e.acceleration || {x:0,y:0,z:0};
  if (!acc) return;

  const x = acc.x || 0, y = acc.y || 0, z = acc.z || 0;
  const mag = Math.sqrt(x*x + y*y + z*z);
  const pitch = Math.atan2(x, Math.sqrt(y*y + z*z));

  const rx = raw.x || 0, ry = raw.y || 0, rz = raw.z || 0;
  const rawMag = Math.sqrt(rx*rx + ry*ry + rz*rz);

  const alpha = 0.22;
  state.smoothPitch = state.smoothPitch == null ? pitch : state.smoothPitch*(1-alpha) + pitch*alpha;
  const p = state.smoothPitch;
  const now = Date.now();

  const sens = parseFloat(els.sensitivity.value || "0.55");

  if (state.pitchBaseline == null) state.pitchBaseline = p;
  if (state.lastPitch == null) state.lastPitch = p;

  // Slow adaptive baseline for grip drift, while preserving the squat movement arc
  state.pitchBaseline = state.pitchBaseline * 0.997 + p * 0.003;
  const deltaFromBase = p - state.pitchBaseline;
  const dp = p - state.lastPitch;

  // Automatic end-set detection
  if (Math.abs(deltaFromBase) < 0.14 && mag < 10.9 && mag > 8.0 && rawMag < 1.35) {
    if (!state.stillStart) state.stillStart = now;
    if ((now - state.stillStart) >= 3000) {
      finishCurrentSet("auto");
      return;
    }
  } else {
    state.stillStart = null;
  }

  // Tilt-dominant squat detector: descent -> bottom -> rise -> count
  const descendThreshold = -0.075 * sens;
  const bottomThreshold = -0.11 * sens;
  const riseNearTop = -0.01 * sens;
  const minRange = 0.09 * sens;
  const cooldown = 520;

  if (state.motionPhase === "idle") {
    if (deltaFromBase < descendThreshold && dp < -0.0015) {
      state.motionPhase = "down";
      state.descendStartTs = now;
      state.valleyDelta = deltaFromBase;
    }
  } else if (state.motionPhase === "down") {
    state.valleyDelta = Math.min(state.valleyDelta, deltaFromBase);

    if (state.valleyDelta < bottomThreshold && Math.abs(dp) < 0.012) {
      state.motionPhase = "bottom";
    }

    if (deltaFromBase > descendThreshold * 0.35 && (now - state.descendStartTs) < 250) {
      state.motionPhase = "idle";
      state.valleyDelta = 0;
    }
  } else if (state.motionPhase === "bottom") {
    state.valleyDelta = Math.min(state.valleyDelta, deltaFromBase);

    if (dp > 0.002 || deltaFromBase > state.valleyDelta + 0.025) {
      state.motionPhase = "up";
      state.peakDelta = deltaFromBase;
    }
  } else if (state.motionPhase === "up") {
    state.peakDelta = Math.max(state.peakDelta, deltaFromBase);
    const travelled = state.peakDelta - state.valleyDelta;
    const repReady =
      travelled > minRange &&
      deltaFromBase > riseNearTop &&
      (now - state.lastRepTs) > cooldown;

    if (repReady) {
      state.repCount += 1;
      state.totalReps += 1;
      state.lastRepTs = now;
      els.repCount.textContent = String(state.repCount);
      updateSummary();
      state.motionPhase = "idle";
      state.valleyDelta = 0;
      state.peakDelta = 0;
      if (state.repCount === 1) {
        els.coachText.textContent = "Good form. Keep a steady rhythm and work toward the onset of fatigue.";
      }
    }

    if (dp < -0.003 && deltaFromBase < descendThreshold) {
      state.motionPhase = "down";
      state.descendStartTs = now;
      state.valleyDelta = deltaFromBase;
      state.peakDelta = 0;
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

  const currentDay = getProgrammeDay();
  if (currentDay < 5) {
    setProgrammeDay(currentDay + 1);
  }

  updateWeekly();
  updateSummary();
  speak(`Exercise complete. Total reps ${summary.totalReps}. Exercise volume ${Math.round(summary.totalVolume)}.`);
  els.coachText.textContent = currentDay < 5
    ? `Exercise complete. Weekly totals updated. Next session is Day ${currentDay + 1}.`
    : "Exercise complete. Weekly totals updated. You have completed the 5 day programme.";
  renderExerciseInfo();
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
  if (!("serviceWorker" in navigator)) return;

  navigator.serviceWorker.register("./sw.js").then(reg => {
    if (reg.waiting) {
      reg.waiting.postMessage({ type: "SKIP_WAITING" });
    }

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
  if (els.resetProgrammeBtn) {
    els.resetProgrammeBtn.addEventListener("click", () => {
      setProgrammeDay(1);
      renderExerciseInfo();
      speak("Programme reset to Day 1.");
      appendLog("Programme reset to Day 1.");
      updateButtons();
    });
  }
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
  appendLog("Programme mode is active: the app advances from Day 1 to Day 5 only when you complete each exercise.");
  appendLog("Tip: this version is tuned more for real squat motion than quick phone pumping. Hold the phone steadily at chest height and keep it facing the same direction.");
}
window.addEventListener("load", init);
