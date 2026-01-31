import React, { useState, useEffect, useRef } from 'react';
import api from '../../utils/api';
import { Icons } from '../Icons'; 
import './ShipmentView.css';
import FeedbackModal from '../FeedbackModal'; 

const PHASE_ORDER = ['Arrival', 'Handover Invoice', 'Start Unload', 'Finish Unload', 'Invoice Receive', 'Departure'];

function ShipmentView({ user, token, onLogout }) {
    // --- STATE ---
    const [shipments, setShipments] = useState([]);
    const [activeTab, setActiveTab] = useState('Active'); 
    const [statusFilter, setStatusFilter] = useState('All'); 
    
    // Filters
    const [timeframe, setTimeframe] = useState('All');
    const [dateFilter, setDateFilter] = useState(''); 
    const [showArchived, setShowArchived] = useState(false); 
    
    // Pagination
    const [currentPage, setCurrentPage] = useState(1);
    const rowsPerPage = 10; 

    // UI State
    const [expandedShipmentID, setExpandedShipmentID] = useState(null);
    const [closingId, setClosingId] = useState(null);
    const [activeLogs, setActiveLogs] = useState([]);
    const [flashingIds, setFlashingIds] = useState([]); 
    const prevShipmentsRef = useRef([]); 
    
    // Modals & Data
    const [showModal, setShowModal] = useState(false);
    const [showExportModal, setShowExportModal] = useState(false);
    const [showNoDataModal, setShowNoDataModal] = useState(false);
    const [feedbackModal, setFeedbackModal] = useState(null); 
    const [dateRange, setDateRange] = useState({ start: '', end: '' });
    
    const [resources, setResources] = useState({ drivers: [], helpers: [], vehicles: [] });
    const [crewPopup, setCrewPopup] = useState({ show: false, x: 0, y: 0, crewData: [] });
    
    // Form Data
    const [formData, setFormData] = useState({ 
        shipmentID: '', destName: '', destLocation: '', 
        vehicleID: '', driverID: '', helperID: '',
        loadingDate: '', deliveryDate: '' 
    });
    
    const [routeRules, setRouteRules] = useState({}); 
    const [allVehicles, setAllVehicles] = useState([]); 
    const [filteredRoutes, setFilteredRoutes] = useState([]); 
    const [filteredVehicles, setFilteredVehicles] = useState([]); 
    const [isVehicleDisabled, setIsVehicleDisabled] = useState(true); 

    // --- DATE HELPERS ---
    const getTodayString = () => {
        const d = new Date();
        const year = d.getFullYear();
        const month = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    };

    const getDateValue = (dateStr) => {
        if (!dateStr) return '';
        const d = new Date(dateStr);
        if (isNaN(d.getTime())) return ''; 
        const year = d.getFullYear();
        const month = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    };

    const formatDateDisplay = (dateStr) => {
        if (!dateStr) return '-';
        const d = new Date(dateStr);
        return d.toLocaleDateString(); 
    };

    // --- MONTH HELPERS ---
    const getMonthValue = (dateStr) => {
        if (!dateStr) return '';
        const d = new Date(dateStr);
        if (isNaN(d.getTime())) return ''; 
        const year = d.getFullYear();
        const month = String(d.getMonth() + 1).padStart(2, '0');
        return `${year}-${month}`; 
    };

    const formatMonthDisplay = (monthStr) => {
        if (!monthStr) return '';
        const [year, month] = monthStr.split('-');
        const d = new Date(year, month - 1);
        return d.toLocaleDateString('default', { month: 'long', year: 'numeric' }); 
    };

    // --- LOAD DATA ---
    useEffect(() => {
        const today = getTodayString();
        setDateRange({ start: today, end: today }); 

        const loadData = async () => {
            try {
                const [routeRes, vehicleRes] = await Promise.all([
                    api.get('/shipments/payroll-routes'),
                    api.get('/vehicles')
                ]);
                setRouteRules(routeRes.data || {});
                setAllVehicles(vehicleRes.data || []);
            } catch (error) { console.error("Error loading data:", error); }
        };
        loadData();
    }, []);

    const handleChange = (e) => {
        const { name, value } = e.target;
        
        // --- SMART DATE LOGIC ---
        if (name === 'loadingDate') {
            setFormData(prev => ({ 
                ...prev, 
                loadingDate: value,
                // If new loading date is AFTER current delivery date, reset delivery date
                deliveryDate: (prev.deliveryDate && prev.deliveryDate < value) ? '' : prev.deliveryDate
            }));
            return; 
        }

        setFormData(prev => ({ ...prev, [name]: value }));
        
        // --- ROUTE LOGIC ---
        if (name === 'destLocation') {
             const cleanInput = value.toLowerCase().trim();
             const allRouteNames = Object.keys(routeRules); 
             if (cleanInput.length > 0) {
                 const matches = allRouteNames.filter(r => r.toLowerCase().includes(cleanInput)).slice(0, 10);
                 setFilteredRoutes(matches);
             } else setFilteredRoutes([]);
             const matchedRouteKey = allRouteNames.find(r => r.toLowerCase() === cleanInput);
             if (matchedRouteKey) {
                 const allowedTypes = routeRules[matchedRouteKey]; 
                 const validTrucks = allVehicles.filter(truck => allowedTypes.includes(truck.type));
                 setFilteredVehicles(validTrucks);
                 setIsVehicleDisabled(false); 
             } else {
                 setFilteredVehicles([]);
                 setIsVehicleDisabled(true); 
             }
        }
    };
    
    useEffect(() => {
        fetchData(true); 
        const interval = setInterval(() => {
            fetchData(false); 
            if (expandedIdRef.current) refreshLogs(expandedIdRef.current);
        }, 3000); 
        return () => clearInterval(interval);
    }, [token, showArchived]); 

    const fetchData = async (isFirstLoad = false) => {
        try {
            const config = { headers: { Authorization: `Bearer ${token}` } };
            const params = (user.role === 'Driver' || user.role === 'Helper') 
                ? { userID: user.userID } 
                : { archived: showArchived };

            const url = `/shipments?_t=${new Date().getTime()}`;
            const response = await api.get(url, { ...config, params });
            const newData = response.data;

            if (!isFirstLoad && prevShipmentsRef.current.length > 0) {
                const updates = [];
                newData.forEach(newShip => {
                    const oldShip = prevShipmentsRef.current.find(s => s.shipmentID === newShip.shipmentID);
                    if (oldShip && oldShip.currentStatus !== newShip.currentStatus) updates.push(newShip.shipmentID);
                });
                if (updates.length > 0) triggerNotification(updates);
            }
            prevShipmentsRef.current = newData;
            setShipments(newData);
        } catch (err) { if (err.response?.status === 401) onLogout(); }
    };

    const expandedIdRef = useRef(null);
    useEffect(() => { expandedIdRef.current = expandedShipmentID; }, [expandedShipmentID]);
    
    const refreshLogs = async (id) => {
        try {
            const res = await api.get(`/shipments/${id}/logs`, { headers: { Authorization: `Bearer ${token}` } });
            setActiveLogs(res.data);
        } catch (error) { console.error("Log sync error", error); }
    };

    const triggerNotification = (ids) => {
        try {
            const audio = new Audio('/notification.mp3'); 
            audio.volume = 0.5;
            audio.play().catch(() => {});
        } catch (e) {}
        setFlashingIds(prev => [...prev, ...ids]);
        setTimeout(() => { setFlashingIds(prev => prev.filter(id => !ids.includes(id))); }, 10000);
    };

    const handleOpenModal = async () => {
        try {
            const res = await api.get('/shipments/resources', { headers: { Authorization: `Bearer ${token}` } });
            setResources(res.data);
            setShowModal(true);
        } catch (err) { alert("Could not load resources."); }
    };

    const handleCreateShipment = async (e) => {
        e.preventDefault();

        // 1. ROUTE VALIDATION (Frontend Check)
        const allRouteNames = Object.keys(routeRules);
        const routeExists = allRouteNames.some(r => r.toLowerCase() === formData.destLocation.trim().toLowerCase());
        
        if (!routeExists) {
            setFeedbackModal({ 
                type: 'error', 
                title: 'Invalid Route', 
                message: 'The entered route is not in the payroll list. Please select a valid route from the suggestion list.' 
            }); 
            return;
        }

        // 2. DATE VALIDATION (Double Check)
        // Even with smart inputs, we keep this just in case
        if (formData.deliveryDate < formData.loadingDate) {
            setFeedbackModal({ 
                type: 'error', 
                title: 'Date Error', 
                message: 'Delivery Date cannot be before Loading Date.' 
            }); 
            return;
        }

        try {
            await api.post('/shipments/create', { ...formData, userID: user.userID }, { headers: { Authorization: `Bearer ${token}` } });
            setShowModal(false);
            setFormData({ shipmentID: '', destName: '', destLocation: '', vehicleID: '', driverID: '', helperID: '', loadingDate: '', deliveryDate: '' });
            fetchData(true); 
            setIsVehicleDisabled(true);
            setFeedbackModal({ type: 'success', title: 'Scheduled!', message: 'Shipment created.', onClose: () => setFeedbackModal(null) });
        } catch (err) { 
            setFeedbackModal({ type: 'error', title: 'Error', message: err.response?.data?.error || "Failed." }); 
        }
    };

    const initiateArchive = (id) => {
        setFeedbackModal({ type: 'warning', title: 'Archive?', message: `Archive Shipment #${id}?`, confirmLabel: "Yes", onConfirm: async () => {
            await api.put(`/shipments/${id}/archive`, { userID: user.userID }, { headers: { Authorization: `Bearer ${token}` } });
            fetchData(true); setFeedbackModal(null);
        }, onClose: () => setFeedbackModal(null)});
    };
    const initiateRestore = (id) => {
        setFeedbackModal({ type: 'restore', title: 'Restore?', message: `Restore Shipment #${id}?`, confirmLabel: "Restore", onConfirm: async () => {
            await api.put(`/shipments/${id}/restore`, { userID: user.userID }, { headers: { Authorization: `Bearer ${token}` } });
            fetchData(true); setFeedbackModal(null);
        }, onClose: () => setFeedbackModal(null)});
    };

    const handleExport = async () => {
        const hasData = shipments.some(s => {
            const shipDate = s.loadingDate ? s.loadingDate.substring(0, 10) : s.creationTimestamp.substring(0, 10);
            return shipDate >= dateRange.start && shipDate <= dateRange.end;
        });

        if (!hasData) { setShowNoDataModal(true); return; }

        try {
            const config = { headers: { Authorization: `Bearer ${token}` }, params: { startDate: dateRange.start, endDate: dateRange.end }, responseType: 'blob' };
            const response = await api.get('/shipments/export', config);
            const url = window.URL.createObjectURL(new Blob([response.data]));
            const link = document.createElement('a');
            link.href = url;
            link.setAttribute('download', `Shipment_Report.xlsx`);
            document.body.appendChild(link);
            link.click();
            link.parentNode.removeChild(link);
            setShowExportModal(false); 
        } catch (error) {
            setFeedbackModal({ type: 'error', title: 'Export Failed', message: "Could not download file.", onClose: () => setFeedbackModal(null) });
        }
    };

    const handleCrewClick = (e, crewString) => {
        e.stopPropagation();
        if (!crewString) return;
        const parsedCrew = crewString.split('|').map(item => {
            const [role, name] = item.split(':');
            return { role, name };
        });
        setCrewPopup({ show: true, x: e.clientX - 100, y: e.clientY + 20, crewData: parsedCrew });
    };

    useEffect(() => {
        const closePopup = () => setCrewPopup({ show: false, x: 0, y: 0, crewData: [] });
        if (crewPopup.show) window.addEventListener('click', closePopup);
        return () => window.removeEventListener('click', closePopup);
    }, [crewPopup.show]);

    const toggleRow = (id) => {
        if (expandedShipmentID === id) { setClosingId(id); setTimeout(() => { setExpandedShipmentID(null); setClosingId(null); setActiveLogs([]); }, 300); }
        else { setExpandedShipmentID(id); setClosingId(null); refreshLogs(id); }
    };

    // --- TAB FILTERING ---
    const filterByTab = (items) => {
        const today = getTodayString();
        return items.filter(s => {
            const loadDate = getDateValue(s.loadingDate);
            const delDate = getDateValue(s.deliveryDate);
            const isCompleted = s.currentStatus === 'Completed';

            switch (activeTab) {
                case 'Completed': return isCompleted;
                case 'Delayed': return !isCompleted && delDate && delDate < today;
                case 'Upcoming': return !isCompleted && loadDate > today;
                case 'Active': default: return !isCompleted && loadDate === today;
            }
        });
    };
    const tabFiltered = filterByTab(shipments);

    const getFilterOptions = () => {
        if (activeTab === 'Completed') {
            const months = tabFiltered.map(s => s.loadingDate ? getMonthValue(s.loadingDate) : null).filter(Boolean);
            const uniqueMonths = [...new Set(months)].sort().reverse();
            return uniqueMonths.map(m => ({
                value: m,
                label: formatMonthDisplay(m),
                count: tabFiltered.filter(s => s.loadingDate && getMonthValue(s.loadingDate) === m).length
            }));
        } else {
            const dates = tabFiltered.map(s => s.loadingDate ? getDateValue(s.loadingDate) : null).filter(Boolean);
            const uniqueDates = [...new Set(dates)].sort().reverse();
            return uniqueDates.map(d => ({
                value: d,
                label: formatDateDisplay(d),
                count: tabFiltered.filter(s => s.loadingDate && getDateValue(s.loadingDate) === d).length
            }));
        }
    };

    const filterOptions = getFilterOptions();

    const filterByTimeframe = (items) => {
        if (activeTab === 'Active' || timeframe === 'All') return items;
        const now = new Date(); now.setHours(0,0,0,0);
        return items.filter(s => {
            const dateStr = s.loadingDate || s.creationTimestamp;
            const d = new Date(dateStr); 
            const diffDays = Math.ceil((now - d) / (1000 * 60 * 60 * 24));
            switch(timeframe) {
                case 'Daily': return Math.abs(diffDays) <= 1;
                case 'Weekly': return Math.abs(diffDays) <= 7;
                case 'Bi-Weekly': return Math.abs(diffDays) <= 14;
                case 'Monthly': return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
                default: return true;
            }
        });
    };
    const timeframeFiltered = filterByTimeframe(tabFiltered);

    const getDisplayStatus = (dbStatus) => {
        if (dbStatus === 'Pending') return 'Arrival'; 
        if (dbStatus === 'Completed') return 'Completed';
        const idx = PHASE_ORDER.indexOf(dbStatus);
        if (idx !== -1 && idx < PHASE_ORDER.length - 1) return PHASE_ORDER[idx + 1];
        if (idx === PHASE_ORDER.length - 1) return 'Completed';
        return dbStatus; 
    };

    const finalFiltered = timeframeFiltered.filter(s => {
        const visibleStatus = getDisplayStatus(s.currentStatus);
        const matchesStatus = (activeTab !== 'Active') ? true : (statusFilter === 'All' || visibleStatus === statusFilter);
        
        let matchesDate = true;
        if (activeTab !== 'Active' && dateFilter) {
            const val = s.loadingDate ? (activeTab === 'Completed' ? getMonthValue(s.loadingDate) : getDateValue(s.loadingDate)) : '';
            matchesDate = val === dateFilter;
        }
        return matchesStatus && matchesDate;
    });

    const getDisplayColor = (dbStatus) => {
        if (dbStatus === 'Pending') return '#EB5757'; 
        const displayStatus = getDisplayStatus(dbStatus);
        if (displayStatus === 'Completed') return '#27AE60'; 
        return '#F2C94C'; 
    };

    const getTimelineNodeState = (phase, dbStatus) => {
        if (dbStatus === 'Completed') return 'completed';
        const phases = PHASE_ORDER;
        const currentIndex = phases.indexOf(dbStatus); 
        const phaseIndex = phases.indexOf(phase);
        if (dbStatus === 'Pending') { if (phase === 'Arrival') return 'active'; return 'pending'; }
        if (phaseIndex <= currentIndex) return 'completed'; 
        if (phaseIndex === currentIndex + 1) return 'active'; 
        return 'pending'; 
    };
    const getPhaseTime = (phase) => {
        const log = activeLogs.find(l => l.phaseName === phase);
        return log ? new Date(log.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : null;
    };

    const totalPages = Math.ceil(finalFiltered.length / rowsPerPage);
    const paginatedShipments = finalFiltered.slice((currentPage - 1) * rowsPerPage, currentPage * rowsPerPage);

    const getCount = (tabName) => {
        const today = getTodayString();
        return shipments.filter(s => {
            const loadDate = getDateValue(s.loadingDate);
            const delDate = getDateValue(s.deliveryDate);
            const isCompleted = s.currentStatus === 'Completed';
            
            if (tabName === 'Completed') return isCompleted;
            if (tabName === 'Delayed') return !isCompleted && delDate && delDate < today;
            if (tabName === 'Upcoming') return !isCompleted && loadDate > today;
            if (tabName === 'Active') return !isCompleted && loadDate === today;
            return false;
        }).length;
    };

    return (
        <div className="shipment-view-layout">
            <div className="shipment-fixed-header">
                <div className="tabs-container">
                    {['Active', 'Upcoming', 'Completed', 'Delayed'].map(tab => (
                        <div 
                            key={tab} 
                            className={`desktop-tab tab-type-${tab.toLowerCase()} ${activeTab === tab ? 'selected' : ''}`}
                            onClick={() => { setActiveTab(tab); setCurrentPage(1); setStatusFilter('All'); setDateFilter(''); }}
                        >
                            {tab}
                            <span className="tab-badge">{getCount(tab)}</span>
                        </div>
                    ))}
                </div>

                <div className="table-controls">
                    <div className="filters-left">
                        {activeTab === 'Active' && (
                            <div className="filter-group">
                                <label>Phase:</label>
                                <select value={statusFilter} onChange={(e) => { setStatusFilter(e.target.value); setCurrentPage(1); }} className="status-select">
                                    <option value="All">All Phases</option>
                                    <option value="Arrival">Arrival (Pending)</option>
                                    {PHASE_ORDER.slice(1).map(p => <option key={p} value={p}>{p}</option>)}
                                </select>
                            </div>
                        )}

                        {activeTab !== 'Active' && (
                            <>
                                <div className="filter-group">
                                    <label>Timeframe:</label>
                                    <select className="status-select" value={timeframe} onChange={(e) => { setTimeframe(e.target.value); setCurrentPage(1); }}>
                                        <option value="All">All Time</option>
                                        <option value="Daily">Daily</option>
                                        <option value="Weekly">Weekly</option>
                                        <option value="Monthly">Monthly</option>
                                    </select>
                                </div>
                                <div className="filter-group">
                                    <label>{activeTab === 'Completed' ? 'Month:' : 'Date:'}</label>
                                    <select 
                                        className="status-select" 
                                        value={dateFilter} 
                                        onChange={(e) => { setDateFilter(e.target.value); setCurrentPage(1); }} 
                                        style={{ minWidth: '160px' }}
                                    >
                                        <option value="">{activeTab === 'Completed' ? 'All Months' : 'All Dates'}</option>
                                        {filterOptions.map(opt => (
                                            <option key={opt.value} value={opt.value}>
                                                {opt.label} ({opt.count})
                                            </option>
                                        ))}
                                    </select>
                                </div>
                            </>
                        )}

                        <div className="filter-group">
                            <button className={`archive-toggle-btn ${showArchived ? 'active' : ''}`} onClick={() => { setShowArchived(!showArchived); setCurrentPage(1); }}>
                                {showArchived ? '← Back to Active' : 'View Archived'}
                            </button>
                        </div>
                    </div>
                    <div className="controls-right" style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                        <button className="extract-btn" onClick={() => setShowExportModal(true)}><Icons.Upload />Extract .xlsx</button>
                        <button className="new-shipment-btn" onClick={handleOpenModal}>+ New Shipment</button>
                    </div>
                </div>
            </div>

            <div className="shipment-scrollable-table">
                <table className="custom-table">
                    <thead>
                        <tr>
                            <th>ID</th><th>Status</th><th>Destination</th><th>Route</th>
                            <th>Loading</th><th>Delivery</th>
                            <th>Plate</th><th>Crew</th><th>Action</th><th></th>
                        </tr>
                    </thead>
                    <tbody>
                        {paginatedShipments.length > 0 ? paginatedShipments.map(s => {
                            const isOpen = expandedShipmentID === s.shipmentID;
                            const isClosing = closingId === s.shipmentID;
                            const displayStatus = getDisplayStatus(s.currentStatus);
                            const displayColor = getDisplayColor(s.currentStatus);
                            const isFlashing = flashingIds.includes(s.shipmentID);
                            const isDelayedRow = activeTab === 'Delayed';

                            return (
                            <React.Fragment key={s.shipmentID}>
                                <tr className={isOpen ? 'row-active' : ''}>
                                    <td>{s.shipmentID}</td>
                                    <td>
                                        <span className={`status-dot ${isFlashing ? 'flashing' : ''}`} style={{backgroundColor: isDelayedRow ? '#c0392b' : displayColor}}></span>
                                        {isDelayedRow ? <span style={{color: '#c0392b', fontWeight: 'bold'}}>Delayed</span> : displayStatus}
                                    </td>
                                    <td>{s.destName}</td>
                                    <td>{s.destLocation}</td>
                                    <td style={{fontWeight:'600', color:'#2c3e50'}}>{formatDateDisplay(s.loadingDate)}</td>
                                    <td style={{color: isDelayedRow ? '#c0392b' : '#7f8c8d', fontWeight: isDelayedRow ? '700' : '400'}}>
                                        {formatDateDisplay(s.deliveryDate)}
                                        {isDelayedRow && ' ⚠️'}
                                    </td>
                                    <td>{s.plateNo || '-'}</td>
                                    <td>
                                        <div className="crew-avatars" onClick={(e) => handleCrewClick(e, s.crewDetails)}>
                                            <div className="mini-avatar"><Icons.Profile/></div>
                                            <div className="mini-avatar"><Icons.Profile/></div>
                                        </div>
                                    </td>
                                    <td style={{textAlign: 'center'}}>
                                        {showArchived ? (
                                            <button className="icon-action-btn" onClick={(e) => { e.stopPropagation(); initiateRestore(s.shipmentID); }}><Icons.Restore /></button>
                                        ) : (
                                            <button className="icon-action-btn" onClick={(e) => { e.stopPropagation(); initiateArchive(s.shipmentID); }}><Icons.Trash /></button>
                                        )}
                                    </td>
                                    <td><button className={`expand-btn ${isOpen && !isClosing ? 'open' : ''}`} onClick={() => toggleRow(s.shipmentID)}>▼</button></td>
                                </tr>
                                {(isOpen || isClosing) && (
                                    <tr className="expanded-row-container"><td colSpan="10">
                                        <div className={`timeline-wrapper ${isClosing ? 'closing' : ''}`}>
                                            <div className="timeline-content">
                                            {PHASE_ORDER.map((phase, index) => {
                                                const state = getTimelineNodeState(phase, s.currentStatus);
                                                const realTime = getPhaseTime(phase);
                                                return (
                                                    <div key={phase} className={`timeline-step ${state}`}>
                                                        {index !== PHASE_ORDER.length - 1 && <div className="step-line"></div>}
                                                        <div className="step-dot"></div>
                                                        <div className="step-content-desc">
                                                            <div className="step-title">{phase}</div>
                                                            {realTime ? <div className="step-time">{realTime}</div> : <div className="step-status-text">{state === 'active' ? 'In Progress' : '-'}</div>}
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                            </div>
                                        </div>
                                    </td></tr>
                                )}
                            </React.Fragment>
                        )}) : (<tr><td colSpan="10" className="empty-state">No shipments found in {activeTab}.</td></tr>)}
                    </tbody>
                </table>
            </div>
            {totalPages > 1 && (
                <div className="pagination-footer">
                    <button disabled={currentPage === 1} onClick={() => setCurrentPage(prev => prev - 1)}>Prev</button>
                    {[...Array(totalPages)].map((_, i) => (
                        <button key={i} className={currentPage === i + 1 ? 'active' : ''} onClick={() => setCurrentPage(i + 1)}>{i + 1}</button>
                    ))}
                    <button disabled={currentPage === totalPages} onClick={() => setCurrentPage(prev => prev + 1)}>Next</button>
                </div>
            )}
            
            {showModal && (
                <div className="modal-overlay-desktop" onClick={() => setShowModal(false)}>
                    <div className="modal-form-card" onClick={e => e.stopPropagation()}>
                        <div className="modal-header"><h2>Create New Shipment</h2><button className="close-btn" onClick={() => setShowModal(false)}>×</button></div>
                        <form onSubmit={handleCreateShipment} className="shipment-form">
                            <div className="form-row">
                                <div className="form-group"><label>Shipment ID</label><input type="number" required value={formData.shipmentID} onChange={e => setFormData({...formData, shipmentID: e.target.value})} /></div>
                                <div className="form-group"><label>Destination Name</label><input type="text" required value={formData.destName} onChange={e => setFormData({...formData, destName: e.target.value})} /></div>
                            </div>
                            
                            {/* --- UPDATED SMART DATES --- */}
                            <div className="form-row">
                                <div className="form-group">
                                    <label>Loading Date</label>
                                    <input 
                                        type="date" 
                                        required 
                                        name="loadingDate"
                                        min={getTodayString()} // 1. Prevent Past Dates
                                        value={formData.loadingDate} 
                                        onChange={handleChange} 
                                    />
                                </div>
                                <div className="form-group">
                                    <label style={{color: !formData.loadingDate ? '#999' : '#555'}}>Delivery Date</label>
                                    <input 
                                        type="date" 
                                        required 
                                        name="deliveryDate"
                                        disabled={!formData.loadingDate} // 2. Disabled until loading chosen
                                        min={formData.loadingDate}       // 3. Min date is loading date
                                        value={formData.deliveryDate} 
                                        onChange={handleChange}
                                        style={{ 
                                            backgroundColor: !formData.loadingDate ? '#f9f9f9' : 'white',
                                            cursor: !formData.loadingDate ? 'not-allowed' : 'pointer'
                                        }}
                                    />
                                </div>
                            </div>

                            <div className="form-group" style={{ marginBottom: '15px' }}>
                                <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>Route / Cluster</label>
                                <input type="text" name="destLocation" value={formData.destLocation} onChange={handleChange} list={filteredRoutes.length > 0 ? "route-list" : ""} className="form-input" placeholder="Search..." autoComplete="off" required />
                                <datalist id="route-list">{filteredRoutes.map((r, i) => <option key={i} value={r} />)}</datalist>
                            </div>
                            <div className="form-group" style={{marginBottom: '15px'}}>
                                <label style={{fontWeight: 'bold', color: isVehicleDisabled ? '#999' : 'black'}}>Vehicle Assignment</label>
                                <select name="vehicleID" value={formData.vehicleID} onChange={handleChange} className="form-input" required disabled={isVehicleDisabled} style={{ backgroundColor: isVehicleDisabled ? '#f0f0f0' : 'white' }}>
                                    <option value="">{isVehicleDisabled ? "Select route first..." : "-- Select Vehicle --"}</option>
                                    {filteredVehicles.map(v => <option key={v.vehicleID} value={v.vehicleID}>{v.plateNo} ({v.type})</option>)}
                                </select>
                            </div>
                            <div className="form-row">
                                <div className="form-group"><label>Driver</label><select required value={formData.driverID} onChange={e => setFormData({...formData, driverID: e.target.value})}><option value="">--</option>{resources.drivers.map(d => <option key={d.userID} value={d.userID}>{d.firstName} {d.lastName}</option>)}</select></div>
                                <div className="form-group"><label>Helper</label><select required value={formData.helperID} onChange={e => setFormData({...formData, helperID: e.target.value})}><option value="">--</option>{resources.helpers.map(h => <option key={h.userID} value={h.userID} >{h.firstName} {h.lastName}</option>)}</select></div>
                            </div>
                            <button type="submit" className="submit-btn">Confirm Shipment</button>
                        </form>
                    </div>
                </div>
            )}
            
            {feedbackModal && <FeedbackModal {...feedbackModal} onClose={() => setFeedbackModal(null)} />}
            {crewPopup.show && (
                <div className="crew-popup" style={{ top: crewPopup.y, left: crewPopup.x }} onClick={(e) => e.stopPropagation()}>
                    <h4>Assigned Crew</h4>
                    {crewPopup.crewData.map((crew, idx) => (
                        <div key={idx} className="crew-popup-row">
                            <span className={`role-badge ${crew.role.toLowerCase()}`}>{crew.role}</span>
                            <span className="crew-name">{crew.name}</span>
                        </div>
                    ))}
                </div>
            )}
            {showNoDataModal && (
                <div className="modal-overlay-desktop" onClick={() => setShowNoDataModal(false)}>
                    <div className="modal-form-card small-modal" onClick={e => e.stopPropagation()} style={{textAlign: 'center', padding: '40px 30px'}}>
                        <h3 style={{margin: '0 0 10px 0'}}>No Shipments Found</h3>
                        <button className="btn-alert" onClick={() => setShowNoDataModal(false)} style={{width: '100%'}}>Okay</button>
                    </div>
                </div>
            )}
            {showExportModal && (
                <div className="modal-overlay-desktop" onClick={() => setShowExportModal(false)}>
                    <div className="modal-form-card small-modal" onClick={e => e.stopPropagation()}>
                        <div className="modal-header"><h2>Extract Data</h2><button className="close-btn" onClick={() => setShowExportModal(false)}>×</button></div>
                        <div className="export-modal-body">
                            <div className="form-row">
                                <div className="form-group"><label>Start</label><input type="date" className="date-input" value={dateRange.start} onChange={e => setDateRange({...dateRange, start: e.target.value})} /></div>
                                <div className="form-group"><label>End</label><input type="date" className="date-input" value={dateRange.end} onChange={e => setDateRange({...dateRange, end: e.target.value})} /></div>
                            </div>
                            <div className="modal-actions" style={{marginTop:'25px', display:'flex', gap:'10px'}}>
                                <button className="cancel-btn-secondary" onClick={() => setShowExportModal(false)}>Cancel</button>
                                <button className="submit-btn" onClick={handleExport} style={{flex:1}}>Download</button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

export default ShipmentView;