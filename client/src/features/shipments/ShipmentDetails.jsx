import { useState, useEffect, useCallback, useRef, memo, useMemo } from 'react';
import api from '@utils/api';
import { Icons, FeedbackModal } from '@shared';
import { queueManager } from '@utils/queueManager';
import { getTodayString, getDateValue, formatDateDisplay, STORE_PHASES, WAREHOUSE_PHASES } from '@constants';

const ALL_STEPS = [
  // Warehouse steps
  { label: 'Warehouse Arrival', dbStatus: 'Arrival at Warehouse', icon: <Icons.Clock /> },
  { label: 'Start Loading', dbStatus: 'Start Loading', icon: <Icons.Package /> },
  { label: 'End Loading', dbStatus: 'End Loading', icon: <Icons.PackageCheck /> },
  { label: 'Document Released', dbStatus: 'Document Released', icon: <Icons.FileText /> },
  { label: 'Start Route', dbStatus: 'Start Route', icon: <Icons.Send /> },
  // Store steps
  { label: 'Arrival Time', dbStatus: 'Arrival', icon: <Icons.Clock /> },
  { label: 'Handover Invoice', dbStatus: 'Handover Invoice', icon: <Icons.FileText /> },
  { label: 'Start Unload', dbStatus: 'Start Unload', icon: <Icons.Package /> },
  { label: 'Finish Unload', dbStatus: 'Finish Unload', icon: <Icons.PackageCheck /> },
  { label: 'Invoice Receive', dbStatus: 'Invoice Receive', icon: <Icons.Clipboard /> },
  { label: 'Departure', dbStatus: 'Departure', icon: <Icons.Send /> }
];

const getStatusPriority = (status) => {
    if (status === 'Completed') return 100;
    const index = ALL_STEPS.findIndex(s => s.dbStatus === status);
    return index === -1 ? 0 : index + 1;
};

const getPendingOfflineData = (shipmentID) => {
  try {
    const queueStr = localStorage.getItem('offline_shipment_queue') || localStorage.getItem('offlineQueue');
    if (!queueStr) return null;

    const queue = JSON.parse(queueStr);
    const myActions = queue.filter(item => 
      item.type === 'UPDATE_STATUS' && 
      String(item.shipmentID) === String(shipmentID)
    );

    if (myActions.length === 0) return null;

    const lastAction = myActions[myActions.length - 1];
    const pendingLogs = myActions.map(action => ({
      phaseName: action.status,
      timestamp: action.timestamp || new Date().toISOString(),
      isPending: true,
      dropID: action.dropID
    }));

    return { 
      status: lastAction.status === 'Completed' ? 'Completed' : lastAction.status,
      logs: pendingLogs 
    };
  } catch (e) {
    console.error("Error reading offline queue", e);
    return null;
  }
};

const ShipmentDetails = memo(({ shipment, onBack, token, user }) => { 
  const [showOverlay, setShowOverlay] = useState(true);
  const [phaseTab, setPhaseTab] = useState('warehouse'); 
  const [confirmStep, setConfirmStep] = useState(null);
  const [isOffline, setIsOffline] = useState(!navigator.onLine);
  const [offlineVisible, setOfflineVisible] = useState(!navigator.onLine);
  const containerRef = useRef(null);
  const touchStartRef = useRef(null);

  // Multi-drop support
  const [selectedDropIndex, setSelectedDropIndex] = useState(0);
  const drops = useMemo(() => {
     if (!shipment.dropDetails) return [];
     return shipment.dropDetails.split('|').map((d, index) => {
       const [dropID, rest] = d.split(':');
       const match = rest ? rest.match(/^(.*) \((.*)\)$/) : null;
       return {
         dropID: parseInt(dropID),
         name: match ? match[1] : (rest || d),
         location: match ? match[2] : '',
         index
       };
     });
   }, [shipment.dropDetails]);

  // Remarks State
  const [stepRemarks, setStepRemarks] = useState({});
  const [remarksModal, setRemarksModal] = useState({ show: false, step: null, text: '' });

  // Initialize status/logs once, but update if parent prop changes significantly
  const [localStatus, setLocalStatus] = useState(() => {
    const offlineData = getPendingOfflineData(shipment.shipmentID);
    return offlineData ? offlineData.status : shipment.currentStatus;
  });

  const [logs, setLogs] = useState(() => {
    const offlineData = getPendingOfflineData(shipment.shipmentID);
    return offlineData ? offlineData.logs : [];
  });

  // Keep localStatus in sync with shipment.currentStatus ONLY if it represents a forward progression
  useEffect(() => {
    const offlineData = getPendingOfflineData(shipment.shipmentID);
    if (offlineData) return; // Don't sync if we have local pending changes

    const serverPriority = getStatusPriority(shipment.currentStatus);
    const localPriority = getStatusPriority(localStatus);
    
    if (serverPriority > localPriority) {
      setLocalStatus(shipment.currentStatus);
    }
  }, [shipment.currentStatus, shipment.shipmentID]);

  const partnerName = (() => {
    if (!shipment.crewDetails || !user) return null;
    const parts = shipment.crewDetails.split('|');
    let targetRole = '';
    if (user.role === 'Driver') targetRole = 'Helper';
    else if (user.role === 'Helper') targetRole = 'Driver';
    else return null;
    
    const found = parts.find(p => p.startsWith(targetRole + ':'));
    return found ? found.split(':')[1] : null;
  })();

  const fetchLogs = useCallback(async () => {
    if (!navigator.onLine) return; 

    try {
        const config = token ? { headers: { Authorization: `Bearer ${token}` } } : {};
        const url = `/shipments/${shipment.shipmentID}/logs?_t=${new Date().getTime()}`;
        const res = await api.get(url, config);
        const serverLogs = res.data;

        setLogs(prev => {
            const pendingLogs = prev.filter(l => l.isPending);
            const distinctPending = pendingLogs.filter(p => 
              !serverLogs.some(s => s.phaseName === p.phaseName && (Number(s.dropID) || null) === (Number(p.dropID) || null))
            );
            const nextLogs = [...serverLogs, ...distinctPending];
            
            // Optimization: Only update if the data actually changed to prevent re-render "blinks"
            if (JSON.stringify(prev) === JSON.stringify(nextLogs)) return prev;
            return nextLogs;
        });

        if (serverLogs.length > 0) {
            // The logs are ordered by timestamp DESC from server
            const lastLog = serverLogs[0]; 
            
            // For multi-drop, Departure only means Completed if it's the last drop
            const isLastDropDeparture = lastLog.phaseName === 'Departure' && 
                                        drops.length > 0 && 
                                        (Number(lastLog.dropID) === drops[drops.length - 1].dropID);

            const newStatus = isLastDropDeparture || lastLog.phaseName === 'Completed' 
                ? 'Completed' 
                : lastLog.phaseName;

            setLocalStatus(current => {
                const currentPri = getStatusPriority(current);
                const newPri = getStatusPriority(newStatus);
                const targetStatus = newPri >= currentPri ? newStatus : current;
                
                // Optimization: Only update if status actually changed
                if (current === targetStatus) return current;
                return targetStatus;
            });
        }
    } catch (err) { console.error("Error fetching logs:", err); }
  }, [shipment.shipmentID, token, drops]);

  useEffect(() => {
    const handleOnline = () => { 
        setIsOffline(false); 
        queueManager.process(); 
        setTimeout(fetchLogs, 1000); 
    };
    const handleOffline = () => {
        setOfflineVisible(true);
        setIsOffline(true);
    };
    
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    
    return () => {
        window.removeEventListener('online', handleOnline);
        window.removeEventListener('offline', handleOffline);
    };
  }, [fetchLogs]);

  useEffect(() => {
    if (isOffline) {
      setOfflineVisible(true);
      const t = setTimeout(() => setOfflineVisible(false), 3500);
      return () => clearTimeout(t);
    } else {
      setOfflineVisible(false);
    }
  }, [isOffline]);

  useEffect(() => {
    if (isOffline) return;
    fetchLogs(); 
    const intervalId = setInterval(fetchLogs, 5000); // Increased interval to reduce traffic
    return () => clearInterval(intervalId);
  }, [isOffline, fetchLogs]);

  const handleTouchStart = (e) => {
    if (!e.touches || e.touches.length === 0) return;
    const t = e.touches[0];
    if (t.clientX <= 24) {
      touchStartRef.current = { x: t.clientX, y: t.clientY };
    } else {
      touchStartRef.current = null;
    }
  };

  const handleTouchMove = (e) => {
    if (!touchStartRef.current || !e.touches || e.touches.length === 0) return;
    const t = e.touches[0];
    const dx = t.clientX - touchStartRef.current.x;
    const dy = Math.abs(t.clientY - touchStartRef.current.y);
    if (dx > 60 && dy < 30) {
      touchStartRef.current = null;
      onBack && onBack();
    }
  };

  const executeStepUpdate = (dbStatus) => {
      const isFinishing = dbStatus === 'Departure' && selectedDropIndex === drops.length - 1;
      const finalStatus = isFinishing ? 'Completed' : dbStatus;
      const now = Date.now(); 
      const currentDropID = phaseTab === 'store' && drops[selectedDropIndex] ? drops[selectedDropIndex].dropID : null;

      setLocalStatus(finalStatus);

      const newLog = { 
        phaseName: dbStatus, 
        timestamp: now, 
        isPending: true,
        dropID: currentDropID 
      };
      
      setLogs(prevLogs => {
          if (prevLogs.some(l => l.phaseName === dbStatus && (Number(l.dropID) || null) === (Number(currentDropID) || null))) return prevLogs;
          const updated = [...prevLogs, newLog];
          if (isFinishing) {
             updated.push({ phaseName: 'Completed', timestamp: now, isPending: true });
          }
          return updated;
      });

      queueManager.add({
          type: 'UPDATE_STATUS',
          shipmentID: shipment.shipmentID,
          status: dbStatus,
          timestamp: now,
          userID: user?.userID || 1,
          remarks: stepRemarks[dbStatus] || null,
          dropID: currentDropID
      });

      if (isFinishing) {
          queueManager.add({
              type: 'UPDATE_STATUS',
              shipmentID: shipment.shipmentID,
              status: 'Completed',
              timestamp: now,
              userID: user?.userID || 1
          });
      }

      if (navigator.onLine) {
          queueManager.process();
          setTimeout(fetchLogs, 1000);
      }
      
      setConfirmStep(null);
  };

  const handleStepClick = (step) => {
      setConfirmStep(step);
  };

  const handleOpenRemarks = (step) => {
    setRemarksModal({
      show: true,
      step: step,
      text: stepRemarks[step.dbStatus] || ''
    });
  };

  const handleSaveRemark = () => {
    setStepRemarks(prev => ({
      ...prev,
      [remarksModal.step.dbStatus]: remarksModal.text
    }));
    setRemarksModal({ show: false, step: null, text: '' });
  };

  const getStepTimestamp = (dbStatus) => {
    if (!logs || logs.length === 0) return null;
    
    const currentDropID = phaseTab === 'store' && drops[selectedDropIndex] ? drops[selectedDropIndex].dropID : null;
    
    const log = logs.find(l => 
      (l.phaseName === dbStatus || l.phase === dbStatus || l.newStatus === dbStatus) &&
      (phaseTab === 'warehouse' ? !l.dropID : (Number(l.dropID) || null) === (Number(currentDropID) || null))
    );

    if (log) {
      const date = new Date(log.timestamp);
      
      // Fix 8-hour UTC offset for Philippine Time (UTC+8)
      const isUTC = typeof log.timestamp === 'string' && !log.timestamp.includes('Z') && !log.timestamp.includes('+');
      if (isUTC) {
          date.setHours(date.getHours() + 8);
      }

      return {
        text: `${date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} • ${date.toLocaleDateString()}`,
        isPending: !!log.isPending
      };
    }
    return null;
  };

  const getStepState = (currentDbStatus, stepIndex, currentTab) => {
    const currentDropID = currentTab === 'store' && drops[selectedDropIndex] ? drops[selectedDropIndex].dropID : null;
    const phaseName = (currentTab === 'warehouse' ? WAREHOUSE_PHASES : STORE_PHASES)[stepIndex];

    // 1. Is it done? (Log exists for this specific drop/step)
    const hasLog = logs.some(l => 
      l.phaseName === phaseName && 
      (currentTab === 'warehouse' ? !l.dropID : (Number(l.dropID) || null) === (Number(currentDropID) || null))
    );
    if (hasLog) return 'done';

    // 2. Is it active? (Previous step is done)
    if (currentTab === 'warehouse') {
      if (stepIndex === 0) return 'active'; // First warehouse step always active if not done
      const prevPhase = WAREHOUSE_PHASES[stepIndex - 1];
      const prevDone = logs.some(l => l.phaseName === prevPhase && !l.dropID);
      return prevDone ? 'active' : 'pending';
    } else {
      // Store phase
      const isWarehouseComplete = logs.some(l => l.phaseName === 'Start Route');
      if (!isWarehouseComplete) return 'pending';

      if (stepIndex === 0) {
        // First store step active if it's the first drop, OR if the previous drop is departed
        if (selectedDropIndex === 0) return 'active';
        const prevDropID = drops[selectedDropIndex - 1]?.dropID;
        const prevDropDeparted = logs.some(l => l.phaseName === 'Departure' && (Number(l.dropID) || null) === (Number(prevDropID) || null));
        return prevDropDeparted ? 'active' : 'pending';
      }

      const prevPhase = STORE_PHASES[stepIndex - 1];
      const prevDone = logs.some(l => l.phaseName === prevPhase && (Number(l.dropID) || null) === (Number(currentDropID) || null));
      return prevDone ? 'active' : 'pending';
    }
  };

  const isCompleted = localStatus === 'Completed';
  const today = getTodayString();
  const deliveryDate = getDateValue(shipment.deliveryDate);
  const loadingDate = getDateValue(shipment.loadingDate);
  
  // Explicitly In Transit if we have started the route but not yet arrived at store
  const isInTransit = localStatus === 'Start Route' || 
                      (WAREHOUSE_PHASES.includes(localStatus) && localStatus !== 'Pending' && localStatus !== 'Arrival at Warehouse' && deliveryDate > today);
  
  // Block steps if not yet the correct date
  const isBlockedByDate = (priority) => {
    // Warehouse steps (priority 1-5 now that Loaded is removed)
    if (priority <= 5) {
      return today < loadingDate;
    }
    // Store steps (priority 6+)
    return today < deliveryDate;
  };

  // FIX: Force re-render/unlock when localStatus changes to 'Start Route' or higher
  // Ensure that if status >= Start Route (priority 5), the store tab logic respects it
  const currentPriority = getStatusPriority(localStatus);
  const startRoutePriority = getStatusPriority('Start Route');
  const isWarehouseComplete = currentPriority >= startRoutePriority;

  const canConfirmLoad = today >= loadingDate;

  return (
    <div className="details-container" ref={containerRef} onTouchStart={handleTouchStart} onTouchMove={handleTouchMove}>
      <div className="notification-spacer">
        {isOffline && offlineVisible && (
          <div className="offline-banner">
             You are Offline. Changes will save automatically when online.
          </div>
        )}
      </div>
      <div style={{display:'flex', justifyContent: 'space-between', margin: '12px 20px', alignItems: 'center'}}>
        <div className="back-btn-mob" onClick={onBack}>
          <Icons.ArrowLeft />
        </div>
      
      {isOffline && !offlineVisible && (
        <div className="offline-chip">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="9"></circle>
            <line x1="12" y1="8" x2="12" y2="12"></line>
            <line x1="12" y1="16" x2="12.01" y2="16"></line>
          </svg>
          <span>Offline</span>
        </div>
        )}
      </div>
      
      
      

      <div className="info-card-mob">
        <div className="info-card-mob-grid">
          <div className="info-item item-id">
            <div className="info-icon-box">
              <Icons.Truck size={18} />
            </div>
            <div className="info-content">
              <span className="info-label">Shipment ID</span>
              <span className="info-value">#{shipment.shipmentID}</span>
            </div>
          </div>

          {partnerName && (
            <div className="info-item item-partner">
              <div className="info-icon-box">
                <Icons.Truck size={18} />
              </div>
              <div className="info-content">
                <span className="info-label">Truck Plate</span>
                <span className="info-value" style={{fontWeight: 400}}>{shipment.plateNo || 'N/A'}</span>
              </div>
            </div>
          )}

          <div className="info-item item-dest"> 
            <div className="info-icon-box">
               <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M20 9v11a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V9"></path>
                  <path d="M9 22V12h6v10M2 10.6L12 2l10 8.6"></path>
               </svg>
            </div>
            <div className="info-content">
               <span className="info-label">Store</span>
               <span className="info-value">
                 {drops.length > 0 ? drops[selectedDropIndex].name : (shipment.destName || 'N/A')}
               </span>
            </div>
          </div>

          <div className="info-item item-addr">
              <div className="info-icon-box">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path>
                    <circle cx="12" cy="10" r="3"></circle>
                </svg>
              </div>
              <div className="info-content">
                <span className="info-label">Location</span>
                <span className="info-value">
                  {drops.length > 0 ? drops[selectedDropIndex].location : (shipment.destLocation || 'N/A')}
                </span>
              </div>
            </div>

            <div className="info-item item-load">
              <div className="info-icon-box">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
                    <line x1="16" y1="2" x2="16" y2="6"></line>
                    <line x1="8" y1="2" x2="8" y2="6"></line>
                    <line x1="3" y1="10" x2="21" y2="10"></line>
                </svg>
              </div>
              <div className="info-content">
                <span className="info-label">Loading Date</span>
                <span className="info-value" style={{color:'#2980b9', fontWeight: 700}}>{formatDateDisplay(shipment.loadingDate)}</span>
              </div>
            </div>

            <div className="info-item item-del">
              <div className="info-icon-box">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"></path>
                    <line x1="4" y1="22" x2="4" y2="15"></line>
                </svg>
              </div>
              <div className="info-content">
                <span className="info-label">Delivery Date</span>
                <span className="info-value" style={{color:'#d35400', fontWeight: 700}}>{formatDateDisplay(shipment.deliveryDate)}</span>
              </div>
            </div>
        </div>
      </div>

      <div className="steps-header-mob">
        {phaseTab === 'store' && drops.length > 1 ? (
          <div className="drop-selector-mob-header">
            <div className="drop-nav-mob">
              <button 
                className="drop-nav-arrow-mob"
                disabled={selectedDropIndex === 0}
                onClick={() => setSelectedDropIndex(prev => Math.max(0, prev - 1))}
              >
                ‹
              </button>
              
              <div className="drop-current-mob">
                <span className="drop-display-label-mob">Drop:</span>
                <span className="drop-display-number-mob">{selectedDropIndex + 1}</span>
              </div>

              <button 
                className="drop-nav-arrow-mob"
                disabled={selectedDropIndex === drops.length - 1}
                onClick={() => setSelectedDropIndex(prev => Math.min(drops.length - 1, prev + 1))}
              >
                ›
              </button>
            </div>
          </div>
        ) : null}
        <div className="phase-toggle-mob" style={{marginLeft:"auto"}}>
          <button 
            className={`phase-toggle-btn-mob ${phaseTab === 'warehouse' ? 'active' : ''}`}
            onClick={() => setPhaseTab('warehouse')}
          >
            Warehouse
          </button>
          <button 
            className={`phase-toggle-btn-mob ${phaseTab === 'store' ? 'active' : ''}`}
            onClick={() => setPhaseTab('store')}
          >
            Store
          </button>
        </div>
      </div>

      {/* Removed the separate drop-selector-mob div as it's now integrated in the header */}

      <div className={`steps-wrapper ${isOffline && offlineVisible ? 'with-snackbar' : ''}`} style={{ position: 'relative' }}>
        {isCompleted && showOverlay && (
          <div className="completion-overlay" onClick={() => setShowOverlay(false)}>
            <div className="lockout-badge">
              <div className="lockout-icon"><Icons.CheckCircle size={40} stroke="#27ae60" /></div>
              <span style={{ color: '#27ae60' }}>SHIPMENT COMPLETED</span>
            </div>
          </div>
        )}

        <div className={`steps-container ${isCompleted && showOverlay ? 'blurred-background' : ''}`}>
          {phaseTab === 'store' && !isWarehouseComplete && (
            <div className="completion-overlay" onClick={() => setShowOverlay(false)}>
              <div className="blocked-content">
              <Icons.Lock size={32} />
                <h3>Store Phases Locked</h3>
                <p>Complete warehouse loading phases first.</p>
                <div className="blocked-date">
                  Available on: <strong>{formatDateDisplay(shipment.deliveryDate)}</strong>
                </div>
            </div>
          </div>
          )}
          
          {(phaseTab === 'warehouse' ? WAREHOUSE_PHASES : STORE_PHASES).map((phaseName, index) => {
            const step = ALL_STEPS.find(s => s.dbStatus === phaseName);
            const dbStatus = step.dbStatus;
            
            const state = getStepState(localStatus, index, phaseTab);

            const timeData = getStepTimestamp(dbStatus);
            const stepPriority = getStatusPriority(dbStatus);
            const isBlocked = state === 'active' && isBlockedByDate(stepPriority);

            return (
              <button
                key={dbStatus}
                className={`step-button step-${state} ${isBlocked ? 'disabled-transit' : ''}`}
                disabled={state !== 'active' || isCompleted || isBlocked} 
                onClick={() => handleStepClick(step)} 
                style={{position: 'relative'}} // Ensure relative positioning for absolute children
              >
                {/* Remarks Button - Only for Store Phases */}
                {phaseTab === 'store' && (
                    <div 
                        className="remarks-icon-btn"
                        onClick={(e) => {
                            e.stopPropagation(); // Prevent triggering the main button click
                            handleOpenRemarks(step);
                        }}
                        style={{
                            color: stepRemarks[dbStatus] ? 'var(--primary-orange)' : undefined, // Highlight if remark exists
                            background: stepRemarks[dbStatus] ? 'white' : undefined,
                            boxShadow: stepRemarks[dbStatus] ? '0 2px 4px rgba(0,0,0,0.1)' : undefined
                        }}
                    >
                        <Icons.MessageSquare size={16} />
                    </div>
                )}

                <div className="step-content">
                  <span className="step-icon">{step.icon}</span>
                  <div className="step-text-group">
                      <span className="step-label">{step.label}</span>
                      
                      <span className="step-timestamp">
                        {state === 'done' ? (
                          <>
                            {timeData ? (
                              <>
                                Completed: {timeData.text} 
                                {timeData.isPending && <span style={{color: 'orange', marginLeft: '5px'}}>(Saving...)</span>}
                              </>
                            ) : (
                               "Completed"
                            )}
                          </>
                        ) : state === 'active' && isBlocked ? (
                           <span className="blocked-hint" style={{fontSize: '11px', color: '#e67e22'}}>
                             Available on {formatDateDisplay(shipment.deliveryDate)}
                           </span>
                        ) : (
                          "\u00A0" 
                        )}
                      </span>
                  </div>
                </div>

                <div className="step-status-icon">
                  {state === 'done' && <Icons.Check />}
                  {state === 'active' && <Icons.Hourglass />}
                  {state === 'pending' && <Icons.Minus />}
                </div>
              </button>
            );
          })}
        </div>
      </div>
      
      {/* Remarks Modal */}
      {remarksModal.show && (
        <div className="modal-backdrop" style={{ zIndex: 9000 }}>
          <div className="modal-card" style={{margin:"0 25px"}}onClick={(e) => e.stopPropagation()}>
            <div style={{display:"flex", alignItems:"center", justifyContent:"space-between"}}>
            <h3 style={{margin:0}}>Add Remarks</h3>
            <p className="modal-sub-text" style={{margin:0}}>{remarksModal.step?.label}</p>
          </div>
            <textarea
              className="remarks-textarea"
              placeholder="Type issues or events here..."
              value={remarksModal.text}
              onChange={(e) => setRemarksModal(prev => ({ ...prev, text: e.target.value }))}
              style={{marginBottom:0}}
            />
            <div className="modal-actions">
              <button
                className="btn-secondary"
                onClick={() => setRemarksModal({ show: false, step: null, text: '' })}
              >
                Cancel
              </button>
              <button className="btn-primary" onClick={handleSaveRemark}>
                Save
              </button>
            </div>
          </div>
        </div>
      )}

      {confirmStep && (
        <FeedbackModal 
          type="warning"
          title="Confirm Status Update"
          message={`Are you sure you want to mark "${confirmStep.label}" as completed?`}
          subMessage="This will update the shipment progress."
          confirmLabel="Confirm"
          onClose={() => setConfirmStep(null)}
          onConfirm={() => executeStepUpdate(confirmStep.dbStatus)}
        />
      )}
    </div>
  );
});

export default ShipmentDetails;
