import { useState, useEffect, useRef } from 'react';
import api from '@utils/api';
import {
  BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Cell, ReferenceLine
} from 'recharts';
import { Icons, FeedbackModal } from '@shared';
import '@styles/features/analytics.css';

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
    const [currentFilter, setCurrentFilter] = useState(''); 
    const [monthLabel, setMonthLabel] = useState('');      
    const [hoveredSelection, setHoveredSelection] = useState(null);
    const hoverTimeout = useRef(null);
    const [yAxisMin, setYAxisMin] = useState(80);
    const [chartType, setChartType] = useState('bar'); 
    const [graphYear, setGraphYear] = useState(new Date().getFullYear().toString());
    const [viewMode, setViewMode] = useState('monthly'); 
    const [showTarget, setShowTarget] = useState(false);
    const [targetValue, setTargetValue] = useState(95);

    const metricConfig = [
        { key: 'Booking', color: '#2F80ED', label: 'Booking' },
        { key: 'Truck', color: '#9B51E0', label: 'Truck' },
        { key: 'CallTime', color: '#F2C94C', label: 'Call Time' },
        { key: 'DOT', color: '#EB5757', label: 'DOT' },
        { key: 'Delivery', color: '#27AE60', label: 'Delivery' },
        { key: 'POD', color: '#F2994A', label: 'POD' },
    ];

    const [selectedMetrics, setSelectedMetrics] = useState(metricConfig.map(m => m.key));
    const [isFilterOpen, setIsFilterOpen] = useState(false); 
    const [feedbackModal, setFeedbackModal] = useState(null);

    useEffect(() => { 
        fetchMonths();
        // refreshData will run because of the other useEffect dependent on graphYear/currentFilter
    }, []);

    const fetchMonths = async () => {
        try {
            const res = await api.get('/kpi/months');
            setAvailableMonths(res.data);
        } catch (err) { console.error(err); }
    };

    const handleFilterChange = (e) => {
        const newMonth = e.target.value;
        setCurrentFilter(newMonth);
    };

    const handleDeleteReport = (id) => {
        setShowManageModal(false); 

        setFeedbackModal({
            type: 'warning',
            title: 'Delete Report?',
            message: 'Are you sure you want to permanently delete this report?',
            subMessage: "This action cannot be undone.",
            confirmLabel: 'Delete',
            onConfirm: async () => {
                try {
                    await api.post('/kpi/delete', { id });
                    
                    // 1. Refresh available months list
                    const monthsRes = await api.get('/kpi/months');
                    const updatedMonths = monthsRes.data || [];
                    setAvailableMonths(updatedMonths);

                    // 2. Determine new state
                    // If we deleted the currently selected report, we need to reset
                    // Check if currentFilter ID still exists in the new list
                    const currentStillExists = updatedMonths.some(m => m.value === currentFilter);
                    
                    if (!currentStillExists) {
                        // Reset to default (Latest)
                        setCurrentFilter('');
                        
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
                    const nextFilter = !currentStillExists ? '' : currentFilter;
                    const nextYear = !currentStillExists && updatedMonths.length > 0 
                        ? new Date(updatedMonths[0].value).getFullYear().toString() 
                        : graphYear;

                    const dashboardRes = await api.get(`/kpi/dashboard?month=${nextFilter}&year=${nextYear}`);
                    setKpiScores(dashboardRes.data.latestScores || []);
                    setTrendData(dashboardRes.data.trendData || []);
                    setMonthLabel(dashboardRes.data.selectedMonthLabel);

                    setFeedbackModal({
                        type: 'success',
                        title: 'Deleted!',
                        message: 'The report has been removed successfully.',
                        onClose: () => {
                            setFeedbackModal(null);
                            setShowManageModal(true); 
                        }
                    });
                } catch (err) {
                    console.error("Delete error:", err);
                    setFeedbackModal({
                        type: 'error',
                        title: 'Error',
                        message: 'Failed to delete report.',
                        onClose: () => {
                            setFeedbackModal(null);
                            setShowManageModal(true); 
                        }
                    });
                }
            },
            onClose: () => {
                setFeedbackModal(null);
                setShowManageModal(true); 
            }
        });
    };

    const refreshData = async () => {
        setLoading(true);
        try {
            // Pass BOTH 'month' (for cards) and 'year' (for graph)
            const dashboardRes = await api.get(`/kpi/dashboard?month=${currentFilter}&year=${graphYear}`);
            
            setKpiScores(dashboardRes.data.latestScores || []);
            setTrendData(dashboardRes.data.trendData || []);
            setMonthLabel(dashboardRes.data.selectedMonthLabel);

            const monthsRes = await api.get('/kpi/months');
            setAvailableMonths(monthsRes.data || []);
            
        } catch (err) {
            console.error("Error refreshing data:", err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        refreshData();
    }, [currentFilter, graphYear]);

    const availableYears = [...new Set(
        availableMonths.map(m => new Date(m.value).getFullYear())
    )].sort().reverse();

    // Ensure current year is always an option even if empty
    const currentYearNum = new Date().getFullYear();
    if (!availableYears.includes(currentYearNum)) {
        availableYears.unshift(currentYearNum);
    }

    const getQuarterlyData = (monthlyData) => {
        const quarters = {
            Q1: { label: 'Q1 (Jan-Mar)', count: 0, sums: {} },
            Q2: { label: 'Q2 (Apr-Jun)', count: 0, sums: {} },
            Q3: { label: 'Q3 (Jul-Sep)', count: 0, sums: {} },
            Q4: { label: 'Q4 (Oct-Dec)', count: 0, sums: {} }
        };

        // Initialize sums for metrics
        const metrics = ['Booking', 'Truck', 'CallTime', 'DOT', 'Delivery', 'POD'];
        Object.values(quarters).forEach(q => metrics.forEach(m => q.sums[m] = 0));

        monthlyData.forEach(record => {
            const date = new Date(record.fullDate);
            const month = date.getMonth(); // 0-11
            let qKey = '';

            if (month <= 2) qKey = 'Q1';
            else if (month <= 5) qKey = 'Q2';
            else if (month <= 8) qKey = 'Q3';
            else qKey = 'Q4';

            // Only count if record has data (simple check)
            quarters[qKey].count++;
            metrics.forEach(m => {
                quarters[qKey].sums[m] += parseFloat(record[m] || 0);
            });
        });

        // Calculate Averages and format for Recharts
        return Object.keys(quarters).map(qKey => {
            const q = quarters[qKey];
            const result = { month: qKey }; // Use 'month' key so XAxis works with same config
            
            metrics.forEach(m => {
                // Avoid division by zero
                const avg = q.count > 0 ? (q.sums[m] / q.count) : 0;
                result[m] = parseFloat(avg.toFixed(2));
            });
            return result;
        });
    };

    // Determine which dataset to show
    const displayData = viewMode === 'monthly' ? trendData : getQuarterlyData(trendData);

    // File Upload Handler
    const handleFileUpload = async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        // Frontend Filename Validation
        const filenameRegex = /^KPI_K2MAC_(JANUARY|FEBRUARY|MARCH|APRIL|MAY|JUNE|JULY|AUGUST|SEPTEMBER|OCTOBER|NOVEMBER|DECEMBER)_\d{4}\.xlsx$/i;
        if (!filenameRegex.test(file.name)) {
            setFeedbackModal({
                type: 'error',
                title: 'Invalid Filename',
                message: 'The filename does not match the required format.',
                subMessage: 'Expected: KPI_K2MAC_[MONTH]_[YEAR].xlsx (e.g., KPI_K2MAC_DECEMBER_2026.xlsx)',
                onClose: () => setFeedbackModal(null)
            });
            e.target.value = null; // Reset input
            return;
        }

        const formData = new FormData();
        formData.append('kpiReport', file); 

        setLoading(true);

        try {
            const res = await api.post('/kpi/upload', formData, {
                headers: {
                    'Content-Type': 'multipart/form-data',
                    Authorization: `Bearer ${sessionStorage.getItem('token')}`
                }
            });

            setFeedbackModal({
                type: 'success',
                title: 'Upload Successful',
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
                }
            });

        } catch (err) {
            console.error("Upload error:", err);
            setFeedbackModal({
                type: 'error',
                title: 'Upload Failed',
                message: err.response?.data?.error || "Could not upload file.",
                subMessage: "Please ensure you are uploading a valid K2MAC Excel Report.",
                onClose: () => setFeedbackModal(null)
            });
            setLoading(false); 
        } finally {
            e.target.value = null; 
        }
    };

    const onPointClick = (data, category) => { 
        const actualData = data.payload || data; 
        const reasons = actualData.failures.filter(f => f.category === category);
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

    const getOpacity = (index, key) => {
        if (!hoveredSelection) return 1;
        if (chartType === 'line') return hoveredSelection.key === key ? 1 : 0.1; 
        return hoveredSelection.index === index && hoveredSelection.key === key ? 1 : 0.3;
    };

    const toggleMetric = (key) => {
        if (selectedMetrics.includes(key)) {
            setSelectedMetrics(selectedMetrics.filter(k => k !== key));
        } else {
            setSelectedMetrics([...selectedMetrics, key]);
        }
    };

    const toggleAllMetrics = () => {
        if (selectedMetrics.length === metricConfig.length) {
            setSelectedMetrics([]);
        } else {
            setSelectedMetrics(metricConfig.map(m => m.key));
        }
    };

    const CustomTooltip = ({ active, payload, label }) => {
        if (active && payload && payload.length) {
            return (
                <div className="custom-tooltip">
                    <p className="tooltip-header">{label}</p>
                    {payload.map((entry, index) => (
                        <p key={index} style={{color: entry.color}} className="tooltip-item">
                            {entry.name}: <b>{entry.value}%</b>
                        </p>
                    ))}
                    <p className="tooltip-hint">(Click point to see reasons)</p>
                </div>
            );
        }
        return null;
    };

    const renderBar = (key, color, name) => (
        <Bar 
            key={key} dataKey={key} name={name} fill={color} cursor="pointer"
            onMouseEnter={(_, index) => handleMouseEnter(index, key)}
            onMouseLeave={handleMouseLeave}
            onClick={(data) => onPointClick(data, key)}
        >
            {trendData.map((entry, index) => (
                <Cell 
                    key={`cell-${index}`} fill={color} stroke="none"
                    fillOpacity={getOpacity(index, key)}
                    style={{ transition: 'fill-opacity 0.3s ease-in-out' }} 
                />
            ))}
        </Bar>
    );

    const renderLine = (key, color, name) => (
        <Line 
            key={key} type="linear" dataKey={key} name={name} stroke={color} strokeWidth={3}
            dot={{ r: 4, strokeWidth: 2, fill: 'white' }}
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
            <div style={{ display: 'flex', justifyContent: 'center', gap: '20px', marginTop: '20px' }}>
                {payload.map((entry, index) => (
                    <div key={`item-${index}`} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <span className="color-dot" style={{ backgroundColor: entry.color }}></span>
                        <span className="metric-name" style={{ fontSize: '12px', color: '#666' }}>
                            {entry.value}
                        </span>
                    </div>
                ))}
            </div>
        );
    };

    // Filter available months based on selected graphYear
    const monthsForSelectedYear = availableMonths.filter(m => 
        new Date(m.value).getFullYear().toString() === graphYear
    );

    return (
        <div className="kpi-container">
            {/* Header Section*/}
             <div className="kpi-actions-bar">
                <div style={{display:'flex', alignItems:'center', gap:'10px'}}>
                    <h3 className="header-title">Overview for {monthLabel || '...'}</h3>
                    {loading && <span className="mini-loader"></span>}
                </div>
                <div className="actions-right">
                    <div className="filter-group-bordered">
                        <div style={{display: "flex", flexDirection: "row", gap: 10, alignItems: "center"}}>
                            
                            {/* Year Selector */}
                            <div style={{display:'flex', alignItems:'center', gap:'5px'}}>
                                <span className="filter-label">Year:</span>
                                <select 
                                    className="month-select" // Reusing same class for consistent style
                                    value={graphYear} 
                                    onChange={(e) => {
                                        setGraphYear(e.target.value);
                                        setCurrentFilter(''); // Reset month selection when year changes
                                    }}
                                    style={{minWidth: '80px'}}
                                >
                                    {availableYears.map(year => (
                                        <option key={year} value={year}>{year}</option>
                                    ))}
                                </select>
                            </div>

                            {/* Month Selector (Filtered by Year) */}
                            <div style={{display:'flex', alignItems:'center', gap:'5px'}}>
                                <span className="filter-label">Timeframe:</span>
                                <select 
                                    className="month-select" 
                                    value={currentFilter} 
                                    onChange={handleFilterChange}
                                    style={{minWidth: '120px'}}
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
                                            <option key={idx} value={m.value}>{m.label}</option>
                                        ))}
                                    </optgroup>
                                </select>
                            </div>

                        </div>
                    </div>
                    <button className="manage-btn" onClick={() => setShowManageModal(true)}>⚙ Manage</button>
                    <input type="file" id="fileUpload" accept='.xlsx, .xls' style={{display:'none'}} onChange={handleFileUpload} />
                    <button className="import-btn" onClick={() => document.getElementById('fileUpload').click()}>
                        <Icons.Upload /> Upload New Report
                    </button>
                </div>
            </div>

            {/* Scorecards */}
            <div className="scorecard-grid">
                {loading && kpiScores.length === 0 ? (
                    <div style={{gridColumn:'1 / -1', height:'90px', display:'flex', alignItems:'center', justifyContent:'center', color:'#CCC'}}>Loading Metrics...</div>
                ) : kpiScores.length > 0 ? (
                    kpiScores.map((kpi, index) => {
                        const score = parseFloat(kpi.score);
                        let dynamicStatus = 'good';
                        if (score < targetValue - 3) {
                            dynamicStatus = 'danger';
                        } else if (score < targetValue) {
                            dynamicStatus = 'warning';
                        }
                        
                        return (
                            <div key={index} className={`score-card ${dynamicStatus}`}>
                                <div className="score-top">
                                    <span className="score-title">{kpi.title}</span>
                                    {dynamicStatus === 'good' ? <span className="icon-check">✔</span> : 
                                     dynamicStatus === 'warning' ? <span className="icon-alert" style={{color:'#F2994A'}}>!</span> : 
                                     <span className="icon-alert">!</span>}
                                </div>
                                <div className="score-value">{kpi.score}%</div>
                                <div className="progress-bg"><div className="progress-fill" style={{width: `${kpi.score}%`}}></div></div>
                            </div>
                        );
                    })
                ) : (
                    <div style={{gridColumn:'1 / -1', display:'flex', alignItems:'center', justifyContent:'center', height:'90px', color:'#999'}}>
                        {!loading && "No data found for this month."}
                    </div>
                )}
            </div>

            <div className="chart-wrapper">
                <div className="chart-header-row">
                    <div style={{display: 'flex', alignItems: 'center', gap: '8px'}}>
                        
                        <div className="view-switcher">
                            <button 
                                className={`switch-btn ${viewMode === 'monthly' ? 'active' : ''}`}
                                onClick={() => setViewMode('monthly')}
                            >
                                Monthly
                            </button>
                            <button 
                                className={`switch-btn ${viewMode === 'quarterly' ? 'active' : ''}`}
                                onClick={() => setViewMode('quarterly')}
                            >
                                Quarterly
                            </button>
                        </div>
                    </div>
                    
                    
                    <div className="chart-controls-group">

                        {/* TARGET TOGGLE */}
                        <div className='filter-group-bordered'>
                            <label style={{display:'flex', alignItems:'center', gap:'5px', fontSize:'13px', fontWeight:'600', cursor:'pointer', userSelect:'none', marginRight: '8px'}}>
                                <input 
                                    type="checkbox" 
                                    checked={showTarget} 
                                    onChange={e => setShowTarget(e.target.checked)} 
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
                                    width: '50px',
                                    padding: '2px 5px',
                                    fontSize: '13px',
                                    border: '1px solid #ccc',
                                    borderRadius: '4px'
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
                                    <div className="checkbox-row all-toggle" onClick={toggleAllMetrics}>
                                        <input 
                                            type="checkbox" 
                                            checked={selectedMetrics.length === metricConfig.length} 
                                            readOnly 
                                        />
                                        <span>{selectedMetrics.length === metricConfig.length ? "Unselect All" : "Select All"}</span>
                                    </div>
                                    <div className="dropdown-divider"></div>
                                    
                                    {metricConfig.map(m => (
                                        <div key={m.key} className="checkbox-row" onClick={() => toggleMetric(m.key)}>
                                            <input 
                                                type="checkbox" 
                                                checked={selectedMetrics.includes(m.key)} 
                                                readOnly 
                                            />

                                            <span className="color-dot" style={{backgroundColor: m.color}}></span>
                                            <span className="metric-name">{m.label}</span>
                                            
                                        </div>
                                    ))}

                                    <div className="dropdown-overlay" onClick={() => setIsFilterOpen(false)}></div>
                                </div>
                            )}
                        </div>

                        <div className="view-switcher">
                            <button className={`switch-btn ${chartType === 'bar' ? 'active' : ''}`} onClick={() => setChartType('bar')}>Bars</button>
                            <button className={`switch-btn ${chartType === 'line' ? 'active' : ''}`} onClick={() => setChartType('line')}>Lines</button>
                        </div>
                        <div className="chart-controls">
                            <label>Zoom Y-Axis: {yAxisMin}%</label>
                            <input type="range" min="0" max="95" step="5" value={yAxisMin} onChange={(e) => setYAxisMin(Number(e.target.value))} className="zoom-slider" />
                        </div>
                    </div>
                </div>
                
                <div className="chart-content">
                    {trendData.length > 0 ? (
                        <ResponsiveContainer width="100%" height="100%">
                            {chartType === 'bar' ? (
                                <BarChart data={displayData} margin={{top: 10, right: 10, left: 0, bottom: 0}} onMouseLeave={handleChartMouseLeave}>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                                    <XAxis dataKey="month" tick={{fontSize: 12}} />
                                    <YAxis domain={[yAxisMin, 100]} tick={{fontSize: 12}} />
                                    <Tooltip content={<CustomTooltip />} cursor={{fill: '#F5F5F5'}} />
                                    <Legend content={renderLegend} />

                                    {showTarget && (
                                        <ReferenceLine y={targetValue} label={`Target (${targetValue}%)`} stroke="#EB5757" strokeDasharray="3 3" />
                                    )}

                                    {metricConfig.map(m => {
                                        if (!selectedMetrics.includes(m.key)) return null;
                                        return renderBar(m.key, m.color, m.label);
                                    })}

                                </BarChart>
                            ) : (
                                <LineChart data={displayData} margin={{top: 10, right: 10, left: 10, bottom: 0}} onMouseLeave={handleChartMouseLeave}>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                                    <XAxis 
                                        dataKey="month" 
                                        tick={{fontSize: 12}} 
                                        padding={{ left: 30, right: 30 }} 
                                    />
                                    <YAxis domain={[yAxisMin, 100]} tick={{fontSize: 12}} />
                                    <Tooltip content={<CustomTooltip />} />
                                    <Legend content={renderLegend} />

                                    {showTarget && (
                                        <ReferenceLine y={targetValue} label={`Target (${targetValue}%)`} stroke="#EB5757" strokeDasharray="3 3" />
                                    )}

                                    {metricConfig.map(m => {
                                        if (!selectedMetrics.includes(m.key)) return null;
                                        return renderLine(m.key, m.color, m.label);
                                    })}

                                </LineChart>
                            )}
                        </ResponsiveContainer>
                    ) : (
                         <div className="empty-chart">{loading ? "Loading Chart..." : "Upload a report to see data"}</div>
                    )}
                </div>
            </div>
            
            {feedbackModal && (
                <FeedbackModal 
                    {...feedbackModal} 
                    onClose={() => {
                        if (feedbackModal.onClose) feedbackModal.onClose();
                        else setFeedbackModal(null);
                    }} 
                />
            )}

             {showModal && (
                <div className="modal-backdrop">
                    <div className="modal-card" onClick={e => e.stopPropagation()}>
                        <div className="modal-header"><h3>{selectedMetric} Failures</h3><span className="modal-subtitle">{selectedMonth}</span></div>
                        <div className="modal-body">
                            {modalReasons.length > 0 ? (
                                <ul className="reason-list">{modalReasons.map((r, idx) => <li key={idx}><span className="reason-bullet">•</span>{r.reason}</li>)}</ul>
                            ) : <div className="no-data"><p>No failure reasons recorded.</p></div>}
                        </div>
                        <div className="modal-footer"><button className="btn-close" onClick={() => setShowModal(false)}>Close</button></div>
                    </div>
                </div>
            )}
            
            {showManageModal && (
                <div className="modal-backdrop">
                    <div className="modal-card" onClick={e => e.stopPropagation()}>
                        <div className="modal-header"><h3>Manage Uploaded Reports</h3></div>
                        <div className="modal-body">
                             <ul className="manage-list">
                                {availableMonths.length > 0 ? availableMonths.map((item, index) => (
                                    <li key={item.id || index} className="manage-item">
                                        <div className="manage-info">
                                            <span className="manage-date">{item.label}</span>
                                            <span className="manage-id">ID: {item.id}</span>
                                        </div>
                                        <button className="delete-btn" onClick={() => handleDeleteReport(item.id)}>Delete</button>
                                    </li>
                                )) : <p>No reports found.</p>}
                            </ul>
                        </div>
                        <div className="modal-footer"><button className="btn-close" onClick={() => setShowManageModal(false)}>Done</button></div>
                    </div>
                </div>
            )}
        </div>
    );
}

export default KPIView;
