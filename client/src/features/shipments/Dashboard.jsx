import { useState, useEffect, memo, useRef } from 'react';
import { Icons } from '@shared';
import { getTodayString, getDateValue, formatDateDisplay } from '@constants';
import '@styles/features/shipments.css';

const Dashboard = memo(({ shipments, activeTab, setActiveTab, onCardClick }) => {
  const [isAtBottom, setIsAtBottom] = useState(false);
  const [hasOverflow, setHasOverflow] = useState(false);
  const containerRef = useRef(null);
  const [seenShipments, setSeenShipments] = useState(() => {
    try {
      const saved = localStorage.getItem('acknowledgedShipments');
      return saved ? JSON.parse(saved) : [];
    } catch (e) { return []; }
  });

  useEffect(() => {
    localStorage.setItem('acknowledgedShipments', JSON.stringify(seenShipments));
  }, [seenShipments]);

  // Scroll handler to toggle the safe zone/arrow visibility
  const handleScroll = (e) => {
    const bottom = e.target.scrollHeight - e.target.scrollTop <= e.target.clientHeight + 20; // Added buffer
    setIsAtBottom(bottom);
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

  const todayOnlyNewCount = shipments.filter(s => {
    const today = getTodayString();
    const loadDate = getDateValue(s.loadingDate);
    return s.currentStatus === 'Pending' && isNewlyAssigned(s.creationTimestamp, s.shipmentID) && loadDate === today;
  }).length;

  const handleCardClick = (shipment) => {
    const strId = String(shipment.shipmentID);
    if (!seenShipments.some(id => String(id) === strId)) {
      const newSeenList = [...seenShipments, strId];
      setSeenShipments(newSeenList);
      localStorage.setItem('acknowledgedShipments', JSON.stringify(newSeenList));
    }
    onCardClick(shipment);
  };

  const getCardStyle = (shipment) => {
    const today = getTodayString();
    const delDate = getDateValue(shipment.deliveryDate);
    const loadDate = getDateValue(shipment.loadingDate);
    const status = shipment.currentStatus;

    if (status === 'Completed') return { class: 'card-green', label: 'COMPLETED' };
    
    // In Transit: Explicitly Start Route or Loaded (even if delivery day is today, as long as not yet arrived)
    if (status === 'Start Route' || (status === 'Loaded' && delDate > today)) {
        return { class: 'card-blue', label: 'IN TRANSIT' };
    }

    if (status === 'Pending') return { class: 'card-blue', label: 'TO LOAD' };
    return { class: 'card-yellow', label: 'IN PROGRESS' };
  };

  const filteredShipments = shipments.filter(s => {
    const today = getTodayString();
    const loadDate = getDateValue(s.loadingDate);
    const delDate = getDateValue(s.deliveryDate);

    if (activeTab === 'COMPLETED') return s.currentStatus === 'Completed';

    if (s.currentStatus !== 'Completed') {
      if (activeTab === 'DELAYED') {
        return (delDate && delDate < today) || 
               (loadDate && loadDate < today && s.currentStatus !== 'Loaded');
      }
      if (activeTab === 'UPCOMING') return loadDate > today && s.currentStatus === 'Pending';
      if (activeTab === 'ACTIVE') {
        // Active if:
        // 1. Delivering Today
        // 2. Loading Today
        // 3. In Transit (Loaded) even if delivery is future
        return (delDate === today) || 
               (loadDate === today) ||
               (s.currentStatus === 'Loaded' && delDate >= today);
      }
    }
    return false;
  });

  // SORTING: For Completed tab, show NEWEST first.
  if (activeTab === 'COMPLETED') {
    filteredShipments.sort((a, b) => {
      const dateA = getDateValue(a.deliveryDate) ? new Date(a.deliveryDate) : new Date(0);
      const dateB = getDateValue(b.deliveryDate) ? new Date(b.deliveryDate) : new Date(0);
      return dateB - dateA; 
    });
  }

  useEffect(() => {
    const checkOverflow = () => {
      if (containerRef.current) {
         // Check if scrollHeight is significantly larger than clientHeight
         const isOverflowing = containerRef.current.scrollHeight > containerRef.current.clientHeight;
         setHasOverflow(isOverflowing);
      }
    };
    
    checkOverflow();
    window.addEventListener('resize', checkOverflow);
    return () => window.removeEventListener('resize', checkOverflow);
  }, [filteredShipments, activeTab]);

  const getBannerContent = () => {
    const count = filteredShipments.length;
    if (activeTab === 'ACTIVE' && todayOnlyNewCount > 0) {
      return {
        class: 'alert',
        icon: <Icons.Truck style={{ width: 18, height: 18 }} stroke="white" fill="black" />,
        text: `You have ${todayOnlyNewCount} new shipment assignment(s) today!`
      };
    }
    if (activeTab === 'DELAYED') {
      return {
        class: 'delayed',
        icon: <Icons.AlertCircle style={{ width: 18, height: 18 }} />,
        text: count > 0 ? `${count} Shipment(s) marked as Delayed` : 'No Delayed Shipments'
      };
    }
    if (activeTab === 'COMPLETED') {
      return {
        class: 'completed',
        icon: <Icons.CheckCircle style={{ width: 18, height: 18 }} />,
        text: `${count} Shipment(s) Completed`
      };
    }
    return {
      class: 'info',
      icon: <Icons.Calendar style={{ width: 18, height: 18 }} />,
      text: `${count} ${activeTab.toLowerCase().replace(/\b\w/g, s => s.toUpperCase())} Shipment(s)`
    };
  };

  const banner = getBannerContent();
  const animationKey = (activeTab === 'ACTIVE' || activeTab === 'UPCOMING') ? 'active-upcoming-group' : activeTab;

  return (
    <div className="dashboard-wrapper">
      <div className={`status-bar-container ${banner.class}`}>
        <div className="status-bar-content" key={animationKey}>
          {banner.icon}
          <span>{banner.text}</span>
        </div>
      </div>

      <div className="tabs">
        <span className={`tab ${activeTab === 'ACTIVE' ? 'active' : ''}`} onClick={() => setActiveTab('ACTIVE')}>ACTIVE</span>
        <span className={`tab ${activeTab === 'UPCOMING' ? 'active' : ''}`} onClick={() => setActiveTab('UPCOMING')}>UPCOMING</span>
        <span className={`tab ${activeTab === 'COMPLETED' ? 'active' : ''}`} onClick={() => setActiveTab('COMPLETED')}>COMPLETED</span>
        <span className={`tab delayed ${activeTab === 'DELAYED' ? 'active' : ''}`} onClick={() => setActiveTab('DELAYED')}>DELAYED</span>
      </div>

      <div className="dashboard-container" onScroll={handleScroll} ref={containerRef}>
        {filteredShipments.length === 0 && (
          <div className="empty-state">No {activeTab.toLowerCase()} shipments found.</div>
        )}

        {filteredShipments.map((shipment) => {
          const style = getCardStyle(shipment);
          const isNew = shipment.currentStatus === 'Pending' && isNewlyAssigned(shipment.creationTimestamp, shipment.shipmentID);
          const isDelayed = activeTab === 'DELAYED';
          const isUpcoming = activeTab === 'UPCOMING';
          const isInTransit = style.label === 'IN TRANSIT';
          const cardClass = isDelayed ? 'card-yellow' : style.class;

          return (
            <div
              key={shipment.shipmentID}
              className={`shipment-card ${cardClass} ${isUpcoming ? 'disabled-card upcoming-card' : ''} ${isInTransit ? 'transit-card' : ''}`}
              onClick={isUpcoming ? undefined : () => handleCardClick(shipment)}
            >
              {isUpcoming ? (
                <div className="new-badge scheduled">SCHEDULED</div>
              ) : isInTransit ? (
                <div className="new-badge transit">IN TRANSIT</div>
              ) : (
                isNew && <div className="new-badge">NEW</div>
              )}
              <div>
                <div className="card-id">SHIPMENT ID: #{shipment.shipmentID}</div>
                <div style={{ display: "flex", flexDirection: "row", alignItems: "center", gap: "10px" }}>
                  <div className="card-client">{shipment.destName}</div>
                  |
                  <div className="card-location">{shipment.destLocation}</div>
                </div>
                <div className="card-dates-row">
                  <div className="date-line" style={{ color: '#2980b9' }}>
                    <span className="date-label">Loading:</span> {formatDateDisplay(shipment.loadingDate)}
                  </div>
                  <div className="date-line" style={{ color: activeTab === 'DELAYED' ? '#c0392b' : '#d35400' }}>
                    <span className="date-label">Delivery:</span> {formatDateDisplay(shipment.deliveryDate)}
                  </div>
                </div>
              </div>
              <div className="card-status-label">
                {isDelayed ? <span style={{ color: '#c0392b', fontWeight: '800' }}>DELAYED</span> : style.label}
              </div>
            </div>
          );
        })}
      </div>

      <div className={`safe-zone-footer ${isAtBottom || !hasOverflow ? 'hidden' : ''}`}>
        {hasOverflow && (
          <div className={`scroll-arrow ${isAtBottom ? 'hidden' : ''}`}>
            <span>Scroll for More</span>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#333" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M7 13l5 5 5-5M7 6l5 5 5-5" />
            </svg>
          </div>
        )}
      </div>
    </div>
  );
});

export default Dashboard;
