import React, { useState, useEffect, useRef } from 'react';
import api from '../../utils/api';
import { Icons } from '../Icons'; 
import './ShipmentView.css';
import FeedbackModal from '../FeedbackModal'; 

const PHASE_ORDER = ['Arrival', 'Handover Invoice', 'Start Unload', 'Finish Unload', 'Invoice Receive', 'Departure'];
const INITIAL_COLUMNS = [
    { key: 'shipmentID', label: 'Shipment ID', checked: true },
    { key: 'destName', label: 'Destination Name', checked: true },
    { key: 'destLocation', label: 'Destination Address', checked: true },
    { key: 'loadingDate', label: 'Loading Date', checked: true },
    { key: 'deliveryDate', label: 'Delivery Date', checked: true },
    { key: 'plateNo', label: 'Truck Plate', checked: true },
    { key: 'truckType', label: 'Truck Type', checked: true },
    { key: 'currentStatus', label: 'Current Status', checked: true },
    // Crew Split
    { key: 'driverName', label: 'Driver Name', checked: true },
    { key: 'driverFee', label: 'Driver Base Fee', checked: false }, 
    { key: 'helperName', label: 'Helper Name', checked: true },
    { key: 'helperFee', label: 'Helper Base Fee', checked: false }, 
    { key: 'allowance', label: 'Allowance (Per Person)', checked: false },
    // Timestamps
    { key: 'dateCreated', label: 'Date Created', checked: true },
    { key: 'arrival', label: 'Time: Arrival', checked: false },
    { key: 'handover', label: 'Time: Handover Invoice', checked: false },
    { key: 'startUnload', label: 'Time: Start Unload', checked: false },
    { key: 'finishUnload', label: 'Time: Finish Unload', checked: false },
    { key: 'invoiceReceive', label: 'Time: Invoice Receive', checked: false },
    { key: 'departure', label: 'Time: Departure', checked: false },
    { key: 'completed', label: 'Time: Completed', checked: true },
];

const MONTH_NAMES = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"
];

const PaginationControls = ({ currentPage, totalItems, rowsPerPage, onPageChange }) => {
    const totalPages = Math.ceil(totalItems / rowsPerPage) || 1;
    
    // Sliding Window Logic
    const currentBlock = Math.ceil(currentPage / 5);
    const startPage = (currentBlock - 1) * 5 + 1;
    const endPage = Math.min(startPage + 4, totalPages);

    const pageNumbers = [];
    for (let i = startPage; i <= endPage; i++) pageNumbers.push(i);

    if (totalPages <= 1) return null;

    return (
        <div className="pagination-footer">
            <button disabled={currentPage === 1} onClick={() => onPageChange(currentPage - 1)}>Prev</button>
            {pageNumbers.map(num => (
                <button key={num} className={currentPage === num ? 'active' : ''} onClick={() => onPageChange(num)}>{num}</button>
            ))}
            <button disabled={currentPage === totalPages} onClick={() => onPageChange(currentPage + 1)}>Next</button>
        </div>
    );
};

function ShipmentView({ user, token, onLogout }) {
    // --- STATE ---
    const [shipments, setShipments] = useState([]);
    const [activeTab, setActiveTab] = useState('Active'); 
    const [statusFilter, setStatusFilter] = useState('All'); 
    const [selectedColumns, setSelectedColumns] = useState(
        INITIAL_COLUMNS.filter(c => c.default).map(c => c.key)
    );
    const [filterYear, setFilterYear] = useState(new Date().getFullYear().toString());
    const [filterMonth, setFilterMonth] = useState('All');

    // Filters
    const [dateFilter, setDateFilter] = useState(''); 
    const [showArchived, setShowArchived] = useState(false); 
    const [sortConfig, setSortConfig] = useState({ key: 'loadingDate', direction: 'desc' });

    // Pagination
    const [currentPage, setCurrentPage] = useState(1);
    const rowsPerPage = 9;
    // UI State
    const [expandedShipmentID, setExpandedShipmentID] = useState(null);
    const [closingId, setClosingId] = useState(null);
    const [activeLogs, setActiveLogs] = useState([]);
    const [flashingIds, setFlashingIds] = useState([]); 
    const prevShipmentsRef = useRef([]); 
    const dragItem = useRef();
    const dragOverItem = useRef();

    // Modals & Data
    const [showModal, setShowModal] = useState(false);
    const [showExportModal, setShowExportModal] = useState(false);
    const [showNoDataModal, setShowNoDataModal] = useState(false);
    const [feedbackModal, setFeedbackModal] = useState(null); 
    const [dateRange, setDateRange] = useState({ start: '', end: '' });
    
    const [resources, setResources] = useState({ drivers: [], helpers: [], vehicles: [] });
    const [crewPopup, setCrewPopup] = useState({ show: false, x: 0, y: 0, crewData: [] });
    
    // Form Data
    const getBlankShipment = () => ({
        shipmentID: '', 
        destName: '', 
        destLocation: '', 
        vehicleID: '', 
        driverID: '', 
        helperID: '', 
        loadingDate: getTodayString(), 
        deliveryDate: '' 
    });
    
    const [routeRules, setRouteRules] = useState({}); 
    const [allVehicles, setAllVehicles] = useState([]); 
    const [filteredRoutes, setFilteredRoutes] = useState([]); 
    const [filteredVehicles, setFilteredVehicles] = useState([]); 
    const [isVehicleDisabled, setIsVehicleDisabled] = useState(true); 
    const [columnConfig, setColumnConfig] = useState(INITIAL_COLUMNS);

    const [batchData, setBatchData] = useState([]); 
    const [batchIndex, setBatchIndex] = useState(0); 
    const [loadingBatch, setLoadingBatch] = useState(false);

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

    const handleBatchChange = (e) => {
        const { name, value } = e.target;
        const updatedBatch = [...batchData];
        updatedBatch[batchIndex] = { ...updatedBatch[batchIndex], [name]: value };
        
        if (name === 'destLocation') {
             const allRoutes = Object.keys(routeRules);
             
             if (!value || value.length === 0) {
                 setFilteredRoutes([]); 
                 setIsVehicleDisabled(true);
             } else {
                 // 1. Find all matches (Partial & Exact)
                 const matches = allRoutes.filter(r => r.toLowerCase().includes(value.toLowerCase()));
                 
                 // 2. Check for Exact Match
                 const exactMatchKey = allRoutes.find(r => r.toLowerCase() === value.toLowerCase());
                 
                 // 3. UX LOGIC: Hide list ONLY if we have an exact match AND it's the only result.
                 // This ensures we don't hide "Bulacan" if "Bulacan North" is also a valid option.
                 if (exactMatchKey && matches.length === 1) {
                     setFilteredRoutes([]); // Hide list (Clean look)
                 } else {
                     setFilteredRoutes(matches); // Keep list open for selection
                 }
                 
                 // 4. Vehicle Logic
                 if (exactMatchKey && routeRules[exactMatchKey]) {
                     const allowedTypes = routeRules[exactMatchKey];
                     const validVehicles = allVehicles.filter(v => allowedTypes.includes(v.type) && v.status === 'Working');
                     setFilteredVehicles(validVehicles);
                     setIsVehicleDisabled(false);
                 } else {
                     setIsVehicleDisabled(true);
                     setFilteredVehicles([]);
                 }
             }
        } else if (name === 'vehicleID') {
            // Optional: Auto-assign driver if vehicle has a default driver?
        }

        setBatchData(updatedBatch);
    };

    const addNewToBatch = () => {
        const current = batchData[batchIndex];
        
        // ✅ FIX: Safety check to prevent the "undefined" error
        if (!current) {
            setBatchData([...batchData, getBlankShipment()]);
            return;
        }

        const newItem = {
            ...getBlankShipment(),
            // Copy dates for convenience, safely
            loadingDate: current.loadingDate || getTodayString(),
            deliveryDate: current.deliveryDate || ''
        };
        
        const updated = [...batchData, newItem];
        setBatchData(updated);
        setBatchIndex(updated.length - 1); // Jump to new
        setIsVehicleDisabled(true); // Reset vehicle for new entry
    };

    const removeCurrentFromBatch = () => {
        if (batchData.length <= 1) return; 
        const updated = batchData.filter((_, idx) => idx !== batchIndex);
        setBatchData(updated);
        if (batchIndex >= updated.length) setBatchIndex(updated.length - 1);
    };

    const handleBatchSubmit = async (e) => {
        e.preventDefault();
        setLoadingBatch(true);
        try {
            await api.post('/shipments/create-batch', batchData, { headers: { Authorization: `Bearer ${token}` } });
            setShowModal(false);
            fetchData(); 
            setFeedbackModal({
                type: 'success',
                title: 'Batch Created!',
                message: `Successfully created ${batchData.length} shipment(s).`,
                onClose: () => setFeedbackModal(null)
            });
        } catch (err) {
            setFeedbackModal({
                type: 'error',
                title: 'Batch Failed',
                message: err.response?.data?.error || "Error creating shipments.",
                subMessage: "Please check IDs and Dates.",
                onClose: () => setFeedbackModal(null)
            });
        } finally {
            setLoadingBatch(false);
        }
    };

    // Helper for rendering form (looks at current index)
    const currentForm = batchData[batchIndex] || getBlankShipment();
    // --- SMART DRAG HANDLERS ---
    const dragStart = (e, position) => {
        dragItem.current = position;
        // Visual tweak: make the row look 'lifted' immediately
        e.target.classList.add('dragging'); 
    };

    const dragEnter = (e, position) => {
        // Prevent unnecessary updates
        if (dragItem.current === null || dragItem.current === undefined) return;
        
        // If we hover over a different item, swap them!
        if (dragItem.current !== position) {
            const newList = [...columnConfig];
            
            // 1. Remove the item from its old position
            const draggedItemContent = newList[dragItem.current];
            newList.splice(dragItem.current, 1);
            
            // 2. Insert it into the new position
            newList.splice(position, 0, draggedItemContent);
            
            // 3. Update Ref to track new position
            dragItem.current = position;
            
            // 4. Update State (Triggers Re-render)
            setColumnConfig(newList);
        }
    };

    const dragEnd = (e) => {
        e.target.classList.remove('dragging');
        dragItem.current = null;
        dragOverItem.current = null;
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
            
            // ✅ FIX: Reset the route suggestions to show ALL options when opening
            setFilteredRoutes([]);
            
            setBatchData([getBlankShipment()]);
            setBatchIndex(0);
            setIsVehicleDisabled(true); 
            setShowModal(true);
        } catch (err) { alert("Could not load resources."); }
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
            // Filter only checked columns and map to just their keys
            // The ORDER of this array will match the visual order in the modal
            const selectedKeys = columnConfig.filter(c => c.checked).map(c => c.key);

            const params = { 
                startDate: dateRange.start, 
                endDate: dateRange.end,
                columns: JSON.stringify(selectedKeys) // Pass ordered keys
            };

            const config = { 
                headers: { Authorization: `Bearer ${token}` }, 
                params: params, 
                responseType: 'blob' 
            };

            const response = await api.get('/shipments/export', config);
            
            const url = window.URL.createObjectURL(new Blob([response.data]));
            const link = document.createElement('a');
            link.href = url;
            link.setAttribute('download', `Shipment_Report_${dateRange.start}.xlsx`);
            document.body.appendChild(link);
            link.click();
            link.parentNode.removeChild(link);
            setShowExportModal(false); 
        } catch (error) {
            setFeedbackModal({ type: 'error', title: 'Export Failed', message: "Could not download file.", onClose: () => setFeedbackModal(null) });
        }
    };

    const moveColumn = (index, direction) => {
        const newConfig = [...columnConfig];
        const targetIndex = direction === 'up' ? index - 1 : index + 1;
        
        if (targetIndex >= 0 && targetIndex < newConfig.length) {
            // Swap
            [newConfig[index], newConfig[targetIndex]] = [newConfig[targetIndex], newConfig[index]];
            setColumnConfig(newConfig);
        }
    };
    
    const toggleColumnCheck = (index) => {
        const newConfig = [...columnConfig];
        newConfig[index].checked = !newConfig[index].checked;
        setColumnConfig(newConfig);
    };

    const toggleColumn = (key) => {
        setSelectedColumns(prev => 
            prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key]
        );
    };

    const selectAllColumns = (selectAll) => {
        if (selectAll) setSelectedColumns(INITIAL_COLUMNS.map(c => c.key));
        else setSelectedColumns([]);
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

    const getDisplayStatus = (dbStatus) => {
        if (dbStatus === 'Pending') return 'Arrival'; 
        if (dbStatus === 'Completed') return 'Completed';
        const idx = PHASE_ORDER.indexOf(dbStatus);
        if (idx !== -1 && idx < PHASE_ORDER.length - 1) return PHASE_ORDER[idx + 1];
        if (idx === PHASE_ORDER.length - 1) return 'Completed';
        return dbStatus; 
    };

    // 1. Get Years from Data
    const availableYears = [...new Set(shipments.map(s => new Date(s.loadingDate).getFullYear().toString()))].sort().reverse();
    // Ensure current year is always an option even if no data yet
    if (!availableYears.includes(new Date().getFullYear().toString())) {
        availableYears.unshift(new Date().getFullYear().toString());
    }

    // 2. Get Months based on Selected Year
    const availableMonths = [...new Set(shipments
        .filter(s => new Date(s.loadingDate).getFullYear().toString() === filterYear)
        .map(s => new Date(s.loadingDate).getMonth())
    )].sort((a,b) => a - b);

    const getShipmentCategory = (s) => {
        const today = getTodayString();
        const loadDate = getDateValue(s.loadingDate);
        const delDate = getDateValue(s.deliveryDate);
        const isCompleted = s.currentStatus === 'Completed' || s.currentStatus === 'Cancelled';

        // 1. Completed Tab
        if (isCompleted) return 'Completed';
        
        // 2. Delayed Tab Logic
        // A. Delivery Date has passed
        if (delDate && delDate < today) return 'Delayed';
        
        // B. (FIX) Loading Date has passed, but status is still 'Pending' (Late Start)
        // This moves "Yesterday's unstarted shipments" from Active to Delayed
        if (loadDate && loadDate < today && s.currentStatus === 'Pending') return 'Delayed';

        // 3. Upcoming Tab
        if (loadDate && loadDate > today) return 'Upcoming';
        
        // 4. Active Tab (Fallback)
        // Includes: Today's shipments, plus any multi-day trips currently in transit
        return 'Active';
    };

    const handleSort = (key) => {
        let direction = 'desc'; // Default to Arrow Down (Arrival -> Departure)
        if (sortConfig.key === key && sortConfig.direction === 'desc') {
            direction = 'asc';
        }
        setSortConfig({ key, direction });
    };

    const finalFiltered = shipments.filter(s => {
        if (getShipmentCategory(s) !== activeTab) return false;
        if (activeTab !== 'Active') {
            const sYear = new Date(s.loadingDate).getFullYear().toString();
            if (sYear !== filterYear) return false;
            if (filterMonth !== 'All') {
                const sMonth = new Date(s.loadingDate).getMonth();
                if (sMonth !== parseInt(filterMonth)) return false;
            }
        }
        if (activeTab === 'Active' && statusFilter !== 'All') {
            const displayStatus = getDisplayStatus(s.currentStatus);
            if (displayStatus !== statusFilter) return false;
        }
        return true;
    });

    const sortedShipments = [...finalFiltered].sort((a, b) => {
        const { key, direction } = sortConfig;

        // 1. STATUS SORTING
        if (key === 'currentStatus') {
            const getPhaseIndex = (status) => {
                if (status === 'Pending') return 0;
                if (status === 'Completed') return 99;
                const idx = PHASE_ORDER.indexOf(status);
                return idx === -1 ? 99 : idx; 
            };

            const indexA = getPhaseIndex(a.currentStatus);
            const indexB = getPhaseIndex(b.currentStatus);

            // Arrow Down ('desc') = Arrival (0) -> Departure (99)
            if (direction === 'desc') return indexA - indexB;
            // Arrow Up ('asc') = Departure (99) -> Arrival (0)
            return indexB - indexA;
        }

        // 2. DATE SORTING
        if (key === 'loadingDate' || key === 'deliveryDate') {
            const dateA = new Date(a[key] || '1970-01-01');
            const dateB = new Date(b[key] || '1970-01-01');
            
            // Arrow Down ('desc') = Oldest -> Newest (Standard Chronological)
            if (direction === 'desc') return dateA - dateB;
            // Arrow Up ('asc') = Newest -> Oldest
            return dateB - dateA;
        }

        return 0;
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

    const paginatedShipments = sortedShipments.slice((currentPage - 1) * rowsPerPage, currentPage * rowsPerPage);

    const getCount = (tabName) => {
        return shipments.filter(s => {
            // 1. Match Category
            if (getShipmentCategory(s) !== tabName) return false;

            // 2. Apply Filters ONLY for History Tabs
            // "Active" count should never change based on the Year/Month dropdowns
            if (tabName !== 'Active') {
                const sYear = new Date(s.loadingDate).getFullYear().toString();
                if (sYear !== filterYear) return false;

                if (filterMonth !== 'All') {
                    const sMonth = new Date(s.loadingDate).getMonth();
                    if (sMonth !== parseInt(filterMonth)) return false;
                }
            }

            return true;
        }).length;
    };

    const renderSortArrow = (columnKey) => {
        const isActive = sortConfig.key === columnKey;
        const isDesc = isActive && sortConfig.direction === 'desc';
        
        return (
            <span 
                className={`sort-icon-btn ${isActive ? 'active' : ''} ${isDesc ? 'desc' : ''}`} 
                onClick={(e) => { e.stopPropagation(); handleSort(columnKey); }}
                title="Sort"
            >
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M12 19V5" />
                    <path d="M5 12l7-7 7 7" />
                </svg>
            </span>
        );
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
                            <div className="filter-group-bordered">
                            <div style={{display:'flex', flexDirection:'column'}}>
                                <label style={{fontSize:'10px', fontWeight:'700', color:'#999', textTransform:'uppercase'}}>Year</label>
                                <select 
                                    value={filterYear} 
                                    onChange={(e) => { setFilterYear(e.target.value); setFilterMonth('All'); setCurrentPage(1); }}
                                    style={{border:'none', fontSize:'13px', outline:'none', background:'transparent', cursor:'pointer'}}
                                >
                                    {availableYears.map(y => <option key={y} value={y}>{y}</option>)}
                                </select>
                            </div>
                            
                            <div style={{width:'1px', height:'25px', background:'#eee'}}></div>

                            <div style={{display:'flex', flexDirection:'column'}}>
                                <label style={{fontSize:'10px', fontWeight:'700', color:'#999', textTransform:'uppercase'}}>Month</label>
                                <select 
                                    value={filterMonth} 
                                    onChange={(e) => { setFilterMonth(e.target.value); setCurrentPage(1); }}
                                    style={{border:'none', fontSize:'13px', outline:'none', background:'transparent', cursor:'pointer', minWidth:'100px'}}
                                >
                                    <option value="All">All Months</option>
                                    {availableMonths.map(mIndex => (
                                        <option key={mIndex} value={mIndex}>{MONTH_NAMES[mIndex]}</option>
                                    ))}
                                </select>
                            </div>
                            
                        </div>   
                        <div style={{width:'1px', height:'35px', background:'#eee'}}></div>            
                            </>
                        )}

                        <div className="filter-group">
                            <button className={`archive-toggle-btn ${showArchived ? 'active' : ''}`} onClick={() => { setShowArchived(!showArchived); setCurrentPage(1); }}>
                                {showArchived ? '← Back to Active' : 'View Archived'}
                            </button>
                        </div>
                    </div>
                    <div className="controls-right" style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                        <button className="extract-btn" onClick={() => setShowExportModal(true)}><Icons.Upload />Export to .xlsx</button>
                        <button className="new-shipment-btn" onClick={handleOpenModal}>+ New Shipment</button>
                    </div>
                </div>
            </div>

            <div className="shipment-scrollable-table">
                <table className="custom-table">
                    <thead>
                        <tr>
                            <th>ID</th>
                            <th>
                                <div className="th-content">
                                    Status 
                                    {renderSortArrow('currentStatus')}
                                </div>
                            </th>
                            <th>Destination</th>
                            <th>Route</th>
                            <th>
                                <div className="th-content">
                                    Loading
                                    {renderSortArrow('loadingDate')}
                                </div>
                            </th>
                            <th>
                                <div className="th-content">
                                    Delivery 
                                    {renderSortArrow('deliveryDate')}
                                </div>
                            </th>
                            <th>Plate</th>
                            <th>Crew</th>
                            <th>Action</th>
                            <th></th>
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
                                    <td style={{fontWeight:'600'}}>{formatDateDisplay(s.loadingDate)}</td>
                                    <td style={{color: isDelayedRow ? '#c0392b' : 'black', fontWeight: isDelayedRow ? '700' : '400'}}>
                                        {formatDateDisplay(s.deliveryDate)}
                                        {isDelayedRow}
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
            
            {showModal && (
                <div className="modal-overlay-desktop" onClick={() => setShowModal(false)}>
                    <div className="modal-form-card" onClick={e => e.stopPropagation()}>
                        
                        {/* 1. NEW BATCH NAVIGATION HEADER */}
                        <div className="batch-nav-header">
                            <div className="batch-indicators">
                                <span className="batch-pill">Shipment {batchIndex + 1} of {batchData.length}</span>
                                {batchData.length > 1 && (
                                    <button type="button" className="remove-item-btn" onClick={removeCurrentFromBatch}>
                                        Remove this entry
                                    </button>
                                )}
                            </div>
                            <div className="batch-controls">
                                <button 
                                    type="button" 
                                    className="nav-arrow-btn"
                                    disabled={batchIndex === 0}
                                    onClick={() => setBatchIndex(prev => prev - 1)}
                                    title="Previous"
                                >
                                    ‹
                                </button>
                                <button 
                                    type="button" 
                                    className="nav-arrow-btn"
                                    disabled={batchIndex === batchData.length - 1}
                                    onClick={() => setBatchIndex(prev => prev + 1)}
                                    title="Next"
                                >
                                    ›
                                </button>
                                <div style={{width:'10px'}}></div>
                                <button type="button" className="add-another-btn" onClick={addNewToBatch}>
                                    <Icons.Plus size={12}/> Add Another
                                </button>
                            </div>
                        </div>

                        <div className="modal-header" style={{marginTop:0}}>
                            <h2>Create Shipment</h2>
                            <button className="close-btn" onClick={() => setShowModal(false)}>×</button>
                        </div>

                        {/* 2. FORM (Bound to currentForm) */}
                        <form onSubmit={handleBatchSubmit} className="shipment-form">
                            <div className="form-row">
                                <div className="form-group">
                                    <label>Shipment ID</label>
                                    <input 
                                        type="number" 
                                        name="shipmentID"
                                        required 
                                        value={currentForm.shipmentID} 
                                        onChange={handleBatchChange} 
                                        autoFocus
                                    />
                                </div>
                                <div className="form-group">
                                    <label>Destination Name</label>
                                    <input 
                                        type="text" 
                                        name="destName"
                                        required 
                                        value={currentForm.destName} 
                                        onChange={handleBatchChange} 
                                    />
                                </div>
                            </div>

                            <div className="form-row">
                                <div className="form-group">
                                    <label>Loading Date</label>
                                    <input 
                                        type="date" 
                                        name="loadingDate" 
                                        required 
                                        min={getTodayString()} 
                                        value={currentForm.loadingDate} 
                                        onChange={handleBatchChange} 
                                    />
                                </div>
                                <div className="form-group">
                                    <label style={{color: !currentForm.loadingDate ? '#999' : '#555'}}>Delivery Date</label>
                                    <input 
                                        type="date" 
                                        name="deliveryDate"
                                        required 
                                        disabled={!currentForm.loadingDate} 
                                        min={currentForm.loadingDate} 
                                        value={currentForm.deliveryDate} 
                                        onChange={handleBatchChange}
                                        style={{ backgroundColor: !currentForm.loadingDate ? '#f9f9f9' : 'white', cursor: !currentForm.loadingDate ? 'not-allowed' : 'pointer'}}
                                    />
                                </div>
                            </div>

                            <div className="form-group" style={{ marginBottom: '15px' }}>
                                <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>Route / Cluster</label>
                                <input 
                                    type="text" 
                                    name="destLocation" 
                                    value={currentForm.destLocation} 
                                    onChange={handleBatchChange} 
                                    list={filteredRoutes.length > 0 ? "route-list" : ""} 
                                    className="form-input" 
                                    placeholder="Search..." 
                                    autoComplete="off" 
                                    required 
                                />
                                <datalist id="route-list">
                                    {filteredRoutes.map((r, i) => <option key={i} value={r} />)}
                                </datalist>
                            </div>

                            <div className="form-group" style={{marginBottom: '15px'}}>
                                <label style={{fontWeight: 'bold', color: isVehicleDisabled ? '#999' : 'black'}}>Vehicle Assignment</label>
                                <select 
                                    name="vehicleID" 
                                    value={currentForm.vehicleID} 
                                    onChange={handleBatchChange} 
                                    className="form-input" 
                                    required 
                                    disabled={isVehicleDisabled} 
                                    style={{ backgroundColor: isVehicleDisabled ? '#f0f0f0' : 'white' }}
                                >
                                    <option value="">{isVehicleDisabled ? "Select route first..." : "-- Select Vehicle --"}</option>
                                    {filteredVehicles.map(v => (
                                        <option key={v.vehicleID} value={v.vehicleID}>{v.plateNo} ({v.type})</option>
                                    ))}
                                </select>
                            </div>

                            <div className="form-row">
                                <div className="form-group">
                                    <label>Driver</label>
                                    <select 
                                        name="driverID"
                                        required 
                                        value={currentForm.driverID} 
                                        onChange={handleBatchChange}
                                    >
                                        <option value="">-- Select Driver --</option>
                                        {resources.drivers
                                            .filter(d => String(d.userID) !== String(currentForm.helperID)) 
                                            .map(d => (
                                                <option key={d.userID} value={d.userID}>{d.firstName} {d.lastName}</option>
                                            ))
                                        }
                                    </select>
                                </div>
                                <div className="form-group">
                                    <label>Helper</label>
                                    <select 
                                        name="helperID"
                                        required 
                                        value={currentForm.helperID} 
                                        onChange={handleBatchChange}
                                    >
                                        <option value="">-- Select Helper --</option>
                                        {resources.helpers
                                            .filter(h => String(h.userID) !== String(currentForm.driverID)) 
                                            .map(h => (
                                                <option key={h.userID} value={h.userID}>
                                                    {h.firstName} {h.lastName} {h.role === 'Driver' ? '(Driver)' : ''}
                                                </option>
                                            ))
                                        }
                                    </select>
                                </div>
                            </div>

                            <div style={{marginTop:'20px'}}>
                                <button type="submit" className="submit-btn" disabled={loadingBatch} style={{width:'100%'}}>
                                    {loadingBatch ? 'Creating...' : `Confirm ${batchData.length} Shipment${batchData.length > 1 ? 's' : ''}`}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
            
            <PaginationControls 
                currentPage={currentPage} 
                totalItems={finalFiltered.length} 
                rowsPerPage={rowsPerPage} 
                onPageChange={setCurrentPage} 
            />
            
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
                        <button className="btn-alert-shipment" onClick={() => setShowNoDataModal(false)} style={{width: '100%'}}>Okay</button>
                    </div>
                </div>
            )}
            {showExportModal && (
                <div className="modal-overlay-desktop" onClick={() => setShowExportModal(false)}>
                    <div className="modal-form-card" onClick={e => e.stopPropagation()} style={{width: '500px'}}>
                        <div className="modal-header">
                            <h2>Extract Data</h2>
                            <button className="close-btn" onClick={() => setShowExportModal(false)}>×</button>
                        </div>
                        
                        <div className="export-modal-body">
                            <div className="form-row" style={{marginBottom: '20px'}}>
                                <div className="form-group">
                                    <label>Start</label>
                                    <input type="date" className="date-input" value={dateRange.start} onChange={e => setDateRange({...dateRange, start: e.target.value})} />
                                </div>
                                <div className="form-group">
                                    <label>End</label>
                                    <input type="date" className="date-input" value={dateRange.end} onChange={e => setDateRange({...dateRange, end: e.target.value})} />
                                </div>
                            </div>

                            <label className="export-options-label">Select & Arrange Columns (Drag to Reorder)</label>
                            
                            <div className="sortable-list">
                                {columnConfig.map((col, index) => (
                                    <div 
                                        key={col.key} 
                                        className="sortable-item"
                                        draggable
                                        onDragStart={(e) => dragStart(e, index)}
                                        onDragEnter={(e) => dragEnter(e, index)}
                                        onDragEnd={dragEnd}
                                        onDragOver={(e) => e.preventDefault()} // Necessary for drop to work
                                    >
                                        {/* Grip Handle */}
                                        <div className="drag-handle" title="Drag to reorder">
                                            <Icons.GripIcon />
                                        </div>

                                        {/* Checkbox & Label */}
                                        <label>
                                            <input 
                                                type="checkbox" 
                                                checked={col.checked}
                                                onChange={() => {
                                                    const newConfig = [...columnConfig];
                                                    newConfig[index].checked = !newConfig[index].checked;
                                                    setColumnConfig(newConfig);
                                                }}
                                            />
                                            {col.label}
                                        </label>
                                    </div>
                                ))}
                            </div>

                            <div className="modal-actions" style={{marginTop:'25px', display:'flex', gap:'10px'}}>
                                <button className="cancel-btn-secondary" onClick={() => setShowExportModal(false)}>Cancel</button>
                                <button className="submit-btn" onClick={handleExport} style={{flex:1}}>Download Report</button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

export default ShipmentView;