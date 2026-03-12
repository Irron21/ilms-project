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

const LOG_CACHE_PREFIX = 'shipment_logs_';

const getCachedLogs = (shipmentID) => {
  try {
    const raw = localStorage.getItem(LOG_CACHE_PREFIX + String(shipmentID));
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (e) {
    console.error('Error reading cached logs', e);
    return [];
  }
};

const setCachedLogs = (shipmentID, logs) => {
  try {
    localStorage.setItem(LOG_CACHE_PREFIX + String(shipmentID), JSON.stringify(logs || []));
  } catch (e) {
    console.error('Error writing cached logs', e);
  }
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

const deriveStatusFromLogs = (logs, drops) => {
  if (!logs || logs.length === 0) return null;
  const sorted = [...logs].sort((a, b) => {
    const ta = new Date(a.timestamp).getTime();
    const tb = new Date(b.timestamp).getTime();
    return tb - ta;
  });
  const lastLog = sorted[0];
  const isLastDropDeparture =
    lastLog.phaseName === 'Departure' &&
    drops &&
    drops.length > 0 &&
    (Number(lastLog.dropID) === drops[drops.length - 1].dropID);
  if (isLastDropDeparture || lastLog.phaseName === 'Completed') return 'Completed';
  return lastLog.phaseName;
};

const ShipmentDetails = memo(({ shipment, onBack, token, user }) => { 
  const [showOverlay, setShowOverlay] = useState(true);
  const [phaseTab, setPhaseTab] = useState('warehouse'); 
  const [completionPrompt, setCompletionPrompt] = useState(null);
  const [isOffline, setIsOffline] = useState(!navigator.onLine);
  const [offlineVisible, setOfflineVisible] = useState(!navigator.onLine);
  
  // Grace Period State
  const [pendingUpdate, setPendingUpdate] = useState(null); // { step, timeLeft }
  const timerRef = useRef(null);

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

  const initialCachedLogs = useMemo(
    () => getCachedLogs(shipment.shipmentID),
    [shipment.shipmentID]
  );
  const initialOfflineData = useMemo(
    () => getPendingOfflineData(shipment.shipmentID),
    [shipment.shipmentID]
  );

  const [localStatus, setLocalStatus] = useState(() => {
    const fromLogs = deriveStatusFromLogs(initialCachedLogs, []);
    let baseStatus = fromLogs || shipment.currentStatus;
    if (initialOfflineData) {
      const offlinePri = getStatusPriority(initialOfflineData.status);
      const basePri = getStatusPriority(baseStatus);
      if (offlinePri >= basePri) baseStatus = initialOfflineData.status;
    }
    return baseStatus;
  });

  const [logs, setLogs] = useState(() => {
    const offlineLogs = initialOfflineData ? initialOfflineData.logs : [];
    const distinctPending = offlineLogs.filter(p => 
      !initialCachedLogs.some(s => 
        s.phaseName === p.phaseName &&
        (Number(s.dropID) || null) === (Number(p.dropID) || null)
      )
    );
    return [...initialCachedLogs, ...distinctPending];
  });

  useEffect(() => {
    const serverPriority = getStatusPriority(shipment.currentStatus);
    const localPriority = getStatusPriority(localStatus);
    if (serverPriority > localPriority) {
      setLocalStatus(shipment.currentStatus);
    }
  }, [shipment.currentStatus, shipment.shipmentID, localStatus]);

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

        setCachedLogs(shipment.shipmentID, serverLogs);

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
            const newStatus = deriveStatusFromLogs(serverLogs, drops);
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

  const executeStepUpdate = useCallback((dbStatus) => {
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
      
      // --- PHASE COMPLETION PROMPTS ---
      const isWarehousePhase = WAREHOUSE_PHASES.includes(dbStatus);
      const isStorePhase = STORE_PHASES.includes(dbStatus);

      if (isWarehousePhase && dbStatus === 'Start Route') {
        // Warehouse phase completed
        setCompletionPrompt({
          type: 'warehouse',
          title: 'Warehouse Phase Completed',
          message: 'Warehouse phase is completed. Proceed to store drop(s)?',
          onConfirm: () => {
            setPhaseTab('store');
            setSelectedDropIndex(0);
            setCompletionPrompt(null);
          }
        });
      } else if (isStorePhase && dbStatus === 'Departure') {
        // A store drop-off completed
        const isLastDrop = selectedDropIndex === drops.length - 1;
        if (!isLastDrop) {
          setCompletionPrompt({
            type: 'store',
            title: `Drop ${selectedDropIndex + 1} Completed`,
            message: `Drop ${selectedDropIndex + 1} is completed. Proceed to the next drop?`,
            onConfirm: () => {
              setSelectedDropIndex(prev => prev + 1);
              setCompletionPrompt(null);
            }
          });
        }
      }
  }, [shipment.shipmentID, selectedDropIndex, drops, phaseTab, user?.userID, stepRemarks, fetchLogs]);

  // Handle countdown timer
  useEffect(() => {
    if (pendingUpdate && pendingUpdate.timeLeft > 0) {
      timerRef.current = setTimeout(() => {
        setPendingUpdate(prev => ({ ...prev, timeLeft: prev.timeLeft - 1 }));
      }, 1000);
    } else if (pendingUpdate && pendingUpdate.timeLeft === 0) {
      executeStepUpdate(pendingUpdate.step.dbStatus);
      setPendingUpdate(null);
    }
    return () => clearTimeout(timerRef.current);
  }, [pendingUpdate, executeStepUpdate]);

  const handleUndo = () => {
    clearTimeout(timerRef.current);
    setPendingUpdate(null);
  };

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
    const intervalId = setInterval(fetchLogs, 5000); 
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

  const handleStepClick = (step) => {
      setPendingUpdate({ step, timeLeft: 10 });
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
          
          {(phaseTab === 'warehouse' ? WAREHOUSE_PHASES : STORE_PHASES).map((phaseName, index, array) => {
            const step = ALL_STEPS.find(s => s.dbStatus === phaseName);
            const dbStatus = step.dbStatus;
            
            const state = getStepState(localStatus, index, phaseTab);

            const timeData = getStepTimestamp(dbStatus);
            const stepPriority = getStatusPriority(dbStatus);
            const isBlocked = (state === 'active' && isBlockedByDate(stepPriority)) || (!!pendingUpdate);
            const isLastWarehouseStep = phaseTab === 'warehouse' && index === array.length - 1;

            const isPendingThisStep = pendingUpdate && pendingUpdate.step.dbStatus === dbStatus;

            return (
              <div 
                key={dbStatus}
                style={{
                    ...(isLastWarehouseStep
                        ? {
                            gridColumn: '1 / -1',
                            width: '100%',
                            display: 'flex',
                            justifyContent: 'center'
                          }
                        : {})
                }}
              >
                {isPendingThisStep ? (
                    <button
                        className="step-button step-active undo-button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleUndo();
                        }}
                        style={{
                            background: '#e67e22',
                            color: 'white',
                            border: 'none',
                            width: '100%'
                        }}
                    >
                        <div className="step-content">
                            <span className="step-icon"><Icons.RotateCcw /></span>
                            <div className="step-text-group">
                                <span className="step-label">Undo {step.label}</span>
                                <span className="step-timestamp">({pendingUpdate.timeLeft}s...)</span>
                            </div>
                        </div>
                    </button>
                ) : (
                    <button
                        className={`step-button step-${state} ${isBlocked ? 'disabled-transit' : ''}`}
                        disabled={state !== 'active' || isCompleted || isBlocked} 
                        onClick={() => handleStepClick(step)} 
                        style={{ position: 'relative', width: '100%' }}
                    >
                        {/* Remarks Button Overlay */}
                        <div 
                            className="remarks-icon-btn"
                            onClick={(e) => {
                                e.stopPropagation(); 
                                handleOpenRemarks(step);
                            }}
                            style={{
                                color: stepRemarks[dbStatus] ? 'var(--primary-orange)' : undefined, 
                                background: stepRemarks[dbStatus] ? 'white' : undefined,
                                boxShadow: stepRemarks[dbStatus] ? '0 2px 4px rgba(0,0,0,0.1)' : undefined
                            }}
                        >
                            <Icons.MessageSquare size={16} />
                        </div>

                        <div className="step-content">
                          <span className="step-icon">{step.icon}</span>
                          <div className="step-text-group">
                              <span className="step-label">{step.label}</span>
                              
                              <span className="step-timestamp">
                                  {state === 'done' ? (
                                  <>
                                      {timeData ? (
                                      <span style={timeData.isPending ? { color: '#d4853fff'} : undefined}>
                                          {timeData.text}
                                      </span>
                                      ) : (
                                      "Completed"
                                      )}
                                  </>
                                  ) : state === 'active' && isBlocked && !pendingUpdate ? (
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
                )}
              </div>
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

      {completionPrompt && (
        <FeedbackModal 
          type="info"
          title={completionPrompt.title}
          message={completionPrompt.message}
          confirmLabel="Proceed"
          onClose={() => setCompletionPrompt(null)}
          onConfirm={completionPrompt.onConfirm}
        />
      )}
    </div>
  );
});

export default ShipmentDetails;
