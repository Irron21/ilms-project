import React from 'react';
import './Dashboard.css';

function Dashboard({ shipments, activeTab, setActiveTab, onCardClick }) {

  const getCardStyle = (status) => {
    if (status === 'Completed') return { class: 'card-green', label: 'COMPLETED' };
    if (status === 'Pending') return { class: 'card-blue', label: 'TO DELIVER' };
    return { class: 'card-yellow', label: 'IN PROGRESS' };
  };

  // Filter Logic
  const filteredShipments = shipments.filter(s => {
    if (activeTab === 'COMPLETED') return s.currentStatus === 'Completed';
    return s.currentStatus !== 'Completed'; 
  });

  return (
    <div className="dashboard-wrapper">
      {/* TABS */}
      <div className="tabs">
        <span 
          className={`tab ${activeTab === 'ACTIVE' ? 'active' : ''}`}
          onClick={() => setActiveTab('ACTIVE')}
        >
          ACTIVE
        </span>
        <span 
          className={`tab ${activeTab === 'COMPLETED' ? 'active' : ''}`}
          onClick={() => setActiveTab('COMPLETED')}
        >
          COMPLETED
        </span>
      </div>

      {/* LIST */}
      <div className="dashboard-container">
        {filteredShipments.length === 0 && (
          <div className="empty-state">No {activeTab.toLowerCase()} shipments found.</div>
        )}

        {filteredShipments.map((shipment) => {
          const style = getCardStyle(shipment.currentStatus);
          return (
            <div 
              key={shipment.shipmentID} 
              className={`shipment-card ${style.class}`}
              onClick={() => onCardClick(shipment)}
            >
              <div>
                <div className="card-id">SHIPMENT ID: #{shipment.shipmentID}</div>
                <div className="card-client">{shipment.clientName}</div>
                <div className="card-location">{shipment.destLocation}</div>
                <div className="card-date">
                  {new Date(shipment.creationTimestamp).toLocaleString()}
                </div>
              </div>
              
              <div className="card-status-label">{style.label}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default Dashboard;