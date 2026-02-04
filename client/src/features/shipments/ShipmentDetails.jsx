import { useState, useEffect, useCallback } from 'react';
import api from '@utils/api';
import { Icons, FeedbackModal } from '@shared';
import { queueManager } from '@utils/queueManager';

const STEPS = [
  { label: 'Arrival Time', dbStatus: 'Arrival', icon: <Icons.Truck /> },
  { label: 'Handover Invoice', dbStatus: 'Handover Invoice', icon: <Icons.Document /> },
  { label: 'Start Unload', dbStatus: 'Start Unload', icon: <Icons.Box /> },
  { label: 'Finish Unload', dbStatus: 'Finish Unload', icon: <Icons.Timer /> },
  { label: 'Invoice Receive', dbStatus: 'Invoice Receive', icon: <Icons.Pen /> },
  { label: 'Departure', dbStatus: 'Departure', icon: <Icons.Flag /> }
];

const getStatusPriority = (status) => {
    if (status === 'Completed') return 100;
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

function ShipmentDetails({ shipment, onBack, token, user }) { 
  const [showOverlay, setShowOverlay] = useState(true);
  const [confirmStep, setConfirmStep] = useState(null);
  const [isOffline, setIsOffline] = useState(!navigator.onLine);

  const [localStatus, setLocalStatus] = useState(() => {
    const offlineData = getPendingOfflineData(shipment.shipmentID);
    return offlineData ? offlineData.status : shipment.currentStatus;
  });

  const [logs, setLogs] = useState(() => {
    const offlineData = getPendingOfflineData(shipment.shipmentID);
    return offlineData ? offlineData.logs : [];
  });

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

  // --- HELPER: Date Formatter ---
  const formatDate = (dateStr) => {
    if (!dateStr) return 'Not Set';
    // Safe parse YYYY-MM-DD to avoid timezone shifts
    const [year, month, day] = String(dateStr).substring(0, 10).split('-');
    return `${month}/${day}/${year}`;
  };

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
            return [...serverLogs, ...distinctPending];
        });

        if (serverLogs.length > 0) {
            const lastLog = serverLogs[serverLogs.length - 1];
            const newStatus = lastLog.phaseName === 'Departure' || lastLog.phaseName === 'Completed' 
                ? 'Completed' 
                : lastLog.phaseName;

            setLocalStatus(current => {
                const currentPri = getStatusPriority(current);
                const newPri = getStatusPriority(newStatus);
                return newPri >= currentPri ? newStatus : current;
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
    const handleOffline = () => setIsOffline(true);
    
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    
    return () => {
        window.removeEventListener('online', handleOnline);
        window.removeEventListener('offline', handleOffline);
    };
  }, [fetchLogs]);

  useEffect(() => {
    if (isOffline) return;
    fetchLogs(); 
    const intervalId = setInterval(fetchLogs, 3000);
    return () => clearInterval(intervalId);
  }, [isOffline, fetchLogs]);

  useEffect(() => {
      if (navigator.onLine) {
         const hasPending = logs.some(l => l.isPending);
         if (!hasPending) {
             const parentPriority = getStatusPriority(shipment.currentStatus);
             const localPriority = getStatusPriority(localStatus);
             if (parentPriority >= localPriority) {
                 setLocalStatus(shipment.currentStatus);
             }
         }
      }
  }, [shipment.currentStatus, logs, localStatus]);

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
    let currentStatusIndex = STEPS.findIndex(s => s.dbStatus === currentDbStatus);
    if (currentDbStatus === 'Pending') currentStatusIndex = -1;
    if (currentDbStatus === 'Completed') currentStatusIndex = 99;

    if (stepIndex <= currentStatusIndex) return 'done';
    if (stepIndex === currentStatusIndex + 1) return 'active';
    return 'pending';
  };

  const isCompleted = localStatus === 'Completed';

  return (
    <div className="details-container">
      <div className="notification-spacer">
        {isOffline && (
          <div className="offline-banner">
             You are Offline. Changes will save automatically when online.
          </div>
        )}
      </div>

      <div className="details-header">
        <div className="back-btn-absolute" onClick={onBack}>
          <Icons.ArrowLeft />
        </div>
        <h2 className="shipment-title-inline">DELIVERY #{shipment.shipmentID}</h2>
      </div>

      <div className="info-card-mob">
        <div className="info-card-mob-grid">
        {/* 1. Destination */}
        <div className="info-item item-dest"> 
          <div className="info-icon-box">
             <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M20 9v11a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V9"/>
                <path d="M9 22V12h6v10M2 10.6L12 2l10 8.6"/>
             </svg>
          </div>
          <div className="info-content">
             <span className="info-label">Destination</span>
             <span className="info-value">{shipment.destName || 'N/A'}</span>
          </div>
        </div>

        {/* 2. Address */}
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

          {/* 3. Loading Date */}
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
              <span className="info-value" style={{color:'#2980b9', fontWeight: 700}}>{formatDate(shipment.loadingDate)}</span>
            </div>
          </div>

          {/* 4. Delivery Date */}
          <div className="info-item item-del">
            <div className="info-icon-box">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"></path>
                  <line x1="4" y1="22" x2="4" y2="15"></line>
              </svg>
            </div>
            <div className="info-content">
              <span className="info-label">Delivery Date</span>
              <span className="info-value" style={{color:'#d35400', fontWeight: 700}}>{formatDate(shipment.deliveryDate)}</span>
            </div>
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
      </div>

      <div className="steps-wrapper">
        {isCompleted && showOverlay && (
          <div className="completion-overlay" onClick={() => setShowOverlay(false)}>
            <div className="lockout-badge">
              <div className="lockout-icon"><Icons.Check /></div>
              <span>SHIPMENT COMPLETED</span>
            </div>
          </div>
        )}

        <div className={`steps-container ${isCompleted && showOverlay ? 'blurred-background' : ''}`}>
          {STEPS.map((step, index) => {
            const state = getStepState(localStatus, index);
            const timeData = getStepTimestamp(step.dbStatus);

            return (
              <button
                key={index}
                className={`step-button step-${state}`}
                disabled={state !== 'active' || isCompleted} 
                onClick={() => handleStepClick(step)} 
              >
                <div className="step-content">
                  <span className="step-icon">{step.icon}</span>
                  <div className="step-text-group">
                      <span className="step-label">{step.label}</span>
                      
                      {state === 'done' && (
                        <>
                          {timeData ? (
                            <span className="step-timestamp">
                              Completed: {timeData.text} 
                              {timeData.isPending && <span style={{color: 'orange', marginLeft: '5px'}}>(Saving...)</span>}
                            </span>
                          ) : (
                             <span className="step-timestamp">Completed</span>
                          )}
                        </>
                      )}
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
}

export default ShipmentDetails;
