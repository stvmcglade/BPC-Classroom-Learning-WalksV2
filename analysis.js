const PRACTICE_ORDER = [
  "Opportunities to Respond"
];
const TIMING_MODE_ORDER = [
  {
    key: "directInstruction",
    label: "Direct Instruction",
    timeField: "directInstructionTime",
    secondsField: "directInstructionSeconds",
    shareField: "directInstructionShare",
    segmentsField: "directInstructionSegments",
    colorClass: "timing-fill--direct"
  },
  {
    key: "collaborativeInstruction",
    label: "Co-Construction",
    timeField: "collaborativeInstructionTime",
    secondsField: "collaborativeInstructionSeconds",
    shareField: "collaborativeInstructionShare",
    segmentsField: "collaborativeInstructionSegments",
    colorClass: "timing-fill--collaborative"
  },
  {
    key: "independentWork",
    label: "Independent Work",
    timeField: "independentWorkTime",
    secondsField: "independentWorkSeconds",
    shareField: "independentWorkShare",
    segmentsField: "independentWorkSegments",
    colorClass: "timing-fill--independent"
  },
  {
    key: "teacherCollaboration",
    label: "Independent Work / Group Work / Teacher Collaboration",
    timeField: "teacherCollaborationTime",
    secondsField: "teacherCollaborationSeconds",
    shareField: "teacherCollaborationShare",
    segmentsField: "teacherCollaborationSegments",
    colorClass: "timing-fill--collaboration"
  }
];
const COMMENT_THEME_RULES = [
  {
    label: "Setting Up / entry routines",
    keywords: [
      "entry",
      "entering",
      "greet",
      "greeting",
      "seats",
      "sit",
      "materials",
      "laptops",
      "routine",
      "routines",
      "start of lesson"
    ]
  },
  {
    label: "Retrieval Task",
    keywords: [
      "retrieval",
      "prior knowledge",
      "device-free",
      "pen to paper",
      "circulate",
      "circulation",
      "scan",
      "responses",
      "review",
      "prompting",
      "ten minutes"
    ]
  },
  {
    label: "Learning Intention and Success Criteria",
    keywords: [
      "learning intention",
      "success criteria",
      "success criterion",
      "intention",
      "criteria"
    ]
  }
];
const STOP_WORDS = new Set([
  "a",
  "about",
  "after",
  "all",
  "also",
  "an",
  "and",
  "are",
  "as",
  "at",
  "be",
  "because",
  "been",
  "before",
  "being",
  "between",
  "both",
  "but",
  "by",
  "can",
  "could",
  "did",
  "do",
  "does",
  "for",
  "from",
  "had",
  "has",
  "have",
  "he",
  "her",
  "here",
  "him",
  "his",
  "how",
  "i",
  "if",
  "in",
  "into",
  "is",
  "it",
  "its",
  "lesson",
  "may",
  "more",
  "most",
  "no",
  "not",
  "notes",
  "observation",
  "observed",
  "of",
  "on",
  "or",
  "our",
  "overall",
  "should",
  "so",
  "some",
  "students",
  "such",
  "teacher",
  "teachers",
  "that",
  "the",
  "their",
  "them",
  "there",
  "these",
  "they",
  "this",
  "those",
  "to",
  "too",
  "was",
  "we",
  "were",
  "what",
  "when",
  "which",
  "while",
  "with",
  "would",
  "yet",
  "you"
]);

const fileInput = document.querySelector("#csv-files");
const clearButton = document.querySelector("#clear-analysis");
const downloadPdfButton = document.querySelector("#download-pdf");
const uploadStatus = document.querySelector("#upload-status");
const reportMeta = document.querySelector("#report-meta");
const analysisStats = document.querySelector("#analysis-stats");
const timingVisuals = document.querySelector("#timing-visuals");
const sectionVisuals = document.querySelector("#section-visuals");
const indicatorInsights = document.querySelector("#indicator-insights");
const commentTrends = document.querySelector("#comment-trends");
const reflectionComments = document.querySelector("#reflection-comments");
let currentAnalysis = null;

fileInput.addEventListener("change", handleFileUpload);
clearButton.addEventListener("click", resetAnalysis);
downloadPdfButton.addEventListener("click", downloadPdfReport);

resetAnalysis();

async function handleFileUpload(event) {
  const files = Array.from(event.target.files || []);
  if (!files.length) {
    resetAnalysis();
    return;
  }

  uploadStatus.textContent = `Loading ${files.length} file${files.length === 1 ? "" : "s"}...`;

  try {
    const filePayloads = await Promise.all(
      files.map(async (file) => ({
        fileName: file.name,
        rows: parseCsv(await file.text())
      }))
    );

    const combinedRows = filePayloads.flatMap(({ fileName, rows }) =>
      rows.map((row) => ({
        ...row,
        sourceFile: fileName
      }))
    );

    const cleanRows = combinedRows.filter((row) => row.practiceTitle && row.indicatorText);

    if (!cleanRows.length) {
      throw new Error("The uploaded files do not contain any indicator rows.");
    }

    const analysis = buildAnalysis(cleanRows, files.length);
    currentAnalysis = analysis;
    renderAnalysis(analysis);
    uploadStatus.textContent =
      `Loaded ${analysis.fileCount} file${analysis.fileCount === 1 ? "" : "s"} with ` +
      `${analysis.walkthroughCount} walkthrough${analysis.walkthroughCount === 1 ? "" : "s"} and ` +
      `${analysis.rowCount} indicator rows.`;
  } catch (error) {
    resetAnalysis();
    uploadStatus.textContent = error.message || "Unable to read the uploaded files.";
  }
}

function buildAnalysis(rows, fileCount) {
  const sectionMap = new Map();
  const commentMap = new Map();
  const observerSet = new Set();
  const teacherSet = new Set();
  const walkthroughSet = new Set();
  const walkthroughTimingMap = new Map();

  rows.forEach((row, index) => {
    if (row.observer) {
      observerSet.add(row.observer);
    }
    if (row.teacherObserved) {
      teacherSet.add(row.teacherObserved);
    }

    const walkthroughKey =
      row.recordId ||
      [row.walkDate, row.observer, row.teacherObserved, row.className, row.sourceFile, index].join("|");
    walkthroughSet.add(walkthroughKey);

    if (!walkthroughTimingMap.has(walkthroughKey)) {
      walkthroughTimingMap.set(walkthroughKey, buildTimingWalkthroughRecord(row));
    }

    const reflectionNote = (row.reflectionWalkthroughNotes || row.overallNotes || "").trim();
    if (reflectionNote && !commentMap.has(`${walkthroughKey}::reflection`)) {
      commentMap.set(`${walkthroughKey}::reflection`, {
        walkDate: row.walkDate || "",
        observer: row.observer || "",
        teacherObserved: row.teacherObserved || "",
        subject: row.subject || "",
        className: row.className || "",
        classroom: row.classroom || "",
        note: reflectionNote,
        sourceLabel: "Walkthrough reflection notes"
      });
    }

    const practiceNote = (row.practiceNotes || "").trim();
    if (practiceNote && !commentMap.has(`${walkthroughKey}::practice::${row.practiceId}`)) {
      commentMap.set(`${walkthroughKey}::practice::${row.practiceId}`, {
        walkDate: row.walkDate || "",
        observer: row.observer || "",
        teacherObserved: row.teacherObserved || "",
        subject: row.subject || "",
        className: row.className || "",
        classroom: row.classroom || "",
        practiceTitle: row.practiceTitle || "",
        note: practiceNote,
        sourceLabel: row.practiceTitle
          ? `Practice notes: ${row.practiceTitle}`
          : "Practice notes"
      });
    }

    const sectionKey = row.practiceTitle;
    if (!sectionMap.has(sectionKey)) {
      sectionMap.set(sectionKey, {
        title: row.practiceTitle,
        practiceId: row.practiceId || "",
        observed: 0,
        total: 0,
        indicators: new Map()
      });
    }

    const section = sectionMap.get(sectionKey);
    const observed = isObservedRow(row);
    section.total += 1;
    section.observed += observed ? 1 : 0;

    const indicatorKey = `${row.practiceTitle}::${row.indicatorNumber}::${row.indicatorText}`;
    if (!section.indicators.has(indicatorKey)) {
      section.indicators.set(indicatorKey, {
        number: Number(row.indicatorNumber) || 0,
        text: row.indicatorText,
        observed: 0,
        total: 0
      });
    }

    const indicator = section.indicators.get(indicatorKey);
    indicator.total += 1;
    indicator.observed += observed ? 1 : 0;
  });

  const sections = Array.from(sectionMap.values())
    .map((section) => ({
      ...section,
      percent: section.total ? Math.round((section.observed / section.total) * 100) : 0,
      unticked: section.total - section.observed,
      indicators: Array.from(section.indicators.values())
        .map((indicator) => ({
          ...indicator,
          percent: indicator.total ? Math.round((indicator.observed / indicator.total) * 100) : 0
        }))
        .sort((a, b) => a.number - b.number || a.text.localeCompare(b.text))
    }))
    .sort(sortSections);

  const allIndicators = sections.flatMap((section) =>
    section.indicators.map((indicator) => ({
      ...indicator,
      sectionTitle: section.title
    }))
  );

  const bestIndicators = [...allIndicators]
    .filter((item) => item.total > 0)
    .sort((a, b) => b.percent - a.percent || b.observed - a.observed)
    .slice(0, 5);

  const weakestIndicators = [...allIndicators]
    .filter((item) => item.total > 0)
    .sort((a, b) => a.percent - b.percent || a.observed - b.observed)
    .slice(0, 5);
  const comments = Array.from(commentMap.values()).sort((a, b) =>
    [b.walkDate, b.observer, b.teacherObserved].join("|").localeCompare(
      [a.walkDate, a.observer, a.teacherObserved].join("|")
    )
  );
  const timing = buildTimingAnalysis(Array.from(walkthroughTimingMap.values()));

  return {
    fileCount,
    rowCount: rows.length,
    sectionCount: sections.length,
    observerCount: observerSet.size,
    teacherCount: teacherSet.size,
    walkthroughCount: walkthroughSet.size,
    overallObserved: rows.filter(isObservedRow).length,
    overallUnticked: rows.filter((row) => !isObservedRow(row)).length,
    sections,
    bestIndicators,
    weakestIndicators,
    comments,
    commentInsights: buildCommentInsights(comments),
    timing
  };
}

function renderAnalysis(analysis) {
  reportMeta.innerHTML = `
    <div class="report-meta__grid">
      <article class="stat">
        <strong>${formatDisplayDate(new Date().toISOString())}</strong>
        <span>Report prepared</span>
      </article>
      <article class="stat">
        <strong>${analysis.fileCount}</strong>
        <span>CSV files included</span>
      </article>
      <article class="stat">
        <strong>${analysis.walkthroughCount}</strong>
        <span>Walkthroughs included</span>
      </article>
      <article class="stat">
        <strong>${analysis.rowCount}</strong>
        <span>Indicator rows analysed</span>
      </article>
    </div>
  `;

  analysisStats.innerHTML = [
    { label: "Files uploaded", value: analysis.fileCount },
    { label: "Walkthroughs combined", value: analysis.walkthroughCount },
    { label: "Observers", value: analysis.observerCount },
    { label: "Teachers observed", value: analysis.teacherCount },
    { label: "Indicator rows", value: analysis.rowCount },
    { label: "Observed responses", value: analysis.overallObserved },
    { label: "Unticked responses", value: analysis.overallUnticked },
    { label: "Sections analysed", value: analysis.sectionCount },
    { label: "Timing walkthroughs", value: analysis.timing.walkthroughsWithTiming }
  ]
    .map(
      (stat) => `
        <article class="stat">
          <strong>${stat.value}</strong>
          <span>${stat.label}</span>
        </article>
      `
    )
    .join("");

  timingVisuals.innerHTML = renderTimingAnalysis(analysis.timing);

  sectionVisuals.innerHTML = analysis.sections
    .map(
      (section) => `
        <article class="section-analysis">
          <div class="section-analysis__header">
            <div>
              <h3>${escapeHtml(section.title)}</h3>
              <p class="section-analysis__meta">
                ${section.observed} observed out of ${section.total} responses
              </p>
            </div>
            <span class="section-analysis__score">${section.percent}%</span>
          </div>
          <div class="comparison-bar">
            <div class="comparison-bar__track">
              <div class="comparison-bar__fill" style="width:${section.percent}%"></div>
            </div>
            <span class="comparison-bar__value">${section.percent}%</span>
            <span class="comparison-bar__count">${section.unticked} unticked</span>
          </div>
          <div class="indicator-chart">
            ${section.indicators
              .map(
                (indicator) => `
                  <article class="indicator-row">
                    <div class="indicator-row__label">
                      <span class="indicator-row__title">${escapeHtml(indicator.text)}</span>
                      <span class="indicator-row__value">${indicator.percent}%</span>
                    </div>
                    <div class="indicator-row__track">
                      <div class="indicator-row__fill" style="width:${indicator.percent}%"></div>
                    </div>
                  </article>
                `
              )
              .join("")}
          </div>
        </article>
      `
    )
    .join("");

  indicatorInsights.innerHTML = `
    <article class="indicator-insight">
      <h3>Most observed indicators</h3>
      <div class="insight-list">
        ${renderInsightItems(analysis.bestIndicators)}
      </div>
    </article>
    <article class="indicator-insight">
      <h3>Least observed indicators</h3>
      <div class="insight-list">
        ${renderInsightItems(analysis.weakestIndicators)}
      </div>
    </article>
  `;

  commentTrends.innerHTML = renderCommentTrends(analysis.commentInsights);
  reflectionComments.innerHTML = renderComments(analysis.comments);
}

function renderInsightItems(items) {
  if (!items.length) {
    return `<p class="empty-state">No indicator trends available yet.</p>`;
  }

  return items
    .map(
      (item) => `
        <article class="insight-item">
          <strong>${escapeHtml(item.sectionTitle)}</strong>
          <span>${escapeHtml(item.text)}</span>
          <span>${item.percent}% observed (${item.observed} of ${item.total})</span>
        </article>
      `
    )
    .join("");
}

function renderTimingAnalysis(timing) {
  if (!timing.walkthroughsWithTiming) {
    return '<p class="empty-state">No instruction timing data was found in the uploaded files.</p>';
  }

  return `
    <div class="timing-visuals__grid">
      <article class="section-analysis">
        <div class="section-analysis__header">
          <div>
            <h3>Average observation timing</h3>
            <p class="section-analysis__meta">
              Based on ${timing.walkthroughsWithTiming} walkthrough${timing.walkthroughsWithTiming === 1 ? "" : "s"} with timing data
            </p>
          </div>
          <span class="section-analysis__score">${escapeHtml(timing.averageObservationTime)}</span>
        </div>
        <div class="analysis-stats timing-stats">
          <article class="stat">
            <strong>${escapeHtml(timing.averageObservationTime)}</strong>
            <span>Average observation time</span>
          </article>
          <article class="stat">
            <strong>${escapeHtml(timing.averageTotalSegments)}</strong>
            <span>Average total segments</span>
          </article>
          <article class="stat">
            <strong>${escapeHtml(timing.totalObservationTime)}</strong>
            <span>Total observation time</span>
          </article>
          <article class="stat">
            <strong>${escapeHtml(timing.mostCommonActiveMode)}</strong>
            <span>Most common active mode at export</span>
          </article>
        </div>
      </article>
      <article class="section-analysis">
        <div class="section-analysis__header">
          <div>
            <h3>Average lesson share by mode</h3>
            <p class="section-analysis__meta">
              Each bar shows the average proportion of observation time spent in each teaching mode
            </p>
          </div>
          <span class="section-analysis__score">${timing.totalAverageShare}%</span>
        </div>
        <div class="timing-share-track" aria-hidden="true">
          ${timing.modes
            .map((mode) => `
              <span class="timing-share-fill ${mode.colorClass}" style="width:${mode.averageShare}%"></span>
            `)
            .join("")}
        </div>
        <div class="indicator-chart timing-mode-chart">
          ${timing.modes
            .map((mode) => `
              <article class="indicator-row">
                <div class="indicator-row__label">
                  <span class="indicator-row__title">${escapeHtml(mode.label)}</span>
                  <span class="indicator-row__value">${mode.averageShare}%</span>
                </div>
                <div class="indicator-row__track">
                  <div class="indicator-row__fill ${mode.colorClass}" style="width:${mode.averageShare}%"></div>
                </div>
                <p class="timing-mode-meta">
                  Avg time ${escapeHtml(mode.averageTime)} | Avg segments ${escapeHtml(mode.averageSegments)}
                </p>
              </article>
            `)
            .join("")}
        </div>
      </article>
    </div>
  `;
}

function renderComments(comments) {
  if (!comments.length) {
    return '<p class="empty-state">No walkthrough or practice comments were found in the uploaded files.</p>';
  }

  return comments
    .map(
      (comment) => `
        <article class="comment-card">
          <p class="comment-card__meta">
            ${escapeHtml(comment.walkDate || "No date")} | ${escapeHtml(comment.observer || "No observer")} |
            ${escapeHtml(comment.teacherObserved || "No teacher")} | ${escapeHtml(comment.className || "No class")} |
            ${escapeHtml(comment.sourceLabel || "Comment")}
          </p>
          <p class="comment-card__body">${escapeHtml(comment.note)}</p>
        </article>
      `
    )
    .join("");
}

function renderCommentTrends(insights) {
  if (!insights.totalComments) {
    return '<p class="empty-state">No walkthrough or practice comments were found in the uploaded files.</p>';
  }

  return `
    <div class="comment-trends__grid">
      <article class="indicator-insight">
        <h3>Section mentions in comments</h3>
        <div class="insight-list">
          ${insights.themeMentions
            .map(
              (theme) => `
                <article class="insight-item">
                  <strong>${escapeHtml(theme.label)}</strong>
                  <span>Mentioned in ${theme.count} of ${insights.totalComments} comments (${theme.percent}%)</span>
                </article>
              `
            )
            .join("")}
        </div>
      </article>
      <article class="indicator-insight">
        <h3>Most common phrases</h3>
        <div class="trend-chip-list">
          ${
            insights.topPhrases.length
              ? insights.topPhrases
                  .map(
                    (item) => `
                      <span class="trend-chip">${escapeHtml(item.label)} (${item.count})</span>
                    `
                  )
                  .join("")
              : '<p class="empty-state">No repeated phrases detected yet.</p>'
          }
        </div>
      </article>
      <article class="indicator-insight">
        <h3>Most common keywords</h3>
        <div class="trend-chip-list">
          ${
            insights.topTerms.length
              ? insights.topTerms
                  .map(
                    (item) => `
                      <span class="trend-chip">${escapeHtml(item.label)} (${item.count})</span>
                    `
                  )
                  .join("")
              : '<p class="empty-state">No repeated keywords detected yet.</p>'
          }
        </div>
      </article>
    </div>
  `;
}

function parseCsv(text) {
  const rows = [];
  let currentValue = "";
  let currentRow = [];
  let inQuotes = false;

  for (let index = 0; index < text.length; index += 1) {
    const character = text[index];
    const nextCharacter = text[index + 1];

    if (character === "\"") {
      if (inQuotes && nextCharacter === "\"") {
        currentValue += "\"";
        index += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (character === "," && !inQuotes) {
      currentRow.push(currentValue);
      currentValue = "";
      continue;
    }

    if ((character === "\n" || character === "\r") && !inQuotes) {
      if (character === "\r" && nextCharacter === "\n") {
        index += 1;
      }
      currentRow.push(currentValue);
      if (currentRow.some((value) => value !== "")) {
        rows.push(currentRow);
      }
      currentRow = [];
      currentValue = "";
      continue;
    }

    currentValue += character;
  }

  if (currentValue !== "" || currentRow.length) {
    currentRow.push(currentValue);
    rows.push(currentRow);
  }

  if (!rows.length) {
    return [];
  }

  const [headers, ...dataRows] = rows;
  const cleanHeaders = headers.map((header, index) =>
    index === 0 ? header.replace(/^\uFEFF/, "").trim() : header.trim()
  );
  return dataRows.map((row) => {
    const record = {};
    cleanHeaders.forEach((header, index) => {
      record[header] = row[index] || "";
    });
    return record;
  });
}

function buildTimingWalkthroughRecord(row) {
  const modeSummaries = TIMING_MODE_ORDER.map((mode) => {
    const seconds = parseNumber(row[mode.secondsField]);
    const share = parseNumber(row[mode.shareField]);
    const segments = parseNumber(row[mode.segmentsField]);
    return {
      ...mode,
      seconds,
      share,
      segments
    };
  });

  return {
    observationSeconds: parseNumber(row.observationSeconds),
    totalTimingSegments: parseNumber(row.totalTimingSegments),
    activeTeachingMode: row.activeTeachingMode || "",
    modes: modeSummaries
  };
}

function buildTimingAnalysis(walkthroughs) {
  const withTiming = walkthroughs.filter((walkthrough) =>
    walkthrough.observationSeconds > 0 ||
    walkthrough.totalTimingSegments > 0 ||
    walkthrough.modes.some((mode) => mode.seconds > 0 || mode.share > 0 || mode.segments > 0)
  );

  if (!withTiming.length) {
    return {
      walkthroughsWithTiming: 0,
      averageObservationTime: "00:00:00",
      totalObservationTime: "00:00:00",
      averageTotalSegments: "0.0",
      totalAverageShare: 0,
      mostCommonActiveMode: "No timing captured",
      modes: TIMING_MODE_ORDER.map((mode) => ({
        label: mode.label,
        colorClass: mode.colorClass,
        averageTime: "00:00:00",
        averageShare: 0,
        averageSegments: "0.0"
      }))
    };
  }

  const modeTotals = TIMING_MODE_ORDER.map((mode) => ({
    ...mode,
    seconds: 0,
    share: 0,
    segments: 0
  }));
  const activeModeCounts = new Map();
  let totalObservationSeconds = 0;
  let totalSegments = 0;

  withTiming.forEach((walkthrough) => {
    totalObservationSeconds += walkthrough.observationSeconds;
    totalSegments += walkthrough.totalTimingSegments;

    if (walkthrough.activeTeachingMode) {
      activeModeCounts.set(
        walkthrough.activeTeachingMode,
        (activeModeCounts.get(walkthrough.activeTeachingMode) || 0) + 1
      );
    }

    walkthrough.modes.forEach((mode, index) => {
      modeTotals[index].seconds += mode.seconds;
      modeTotals[index].share += mode.share;
      modeTotals[index].segments += mode.segments;
    });
  });

  const modes = modeTotals.map((mode) => ({
    label: mode.label,
    colorClass: mode.colorClass,
    averageTime: formatDurationFromSeconds(mode.seconds / withTiming.length),
    averageShare: Math.round(mode.share / withTiming.length),
    averageSegments: (mode.segments / withTiming.length).toFixed(1)
  }));

  return {
    walkthroughsWithTiming: withTiming.length,
    averageObservationTime: formatDurationFromSeconds(totalObservationSeconds / withTiming.length),
    totalObservationTime: formatDurationFromSeconds(totalObservationSeconds),
    averageTotalSegments: (totalSegments / withTiming.length).toFixed(1),
    totalAverageShare: modes.reduce((sum, mode) => sum + mode.averageShare, 0),
    mostCommonActiveMode: findMostCommonLabel(activeModeCounts) || "No active mode recorded",
    modes
  };
}

function parseNumber(value) {
  const parsed = Number.parseFloat(String(value || "").trim());
  return Number.isFinite(parsed) ? parsed : 0;
}

function formatDurationFromSeconds(totalSeconds) {
  const safeSeconds = Math.max(0, Math.round(totalSeconds));
  const hours = String(Math.floor(safeSeconds / 3600)).padStart(2, "0");
  const minutes = String(Math.floor((safeSeconds % 3600) / 60)).padStart(2, "0");
  const seconds = String(safeSeconds % 60).padStart(2, "0");
  return `${hours}:${minutes}:${seconds}`;
}

function findMostCommonLabel(countMap) {
  return Array.from(countMap.entries())
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0]?.[0] || "";
}

function isObservedRow(row) {
  return String(row.observed).trim() === "1" || String(row.response).trim().toLowerCase() === "ticked";
}

function sortSections(a, b) {
  const aIndex = PRACTICE_ORDER.indexOf(a.title);
  const bIndex = PRACTICE_ORDER.indexOf(b.title);

  if (aIndex === -1 && bIndex === -1) {
    return a.title.localeCompare(b.title);
  }
  if (aIndex === -1) {
    return 1;
  }
  if (bIndex === -1) {
    return -1;
  }
  return aIndex - bIndex;
}

function buildCommentInsights(comments) {
  if (!comments.length) {
    return {
      totalComments: 0,
      themeMentions: [],
      topTerms: [],
      topPhrases: []
    };
  }

  const termCounts = new Map();
  const phraseCounts = new Map();

  comments.forEach((comment) => {
    const tokens = tokenizeComment(comment.note);
    const uniqueTerms = new Set(tokens.filter((token) => !STOP_WORDS.has(token) && token.length >= 4));
    const uniquePhrases = new Set();

    for (let index = 0; index < tokens.length - 1; index += 1) {
      const first = tokens[index];
      const second = tokens[index + 1];
      if (
        first.length >= 3 &&
        second.length >= 3 &&
        !STOP_WORDS.has(first) &&
        !STOP_WORDS.has(second)
      ) {
        uniquePhrases.add(`${first} ${second}`);
      }
    }

    uniqueTerms.forEach((term) => {
      termCounts.set(term, (termCounts.get(term) || 0) + 1);
    });
    uniquePhrases.forEach((phrase) => {
      phraseCounts.set(phrase, (phraseCounts.get(phrase) || 0) + 1);
    });
  });

  return {
    totalComments: comments.length,
    themeMentions: COMMENT_THEME_RULES.map((theme) => {
      const count = comments.filter((comment) =>
        theme.keywords.some((keyword) => comment.note.toLowerCase().includes(keyword))
      ).length;
      return {
        label: theme.label,
        count,
        percent: comments.length ? Math.round((count / comments.length) * 100) : 0
      };
    }),
    topTerms: mapCountsToRankedList(termCounts, 10),
    topPhrases: mapCountsToRankedList(phraseCounts, 8)
  };
}

function tokenizeComment(text) {
  return String(text)
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter(Boolean);
}

function mapCountsToRankedList(countMap, limit) {
  return Array.from(countMap.entries())
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, limit)
    .map(([label, count]) => ({ label, count }));
}

function resetAnalysis() {
  currentAnalysis = null;
  if (fileInput) {
    fileInput.value = "";
  }
  uploadStatus.textContent = "No files uploaded yet.";
  reportMeta.innerHTML =
    '<p class="empty-state">Upload data to prepare a report summary for PDF export.</p>';
  analysisStats.innerHTML =
    '<p class="empty-state">Upload indicator CSV files to see overall counts and section summaries.</p>';
  timingVisuals.innerHTML =
    '<p class="empty-state">Upload data to see average instruction timing across walkthroughs.</p>';
  sectionVisuals.innerHTML =
    '<p class="empty-state">Section charts will appear here after files are uploaded.</p>';
  indicatorInsights.innerHTML =
    '<p class="empty-state">Upload data to reveal the strongest and weakest indicator trends.</p>';
  commentTrends.innerHTML =
    '<p class="empty-state">Upload data to analyse repeated themes, phrases, and keywords from walkthrough and practice notes.</p>';
  reflectionComments.innerHTML =
    '<p class="empty-state">Upload data to view the comments captured in the walkthrough reflection notes and practice-level notes.</p>';
}

function downloadPdfReport() {
  if (!currentAnalysis) {
    uploadStatus.textContent = "Upload at least one indicators CSV file before downloading the PDF report.";
    return;
  }

  const pdfBytes = buildPdfReport(currentAnalysis);
  const blob = new Blob([pdfBytes], { type: "application/pdf" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `learning-walk-analysis-report-${formatFileDate(new Date())}.pdf`;
  link.click();
  URL.revokeObjectURL(url);
  uploadStatus.textContent = "PDF report downloaded.";
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll("\"", "&quot;")
    .replaceAll("'", "&#39;");
}

function formatDisplayDate(value) {
  return new Date(value).toLocaleString("en-AU", {
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit"
  });
}

function formatFileDate(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function buildPdfReport(analysis) {
  const pdf = new SimplePdfDocument({ width: 841.89, height: 595.28 });

  renderPdfSummaryPage(pdf, analysis);
  renderPdfTimingPage(pdf, analysis);
  renderPdfDetailPage(pdf, analysis);
  renderPdfCommentsPages(pdf, analysis);

  return pdf.toUint8Array();
}

function renderPdfSummaryPage(pdf, analysis) {
  pdf.addPage();

  const margin = 32;
  const pageWidth = pdf.width - margin * 2;
  let top = 28;

  pdf.drawText("Learning Walk Analysis Report", margin, top, {
    fontSize: 22,
    fontWeight: "bold",
    color: [16, 23, 32]
  });
  top += 24;

  pdf.drawText(
    `Prepared ${formatDisplayDate(new Date().toISOString())} | ${analysis.fileCount} files | ${analysis.walkthroughCount} walkthroughs`,
    margin,
    top,
    {
      fontSize: 10,
      color: [82, 97, 112]
    }
  );
  top += 26;

  const metaCards = [
    { label: "Observers", value: String(analysis.observerCount) },
    { label: "Teachers observed", value: String(analysis.teacherCount) },
    { label: "Indicator rows", value: String(analysis.rowCount) },
    { label: "Observed responses", value: `${buildPercent(analysis.overallObserved, analysis.rowCount)}%` }
  ];
  top = renderPdfStatGrid(pdf, metaCards, margin, top, pageWidth, 4, 72);
  top += 12;

  pdf.drawText("Combined dataset snapshot", margin, top, {
    fontSize: 14,
    fontWeight: "bold",
    color: [16, 23, 32]
  });
  top += 18;

  const overviewCards = [
    { label: "Files uploaded", value: String(analysis.fileCount) },
    { label: "Walkthroughs combined", value: String(analysis.walkthroughCount) },
    { label: "Observers", value: String(analysis.observerCount) },
    { label: "Teachers observed", value: String(analysis.teacherCount) },
    { label: "Indicator rows", value: String(analysis.rowCount) },
    { label: "Observed", value: String(analysis.overallObserved) },
    { label: "Unticked", value: String(analysis.overallUnticked) },
    { label: "Sections analysed", value: String(analysis.sectionCount) }
  ];
  top = renderPdfStatGrid(pdf, overviewCards, margin, top, pageWidth, 4, 64);
  top += 14;

  pdf.drawText("Section snapshots", margin, top, {
    fontSize: 14,
    fontWeight: "bold",
    color: [16, 23, 32]
  });
  top += 16;

  const cardGap = 12;
  const cardWidth = (pageWidth - cardGap * 2) / 3;
  const cardHeight = 225;

  analysis.sections.forEach((section, index) => {
    const cardX = margin + index * (cardWidth + cardGap);
    renderPdfSectionSummaryCard(pdf, section, cardX, top, cardWidth, cardHeight);
  });
}

function renderPdfDetailPage(pdf, analysis) {
  pdf.addPage();

  const margin = 26;
  const pageWidth = pdf.width - margin * 2;
  let top = 26;

  pdf.drawText("Section detail and indicator trends", margin, top, {
    fontSize: 18,
    fontWeight: "bold",
    color: [16, 23, 32]
  });
  top += 20;

  const columnGap = 10;
  const columnWidth = (pageWidth - columnGap * 2) / 3;
  const sectionHeight = 250;

  analysis.sections.forEach((section, index) => {
    const x = margin + index * (columnWidth + columnGap);
    renderPdfSectionDetailCard(pdf, section, x, top, columnWidth, sectionHeight);
  });

  const insightsTop = top + sectionHeight + 14;
  const insightGap = 12;
  const insightWidth = (pageWidth - insightGap) / 2;

  renderPdfInsightCard(
    pdf,
    "Most observed indicators",
    analysis.bestIndicators,
    margin,
    insightsTop,
    insightWidth,
    220
  );
  renderPdfInsightCard(
    pdf,
    "Least observed indicators",
    analysis.weakestIndicators,
    margin + insightWidth + insightGap,
    insightsTop,
    insightWidth,
    220
  );
}

function renderPdfTimingPage(pdf, analysis) {
  pdf.addPage();

  const margin = 28;
  const pageWidth = pdf.width - margin * 2;
  let top = 28;

  pdf.drawText("Instruction timing averages", margin, top, {
    fontSize: 18,
    fontWeight: "bold",
    color: [16, 23, 32]
  });
  top += 20;

  pdf.drawText(
    `Timing data captured in ${analysis.timing.walkthroughsWithTiming} of ${analysis.walkthroughCount} walkthroughs`,
    margin,
    top,
    {
      fontSize: 10,
      color: [82, 97, 112]
    }
  );
  top += 24;

  const timingOverviewCards = [
    { label: "Average observation time", value: analysis.timing.averageObservationTime },
    { label: "Average total segments", value: analysis.timing.averageTotalSegments },
    { label: "Total observation time", value: analysis.timing.totalObservationTime },
    { label: "Most common active mode", value: analysis.timing.mostCommonActiveMode }
  ];
  top = renderPdfStatGrid(pdf, timingOverviewCards, margin, top, pageWidth, 4, 72);
  top += 16;

  pdf.drawText("Average share by teaching mode", margin, top, {
    fontSize: 14,
    fontWeight: "bold",
    color: [16, 23, 32]
  });
  top += 20;

  const trackX = margin;
  const trackY = top;
  const trackWidth = pageWidth;
  const trackHeight = 18;
  const timingColors = [
    [118, 194, 158],
    [124, 228, 214],
    [115, 213, 248],
    [244, 198, 117]
  ];

  pdf.drawRect(trackX, trackY, trackWidth, trackHeight, {
    fillColor: [230, 236, 242],
    strokeColor: [230, 236, 242]
  });

  let shareCursor = trackX;
  analysis.timing.modes.forEach((mode, index) => {
    const barWidth = trackWidth * (mode.averageShare / 100);
    if (barWidth <= 0) {
      return;
    }

    pdf.drawRect(shareCursor, trackY, barWidth, trackHeight, {
      fillColor: timingColors[index] || [118, 194, 158],
      strokeColor: timingColors[index] || [118, 194, 158]
    });
    shareCursor += barWidth;
  });
  top += 34;

  const modeGap = 12;
  const modeCardWidth = (pageWidth - modeGap) / 2;
  const modeCardHeight = 96;

  analysis.timing.modes.forEach((mode, index) => {
    const column = index % 2;
    const row = Math.floor(index / 2);
    const cardX = margin + column * (modeCardWidth + modeGap);
    const cardY = top + row * (modeCardHeight + modeGap);

    pdf.drawRect(cardX, cardY, modeCardWidth, modeCardHeight, {
      fillColor: [247, 249, 252],
      strokeColor: [210, 220, 230],
      lineWidth: 1
    });

    pdf.drawText(mode.label, cardX + 12, cardY + 14, {
      fontSize: 10,
      fontWeight: "bold",
      color: [16, 23, 32]
    });
    pdf.drawText(`${mode.averageShare}%`, cardX + modeCardWidth - 42, cardY + 14, {
      fontSize: 10,
      fontWeight: "bold",
      color: timingColors[index] || [41, 94, 72]
    });
    pdf.drawText(`Average time: ${mode.averageTime}`, cardX + 12, cardY + 36, {
      fontSize: 9,
      color: [82, 97, 112]
    });
    pdf.drawText(`Average segments: ${mode.averageSegments}`, cardX + 12, cardY + 54, {
      fontSize: 9,
      color: [82, 97, 112]
    });

    pdf.drawRect(cardX + 12, cardY + 70, modeCardWidth - 24, 10, {
      fillColor: [230, 236, 242],
      strokeColor: [230, 236, 242]
    });
    pdf.drawRect(cardX + 12, cardY + 70, (modeCardWidth - 24) * (mode.averageShare / 100), 10, {
      fillColor: timingColors[index] || [118, 194, 158],
      strokeColor: timingColors[index] || [118, 194, 158]
    });
  });
}

function renderPdfCommentsPages(pdf, analysis) {
  const sourceComments = analysis.comments.length
    ? analysis.comments
    : [
        {
          walkDate: "",
          observer: "",
          teacherObserved: "",
          className: "",
          note: "No reflection comments were found in the uploaded files."
        }
      ];
  const comments = sourceComments.flatMap((comment) =>
    splitCommentForPdf(pdf, comment, pdf.width - 56, pdf.height - 150)
  );

  let pageTop = 28;
  let availableTop = pageTop;
  let pageIndex = -1;

  comments.forEach((comment, index) => {
    const requiredHeight = measureCommentCardHeight(pdf, comment, 785);

    if (pageIndex === -1 || availableTop + requiredHeight > pdf.height - 36) {
      pdf.addPage();
      pageIndex += 1;
      availableTop = pageTop;

      pdf.drawText(
        pageIndex === 0 ? "Reflection notes and walkthrough comments" : "Reflection notes (continued)",
        28,
        availableTop,
        {
          fontSize: 18,
          fontWeight: "bold",
          color: [16, 23, 32]
        }
      );
      availableTop += 22;

      availableTop += 4;
    }

    renderPdfCommentCard(pdf, comment, 28, availableTop, pdf.width - 56);
    availableTop += requiredHeight + 10;
  });
}

function renderPdfStatGrid(pdf, cards, x, top, width, columns, cardHeight) {
  const gap = 10;
  const cardWidth = (width - gap * (columns - 1)) / columns;
  const rows = Math.ceil(cards.length / columns);

  cards.forEach((card, index) => {
    const column = index % columns;
    const row = Math.floor(index / columns);
    const cardX = x + column * (cardWidth + gap);
    const cardY = top + row * (cardHeight + gap);

    pdf.drawRect(cardX, cardY, cardWidth, cardHeight, {
      fillColor: [247, 249, 252],
      strokeColor: [210, 220, 230],
      lineWidth: 1
    });
    pdf.drawText(card.value, cardX + 12, cardY + 18, {
      fontSize: 18,
      fontWeight: "bold",
      color: [16, 23, 32]
    });
    pdf.drawWrappedText(card.label, cardX + 12, cardY + 42, cardWidth - 24, {
      fontSize: 9,
      lineHeight: 12,
      color: [82, 97, 112]
    });
  });

  return top + rows * cardHeight + (rows - 1) * gap;
}

function renderPdfSectionSummaryCard(pdf, section, x, top, width, height) {
  pdf.drawRect(x, top, width, height, {
    fillColor: [247, 249, 252],
    strokeColor: [210, 220, 230],
    lineWidth: 1
  });

  pdf.drawText(section.title, x + 12, top + 16, {
    fontSize: 12,
    fontWeight: "bold",
    color: [16, 23, 32]
  });
  pdf.drawText(`${section.percent}% observed`, x + width - 92, top + 16, {
    fontSize: 11,
    fontWeight: "bold",
    color: [41, 94, 72]
  });
  pdf.drawText(`${section.observed} observed of ${section.total} responses`, x + 12, top + 34, {
    fontSize: 9,
    color: [82, 97, 112]
  });

  pdf.drawRect(x + 12, top + 52, width - 24, 12, {
    fillColor: [230, 236, 242],
    strokeColor: [230, 236, 242]
  });
  pdf.drawRect(x + 12, top + 52, (width - 24) * (section.percent / 100), 12, {
    fillColor: [118, 194, 158],
    strokeColor: [118, 194, 158]
  });

  const strongest = [...section.indicators]
    .sort((a, b) => b.percent - a.percent || a.number - b.number)
    .slice(0, 2);
  const weakest = [...section.indicators]
    .sort((a, b) => a.percent - b.percent || a.number - b.number)
    .slice(0, 2);

  pdf.drawText("Strongest indicators", x + 12, top + 82, {
    fontSize: 10,
    fontWeight: "bold",
    color: [16, 23, 32]
  });
  let cursor = top + 98;
  strongest.forEach((indicator) => {
    cursor += renderBulletText(
      pdf,
      `${indicator.percent}% - ${indicator.text}`,
      x + 16,
      cursor,
      width - 28,
      8,
      [82, 97, 112]
    );
    cursor += 6;
  });

  cursor += 4;
  pdf.drawText("Attention indicators", x + 12, cursor, {
    fontSize: 10,
    fontWeight: "bold",
    color: [16, 23, 32]
  });
  cursor += 16;
  weakest.forEach((indicator) => {
    cursor += renderBulletText(
      pdf,
      `${indicator.percent}% - ${indicator.text}`,
      x + 16,
      cursor,
      width - 28,
      8,
      [82, 97, 112]
    );
    cursor += 6;
  });
}

function renderPdfSectionDetailCard(pdf, section, x, top, width, height) {
  pdf.drawRect(x, top, width, height, {
    fillColor: [247, 249, 252],
    strokeColor: [210, 220, 230],
    lineWidth: 1
  });

  pdf.drawText(section.title, x + 12, top + 16, {
    fontSize: 11,
    fontWeight: "bold",
    color: [16, 23, 32]
  });
  pdf.drawText(`${section.percent}%`, x + width - 42, top + 16, {
    fontSize: 11,
    fontWeight: "bold",
    color: [41, 94, 72]
  });

  let cursor = top + 36;
  section.indicators.forEach((indicator) => {
    const labelHeight = pdf.drawWrappedText(
      `${indicator.number}. ${indicator.text}`,
      x + 12,
      cursor,
      width - 24,
      {
        fontSize: 7.2,
        lineHeight: 9,
        color: [16, 23, 32]
      }
    );
    cursor += labelHeight + 2;

    pdf.drawRect(x + 12, cursor, width - 56, 7, {
      fillColor: [230, 236, 242],
      strokeColor: [230, 236, 242]
    });
    pdf.drawRect(x + 12, cursor, (width - 56) * (indicator.percent / 100), 7, {
      fillColor: [118, 194, 158],
      strokeColor: [118, 194, 158]
    });
    pdf.drawText(`${indicator.percent}%`, x + width - 34, cursor - 1, {
      fontSize: 7.2,
      fontWeight: "bold",
      color: [216, 164, 95]
    });
    cursor += 14;
  });
}

function renderPdfInsightCard(pdf, title, items, x, top, width, height) {
  pdf.drawRect(x, top, width, height, {
    fillColor: [247, 249, 252],
    strokeColor: [210, 220, 230],
    lineWidth: 1
  });

  pdf.drawText(title, x + 12, top + 16, {
    fontSize: 11,
    fontWeight: "bold",
    color: [16, 23, 32]
  });

  let cursor = top + 34;
  items.slice(0, 5).forEach((item) => {
    pdf.drawText(item.sectionTitle, x + 12, cursor, {
      fontSize: 7.4,
      fontWeight: "bold",
      color: [41, 94, 72]
    });
    cursor += 9;
    cursor += pdf.drawWrappedText(
      `${item.percent}% observed (${item.observed} of ${item.total}) - ${item.text}`,
      x + 12,
      cursor,
      width - 24,
      {
        fontSize: 6.8,
        lineHeight: 8.2,
        color: [82, 97, 112]
      }
    );
    cursor += 5;
  });
}

function measureCommentCardHeight(pdf, comment, width) {
  const meta = buildCommentMeta(comment);
  const metaHeight = pdf.measureWrappedText(meta, width - 24, 8.5, 11);
  const noteHeight = pdf.measureWrappedText(comment.note, width - 24, 9, 12);
  return 20 + metaHeight + 8 + noteHeight + 18;
}

function renderPdfCommentCard(pdf, comment, x, top, width) {
  const meta = buildCommentMeta(comment);
  const height = measureCommentCardHeight(pdf, comment, width);

  pdf.drawRect(x, top, width, height, {
    fillColor: [247, 249, 252],
    strokeColor: [210, 220, 230],
    lineWidth: 1
  });

  let cursor = top + 14;
  cursor += pdf.drawWrappedText(meta, x + 12, cursor, width - 24, {
    fontSize: 8.5,
    lineHeight: 11,
    color: [82, 97, 112]
  });
  cursor += 8;
  pdf.drawWrappedText(comment.note, x + 12, cursor, width - 24, {
    fontSize: 9,
    lineHeight: 12,
    color: [16, 23, 32]
  });
}

function splitCommentForPdf(pdf, comment, width, maxHeight) {
  const metaHeight = pdf.measureWrappedText(buildCommentMeta(comment), width - 24, 8.5, 11);
  const availableNoteHeight = Math.max(maxHeight - (20 + metaHeight + 8 + 18), 60);
  const maxLines = Math.max(Math.floor(availableNoteHeight / 12), 3);
  const noteLines = pdf.wrapText(comment.note, width - 24, 9);

  if (noteLines.length <= maxLines) {
    return [comment];
  }

  const chunks = [];
  for (let index = 0; index < noteLines.length; index += maxLines) {
    chunks.push({
      ...comment,
      continued: index > 0,
      note: noteLines.slice(index, index + maxLines).join("\n")
    });
  }
  return chunks;
}

function buildCommentMeta(comment) {
  const baseMeta = `${comment.walkDate || "No date"} | ${comment.observer || "No observer"} | ` +
    `${comment.teacherObserved || "No teacher"} | ${comment.className || "No class"}`;
  return comment.continued ? `${baseMeta} | continued` : baseMeta;
}

function renderBulletText(pdf, text, x, top, width, fontSize, color) {
  pdf.drawText("-", x, top, {
    fontSize,
    color
  });
  return pdf.drawWrappedText(text, x + 8, top, width - 8, {
    fontSize,
    lineHeight: fontSize + 2,
    color
  });
}

function buildPercent(observed, total) {
  return total ? Math.round((observed / total) * 100) : 0;
}

class SimplePdfDocument {
  constructor({ width, height }) {
    this.width = width;
    this.height = height;
    this.pages = [];
    this.currentPage = null;
    this.measureCanvas = document.createElement("canvas");
    this.measureContext = this.measureCanvas.getContext("2d");
  }

  addPage() {
    const page = { ops: [] };
    this.pages.push(page);
    this.currentPage = page;
  }

  drawRect(x, top, width, height, options = {}) {
    const y = this.height - top - height;
    const strokeColor = options.strokeColor || [0, 0, 0];
    const fillColor = options.fillColor;
    const lineWidth = options.lineWidth || 1;

    this.currentPage.ops.push(`${lineWidth.toFixed(2)} w`);
    this.currentPage.ops.push(`${this.colorCommand(strokeColor, "RG")}`);
    if (fillColor) {
      this.currentPage.ops.push(`${this.colorCommand(fillColor, "rg")}`);
      this.currentPage.ops.push(
        `${x.toFixed(2)} ${y.toFixed(2)} ${width.toFixed(2)} ${height.toFixed(2)} re B`
      );
    } else {
      this.currentPage.ops.push(
        `${x.toFixed(2)} ${y.toFixed(2)} ${width.toFixed(2)} ${height.toFixed(2)} re S`
      );
    }
  }

  drawText(text, x, top, options = {}) {
    const fontSize = options.fontSize || 10;
    const fontWeight = options.fontWeight || "normal";
    const color = options.color || [16, 23, 32];
    const baselineY = this.height - top - fontSize;

    this.currentPage.ops.push("BT");
    this.currentPage.ops.push(`/F1 ${fontSize.toFixed(2)} Tf`);
    this.currentPage.ops.push(`${this.colorCommand(color, "rg")}`);
    if (fontWeight === "bold") {
      this.currentPage.ops.push("0.35 w 2 Tr");
    } else {
      this.currentPage.ops.push("0 Tr");
    }
    this.currentPage.ops.push(`${x.toFixed(2)} ${baselineY.toFixed(2)} Td`);
    this.currentPage.ops.push(`(${this.escapePdfText(text)}) Tj`);
    this.currentPage.ops.push("ET");
  }

  drawWrappedText(text, x, top, maxWidth, options = {}) {
    const fontSize = options.fontSize || 10;
    const lineHeight = options.lineHeight || fontSize + 2;
    const fontWeight = options.fontWeight || "normal";
    const color = options.color || [16, 23, 32];
    const lines = this.wrapText(text, maxWidth, fontSize);

    lines.forEach((line, index) => {
      this.drawText(line, x, top + index * lineHeight, {
        fontSize,
        fontWeight,
        color
      });
    });

    return lines.length * lineHeight;
  }

  measureWrappedText(text, maxWidth, fontSize, lineHeight) {
    const lines = this.wrapText(text, maxWidth, fontSize);
    return lines.length * lineHeight;
  }

  wrapText(text, maxWidth, fontSize) {
    const content = this.normalizePdfText(String(text || ""));
    const paragraphs = content.split(/\r?\n/);
    const lines = [];

    paragraphs.forEach((paragraph, paragraphIndex) => {
      const trimmed = paragraph.trim();
      if (!trimmed) {
        lines.push("");
        return;
      }

      const words = trimmed.split(/\s+/);
      let line = "";

      words.forEach((word) => {
        const candidate = line ? `${line} ${word}` : word;
        if (this.measureTextWidth(candidate, fontSize) <= maxWidth || !line) {
          line = candidate;
        } else {
          lines.push(line);
          line = word;
        }
      });

      if (line) {
        lines.push(line);
      }

      if (paragraphIndex < paragraphs.length - 1 && trimmed) {
        lines.push("");
      }
    });

    return lines.length ? lines : [""];
  }

  measureTextWidth(text, fontSize) {
    this.measureContext.font = `${fontSize}px Helvetica, Arial, sans-serif`;
    return this.measureContext.measureText(this.normalizePdfText(text)).width;
  }

  colorCommand(color, operator) {
    return `${(color[0] / 255).toFixed(3)} ${(color[1] / 255).toFixed(3)} ${(color[2] / 255).toFixed(3)} ${operator}`;
  }

  escapePdfText(text) {
    return this.normalizePdfText(String(text))
      .replaceAll("\\", "\\\\")
      .replaceAll("(", "\\(")
      .replaceAll(")", "\\)");
  }

  normalizePdfText(text) {
    return String(text)
      .normalize("NFKD")
      .replace(/[^\x00-\x7F]/g, (character) => {
        const replacements = {
          "\u2018": "'",
          "\u2019": "'",
          "\u201C": "\"",
          "\u201D": "\"",
          "\u2013": "-",
          "\u2014": "-",
          "\u2026": "..."
        };
        return replacements[character] || "";
      });
  }

  toUint8Array() {
    const objects = [];
    const addObject = (content) => {
      objects.push(content);
      return objects.length;
    };

    const fontObjectId = addObject("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>");
    const pageEntries = [];

    this.pages.forEach((page) => {
      const contentStream = page.ops.join("\n");
      const contentObjectId = addObject(
        `<< /Length ${contentStream.length} >>\nstream\n${contentStream}\nendstream`
      );
      pageEntries.push({ contentObjectId });
    });

    const pagesObjectId = objects.length + pageEntries.length + 1;

    pageEntries.forEach((entry) => {
      entry.pageObjectId = addObject(
        `<< /Type /Page /Parent ${pagesObjectId} 0 R /MediaBox [0 0 ${this.width.toFixed(2)} ${this.height.toFixed(2)}] ` +
          `/Resources << /Font << /F1 ${fontObjectId} 0 R >> >> /Contents ${entry.contentObjectId} 0 R >>`
      );
    });

    addObject(
      `<< /Type /Pages /Count ${pageEntries.length} /Kids [${pageEntries
        .map((entry) => `${entry.pageObjectId} 0 R`)
        .join(" ")}] >>`
    );
    const catalogObjectId = addObject(`<< /Type /Catalog /Pages ${pagesObjectId} 0 R >>`);

    let pdf = "%PDF-1.4\n";
    const offsets = [0];

    objects.forEach((content, index) => {
      offsets.push(pdf.length);
      pdf += `${index + 1} 0 obj\n${content}\nendobj\n`;
    });

    const xrefOffset = pdf.length;
    pdf += `xref\n0 ${objects.length + 1}\n`;
    pdf += "0000000000 65535 f \n";
    offsets.slice(1).forEach((offset) => {
      pdf += `${String(offset).padStart(10, "0")} 00000 n \n`;
    });
    pdf += `trailer\n<< /Size ${objects.length + 1} /Root ${catalogObjectId} 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;

    return new TextEncoder().encode(pdf);
  }
}
