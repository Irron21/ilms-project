import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { 
    BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Cell 
} from 'recharts';
import './KPIView.css';
import { Icons } from '../Icons'; 
import FeedbackModal from '../FeedbackModal';

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
        fetchDashboardData(); 
    }, []);

    const fetchMonths = async () => {
        try {
            const res = await axios.get('http://localhost:4000/api/kpi/months');
            setAvailableMonths(res.data);
        } catch (err) { console.error(err); }
    };

    const fetchDashboardData = async (monthFilter = '') => {
        setLoading(true);
        try {
            const url = monthFilter 
                ? `http://localhost:4000/api/kpi/dashboard?month=${monthFilter}`
                : 'http://localhost:4000/api/kpi/dashboard';
            const res = await axios.get(url);
            if (res.data) {
                setKpiScores(res.data.latestScores);
                setTrendData(res.data.trendData);
                setMonthLabel(res.data.selectedMonthLabel);
            }
            setLoading(false);
        } catch (err) { setLoading(false); }
    };
    
    const handleFilterChange = (e) => {
        const newMonth = e.target.value;
        setCurrentFilter(newMonth);
        fetchDashboardData(newMonth);
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
                    await axios.post('http://localhost:4000/api/kpi/delete', { id });
                    fetchMonths();
                    fetchDashboardData();

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

    const handleFileUpload = async (e) => {
        const file = e.target.files[0];
        if (!file) return;
        e.target.value = ''; 

        const formData = new FormData();
        formData.append('kpiReport', file);
        
        try {
            setLoading(true);
            await axios.post('http://localhost:4000/api/kpi/upload', formData);
            setLoading(false);

            setFeedbackModal({
                type: 'success',
                title: 'Upload Successful!',
                message: 'Your KPI report has been processed.',
                onClose: () => setFeedbackModal(null)
            });
            
            fetchMonths();
            fetchDashboardData(); 
        } catch (err) { 
            setLoading(false);
            const serverMsg = err.response?.data?.error || "Something went wrong.";

            setFeedbackModal({
                type: 'error',
                title: 'Upload Failed',
                message: serverMsg,
                subMessage: 'Please ensure you are uploading a valid K2MAC Excel Report.',
                onClose: () => setFeedbackModal(null)
            });
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
                        <span className="filter-label">Viewing:</span>
                        <select className="month-select" value={currentFilter} onChange={handleFilterChange}>
                            <option value="">Latest Upload</option>
                            {availableMonths.map((m, idx) => (
                                <option key={idx} value={m.value}>{m.label}</option>
                            ))}
                        </select>
                    </div>
                    <button className="manage-btn" onClick={() => setShowManageModal(true)}>⚙ Manage</button>
                    <input type="file" id="fileUpload" accept='.xlsx, .xls' style={{display:'none'}} onChange={handleFileUpload} />
                    <button className="import-btn" style ={{display: 'flex', alignItems: 'center', gap: '5px' }} onClick={() => document.getElementById('fileUpload').click()}>
                        <Icons.Upload /> Upload New Report
                    </button>
                </div>
            </div>

            {/* Scorecards */}
            <div className="scorecard-grid">
                {loading && kpiScores.length === 0 ? (
                    <div style={{gridColumn:'1 / -1', height:'90px', display:'flex', alignItems:'center', justifyContent:'center', color:'#CCC'}}>Loading Metrics...</div>
                ) : kpiScores.length > 0 ? (
                    kpiScores.map((kpi, index) => (
                        <div key={index} className={`score-card ${kpi.status}`}>
                            <div className="score-top">
                                <span className="score-title">{kpi.title}</span>
                                {kpi.status === 'good' ? <span className="icon-check">✔</span> : <span className="icon-alert">!</span>}
                            </div>
                            <div className="score-value">{kpi.score}%</div>
                            <div className="progress-bg"><div className="progress-fill" style={{width: `${kpi.score}%`}}></div></div>
                        </div>
                    ))
                ) : (
                    <div style={{gridColumn:'1 / -1', textAlign:'center', padding:'20px', color:'#999'}}>
                        {!loading && "No data found for this month."}
                    </div>
                )}
            </div>

            <div className="chart-wrapper">
                <div className="chart-header-row">
                    <div>
                        <h3>Monthly Performance Trend</h3>
                        <p>Comparing history across all uploaded reports.</p>
                    </div>
                    
                    <div className="chart-controls-group">
                        
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
                                <BarChart data={trendData} margin={{top: 10, right: 10, left: 0, bottom: 0}} onMouseLeave={handleChartMouseLeave}>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                                    <XAxis dataKey="month" tick={{fontSize: 12}} />
                                    <YAxis domain={[yAxisMin, 100]} tick={{fontSize: 12}} />
                                    <Tooltip content={<CustomTooltip />} cursor={{fill: '#F5F5F5'}} />
                                    <Legend content={renderLegend} />

                                    {metricConfig.map(m => {
                                        if (!selectedMetrics.includes(m.key)) return null;
                                        return renderBar(m.key, m.color, m.label);
                                    })}

                                </BarChart>
                            ) : (
                                <LineChart data={trendData} margin={{top: 10, right: 10, left: 10, bottom: 0}} onMouseLeave={handleChartMouseLeave}>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                                    <XAxis 
                                        dataKey="month" 
                                        tick={{fontSize: 12}} 
                                        padding={{ left: 30, right: 30 }} 
                                    />
                                    <YAxis domain={[yAxisMin, 100]} tick={{fontSize: 12}} />
                                    <Tooltip content={<CustomTooltip />} />
                                    <Legend content={renderLegend} />

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
                <div className="modal-backdrop" onClick={() => setShowModal(false)}>
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
                <div className="modal-backdrop" onClick={() => setShowManageModal(false)}>
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