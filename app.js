const PRACTICES = [
  {
    id: "setting-up",
    title: "Setting Up",
    items: [
      "Students wait for the teacher prior to entering the learning space.",
      "The teacher greets students warmly and respectfully.",
      "Students know where to sit and move straight to their seats.",
      "Students have all of their learning materials.",
      "Students do not attempt to use their laptops to begin the lesson."
    ]
  },
  {
    id: "retrieval-task",
    title: "Retrieval Task",
    items: [
      "Students are able to complete the retrieval task with minimal prompting from the teacher.",
      "The retrieval task links with previous knowledge or skills taught.",
      "The retrieval task is device-free and typically involves students putting pen to paper.",
      "The teacher scans and circulates the room.",
      "The teacher reviews students' responses.",
      "The retrieval task takes no more than ten minutes to complete."
    ]
  },
  {
    id: "learning-intention",
    title: "Learning Intention and Success Criteria",
    items: [
      "The learning intention is shared and explained with students.",
      "The success criteria is shared and explained with students."
    ]
  }
];

const OBSERVED_VALUE = "Observed";
const DEFAULT_LESSON_FOCUS =
  "First 15 minutes of class to check on entry classroom routines and consistent application of retrieval tasks.";

const STORAGE_KEY = "classroom-learning-walks-records";
const EXPORT_EMAIL_STORAGE_KEY = "classroom-learning-walks-export-email";
// Paste the deployed Google Apps Script web app URL here.
const GOOGLE_APPS_SCRIPT_CONFIG = {
  webAppUrl: "https://script.google.com/a/macros/buckleyparkco.vic.edu.au/s/AKfycbyB0myv6xy4QeJyeQrSODa2lmNGlKJmTH_uDVD7rG9vthEqv13hmNl5YRSZtNMhC7Y2/exec"
};

const form = document.querySelector("#walk-form");
const practiceSections = document.querySelector("#practice-sections");
const statsGrid = document.querySelector("#stats-grid");
const sectionSummary = document.querySelector("#section-summary");
const completionBadge = document.querySelector("#completion-badge");
const progressFill = document.querySelector("#progress-fill");
const historyList = document.querySelector("#history-list");
const historyCount = document.querySelector("#history-count");
const historyOverview = document.querySelector("#history-overview");
const resetButton = document.querySelector("#reset-form");
const exportHistoryButton = document.querySelector("#export-history");
const exportEmailInput = document.querySelector("#export-email");
const exportStatus = document.querySelector("#export-status");
const practiceTemplate = document.querySelector("#practice-template");

let editingRecordId = null;
let historyRecords = loadHistory();

renderPracticeSections();
loadExportEmailPreference();
refreshExportStatus();
updateDashboard();
renderHistory();

form.addEventListener("input", updateDashboard);
form.addEventListener("submit", handleSave);
resetButton.addEventListener("click", resetFormState);
exportHistoryButton.addEventListener("click", exportHistory);
exportEmailInput.addEventListener("input", handleExportEmailInput);
historyList.addEventListener("click", handleHistoryAction);

function renderPracticeSections() {
  practiceSections.innerHTML = `
    <div class="section-title">
      <div>
        <p class="section-kicker">Identified practices</p>
        <h3>Observation evidence</h3>
      </div>
    </div>
  `;

  PRACTICES.forEach((practice) => {
    const fragment = practiceTemplate.content.cloneNode(true);
    const block = fragment.querySelector(".practice-block");
    block.dataset.practiceId = practice.id;
    fragment.querySelector(".practice-title").textContent = practice.title;
    fragment.querySelector(".practice-score").textContent = "0 of 0 ticked";
    fragment.querySelector(".practice-notes").id = `${practice.id}-notes`;

    const itemsContainer = fragment.querySelector(".practice-items");

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

    practiceSections.appendChild(fragment);
  });
}

function handleSave(event) {
  event.preventDefault();

  const record = collectFormData();
  const existingIndex = historyRecords.findIndex((item) => item.id === record.id);

  if (existingIndex >= 0) {
    historyRecords[existingIndex] = record;
  } else {
    historyRecords.unshift(record);
  }

  persistHistory();
  renderHistory();
  editingRecordId = record.id;
  updateDashboard();
}

function collectFormData() {
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
      notes: formData.get(`${practice.id}-notes`) || ""
    };
  });

  return {
    id: editingRecordId || crypto.randomUUID(),
    savedAt: new Date().toISOString(),
    observer: formData.get("observer") || "",
    teacher: formData.get("teacher") || "",
    date: formData.get("date") || "",
    subject: formData.get("subject") || "",
    lessonSegment: formData.get("lessonSegment") || "Beginning",
    className: formData.get("className") || "",
    classroom: formData.get("classroom") || "",
    lessonFocus: DEFAULT_LESSON_FOCUS,
    overallNotes: formData.get("overallNotes") || "",
    practices
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

function updateDashboard() {
  const data = collectFormData();
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

function updatePracticeScores(sectionMetrics) {
  sectionMetrics.forEach((section) => {
    const score = document.querySelector(`[data-practice-id="${section.id}"] .practice-score`);
    if (score) {
      score.textContent = `${section.observed} of ${section.total} ticked`;
    }
  });
}

function loadHistory() {
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch (error) {
    return [];
  }
}

function persistHistory() {
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(historyRecords));
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

function renderHistory() {
  historyCount.textContent = `${historyRecords.length} saved`;
  renderHistoryOverview();

  if (!historyRecords.length) {
    historyList.innerHTML = `
      <p class="empty-state">
        Saved walkthroughs will appear here. Records stay in this browser so leaders can revisit
        observations and export them later.
      </p>
    `;
    return;
  }

  historyList.innerHTML = historyRecords.map((record) => {
    const metrics = buildMetrics(record.practices);
    return `
      <article class="history-item">
        <h4>${escapeHtml(record.teacher || "Unnamed walkthrough")}</h4>
        <p class="history-meta">
          ${escapeHtml(record.observer || "No observer")} | ${escapeHtml(record.date || "No date")} |
          ${escapeHtml(record.subject || "No subject")} |
          ${escapeHtml(record.className || "No class")}<br>
          ${metrics.percent}% observed
        </p>
        <div class="history-actions">
          <button class="history-button" type="button" data-action="load" data-id="${record.id}">Open</button>
          <button class="history-button" type="button" data-action="delete" data-id="${record.id}">Delete</button>
        </div>
      </article>
    `;
  }).join("");
}

function renderHistoryOverview() {
  if (!historyRecords.length) {
    historyOverview.innerHTML = "";
    return;
  }

  const practiceScores = PRACTICES.map((practice) => ({
    title: practice.title,
    earned: 0,
    eligible: 0
  }));

  let totalPercent = 0;

  historyRecords.forEach((record) => {
    const metrics = buildMetrics(record.practices);
    totalPercent += metrics.percent;

    record.practices.forEach((practice, practiceIndex) => {
      practice.items.forEach((value) => {
        practiceScores[practiceIndex].eligible += 1;
        if (isObserved(value)) {
          practiceScores[practiceIndex].earned += 1;
        }
      });
    });
  });

  const averagePercent = Math.round(totalPercent / historyRecords.length);
  const bestPractice = practiceScores
    .map((practice) => ({
      ...practice,
      percent: practice.eligible ? Math.round((practice.earned / practice.eligible) * 100) : 0
    }))
    .sort((a, b) => b.percent - a.percent)[0];

  historyOverview.innerHTML = `
    <article class="stat">
      <strong>${historyRecords.length}</strong>
      <span>Total walkthroughs recorded</span>
    </article>
    <article class="stat">
      <strong>${averagePercent}%</strong>
      <span>Average observed score</span>
    </article>
    <article class="stat">
      <strong>${bestPractice ? bestPractice.percent : 0}%</strong>
      <span>Strongest trend: ${bestPractice ? bestPractice.title : "No trend yet"}</span>
    </article>
  `;
}

function handleHistoryAction(event) {
  const button = event.target.closest("[data-action]");
  if (!button) {
    return;
  }

  const { action, id } = button.dataset;
  const record = historyRecords.find((item) => item.id === id);

  if (!record) {
    return;
  }

  if (action === "load") {
    fillForm(record);
  }

  if (action === "delete") {
    historyRecords = historyRecords.filter((item) => item.id !== id);
    if (editingRecordId === id) {
      resetFormState();
    }
    persistHistory();
    renderHistory();
    updateDashboard();
  }
}

function fillForm(record) {
  editingRecordId = record.id;
  document.querySelector("#observer").value = record.observer || "";
  document.querySelector("#teacher").value = record.teacher;
  document.querySelector("#date").value = record.date;
  document.querySelector("#subject").value = record.subject;
  document.querySelector("#lesson-segment").value = record.lessonSegment;
  document.querySelector("#class-name").value = record.className;
  document.querySelector("#classroom").value = record.classroom;
  document.querySelector("#overall-notes").value = record.overallNotes;

  record.practices.forEach((practice) => {
    practice.items.forEach((value, index) => {
      const checkbox = document.querySelector(`#${practice.id}-${index}`);
      if (checkbox) {
        checkbox.checked = isObserved(value);
      }
    });
    const notesField = document.querySelector(`#${practice.id}-notes`);
    if (notesField) {
      notesField.value = practice.notes;
    }
  });

  updateDashboard();
}

function resetFormState() {
  editingRecordId = null;
  form.reset();
  document.querySelector("#date").value = new Date().toISOString().slice(0, 10);
  document.querySelector("#lesson-segment").value = "Beginning";
  loadExportEmailPreference();
  refreshExportStatus();

  PRACTICES.forEach((practice) => {
    const notesField = document.querySelector(`#${practice.id}-notes`);
    if (notesField) {
      notesField.value = "";
    }
  });

  updateDashboard();
}

async function exportHistory() {
  if (!historyRecords.length) {
    flashExportButton("No saved data", 1600);
    setExportStatus("Save at least one walkthrough before exporting a CSV.", "error");
    return;
  }

  const detailRows = historyRecords.flatMap((record) => buildIndicatorExportRows(record));
  const csvContent = buildCsv(detailRows);
  const recipientEmail = exportEmailInput.value.trim();
  const filename = "classroom-learning-walks-indicators.csv";

  downloadFile(
    csvContent,
    filename,
    "text/csv;charset=utf-8;"
  );

  if (!recipientEmail) {
    flashExportButton("CSV downloaded", 1800);
    setExportStatus(
      "CSV downloaded. Add an email address above if you also want the export sent through Gmail and archived in Drive.",
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
    setExportStatus(
      "CSV downloaded. Google Workspace delivery is ready in the app, but you still need to deploy the Apps Script web app and paste its URL into app.js before it can send.",
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
      recordCount: historyRecords.length
    });

    flashExportButton("CSV sent", 2200);
    setExportStatus(
      `CSV downloaded. Check the Google confirmation window for the final success message and Drive link for ${recipientEmail}.`,
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

function buildIndicatorExportRows(record) {
  return record.practices.flatMap((practice) => {
    const practiceDefinition = PRACTICES.find((item) => item.id === practice.id);
    return practice.items.map((value, index) => ({
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
      practiceId: practice.id,
      practiceTitle: practice.title,
      indicatorNumber: index + 1,
      indicatorText: practiceDefinition ? practiceDefinition.items[index] : "",
      observed: isObserved(value) ? 1 : 0,
      response: isObserved(value) ? "Ticked" : "Unticked",
      practiceNotes: practice.notes || "",
      overallNotes: record.overallNotes || "",
      reflectionWalkthroughNotes: record.overallNotes || ""
    }));
  });
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
      "Exporting still downloads the CSV. If Google Workspace delivery is configured, the same export will also be emailed and archived in Drive.",
      ""
    );
    return;
  }

  if (isValidEmail(value)) {
    setExportStatus(
      "The next export will download the CSV, then open a Google confirmation window to email it and save a copy to Drive.",
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
    exportHistoryButton.textContent = "Export indicators CSV";
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

resetFormState();
