import { useState, useEffect } from 'react';
import axios from 'axios';
import logoPng from './assets/k2mac_logo.png'; 
import { Icons } from './components/Icons'; 
import Login from './components/Login';
import Dashboard from './components/Mobile/Dashboard';
import ShipmentDetails from './components/Mobile/ShipmentDetails';
import Profile from './components/Mobile/Profile';
import DesktopApp from './components/Desktop/DesktopApp';
import './App.css';

function App() {
  const [isKickedOut, setIsKickedOut] = useState(false);

  const [user, setUser] = useState(null); 
  const [token, setToken] = useState(null);
  
  const [shipments, setShipments] = useState([]);
  const [loading, setLoading] = useState(false);
  
  const [view, setView] = useState('dashboard'); 
  const [activeTab, setActiveTab] = useState('ACTIVE');
  const [selectedShipment, setSelectedShipment] = useState(null);
  const [modal, setModal] = useState({ show: false, shipmentID: null, statusName: null });

  // --- INITIAL LOAD & POLLING ---
  useEffect(() => {
    if (user && token) { 
        fetchShipments(); 
    }
  }, [user, token]);

  // --- REAL-TIME POLLING ---
  useEffect(() => {
    if (!user || !token) return;

    const intervalID = setInterval(() => {
        fetchShipments(true); 
    }, 3000);

    return () => clearInterval(intervalID);
  }, [user, token, selectedShipment]); 

  // --- FETCH SHIPMENTS ---
  const fetchShipments = async (isPolling = false) => {
    if (!user || !token) return;
    if (!isPolling) setLoading(true);

    try {
      // ATTACH THE TOKEN TO THE HEADER
      const config = {
        headers: { Authorization: `Bearer ${token}` }, // <--- THE KEY
        params: { userID: user.userID }
      };

      const response = await axios.get('http://localhost:4000/api/shipments', config);
      
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
            if (error.response && error.response.status === 401) {
          setLoading(false);
          setIsKickedOut(true); 
      }
    }
  };

  // --- LOGIN HANDLER ---
  const handleLoginSuccess = (loginData) => {
      setUser(loginData.user);
      setToken(loginData.token);
  };

  const handleLogout = () => {
      setUser(null);
      setToken(null);
      setShipments([]);
      setView('dashboard');
  };

  const handleCardClick = (shipment) => { setSelectedShipment(shipment); setView('details'); };
  const handleBackToDashboard = () => { setView('dashboard'); setSelectedShipment(null); fetchShipments(); };
  const handleProfileClick = () => { setView('profile'); };
  const handleStepClick = (shipmentID, statusName) => { setModal({ show: true, shipmentID, statusName }); };

  // --- UPDATE ACTION ---
  const confirmUpdate = async () => {
    if (!modal.shipmentID || !modal.statusName) return;
    
    const config = {
        headers: { Authorization: `Bearer ${token}` } // <--- Attach Token here too
    };

    try {
      await axios.post(`http://localhost:4000/api/shipments/${modal.shipmentID}/update`, {
        status: modal.statusName,
        userID: user.userID 
      }, config);

      if (modal.statusName === 'Departure') {
        await axios.post(`http://localhost:4000/api/shipments/${modal.shipmentID}/update`, {
          status: 'Completed',
          userID: user.userID 
        }, config);
      }
      
      fetchShipments(true);
      setModal({ show: false, shipmentID: null, statusName: null });
    } catch (error) {
      alert("Error updating status");
      if (error.response && error.response.status === 401) {
         handleLogout();
      }
      setModal({ show: false, shipmentID: null, statusName: null });
    }
  };

  const getStepStatus = (stepName, currentStatus) => {
    // HANDLE PENDING
    if (currentStatus === 'Pending') return 'inactive'; 

    const phases = ['Arrival', 'Start Unload', 'Finish Unload', 'Handover Invoice', 'Invoice Receive', 'Departure', 'Completed'];

    if (currentStatus === stepName) return 'active';

    if (phases.indexOf(currentStatus) > phases.indexOf(stepName)) return 'completed';
    
    return 'inactive';
};

  // --- RENDER LOGIC ---

  // 1. Not Logged In? -> Login Screen
  if (!user) return <Login onLoginSuccess={handleLoginSuccess} />;

  // 2. Admin or Operations? -> DESKTOP APP
  if (user.role === 'Admin' || user.role === 'Operations') {
      return <DesktopApp user={user} token={token} onLogout={handleLogout} />;
  }

  // 3. Crew or Driver? -> MOBILE APP
  if (loading && shipments.length === 0) return <div style={{padding: 20}}>Loading...</div>;

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
        />
      )}

      {view === 'profile' && (
        <Profile 
          user={user} 
          onBack={handleBackToDashboard} 
          onLogout={handleLogout} 
        />
      )}

      {/* CONFIRMATION MODAL */}
      {modal.show && (
        <div className="modal-overlay" onClick={() => setModal({ show: false, shipmentID: null })}>
          <div className="modal-box" onClick={(e) => e.stopPropagation()}>
            <div className="modal-title">Confirm Update</div>
            <div className="modal-text">
              Update status to: <br/><strong>"{modal.statusName}"</strong>?
            </div>
            <div className="modal-actions">
              <button className="modal-btn btn-cancel" onClick={() => setModal({ show: false, shipmentID: null })}>CANCEL</button>
              <button className="modal-btn btn-confirm" onClick={confirmUpdate}>CONFIRM</button>
            </div>
          </div>
        </div>
      )}

      {/* KICKOUT MODAL */}
      {isKickedOut && (
        <div className="modal-overlay">
          <div className="modal-box" style={{ textAlign: 'center', padding: '30px' }}>
            <div style={{ marginBottom: '15px' }}>
              <svg width="60" height="60" viewBox="0 0 24 24" fill="#E65100">
                <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"/>
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
              onClick={() => {
                  setIsKickedOut(false);
                  handleLogout(); 
              }}
            >
              LOG IN AGAIN
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;