import { useState, useEffect, useCallback, useRef, memo } from 'react';
import api from '@utils/api';
import { Icons, FeedbackModal } from '@shared';
import { queueManager } from '@utils/queueManager';
import { getTodayString, getDateValue, formatDateDisplay } from '@constants';

const STEPS = [
  { label: 'Arrival Time', dbStatus: 'Arrival', icon: <Icons.Clock /> },
  { label: 'Handover Invoice', dbStatus: 'Handover Invoice', icon: <Icons.FileText /> },
  { label: 'Start Unload', dbStatus: 'Start Unload', icon: <Icons.Package /> },
  { label: 'Finish Unload', dbStatus: 'Finish Unload', icon: <Icons.Activity /> },
  { label: 'Invoice Receive', dbStatus: 'Invoice Receive', icon: <Icons.Clipboard /> },
  { label: 'Departure', dbStatus: 'Departure', icon: <Icons.Send /> }
];

const getStatusPriority = (status) => {
    if (status === 'Completed') return 100;
    if (status === 'Loaded') return 0.5; // Loaded is between Pending and Arrival
    const index = STEPS.findIndex(s => s.dbStatus === status);
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
      isPending: true
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
  const [confirmStep, setConfirmStep] = useState(null);
  const [isOffline, setIsOffline] = useState(!navigator.onLine);
  const [offlineVisible, setOfflineVisible] = useState(!navigator.onLine);
  const containerRef = useRef(null);
  const touchStartRef = useRef(null);

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
              !serverLogs.some(s => s.phaseName === p.phaseName)
            );
            const nextLogs = [...serverLogs, ...distinctPending];
            
            // Optimization: Only update if the data actually changed to prevent re-render "blinks"
            if (JSON.stringify(prev) === JSON.stringify(nextLogs)) return prev;
            return nextLogs;
        });

        if (serverLogs.length > 0) {
            const lastLog = serverLogs[serverLogs.length - 1];
            const newStatus = lastLog.phaseName === 'Departure' || lastLog.phaseName === 'Completed' 
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
  }, [shipment.shipmentID, token]);

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
      const isFinishing = dbStatus === 'Departure';
      const finalStatus = isFinishing ? 'Completed' : dbStatus;
      const now = Date.now(); 

      setLocalStatus(finalStatus);

      const newLog = { phaseName: dbStatus, timestamp: now, isPending: true };
      
      setLogs(prevLogs => {
          if (prevLogs.some(l => l.phaseName === dbStatus)) return prevLogs;
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
          userID: user?.userID || 1
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

  const getStepTimestamp = (dbStatus) => {
    if (!logs || logs.length === 0) return null;
    const log = logs.find(l => l.phaseName === dbStatus || l.phase === dbStatus || l.newStatus === dbStatus);

    if (log) {
      const date = new Date(log.timestamp);
      return {
        text: `${date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} • ${date.toLocaleDateString()}`,
        isPending: !!log.isPending
      };
    }
    return null;
  };

  const getStepState = (currentDbStatus, stepIndex) => {
    // Priority-based state
    const currentPriority = getStatusPriority(currentDbStatus);
    const stepPriority = stepIndex + 1; // STEPS are indices 0-5, priorities are 1-6

    if (stepPriority <= currentPriority) return 'done';
    if (stepPriority === Math.floor(currentPriority) + 1) return 'active';
    return 'pending';
  };

  const isCompleted = localStatus === 'Completed';
  const isPendingLoad = getStatusPriority(localStatus) < 0.5;
  const today = getTodayString();
  const deliveryDate = getDateValue(shipment.deliveryDate);
  const loadingDate = getDateValue(shipment.loadingDate);
  
  // Explicitly In Transit if Loaded but not yet delivery date
  const isInTransit = localStatus === 'Loaded' && deliveryDate > today;
  
  // Block delivery steps if not delivery date
  const isBlockedByDate = (stepIndex) => {
    return today < deliveryDate; // Block delivery steps if too early
  };

  const canConfirmLoad = today >= loadingDate;

  return (
    <div className="details-container" ref={containerRef} onTouchStart={handleTouchStart} onTouchMove={handleTouchMove}>
      <div className="notification-spacer">
        {isOffline && offlineVisible && (
          <div className="offline-banner">
             You are Offline. Changes will save automatically when online.
          </div>
        )}
        {isInTransit && (
          <div className="transit-banner">
             <Icons.Clock size={16} />
             <span>Goods Loaded. Ready for Delivery on {formatDateDisplay(shipment.deliveryDate)}</span>
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
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
                  <circle cx="12" cy="7" r="4"></circle>
                </svg>
              </div>
              <div className="info-content">
                <span className="info-label">{user.role === 'Driver' ? 'Helper' : 'Driver'}</span>
                <span className="info-value" style={{fontWeight: 600}}>{partnerName}</span>
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
               <span className="info-label">Destination</span>
               <span className="info-value">{shipment.destName || 'N/A'}</span>
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
                <span className="info-label">Address</span>
                <span className="info-value">{shipment.destLocation}</span>
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

      <div className={`steps-wrapper ${isOffline && offlineVisible ? 'with-snackbar' : ''}`} style={{ position: 'relative' }}>
        {isPendingLoad && (
          <div className="completion-overlay confirm-load-overlay">
            <div className={`lockout-badge ${!canConfirmLoad ? 'locked-load' : ''}`} style={{ borderColor: '#2980b9' }}>
              <div className="lockout-icon"><Icons.Truck size={40} stroke="#2980b9" /></div>
              <span style={{ color: '#2980b9' }}>READY TO DELIVER</span>
              {!canConfirmLoad ? (
                <span className="tap-hint">Available on {formatDateDisplay(shipment.loadingDate)}</span>
              ) : (
                <button 
                  className="confirm-load-btn" 
                  onClick={() => executeStepUpdate('Loaded')}
                  style={{
                    marginTop: '10px',
                    padding: '8px 20px',
                    background: '#2980b9',
                    color: 'white',
                    border: 'none',
                    borderRadius: '20px',
                    fontWeight: '600'
                  }}
                >
                  Confirm Loaded
                </button>
              )}
            </div>
          </div>
        )}

        {isCompleted && showOverlay && (
          <div className="completion-overlay" onClick={() => setShowOverlay(false)}>
            <div className="lockout-badge">
              <div className="lockout-icon"><Icons.CheckCircle size={40} stroke="#27ae60" /></div>
              <span style={{ color: '#27ae60' }}>SHIPMENT COMPLETED</span>
            </div>
          </div>
        )}

        <div className={`steps-container ${(isCompleted && showOverlay) || isPendingLoad ? 'blurred-background' : ''}`}>
          {STEPS.map((step, index) => {
            const state = getStepState(localStatus, index);
            const timeData = getStepTimestamp(step.dbStatus);
            const isBlocked = state === 'active' && isBlockedByDate(index);

            return (
              <button
                key={index}
                className={`step-button step-${state} ${isBlocked ? 'disabled-transit' : ''}`}
                disabled={state !== 'active' || isCompleted || isBlocked} 
                onClick={() => handleStepClick(step)} 
              >
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
                             Available on {index === 0 ? formatDateDisplay(shipment.loadingDate) : formatDateDisplay(shipment.deliveryDate)}
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
