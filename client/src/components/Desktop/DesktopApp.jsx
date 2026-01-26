import React, { useState, useEffect } from 'react';
import logoPng from '../../assets/k2mac_logo2.png'; 
import { Icons } from '../Icons'; 
import './DesktopApp.css'; 

// Import Views
import ShipmentView from './ShipmentView';
import KPIView from './KPIView';
import PayrollView from './PayrollView';  
import UserManagement from './UserManagement'; 

function DesktopApp({ user, token, onLogout }) {
  // --- STATE ---
  const [view, setView] = useState('shipments'); 
  const [currentTime, setCurrentTime] = useState(new Date());
  const [showProfile, setShowProfile] = useState(false);

  // STATE FOR RESOURCE TAB (Users vs Trucks)
  const [resourceTab, setResourceTab] = useState('users'); 

  // --- EFFECTS ---
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    const closeMenu = () => setShowProfile(false);
    if (showProfile) window.addEventListener('click', closeMenu);
    return () => window.removeEventListener('click', closeMenu);
  }, [showProfile]);

  const getHeaderTitle = () => {
      switch(view) {
          case 'shipments': return 'Shipment Monitoring';
          case 'analytics': return 'KPI Analysis Dashboard';
          case 'payroll': return 'Dynamic Payroll Suggestion';
          case 'users': return 'Resource Management'; 
          default: return 'Dashboard';
      }
  };

  // --- RENDER ---
  return (
    <div className="desktop-layout">
      {/* SIDEBAR */}
      <aside className="sidebar-rail">
        <div className="rail-logo"><img src={logoPng} alt="Logo" /></div>
        
        {/* Navigation */}
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
                title="KPI Analytics"
            >
                <Icons.Analytics />
            </button>
            {user.role === 'Admin' && (
                <>
                    {/* Payroll */}
                    <button 
                        className={`rail-btn ${view === 'payroll' ? 'active' : ''}`} 
                        onClick={() => setView('payroll')} 
                        title="Payroll Suggestion"
                    >
                        <Icons.Wallet />
                    </button>
                    {/* Resource Management (Users/Trucks) */}
                    <button 
                        className={`rail-btn ${view === 'users' ? 'active' : ''}`} 
                        onClick={() => setView('users')} 
                        title="Resource Management"
                    >
                        <Icons.Group />
                    </button>
                </>
            )}
        </nav>
        
        {/* PROFILE FOOTER */}
        <div className="rail-footer">
            <div 
                className={`rail-profile ${showProfile ? 'active' : ''}`} 
                onClick={(e) => {
                    e.stopPropagation(); 
                    setShowProfile(!showProfile);
                }}
            >
                <Icons.Profile />
            </div>

            {/* POPUP MENU */}
            {showProfile && (
                <div className="profile-popup-menu" onClick={(e) => e.stopPropagation()}>
                    <div className="menu-header">
                        <div className="menu-avatar"><Icons.Profile /></div>
                        <div className="menu-info">
                            <span className="menu-name">
                                {user.firstName || 'Admin'} {user.lastName || 'User'}
                            </span>
                            <span className="menu-role-sub">{user.role}</span>
                        </div>
                    </div>
                    
                    <div className="menu-divider"></div>
                    <button className="menu-logout-btn" onClick={onLogout}>
                        Log Out
                    </button>
                </div>
            )}
        </div>
      </aside>

      <main className="main-content">
        <header className="top-header">
            <div className="header-left">
                <div style={{display: 'flex', alignItems: 'center', gap: '25px'}}>
                    <h1>{getHeaderTitle()}</h1>

                    {/* ANIMATED SWITCH */}
                    {view === 'users' && (
                        <div className="resource-switch">
                            {/* The sliding white background */}
                            <div className={`switch-bg ${resourceTab}`}></div>
                            
                            <button 
                                className={`switch-option ${resourceTab === 'users' ? 'active' : ''}`}
                                onClick={() => setResourceTab('users')}
                            >
                                Users
                            </button>
                            <button 
                                className={`switch-option ${resourceTab === 'trucks' ? 'active' : ''}`}
                                onClick={() => setResourceTab('trucks')}
                            >
                                Trucks
                            </button>
                        </div>
                    )}
                </div>
            </div>
            <div className="header-right">
                <div className="welcome-box">
                    <div className="welcome-text">Welcome, {user.role}</div>
                    <div className="date-text">{currentTime.toLocaleDateString()} {currentTime.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</div>
                </div>
            </div>
        </header>

        <div className="content-body">
            {view === 'shipments' && <ShipmentView user={user} token={token} onLogout={onLogout} />}
            {view === 'analytics' && <KPIView />}
            
            {/* ADMIN ONLY VIEWS */}
            {view === 'payroll' && user.role === 'Admin' && <PayrollView />}
            
            {/* activeTab prop so it switches between Users and Trucks */}
            {view === 'users' && user.role === 'Admin' && (
                <UserManagement activeTab={resourceTab} />
            )}
        </div>
      </main>
    </div>
  );
}

export default DesktopApp;