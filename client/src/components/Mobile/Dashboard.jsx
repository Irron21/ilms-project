import React, { useState, useEffect } from 'react'; 
import './Dashboard.css';
import { Icons } from '../Icons';

function Dashboard({ shipments, activeTab, setActiveTab, onCardClick }) {
  const [isAtBottom, setIsAtBottom] = useState(false);

  const [seenShipments, setSeenShipments] = useState(() => {
    try {
      const saved = localStorage.getItem('acknowledgedShipments');
      return saved ? JSON.parse(saved) : [];
    } catch(e) { return []; }
  });

  useEffect(() => {
    localStorage.setItem('acknowledgedShipments', JSON.stringify(seenShipments));
  }, [seenShipments]);

  const handleScroll = (e) => {
    const { scrollTop, scrollHeight, clientHeight } = e.target;
    // Hide arrow if within 20px of bottom
    if (scrollHeight - scrollTop <= clientHeight + 20) {
      setIsAtBottom(true);
    } else {
      setIsAtBottom(false);
    }
  };

  const isNewlyAssigned = (timestamp, id) => {
    if (!timestamp || !id) return false;
    const shipmentDate = new Date(timestamp);
    const now = new Date();
    const diffInHours = (now - shipmentDate) / (1000 * 60 * 60);
    const strId = String(id);
    const hasBeenSeen = seenShipments.some(seenId => String(seenId) === strId);
    return (diffInHours < 2) && !hasBeenSeen;
  };

  const newCount = shipments.filter(s => 
    s.currentStatus === 'Pending' && isNewlyAssigned(s.creationTimestamp, s.shipmentID)
  ).length;

  const handleCardClick = (shipment) => {
    const strId = String(shipment.shipmentID);
    if (!seenShipments.some(id => String(id) === strId)) {
      const newSeenList = [...seenShipments, strId];
      setSeenShipments(newSeenList);
      localStorage.setItem('acknowledgedShipments', JSON.stringify(newSeenList));
    }
    onCardClick(shipment);
  };

  const getCardStyle = (status) => {
    if (status === 'Completed') return { class: 'card-green', label: 'COMPLETED' };
    if (status === 'Pending') return { class: 'card-blue', label: 'TO DELIVER' };
    return { class: 'card-yellow', label: 'IN PROGRESS' };
  };

  const filteredShipments = shipments.filter(s => {
    if (activeTab === 'COMPLETED') return s.currentStatus === 'Completed';
    return s.currentStatus !== 'Completed'; 
  });

  return (
    <div className="dashboard-wrapper">
      {/* SPACER IS ALWAYS RENDERED (Creating the gap) */}
      <div className="notification-spacer">
        {/* Only show the Black Banner content if there are new shipments */}
        {newCount > 0 && activeTab === 'ACTIVE' && (
          <div className="notification-banner">
            <Icons.Truck style={{ width: 18, height: 18, stroke: 'white' }} />
            <span>You have {newCount} new shipment assignment(s)!</span>
          </div>
        )}
      </div>

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

      {/* SCROLLABLE LIST */}
      <div className="dashboard-container" onScroll={handleScroll}>
        {filteredShipments.length === 0 && (
          <div className="empty-state">No {activeTab.toLowerCase()} shipments found.</div>
        )}

        {filteredShipments.map((shipment) => {
          const style = getCardStyle(shipment.currentStatus);
          const isNew = shipment.currentStatus === 'Pending' && isNewlyAssigned(shipment.creationTimestamp, shipment.shipmentID);

          return (
            <div 
              key={shipment.shipmentID} 
              className={`shipment-card ${style.class}`}
              onClick={() => handleCardClick(shipment)}
            >
              {isNew && <div className="new-badge">NEW</div>}
              <div>
                <div className="card-id">SHIPMENT ID: #{shipment.shipmentID}</div>
                <div className="card-client">{shipment.destName}</div>
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

      {/* 4. SAFE ZONE FOOTER (PHYSICAL BARRIER) */}
        <div className={`safe-zone-footer ${isAtBottom ? 'hidden' : ''}`}>
        {filteredShipments.length > 3 && (
            <div className={`scroll-arrow ${isAtBottom ? 'hidden' : ''}`}>
                <span>Scroll for More</span>
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#333" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M7 13l5 5 5-5M7 6l5 5 5-5"/>
                </svg>
            </div>
        )}
      </div>
      
    </div>
  );
}

export default Dashboard;