import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Icons } from '../Icons';
import './ShipmentDetails.css';

const STEPS = [
  { label: 'Arrival Time', dbStatus: 'Arrival', icon: <Icons.Truck /> },
  { label: 'Handover Invoice', dbStatus: 'Handover Invoice', icon: <Icons.Document /> },
  { label: 'Start Unload', dbStatus: 'Start Unload', icon: <Icons.Box /> },
  { label: 'Finish Unload', dbStatus: 'Finish Unload', icon: <Icons.Timer /> },
  { label: 'Invoice Receive', dbStatus: 'Invoice Receive', icon: <Icons.Pen /> },
  { label: 'Departure', dbStatus: 'Departure', icon: <Icons.Flag /> }
];

function ShipmentDetails({ shipment, onStepClick, onBack, token }) {
  const [showOverlay, setShowOverlay] = useState(true);
  const [logs, setLogs] = useState([]);

  // ✅ FIX: Added 'shipment.currentStatus' to the dependency array.
  // Now, whenever the status updates (e.g. from 'Arrival' to 'Handover'), 
  // it automatically re-fetches the logs to get the new timestamp.
  useEffect(() => {
      const fetchLogs = async () => {
          try {
              const config = token ? { headers: { Authorization: `Bearer ${token}` } } : {};
              // Add a timestamp query param to prevent caching
              const url = `http://localhost:4000/api/shipments/${shipment.shipmentID}/logs?_t=${new Date().getTime()}`;
              const res = await axios.get(url, config);
              setLogs(res.data);
          } catch (err) {
              console.error("Error fetching logs:", err);
          }
      };
      
      if (shipment.shipmentID) {
          fetchLogs();
      }
  }, [shipment.shipmentID, shipment.currentStatus, token]); 

  const getStepTimestamp = (dbStatus) => {
    if (!logs || logs.length === 0) return null;
    
    const log = logs.find(l => 
      l.phaseName === dbStatus || l.phase === dbStatus || l.newStatus === dbStatus
    );

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

  const isCompleted = shipment.currentStatus === 'Completed';

  return (
    <div className="details-container">
      <div className="details-header">
        <div className="back-btn-absolute" onClick={onBack}>
          <Icons.ArrowLeft />
        </div>
        <h2 className="shipment-title-inline">DELIVERY #{shipment.shipmentID}</h2>
      </div>

      <div className="info-box">
        <div className="info-row"><strong>Location:</strong> {shipment.destLocation}</div>
        <div className="info-row"><strong>Client:</strong> {shipment.clientName}</div>
        <div className="info-row"><strong>Scheduled:</strong> {new Date(shipment.creationTimestamp).toLocaleString()}</div>
      </div>

      <div className="steps-wrapper">
        
        {/* OVERLAY: Click to Dismiss */}
        {isCompleted && showOverlay && (
          <div className="completion-overlay" onClick={() => setShowOverlay(false)}>
            <div className="lockout-badge">
              <div className="lockout-icon"><Icons.Check /></div>
              <span>SHIPMENT COMPLETED</span>
              <span className="tap-hint">(Tap to view details)</span>
            </div>
          </div>
        )}

        {/* STEPS LIST */}
        <div className={`steps-container ${isCompleted && showOverlay ? 'blurred-background' : ''}`}>
          {STEPS.map((step, index) => {
            const state = getStepState(shipment.currentStatus, index);
            const timestamp = getStepTimestamp(step.dbStatus);

            return (
              <button
                key={index}
                className={`step-button step-${state}`}
                disabled={state !== 'active' || isCompleted} 
                onClick={() => onStepClick(shipment.shipmentID, step.dbStatus)}
              >
                <div className="step-content">
                  <span className="step-icon">{step.icon}</span>
                  
                  <div className="step-text-group">
                      <span className="step-label">{step.label}</span>
                      {state === 'done' && timestamp && (
                          <span className="step-timestamp">Completed: {timestamp}</span>
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
    </div>
  );
}

export default ShipmentDetails;