import { useState, useEffect } from 'react';
import api from '@utils/api';
import logoPng from '@assets/k2mac_logo.png';
import { Icons } from '@shared';
import '@styles/pages/mobile-app.css';

import Dashboard from '@features/shipments/Dashboard';
import ShipmentDetails from '@features/shipments/ShipmentDetails';
import ProfileModal from '@features/profile/ProfileModal';

function MobileApp({ user, token, onLogout }) {
  const [isKickedOut, setIsKickedOut] = useState(false);
  const [shipments, setShipments] = useState([]);
  const [loading, setLoading] = useState(false);
  const [view, setView] = useState('dashboard');
  const [activeTab, setActiveTab] = useState('ACTIVE');
  const [selectedShipment, setSelectedShipment] = useState(null);
  const [modal, setModal] = useState({ show: false, shipmentID: null, statusName: null });
  const [showProfile, setShowProfile] = useState(false);

  useEffect(() => {
    fetchShipments();
  }, []);

  useEffect(() => {
    const intervalID = setInterval(() => fetchShipments(true), 3000);
    return () => clearInterval(intervalID);
  }, [selectedShipment]);

  const fetchShipments = async (isPolling = false) => {
    if (!isPolling) setLoading(true);

    try {
      const config = {
        headers: { Authorization: `Bearer ${token}` },
        params: { userID: user.userID }
      };
      const response = await api.get('/shipments', config);
      const newData = response.data;
      setShipments(newData);

      if (selectedShipment) {
        const updatedView = newData.find(s => s.shipmentID === selectedShipment.shipmentID);
        if (updatedView && updatedView.currentStatus !== selectedShipment.currentStatus) {
          setSelectedShipment(updatedView);
        }
      }
      setLoading(false);
    } catch (error) {
      if (error.response?.status === 401) {
        setLoading(false);
        setIsKickedOut(true);
      }
    }
  };

  const handleCardClick = (shipment) => {
    setSelectedShipment(shipment);
    setView('details');
  };

  const handleBackToDashboard = () => {
    setView('dashboard');
    setSelectedShipment(null);
    fetchShipments();
  };

  const handleProfileClick = () => setShowProfile(true);

  const handleStepClick = (shipmentID, statusName) => {
    setModal({ show: true, shipmentID, statusName });
  };

  const confirmUpdate = async () => {
    if (!modal.shipmentID || !modal.statusName) return;

    const config = { headers: { Authorization: `Bearer ${token}` } };

    try {
      await api.put(`/shipments/${modal.shipmentID}/status`, {
        status: modal.statusName,
        userID: user.userID
      }, config);

      if (modal.statusName === 'Departure') {
        await api.put(`/shipments/${modal.shipmentID}/status`, {
          status: 'Completed',
          userID: user.userID
        }, config);
      }

      fetchShipments(true);
      setModal({ show: false, shipmentID: null, statusName: null });
    } catch (error) {
      alert("Error updating status");
      if (error.response?.status === 401) onLogout();
      setModal({ show: false, shipmentID: null, statusName: null });
    }
  };

  if (loading && shipments.length === 0) {
    return <div style={{ padding: 20 }}>Loading...</div>;
  }

  return (
    <div className="mobile-app">
      <div className="mobile-header">
        <div className="profile-icon" onClick={handleProfileClick}>
          <Icons.Profile className="header-profile-svg" />
        </div>
        <img src={logoPng} alt="K2MAC Logo" className="header-logo" />
      </div>

      {view === 'dashboard' && (
        <Dashboard
          shipments={shipments}
          activeTab={activeTab}
          setActiveTab={setActiveTab}
          onCardClick={handleCardClick}
        />
      )}

      {view === 'details' && selectedShipment && (
        <ShipmentDetails
          shipment={selectedShipment}
          onStepClick={handleStepClick}
          onBack={handleBackToDashboard}
          token={token}
          user={user}
        />
      )}

      {showProfile && (
        <ProfileModal
          user={user}
          token={token}
          onClose={() => setShowProfile(false)}
          onLogout={onLogout}
        />
      )}

      {modal.show && (
        <div className="modal-overlay" onClick={() => setModal({ show: false, shipmentID: null })}>
          <div className="modal-box" onClick={(e) => e.stopPropagation()}>
            <div className="modal-title">Confirm Update</div>
            <div className="modal-text">
              Update status to: <br /><strong>"{modal.statusName}"</strong>?
            </div>
            <div className="modal-actions">
              <button className="modal-btn btn-cancel" onClick={() => setModal({ show: false, shipmentID: null })}>CANCEL</button>
              <button className="modal-btn btn-confirm" onClick={confirmUpdate}>CONFIRM</button>
            </div>
          </div>
        </div>
      )}

      {isKickedOut && (
        <div className="modal-overlay">
          <div className="modal-box" style={{ textAlign: 'center', padding: '30px' }}>
            <div style={{ marginBottom: '15px' }}>
              <svg width="60" height="60" viewBox="0 0 24 24" fill="#E65100">
                <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z" />
              </svg>
            </div>
            <div className="modal-title" style={{ color: '#D32F2F', marginBottom: '10px' }}>
              Session Expired
            </div>
            <div className="modal-text" style={{ marginBottom: '25px', fontSize: '0.95em', color: '#555' }}>
              Your account was logged in on another device. For security, this session has been terminated.
            </div>
            <button
              className="modal-btn"
              style={{ width: '100%', backgroundColor: '#E65100', color: 'white', fontWeight: 'bold' }}
              onClick={() => { setIsKickedOut(false); onLogout(); }}
            >
              LOG IN AGAIN
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default MobileApp;
