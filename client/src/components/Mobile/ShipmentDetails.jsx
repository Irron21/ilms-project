import React, { useState, useEffect } from 'react';
import api from '../../utils/api';
import { Icons } from '../Icons';
import './ShipmentDetails.css';
import { queueManager } from '../../utils/queueManager';

const STEPS = [
  { label: 'Arrival Time', dbStatus: 'Arrival', icon: <Icons.Truck /> },
  { label: 'Handover Invoice', dbStatus: 'Handover Invoice', icon: <Icons.Document /> },
  { label: 'Start Unload', dbStatus: 'Start Unload', icon: <Icons.Box /> },
  { label: 'Finish Unload', dbStatus: 'Finish Unload', icon: <Icons.Timer /> },
  { label: 'Invoice Receive', dbStatus: 'Invoice Receive', icon: <Icons.Pen /> },
  { label: 'Departure', dbStatus: 'Departure', icon: <Icons.Flag /> }
];

function ShipmentDetails({ shipment, onBack, token, user }) { // ✨ Added 'user' prop
  const [showOverlay, setShowOverlay] = useState(true);
  const [logs, setLogs] = useState([]);
  
  // ✨ OPTIMISTIC STATE: We use this instead of waiting for the database
  const [localStatus, setLocalStatus] = useState(shipment.currentStatus);
  const [isOffline, setIsOffline] = useState(!navigator.onLine);

  useEffect(() => {
    // 1. Listen for Online/Offline changes
    const handleOnline = () => { setIsOffline(false); queueManager.process(); };
    const handleOffline = () => setIsOffline(true);
    
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // 2. Try to process queue on load
    queueManager.process();

    return () => {
        window.removeEventListener('online', handleOnline);
        window.removeEventListener('offline', handleOffline);
    };
  }, []);

  useEffect(() => {
      // Sync local status if parent updates (e.g. after a successful sync)
      setLocalStatus(shipment.currentStatus);
  }, [shipment.currentStatus]);

  // OFFLINE-SAFE LOG FETCHING
  useEffect(() => {
      const fetchLogs = async () => {
          if (!navigator.onLine) return;
          try {
              const config = token ? { headers: { Authorization: `Bearer ${token}` } } : {};
              const url = `/shipments/${shipment.shipmentID}/logs?_t=${new Date().getTime()}`;
              const res = await api.get(url, config);
              setLogs(res.data);
          } catch (err) { console.error("Error fetching logs:", err); }
      };
      if (shipment.shipmentID) fetchLogs();
  }, [shipment.shipmentID, token]);

  // OFFLINE HANDLER
  const handleStepClick = async (dbStatus) => {
      // 1. Determine if this is the final step
      const isFinishing = dbStatus === 'Departure';
      const finalStatus = isFinishing ? 'Completed' : dbStatus;

      // 2. Optimistic Update
      setLocalStatus(finalStatus);

      // 3. Create Fake Log (Immediate Feedback)
      const now = new Date().toISOString(); 
      setLogs(prevLogs => [
          ...prevLogs, 
          { phaseName: dbStatus, timestamp: now }, // Log for the specific step (e.g., Departure)
          ...(isFinishing ? [{ phaseName: 'Completed', timestamp: now }] : []) // Optional: Log for Completed too
      ]);

      // 4. Add to Queue
      // First: The actual step (e.g., Arrival, Departure)
      queueManager.add({
          type: 'UPDATE_STATUS',
          shipmentID: shipment.shipmentID,
          status: dbStatus,
          userID: user?.userID || 1
      });

      // Second: If Departure, ALSO send 'Completed'
      if (isFinishing) {
          queueManager.add({
              type: 'UPDATE_STATUS',
              shipmentID: shipment.shipmentID,
              status: 'Completed',
              userID: user?.userID || 1
          });
      }

      // 5. Sync
      queueManager.process();
  };

  const getStepTimestamp = (dbStatus) => {
    if (!logs || logs.length === 0) return null;
    const log = logs.find(l => l.phaseName === dbStatus || l.phase === dbStatus || l.newStatus === dbStatus);
    if (log) {
      const date = new Date(log.timestamp);
      return `${date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} • ${date.toLocaleDateString()}`;
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
      {/* ✨ OFFLINE INDICATOR */}
      {isOffline && (
        <div style={{background: '#333', color: 'white', textAlign: 'center', padding: '5px', fontSize: '12px'}}>
           You are Offline. Changes will save automatically when online.
        </div>
      )}

      <div className="details-header">
        <div className="back-btn-absolute" onClick={onBack}>
          <Icons.ArrowLeft />
        </div>
        <h2 className="shipment-title-inline">DELIVERY #{shipment.shipmentID}</h2>
      </div>

      <div className="info-box">
        <div className="info-row"><strong>Location:</strong> {shipment.destLocation}</div>
        <div className="info-row"><strong>Client:</strong> {shipment.clientName}</div>
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
            const state = getStepState(localStatus, index); // Use localStatus here!
            const timestamp = getStepTimestamp(step.dbStatus);

            return (
              <button
                key={index}
                className={`step-button step-${state}`}
                disabled={state !== 'active' || isCompleted} 
                // ✨ USE NEW HANDLER
                onClick={() => handleStepClick(step.dbStatus)}
              >
                <div className="step-content">
                  <span className="step-icon">{step.icon}</span>
                  <div className="step-text-group">
                      <span className="step-label">{step.label}</span>
                      {state === 'done' && timestamp && <span className="step-timestamp">Completed: {timestamp}</span>}
                      {/* Show 'Pending Sync' if done but no timestamp yet (meaning it's queued) */}
                      {state === 'done' && !timestamp && <span className="step-timestamp" style={{color: 'orange'}}>Saving...</span>}
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
    </div>
  );
}

export default ShipmentDetails;