const PRACTICES = [
  {
    id: "opportunities-to-respond",
    title: "Opportunities to Respond",
    items: [
      "Pair-Share",
      "Volunteers",
      "Cold calling non volunteers",
      "Mini Whiteboards",
      "Thumbs up/Thumbs down",
      "Multi choice vote - fingers",
      "Student initiated question",
      "Other"
    ],
    otherDetailLabel: "If Other was observed, list what it was",
    otherDetailPlaceholder: "Describe the other opportunity to respond"
  }
];

const OBSERVED_VALUE = "Observed";
const DEFAULT_LESSON_FOCUS =
  "First 15 minutes of class to check on entry classroom routines.";

const EXPORT_EMAIL_STORAGE_KEY = "classroom-learning-walks-export-email";
// Paste the deployed Google Apps Script web app URL here.
const GOOGLE_APPS_SCRIPT_CONFIG = {
  webAppUrl: "https://script.google.com/a/macros/buckleyparkco.vic.edu.au/s/AKfycbySfx9JM9C6SQYoOQjKhuD86yNg7o-Vn17kHAVgrLmsi1Vn51p1TBG_nNauMzQOpCVl/exec"
};

const form = document.querySelector("#walk-form");
const practiceSections = document.querySelector("#practice-sections");
const statsGrid = document.querySelector("#stats-grid");
const sectionSummary = document.querySelector("#section-summary");
const completionBadge = document.querySelector("#completion-badge");
const progressTrack = document.querySelector(".progress-track");
const progressFill = document.querySelector("#progress-fill");
const resetButton = document.querySelector("#reset-form");
const exportHistoryButton = document.querySelector("#export-history");
const exportEmailInput = document.querySelector("#export-email");
const exportStatus = document.querySelector("#export-status");
const practiceTemplate = document.querySelector("#practice-template");

const observationToggle = document.querySelector("#observationToggle");
const directInstructionToggle = document.querySelector("#directInstructionToggle");
const collaborativeInstructionToggle = document.querySelector("#collaborativeInstructionToggle");
const independentWorkToggle = document.querySelector("#independentWorkToggle");
const collaborationToggle = document.querySelector("#collaborationToggle");
const observationTime = document.querySelector("#observationTime");
const directInstructionTime = document.querySelector("#directInstructionTime");
const collaborativeInstructionTime = document.querySelector("#collaborativeInstructionTime");
const independentWorkTime = document.querySelector("#independentWorkTime");
const collaborationTime = document.querySelector("#collaborationTime");
const directInstructionShare = document.querySelector("#directInstructionShare");
const collaborativeInstructionShare = document.querySelector("#collaborativeInstructionShare");
const independentWorkShare = document.querySelector("#independentWorkShare");
const collaborationShare = document.querySelector("#collaborationShare");
const instructionStatus = document.querySelector("#instruction-status");
const segmentCount = document.querySelector("#segment-count");
const instructionProgress = document.querySelector("#instructionProgress");
const collaborativeInstructionProgress = document.querySelector("#collaborativeInstructionProgress");
const independentProgress = document.querySelector("#independentProgress");
const collaborationProgress = document.querySelector("#collaborationProgress");

const TIMING_MODE_CONFIG = [
  {
    key: "direct",
    label: "Direct Instruction",
    button: directInstructionToggle,
    timeEl: directInstructionTime,
    shareEl: directInstructionShare,
    progressEl: instructionProgress,
    timeProp: "directTime",
    shareProp: "directShare",
    exactShareProp: "directShareExact",
    startLabel: "Start Direct Instruction",
    pauseLabel: "Pause Direct Instruction",
    runningText: "Direct instruction is running right now."
  },
  {
    key: "collaborativeInstruction",
    label: "Co-Construction",
    button: collaborativeInstructionToggle,
    timeEl: collaborativeInstructionTime,
    shareEl: collaborativeInstructionShare,
    progressEl: collaborativeInstructionProgress,
    timeProp: "collaborativeInstructionTime",
    shareProp: "collaborativeInstructionShare",
    exactShareProp: "collaborativeInstructionShareExact",
    startLabel: "Start Co-Construction",
    pauseLabel: "Pause Co-Construction",
    runningText: "Co-Construction is running right now."
  },
  {
    key: "independent",
    label: "Independent Work",
    button: independentWorkToggle,
    timeEl: independentWorkTime,
    shareEl: independentWorkShare,
    progressEl: independentProgress,
    timeProp: "independentTime",
    shareProp: "independentShare",
    exactShareProp: "independentShareExact",
    startLabel: "Start Independent Work",
    pauseLabel: "Pause Independent Work",
    runningText: "Independent work is running right now."
  },
  {
    key: "collaboration",
    label: "Independent Work / Group Work / Teacher Collaboration",
    button: collaborationToggle,
    timeEl: collaborationTime,
    shareEl: collaborationShare,
    progressEl: collaborationProgress,
    timeProp: "collaborationTime",
    shareProp: "collaborationShare",
    exactShareProp: "collaborationShareExact",
    startLabel: "Start Independent Work / Group Work / Teacher Collaboration",
    pauseLabel: "Pause Independent Work / Group Work / Teacher Collaboration",
    runningText: "Independent work / group work / teacher collaboration is running right now."
  }
];

let timingState = createDefaultTimingState();

renderPracticeSections();
loadExportEmailPreference();
resetFormState();

form.addEventListener("input", updateDashboard);
form.addEventListener("submit", handleSave);
resetButton.addEventListener("click", resetFormState);
exportEmailInput.addEventListener("input", handleExportEmailInput);

if (observationToggle) {
  observationToggle.addEventListener("click", toggleObservation);
}

TIMING_MODE_CONFIG.forEach(({ key, button }) => {
  if (button) {
    button.addEventListener("click", () => toggleTimingMode(key));
  }
});

window.setInterval(() => {
  renderTimingState();
}, 1000);

function renderPracticeSections() {
  if (!practiceSections) {
    return;
  }

  if (!PRACTICES.length) {
    practiceSections.remove();
    return;
  }

  if (!practiceTemplate) {
    return;
  }

  practiceSections.innerHTML = "";

  PRACTICES.forEach((practice) => {
    const fragment = practiceTemplate.content.cloneNode(true);
    const block = fragment.querySelector(".practice-block");
    block.dataset.practiceId = practice.id;
    fragment.querySelector(".practice-title").textContent = practice.title;
    fragment.querySelector(".practice-score").textContent = "0 of 0 ticked";
    fragment.querySelector(".practice-notes").id = `${practice.id}-notes`;

    const itemsContainer = fragment.querySelector(".practice-items");
    const extraContainer = fragment.querySelector(".practice-extra");

    practice.items.forEach((prompt, index) => {
      const itemId = `${practice.id}-${index}`;
      const item = document.createElement("section");
      item.className = "practice-item";
      item.innerHTML = `
        <p class="practice-item__prompt">${prompt}</p>
        <div class="checkbox-row">
          <label class="tick-box" for="${itemId}" aria-label="Mark observed for ${prompt}">
            <input
              type="checkbox"
              id="${itemId}"
              name="${itemId}"
              value="${OBSERVED_VALUE}"
            >
            <span class="tick-box__box" aria-hidden="true"></span>
            <span class="sr-only">Observed</span>
          </label>
        </div>
      `;
      itemsContainer.appendChild(item);
    });

    if (practice.otherDetailLabel && extraContainer) {
      extraContainer.innerHTML = `
        <label class="field field--stacked field--section-detail">
          <span>${practice.otherDetailLabel}</span>
          <input
            class="practice-other-detail"
            id="${practice.id}-other-detail"
            name="${practice.id}-other-detail"
            type="text"
            placeholder="${practice.otherDetailPlaceholder || ""}"
          >
        </label>
      `;
    }

    practiceSections.appendChild(fragment);
  });
}

async function handleSave(event) {
  event.preventDefault();
  await exportHistory();
}

function collectFormData(now = Date.now()) {
  const formData = new FormData(form);
  const practices = PRACTICES.map((practice) => {
    const items = practice.items.map((_, index) => {
      const itemId = `${practice.id}-${index}`;
      return formData.has(itemId) ? OBSERVED_VALUE : "";
    });

    return {
      id: practice.id,
      title: practice.title,
      items,
      notes: formData.get(`${practice.id}-notes`) || "",
      otherDetail: formData.get(`${practice.id}-other-detail`) || ""
    };
  });

  return {
    id: crypto.randomUUID(),
    savedAt: new Date().toISOString(),
    observer: formData.get("observer") || "",
    teacher: "",
    date: formData.get("date") || "",
    subject: formData.get("subject") || "",
    lessonSegment: formData.get("lessonSegment") || "Beginning",
    className: formData.get("className") || "",
    classroom: formData.get("classroom") || "",
    lessonFocus: DEFAULT_LESSON_FOCUS,
    overallNotes: formData.get("overallNotes") || "",
    practices,
    instructionTiming: getTimingSnapshot(now)
  };
}

function buildMetrics(practices) {
  const totals = {
    observed: 0,
    unticked: 0,
    totalItems: 0,
    sections: []
  };

  practices.forEach((practice) => {
    let sectionObserved = 0;
    const sectionTotal = practice.items.length;

    practice.items.forEach((value) => {
      totals.totalItems += 1;
      if (isObserved(value)) {
        totals.observed += 1;
        sectionObserved += 1;
      } else {
        totals.unticked += 1;
      }
    });

    totals.sections.push({
      id: practice.id,
      title: practice.title,
      observed: sectionObserved,
      total: sectionTotal,
      percent: sectionTotal ? Math.round((sectionObserved / sectionTotal) * 100) : 0
    });
  });

  totals.percent = totals.totalItems ? Math.round((totals.observed / totals.totalItems) * 100) : 0;
  return totals;
}

function updateDashboard(now = Date.now()) {
  if (!statsGrid || !completionBadge || !sectionSummary || !progressFill) {
    return;
  }

  if (!PRACTICES.length) {
    renderTimingSnapshot(now);
    return;
  }

  if (progressTrack) {
    progressTrack.hidden = false;
  }

  const data = collectFormData(now);
  const metrics = buildMetrics(data.practices);

  completionBadge.textContent = metrics.observed
    ? `${metrics.percent}% observed`
    : "No boxes ticked yet";
  progressFill.style.width = `${metrics.percent}%`;

  statsGrid.innerHTML = [
    { label: "Observed", value: metrics.observed },
    { label: "Unticked", value: metrics.unticked },
    { label: "Total indicators", value: metrics.totalItems }
  ].map((stat) => `
    <article class="stat">
      <strong>${stat.value}</strong>
      <span>${stat.label}</span>
    </article>
  `).join("");

  sectionSummary.innerHTML = metrics.sections.map((section) => `
    <article class="section-summary__item">
      <header>
        <strong>${section.title}</strong>
        <span>${section.percent}%</span>
      </header>
      <div class="section-summary__meter"><span style="width:${section.percent}%"></span></div>
      <p>${section.observed} of ${section.total} ticked</p>
    </article>
  `).join("");

  updatePracticeScores(metrics.sections);
}

function renderTimingSnapshot(now = Date.now()) {
  const timing = getTimingSnapshot(now);

  if (progressTrack) {
    progressTrack.hidden = true;
  }

  progressFill.style.width = "0%";
  completionBadge.textContent = timing.badgeText;

  statsGrid.innerHTML = [
    { label: "Observation time", value: timing.observationTime },
    { label: "Direct instruction", value: `${timing.directShare}%` },
    { label: "Collaborative instruction", value: `${timing.collaborativeInstructionShare}%` },
    { label: "Independent work", value: `${timing.independentShare}%` },
    { label: "Teacher collaboration", value: `${timing.collaborationShare}%` },
    { label: "Total segments", value: timing.totalSegments }
  ].map((stat) => `
    <article class="stat">
      <strong>${escapeHtml(String(stat.value))}</strong>
      <span>${escapeHtml(stat.label)}</span>
    </article>
  `).join("");

  sectionSummary.innerHTML = `
    <p class="empty-state">
      ${escapeHtml(timing.statusText)} ${escapeHtml(timing.segmentSummary)}
    </p>
  `;
}

function updatePracticeScores(sectionMetrics) {
  sectionMetrics.forEach((section) => {
    const score = document.querySelector(`[data-practice-id="${section.id}"] .practice-score`);
    if (score) {
      score.textContent = `${section.observed} of ${section.total} ticked`;
    }
  });
}

function loadExportEmailPreference() {
  try {
    exportEmailInput.value = window.localStorage.getItem(EXPORT_EMAIL_STORAGE_KEY) || "";
  } catch (error) {
    exportEmailInput.value = "";
  }
}

function persistExportEmailPreference(value) {
  try {
    if (value) {
      window.localStorage.setItem(EXPORT_EMAIL_STORAGE_KEY, value);
    } else {
      window.localStorage.removeItem(EXPORT_EMAIL_STORAGE_KEY);
    }
  } catch (error) {
    // Ignore localStorage errors so exporting still works.
  }
}

function resetFormState() {
  form.reset();
  document.querySelector("#date").value = new Date().toISOString().slice(0, 10);
  document.querySelector("#lesson-segment").value = "Beginning";
  loadExportEmailPreference();
  resetTimingState(true);
  refreshExportStatus();

  PRACTICES.forEach((practice) => {
    const notesField = document.querySelector(`#${practice.id}-notes`);
    if (notesField) {
      notesField.value = "";
    }

    const otherDetailField = document.querySelector(`#${practice.id}-other-detail`);
    if (otherDetailField) {
      otherDetailField.value = "";
    }
  });

  renderTimingState();
}

async function exportHistory() {
  const now = Date.now();
  const record = collectFormData(now);
  if (!hasWalkthroughData(record)) {
    flashExportButton("Nothing to export", 1600);
    setExportStatus("Complete at least one walkthrough field or timing segment before exporting a CSV.", "error");
    return;
  }

  const detailRows = buildIndicatorExportRows(record);
  const csvContent = buildCsv(detailRows.length ? detailRows : [buildWalkthroughSummaryRow(record)]);
  const recipientEmail = exportEmailInput.value.trim();
  const filename = "classroom-learning-walks-indicators.csv";

  downloadFile(
    csvContent,
    filename,
    "text/csv;charset=utf-8;"
  );

  if (!recipientEmail) {
    flashExportButton("CSV downloaded", 1800);
    resetFormState();
    setExportStatus(
      "CSV downloaded and the form has been cleared. Add an email address above if you also want the export sent through Gmail and archived in Drive.",
      ""
    );
    return;
  }

  if (!isValidEmail(recipientEmail)) {
    flashExportButton("CSV downloaded", 1800);
    setExportStatus("CSV downloaded, but the email address looks invalid. Please check it and try again.", "error");
    return;
  }

  if (!isEmailDeliveryConfigured()) {
    flashExportButton("CSV downloaded", 1800);
    resetFormState();
    setExportStatus(
      "CSV downloaded and the form has been cleared. Google Workspace delivery is ready in the app, but you still need to deploy the Apps Script web app and paste its URL into app.js before it can send.",
      "error"
    );
    return;
  }

  setExportStatus(
    "CSV downloaded. A Google confirmation window is opening to finish the Gmail and Drive export.",
    ""
  );

  try {
    await sendCsvToGoogleWorkspace({
      csvContent,
      filename,
      recipientEmail,
      recordCount: 1
    });

    flashExportButton("CSV sent", 2200);
    resetFormState();
    setExportStatus(
      `CSV downloaded and the form has been cleared. Check the Google confirmation window for the final success message and Drive link for ${recipientEmail}.`,
      "success"
    );
  } catch (error) {
    flashExportButton("CSV downloaded", 2200);
    setExportStatus(
      "CSV downloaded, but the Google Workspace send failed. Allow the popup window, confirm you are signed in to your Buckley Park College Google account, and check the Apps Script web app URL in app.js.",
      "error"
    );
  }
}

function escapeHtml(value) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll("\"", "&quot;")
    .replaceAll("'", "&#39;");
}

function isObserved(value) {
  return value === OBSERVED_VALUE;
}

function hasWalkthroughData(record) {
  const hasMetaData = [
    record.observer,
    record.teacher,
    record.date,
    record.subject,
    record.className,
    record.classroom,
    record.overallNotes
  ].some((value) => Boolean(String(value || "").trim()));

  const hasPracticeData = record.practices.some((practice) =>
    practice.notes.trim() ||
    practice.otherDetail.trim() ||
    practice.items.some((value) => isObserved(value))
  );

  const hasTimingData =
    record.instructionTiming.observationMs > 0 ||
    record.instructionTiming.totalSegments > 0;

  return hasMetaData || hasPracticeData || hasTimingData;
}

function buildExportBaseRow(record) {
  const timing = record.instructionTiming;

  return {
    recordId: record.id,
    savedAt: record.savedAt || "",
    walkDate: record.date || "",
    observer: record.observer || "",
    teacherObserved: record.teacher || "",
    subject: record.subject || "",
    lessonSegment: record.lessonSegment || "",
    className: record.className || "",
    classroom: record.classroom || "",
    lessonFocus: record.lessonFocus || "",
    observationTime: timing.observationTime,
    observationSeconds: timing.observationSeconds,
    activeTeachingMode: timing.activeModeLabel,
    instructionStatus: timing.statusText,
    directInstructionTime: timing.directTime,
    directInstructionSeconds: timing.directSeconds,
    directInstructionShare: timing.directShare,
    directInstructionSegments: timing.directSegments,
    collaborativeInstructionTime: timing.collaborativeInstructionTime,
    collaborativeInstructionSeconds: timing.collaborativeInstructionSeconds,
    collaborativeInstructionShare: timing.collaborativeInstructionShare,
    collaborativeInstructionSegments: timing.collaborativeInstructionSegments,
    independentWorkTime: timing.independentTime,
    independentWorkSeconds: timing.independentSeconds,
    independentWorkShare: timing.independentShare,
    independentWorkSegments: timing.independentSegments,
    teacherCollaborationTime: timing.collaborationTime,
    teacherCollaborationSeconds: timing.collaborationSeconds,
    teacherCollaborationShare: timing.collaborationShare,
    teacherCollaborationSegments: timing.collaborationSegments,
    totalTimingSegments: timing.totalSegments,
    overallNotes: record.overallNotes || "",
    reflectionWalkthroughNotes: record.overallNotes || ""
  };
}

function buildIndicatorExportRows(record) {
  const baseRow = buildExportBaseRow(record);

  return record.practices.flatMap((practice) => {
    const practiceDefinition = PRACTICES.find((item) => item.id === practice.id);
    return practice.items.map((value, index) => ({
      ...baseRow,
      practiceId: practice.id,
      practiceTitle: practice.title,
      indicatorNumber: index + 1,
      indicatorText: practiceDefinition ? practiceDefinition.items[index] : "",
      observed: isObserved(value) ? 1 : 0,
      response: isObserved(value) ? "Ticked" : "Unticked",
      practiceNotes: practice.notes || "",
      practiceOtherDetail: practice.otherDetail || ""
    }));
  });
}

function buildWalkthroughSummaryRow(record) {
  return {
    ...buildExportBaseRow(record),
    practiceId: "",
    practiceTitle: "",
    indicatorNumber: "",
    indicatorText: "",
    observed: "",
    response: "",
    practiceNotes: "",
    practiceOtherDetail: record.practices
      .map((practice) => practice.otherDetail || "")
      .filter(Boolean)
      .join(" | "),
    exportType: "Walkthrough summary"
  };
}

function buildCsv(rows) {
  if (!rows.length) {
    return "";
  }

  const headers = Array.from(
    rows.reduce((set, row) => {
      Object.keys(row).forEach((key) => set.add(key));
      return set;
    }, new Set())
  );

  const lines = [
    headers.join(","),
    ...rows.map((row) => headers.map((header) => escapeCsvValue(row[header] ?? "")).join(","))
  ];

  return `\uFEFF${lines.join("\r\n")}`;
}

function escapeCsvValue(value) {
  const stringValue = String(value);
  if (/[",\r\n]/.test(stringValue)) {
    return `"${stringValue.replaceAll("\"", "\"\"")}"`;
  }
  return stringValue;
}

function handleExportEmailInput(event) {
  const value = event.target.value.trim();
  persistExportEmailPreference(value);
  refreshExportStatus();
}

function refreshExportStatus() {
  const value = exportEmailInput.value.trim();

  if (!value) {
    setExportStatus(
      "Export each walkthrough when it is finished. The form does not store walkthroughs on this device.",
      ""
    );
    return;
  }

  if (isValidEmail(value)) {
    setExportStatus(
      "The next export will download the current walkthrough CSV, then open a Google confirmation window to email it and save a copy to Drive.",
      ""
    );
    return;
  }

  setExportStatus("Enter a full email address before exporting if you want the CSV emailed as well.", "error");
}

function isValidEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function isEmailDeliveryConfigured() {
  return Boolean(GOOGLE_APPS_SCRIPT_CONFIG.webAppUrl);
}

async function sendCsvToGoogleWorkspace({ csvContent, filename, recipientEmail, recordCount }) {
  const payload = {
    recipientEmail,
    filename,
    csvContent,
    recordCount: String(recordCount),
    exportedAt: new Date().toISOString()
  };

  await submitGoogleWorkspaceForm(payload);
}

function submitGoogleWorkspaceForm(payload) {
  const formId = "google-workspace-export-form";
  const popupName = "google-workspace-export-window";

  const popupWindow = window.open("", popupName, "width=720,height=760");
  if (!popupWindow) {
    throw new Error("Popup blocked");
  }

  let formElement = document.querySelector(`#${formId}`);
  if (!formElement) {
    formElement = document.createElement("form");
    formElement.id = formId;
    formElement.method = "POST";
    formElement.hidden = true;
    document.body.appendChild(formElement);
  }

  formElement.action = GOOGLE_APPS_SCRIPT_CONFIG.webAppUrl;
  formElement.target = popupName;
  formElement.innerHTML = "";

  Object.entries(payload).forEach(([name, value]) => {
    const field = document.createElement(name === "csvContent" ? "textarea" : "input");
    field.name = name;
    field.value = value;
    field.hidden = true;
    formElement.appendChild(field);
  });

  return new Promise((resolve, reject) => {
    let completed = false;

    const finish = () => {
      if (completed) {
        return;
      }

      completed = true;
      resolve();
    };

    const timeoutId = window.setTimeout(finish, 2200);

    try {
      formElement.submit();
    } catch (error) {
      window.clearTimeout(timeoutId);
      completed = true;
      reject(error);
    }
  });
}

function setExportStatus(message, tone) {
  exportStatus.textContent = message;
  if (tone) {
    exportStatus.dataset.tone = tone;
    return;
  }

  delete exportStatus.dataset.tone;
}

function flashExportButton(label, duration) {
  exportHistoryButton.textContent = label;
  window.setTimeout(() => {
    exportHistoryButton.textContent = "Export walkthrough CSV";
  }, duration);
}

function downloadFile(content, filename, mimeType) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

function createDefaultTimingState() {
  return {
    observation: {
      running: false,
      startedAt: null,
      elapsedMs: 0
    },
    modes: {
      direct: createDefaultTimingBucket(),
      collaborativeInstruction: createDefaultTimingBucket(),
      independent: createDefaultTimingBucket(),
      collaboration: createDefaultTimingBucket()
    }
  };
}

function createDefaultTimingBucket() {
  return {
    running: false,
    startedAt: null,
    elapsedMs: 0,
    segments: 0
  };
}

function resetTimingState(skipRender = false) {
  timingState = createDefaultTimingState();
  if (!skipRender) {
    renderTimingState();
  }
}

function formatDuration(ms) {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const hours = String(Math.floor(totalSeconds / 3600)).padStart(2, "0");
  const minutes = String(Math.floor((totalSeconds % 3600) / 60)).padStart(2, "0");
  const seconds = String(totalSeconds % 60).padStart(2, "0");
  return `${hours}:${minutes}:${seconds}`;
}

function calculateElapsed(bucket, now = Date.now()) {
  if (!bucket.running || !bucket.startedAt) {
    return bucket.elapsedMs;
  }

  return bucket.elapsedMs + (now - bucket.startedAt);
}

function getObservationElapsed(now = Date.now()) {
  return calculateElapsed(timingState.observation, now);
}

function getModeElapsed(key, now = Date.now()) {
  return calculateElapsed(timingState.modes[key], now);
}

function pauseBucket(bucket, now = Date.now()) {
  bucket.elapsedMs = calculateElapsed(bucket, now);
  bucket.running = false;
  bucket.startedAt = null;
}

function pauseObservation(now = Date.now()) {
  pauseBucket(timingState.observation, now);
}

function pauseTimingMode(key, now = Date.now()) {
  pauseBucket(timingState.modes[key], now);
}

function pauseAllTimingModes(now = Date.now(), exceptKey = "") {
  TIMING_MODE_CONFIG.forEach(({ key }) => {
    if (key !== exceptKey && timingState.modes[key].running) {
      pauseTimingMode(key, now);
    }
  });
}

function toggleObservation() {
  const now = Date.now();

  if (timingState.observation.running) {
    pauseObservation(now);
    pauseAllTimingModes(now);
  } else {
    timingState.observation.running = true;
    timingState.observation.startedAt = now;
  }

  renderTimingState(now);
}

function toggleTimingMode(key) {
  const now = Date.now();
  const bucket = timingState.modes[key];

  if (!timingState.observation.running) {
    timingState.observation.running = true;
    timingState.observation.startedAt = now;
  }

  if (bucket.running) {
    pauseTimingMode(key, now);
  } else {
    pauseAllTimingModes(now, key);
    bucket.running = true;
    bucket.startedAt = now;
    bucket.segments += 1;
  }

  renderTimingState(now);
}

function getTimingSnapshot(now = Date.now()) {
  const observationMs = getObservationElapsed(now);
  const directMs = getModeElapsed("direct", now);
  const collaborativeInstructionMs = getModeElapsed("collaborativeInstruction", now);
  const independentMs = getModeElapsed("independent", now);
  const collaborationMs = getModeElapsed("collaboration", now);
  const directShareExact = observationMs === 0 ? 0 : (directMs / observationMs) * 100;
  const collaborativeInstructionShareExact = observationMs === 0
    ? 0
    : (collaborativeInstructionMs / observationMs) * 100;
  const independentShareExact = observationMs === 0 ? 0 : (independentMs / observationMs) * 100;
  const collaborationShareExact = observationMs === 0 ? 0 : (collaborationMs / observationMs) * 100;
  const activeMode = TIMING_MODE_CONFIG.find(({ key }) => timingState.modes[key].running);
  const totalSegments = TIMING_MODE_CONFIG.reduce(
    (total, { key }) => total + timingState.modes[key].segments,
    0
  );
  const segmentSummary =
    `Direct: ${timingState.modes.direct.segments} | ` +
    `Collaborative: ${timingState.modes.collaborativeInstruction.segments} | ` +
    `Independent: ${timingState.modes.independent.segments} | ` +
    `Independent / Group / Teacher Collaboration: ${timingState.modes.collaboration.segments}`;
  const badgeText = activeMode
    ? `${activeMode.label} live`
    : timingState.observation.running
      ? "Observation running"
      : observationMs > 0
        ? "Observation paused"
        : "Ready to track";
  const statusText = activeMode
    ? activeMode.runningText
    : timingState.observation.running
      ? "Observation is running. Start a teaching mode or continue observing."
      : observationMs > 0
        ? "Observation is paused."
        : "Start observation or a teaching mode to begin tracking.";

  return {
    observationMs,
    observationSeconds: Math.round(observationMs / 1000),
    observationTime: formatDuration(observationMs),
    directMs,
    directSeconds: Math.round(directMs / 1000),
    directTime: formatDuration(directMs),
    directShare: Math.round(directShareExact),
    directShareExact,
    collaborativeInstructionMs,
    collaborativeInstructionSeconds: Math.round(collaborativeInstructionMs / 1000),
    collaborativeInstructionTime: formatDuration(collaborativeInstructionMs),
    collaborativeInstructionShare: Math.round(collaborativeInstructionShareExact),
    collaborativeInstructionShareExact,
    independentMs,
    independentSeconds: Math.round(independentMs / 1000),
    independentTime: formatDuration(independentMs),
    independentShare: Math.round(independentShareExact),
    independentShareExact,
    collaborationMs,
    collaborationSeconds: Math.round(collaborationMs / 1000),
    collaborationTime: formatDuration(collaborationMs),
    collaborationShare: Math.round(collaborationShareExact),
    collaborationShareExact,
    directSegments: timingState.modes.direct.segments,
    collaborativeInstructionSegments: timingState.modes.collaborativeInstruction.segments,
    independentSegments: timingState.modes.independent.segments,
    collaborationSegments: timingState.modes.collaboration.segments,
    totalSegments,
    activeModeLabel: activeMode
      ? activeMode.label
      : timingState.observation.running
        ? "Observation only"
        : "No active mode",
    badgeText,
    statusText,
    segmentSummary
  };
}

function renderTimingState(now = Date.now()) {
  const snapshot = getTimingSnapshot(now);

  if (observationToggle) {
    observationToggle.textContent = timingState.observation.running
      ? "Pause Observation"
      : "Start Observation";
    observationToggle.classList.toggle("running", timingState.observation.running);
  }

  if (observationTime) {
    observationTime.textContent = snapshot.observationTime;
  }

  TIMING_MODE_CONFIG.forEach((config) => {
    const bucket = timingState.modes[config.key];

    if (config.button) {
      config.button.textContent = bucket.running ? config.pauseLabel : config.startLabel;
      config.button.classList.toggle("running", bucket.running);
    }

    if (config.timeEl) {
      config.timeEl.textContent = snapshot[config.timeProp];
    }

    if (config.shareEl) {
      config.shareEl.textContent = `${snapshot[config.shareProp]}%`;
    }
  });

  let cursor = 0;
  TIMING_MODE_CONFIG.forEach((config) => {
    if (!config.progressEl) {
      return;
    }

    const width = clampPercent(snapshot[config.exactShareProp]);
    config.progressEl.style.left = `${clampPercent(cursor)}%`;
    config.progressEl.style.width = `${width}%`;
    cursor += width;
  });

  if (instructionStatus) {
    instructionStatus.textContent = snapshot.statusText;
  }

  if (segmentCount) {
    segmentCount.textContent = snapshot.segmentSummary;
  }

  updateDashboard(now);
}

function clampPercent(value) {
  return Math.max(0, Math.min(100, value));
}
