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
    if (scrollHeight - scrollTop <= clientHeight + 20) {
      setIsAtBottom(true);
    } else {
      setIsAtBottom(false);
    }
  };

  // --- DATE HELPERS (Timezone Safe) ---
  // 1. Get Today in Local Time "YYYY-MM-DD"
  const getTodayString = () => {
    const d = new Date();
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  // 2. Convert DB String to Local Time "YYYY-MM-DD"
  const getDateValue = (dateStr) => {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return ''; 
    
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  // 3. Display format MM/DD/YYYY
  const formatDisplayDate = (dateStr) => {
    if (!dateStr) return '-';
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return '-';
    return d.toLocaleDateString(); // Uses local format (e.g., 1/31/2026)
  };

  const isNewlyAssigned = (timestamp, id) => {
    if (!timestamp || !id) return false;
    const shipmentDate = new Date(timestamp);
    const now = new Date();
    const diffInHours = (now - shipmentDate) / (1000 * 60 * 60);
    const strId = String(id);
    const hasBeenSeen = seenShipments.some(seenId => String(seenId) === strId);
    return (diffInHours < 24) && !hasBeenSeen; 
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

  // --- FILTER LOGIC ---
  const filteredShipments = shipments.filter(s => {
    const today = getTodayString();
    
    // Convert DB dates to Local YYYY-MM-DD
    const loadDate = getDateValue(s.loadingDate);
    const delDate = getDateValue(s.deliveryDate);

    // 1. COMPLETED Tab
    if (activeTab === 'COMPLETED') {
        return s.currentStatus === 'Completed';
    }

    // PENDING SHIPMENTS
    if (s.currentStatus !== 'Completed') {
        
        // 2. DELAYED: Delivery Date is Strictly PAST Today
        if (activeTab === 'DELAYED') {
            return delDate && delDate < today;
        }

        // 3. UPCOMING: Loading Date is Strictly FUTURE
        if (activeTab === 'UPCOMING') {
            return loadDate > today;
        }

        // 4. ACTIVE: 
        // - Loading is TODAY or PAST (Ready to start)
        // - AND Delivery is TODAY or FUTURE (Not yet delayed)
        if (activeTab === 'ACTIVE') {
            const isLoadActive = loadDate <= today || !loadDate;
            const isDeliveryValid = !delDate || delDate >= today; 
            
            return isLoadActive && isDeliveryValid;
        }
    }
    return false;
  });

  const getBannerContent = () => {
    const count = filteredShipments.length;

    // 1. High Priority: New Assignments (Only on Active/Upcoming)
    if (newCount > 0 && (activeTab === 'ACTIVE' || activeTab === 'UPCOMING')) {
        return {
            class: 'alert',
            icon: <Icons.Truck style={{ width: 18, height: 18 }} stroke="white" fill="black" />,
            text: `You have ${newCount} new shipment assignment(s)!`
        };
    }

    // 2. Delayed Tab
    if (activeTab === 'DELAYED') {
        return {
            class: 'delayed',
            icon: <Icons.AlertCircle style={{ width: 18, height: 18 }} />, 
            text: count > 0 ? `${count} Shipment(s) marked as Delayed` : 'No Delayed Shipments'
        };
    }

    // 3. Completed Tab
    if (activeTab === 'COMPLETED') {
        return {
            class: 'completed',
            icon: <Icons.CheckCircle style={{ width: 18, height: 18 }} />,
            text: `${count} Shipment(s) Completed`
        };
    }

    // 4. Default Info (Active/Upcoming with no new items)
    return {
        class: 'info',
        icon: <Icons.Calendar style={{ width: 18, height: 18 }} />,
        text: `${count} ${activeTab.toLowerCase()} Shipment(s)`
    };
  };

  const banner = getBannerContent();

  const animationKey = (activeTab === 'ACTIVE' || activeTab === 'UPCOMING') 
      ? 'active-upcoming-group' 
      : activeTab;

  return (
    <div className="dashboard-wrapper">
      <div className={`status-bar-container ${banner.class}`}>
          <div className="status-bar-content" key={animationKey}>
            {banner.icon}
            <span>{banner.text}</span>
          </div>
      </div>

      <div className="tabs">
        <span className={`tab ${activeTab === 'ACTIVE' ? 'active' : ''}`} onClick={() => setActiveTab('ACTIVE')}>
          ACTIVE
        </span>
        <span className={`tab ${activeTab === 'UPCOMING' ? 'active' : ''}`} onClick={() => setActiveTab('UPCOMING')}>
          UPCOMING
        </span>
         <span className={`tab ${activeTab === 'COMPLETED' ? 'active' : ''}`} onClick={() => setActiveTab('COMPLETED')}>
          COMPLETED
        </span>
        <span className={`tab delayed ${activeTab === 'DELAYED' ? 'active' : ''}`} onClick={() => setActiveTab('DELAYED')}>
          DELAYED
        </span>
      </div>

      <div className="dashboard-container" onScroll={handleScroll}>
        {filteredShipments.length === 0 && (
          <div className="empty-state">No {activeTab.toLowerCase()} shipments found.</div>
        )}

        {filteredShipments.map((shipment) => {
          const style = getCardStyle(shipment.currentStatus);
          const isNew = shipment.currentStatus === 'Pending' && isNewlyAssigned(shipment.creationTimestamp, shipment.shipmentID);
          
          const isDelayed = activeTab === 'DELAYED';
          const cardClass = isDelayed ? 'card-yellow' : style.class; 
          
          return (
            <div 
              key={shipment.shipmentID} 
              className={`shipment-card ${cardClass}`}
              onClick={() => handleCardClick(shipment)}
              style={isDelayed ? {borderLeft: '5px solid #c0392b'} : {}} 
            >
              {isNew && <div className="new-badge">NEW</div>}
              <div>
                <div className="card-id">SHIPMENT ID: #{shipment.shipmentID}</div>
                <div style={{display: "flex",flexDirection: "row",alignItems: "center", gap: "10px"}}>
                  <div className="card-client">{shipment.destName}</div>
                  |
                  <div className="card-location">{shipment.destLocation}</div>
                </div>
                <div className="card-dates-row">
                    <div className="date-line" style={{color: '#2980b9'}}>
                        <span className="date-label">Loading:</span> 
                        {formatDisplayDate(shipment.loadingDate)}
                    </div>
                    <div className="date-line" style={{color: activeTab === 'DELAYED' ? '#c0392b' : '#d35400'}}>
                        <span className="date-label">Delivery:</span> 
                        {formatDisplayDate(shipment.deliveryDate)}
                    </div>
                </div>

              </div>
              <div className="card-status-label">
                  {isDelayed ? <span style={{color:'#c0392b', fontWeight:'800'}}>DELAYED</span> : style.label}
              </div>
            </div>
          );
        })}    
      </div>

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