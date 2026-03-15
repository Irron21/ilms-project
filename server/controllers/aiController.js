const { GoogleGenAI } = require("@google/genai");
const db = require("../config/db");

const analyzeKPI = async (req, res) => {
  try {
    const { chartContext, timeframeLabel, chartImageBase64 } = req.body;

    // Full body log so we can verify exactly what the frontend is sending
    console.log("[AI Controller] Full req.body keys:", Object.keys(req.body));
    console.log(
      "[AI Controller] chartContext received:",
      JSON.stringify(chartContext, null, 2),
    );

    if (!chartContext || !chartContext.displayedData) {
      return res
        .status(400)
        .json({ message: "Missing chart context for analysis." });
    }

    const apiKey = process.env.GEMINI_API_KEY;
    console.log("Analyzing KPI... Key length is:", apiKey ? apiKey.length : 0);
    if (!apiKey) {
      return res
        .status(500)
        .json({ message: "Gemini API key is not configured." });
    }

    // -----------------------------------------------------------------------
    // 1. DETERMINE MODE — read directly from chartContext, no intermediate vars
    // -----------------------------------------------------------------------
    const isComparing =
      chartContext.compareYear && chartContext.compareYear !== "none";

    console.log(
      `[AI Controller] isComparing: ${isComparing} | primaryYear: ${chartContext.primaryYear} | compareYear: ${chartContext.compareYear}`,
    );
    console.log(
      "[AI Controller] displayedData[0] keys:",
      chartContext.displayedData[0]
        ? Object.keys(chartContext.displayedData[0])
        : "EMPTY",
    );

    // -----------------------------------------------------------------------
    // 2. TRANSFORM DATA INTO PLAIN ENGLISH
    //    In compare mode each row becomes a readable sentence with pre-computed
    //    deltas so the model cannot misattribute values to the wrong year.
    //    In single-year mode the raw JSON is preserved.
    // -----------------------------------------------------------------------
    let formattedDataForAI = "";

    if (isComparing) {
      formattedDataForAI = chartContext.displayedData
        .map((row) => {
          let rowText = `Period: ${row.month || row.name}`;

          chartContext.selectedMetrics.forEach((metric) => {
            const primaryVal = row[metric];
            const compareVal = row[`${metric}_Compare`];

            // Pre-compute the delta so the model never has to do arithmetic
            const pNum = parseFloat(primaryVal);
            const cNum = parseFloat(compareVal);
            let deltaStr = "N/A";
            if (!isNaN(pNum) && !isNaN(cNum)) {
              const delta = (pNum - cNum).toFixed(2);
              deltaStr = parseFloat(delta) >= 0 ? `+${delta}%` : `${delta}%`;
            }

            rowText += ` | ${metric} ${chartContext.primaryYear}: ${primaryVal !== undefined && primaryVal !== null ? primaryVal + "%" : "N/A"}`;
            rowText += ` | ${metric} ${chartContext.compareYear}: ${compareVal !== undefined && compareVal !== null ? compareVal + "%" : "N/A"}`;
            rowText += ` | DELTA (${chartContext.primaryYear} vs ${chartContext.compareYear}): ${deltaStr}`;
          });

          return rowText;
        })
        .join("\n");

      console.log(
        "[AI Controller] formattedDataForAI (compare mode):\n",
        formattedDataForAI,
      );
    } else {
      formattedDataForAI = JSON.stringify(chartContext.displayedData, null, 2);
    }

    // -----------------------------------------------------------------------
    // 3. BUILD THE STRICT PROMPT TEMPLATE
    // -----------------------------------------------------------------------
    const prompt = `
You are a Senior Supply Chain Analyst in the Philippines presenting an executive summary.

--- DASHBOARD CONTEXT ---
Timeframe Viewed: ${timeframeLabel}
Metrics Displayed: ${chartContext.selectedMetrics.join(", ")}
${chartContext.showTarget ? `Target KPI Score: ${chartContext.targetValue}%\n` : ""}

--- DATA TO ANALYZE ---
${formattedDataForAI}

--- STRICT INSTRUCTIONS ---
${
  isComparing
    ? `CRITICAL RULE: YEAR-OVER-YEAR (YoY) COMPARISON MODE IS ACTIVE.
1. You MUST explicitly compare ${chartContext.primaryYear} against ${chartContext.compareYear}.
2. DO NOT just list the numbers for ${chartContext.primaryYear}. You MUST state the DELTA (e.g., "Delivery improved by +3.20% compared to ${chartContext.compareYear}").
3. Provide logistical hypotheses for WHY a specific period improved or declined YoY (e.g., "The drop in August ${chartContext.primaryYear} vs ${chartContext.compareYear} suggests harsher monsoon impacts or fleet degradation").
4. NEVER use raw JSON keys (like "Delivery_Compare"). Use the actual year numbers instead (e.g., "${chartContext.compareYear}").
5. For each selected metric, identify: (a) the period with the LARGEST positive delta and explain why; (b) the period with the LARGEST negative delta and explain why.
6. Consider local Philippine logistics factors: Typhoon/Monsoon season (June–November), Metro Manila traffic and MMDA coding, holiday volume surges (Dec–Jan), and port congestion at MICT or Batangas Port.`
    : `1. Analyze the trends over the periods provided for ${chartContext.primaryYear}.
2. Focus on major dips or peaks and provide logistical reasons for them (e.g., Philippine Typhoon season from June–November, severe Metro Manila traffic, holiday volume surges in Dec–Jan).
3. Identify the single best-performing and single worst-performing period for each metric and explain why.
4. Consider local Philippine logistics factors: Typhoon/Monsoon season (June–November), Metro Manila traffic and MMDA coding, holiday volume surges (Dec–Jan), and port congestion at MICT or Batangas Port.`
}

Format the output professionally using bullet points for the logistical reasons.
CRITICAL: Do NOT use any conversational greetings (e.g., no "Good morning", "Let's look at", "Certainly!", "As you can see"). Start immediately with the analysis.
`;

    console.log(
      "[AI Controller] Sending prompt to Gemini. isComparing =",
      isComparing,
    );
    console.log("[AI Controller] Full prompt:\n", prompt);

    const ai = new GoogleGenAI({ apiKey });

    const response = await ai.models.generateContent({
      model: "gemini-2.5-pro",
      contents: prompt,
    });

    const insightText = response.text;

    // Fire-and-forget: persist the report to the database without blocking the response
    const metricsStr = Array.isArray(chartContext.selectedMetrics)
      ? chartContext.selectedMetrics.join(", ")
      : String(chartContext.selectedMetrics);

    db.query(
      "INSERT INTO kpi_ai_reports (report_text, primary_year, compare_year, metrics_analyzed, chart_image, view_mode) VALUES (?, ?, ?, ?, ?, ?)",
      [
        insightText,
        chartContext.primaryYear || "unknown",
        chartContext.compareYear || "none",
        metricsStr,
        chartImageBase64 || null,
        chartContext.viewMode || "monthly",
      ],
      (dbErr) => {
        if (dbErr) {
          console.error("[AI Controller] Failed to save report to DB:", dbErr);
        } else {
          console.log("[AI Controller] Report saved to kpi_ai_reports.");
        }
      },
    );

    res.status(200).json({ insight: insightText });
  } catch (error) {
    console.error("AI Analysis Error Details:", error);
    if (error.response) {
      console.error("AI Response Error:", error.response.data);
    }
    res.status(500).json({
      message: "Failed to generate AI insight.",
      error: error.message,
    });
  }
};

// ---------------------------------------------------------------------------
// GET REPORT HISTORY
// Returns all saved AI reports, newest first.
// ---------------------------------------------------------------------------
const getReportHistory = (req, res) => {
  const sql =
    "SELECT id, report_text, primary_year, compare_year, metrics_analyzed, chart_image, view_mode, created_at FROM kpi_ai_reports ORDER BY created_at DESC";

  db.query(sql, (err, results) => {
    if (err) {
      console.error("[AI Controller] Failed to fetch report history:", err);
      return res
        .status(500)
        .json({ message: "Failed to fetch report history." });
    }
    res.status(200).json(results);
  });
};

// ---------------------------------------------------------------------------
// GET SINGLE REPORT (full text for expand)
// ---------------------------------------------------------------------------
const getReportById = (req, res) => {
  const { id } = req.params;
  const sql = "SELECT * FROM kpi_ai_reports WHERE id = ?";

  db.query(sql, [id], (err, results) => {
    if (err) {
      console.error("[AI Controller] Failed to fetch report:", err);
      return res.status(500).json({ message: "Failed to fetch report." });
    }
    if (!results || results.length === 0) {
      return res.status(404).json({ message: "Report not found." });
    }
    res.status(200).json(results[0]);
  });
};

// ---------------------------------------------------------------------------
// DELETE AI REPORT
// ---------------------------------------------------------------------------
const deleteAIReport = (req, res) => {
  const { id } = req.params;
  const sql = "DELETE FROM kpi_ai_reports WHERE id = ?";

  db.query(sql, [id], (err, result) => {
    if (err) {
      console.error("[AI Controller] Failed to delete AI report:", err);
      return res.status(500).json({ message: "Failed to delete report." });
    }
    if (result.affectedRows === 0) {
      return res.status(404).json({ message: "Report not found." });
    }
    res.status(200).json({ message: "AI report deleted successfully." });
  });
};

module.exports = {
  analyzeKPI,
  getReportHistory,
  getReportById,
  deleteAIReport,
};
