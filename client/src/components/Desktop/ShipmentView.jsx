import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { Icons } from '../Icons'; 
import './ShipmentView.css';

const PHASE_ORDER = ['Arrival', 'Handover Invoice', 'Start Unload', 'Finish Unload', 'Invoice Receive', 'Departure'];

function ShipmentView({ user, token, onLogout }) {
    
    // --- STATE ---
    const [shipments, setShipments] = useState([]);
    const [statusFilter, setStatusFilter] = useState('All'); 
    const [dateFilter, setDateFilter] = useState(''); 
    const [expandedShipmentID, setExpandedShipmentID] = useState(null);
    const [closingId, setClosingId] = useState(null);
    const [activeLogs, setActiveLogs] = useState([]);
    const [flashingIds, setFlashingIds] = useState([]); 
    const prevShipmentsRef = useRef([]); 
    const [showModal, setShowModal] = useState(false);
    const [showExportModal, setShowExportModal] = useState(false);
    const [dateRange, setDateRange] = useState({
        start: new Date().toISOString().split('T')[0],
        end: new Date().toISOString().split('T')[0]
    });

    const [resources, setResources] = useState({ drivers: [], helpers: [], vehicles: [] });
    const [crewPopup, setCrewPopup] = useState({ show: false, x: 0, y: 0, crewData: [] });
    const [formData, setFormData] = useState({ shipmentID: '', destName: '', destLocation: '', vehicleID: '', driverID: '', helperID: '' });

    const expandedIdRef = useRef(null);
    useEffect(() => { expandedIdRef.current = expandedShipmentID; }, [expandedShipmentID]);
    
    // --- EFFECTS ---
    useEffect(() => {
        fetchData(true); 
        const interval = setInterval(() => {
            fetchData(false); 
            if (expandedIdRef.current) refreshLogs(expandedIdRef.current);
        }, 3000); 
        return () => clearInterval(interval);
    }, [token]); 

    const fetchData = async (isFirstLoad = false) => {
        try {
            const config = { headers: { Authorization: `Bearer ${token}` } };
            let params = {};
            if (user.role === 'Driver' || user.role === 'Helper') params = { userID: user.userID };
            
            const url = `http://localhost:4000/api/shipments?_t=${new Date().getTime()}`;
            const response = await axios.get(url, { ...config, params });
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

    const refreshLogs = async (id) => {
        try {
            const config = { headers: { Authorization: `Bearer ${token}` } };
            const url = `http://localhost:4000/api/shipments/${id}/logs?_t=${new Date().getTime()}`;
            const res = await axios.get(url, config);
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

    // --- HANDLERS ---
    const handleOpenModal = async () => {
        try {
            const config = { headers: { Authorization: `Bearer ${token}` } };
            const res = await axios.get('http://localhost:4000/api/shipments/resources', config);
            setResources(res.data);
            setShowModal(true);
        } catch (err) { alert("Could not load resources."); }
    };

    const handleCreateShipment = async (e) => {
        e.preventDefault();
        try {
            const config = { headers: { Authorization: `Bearer ${token}` } };
            await axios.post('http://localhost:4000/api/shipments/create', { ...formData, operationsUserID: user.userID }, config);
            alert("Shipment Created!");
            setShowModal(false);
            setFormData({ shipmentID: '', destName: '', destLocation: '', vehicleID: '', driverID: '', helperID: '' });
            fetchData(true); 
        } catch (err) { alert(err.response?.data?.error || "Failed."); }
    };

    // Export Handler
    const handleExport = async () => {
        try {
            const config = {
                headers: { Authorization: `Bearer ${token}` },
                params: { startDate: dateRange.start, endDate: dateRange.end },
                responseType: 'blob' // Important for file download
            };
            const response = await axios.get('http://localhost:4000/api/shipments/export', config);

            // Create download link
            const url = window.URL.createObjectURL(new Blob([response.data]));
            const link = document.createElement('a');
            link.href = url;
            link.setAttribute('download', `Shipment_Report_${dateRange.start}_to_${dateRange.end}.xlsx`);
            document.body.appendChild(link);
            link.click();
            
            // Cleanup
            link.parentNode.removeChild(link);
            setShowExportModal(false);

        } catch (error) {
            console.error("Export failed:", error);
            alert("Failed to export data. Please check if there are records in the selected range.");
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

    const toggleRow = async (id) => {
        const isCurrentlyOpen = expandedShipmentID === id;
        if (isCurrentlyOpen) {
            setClosingId(id); 
            setTimeout(() => { setExpandedShipmentID(null); setClosingId(null); setActiveLogs([]); }, 300); 
        } else {
            setExpandedShipmentID(id); setClosingId(null);
            refreshLogs(id); 
        }
    };

    const getDisplayStatus = (dbStatus) => {
        if (dbStatus === 'Pending') return 'Arrival'; 
        if (dbStatus === 'Completed') return 'Completed';
        const idx = PHASE_ORDER.indexOf(dbStatus);
        if (idx !== -1 && idx < PHASE_ORDER.length - 1) return PHASE_ORDER[idx + 1];
        if (idx === PHASE_ORDER.length - 1) return 'Completed';
        return dbStatus; 
    };

    const getDisplayColor = (dbStatus) => {
        if (dbStatus === 'Pending') return '#EB5757'; 
        const displayStatus = getDisplayStatus(dbStatus);
        if (displayStatus === 'Completed') return '#27AE60'; 
        return '#F2C94C'; 
    };

    const getPhaseTime = (phase) => {
        const log = activeLogs.find(l => l.phaseName === phase);
        return log ? new Date(log.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : null;
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

    const filteredShipments = shipments.filter(s => {
        const visibleStatus = getDisplayStatus(s.currentStatus);
        const matchesStatus = statusFilter === 'All' || visibleStatus === statusFilter;
        let matchesDate = true;
        if (dateFilter) {
            const d = new Date(s.creationTimestamp);
            matchesDate = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}` === dateFilter;
        }
        return matchesStatus && matchesDate;
    });

    return (
        <div className="shipment-view-layout">
            
            {/* Merged Button & Filters */}
            <div className="shipment-fixed-header">
                
                <div className="table-controls">
                    {/* Left: Filters */}
                    <div className="filters-left">
                        <div className="filter-group">
                            <label>Status:</label>
                            <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="status-select">
                                <option value="All">All Statuses</option>
                                <option value="Arrival">Arrival (Pending)</option>
                                {PHASE_ORDER.slice(1).map(p => <option key={p} value={p}>{p}</option>)}
                                <option value="Completed">Completed</option>
                            </select>
                        </div>
                        <div className="filter-group">
                            <label>Date:</label>
                            <input type="date" className="date-input" value={dateFilter} onChange={(e) => setDateFilter(e.target.value)} />
                            <div className="count-badge">{filteredShipments.length} Result{filteredShipments.length !== 1 ? 's' : ''}</div>
                        </div>
                    </div>

                    {/* Right: Buttons */}
                    <div className="controls-right" style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <button className="extract-btn" onClick={() => setShowExportModal(true)}>
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                                <polyline points="7 10 12 15 17 10"></polyline>
                                <line x1="12" y1="15" x2="12" y2="3"></line>
                            </svg>
                            Extract to .xlsx
                        </button>

                        <button className="new-shipment-btn" onClick={handleOpenModal}>+ New Shipment</button>
                    </div>
                </div>

            </div>

            {/* SCROLLABLE TABLE*/}
            <div className="shipment-scrollable-table">
                <table className="custom-table">
                    <thead>
                        <tr>
                            <th>Shipment ID</th>
                            <th>Status</th>
                            <th>Destination Name</th>
                            <th>Destination Location</th>
                            <th>Plate No.</th>
                            <th>Assigned Crew</th>
                            <th></th>
                        </tr>
                    </thead>
                    <tbody>
                        {filteredShipments.length > 0 ? filteredShipments.map(s => {
                            const isOpen = expandedShipmentID === s.shipmentID;
                            const isClosing = closingId === s.shipmentID;
                            const displayStatus = getDisplayStatus(s.currentStatus);
                            const displayColor = getDisplayColor(s.currentStatus);
                            const isFlashing = flashingIds.includes(s.shipmentID);

                            return (
                            <React.Fragment key={s.shipmentID}>
                                <tr className={isOpen ? 'row-active' : ''}>
                                    <td>{s.shipmentID}</td>
                                    <td>
                                        <span className={`status-dot ${isFlashing ? 'flashing' : ''}`} style={{backgroundColor: displayColor}}></span>
                                        {displayStatus}
                                    </td>
                                    <td>{s.destName || s.clientName}</td>
                                    <td>{s.destLocation}</td>
                                    <td>{s.plateNo || '-'}</td>
                                    <td>
                                        <div className="crew-avatars" onClick={(e) => handleCrewClick(e, s.crewDetails)}>
                                            <div className="mini-avatar"><Icons.Profile/></div>
                                            <div className="mini-avatar"><Icons.Profile/></div>
                                        </div>
                                    </td>
                                    <td><button className={`expand-btn ${isOpen && !isClosing ? 'open' : ''}`} onClick={() => toggleRow(s.shipmentID)}>▼</button></td>
                                </tr>
                                {(isOpen || isClosing) && (
                                    <tr className="expanded-row-container"><td colSpan="7">
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
                        )}) : (<tr><td colSpan="7" className="empty-state">No shipments found.</td></tr>)}
                    </tbody>
                </table>
            </div>

            {/* Modals & Popups */}
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
            
            {showModal && (
                <div className="modal-overlay-desktop" onClick={() => setShowModal(false)}>
                    <div className="modal-form-card" onClick={e => e.stopPropagation()}>
                        <div className="modal-header"><h2>Create New Shipment</h2><button className="close-btn" onClick={() => setShowModal(false)}>×</button></div>
                        <form onSubmit={handleCreateShipment} className="shipment-form">
                            <div className="form-row">
                                <div className="form-group"><label>Shipment ID</label><input type="number" required value={formData.shipmentID} onChange={e => setFormData({...formData, shipmentID: e.target.value})} /></div>
                                <div className="form-group"><label>Destination Name</label><input type="text" required value={formData.destName} onChange={e => setFormData({...formData, destName: e.target.value})} /></div>
                            </div>
                            <div className="form-group"><label>Destination Location</label><input type="text" required value={formData.destLocation} onChange={e => setFormData({...formData, destLocation: e.target.value})} /></div>
                            <div className="form-group"><label>Assign Vehicle</label><select required value={formData.vehicleID} onChange={e => setFormData({...formData, vehicleID: e.target.value})}><option value="">-- Select Truck --</option>{resources.vehicles.map(v => <option key={v.vehicleID} value={v.vehicleID}>{v.plateNo} ({v.type})</option>)}</select></div>
                            <div className="form-row">
                                <div className="form-group"><label>Driver</label><select required value={formData.driverID} onChange={e => setFormData({...formData, driverID: e.target.value})}><option value="">-- Select Driver --</option>{resources.drivers.map(d => <option key={d.userID} value={d.userID}>{d.firstName} {d.lastName}</option>)}</select></div>
                                <div className="form-group"><label>Helper</label><select required value={formData.helperID} onChange={e => setFormData({...formData, helperID: e.target.value})}><option value="">-- Select Helper --</option>{resources.helpers.map(h => <option key={h.userID} value={h.userID}>{h.firstName} {h.lastName}</option>)}</select></div>
                            </div>
                            <button type="submit" className="submit-btn">Confirm Shipment</button>
                        </form>
                    </div>
                </div>
            )}

            {/* Export Date Selection Modal */}
            {showExportModal && (
                <div className="modal-overlay-desktop" onClick={() => setShowExportModal(false)}>
                    <div className="modal-form-card small-modal" onClick={e => e.stopPropagation()}>
                        <div className="modal-header">
                            <h2>Extract Shipment Data</h2>
                            <button className="close-btn" onClick={() => setShowExportModal(false)}>×</button>
                        </div>
                        
                        <div className="export-modal-body">
                            <p style={{marginBottom:'20px', color:'#666'}}>Select the timeframe for the report:</p>
                            
                            <div className="form-row">
                                <div className="form-group">
                                    <label>Start Date</label>
                                    <input 
                                        type="date" 
                                        value={dateRange.start} 
                                        onChange={e => setDateRange({...dateRange, start: e.target.value})}
                                    />
                                </div>
                                <div className="form-group">
                                    <label>End Date</label>
                                    <input 
                                        type="date" 
                                        value={dateRange.end} 
                                        onChange={e => setDateRange({...dateRange, end: e.target.value})}
                                    />
                                </div>
                            </div>

                            <div className="modal-actions" style={{marginTop:'25px', display:'flex', gap:'10px'}}>
                                <button className="cancel-btn-secondary" onClick={() => setShowExportModal(false)}>Cancel</button>
                                <button className="submit-btn" onClick={handleExport} style={{flex:1}}>
                                    Download .xlsx
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

        </div>
    );
}

export default ShipmentView;