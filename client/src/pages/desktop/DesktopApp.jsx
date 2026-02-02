import { useState, useEffect, useRef, useCallback } from 'react';
import logoPng from '@assets/k2mac_logo2.png';
import { Icons } from '@shared';
import api from '@utils/api';
import '@styles/pages/desktop-app.css';

import ShipmentView from '@features/shipments/ShipmentView';
import KPIView from '@features/analytics/KPIView';
import PayrollView from '@features/payroll/PayrollView';
import UserManagement from '@features/resources/UserManagement';

const IDLE_TIMEOUT_MS = 30 * 60 * 1000;

function DesktopApp({ user, token, onLogout }) {
  const [view, setView] = useState('shipments');
  const [currentTime, setCurrentTime] = useState(new Date());
  const [showProfile, setShowProfile] = useState(false);
  const [resourceTab, setResourceTab] = useState('users');
  const lastActivityRef = useRef(Date.now());
  const timerIdRef = useRef(null);

  const handleLogoutClick = useCallback(async (reason = 'USER_INITIATED') => {
    try {
      const config = token ? { headers: { Authorization: `Bearer ${token}` } } : {};
      const details = reason === 'IDLE_TIMEOUT'
        ? 'System auto-logout due to inactivity'
        : 'User logged out via Desktop Portal';

      await api.post('/logs', {
        action: 'LOGOUT',
        details,
        timestamp: new Date().toISOString()
      }, config);
    } catch {
      void 0;
    } finally {
      onLogout();
    }
  }, [token, onLogout]);

  useEffect(() => {
    const events = ['mousemove', 'keydown', 'click', 'scroll', 'touchstart'];
    const resetTimer = () => { lastActivityRef.current = Date.now(); };
    const checkForInactivity = () => {
      if (Date.now() - lastActivityRef.current >= IDLE_TIMEOUT_MS) {
        handleLogoutClick('IDLE_TIMEOUT');
      }
    };

    events.forEach(event => window.addEventListener(event, resetTimer));
    timerIdRef.current = setInterval(checkForInactivity, 60000);
    return () => {
      events.forEach(event => window.removeEventListener(event, resetTimer));
      if (timerIdRef.current) clearInterval(timerIdRef.current);
    };
  }, [handleLogoutClick]);

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
    switch (view) {
      case 'shipments': return 'Shipment Monitoring';
      case 'analytics': return 'KPI Analysis Dashboard';
      case 'payroll': return 'Dynamic Payroll Suggestion';
      case 'users': return 'Resource Management';
      default: return 'Dashboard';
    }
  };

  return (
    <div className="desktop-layout">
      <aside className="sidebar-rail">
        <div className="rail-logo"><img src={logoPng} alt="Logo" /></div>

        <nav className="rail-menu">
          <button className={`rail-btn ${view === 'shipments' ? 'active' : ''}`} onClick={() => setView('shipments')}>
            <Icons.Truck />
          </button>
          <button className={`rail-btn ${view === 'analytics' ? 'active' : ''}`} onClick={() => setView('analytics')}>
            <Icons.Analytics />
          </button>
          {user.role === 'Admin' && (
            <>
              <button className={`rail-btn ${view === 'payroll' ? 'active' : ''}`} onClick={() => setView('payroll')}>
                <Icons.Wallet />
              </button>
              <button className={`rail-btn ${view === 'users' ? 'active' : ''}`} onClick={() => setView('users')}>
                <Icons.List />
              </button>
            </>
          )}
        </nav>

        <div className="rail-footer">
          <div
            className={`rail-profile ${showProfile ? 'active' : ''}`}
            onClick={(e) => { e.stopPropagation(); setShowProfile(!showProfile); }}
          >
            <Icons.Profile />
          </div>

          {showProfile && (
            <div className="profile-popup-menu" onClick={(e) => e.stopPropagation()}>
              <div className="menu-header">
                <div className="menu-avatar"><Icons.Profile /></div>
                <div className="menu-info">
                  <span className="menu-name">{user.firstName || 'Admin'} {user.lastName || 'User'}</span>
                  <span className="menu-role-sub">{user.role}</span>
                </div>
              </div>
              <div className="menu-divider"></div>
              <button className="menu-logout-btn" onClick={() => handleLogoutClick('USER_INITIATED')}>
                Log Out
              </button>
            </div>
          )}
        </div>
      </aside>

      <main className="main-content">
        <header className="top-header">
          <div className="header-left">
            <div style={{ display: 'flex', alignItems: 'center', gap: '25px' }}>
              <h1>{getHeaderTitle()}</h1>

              {view === 'users' && (
                <div className="resource-switch" style={{ width: '300px' }}>
                  <div
                    className="switch-bg"
                    style={{
                      width: '95px',
                      transform: resourceTab === 'users' ? 'translateX(2px)'
                        : resourceTab === 'trucks' ? 'translateX(100px)'
                        : 'translateX(198px)'
                    }}
                  />
                  <button className={`switch-option ${resourceTab === 'users' ? 'active' : ''}`} onClick={() => setResourceTab('users')}>Users</button>
                  <button className={`switch-option ${resourceTab === 'trucks' ? 'active' : ''}`} onClick={() => setResourceTab('trucks')}>Trucks</button>
                  <button className={`switch-option ${resourceTab === 'logs' ? 'active' : ''}`} onClick={() => setResourceTab('logs')}>Logs</button>
                </div>
              )}
            </div>
          </div>
          <div className="header-right">
            <div className="welcome-box">
              <div className="welcome-text">Welcome, {user.role}</div>
              <div className="date-text">{currentTime.toLocaleDateString()} {currentTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
            </div>
          </div>
        </header>

        <div className="content-body">
          {view === 'shipments' && <ShipmentView user={user} token={token} onLogout={onLogout} />}
          {view === 'analytics' && <KPIView />}
          {view === 'payroll' && user.role === 'Admin' && <PayrollView />}
          {view === 'users' && user.role === 'Admin' && <UserManagement activeTab={resourceTab} />}
        </div>
      </main>
    </div>
  );
}

export default DesktopApp;
