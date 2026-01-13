import React, { useState, useEffect } from 'react';
import axios from 'axios';
import logoPng from '../assets/k2mac_logo2.png';
import { Icons } from './Icons'; 
import './DesktopApp.css'; 

function DesktopApp({ user, token, onLogout }) {
  const [view, setView] = useState('shipments'); // 'shipments' or 'analytics'
  const [currentTime, setCurrentTime] = useState(new Date());
  const [shipments, setShipments] = useState([]);

  // Live Clock
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Fetch Data
  useEffect(() => {
    fetchData();
  }, [token]); // Add token dependency

  const fetchData = async () => {
    try {
        const config = { headers: { Authorization: `Bearer ${token}` } };
        // Fetch all shipments
        const response = await axios.get('http://localhost:4000/api/shipments', {
            ...config,
            params: { userID: user.userID } 
        });
        setShipments(response.data);
    } catch (err) {
        console.error("Error loading data", err);
        if (err.response?.status === 401) onLogout();
    }
  };

  // Helper for Status Colors
  const getStatusColor = (status) => {
      switch(status) {
          case 'Arrival': return '#EB5757'; // Red
          case 'Start Unload': return '#27AE60'; // Green
          case 'Handover Invoice': return '#F2C94C'; // Yellow
          case 'Completed': return '#27AE60';
          default: return '#333';
      }
  };

  return (
    <div className="desktop-layout">
      
      {/* --- SIDEBAR RAIL --- */}
      <aside className="sidebar-rail">
        <div className="rail-logo">
           <img src={logoPng} alt="Logo" />
        </div>

        <nav className="rail-menu">
            <button 
                className={`rail-btn ${view === 'shipments' ? 'active' : ''}`}
                onClick={() => setView('shipments')}
                title="Shipments"
            >
                <Icons.Truck />
            </button>
            
            <button 
                className={`rail-btn ${view === 'analytics' ? 'active' : ''}`}
                onClick={() => setView('analytics')}
                title="Analytics"
            >
                <svg viewBox="0 0 24 24" fill="currentColor" width="24" height="24"><path d="M3 13h8V3H3v10zm0 8h8v-6H3v6zm10 0h8V11h-8v10zm0-18v6h8V3h-8z"/></svg>
            </button>
        </nav>

        <div className="rail-footer">
            <div className="rail-profile" onClick={onLogout} title="Logout">
                <Icons.Profile />
            </div>
        </div>
      </aside>

      {/* --- MAIN CONTENT AREA --- */}
      <main className="main-content">
        
        {/* HEADER */}
        <header className="top-header">
            <div className="header-left">
                <h1>Shipment Monitoring</h1>
            </div>
            
            <div className="header-right">
                <div className="welcome-box">
                    <div className="welcome-text">Welcome, {user.role}</div>
                    <div className="date-text">
                        {currentTime.toLocaleDateString()} {currentTime.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                    </div>
                </div>
                <button className="new-shipment-btn">
                    + New Shipment
                </button>
            </div>
        </header>

        {/* TABLE VIEW */}
        <div className="content-body">
            {view === 'shipments' && (
                <div className="table-container">
                    <table className="custom-table">
                        <thead>
                            <tr>
                                <th>Shipment ID</th>
                                <th>Status</th>
                                <th>Destination Name</th>
                                <th>Destination Location</th>
                                <th>Plate No.</th>
                                <th>Assigned Crew</th>
                                <th></th>
                            </tr>
                        </thead>
                        <tbody>
                            {shipments.map(s => (
                                <tr key={s.shipmentID}>
                                    <td>{s.shipmentID}</td>
                                    <td>
                                        <span className="status-dot" style={{backgroundColor: getStatusColor(s.currentStatus)}}></span>
                                        {s.currentStatus}
                                    </td>
                                    <td>ABC Logistics Hub</td> 
                                    <td>{s.destLocation}</td>
                                    <td>N/A</td>
                                    <td>
                                        <div className="crew-avatars">
                                            <div className="mini-avatar"><Icons.Profile/></div>
                                            <div className="mini-avatar"><Icons.Profile/></div>
                                        </div>
                                    </td>
                                    <td>
                                        <button className="expand-btn">▼</button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
            
            {view === 'analytics' && <div className="placeholder">Analytics Module Coming Soon</div>}
        </div>
      </main>
    </div>
  );
}

export default DesktopApp;