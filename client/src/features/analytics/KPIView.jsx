import { useState, useEffect, useRef } from "react";
import api from "@utils/api";
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  Cell,
  ReferenceLine,
} from "recharts";
import { Icons, FeedbackModal } from "@shared";
import "@styles/features/analytics.css";
import ReactMarkdown from "react-markdown";
import html2canvas from "html2canvas";
import { exportReportToPDF } from "@utils/pdfGenerator";

function KPIView() {
  const [kpiScores, setKpiScores] = useState([]);
  const [trendData, setTrendData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedMetric, setSelectedMetric] = useState(null);
  const [selectedMonth, setSelectedMonth] = useState(null);
  const [modalReasons, setModalReasons] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [showManageModal, setShowManageModal] = useState(false);
  const [availableMonths, setAvailableMonths] = useState([]);
  const [currentFilter, setCurrentFilter] = useState("");
  const [monthLabel, setMonthLabel] = useState("");
  const [hoveredSelection, setHoveredSelection] = useState(null);
  const hoverTimeout = useRef(null);
  const [yAxisMin, setYAxisMin] = useState(80);
  const [chartType, setChartType] = useState("bar");
  const [graphYear, setGraphYear] = useState(
    new Date().getFullYear().toString(),
  );
  const [viewMode, setViewMode] = useState("monthly");
  const [showTarget, setShowTarget] = useState(false);
  const [targetValue, setTargetValue] = useState(95);

  const metricConfig = [
    { key: "Booking", color: "#2F80ED", label: "Booking" },
    { key: "Truck", color: "#9B51E0", label: "Truck" },
    { key: "CallTime", color: "#F2C94C", label: "Call Time" },
    { key: "DOT", color: "#EB5757", label: "DOT" },
    { key: "Delivery", color: "#27AE60", label: "Delivery" },
    { key: "POD", color: "#F2994A", label: "POD" },
  ];

  const [selectedMetrics, setSelectedMetrics] = useState(
    metricConfig.map((m) => m.key),
  );
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [feedbackModal, setFeedbackModal] = useState(null);
  const [aiInsight, setAiInsight] = useState("");
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [showAiPanel, setShowAiPanel] = useState(false);
  const [compareYear, setCompareYear] = useState("none");
  const [compareData, setCompareData] = useState([]);
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [reportHistory, setReportHistory] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [expandedReportId, setExpandedReportId] = useState(null);
  const [isGeneratingPDF, setIsGeneratingPDF] = useState(false);
  const [exportingPdfId, setExportingPdfId] = useState(null);

  useEffect(() => {
    fetchMonths();
    // refreshData will run because of the other useEffect dependent on graphYear/currentFilter
  }, []);

  const fetchMonths = async () => {
    try {
      const res = await api.get("/kpi/months");
      setAvailableMonths(res.data);
    } catch (err) {
      console.error(err);
    }
  };

  const handleGenerateInsight = async () => {
    if (displayData.length === 0) return;
    setIsAnalyzing(true);
    setShowAiPanel(true);
    setAiInsight("");
    try {
      // ── Capture the chart as a base64 PNG snapshot BEFORE the API call.
      // This snapshot is saved alongside the report so history exports always
      // show the exact chart that was visible when the analysis was generated,
      // regardless of what year is selected when the user later exports the PDF.
      let chartImageBase64 = null;
      const chartEl = document.getElementById("kpi-main-chart");
      if (chartEl) {
        try {
          const captureCanvas = await html2canvas(chartEl, {
            scale: 2,
            useCORS: true,
            allowTaint: false,
            backgroundColor: "#ffffff",
            imageTimeout: 0,
            logging: false,
          });
          chartImageBase64 = captureCanvas.toDataURL("image/png");
        } catch (captureErr) {
          console.warn(
            "[AI Payload] Chart snapshot capture failed, proceeding without image:",
            captureErr,
          );
        }
      }

      // chartContext is the single source of truth for ALL fields including year values.
      // Do NOT add root-level primaryYear/compareYear — the backend reads from chartContext only.
      const payload = {
        chartContext: {
          displayedData: displayData, // This sends the data as the user sees it (monthly or quarterly)
          selectedMetrics: selectedMetrics, // e.g. ['Booking', 'Delivery']
          viewMode: viewMode, // 'monthly' or 'quarterly'
          showTarget: showTarget,
          targetValue: targetValue,
          primaryYear: graphYear, // MUST be included — backend isComparing check depends on this
          compareYear: compareYear, // MUST be included — "none" or e.g. "2024"
        },
        timeframeLabel: headerLabel, // "Yearly Average", "Q1 (Jan-Mar)", "August 2026", etc.
        chartImageBase64, // base64 PNG snapshot; null if capture failed
      };
      const res = await api.post("/kpi/analyze", payload, {
        headers: { Authorization: `Bearer ${sessionStorage.getItem("token")}` },
      });
      setAiInsight(res.data.insight);
    } catch (err) {
      console.error("AI Analysis Error:", err);
      setAiInsight(
        "Failed to generate insight. Please check your AI configuration or try again later.",
      );
    } finally {
      setIsAnalyzing(false);
    }
  };

  const fetchReportHistory = async () => {
    setHistoryLoading(true);
    setShowHistoryModal(true);
    setExpandedReportId(null);
    try {
      const res = await api.get("/kpi/reports/history", {
        headers: { Authorization: `Bearer ${sessionStorage.getItem("token")}` },
      });
      setReportHistory(res.data);
    } catch (err) {
      console.error("Report History Error:", err);
      setReportHistory([]);
    } finally {
      setHistoryLoading(false);
    }
  };

  const handleFilterChange = (e) => {
    const newMonth = e.target.value;
    setCurrentFilter(newMonth);
  };

  const handleDeleteReport = (id) => {
    setShowManageModal(false);

    setFeedbackModal({
      type: "warning",
      title: "Delete Report?",
      message: "Are you sure you want to permanently delete this report?",
      subMessage: "This action cannot be undone.",
      confirmLabel: "Delete",
      onConfirm: async () => {
        try {
          await api.post("/kpi/delete", { id });

          // 1. Refresh available months list
          const monthsRes = await api.get("/kpi/months");
          const updatedMonths = monthsRes.data || [];
          setAvailableMonths(updatedMonths);

          // 2. Determine new state
          // If we deleted the currently selected report, we need to reset
          // Check if currentFilter ID still exists in the new list
          const currentStillExists = updatedMonths.some(
            (m) => m.value === currentFilter,
          );

          if (!currentStillExists) {
            // Reset to default (Latest)
            setCurrentFilter("");

            // Also check if we need to switch the year
            // Find the year of the latest available report
            if (updatedMonths.length > 0) {
              const latestReportDate = new Date(updatedMonths[0].value);
              setGraphYear(latestReportDate.getFullYear().toString());
            } else {
              // Fallback to current year if no reports left
              setGraphYear(new Date().getFullYear().toString());
            }
          }

          // 3. Refresh Dashboard Data (this will use the new state or default)
          // Note: We need to pass the *new* state explicitly if we just changed it,
          // because state updates are async and won't be reflected immediately in 'currentFilter'
          const nextFilter = !currentStillExists ? "" : currentFilter;
          const nextYear =
            !currentStillExists && updatedMonths.length > 0
              ? new Date(updatedMonths[0].value).getFullYear().toString()
              : graphYear;

          const dashboardRes = await api.get(
            `/kpi/dashboard?month=${nextFilter}&year=${nextYear}`,
          );
          setKpiScores(dashboardRes.data.latestScores || []);
          setTrendData(dashboardRes.data.trendData || []);
          setMonthLabel(dashboardRes.data.selectedMonthLabel);

          setFeedbackModal({
            type: "success",
            title: "Deleted!",
            message: "The report has been removed successfully.",
            onClose: () => {
              setFeedbackModal(null);
              setShowManageModal(true);
            },
          });
        } catch (err) {
          console.error("Delete error:", err);
          setFeedbackModal({
            type: "error",
            title: "Error",
            message: "Failed to delete report.",
            onClose: () => {
              setFeedbackModal(null);
              setShowManageModal(true);
            },
          });
        }
      },
      onClose: () => {
        setFeedbackModal(null);
        setShowManageModal(true);
      },
    });
  };

  const handleDeleteAIReport = (reportId) => {
    setFeedbackModal({
      type: "warning",
      title: "Delete AI Analysis?",
      message:
        "Are you sure you want to permanently delete this AI-generated analysis?",
      subMessage: "This action cannot be undone.",
      confirmLabel: "Yes, Delete Report",
      onConfirm: async () => {
        try {
          await api.delete(`/kpi/reports/history/${reportId}`, {
            headers: {
              Authorization: `Bearer ${sessionStorage.getItem("token")}`,
            },
          });
          setReportHistory((prev) =>
            prev.filter((report) => report.id !== reportId),
          );
          setFeedbackModal({
            type: "success",
            title: "Report Deleted",
            message: "The AI analysis report has been successfully deleted.",
            onClose: () => setFeedbackModal(null),
          });
        } catch (err) {
          console.error("Failed to delete AI report:", err);
          setFeedbackModal({
            type: "error",
            title: "Deletion Failed",
            message: "Could not delete the AI report. Please try again.",
            subMessage: err.response?.data?.message || err.message,
            onClose: () => setFeedbackModal(null),
          });
        }
      },
      onClose: () => setFeedbackModal(null),
    });
  };

  const refreshData = async (filter) => {
    setLoading(true);
    try {
      // Pass BOTH 'month' (for cards) and 'year' (for graph)
      const dashboardRes = await api.get(
        `/kpi/dashboard?month=${currentFilter}&year=${graphYear}`,
      );

      setKpiScores(dashboardRes.data.latestScores || []);
      setTrendData(dashboardRes.data.trendData || []);
      setMonthLabel(dashboardRes.data.selectedMonthLabel);

      if (compareYear !== "none") {
        const compareRes = await api.get(
          `/kpi/dashboard?month=&year=${compareYear}`,
        );
        setCompareData(compareRes.data.trendData || []);
      } else {
        setCompareData([]);
      }

      const monthsRes = await api.get("/kpi/months");
      setAvailableMonths(monthsRes.data || []);
    } catch (err) {
      console.error("Error refreshing data:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refreshData();
  }, [currentFilter, graphYear, compareYear]);

  useEffect(() => {
    if (compareYear !== "none") {
      setSelectedMetrics((prev) => (prev.length > 2 ? prev.slice(0, 2) : prev));
    }
  }, [compareYear]);

  const availableYears = [
    ...new Set(availableMonths.map((m) => new Date(m.value).getFullYear())),
  ]
    .sort()
    .reverse();

  // Ensure current year is always an option even if empty
  const currentYearNum = new Date().getFullYear();
  if (!availableYears.includes(currentYearNum)) {
    availableYears.unshift(currentYearNum);
  }

  const getQuarterlyData = (monthlyData) => {
    const quarters = {
      Q1: { label: "Q1 (Jan-Mar)", count: 0, sums: {} },
      Q2: { label: "Q2 (Apr-Jun)", count: 0, sums: {} },
      Q3: { label: "Q3 (Jul-Sep)", count: 0, sums: {} },
      Q4: { label: "Q4 (Oct-Dec)", count: 0, sums: {} },
    };

    // Initialize sums for metrics
    const metrics = ["Booking", "Truck", "CallTime", "DOT", "Delivery", "POD"];
    Object.values(quarters).forEach((q) =>
      metrics.forEach((m) => (q.sums[m] = 0)),
    );

    monthlyData.forEach((record) => {
      const date = new Date(record.fullDate);
      const month = date.getMonth(); // 0-11
      let qKey = "";

      if (month <= 2) qKey = "Q1";
      else if (month <= 5) qKey = "Q2";
      else if (month <= 8) qKey = "Q3";
      else qKey = "Q4";

      // Only count if record has data (simple check)
      quarters[qKey].count++;
      metrics.forEach((m) => {
        quarters[qKey].sums[m] += parseFloat(record[m] || 0);
      });
    });

    // Calculate Averages and format for Recharts
    return Object.keys(quarters).map((qKey) => {
      const q = quarters[qKey];
      const result = { month: qKey }; // Use 'month' key so XAxis works with same config

      metrics.forEach((m) => {
        // Avoid division by zero
        const avg = q.count > 0 ? q.sums[m] / q.count : 0;
        result[m] = parseFloat(avg.toFixed(2));
      });
      return result;
    });
  };

  // Determine which dataset to show
  const displayData =
    viewMode === "monthly" ? trendData : getQuarterlyData(trendData);

  const compareDisplayData =
    viewMode === "monthly" ? compareData : getQuarterlyData(compareData);

  const getMonthKey = (row) => {
    if (!row) return null;
    if (row.fullDate) {
      const date = new Date(row.fullDate);
      return Number.isNaN(date.getTime()) ? null : `m-${date.getMonth()}`;
    }
    if (typeof row.month === "string") {
      const trimmed = row.month.trim();
      if (trimmed.startsWith("Q")) return `q-${trimmed}`;
      const monthIndexMap = {
        Jan: 0,
        Feb: 1,
        Mar: 2,
        Apr: 3,
        May: 4,
        Jun: 5,
        Jul: 6,
        Aug: 7,
        Sep: 8,
        Oct: 9,
        Nov: 10,
        Dec: 11,
      };
      const firstToken = trimmed.split(" ")[0];
      if (monthIndexMap[firstToken] !== undefined) {
        return `m-${monthIndexMap[firstToken]}`;
      }
      return trimmed;
    }
    if (typeof row.month === "number") return `m-${row.month}`;
    return row.month;
  };

  const mergedData =
    compareYear === "none"
      ? displayData
      : displayData.map((row) => {
          const rowKey = getMonthKey(row);
          const compareRow = compareDisplayData.find(
            (item) => getMonthKey(item) === rowKey,
          );
          const mergedRow = { ...row };
          metricConfig.forEach((m) => {
            mergedRow[`${m.key}_Compare`] = compareRow
              ? compareRow[m.key]
              : null;
          });
          return mergedRow;
        });

  const headerLabel =
    loading && !monthLabel ? "Loading..." : monthLabel || "Yearly Average";

  // File Upload Handler
  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    // Frontend Filename Validation
    const filenameRegex =
      /^KPI_K2MAC_(JANUARY|FEBRUARY|MARCH|APRIL|MAY|JUNE|JULY|AUGUST|SEPTEMBER|OCTOBER|NOVEMBER|DECEMBER)_\d{4}\.xlsx$/i;
    if (!filenameRegex.test(file.name)) {
      setFeedbackModal({
        type: "error",
        title: "Invalid Filename",
        message: "The filename does not match the required format.",
        subMessage:
          "Expected: KPI_K2MAC_[MONTH]_[YEAR].xlsx (e.g., KPI_K2MAC_DECEMBER_2026.xlsx)",
        onClose: () => setFeedbackModal(null),
      });
      e.target.value = null; // Reset input
      return;
    }

    const formData = new FormData();
    formData.append("kpiReport", file);

    setLoading(true);

    try {
      const res = await api.post("/kpi/upload", formData, {
        headers: {
          "Content-Type": "multipart/form-data",
          Authorization: `Bearer ${sessionStorage.getItem("token")}`,
        },
      });

      setFeedbackModal({
        type: "success",
        title: "Upload Successful",
        message: "KPI Report processed successfully.",
        onClose: () => {
          setFeedbackModal(null);

          // Auto-switch to the uploaded report
          if (res.data.year && res.data.reportMonth) {
            setGraphYear(res.data.year.toString());
            setCurrentFilter(res.data.reportMonth);
            // Refresh data will happen via useEffect when currentFilter/graphYear changes
            // But we also need to refresh the list of available months
            fetchMonths();
          } else {
            refreshData();
          }
        },
      });
    } catch (err) {
      console.error("Upload error:", err);
      setFeedbackModal({
        type: "error",
        title: "Upload Failed",
        message: err.response?.data?.error || "Could not upload file.",
        subMessage:
          "Please ensure you are uploading a valid K2MAC Excel Report.",
        onClose: () => setFeedbackModal(null),
      });
      setLoading(false);
    } finally {
      e.target.value = null;
    }
  };

  const onPointClick = (data, category) => {
    const actualData = data.payload || data;
    const reasons = actualData.failures.filter((f) => f.category === category);
    setSelectedMonth(actualData.month);
    setSelectedMetric(category);
    setModalReasons(reasons);
    setShowModal(true);
  };

  const handleMouseEnter = (index, key) => {
    if (hoverTimeout.current) clearTimeout(hoverTimeout.current);
    setHoveredSelection({ index, key });
  };

  const handleMouseLeave = () => {
    hoverTimeout.current = setTimeout(() => setHoveredSelection(null), 100);
  };

  const handleChartMouseLeave = () => {
    if (hoverTimeout.current) clearTimeout(hoverTimeout.current);
    setHoveredSelection(null);
  };

  const effectiveChartType = compareYear !== "none" ? "line" : chartType;

  const getOpacity = (index, key) => {
    if (!hoveredSelection) return 1;
    if (effectiveChartType === "line")
      return hoveredSelection.key === key ? 1 : 0.1;
    return hoveredSelection.index === index && hoveredSelection.key === key
      ? 1
      : 0.3;
  };

  const toggleMetric = (key) => {
    if (selectedMetrics.includes(key)) {
      setSelectedMetrics(selectedMetrics.filter((k) => k !== key));
    } else {
      if (compareYear !== "none" && selectedMetrics.length >= 2) {
        return;
      }
      setSelectedMetrics([...selectedMetrics, key]);
    }
  };

  const toggleAllMetrics = () => {
    if (selectedMetrics.length === metricConfig.length) {
      setSelectedMetrics([]);
    } else {
      if (compareYear !== "none") {
        setSelectedMetrics(metricConfig.map((m) => m.key).slice(0, 2));
        return;
      }
      setSelectedMetrics(metricConfig.map((m) => m.key));
    }
  };

  const CustomTooltip = ({ active, payload, label }) => {
    if (!active || !payload || !payload.length) return null;

    if (compareYear !== "none") {
      const mainEntries = payload.filter(
        (entry) => !entry.dataKey.endsWith("_Compare"),
      );

      return (
        <div className="custom-tooltip">
          <p className="tooltip-header">{label}</p>
          {mainEntries.map((entry, index) => {
            const compareEntry = payload.find(
              (item) => item.dataKey === `${entry.dataKey}_Compare`,
            );
            const currentValue = entry.value;
            const compareValue = compareEntry ? compareEntry.value : null;
            const diff =
              compareValue !== null && compareValue !== undefined
                ? parseFloat((currentValue - compareValue).toFixed(2))
                : null;

            let diffColor = "#6b7280";
            let diffPrefix = "";
            if (diff !== null) {
              if (diff > 0) {
                diffColor = "#16a34a";
                diffPrefix = "+";
              } else if (diff < 0) {
                diffColor = "#dc2626";
              }
            }

            return (
              <div
                key={index}
                style={{
                  marginBottom: index < mainEntries.length - 1 ? "10px" : 0,
                  paddingBottom: index < mainEntries.length - 1 ? "10px" : 0,
                  borderBottom:
                    index < mainEntries.length - 1
                      ? "1px solid #e5e7eb"
                      : "none",
                }}
              >
                <p
                  style={{
                    color: "#1f2937",
                    fontWeight: 700,
                    margin: "0 0 4px 0",
                    fontSize: "12px",
                    textTransform: "uppercase",
                    letterSpacing: "0.05em",
                  }}
                >
                  {entry.name}
                </p>
                <p style={{ color: "#000", margin: "2px 0", fontSize: "13px" }}>
                  {graphYear}: <b style={{ color: "#000" }}>{currentValue}%</b>
                </p>
                {compareValue !== null && compareValue !== undefined && (
                  <>
                    <p
                      style={{
                        color: "#000",
                        margin: "2px 0",
                        fontSize: "13px",
                      }}
                    >
                      {compareYear}:{" "}
                      <b style={{ color: "#000" }}>{compareValue}%</b>
                    </p>
                    <p
                      style={{
                        margin: "4px 0 0 0",
                        fontSize: "13px",
                        color: "#374151",
                      }}
                    >
                      Delta:{" "}
                      <span style={{ color: diffColor, fontWeight: 700 }}>
                        {diffPrefix}
                        {diff}%
                      </span>
                    </p>
                  </>
                )}
              </div>
            );
          })}
          <p className="tooltip-hint">(Click point to see reasons)</p>
        </div>
      );
    }

    return (
      <div className="custom-tooltip">
        <p className="tooltip-header">{label}</p>
        {payload.map((entry, index) => (
          <p key={index} style={{ color: "#000" }} className="tooltip-item">
            {entry.name}: <b>{entry.value}%</b>
          </p>
        ))}
        <p className="tooltip-hint">(Click point to see reasons)</p>
      </div>
    );
  };

  const renderBar = (key, color, name) => (
    <Bar
      key={key}
      dataKey={key}
      name={name}
      fill={color}
      cursor="pointer"
      onMouseEnter={(_, index) => handleMouseEnter(index, key)}
      onMouseLeave={handleMouseLeave}
      onClick={(data) => onPointClick(data, key)}
    >
      {trendData.map((entry, index) => (
        <Cell
          key={`cell-${index}`}
          fill={color}
          stroke="none"
          fillOpacity={getOpacity(index, key)}
          style={{ transition: "fill-opacity 0.3s ease-in-out" }}
        />
      ))}
    </Bar>
  );

  const renderLine = (key, color, name) => (
    <Line
      key={key}
      type="linear"
      dataKey={key}
      name={name}
      stroke={color}
      strokeWidth={3}
      dot={{ r: 4, strokeWidth: 2, fill: "white" }}
      activeDot={{ r: 6, strokeWidth: 0, fill: color }}
      strokeOpacity={getOpacity(null, key)}
      cursor="pointer"
      onMouseEnter={() => handleMouseEnter(null, key)}
      onMouseLeave={handleMouseLeave}
      onClick={(data) => onPointClick(data, key)}
    />
  );

  const renderLegend = (props) => {
    const { payload } = props;
    return (
      <div
        style={{
          display: "flex",
          justifyContent: "center",
          gap: "20px",
          marginTop: "20px",
        }}
      >
        {payload.map((entry, index) => (
          <div
            key={`item-${index}`}
            style={{ display: "flex", alignItems: "center", gap: "6px" }}
          >
            <span
              className="color-dot"
              style={{ backgroundColor: entry.color }}
            ></span>
            <span
              className="metric-name"
              style={{ fontSize: "12px", color: "#666" }}
            >
              {entry.value}
            </span>
          </div>
        ))}
      </div>
    );
  };

  // Filter available months based on selected graphYear
  const monthsForSelectedYear = availableMonths.filter(
    (m) => new Date(m.value).getFullYear().toString() === graphYear,
  );

  return (
    <div
      className="kpi-container"
      style={{
        marginRight: showAiPanel ? "420px" : "0",
        transition: "margin-right 0.3s ease",
      }}
    >
      <div className="kpi-actions-bar">
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <h3 className="header-title">Overview for {headerLabel}</h3>
          {loading && <span className="mini-loader"></span>}
        </div>
        <div className="actions-right">
          <div className="filter-group-bordered">
            <div
              style={{
                display: "flex",
                flexDirection: "row",
                gap: 10,
                alignItems: "center",
              }}
            >
              {/* Year Selector */}
              <div
                style={{ display: "flex", alignItems: "center", gap: "5px" }}
              >
                <span className="filter-label">Year:</span>
                <select
                  className="month-select" // Reusing same class for consistent style
                  value={graphYear}
                  onChange={(e) => {
                    setGraphYear(e.target.value);
                    setCurrentFilter(""); // Reset month selection when year changes
                  }}
                  style={{ minWidth: "80px" }}
                >
                  {availableYears.map((year) => (
                    <option key={year} value={year}>
                      {year}
                    </option>
                  ))}
                </select>
              </div>

              {/* Compare Year Selector */}
              <div
                style={{ display: "flex", alignItems: "center", gap: "5px" }}
              >
                <span className="filter-label">Compare to:</span>
                <select
                  className="month-select"
                  value={compareYear}
                  onChange={(e) => setCompareYear(e.target.value)}
                  style={{ minWidth: "80px" }}
                >
                  <option value="none">None</option>
                  {availableYears
                    .filter((year) => year.toString() !== graphYear)
                    .map((year) => (
                      <option key={year} value={year}>
                        {year}
                      </option>
                    ))}
                </select>
              </div>

              {/* Month Selector (Filtered by Year) */}
              <div
                style={{ display: "flex", alignItems: "center", gap: "5px" }}
              >
                <span className="filter-label">Timeframe:</span>
                <select
                  className="month-select"
                  value={currentFilter}
                  onChange={handleFilterChange}
                  style={{ minWidth: "120px" }}
                >
                  <option value="">Yearly Average</option>
                  <optgroup label="Quarterly Averages">
                    <option value="Q1">Q1 (Jan-Mar)</option>
                    <option value="Q2">Q2 (Apr-Jun)</option>
                    <option value="Q3">Q3 (Jul-Sep)</option>
                    <option value="Q4">Q4 (Oct-Dec)</option>
                  </optgroup>
                  <optgroup label="Monthly Reports">
                    {monthsForSelectedYear.map((m, idx) => (
                      <option key={idx} value={m.value}>
                        {m.label}
                      </option>
                    ))}
                  </optgroup>
                </select>
              </div>
            </div>
          </div>
          <button
            className="manage-btn"
            onClick={() => setShowManageModal(true)}
          >
            ⚙ Manage
          </button>
          <input
            type="file"
            id="fileUpload"
            accept=".xlsx, .xls"
            style={{ display: "none" }}
            onChange={handleFileUpload}
          />
          <button
            className="import-btn"
            onClick={() => document.getElementById("fileUpload").click()}
          >
            <Icons.Upload /> Upload New Report
          </button>
        </div>
      </div>

      {/* Scorecards */}
      <div className="scorecard-grid">
        {loading && kpiScores.length === 0 ? (
          <div
            style={{
              gridColumn: "1 / -1",
              height: "90px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "#CCC",
            }}
          >
            Loading Metrics...
          </div>
        ) : kpiScores.length > 0 ? (
          kpiScores.map((kpi, index) => {
            const score = parseFloat(kpi.score);
            let dynamicStatus = "good";
            if (score < targetValue - 3) {
              dynamicStatus = "danger";
            } else if (score < targetValue) {
              dynamicStatus = "warning";
            }

            return (
              <div key={index} className={`score-card ${dynamicStatus}`}>
                <div className="score-top">
                  <span className="score-title">{kpi.title}</span>
                  {dynamicStatus === "good" ? (
                    <span className="icon-check">✔</span>
                  ) : dynamicStatus === "warning" ? (
                    <span className="icon-alert" style={{ color: "#F2994A" }}>
                      !
                    </span>
                  ) : (
                    <span className="icon-alert">!</span>
                  )}
                </div>
                <div className="score-value">{kpi.score}%</div>
                <div className="progress-bg">
                  <div
                    className="progress-fill"
                    style={{ width: `${kpi.score}%` }}
                  ></div>
                </div>
              </div>
            );
          })
        ) : (
          <div
            style={{
              gridColumn: "1 / -1",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              height: "90px",
              color: "#999",
            }}
          >
            {!loading && "No data found for this month."}
          </div>
        )}
      </div>

      <div className="chart-wrapper">
        <div className="chart-header-row">
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <div className="view-switcher">
              <button
                className={`switch-btn ${viewMode === "monthly" ? "active" : ""}`}
                onClick={() => setViewMode("monthly")}
              >
                Monthly
              </button>
              <button
                className={`switch-btn ${viewMode === "quarterly" ? "active" : ""}`}
                onClick={() => setViewMode("quarterly")}
              >
                Quarterly
              </button>
            </div>
          </div>

          <div className="chart-controls-group">
            {/* AI Tools Group */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "8px",
                backgroundColor: "#fff7ed",
                padding: "6px 12px",
                borderRadius: "8px",
                border: "1px solid #fed7aa",
                boxShadow: "0 1px 2px 0 rgba(0, 0, 0, 0.05)",
                marginRight: "16px",
              }}
            >
              <span
                style={{
                  fontSize: "11px",
                  fontWeight: "600",
                  color: "#9a3412",
                  textTransform: "uppercase",
                  letterSpacing: "0.05em",
                }}
              >
                AI Tools
              </span>
              <button
                onClick={handleGenerateInsight}
                disabled={
                  selectedMetrics.length === 0 ||
                  !mergedData ||
                  mergedData.length === 0 ||
                  isAnalyzing
                }
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "5px",
                  backgroundColor: "#E97512",
                  color: "white",
                  border: "none",
                  padding: "6px 12px",
                  borderRadius: "6px",
                  fontSize: "12px",
                  cursor:
                    selectedMetrics.length === 0 ||
                    !mergedData ||
                    mergedData.length === 0 ||
                    isAnalyzing
                      ? "not-allowed"
                      : "pointer",
                  opacity:
                    selectedMetrics.length === 0 ||
                    !mergedData ||
                    mergedData.length === 0 ||
                    isAnalyzing
                      ? 0.5
                      : 1,
                }}
              >
                {isAnalyzing ? "Analyzing..." : "AI Insight"}
              </button>
              <button
                onClick={fetchReportHistory}
                disabled={isAnalyzing}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "5px",
                  backgroundColor: "white",
                  color: "#555",
                  border: "1px solid #ccc",
                  padding: "6px 12px",
                  borderRadius: "6px",
                  fontWeight: "bold",
                  fontSize: "12px",
                  cursor: isAnalyzing ? "not-allowed" : "pointer",
                  opacity: isAnalyzing ? 0.5 : 1,
                }}
              >
                History
              </button>
            </div>

            {/* TARGET TOGGLE */}
            <div className="filter-group-bordered">
              <label
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "5px",
                  fontSize: "13px",
                  fontWeight: "600",
                  cursor: "pointer",
                  userSelect: "none",
                  marginRight: "8px",
                }}
              >
                <input
                  type="checkbox"
                  checked={showTarget}
                  onChange={(e) => setShowTarget(e.target.checked)}
                />
                Show Target
              </label>
              <input
                type="number"
                min="0"
                max="100"
                value={targetValue}
                onChange={(e) => setTargetValue(Number(e.target.value))}
                style={{
                  width: "50px",
                  padding: "2px 5px",
                  fontSize: "13px",
                  border: "1px solid #ccc",
                  borderRadius: "4px",
                }}
              />
            </div>
            {/* Multi-Select Dropdown Component */}
            <div className="multi-select-container">
              <button
                className="multi-select-btn"
                onClick={() => setIsFilterOpen(!isFilterOpen)}
              >
                Focus Metrics ({selectedMetrics.length}) ▼
              </button>

              {isFilterOpen && (
                <div className="multi-select-dropdown">
                  <div
                    className="checkbox-row all-toggle"
                    onClick={toggleAllMetrics}
                  >
                    <input
                      type="checkbox"
                      checked={selectedMetrics.length === metricConfig.length}
                      readOnly
                    />
                    <span>
                      {selectedMetrics.length === metricConfig.length
                        ? "Unselect All"
                        : "Select All"}
                    </span>
                  </div>
                  <div className="dropdown-divider"></div>

                  {metricConfig.map((m) => {
                    const isRowDisabled =
                      compareYear !== "none" &&
                      selectedMetrics.length >= 2 &&
                      !selectedMetrics.includes(m.key);
                    return (
                      <div
                        key={m.key}
                        className="checkbox-row"
                        onClick={() => !isRowDisabled && toggleMetric(m.key)}
                        style={{
                          opacity: isRowDisabled ? 0.4 : 1,
                          cursor: isRowDisabled ? "not-allowed" : "pointer",
                          pointerEvents: isRowDisabled ? "none" : "auto",
                        }}
                      >
                        <input
                          type="checkbox"
                          checked={selectedMetrics.includes(m.key)}
                          disabled={isRowDisabled}
                          readOnly
                        />

                        <span
                          className="color-dot"
                          style={{ backgroundColor: m.color }}
                        ></span>
                        <span className="metric-name">{m.label}</span>
                      </div>
                    );
                  })}

                  <div
                    className="dropdown-overlay"
                    onClick={() => setIsFilterOpen(false)}
                  ></div>
                </div>
              )}
            </div>

            <div className="view-switcher">
              <button
                className={`switch-btn ${effectiveChartType === "bar" ? "active" : ""}`}
                onClick={() => {
                  if (compareYear === "none") setChartType("bar");
                }}
                disabled={compareYear !== "none"}
                style={{
                  opacity: compareYear !== "none" ? 0.6 : 1,
                  cursor: compareYear !== "none" ? "not-allowed" : "pointer",
                }}
              >
                Bars
              </button>
              <button
                className={`switch-btn ${effectiveChartType === "line" ? "active" : ""}`}
                onClick={() => {
                  if (compareYear === "none") setChartType("line");
                }}
                disabled={compareYear !== "none"}
                style={{
                  opacity: compareYear !== "none" ? 0.6 : 1,
                  cursor: compareYear !== "none" ? "not-allowed" : "pointer",
                }}
              >
                Lines
              </button>
            </div>
            <div className="chart-controls">
              <label>Zoom Y-Axis: {yAxisMin}%</label>
              <input
                type="range"
                min="0"
                max="95"
                step="5"
                value={yAxisMin}
                onChange={(e) => setYAxisMin(Number(e.target.value))}
                className="zoom-slider"
              />
            </div>
          </div>
        </div>

        <div className="chart-content" id="kpi-main-chart">
          {trendData.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              {effectiveChartType === "bar" ? (
                <BarChart
                  data={displayData}
                  margin={{ top: 10, right: 10, left: 0, bottom: 0 }}
                  onMouseLeave={handleChartMouseLeave}
                >
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="month" tick={{ fontSize: 12 }} />
                  <YAxis domain={[yAxisMin, 100]} tick={{ fontSize: 12 }} />
                  <Tooltip
                    content={<CustomTooltip />}
                    cursor={{ fill: "#F5F5F5" }}
                  />
                  <Legend content={renderLegend} />

                  {showTarget && (
                    <ReferenceLine
                      y={targetValue}
                      label={`Target (${targetValue}%)`}
                      stroke="#EB5757"
                      strokeDasharray="3 3"
                    />
                  )}

                  {metricConfig.map((m) => {
                    if (!selectedMetrics.includes(m.key)) return null;
                    return renderBar(m.key, m.color, m.label);
                  })}
                </BarChart>
              ) : (
                <LineChart
                  data={mergedData}
                  margin={{ top: 10, right: 10, left: 10, bottom: 0 }}
                  onMouseLeave={handleChartMouseLeave}
                >
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis
                    dataKey="month"
                    tick={{ fontSize: 12 }}
                    padding={{ left: 30, right: 30 }}
                  />
                  <YAxis domain={[yAxisMin, 100]} tick={{ fontSize: 12 }} />
                  <Tooltip content={<CustomTooltip />} />
                  <Legend content={renderLegend} />

                  {showTarget && (
                    <ReferenceLine
                      y={targetValue}
                      label={`Target (${targetValue}%)`}
                      stroke="#EB5757"
                      strokeDasharray="3 3"
                    />
                  )}

                  {metricConfig.map((m) => {
                    if (!selectedMetrics.includes(m.key)) return null;
                    return (
                      <Line
                        key={m.key}
                        type="linear"
                        dataKey={m.key}
                        name={m.label}
                        stroke={m.color}
                        strokeWidth={3}
                        dot={{ r: 4, strokeWidth: 2, fill: "white" }}
                        activeDot={{ r: 6, strokeWidth: 0, fill: m.color }}
                        strokeOpacity={getOpacity(null, m.key)}
                        cursor="pointer"
                        onMouseEnter={() => handleMouseEnter(null, m.key)}
                        onMouseLeave={handleMouseLeave}
                        onClick={(data) => onPointClick(data, m.key)}
                      />
                    );
                  })}

                  {compareYear !== "none" &&
                    metricConfig.map((m) => {
                      if (!selectedMetrics.includes(m.key)) return null;
                      return (
                        <Line
                          key={`${m.key}-compare`}
                          type="linear"
                          dataKey={`${m.key}_Compare`}
                          name={`${m.label} (${compareYear})`}
                          stroke={m.color}
                          strokeWidth={2}
                          strokeOpacity={0.4}
                          dot={{ r: 4, fill: m.color, stroke: "none" }}
                          activeDot={{ r: 6, strokeWidth: 0, fill: m.color }}
                        />
                      );
                    })}
                </LineChart>
              )}
            </ResponsiveContainer>
          ) : (
            <div className="empty-chart">
              {loading ? "Loading Chart..." : "Upload a report to see data"}
            </div>
          )}
        </div>
      </div>

      {/* AI Insight Slide-out Panel */}
      {showAiPanel && (
        <div
          className="ai-insight-panel"
          style={{
            position: "absolute",
            top: "20px",
            right: "20px",
            bottom: "20px",
            width: "380px",
            backgroundColor: "white",
            zIndex: 1000,
            display: "flex",
            flexDirection: "column",
            borderRadius: "16px",
            boxShadow: "0 10px 30px rgba(0,0,0,0.15)",
            animation: "slideInRight 0.3s ease-out",
            overflow: "hidden",
          }}
        >
          <div
            style={{
              padding: "20px",
              borderBottom: "1px solid #eee",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              backgroundColor: "#fcfcfc",
            }}
          >
            <h4
              style={{
                margin: 0,
                display: "flex",
                alignItems: "center",
                gap: "8px",
                color: "#d35400",
                fontSize: "16px",
              }}
            >
              AI Analysis
            </h4>
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              {!isAnalyzing && aiInsight && (
                <button
                  disabled={isGeneratingPDF}
                  onClick={async () => {
                    setIsGeneratingPDF(true);
                    try {
                      await exportReportToPDF({
                        chartElementId: "kpi-main-chart",
                        reportText: aiInsight,
                        timeframeLabel: headerLabel,
                        primaryYear: graphYear,
                        compareYear: compareYear,
                        metrics: selectedMetrics,
                      });
                    } finally {
                      setIsGeneratingPDF(false);
                    }
                  }}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "4px",
                    backgroundColor: isGeneratingPDF ? "#f3f4f6" : "#fff7ed",
                    color: isGeneratingPDF ? "#9ca3af" : "#d35400",
                    border: "1px solid #fed7aa",
                    padding: "4px 10px",
                    borderRadius: "6px",
                    fontSize: "11px",
                    fontWeight: 600,
                    cursor: isGeneratingPDF ? "not-allowed" : "pointer",
                    whiteSpace: "nowrap",
                  }}
                >
                  {isGeneratingPDF ? "Generating…" : "Download PDF"}
                </button>
              )}
              <button
                onClick={() => setShowAiPanel(false)}
                style={{
                  background: "none",
                  border: "none",
                  fontSize: "24px",
                  cursor: "pointer",
                  color: "#999",
                }}
              >
                ×
              </button>
            </div>
          </div>
          <div style={{ padding: "25px", overflowY: "auto", flex: 1 }}>
            {isAnalyzing ? (
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  justifyContent: "center",
                  height: "100%",
                  color: "#7f8c8d",
                  gap: "20px",
                  textAlign: "center",
                }}
              >
                <span
                  className="mini-loader"
                  style={{
                    borderColor: "#f39c12",
                    borderTopColor: "transparent",
                    width: "40px",
                    height: "40px",
                    borderWidth: "4px",
                  }}
                ></span>
                <div style={{ fontSize: "14px", lineHeight: "1.5" }}>
                  <strong>Analyzing the current chart data...</strong>
                  <br />
                  <span>
                    Please wait while we generate your executive summary.
                  </span>
                </div>
              </div>
            ) : (
              <div className="ai-markdown-body">
                <ReactMarkdown>{aiInsight}</ReactMarkdown>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ================================================================
          AI REPORT HISTORY MODAL
          ================================================================ */}
      {showHistoryModal && (
        <div
          className="modal-backdrop"
          onClick={() => setShowHistoryModal(false)}
        >
          <div
            style={{
              background: "white",
              width: "90%",
              maxWidth: "780px",
              maxHeight: "85vh",
              borderRadius: "12px",
              display: "flex",
              flexDirection: "column",
              boxShadow: "0 20px 60px rgba(0,0,0,0.25)",
              overflow: "hidden",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div
              style={{
                padding: "20px 24px",
                borderBottom: "1px solid #eee",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                flexShrink: 0,
                backgroundColor: "#fcfcfc",
              }}
            >
              <div>
                <h3
                  style={{
                    margin: 0,
                    fontSize: "18px",
                    fontWeight: 700,
                    color: "#1a202c",
                    display: "flex",
                    alignItems: "center",
                    gap: "8px",
                  }}
                >
                  AI Analysis History
                </h3>
                <p
                  style={{
                    margin: "4px 0 0 0",
                    fontSize: "12px",
                    color: "#9ca3af",
                  }}
                >
                  {historyLoading
                    ? "Loading..."
                    : `${reportHistory.length} saved report${reportHistory.length !== 1 ? "s" : ""}`}
                </p>
              </div>
              <button
                onClick={() => setShowHistoryModal(false)}
                style={{
                  background: "none",
                  border: "none",
                  fontSize: "24px",
                  cursor: "pointer",
                  color: "#9ca3af",
                  lineHeight: 1,
                }}
              >
                ×
              </button>
            </div>

            {/* Body */}
            <div style={{ overflowY: "auto", flex: 1, padding: "16px 24px" }}>
              {historyLoading ? (
                /* Loading State */
                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    justifyContent: "center",
                    padding: "60px 0",
                    gap: "16px",
                    color: "#9ca3af",
                  }}
                >
                  <span
                    className="mini-loader"
                    style={{
                      borderColor: "#f39c12",
                      borderTopColor: "transparent",
                      width: "32px",
                      height: "32px",
                      borderWidth: "3px",
                    }}
                  ></span>
                  <span style={{ fontSize: "13px" }}>
                    Loading report history...
                  </span>
                </div>
              ) : reportHistory.length === 0 ? (
                /* Empty State */
                <div
                  style={{
                    textAlign: "center",
                    padding: "60px 20px",
                    color: "#9ca3af",
                  }}
                >
                  <div style={{ fontSize: "40px", marginBottom: "12px" }}>
                    📭
                  </div>
                  <p
                    style={{
                      fontSize: "15px",
                      fontWeight: 600,
                      color: "#6b7280",
                      margin: "0 0 6px 0",
                    }}
                  >
                    No reports saved yet
                  </p>
                  <p style={{ fontSize: "13px", margin: 0 }}>
                    Click{" "}
                    <strong style={{ color: "#d35400" }}>AI Insight</strong> to
                    generate and auto-save your first analysis.
                  </p>
                </div>
              ) : (
                /* Report List */
                reportHistory.map((report) => {
                  const isExpanded = expandedReportId === report.id;
                  const isYoY =
                    report.compare_year && report.compare_year !== "none";
                  const timeframeLabel = isYoY
                    ? `${report.primary_year} vs ${report.compare_year}`
                    : String(report.primary_year);
                  const formattedDate = new Date(
                    report.created_at,
                  ).toLocaleString("en-PH", {
                    year: "numeric",
                    month: "short",
                    day: "numeric",
                    hour: "2-digit",
                    minute: "2-digit",
                  });
                  const metrics = report.metrics_analyzed
                    ? report.metrics_analyzed.split(", ")
                    : [];

                  return (
                    <div
                      key={report.id}
                      style={{
                        border: `1px solid ${isExpanded ? "#d35400" : "#e5e7eb"}`,
                        borderRadius: "10px",
                        marginBottom: "12px",
                        overflow: "hidden",
                        transition: "border-color 0.2s",
                      }}
                    >
                      {/* Report Meta Row — click anywhere to toggle */}
                      <div
                        style={{
                          padding: "14px 18px",
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "flex-start",
                          backgroundColor: isExpanded ? "#fdf6f0" : "#fafafa",
                          cursor: "pointer",
                          borderBottom: isExpanded
                            ? "1px solid #e5e7eb"
                            : "none",
                          transition: "background-color 0.2s",
                        }}
                        onClick={() =>
                          setExpandedReportId(isExpanded ? null : report.id)
                        }
                      >
                        <div style={{ flex: 1, minWidth: 0 }}>
                          {/* Mode badge + timeframe */}
                          <div
                            style={{
                              display: "flex",
                              alignItems: "center",
                              gap: "8px",
                              marginBottom: "7px",
                              flexWrap: "wrap",
                            }}
                          >
                            <span
                              style={{
                                backgroundColor: isYoY ? "#e3f2fd" : "#f0fdf4",
                                color: isYoY ? "#1565c0" : "#15803d",
                                padding: "2px 8px",
                                borderRadius: "12px",
                                fontSize: "11px",
                                fontWeight: 700,
                                border: `1px solid ${isYoY ? "#bbdefb" : "#bbf7d0"}`,
                                flexShrink: 0,
                              }}
                            >
                              {isYoY ? "YoY Comparison" : "Single Year"}
                            </span>
                            <span
                              style={{
                                backgroundColor: "#f3f4f6",
                                color: "#4b5563",
                                padding: "2px 8px",
                                borderRadius: "12px",
                                fontSize: "11px",
                                fontWeight: 700,
                                border: "1px solid #e5e7eb",
                                flexShrink: 0,
                                textTransform: "capitalize",
                              }}
                            >
                              {report.view_mode || "monthly"}
                            </span>
                            <span
                              style={{
                                fontWeight: 700,
                                fontSize: "15px",
                                color: "rgb(26, 32, 44)",
                              }}
                            >
                              {timeframeLabel}
                            </span>
                          </div>

                          {/* Metric chips */}
                          <div
                            style={{
                              display: "flex",
                              flexWrap: "wrap",
                              gap: "4px",
                              marginBottom: "7px",
                            }}
                          >
                            {metrics.map((m) => (
                              <span
                                key={m}
                                style={{
                                  backgroundColor: "#f3f4f6",
                                  color: "#374151",
                                  padding: "2px 8px",
                                  borderRadius: "10px",
                                  fontSize: "11px",
                                  fontWeight: 600,
                                  border: "1px solid #e5e7eb",
                                }}
                              >
                                {m.trim()}
                              </span>
                            ))}
                          </div>

                          {/* Timestamp */}
                          <span style={{ fontSize: "11px", color: "#9ca3af" }}>
                            {formattedDate}
                          </span>
                        </div>

                        {/* Action buttons */}
                        <div
                          style={{
                            display: "flex",
                            flexDirection: "column",
                            gap: "6px",
                            flexShrink: 0,
                            marginLeft: "14px",
                          }}
                        >
                          {/* Expand / Collapse */}
                          <button
                            style={{
                              backgroundColor: isExpanded ? "#d35400" : "white",
                              color: isExpanded ? "white" : "#d35400",
                              border: "1px solid #d35400",
                              padding: "5px 12px",
                              borderRadius: "6px",
                              fontSize: "12px",
                              fontWeight: 600,
                              cursor: "pointer",
                              transition: "background-color 0.2s, color 0.2s",
                              whiteSpace: "nowrap",
                              width: "128px",
                              textAlign: "center",
                            }}
                            onClick={(e) => {
                              e.stopPropagation();
                              setExpandedReportId(
                                isExpanded ? null : report.id,
                              );
                            }}
                          >
                            {isExpanded ? "▲ Collapse" : "▼ Read Report"}
                          </button>

                          {/* Export PDF */}
                          <button
                            disabled={exportingPdfId === report.id}
                            style={{
                              backgroundColor:
                                exportingPdfId === report.id
                                  ? "#f3f4f6"
                                  : "#fff7ed",
                              color:
                                exportingPdfId === report.id
                                  ? "#9ca3af"
                                  : "#d35400",
                              border: "1px solid #fed7aa",
                              padding: "5px 12px",
                              borderRadius: "6px",
                              fontSize: "12px",
                              fontWeight: 600,
                              cursor:
                                exportingPdfId === report.id
                                  ? "not-allowed"
                                  : "pointer",
                              whiteSpace: "nowrap",
                              width: "128px",
                              textAlign: "center",
                            }}
                            onClick={async (e) => {
                              e.stopPropagation();
                              setExportingPdfId(report.id);
                              try {
                                await exportReportToPDF({
                                  chartElementId: "kpi-main-chart",
                                  reportText: report.report_text,
                                  timeframeLabel: isYoY
                                    ? `${report.primary_year} vs ${report.compare_year}`
                                    : String(report.primary_year),
                                  primaryYear: report.primary_year,
                                  compareYear: report.compare_year,
                                  metrics: report.metrics_analyzed
                                    ? report.metrics_analyzed.split(", ")
                                    : [],
                                  // Use the saved snapshot so the PDF always shows the chart
                                  // from when this report was generated, not the live DOM state.
                                  savedBase64Image: report.chart_image || null,
                                });
                              } finally {
                                setExportingPdfId(null);
                              }
                            }}
                          >
                            {exportingPdfId === report.id
                              ? "Generating…"
                              : "Export PDF"}
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDeleteAIReport(report.id);
                            }}
                            title="Delete Report"
                            style={{
                              width: "128px",
                              padding: "5px 12px",
                              fontSize: "12px",
                              fontWeight: "600",
                              textAlign: "center",
                              color: "#dc2626",
                              backgroundColor: "#fee2e2",
                              border: "1px solid #fecaca",
                              borderRadius: "6px",
                              cursor: "pointer",
                              transition: "background-color 0.2s, color 0.2s",
                            }}
                          >
                            Delete
                          </button>
                        </div>
                      </div>

                      {/* Expanded Content */}
                      {isExpanded && (
                        <div
                          style={{
                            padding: "22px 24px",
                            backgroundColor: "white",
                            borderTop: "1px solid #f0f0f0",
                          }}
                        >
                          <div className="ai-markdown-body">
                            <ReactMarkdown>{report.report_text}</ReactMarkdown>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      )}

      {showModal && (
        <div className="modal-backdrop">
          <div className="modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>{selectedMetric} Failures</h3>
              <span className="modal-subtitle">{selectedMonth}</span>
            </div>
            <div className="modal-body">
              {modalReasons.length > 0 ? (
                <ul className="reason-list">
                  {modalReasons.map((r, idx) => (
                    <li key={idx}>
                      <span className="reason-bullet">•</span>
                      {r.reason}
                    </li>
                  ))}
                </ul>
              ) : (
                <div className="no-data">
                  <p>No failure reasons recorded.</p>
                </div>
              )}
            </div>
            <div className="modal-footer">
              <button className="btn-close" onClick={() => setShowModal(false)}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {showManageModal && (
        <div className="modal-backdrop">
          <div className="modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Manage Uploaded Reports</h3>
            </div>
            <div className="modal-body">
              <ul className="manage-list">
                {availableMonths.length > 0 ? (
                  availableMonths.map((item, index) => (
                    <li key={item.id || index} className="manage-item">
                      <div className="manage-info">
                        <span className="manage-date">{item.label}</span>
                        <span className="manage-id">ID: {item.id}</span>
                      </div>
                      <button
                        className="delete-btn"
                        onClick={() => handleDeleteReport(item.id)}
                      >
                        Delete
                      </button>
                    </li>
                  ))
                ) : (
                  <p>No reports found.</p>
                )}
              </ul>
            </div>
            <div className="modal-footer">
              <button
                className="btn-close"
                onClick={() => setShowManageModal(false)}
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}
      {feedbackModal && (
        <FeedbackModal
          {...feedbackModal}
          onClose={() => {
            if (feedbackModal.onClose) feedbackModal.onClose();
            else setFeedbackModal(null);
          }}
        />
      )}
    </div>
  );
}

export default KPIView;
