import React from 'react';
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

function ShipmentDetails({ shipment, onStepClick, onBack }) {
  const getStepState = (currentDbStatus, stepIndex) => {
    let currentStatusIndex = STEPS.findIndex(s => s.dbStatus === currentDbStatus);
    if (currentDbStatus === 'Pending') currentStatusIndex = -1;
    if (currentDbStatus === 'Completed') currentStatusIndex = 99;

    if (stepIndex <= currentStatusIndex) return 'done';
    if (stepIndex === currentStatusIndex + 1) return 'active';
    return 'pending';
  };

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

      {shipment.currentStatus === 'Completed' && (
        <div className="completion-banner">
          <div className="banner-icon"><Icons.Check /></div>
          <span>SHIPMENT COMPLETED</span>
        </div>
      )}

      <div className="steps-container">
        {STEPS.map((step, index) => {
          const state = getStepState(shipment.currentStatus, index);
          return (
            <button
              key={index}
              className={`step-button step-${state}`}
              disabled={state !== 'active'}
              onClick={() => onStepClick(shipment.shipmentID, step.dbStatus)}
            >
              <div className="step-content">
                <span className="step-icon">{step.icon}</span>
                <span>{step.label}</span>
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
  );
}

export default ShipmentDetails;