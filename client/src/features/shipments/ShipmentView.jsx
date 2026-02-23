import React from 'react';
import { useState, useEffect, useRef, useMemo } from 'react';
import api from '@utils/api';
import { Icons, FeedbackModal, PaginationControls } from '@shared';
import { PHASE_ORDER, STORE_PHASES, WAREHOUSE_PHASES, EXPORT_COLUMNS, MONTH_NAMES, getTodayString, getDateValue, formatDateDisplay, getMonthValue, formatMonthDisplay } from '@constants';

function ShipmentView({ user, token, onLogout }) {
    // --- STATE ---
    const [shipments, setShipments] = useState([]);
    const [activeTab, setActiveTab] = useState('Active');
    const [phaseTab, setPhaseTab] = useState('store'); // 'warehouse' or 'store'
    const [statusFilter, setStatusFilter] = useState('All');
    const [filterYear, setFilterYear] = useState(new Date().getFullYear().toString());
    const [filterMonth, setFilterMonth] = useState('All');

    // Filters
    const [dateFilter, setDateFilter] = useState(''); 
    const [routeFilter, setRouteFilter] = useState('');
    const [crewFilter, setCrewFilter] = useState('');
    const [idFilter, setIdFilter] = useState('');
    const [delayTypeFilter, setDelayTypeFilter] = useState('All'); // 'All', 'Loading', 'Delivery'
    const [showArchived, setShowArchived] = useState(false); 
    const [sortConfig, setSortConfig] = useState({ key: 'loadingDate', direction: 'desc' });

    // Pagination
    const [currentPage, setCurrentPage] = useState(1);
    const rowsPerPage = 7;
    // UI State
    const [expandedShipmentID, setExpandedShipmentID] = useState(null);
    const [closingId, setClosingId] = useState(null);
    const [activeLogs, setActiveLogs] = useState([]);
    const [flashingIds, setFlashingIds] = useState([]); 
    const [lastUpdateTimestamps, setLastUpdateTimestamps] = useState({});
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
        deliveryDate: '',
        drops: [{ destName: '', destLocation: '' }]
    });
    
    const [routeRules, setRouteRules] = useState({}); 
    const [allVehicles, setAllVehicles] = useState([]); 
    const [filteredRoutes, setFilteredRoutes] = useState([]); 
    const [filteredVehicles, setFilteredVehicles] = useState([]); 
    const [isVehicleDisabled, setIsVehicleDisabled] = useState(true); 
    const [columnConfig, setColumnConfig] = useState(EXPORT_COLUMNS.map(c => ({ ...c })));

    const [batchData, setBatchData] = useState([]); 
    const [batchIndex, setBatchIndex] = useState(0); 
    const [dropIndex, setDropIndex] = useState(0);
    const [selectedDropIndex, setSelectedDropIndex] = useState(0);
    const [loadingBatch, setLoadingBatch] = useState(false);

    const getRouteSuggestions = (value) => {
        const query = (value || '').trim().toLowerCase();
        if (!query) return { matches: [], exactMatchKey: null };
        const allRoutes = Object.keys(routeRules);
        const matches = allRoutes.filter(r => r.toLowerCase().includes(query));
        const exactMatchKey = allRoutes.find(r => r.toLowerCase() === query) || null;
        if (exactMatchKey && matches.length === 1) {
            return { matches: [], exactMatchKey };
        }
        return { matches, exactMatchKey };
    };

    const handleBatchChange = (e) => {
        const { name, value } = e.target;
        const updatedBatch = [...batchData];
        const current = { ...updatedBatch[batchIndex], [name]: value };
        
        // If we update the main destName, sync it to the first drop
        if (name === 'destName') {
            const newDrops = [...current.drops];
            if (newDrops.length > 0) {
                newDrops[0] = { ...newDrops[0], destName: value };
                current.drops = newDrops;
            }
        }

        updatedBatch[batchIndex] = current;
        setBatchData(updatedBatch);
    };

    const handleDropChange = (dropIdx, field, value) => {
        const updatedBatch = [...batchData];
        const current = { ...updatedBatch[batchIndex] };
        const updatedDrops = [...current.drops];
        updatedDrops[dropIdx] = { ...updatedDrops[dropIdx], [field]: value };
        current.drops = updatedDrops;

        // Sync first drop back to main fields for display/legacy
        if (dropIdx === 0) {
            if (field === 'destName') current.destName = value;
            if (field === 'destLocation') {
                current.destLocation = value;
                
                if (!value || value.length === 0) {
                    setFilteredRoutes([]);
                    setIsVehicleDisabled(true);
                } else {
                    const { matches, exactMatchKey } = getRouteSuggestions(value);
                    setFilteredRoutes(matches);
                    if (exactMatchKey && routeRules[exactMatchKey]) {
                        const allowedTypes = routeRules[exactMatchKey];
                        const validVehicles = allVehicles.filter(v => allowedTypes.includes(v.type) && v.status === 'Working');
                        setFilteredVehicles(validVehicles);
                        setIsVehicleDisabled(false);
                    } else {
                        setFilteredVehicles([]);
                        setIsVehicleDisabled(true);
                    }
                }
            }
        }

        updatedBatch[batchIndex] = current;
        setBatchData(updatedBatch);
    };

    const addDrop = () => {
        const updatedBatch = [...batchData];
        const current = { ...updatedBatch[batchIndex] };
        current.drops = [...current.drops, { destName: '', destLocation: current.drops[current.drops.length - 1]?.destLocation || '' }];
        updatedBatch[batchIndex] = current;
        setBatchData(updatedBatch);
        setDropIndex(current.drops.length - 1);
    };

    const removeDrop = (dropIdx) => {
        const updatedBatch = [...batchData];
        const current = { ...updatedBatch[batchIndex] };
        if (current.drops.length <= 1) return;
        current.drops = current.drops.filter((_, idx) => idx !== dropIdx);
        
        // If we removed the first drop, update the main fields to the new first drop
        if (dropIdx === 0 && current.drops.length > 0) {
            current.destName = current.drops[0].destName;
            current.destLocation = current.drops[0].destLocation;
        }

        updatedBatch[batchIndex] = current;
        setBatchData(updatedBatch);
        
        // Adjust dropIndex if it's now out of bounds or was the removed item
        if (dropIndex >= current.drops.length) {
            setDropIndex(current.drops.length - 1);
        }
    };

    const addNewToBatch = () => {
        const current = batchData[batchIndex];
        
        if (!current) {
            setBatchData([...batchData, getBlankShipment()]);
            setDropIndex(0);
            return;
        }

        const newItem = {
            ...getBlankShipment(),
            loadingDate: current.loadingDate || getTodayString(),
            deliveryDate: current.deliveryDate || ''
        };
        
        const updated = [...batchData, newItem];
        setBatchData(updated);
        setBatchIndex(updated.length - 1); // Jump to new
        setDropIndex(0); // Reset drop index for new shipment
        setIsVehicleDisabled(true); // Reset vehicle for new entry
    };

    const removeCurrentFromBatch = () => {
        if (batchData.length <= 1) return; 
        const updated = batchData.filter((_, idx) => idx !== batchIndex);
        setBatchData(updated);
        if (batchIndex >= updated.length) setBatchIndex(updated.length - 1);
        setDropIndex(0); // Reset drop index
    };

    const handleBatchSubmit = async (e) => {
        e.preventDefault();

        for (let i = 0; i < batchData.length; i += 1) {
            const shipment = batchData[i];
            const drops = shipment.drops || [];

            if (drops.length === 0) {
                setFeedbackModal({
                    type: 'error',
                    title: 'Missing Drops',
                    message: `Shipment ${i + 1} must have at least one drop.`,
                    onClose: () => setFeedbackModal(null)
                });
                return;
            }

            for (let j = 0; j < drops.length; j += 1) {
                const drop = drops[j] || {};
                const hasName = !!drop.destName && drop.destName.trim().length > 0;
                const hasRoute = !!drop.destLocation && drop.destLocation.trim().length > 0;

                if (!hasName || !hasRoute) {
                    setFeedbackModal({
                        type: 'error',
                        title: 'Incomplete Drop Details',
                        message: `Fill Store and Route for Drop ${j + 1} in Shipment ${i + 1}, or delete that drop.`,
                        onClose: () => setFeedbackModal(null)
                    });
                    return;
                }
            }
        }

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

    const currentForm = batchData[batchIndex] || getBlankShipment();
    const currentDrop = currentForm.drops[dropIndex] || { destName: '', destLocation: '' };
    const { matches: routeSuggestions } = getRouteSuggestions(currentDrop.destLocation);
    
    const handleSelectAllColumns = () => {
        const allChecked = columnConfig.every(col => col.checked);
        const newConfig = columnConfig.map(col => ({
            ...col,
            checked: !allChecked
        }));
        setColumnConfig(newConfig);
    };

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
            if (!token) return;
            try {
                const config = { headers: { Authorization: `Bearer ${token}` } };
                const [routeRes, vehicleRes] = await Promise.all([
                    api.get('/shipments/payroll-routes', config),
                    api.get('/vehicles', config)
                ]);
                setRouteRules(routeRes.data || {});
                setAllVehicles(vehicleRes.data || []);
            } catch { void 0; }
        };
        loadData();
    }, [token]);

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
                if (updates.length > 0) {
                    const now = Date.now();
                    setLastUpdateTimestamps(prev => {
                        const next = { ...prev };
                        updates.forEach((id, idx) => {
                            next[id] = now + idx;
                        });
                        return next;
                    });
                    triggerNotification(updates);
                }
            }
            prevShipmentsRef.current = newData;
            setShipments(newData);
        } catch (err) { 
            if (err.response?.status === 401) {
                setFeedbackModal({ 
                    type: 'error', 
                    title: 'Session Expired', 
                    message: 'Please log in again to continue.', 
                    confirmLabel: 'Log In',
                    onConfirm: () => onLogout()
                });
            }
        }
    };

    const expandedIdRef = useRef(null);
    useEffect(() => { expandedIdRef.current = expandedShipmentID; }, [expandedShipmentID]);
    
    const refreshLogs = async (id) => {
        try {
            const res = await api.get(`/shipments/${id}/logs`, { headers: { Authorization: `Bearer ${token}` } });
            setActiveLogs(res.data);
        } catch { void 0; }
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
        // 1. Validation: Check for missing dates
        if (!dateRange.start || !dateRange.end) {
            setFeedbackModal({ 
                type: 'error', 
                title: 'Invalid Date Range', 
                message: "Please select both a Start Date and an End Date.", 
                onClose: () => setFeedbackModal(null) 
            });
            return;
        }

        // 2. Validation: Check logical order
        if (dateRange.end < dateRange.start) {
            setFeedbackModal({ 
                type: 'error', 
                title: 'Invalid Date Range', 
                message: "The End Date cannot be before the Start Date.", 
                onClose: () => setFeedbackModal(null) 
            });
            return;
        }

        // 3. Validation: Check Column Selection 
        const hasSelectedColumns = columnConfig.some(col => col.checked);
        if (!hasSelectedColumns) {
            setFeedbackModal({
                type: 'error',
                title: 'No Columns Selected',
                message: "Please check at least one column to include in the export.",
                onClose: () => setFeedbackModal(null)
            });
            return;
        }

        // Logic Change: 
        // We do NOT filter by 'shipments' state here because 'shipments' state only contains what is loaded in the UI (pagination/filters).
        // The export is a server-side query that might find data even if it's not currently in the 'shipments' array.
        // So we proceed to the API call directly.

        try {
            const selectedKeys = columnConfig.filter(c => c.checked).map(c => c.key);

            const params = { 
                startDate: dateRange.start, 
                endDate: dateRange.end,
                columns: JSON.stringify(selectedKeys) 
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
            // Check if it's a 404 (No Data)
            if (error.response && error.response.status === 404) {
                 setShowNoDataModal(true);
            } else {
                 setFeedbackModal({ type: 'error', title: 'Export Failed', message: "Could not download file.", onClose: () => setFeedbackModal(null) });
            }
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
        if (expandedShipmentID === id) { setClosingId(id); setTimeout(() => { setExpandedShipmentID(null); setClosingId(null); setActiveLogs([]); setSelectedDropIndex(0); }, 300); }
        else { setExpandedShipmentID(id); setClosingId(null); refreshLogs(id); setSelectedDropIndex(0); }
    };

    // --- TAB FILTERING ---
    const getShipmentCategory = (s) => {
        const today = getTodayString();
        const loadDate = getDateValue(s.loadingDate);
        const delDate = getDateValue(s.deliveryDate);
        
        // Filter out junk/test data with no dates
        if (!loadDate) return 'Invalid'; 

        const isCompleted = s.currentStatus === 'Completed' || s.currentStatus === 'Cancelled';

        // 1. Completed Tab
        if (isCompleted) return 'Completed';
        
        // 2. Delayed Tab Logic
        const warehousePhasesExceptLast = WAREHOUSE_PHASES.slice(0, -1);
        const isWarehousePhase = s.currentStatus === 'Pending' || warehousePhasesExceptLast.includes(s.currentStatus);
        
        // A. Loading Delay: Still at warehouse (before Start Route) AND loadingDate has passed
        const isLoadingDelayed = isWarehousePhase && loadDate && loadDate < today;
        
        // B. Delivery Delay: Past warehouse phases AND deliveryDate has passed
        const isDeliveryDelayed = !isWarehousePhase && delDate && delDate < today;

        if (isLoadingDelayed || isDeliveryDelayed) return 'Delayed';

        // 3. Upcoming Tab
        // Upcoming should only be Pending future loads.
        if (loadDate && loadDate > today && s.currentStatus === 'Pending') return 'Upcoming';
        
        // 4. Active Tab (Fallback)
        return 'Active';
    };

    const tabFiltered = useMemo(() => {
        return shipments.filter(s => getShipmentCategory(s) === activeTab);
    }, [shipments, activeTab]);

    const filterOptions = useMemo(() => {
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
    }, [tabFiltered, activeTab]);

    const tabRoutes = useMemo(() => {
        const routes = tabFiltered.map(s => s.destLocation).filter(Boolean);
        return [...new Set(routes)].sort();
    }, [tabFiltered]);

    const tabCrew = useMemo(() => {
        const crew = new Set();
        tabFiltered.forEach(s => {
            if (s.crewDetails) {
                s.crewDetails.split('|').forEach(c => {
                    const parts = c.split(':');
                    if (parts.length > 1) {
                        const name = parts[1].trim();
                        if (name) crew.add(name);
                    }
                });
            }
        });
        return [...crew].sort();
    }, [tabFiltered]);

    const getDisplayStatus = (s) => {
        const dbStatus = s.currentStatus;

        if (dbStatus === 'Completed') return 'Completed';
        if (dbStatus === 'Pending') return 'To Load'; 
        
        // IN TRANSIT: Strictly when the truck is moving
        if (dbStatus === 'Start Route' || dbStatus === 'Departure') {
            return 'In Transit';
        }

        // Otherwise, show the actual phase name (Arrival, Loading, etc.)
        return dbStatus; 
    };

    const getDaysDelayed = (s) => {
        const today = new Date(getTodayString());
        const loadDate = s.loadingDate ? new Date(s.loadingDate) : null;
        const delDate = s.deliveryDate ? new Date(s.deliveryDate) : null;
        
        const warehousePhasesExceptLast = WAREHOUSE_PHASES.slice(0, -1);
        const isWarehousePhase = s.currentStatus === 'Pending' || warehousePhasesExceptLast.includes(s.currentStatus);
        
        // 1. Loading Delay: Still at warehouse (before Start Route) AND loadingDate passed
        if (isWarehousePhase && loadDate && loadDate < today) {
            const diffTime = Math.abs(today - loadDate);
            return { days: Math.ceil(diffTime / (1000 * 60 * 60 * 24)), type: 'Loading' };
        }

        // 2. Delivery Delay: Past warehouse phases AND deliveryDate passed
        if (!isWarehousePhase && delDate && delDate < today) {
            const diffTime = Math.abs(today - delDate);
            return { days: Math.ceil(diffTime / (1000 * 60 * 60 * 24)), type: 'Delivery' }; 
        }

        return { days: 0, type: null };
    };

    const isAtRisk = (s) => {
        const today = getTodayString();
        const loadDate = getDateValue(s.loadingDate);
        const delDate = getDateValue(s.deliveryDate);
        
        if (s.currentStatus === 'Completed') return false;

        // Due for Loading Today (and not yet loaded)
        if (loadDate === today && s.currentStatus === 'Pending') return true;

        // Due for Delivery Today (and not yet completed)
        if (delDate === today && s.currentStatus !== 'Completed') return true;

        return false;
    };

    // --- DELAY REASON MODAL STATE ---
    const [showDelayReasonModal, setShowDelayReasonModal] = useState(false);
    const [delayReasonData, setDelayReasonData] = useState({ id: null, reason: '' });

    const openDelayReasonModal = (id, currentReason) => {
        setDelayReasonData({ id, reason: currentReason || '' });
        setShowDelayReasonModal(true);
    };

    const handleDelayReasonSubmit = async (e) => {
        e.preventDefault();
        try {
            await api.put(`/shipments/${delayReasonData.id}/delay-reason`, 
                { reason: delayReasonData.reason, userID: user.userID }, 
                { headers: { Authorization: `Bearer ${token}` } }
            );
            fetchData(true);
            setShowDelayReasonModal(false);
            setFeedbackModal({ type: 'success', title: 'Reason Updated', message: 'Delay reason saved successfully.', onClose: () => setFeedbackModal(null) });
        } catch (err) {
            console.error("Failed to update reason:", err);
            setFeedbackModal({ type: 'error', title: 'Update Failed', message: 'Could not save delay reason.', onClose: () => setFeedbackModal(null) });
        }
    };

    const updateDelayReason = (id, reason) => {
        openDelayReasonModal(id, reason);
    };

    // --- RENDER HELPERS ---

    // 1. Get Years from Data
    const availableYears = useMemo(() => {
        const years = [...new Set(shipments.map(s => new Date(s.loadingDate).getFullYear().toString()))].sort().reverse();
        if (!years.includes(new Date().getFullYear().toString())) {
            years.unshift(new Date().getFullYear().toString());
        }
        return years;
    }, [shipments]);

    // 2. Get Months based on Selected Year
    const availableMonths = useMemo(() => {
        return [...new Set(shipments
            .filter(s => new Date(s.loadingDate).getFullYear().toString() === filterYear)
            .map(s => new Date(s.loadingDate).getMonth())
        )].sort((a,b) => a - b);
    }, [shipments, filterYear]);

    const handleSort = (key) => {
        let direction = 'desc'; // Default to Arrow Down (Arrival -> Departure)
        if (sortConfig.key === key && sortConfig.direction === 'desc') {
            direction = 'asc';
        }
        setSortConfig({ key, direction });
    };

    const finalFiltered = useMemo(() => {
        // Optimize: Calculate common values once
        const todayStr = getTodayString();
        const filterNameLower = routeFilter.toLowerCase();
        const filterCrewLower = crewFilter.toLowerCase();
        const filterIdLower = idFilter.toLowerCase();
        const isDelayedTab = activeTab === 'Delayed';
        const isLoadingFilter = delayTypeFilter === 'Loading';
        const isDeliveryFilter = delayTypeFilter === 'Delivery';

        return tabFiltered.filter(s => {
            // 1. Year/Month Filter (Skip for Active)
            if (activeTab !== 'Active') {
                // Optimize: Use string manipulation instead of new Date()
                const sYear = s.loadingDate ? String(s.loadingDate).substring(0, 4) : '';
                if (sYear !== filterYear) return false;
                
                if (filterMonth !== 'All') {
                    // Optimize: Parse month from string YYYY-MM
                    const sMonth = s.loadingDate ? parseInt(String(s.loadingDate).substring(5, 7)) - 1 : -1;
                    if (sMonth !== parseInt(filterMonth)) return false;
                }
            }

            // 2. Active Status Filter
            if (activeTab === 'Active' && statusFilter !== 'All') {
                const displayStatus = getDisplayStatus(s);
                if (displayStatus !== statusFilter) return false;
            }

            // 3. Delayed Type Filter (Optimized)
            if (isDelayedTab) {
                 const delayInfo = getDaysDelayed(s);
                 const isLoadingDelay = delayInfo.type === 'Loading';
                 
                 if (isLoadingFilter && !isLoadingDelay) return false;
                 if (isDeliveryFilter && isLoadingDelay) return false;
            }

            // 4. ID Filter
            if (idFilter && !String(s.shipmentID).toLowerCase().includes(filterIdLower)) return false;

            // 5. Route Filter
            if (routeFilter && (!s.destLocation || !s.destLocation.toLowerCase().includes(filterNameLower))) return false;
            
            // 6. Crew Filter
            if (crewFilter) {
                 if (!s.crewDetails) return false;
                 const names = s.crewDetails.split('|').map(c => c.split(':')[1]?.trim().toLowerCase());
                 if (!names.some(n => n && n.includes(filterCrewLower))) return false;
            }

            return true;
        });
    }, [tabFiltered, activeTab, filterYear, filterMonth, statusFilter, routeFilter, crewFilter, idFilter, delayTypeFilter]);

    const sortedShipments = useMemo(() => [...finalFiltered].sort((a, b) => {
        const { key, direction } = sortConfig;

        if (activeTab === 'Active') {
            const timeA = lastUpdateTimestamps[a.shipmentID] || 0;
            const timeB = lastUpdateTimestamps[b.shipmentID] || 0;
            if (timeA !== timeB) return timeB - timeA;
        }

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
    }), [finalFiltered, sortConfig, lastUpdateTimestamps, activeTab]);

    const getDisplayColor = (s) => {
        const dbStatus = s.currentStatus;

        if (dbStatus === 'Completed') return '#27AE60'; // Green
        if (dbStatus === 'Pending') return '#F2C94C'; // Orange/Yellow
        
        // IN TRANSIT: Blue
        if (dbStatus === 'Start Route' || dbStatus === 'Departure') {
            return '#2980b9';
        }

        // IN PROGRESS: Orange/Yellow
        return '#F2C94C'; 
    };

    const getTimelineNodeState = (phase, dbStatus, drops = [], currentDropIndex = 0) => {
        const isWarehousePhase = WAREHOUSE_PHASES.includes(phase);
        
        if (isWarehousePhase) {
            if (dbStatus === 'Completed') return 'completed';
            
            // Use full PHASE_ORDER for calculation
            const phases = PHASE_ORDER;
            const currentIndex = phases.indexOf(dbStatus); 
            const phaseIndex = phases.indexOf(phase);
            
            // Handle initial state
            if (dbStatus === 'Pending') { 
                // The first warehouse phase is 'Arrival at Warehouse'
                if (phase === 'Arrival at Warehouse') return 'active'; 
                return 'pending'; 
            }

            if (phaseIndex <= currentIndex) return 'completed'; 
            if (phaseIndex === currentIndex + 1) return 'active'; 
            return 'pending'; 
        } else {
            // Store phase
            const currentDropID = drops[currentDropIndex]?.dropID;
            
            // 1. Check if this specific phase/drop is in logs
            const hasLog = activeLogs.some(l => l.phaseName === phase && (Number(l.dropID) || null) === (Number(currentDropID) || null));
            if (hasLog) return 'completed';
            
            // 2. Check if it's active
            const storePhaseIdx = STORE_PHASES.indexOf(phase);
            const isWarehouseComplete = activeLogs.some(l => l.phaseName === 'Start Route');
            if (!isWarehouseComplete) return 'pending';
            
            if (storePhaseIdx === 0) {
                if (currentDropIndex === 0) return 'active';
                const prevDropID = drops[currentDropIndex - 1]?.dropID;
                const prevDropDeparted = activeLogs.some(l => l.phaseName === 'Departure' && (Number(l.dropID) || null) === (Number(prevDropID) || null));
                return prevDropDeparted ? 'active' : 'pending';
            }
            
            const prevPhase = STORE_PHASES[storePhaseIdx - 1];
            const prevDone = activeLogs.some(l => l.phaseName === prevPhase && (Number(l.dropID) || null) === (Number(currentDropID) || null));
            return prevDone ? 'active' : 'pending';
        }
    };
    const getPhaseMeta = (phase, drops = [], currentDropIndex = 0) => {
        const currentDropID = drops[currentDropIndex]?.dropID;
        const isWarehousePhase = WAREHOUSE_PHASES.includes(phase);
        
        const log = activeLogs.find(l => 
            l.phaseName === phase && 
            (isWarehousePhase ? !l.dropID : (Number(l.dropID) || null) === (Number(currentDropID) || null))
        );

        if (!log) return null;
        
        // Fix 8-hour UTC offset for Philippine Time (UTC+8)
        const d = new Date(log.timestamp);
        // If the timestamp doesn't have a timezone, it might be interpreted as local.
        // But if it's 8 hours behind, we need to add 8 hours.
        // We'll check if the string contains 'Z' or '+'. If not, we assume it's UTC from DB.
        const isUTC = typeof log.timestamp === 'string' && !log.timestamp.includes('Z') && !log.timestamp.includes('+');
        if (isUTC) {
            d.setHours(d.getHours() + 8);
        }

        return {
            time: d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            date: d.toLocaleDateString(),
            actorName: log.actorName || '',
            actorRole: log.actorRole || '',
            remarks: log.remarks || null
        };
    };

    const paginatedShipments = useMemo(() => sortedShipments.slice((currentPage - 1) * rowsPerPage, currentPage * rowsPerPage), [sortedShipments, currentPage]);

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
                            onClick={() => { 
                                setActiveTab(tab); 
                                setCurrentPage(1); 
                                setStatusFilter('All'); 
                                setDateFilter(''); 
                                setRouteFilter(''); 
                                setCrewFilter(''); 
                            }}
                        >
                            {tab}
                            <span className="tab-badge">{getCount(tab)}</span>
                        </div>
                    ))}
                    <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '15px', fontSize: '11px', fontWeight: '600', color: '#666', paddingBottom: '8px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: "13px" }}>
                            <span style={{ width: '10px', height: '10px', borderRadius: '50%', backgroundColor: '#c0392b' }}></span>
                            <span>Delayed</span>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: "13px" }}>
                            <span style={{ width: '10px', height: '10px', borderRadius: '50%', backgroundColor: '#2980b9' }}></span>
                            <span>In Transit</span>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: "13px" }}>
                            <span style={{ width: '10px', height: '10px', borderRadius: '50%', backgroundColor: '#F2C94C' }}></span>
                            <span>Pending</span>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: "13px"}}>
                            <span style={{ width: '10px', height: '10px', borderRadius: '50%', backgroundColor: '#27AE60' }}></span>
                            <span>Completed</span>
                        </div>
                    </div>
                </div>

                <div className="table-controls">
                    <div className="filters-left">
                        {activeTab === 'Active' && (
                            <div className="filter-group">
                                <label>Phase:</label>
                                <select value={statusFilter} onChange={(e) => { setStatusFilter(e.target.value); setCurrentPage(1); }} className="status-select">
                                    <option value="All">All Phases</option>
                                    <option value="Pending">To Load (Pending)</option>
                                    <option value="In Transit">In Transit (Loaded)</option>
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
                            
                            {activeTab === 'Delayed' && (
                                <>
                                    <div style={{display:'flex', flexDirection:'column'}}>
                                        <label style={{fontSize:'10px', fontWeight:'700', color:'#999', textTransform:'uppercase'}}>Type</label>
                                        <select 
                                            value={delayTypeFilter} 
                                            onChange={(e) => { setDelayTypeFilter(e.target.value); setCurrentPage(1); }}
                                            style={{border:'none', fontSize:'13px', outline:'none', background:'transparent', cursor:'pointer'}}
                                        >
                                            <option value="All">All Delays</option>
                                            <option value="Loading">Loading Delay</option>
                                            <option value="Delivery">Delivery Delay</option>
                                        </select>
                                    </div>
                                    <div style={{width:'1px', height:'25px', background:'#eee'}}></div>
                                </>
                            )}

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
                                  
                            </>
                        )}
                        <div style={{width:'1px', height:'35px', background:'#eee'}}></div>  
                        
                        <div className="filter-group">
                             <div style={{display:'flex', flexDirection:'column'}}>
                                <label style={{fontSize:'10px', fontWeight:'700', color:'#999', textTransform:'uppercase'}}>Shipment ID</label>
                                <input 
                                    type="text" 
                                    placeholder="Search ID"
                                    value={idFilter}
                                    onChange={(e) => { setIdFilter(e.target.value); setCurrentPage(1); }}
                                    style={{border:'none', borderBottom: '1px solid #eee', background: 'transparent', fontSize:'13px', width: '90px', outline: 'none'}}
                                />
                            </div>
                        </div>

                        <div className="filter-group">
                             <div style={{display:'flex', flexDirection:'column'}}>
                                <label style={{fontSize:'10px', fontWeight:'700', color:'#999', textTransform:'uppercase'}}>Route</label>
                                <input 
                                    type="text" 
                                    list={routeFilter.length > 0 ? "route-filter-list" : undefined}
                                    placeholder="All Routes"
                                    value={routeFilter}
                                    onChange={(e) => { setRouteFilter(e.target.value); setCurrentPage(1); }}
                                    style={{border:'none', borderBottom: '1px solid #eee', background: 'transparent', fontSize:'13px', width: '100px', outline: 'none'}}
                                />
                                <datalist id="route-filter-list">
                                    {tabRoutes.map(r => <option key={r} value={r} />)}
                                </datalist>
                            </div>
                        </div>

                        <div className="filter-group">
                             <div style={{display:'flex', flexDirection:'column'}}>
                                <label style={{fontSize:'10px', fontWeight:'700', color:'#999', textTransform:'uppercase'}}>Crew</label>
                                <input 
                                    type="text" 
                                    list={crewFilter.length > 0 ? "crew-filter-list" : undefined}
                                    placeholder="All Crew"
                                    value={crewFilter}
                                    onChange={(e) => { setCrewFilter(e.target.value); setCurrentPage(1); }}
                                    style={{border:'none', borderBottom: '1px solid #eee', background: 'transparent', fontSize:'13px', width: '100px', outline: 'none'}}
                                />
                                <datalist id="crew-filter-list">
                                    {tabCrew.map(c => <option key={c} value={c} />)}
                                </datalist>
                            </div>
                        </div>

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
                            const displayStatus = getDisplayStatus(s);
                            const displayColor = getDisplayColor(s);
                            const isFlashing = flashingIds.includes(s.shipmentID);
                            const isDelayedRow = activeTab === 'Delayed';
                            const delayInfo = isDelayedRow ? getDaysDelayed(s) : { days: 0, type: null };
                            const atRisk = activeTab === 'Active' && isAtRisk(s);

                            return (
                            <React.Fragment key={s.shipmentID}>
                                <tr className={isOpen ? 'row-active' : ''}>
                                    <td>{s.shipmentID}</td>
                                    <td className="status-cell-visible">
                                        <div className="status-cell-flex">
                                            <span className={`status-dot ${isFlashing ? 'flashing' : ''}`} style={{backgroundColor: isDelayedRow ? '#c0392b' : displayColor}}></span>
                                            {isDelayedRow ? (
                                                <div className="status-cell-delayed">
                                                    <div style={{display:'flex', flexDirection:'column'}}>
                                                        <span style={{color: '#c0392b', fontWeight: 'bold', fontSize: '13px'}}>Delayed (+{delayInfo.days}d)</span>
                                                        <span style={{fontSize: '10px', color: '#999', fontWeight: '700', textTransform: 'uppercase'}}>{delayInfo.type} Delay</span>
                                                    </div>
                                                    <span 
                                                        className="delay-reason-link" 
                                                        onClick={(e) => { e.stopPropagation(); updateDelayReason(s.shipmentID, s.delayReason); }}
                                                        title={s.delayReason ? "Edit Reason" : "Add Reason"}
                                                    >
                                                        {s.delayReason ? <Icons.Edit size={12} /> : <span style={{fontSize:'10px', textDecoration:'underline'}}>Reason</span>}
                                                    </span>
                                                </div>
                                            ) : (
                                                <>
                                                    {displayStatus}
                                                    {atRisk && (
                                                        <span className="tooltip-container" style={{marginLeft:'6px', marginTop:'6px', color:'#e67e22'}}>
                                                            <Icons.Clock size={14} />
                                                            <span className="tooltip-text">Due Today</span>
                                                        </span>
                                                    )}
                                                </>
                                            )}
                                        </div>
                                    </td>
                                    <td>
                                        {(() => {
                                            const rowDrops = s.dropDetails?.split('|').map((d, index) => {
                                                const [dropID, rest] = d.split(':');
                                                const match = rest ? rest.match(/^(.*) \((.*)\)$/) : null;
                                                return { 
                                                    dropID: parseInt(dropID), 
                                                    name: match ? match[1] : (rest || d),
                                                    location: match ? match[2] : '',
                                                    index 
                                                };
                                            }) || [];
                                            const isExpanded = expandedShipmentID === s.shipmentID;
                                            const currentName = (isExpanded && s.dropCount > 1) ? rowDrops[selectedDropIndex]?.name : s.destName;

                                            return (
                                                <div style={{display: 'flex', flexDirection: 'column'}}>
                                                    <span>{currentName}</span>
                                                    {s.dropCount > 1 && !isExpanded && (
                                                        <span style={{fontSize: '10px', color: '#7f8c8d', fontWeight: '600'}}>
                                                            +{s.dropCount - 1} more drops
                                                        </span>
                                                    )}
                                                    {isExpanded && s.dropCount > 1 && (
                                                        <span style={{fontSize: '10px', color: 'var(--primary-orange)', fontWeight: '700'}}>
                                                            Drop {selectedDropIndex + 1} of {s.dropCount}
                                                        </span>
                                                    )}
                                                </div>
                                            );
                                        })()}
                                    </td>
                                    <td>
                                        {(() => {
                                            const rowDrops = s.dropDetails?.split('|').map((d, index) => {
                                                const [dropID, rest] = d.split(':');
                                                const match = rest ? rest.match(/^(.*) \((.*)\)$/) : null;
                                                return { 
                                                    dropID: parseInt(dropID), 
                                                    name: match ? match[1] : (rest || d),
                                                    location: match ? match[2] : '',
                                                    index 
                                                };
                                            }) || [];
                                            const isExpanded = expandedShipmentID === s.shipmentID;
                                            return (isExpanded && s.dropCount > 1) ? rowDrops[selectedDropIndex]?.location : s.destLocation;
                                        })()}
                                    </td>
                                    <td style={{fontWeight:'600'}}>{formatDateDisplay(s.loadingDate)}</td>
                                    <td style={{ color: isDelayedRow ? '#c0392b' : 'black', fontWeight: isDelayedRow ? '700' : '400' }}>
                                        {formatDateDisplay(s.deliveryDate)}
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
                                {(isOpen || isClosing) && (() => {
                                    const rowDrops = s.dropDetails?.split('|').map((d, index) => {
                                        const [dropID, rest] = d.split(':');
                                        const match = rest ? rest.match(/^(.*) \((.*)\)$/) : null;
                                        return { 
                                            dropID: parseInt(dropID), 
                                            name: match ? match[1] : (rest || d),
                                            location: match ? match[2] : '',
                                            index 
                                        };
                                    }) || [];

                                    return (
                                    <tr className="expanded-row-container"><td colSpan="10">
                                        <div className={`timeline-wrapper ${isClosing ? 'closing' : ''}`}>
                                            <div className="timeline-inner-container">
                                                
                                                <div className="timeline-header-tabs">
                                                    <div className="phase-toggle-buttons">
                                                        <button 
                                                            className={`phase-toggle-btn ${phaseTab === 'warehouse' ? 'active' : ''}`}
                                                            onClick={() => setPhaseTab('warehouse')}
                                                            title="Warehouse"
                                                        >
                                                            Warehouse
                                                        </button>
                                                        <button 
                                                            className={`phase-toggle-btn ${phaseTab === 'store' ? 'active' : ''}`}
                                                            onClick={() => setPhaseTab('store')}
                                                            title="Store"
                                                        >
                                                            Store
                                                        </button>
                                                    </div>
                                                </div>
                                                {s.dropCount > 1 && (
                                                    <div className="drops-info-banner">
                                                        <div className="drop-banner-nav">
                                                            <button 
                                                                className="drop-nav-arrow"
                                                                disabled={selectedDropIndex === 0}
                                                                onClick={() => setSelectedDropIndex(prev => Math.max(0, prev - 1))}
                                                            >
                                                                ‹
                                                            </button>
                                                            
                                                            <div className="current-drop-display">
                                                                <span className="drop-display-label">Drop:</span>
                                                                <span className="drop-display-number">{selectedDropIndex + 1}</span>
                                                            </div>

                                                            <button 
                                                                className="drop-nav-arrow"
                                                                disabled={selectedDropIndex === rowDrops.length - 1}
                                                                onClick={() => setSelectedDropIndex(prev => Math.min(rowDrops.length - 1, prev + 1))}
                                                            >
                                                                ›
                                                            </button>
                                                        </div>
                                                        {phaseTab !== 'store' && (
                                                            <div className="switch-hint-overlay" onClick={() => setPhaseTab('store')}>
                                                                <span>Switch to <br></br>Store Phase</span>
                                                            </div>
                                                        )}
                                                    </div>
                                                )}
                                                <div className="timeline-content">
                                                {phaseTab === 'store' && !s.deliveryDate && (
                                                    <div className={`store-locked-overlay ${isClosing ? 'closing' : ''}`}>
                                                        <div className="lock-content">
                                                            <Icons.Lock size={24} />
                                                            <span>Pending Delivery Schedule</span>
                                                        </div>
                                                    </div>
                                                )}

                                                {phaseTab === 'store' && s.deliveryDate && (() => {
                                                    const startRouteIndex = PHASE_ORDER.indexOf('Start Route');
                                                    const currentStatusIndex = s.currentStatus === 'Completed' ? 999 : PHASE_ORDER.indexOf(s.currentStatus);
                                                    const isWarehouseComplete = currentStatusIndex >= startRouteIndex;
                                                    const isDeliveryReady = s.deliveryDate <= getTodayString();
                                                    
                                                    // Hide overlay if warehouse is done AND delivery date is today/past
                                                    if (isWarehouseComplete && isDeliveryReady) return null;

                                                    return (
                                                     <div className={`store-locked-overlay delivery-info-overlay ${isClosing ? 'closing' : ''}`}>
                                                         <div className="lock-content delivery-info-content">
                                                             <Icons.Lock size={17}/>
                                                             <span>Scheduled Delivery: {formatDateDisplay(s.deliveryDate)}</span>
                                                         </div>
                                                     </div>
                                                    );
                                                })()}
                                                
                                                {(phaseTab === 'warehouse' ? WAREHOUSE_PHASES : STORE_PHASES).map((phase, index, array) => {
                                                const state = getTimelineNodeState(phase, s.currentStatus, rowDrops, selectedDropIndex);
                                                const meta = getPhaseMeta(phase, rowDrops, selectedDropIndex);
                                                return (
                                                    <div key={phase} className={`timeline-step ${state}`}>
                                                        {index !== array.length - 1 && <div className="step-line"></div>}
                                                        <div className="step-dot"></div>
                                                        <div className="step-content-desc">
                                                            <div className="step-title" style={{display: 'flex', alignItems: 'center', justifyContent: 'center'}}>
                                                                {phase}
                                                                {meta?.remarks && (
                                                                    <div className="step-remark-container">
                                                                        <Icons.MessageSquare size={14} className="remark-icon" />
                                                                        <div className="remark-tooltip">
                                                                            {meta.remarks}
                                                                        </div>
                                                                    </div>
                                                                )}
                                                            </div>
                                                            {meta ? (
                                                                <>
                                                                    <div className="step-time">{meta.time}</div>
                                                                    <div className="step-sub">{meta.date}{meta.actorName ? ` · ${meta.actorRole}: ${meta.actorName}` : ''}</div>
                                                                </>
                                                            ) : (
                                                                <div className="step-status-text">{state === 'active' ? 'In Progress' : '-'}</div>
                                                            )}
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                                </div>
                                            </div>
                                        </div>
                                    </td></tr>
                                )})()}
                            </React.Fragment>
                        )}) : (<tr><td colSpan="10" className="empty-state">No shipments found in {activeTab}.</td></tr>)}
                    </tbody>
                </table>
            </div>
            
            {showModal && (
                <div className="modal-overlay-desktop">
                    <div className="modal-form-card">
                        
                        <div className="modal-header" style={{marginTop:0}}>
                            <h2>Create Shipment</h2>
                            <button className="close-btn" onClick={() => setShowModal(false)}>×</button>
                        </div>

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
                                    onClick={() => {
                                        setBatchIndex(prev => prev - 1);
                                        setDropIndex(0);
                                    }}
                                    title="Previous"
                                >
                                    ‹
                                </button>
                                <button 
                                    type="button" 
                                    className="nav-arrow-btn"
                                    disabled={batchIndex === batchData.length - 1}
                                    onClick={() => {
                                        setBatchIndex(prev => prev + 1);
                                        setDropIndex(0);
                                    }}
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
                                <div style={{flex: 1}}></div>
                            </div>

                            <div className="drops-section">
                                <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px'}}>
                                    <label style={{fontWeight: '700', fontSize: '13px', color: '#2c3e50', textTransform: 'uppercase', letterSpacing: '0.5px'}}>
                                        Destinations & Routes
                                    </label>
                                    <button type="button" className="add-another-btn" onClick={addDrop}>
                                        <Icons.Plus size={12}/> Add Drop
                                    </button>
                                </div>
                                <div style={{fontSize: '11px', color: '#7f8c8d', marginBottom: '12px', fontStyle: 'italic', display: 'flex', alignItems: 'center', gap: '4px'}}>
                                    <Icons.AlertCircle size={12} /> The order of drops determines the crew's delivery sequence (Drop 1 is the first stop).
                                </div>

                                <div className="drop-nav-row" style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px', background: '#fff', padding: '8px 12px', borderRadius: '6px', border: '1px solid #eef0f2'}}>
                                    <div style={{display: 'flex', alignItems: 'center', gap: '10px'}}>
                                        <span style={{fontSize: '11px', fontWeight: '700', color: '#34495e', background: '#ebf5fb', padding: '2px 8px', borderRadius: '4px'}}>
                                            {dropIndex === 0 ? 'First Drop' : dropIndex === currentForm.drops.length - 1 ? 'Last Drop' : `Drop ${dropIndex + 1}`} (Stop {dropIndex + 1} of {currentForm.drops.length})
                                        </span>
                                    </div>
                                    <div style={{display: 'flex', alignItems: 'center', gap: '5px'}}>
                                        <button 
                                            type="button" 
                                            className="nav-arrow-btn" 
                                            disabled={dropIndex === 0}
                                            onClick={() => setDropIndex(prev => prev - 1)}
                                            style={{width: '24px', height: '24px', fontSize: '14px'}}
                                        >
                                            ‹
                                        </button>
                                        <button 
                                            type="button" 
                                            className="nav-arrow-btn" 
                                            disabled={dropIndex === currentForm.drops.length - 1}
                                            onClick={() => setDropIndex(prev => prev + 1)}
                                            style={{width: '24px', height: '24px', fontSize: '14px'}}
                                        >
                                            ›
                                        </button>
                                        {currentForm.drops.length > 1 && (
                                            <button 
                                                type="button" 
                                                className="remove-item-btn" 
                                                onClick={() => removeDrop(dropIndex)}
                                                style={{fontSize: '11px', marginLeft: '5px'}}
                                            >
                                                Delete
                                            </button>
                                        )}
                                    </div>
                                </div>

                                {currentDrop && (
                                    <div style={{background: 'white', padding: '15px', borderRadius: '6px', border: '1px solid #eef0f2', position: 'relative'}}>
                                        <div style={{display: 'flex', gap: '15px'}}>
                                            <div className="form-group" style={{flex: 1, marginBottom: 0}}>
                                                <label style={{fontSize: '11px', color: '#666', marginBottom: '4px'}}>Store Name</label>
                                                <input 
                                                    type="text" 
                                                    value={currentDrop.destName} 
                                                    onChange={(e) => handleDropChange(dropIndex, 'destName', e.target.value)}
                                                    placeholder="e.g. Store 123"
                                                    required
                                                    style={{padding: '8px 12px', fontSize: '13px'}}
                                                />
                                            </div>
                                            <div className="form-group" style={{flex: 1, marginBottom: 0}}>
                                                <label style={{fontSize: '11px', color: '#666', marginBottom: '4px'}}>Route / Cluster</label>
                                                <input 
                                                    type="text" 
                                                    value={currentDrop.destLocation} 
                                                    onChange={(e) => handleDropChange(dropIndex, 'destLocation', e.target.value)}
                                                    list={currentDrop.destLocation && currentDrop.destLocation.trim().length > 0 ? "route-list" : undefined}
                                                    placeholder="Search Route..."
                                                    required
                                                    style={{padding: '8px 12px', fontSize: '13px'}}
                                                    autoComplete="off"
                                                />
                                            </div>
                                        </div>
                                    </div>
                                )}
                                
                                {currentDrop.destLocation && currentDrop.destLocation.trim().length > 0 && routeSuggestions.length > 0 && (
                                    <datalist id="route-list">
                                        {routeSuggestions.map((r, i) => <option key={i} value={r} />)}
                                    </datalist>
                                )}
                                 <p style={{fontSize: '10px', color: '#7f8c8d', marginTop: '10px', fontStyle: 'italic', marginBottom: 0}}>
                                     * The route of the first drop determines vehicle eligibility.
                                 </p>
                             </div>

                            <div className="form-row">
                                <div className="form-group">
                                    <label style={{color: isVehicleDisabled ? '#999' : 'black'}}>Vehicle Assignment</label>
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
                                        style={{fontFamily:"'Segoe UI', sans-serif"}}
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
                                        style={{ fontFamily:"'Segoe UI', sans-serif", backgroundColor: !currentForm.loadingDate ? '#f9f9f9' : 'white', cursor: !currentForm.loadingDate ? 'not-allowed' : 'pointer'}}
                                    />
                                </div>                           
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
            {/* Z-Index Fix: Render Export Modal BEFORE No Data Modal or increase z-index of No Data Modal */}
            {showExportModal && (
                <div className="modal-overlay-desktop" style={{zIndex: 999}}>
                    <div className="modal-form-card" style={{width: '500px'}}>
                        <div className="modal-header">
                            <h2>Extract Data</h2>
                            <button className="close-btn" onClick={() => setShowExportModal(false)}>×</button>
                        </div>
                        
                        <div className="export-modal-body">
                            <div className="form-row" style={{marginBottom: '20px'}}>
                                <div className="form-group">
                                    <label>Start</label>
                                    <input 
                                        type="date" 
                                        className="date-input" 
                                        value={dateRange.start} 
                                        onChange={e => {
                                            const newStart = e.target.value;
                                            setDateRange(prev => ({
                                                ...prev, 
                                                start: newStart,

                                                end: (prev.end && prev.end < newStart) ? newStart : prev.end
                                            }));
                                        }} 
                                    />
                                </div>
                                <div className="form-group">
                                    <label style={{color: !dateRange.start ? '#ccc' : 'inherit'}}>End</label>
                                    <input 
                                        type="date" 
                                        className="date-input" 
                                        value={dateRange.end} 
                                        min={dateRange.start} 
                                        disabled={!dateRange.start} 
                                        style={{
                                            cursor: !dateRange.start ? 'not-allowed' : 'pointer',
                                            backgroundColor: !dateRange.start ? '#f5f5f5' : 'white',
                                            color: !dateRange.start ? '#aaa' : 'inherit'
                                        }}
                                        onChange={e => setDateRange({...dateRange, end: e.target.value})} 
                                    />
                                </div>
                            </div>

                            <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'5px'}}>
                                <label className="export-options-label" style={{marginBottom:0}}>Select & Arrange Columns (Drag to Reorder)</label>
                                <button className="text-link-btn" onClick={handleSelectAllColumns} style={{fontSize:'11px', color:'#43B2DA', background:'none', border:'none', cursor:'pointer'}}>
                                    {columnConfig.every(col => col.checked) ? 'Deselect All' : 'Select All'}
                                </button>
                            </div>
                            
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
            
            {/* Z-Index Fix: No Data Modal should be ON TOP of Export Modal */}
            {showNoDataModal && (
                <div className="modal-overlay-desktop" style={{zIndex: 9000}}>
                    <div className="modal-form-card small-modal" style={{textAlign: 'center', padding: '40px 30px'}}>
                        <h3 style={{margin: '0 0 10px 0'}}>No Shipments Found</h3>
                        <p style={{marginBottom: '20px', color: '#666', fontSize: '14px'}}>
                           No data available for the selected period ({formatDateDisplay(dateRange.start)} - {formatDateDisplay(dateRange.end)}).
                        </p>
                        <button className="btn-alert-shipment" onClick={() => setShowNoDataModal(false)} style={{width: '100%'}}>Okay</button>
                    </div>
                </div>
            )}

            {/* --- DELAY REASON MODAL --- */}
            {showDelayReasonModal && (
                <div className="modal-backdrop">
                    <div className="modal-card">
                        <div className="modal-icon warning-icon">
                            <Icons.Warning />
                        </div>
                        <h3>Update Delay Reason</h3>
                        <p className="modal-message">Why is this shipment delayed?</p>
                        <p className="modal-sub-text">This will be visible in the Delayed tab.</p>
                        
                        <form onSubmit={handleDelayReasonSubmit} style={{width:'100%', marginTop:'20px'}}>
                            <input 
                                type="text" 
                                value={delayReasonData.reason}
                                onChange={(e) => setDelayReasonData({...delayReasonData, reason: e.target.value})}
                                placeholder="e.g., Truck Breakdown, Weather, Port Congestion..."
                                style={{
                                    width: '100%', padding: '12px', borderRadius: '8px', 
                                    border: '1px solid #ddd', fontSize: '14px', marginBottom: '20px',
                                    outline: 'none', background: '#FAFAFA'
                                }}
                                autoFocus
                            />
                            <div className="modal-actions">
                                <button type="button" className="btn-secondary" onClick={() => setShowDelayReasonModal(false)}>Cancel</button>
                                <button type="submit" className="btn-warning">Save Reason</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
            {feedbackModal && <FeedbackModal {...feedbackModal} onClose={() => setFeedbackModal(null)} />}
        </div>
    );
}

export default ShipmentView;
