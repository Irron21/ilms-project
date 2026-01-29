import React, { useState, useEffect } from 'react';
import api from '../../utils/api';
import { Icons } from '../Icons';
import './ShipmentDetails.css';
import { queueManager } from '../../utils/queueManager';
import FeedbackModal from '../FeedbackModal';

const STEPS = [
  { label: 'Arrival Time', dbStatus: 'Arrival', icon: <Icons.Truck /> },
  { label: 'Handover Invoice', dbStatus: 'Handover Invoice', icon: <Icons.Document /> },
  { label: 'Start Unload', dbStatus: 'Start Unload', icon: <Icons.Box /> },
  { label: 'Finish Unload', dbStatus: 'Finish Unload', icon: <Icons.Timer /> },
  { label: 'Invoice Receive', dbStatus: 'Invoice Receive', icon: <Icons.Pen /> },
  { label: 'Departure', dbStatus: 'Departure', icon: <Icons.Flag /> }
];

function ShipmentDetails({ shipment, onBack, token, user }) { 
  const [showOverlay, setShowOverlay] = useState(true);
  const [logs, setLogs] = useState([]);
  const [confirmStep, setConfirmStep] = useState(null);
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

  const executeStepUpdate = (dbStatus) => {
      const isFinishing = dbStatus === 'Departure';
      const finalStatus = isFinishing ? 'Completed' : dbStatus;

      setLocalStatus(finalStatus);

      const now = new Date().toISOString(); 
      setLogs(prevLogs => [
          ...prevLogs, 
          { phaseName: dbStatus, timestamp: now },
          ...(isFinishing ? [{ phaseName: 'Completed', timestamp: now }] : [])
      ]);

      queueManager.add({
          type: 'UPDATE_STATUS',
          shipmentID: shipment.shipmentID,
          status: dbStatus,
          userID: user?.userID || 1
      });

      if (isFinishing) {
          queueManager.add({
              type: 'UPDATE_STATUS',
              shipmentID: shipment.shipmentID,
              status: 'Completed',
              userID: user?.userID || 1
          });
      }

      queueManager.process();
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
      <div className="notification-spacer">
        {isOffline && (
          <div className="offline-banner">
             You are Offline. Changes will save automatically when online.
          </div>
        )}
      </div>
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

      <div className="info-card">
        
        {/* Row 1: Destination Name */}
        <div className="info-item">
          <div className="info-icon-box">
              <Icons.Building />
          </div>
          <div className="info-content">
             <span className="info-label">Destination</span>
             {/* Changed from clientName to destName */}
             <span className="info-value">{shipment.destName || 'N/A'}</span>
          </div>
        </div>

        {/* Row 2: Address / Location */}
        <div className="info-item">
          <div className="info-icon-box">
             <Icons.Pin />
          </div>
          <div className="info-content">
             <span className="info-label">Address</span>
             <span className="info-value">{shipment.destLocation}</span>
          </div>
        </div>

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
            const timestamp = getStepTimestamp(step.dbStatus);

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