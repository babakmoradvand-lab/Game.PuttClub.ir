/* PuttClub UI controller. Classic script intentionally shares the existing engine's
   lexical state. Presentation never changes GOLF_BAG / shot-spec / physics values. */
(() => {
  "use strict";
  const $ = (id) => document.getElementById(id);
  const modes = ["chip", "half", "three-quarter", "full"];
  const modeNames = {
    full: "Full Swing",
    "three-quarter": "Three-Quarter",
    half: "Half Swing",
    chip: "Chip Shot",
  };
  const powers = { full: 100, "three-quarter": 75, half: 50, chip: 25 };
  const skills = {
    beginner: "Beginner",
    mid: "Mid Handicap",
    low: "Low Handicap",
    scratch: "Tour Pro",
  };
  let skill = window.currentHandicap || "scratch",
    course = window.activeCourseId || "mis";
  let step = "handicap",
    panel = null,
    returnFocus = null,
    started = false;
  let toastTimer,
    lastBusy,
    offlineReady = false;
  const panelIds = [
    "club-picker-modal",
    "swing-picker-modal",
    "menu-modal",
    "settings-panel",
  ];
  const screenIds = {
    handicap: "handicap-select-modal",
    course: "course-select-modal",
    mode: "mode-select-modal",
    holes: "custom-hole-modal",
  };
  const listen = (id, fn) => $(id)?.addEventListener("click", fn);
  const icon = (name) =>
    `<svg class="icon" aria-hidden="true"><use href="#i-${name}"/></svg>`;
  function toast(text) {
    clearTimeout(toastTimer);
    const el = $("cache-indicator");
    el.textContent = text;
    el.hidden = false;
    toastTimer = setTimeout(() => (el.hidden = true), 4500);
  }
  function focusFirst(el) {
    const candidate = el.querySelector(
      "button:not(:disabled),input,select,summary",
    );
    candidate?.focus({ preventScroll: true });
  }
  function showTitle() {
    closePanel(false);
    $("setup-shell").hidden = true;
    $("game-ui").hidden = true;
    $("putt-club-splash").hidden = false;
    document.body.dataset.view = "menu";
    $("btn-splash-enter").innerHTML =
      (started ? "Resume round" : "Play golf") +
      icon("arrow") +
      '<small lang="fa">' +
      (started ? "ادامه بازی" : "شروع بازی") +
      "</small>";
    $("btn-new-round").hidden = !started;
    focusFirst($("putt-club-splash"));
  }
  function showGame() {
    $("setup-shell").hidden = true;
    $("putt-club-splash").hidden = true;
    $("game-ui").hidden = false;
    document.body.dataset.view = "game";
    $("game-ui").inert = false;
    sync();
    $("btn-launch-shot").focus({ preventScroll: true });
  }
  function showStep(next) {
    closePanel(false);
    step = next;
    $("putt-club-splash").hidden = true;
    $("game-ui").hidden = true;
    $("setup-shell").hidden = false;
    document.body.dataset.view = "setup";
    Object.entries(screenIds).forEach(([k, id]) => ($(id).hidden = k !== step));
    document.querySelectorAll("[data-step]").forEach((e) => {
      const current = e.dataset.step === (step === "holes" ? "mode" : step);
      e.classList.toggle("current", current);
      current
        ? e.setAttribute("aria-current", "step")
        : e.removeAttribute("aria-current");
    });
    if (step === "holes") renderHoles();
    $("round-summary").textContent =
      `${skills[skill]} / ${course === "mis" ? "Masjed Soleyman" : "Tehran presentation"} / Session play`;
    $("setup-shell").scrollTop = 0;
    focusFirst($(screenIds[next]));
  }
  function startRound(mode, hole = 1) {
    // Explicit new-round action only. Visiting settings/title never clears scores.
    window.currentHandicap = skill;
    gameMode = mode;
    selectedSingleHole = hole;
    window.gameMode = mode;
    window.selectedSingleHole = hole;
    holeScores.fill(null);
    currentSwingMode = "full";
    buildClubButtons();
    if (window.activeCourseId !== course) switchActiveCourse(course);
    window.activeCourseId = course;
    setupHole(hole);
    started = true;
    showGame();
  }
  function selectSkill(value) {
    skill = value;
    document
      .querySelectorAll("[data-skill]")
      .forEach((e) =>
        e.setAttribute("aria-pressed", String(e.dataset.skill === value)),
      );
  }
  function selectCourse(value) {
    course = value;
    document
      .querySelectorAll("[data-course]")
      .forEach((e) =>
        e.setAttribute("aria-pressed", String(e.dataset.course === value)),
      );
  }
  function backSetup() {
    if (step === "handicap") showTitle();
    else
      showStep(
        step === "course" ? "handicap" : step === "mode" ? "course" : "mode",
      );
  }
  function renderHoles() {
    // Active gameplay geometry is currently MIS for both course presentations.
    const container = $("custom-hole-grid-container");
    container.replaceChildren();
    for (let n = 1; n <= 18; n++) {
      const info = courseHoles[n]?.tees?.[0] || {};
      const b = document.createElement("button");
      b.type = "button";
      b.className = "hole-pick-card";
      const score = holeScores[n];
      b.innerHTML = `<strong>${String(n).padStart(2, "0")}</strong><small>PAR ${info.par ?? "—"} <span>·</span> ${info.yard ?? "—"} YD</small>${Number.isFinite(score) ? '<span class="completion">Completed · ' + score + " strokes</span>" : ""}`;
      b.setAttribute(
        "aria-label",
        `Practice hole ${n}, par ${info.par ?? "unknown"}, ${info.yard ?? "unknown"} yards`,
      );
      b.addEventListener("click", () => startRound("single_hole", n));
      container.appendChild(b);
    }
  }
  function openPanel(id) {
    if (!panelIds.includes(id)) return;
    if (id === "club-picker-modal" || id === "swing-picker-modal") {
      if (isBallFlying || golferSwingPhase !== "idle") return;
      if (id === "swing-picker-modal" && GOLF_BAG[currentClubIndex].isPutter)
        return;
    }
    if (id === "menu-modal") renderScorecardTable();
    returnFocus = document.activeElement;
    panel = id;
    panelIds.forEach((key) => {
      const e = $(key);
      e.hidden = key !== id;
      e.classList.toggle("open", key === id);
    });
    $("panel-scrim").hidden = false;
    $("game-ui").inert = true;
    $("putt-club-splash").inert = true;
    $("club-trigger-card").setAttribute(
      "aria-expanded",
      String(id === "club-picker-modal"),
    );
    $("swing-trigger-card").setAttribute(
      "aria-expanded",
      String(id === "swing-picker-modal"),
    );
    focusFirst($(id));
  }
  function closePanel(restore = true) {
    panelIds.forEach((id) => {
      $(id).hidden = true;
      $(id).classList.remove("open");
    });
    panel = null;
    $("panel-scrim").hidden = true;
    $("game-ui").inert = false;
    $("putt-club-splash").inert = false;
    $("club-trigger-card").setAttribute("aria-expanded", "false");
    $("swing-trigger-card").setAttribute("aria-expanded", "false");
    if (restore && returnFocus?.isConnected && !returnFocus.closest("[hidden]"))
      returnFocus.focus({ preventScroll: true });
  }
  function setMode(value) {
    if (!modes.includes(value) || isBallFlying || golferSwingPhase !== "idle")
      return;
    currentSwingMode = value;
    updateSelectedClubUI();
    sync();
  }
  function sync() {
    const club = GOLF_BAG[currentClubIndex],
      isPutter = !!club.isPutter;
    const mode = currentSwingMode,
      spec = calculateShotSpecs(currentClubIndex, mode);
    $("hud-course-name").textContent =
      window.activeCourseId === "tehran"
        ? "TEHRAN / SURFACE PRESENTATION"
        : "MASJED SOLEYMAN";
    $("score-course").textContent =
      (window.activeCourseId === "tehran"
        ? "TEHRAN PRESENTATION / MIS LAYOUT"
        : "MASJED SOLEYMAN") + " / SESSION";
    $("selected-club-sub").textContent = isPutter
      ? "Ground stroke"
      : `${spec.totalYards} yd · estimated total`;
    $("selected-swing-label").textContent = isPutter
      ? "Putting stroke"
      : modeNames[mode] || "Full Swing";
    $("selected-swing-sub").textContent = isPutter
      ? "Use the putting slider"
      : mode === "chip"
        ? "Short flight · extra roll"
        : mode === "full"
          ? "Full arc · standard shot"
          : "Controlled arc";
    $("swing-badge-label").textContent = isPutter
      ? $("putter-backswing-slider").value + "%"
      : (powers[mode] || 100) + "%";
    $("swing-trigger-card").disabled =
      isPutter || isBallFlying || golferSwingPhase !== "idle";
    $("power-readout").innerHTML = (powers[mode] || 100) + "<small>%</small>";
    $("swing-power-slider").value = Math.max(0, modes.indexOf(mode));
    $("swing-power-slider").setAttribute(
      "aria-valuetext",
      `${modeNames[mode]}, ${powers[mode]} percent`,
    );
    document.querySelectorAll("[data-mode]").forEach((e) => {
      const active = e.dataset.mode === mode;
      e.classList.toggle("active", active);
      e.setAttribute("aria-pressed", String(active));
    });
    $("stroke-estimates").innerHTML =
      `<span>CARRY<b>${spec.carryYards}<small> yd</small></b></span><span>ROLL<b>${spec.rollYards}<small> yd</small></b></span><span>TOTAL<b>${spec.totalYards}<small> yd</small></b></span>`;
    const lie = detectLie(ballPos);
    $("hud-lie").textContent =
      lie.type === "Green"
        ? "Brown / putting surface"
        : lie.type === "Tee"
          ? "Tee box"
          : lie.type === "Fairway"
            ? "Fairway"
            : "Rough";
    $("hud-tee-type").textContent = isWomenTee ? "Forward" : "Std";
    $("btn-tee-men").setAttribute("aria-pressed", String(!isWomenTee));
    $("btn-tee-women").setAttribute("aria-pressed", String(isWomenTee));
    [...$("hole-grid-picker").children].forEach((e, i) =>
      e.setAttribute(
        "aria-current",
        i + 1 === currentHoleNumber ? "true" : "false",
      ),
    );
    updateShotState(true);
    syncAimControlsLayout();
  }
  function updateShotState(force = false) {
    const busy = isBallFlying || golferSwingPhase !== "idle";
    if (force || lastBusy !== busy) {
      lastBusy = busy;
      for (const id of [
        "club-trigger-card",
        "btn-launch-shot",
        "btn-putt-action",
        "putter-backswing-slider",
        "btn-toggle-tee",
        "btn-tee-men",
        "btn-tee-women",
      ])
        $(id).disabled = busy;
      $("swing-trigger-card").disabled =
        busy || !!GOLF_BAG[currentClubIndex].isPutter;
      $("btn-launch-shot").setAttribute("aria-busy", String(busy));
      $("btn-launch-shot").innerHTML =
        (busy ? "Shot in progress" : "Strike ball") + icon("arrow");
      $("shot-status").textContent = busy
        ? isBallFlying
          ? "Ball in play · controls return when the shot settles."
          : "Swing in progress · waiting for impact."
        : GOLF_BAG[currentClubIndex].isPutter
          ? "دید را به چپ و راست بچرخان · راهنمای پات تا ۲ یارد روی زمین"
          : "دید را به چپ و راست بچرخان · قوس اولیهٔ ضربه تا ۳۰ یارد";
      [...$("hole-grid-picker").children].forEach((e) => (e.disabled = busy));
      $("return-title").disabled = busy;
    }
  }
  function updateScoreSummary() {
    let score = 0,
      par = 0,
      count = 0;
    for (let n = 1; n <= 18; n++) {
      if (Number.isFinite(holeScores[n])) {
        score += holeScores[n];
        par += courseHoles[n]?.tees?.[0]?.par || 0;
        count++;
      }
    }
    const diff = score - par;
    $("score-summary").innerHTML =
      `<span>COMPLETED<strong>${count}<small> / 18</small></strong></span><span>TOTAL STROKES<strong>${count ? score : "—"}</strong></span><span>TO PAR<strong>${count ? (diff === 0 ? "E" : diff > 0 ? "+" + diff : diff) : "—"}</strong></span>`;
  }
  function showCelebration() {
    closePanel(false);
    $("game-ui").inert = true;
    focusFirst($("celebration-overlay"));
    renderScorecardTable();
  }
  listen("btn-splash-enter", () =>
    started ? showGame() : showStep("handicap"),
  );
  const fresh = document.createElement("button");
  fresh.id = "btn-new-round";
  fresh.className = "text-btn";
  fresh.textContent = "Set up a new round";
  fresh.hidden = true;
  $("btn-title-settings").after(fresh);
  listen("btn-new-round", () => showStep("handicap"));
  listen("btn-title-settings", () => openPanel("settings-panel"));
  listen("setup-back", backSetup);
  listen("setup-close", showTitle);
  document
    .querySelectorAll("[data-skill]")
    .forEach((e) =>
      e.addEventListener("click", () => {
        selectSkill(e.dataset.skill);
        showStep("course");
      }),
    );
  document
    .querySelectorAll("[data-course]")
    .forEach((e) =>
      e.addEventListener("click", () => {
        selectCourse(e.dataset.course);
        showStep("mode");
      }),
    );
  // Derive player distance information from the unchanged bag and handicap rules.
  const savedSkill = window.currentHandicap;
  Object.keys(skills).forEach((key) => {
    window.currentHandicap = key;
    document.querySelector(`[data-driver="${key}"]`).textContent =
      calculateShotSpecs(0, "full").totalYards;
  });
  window.currentHandicap = savedSkill;
  listen("skill-continue", () => showStep("course"));
  listen("course-continue", () => showStep("mode"));
  listen("btn-mode-18holes", () => startRound("18holes"));
  listen("btn-mode-custom-hole", () => showStep("holes"));
  listen("btn-close-custom-hole", () => showStep("mode"));
  listen("club-trigger-card", () => openPanel("club-picker-modal"));
  listen("swing-trigger-card", () => openPanel("swing-picker-modal"));
  listen("btn-close-club-picker", () => closePanel());
  listen("btn-close-swing-picker", () => closePanel());
  listen("btn-menu-close", () => closePanel());
  document
    .querySelectorAll("[data-close-panel]")
    .forEach((e) => e.addEventListener("click", () => closePanel()));
  listen("btn-open-scorecard", () => openPanel("menu-modal"));
  listen("btn-open-settings", () => openPanel("settings-panel"));
  document
    .querySelectorAll("[data-mode]")
    .forEach((e) => e.addEventListener("click", () => setMode(e.dataset.mode)));
  $("swing-power-slider").addEventListener("input", (e) =>
    setMode(modes[Number(e.target.value)]),
  );
  $("putter-backswing-slider").addEventListener("input", () => {
    const value = $("putter-backswing-slider").value;
    $("swing-badge-label").textContent = value + "%";
    $("putter-backswing-slider").setAttribute(
      "aria-valuetext",
      `${value} percent, approximately ${Math.max(1, Math.round(Number(value) * 0.3))} yards roll`,
    );
  });
  for (let n = 1; n <= 18; n++) {
    const b = document.createElement("button");
    b.type = "button";
    b.textContent = String(n).padStart(2, "0");
    b.setAttribute("aria-label", "Go to hole " + n);
    b.addEventListener("click", () => {
      if (isBallFlying || golferSwingPhase !== "idle") return;
      setupHole(n);
      closePanel();
      toast("Hole " + n + " · shot count reset");
    });
    $("hole-grid-picker").appendChild(b);
  }
  listen("btn-toggle-tee", () => {
    isWomenTee = !isWomenTee;
    setupHole(currentHoleNumber);
    toast(isWomenTee ? "Forward tee selected" : "Standard tee selected");
  });
  listen("btn-tee-men", () => {
    isWomenTee = false;
    setupHole(currentHoleNumber);
    closePanel();
  });
  listen("btn-tee-women", () => {
    isWomenTee = true;
    setupHole(currentHoleNumber);
    closePanel();
  });
  listen("btn-celeb-return", () => {
    $("celebration-overlay").style.display = "none";
    showTitle();
  });
  new MutationObserver(() => {
    if (getComputedStyle($("celebration-overlay")).display === "none" && !panel)
      $("game-ui").inert = false;
  }).observe($("celebration-overlay"), {
    attributes: true,
    attributeFilter: ["style"],
  });
  listen("audio-setting", () => {
    AudioEngine.muted = !AudioEngine.muted;
    $("audio-setting").setAttribute("aria-checked", String(!AudioEngine.muted));
    if (!AudioEngine.muted) AudioEngine.init();
  });
  const motionQuery = matchMedia("(prefers-reduced-motion: reduce)");
  $("motion-setting").setAttribute("aria-checked", String(motionQuery.matches));
  listen("motion-setting", () => {
    const next = $("motion-setting").getAttribute("aria-checked") !== "true";
    document.body.dataset.reducedMotion = String(next);
    $("motion-setting").setAttribute("aria-checked", String(next));
  });
  function setQuality() {
    const q = $("quality-select").value;
    const dpr = window.devicePixelRatio || 1;
    renderer.setPixelRatio(
      Math.min(
        dpr,
        q === "low" ? 1 : q === "high" ? 2 : innerWidth < 768 ? 1.25 : 1.75,
      ),
    );
    renderer.shadowMap.enabled = q !== "low";
    renderer.setSize(innerWidth, innerHeight);
    toast(
      q === "low"
        ? "Performance rendering selected"
        : q === "high"
          ? "Detail rendering selected"
          : "Balanced rendering selected",
    );
  }
  $("quality-select").addEventListener("change", setQuality);
  addEventListener("resize", () => {
    const q = $("quality-select").value;
    if (q !== "auto") {
      renderer.setPixelRatio(
        Math.min(devicePixelRatio || 1, q === "low" ? 1 : 2),
      );
      renderer.setSize(innerWidth, innerHeight);
    }
  });
  listen("return-title", () => showTitle());
  document.addEventListener("keydown", (e) => {
    const celebration =
      getComputedStyle($("celebration-overlay")).display !== "none";
    if (e.key === "Escape") {
      if (panel) {
        e.preventDefault();
        closePanel();
      } else if (document.body.dataset.view === "setup") {
        e.preventDefault();
        backSetup();
      }
      return;
    }
    const scope = panel
      ? $(panel)
      : celebration
        ? $("celebration-overlay")
        : document.body.dataset.view === "setup"
          ? $("setup-shell")
          : null;
    if (e.key === "Tab" && scope) {
      const elements = [
        ...scope.querySelectorAll(
          "button:not(:disabled),a[href],input:not(:disabled),select,summary",
        ),
      ].filter((el) => el.getClientRects().length && !el.closest("[hidden]"));
      if (!elements.length) return;
      const first = elements[0],
        last = elements.at(-1);
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }
  });
  // Track engine panel opening paths (e.g. round completion) without polling DOM.
  const panelObserver = new MutationObserver(() => {
    for (const id of panelIds) {
      const el = $(id);
      if (el.classList.contains("open") && el.hidden) openPanel(id);
    }
  });
  panelIds.forEach((id) =>
    panelObserver.observe($(id), {
      attributes: true,
      attributeFilter: ["class"],
    }),
  );
  function refreshOffline() {
    const result=window.PuttBoot;
    offlineReady=!!result?.ready;
    $("offline-state").textContent=offlineReady
      ? `All ${result.count} game resources verified and saved (${(result.bytes/1048576).toFixed(1)} MB). ${result.status==='offline'?'Offline · saved build.':result.status==='update-unavailable'?'Update unavailable · using complete saved build.':'Version checked before play.'} iOS may remove storage when space is low.`
      : "A complete saved build has not been verified.";
  }
  function exportSession() {
    if(isBallFlying||golferSwingPhase!=="idle"||isCameraTransitioning)return null;
    return {schema:1,started,view:document.body.dataset.view,step,skill,course,mode:gameMode,hole:currentHoleNumber,single:selectedSingleHole,strokes:strokesCurrentHole,tee:isWomenTee,scores:[...holeScores],club:currentClubIndex,swing:currentSwingMode,ball:ballPos.toArray(),aim:aimDirection.toArray(),camera:camera.position.toArray(),target:orbitControls.target.toArray(),putt:$("putter-backswing-slider").value,celebrating:$("celebration-overlay").style.display!=="none",telemetry:["tele-carry","tele-roll","tele-total"].map(id=>$(id).textContent)};
  }
  function importSession(data) {
    if(data?.schema!==1||!data.started)return;
    selectSkill(data.skill);selectCourse(data.course);window.currentHandicap=skill;
    if(window.activeCourseId!==course)switchActiveCourse(course);
    gameMode=data.mode;selectedSingleHole=data.single;window.gameMode=gameMode;window.selectedSingleHole=selectedSingleHole;
    isWomenTee=data.tee;setupHole(data.hole);strokesCurrentHole=data.strokes;
    data.scores.forEach((score,n)=>holeScores[n]=score);
    currentClubIndex=data.club;currentSwingMode=data.swing;
    ballPos.fromArray(data.ball);
    if(strokesCurrentHole>0)ballPos.y=getTerrainHeight(ballPos.x,ballPos.z)+BALL_RADIUS;
    ballMesh.position.copy(ballPos);ballVel.set(0,0,0);
    resetAimToPin();
    if(Array.isArray(data.aim)&&data.aim.length===3&&data.aim.every(Number.isFinite)) {
      const restoredAim=new THREE.Vector3().fromArray(data.aim).setY(0);
      if(restoredAim.lengthSq()>1e-8)aimDirection.copy(restoredAim.normalize());
    }
    // Use the corrected address framing even when migrating an old wide camera.
    setAddressCamera(true);
    if(strokesCurrentHole>0&&teePegGroup)teePegGroup.visible=false;
    $("putter-backswing-slider").value=data.putt;
    ["tele-carry","tele-roll","tele-total"].forEach((id,n)=>$(id).textContent=data.telemetry[n]);
    started=true;updateSelectedClubUI();updateHoleUI();positionGolferAtBall();sync();
    if(data.view==='game')showGame();else if(data.view==='setup')showStep(data.step);else showTitle();
    if(data.celebrating)handleHoleCompleted();
    toast("Updated build loaded · round restored. An unfinished shot restarts from its pre-strike position.");
  }
  listen("btn-map-detail",()=>{
    const expanded=document.body.dataset.mapExpanded!=="true";
    document.body.dataset.mapExpanded=String(expanded);
    $("btn-map-detail").setAttribute("aria-expanded",String(expanded));
    $("btn-map-detail").setAttribute("aria-label",expanded?"Collapse hole map":"Expand hole map");
  });
  listen("btn-toggle-estimates",()=>{
    const expanded=document.body.dataset.estimates!=="true";
    document.body.dataset.estimates=String(expanded);
    $("btn-toggle-estimates").setAttribute("aria-expanded",String(expanded));
  });
  window.PuttUI = {
    exportSession, importSession, refreshOffline,
    sync,
    updateShotState,
    renderHoles,
    openPanel,
    closePanel,
    showCelebration,
    updateScoreSummary,
    toast,
  };
  // Compatibility wrapper for existing course-switch call paths.
  window.renderCustomHoleGridInstant = renderHoles;
  sync();
  renderHoles();
  renderScorecardTable();
  selectSkill(skill);
  selectCourse(course);
  refreshOffline();
  let readyPoll = setInterval(() => {
    if (proGolferLoaded) {
      $("title-status").innerHTML =
        `<span class="status-dot"></span><span>${window.PuttBoot.status==='update-unavailable'?'Saved build · update check unavailable':`All ${window.PuttBoot.count} files saved · offline ready`}</span>`;
      clearInterval(readyPoll);
    }
  }, 250);
  setTimeout(() => {
    clearInterval(readyPoll);
    if (!proGolferLoaded)
      $("title-status").innerHTML =
        '<span class="status-dot"></span><span>Course ready · character fallback active</span>';
  }, 12000);
  addEventListener("error", (e) => {
    if (/WebGL|creating WebGL context/i.test(e.message))
      $("fatal-error").hidden = false;
  });
})();
