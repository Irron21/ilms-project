import React, { useState, useEffect, useRef } from 'react';
import api from '../../utils/api';
import './UserManagement.css';
import FeedbackModal from '../FeedbackModal';
import { Icons } from '../Icons';

// --- REUSABLE PAGINATION COMPONENT ---
const PaginationControls = ({ currentPage, totalItems, rowsPerPage, onPageChange }) => {
    const totalPages = Math.ceil(totalItems / rowsPerPage) || 1;
    
    // Sliding Window Logic (Show 5 pages at a time)
    const currentBlock = Math.ceil(currentPage / 5);
    const startPage = (currentBlock - 1) * 5 + 1;
    const endPage = Math.min(startPage + 4, totalPages);

    const pageNumbers = [];
    for (let i = startPage; i <= endPage; i++) pageNumbers.push(i);

    if (totalPages <= 1) return null;

    return (
        <div className="pagination-footer">
            <button 
                disabled={currentPage === 1} 
                onClick={() => onPageChange(currentPage - 1)}
            >
                Prev
            </button>
            {pageNumbers.map(num => (
                <button 
                    key={num} 
                    className={currentPage === num ? 'active' : ''} 
                    onClick={() => onPageChange(num)}
                >
                    {num}
                </button>
            ))}
            <button 
                disabled={currentPage === totalPages} 
                onClick={() => onPageChange(currentPage + 1)}
            >
                Next
            </button>
        </div>
    );
};

function UserManagement({ activeTab = "users" }) { 
  
  const token = localStorage.getItem('token'); 
  const rowsPerPage = 10;

  // --- INDEPENDENT PAGINATION STATE ---
  // This prevents "Page 23" from leaking into the Users tab
  const [userPage, setUserPage] = useState(1);
  const [truckPage, setTruckPage] = useState(1);
  const [logPage, setLogPage] = useState(1);

  // Data
  const [users, setUsers] = useState([]);
  const [vehicles, setVehicles] = useState([]);
  const [logs, setLogs] = useState([]);
  const [showResetModal, setShowResetModal] = useState(false);
  const [resetData, setResetData] = useState({ userID: null, name: '', newPassword: '' });

  // Counts (Required for server-side pagination)
  const [totalLogItems, setTotalLogItems] = useState(0); 

  // Filters
  const [roleFilter, setRoleFilter] = useState('All');
  const [truckFilter, setTruckFilter] = useState('All');
  
  // LOGS FILTERS
  const [logFilter, setLogFilter] = useState('All');      
  const [logTimeframe, setLogTimeframe] = useState('All'); 
  const [logRoleFilter, setLogRoleFilter] = useState('All'); 
  const [dynamicActionTypes, setDynamicActionTypes] = useState([]);

  const [showArchived, setShowArchived] = useState(false);
  const [loadingLogs, setLoadingLogs] = useState(false); 

  // Modal Visibility & Forms
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showTruckModal, setShowTruckModal] = useState(false);
  const [showEditTruckModal, setShowEditTruckModal] = useState(false);
  const [feedbackModal, setFeedbackModal] = useState(null); 
  const [currentUser, setCurrentUser] = useState(null);
  const [currentVehicle, setCurrentVehicle] = useState(null);
  
  const [userForm, setUserForm] = useState({ firstName: '', lastName: '', email: '', phone: '', dob: '', role: 'Admin', password: '', confirmPassword: '' });
  const [truckForm, setTruckForm] = useState({ plateNo: '', type: '6-Wheeler', status: 'Working' });

  // --- DATA LOADING ---

  // 1. Initial Load based on Tab
  useEffect(() => {
    if (activeTab === 'users') fetchUsers();
    else if (activeTab === 'trucks') fetchVehicles();
    else if (activeTab === 'logs') {
        fetchLogs(); // Initial fetch
        if (dynamicActionTypes.length === 0) fetchActionTypes();
    }
  }, [activeTab, showArchived]);

  // 2. Fetch Logs when Page OR Filters Change
  useEffect(() => {
    if (activeTab === 'logs') fetchLogs();
  }, [activeTab, logPage, logFilter, logRoleFilter, logTimeframe]);

  const fetchUsers = async () => {
    try {
        const res = await api.get(`/users?archived=${showArchived}`, { headers: { Authorization: `Bearer ${token}` } });
        setUsers(res.data);
    } catch (err) { console.error(err); }
  };
  
  const fetchVehicles = async () => {
    try {
        const res = await api.get(`/vehicles?archived=${showArchived}`, { headers: { Authorization: `Bearer ${token}` } });
        setVehicles(res.data);
    } catch (err) { console.error(err); }
  };

  const fetchActionTypes = async () => {
      try {
          const res = await api.get('/logs/actions', { headers: { Authorization: `Bearer ${token}` } });
          setDynamicActionTypes(['All', ...res.data]);
      } catch (err) { console.error(err); }
  };

  // ✅ UPDATED: Robust Log Fetching
  const fetchLogs = async () => {
    if (loadingLogs) return;
      setLoadingLogs(true);
      try {
        await new Promise(resolve => setTimeout(resolve, 600));
          const params = new URLSearchParams({
              page: logPage, // Use independent state
              limit: rowsPerPage,
              action: logFilter,
              role: logRoleFilter,
              timeframe: logTimeframe
          });

          const res = await api.get(`/logs/history?${params.toString()}`, { 
              headers: { Authorization: `Bearer ${token}` } 
          });
          
          setLogs(res.data.data); 
          setTotalLogItems(res.data.pagination.totalItems); 
      } catch (err) { 
          console.error("Log fetch error", err); 
      } finally {
          setLoadingLogs(false);
      }
  };

  // --- HANDLERS ---

  const initiateResetPassword = (user) => {
      setResetData({ userID: user.userID, name: `${user.firstName} ${user.lastName}`, newPassword: '' });
      setShowResetModal(true);
  };

  // ✅ NEW: Handle Reset Submit
  const handleResetSubmit = async (e) => {
      e.preventDefault();
      try {
          await api.put(`/users/${resetData.userID}/reset-password`, { newPassword: resetData.newPassword }, { headers: { Authorization: `Bearer ${token}` } });
          setShowResetModal(false);
          setFeedbackModal({ 
              type: 'success', 
              title: 'Password Reset', 
              message: `Password for ${resetData.name} has been updated successfully.`,
              onClose: () => setFeedbackModal(null)
          });
      } catch (err) {
          setFeedbackModal({ 
              type: 'error', 
              title: 'Reset Failed', 
              message: err.response?.data?.error || "Could not reset password.",
              onClose: () => setFeedbackModal(null)
          });
      }
  };

  // Helper to handle filter changes safely
  const handleLogFilterChange = (setter, value) => {
      setter(value);
      setLogPage(1); // Always reset to page 1 on filter change
  };

  const handleUserInputChange = (e) => {
    const { name, value } = e.target;
    e.target.setCustomValidity(''); 
    if (name === 'phone' && (!/^\d*$/.test(value) || value.length > 11)) return;
    setUserForm(prev => ({ ...prev, [name]: value }));
  };

  // ... (Keep Submit/Update/Delete/Restore Logic Identical to before) ...
  // [Paste handleCreateSubmit, handleUpdateSubmit, handleTruckSubmit, etc. here]
  // Assuming these standard CRUD functions are unchanged.
  const handleCreateSubmit = async (e) => { e.preventDefault(); try { await api.post('/users/create', userForm, { headers: { Authorization: `Bearer ${token}` } }); setShowCreateModal(false); fetchUsers(); setFeedbackModal({ type: 'success', title: 'User Created', message: 'Success', onClose: () => setFeedbackModal(null) }); } catch (err) { setFeedbackModal({ type: 'error', title: 'Error', message: 'Failed', onClose: () => setFeedbackModal(null) }); } };
  const handleUpdateSubmit = async (e) => { e.preventDefault(); try { await api.put(`/users/${currentUser.userID}`, userForm, { headers: { Authorization: `Bearer ${token}` } }); setShowEditModal(false); fetchUsers(); setFeedbackModal({ type: 'success', title: 'Updated', message: 'Success', onClose: () => setFeedbackModal(null) }); } catch (err) { alert('Failed'); } };
  const handleTruckSubmit = async (e) => { e.preventDefault(); try { await api.post('/vehicles/create', truckForm, { headers: { Authorization: `Bearer ${token}` } }); setShowTruckModal(false); fetchVehicles(); setFeedbackModal({ type: 'success', title: 'Vehicle Created', message: 'Success', onClose: () => setFeedbackModal(null) }); } catch (err) { alert('Failed'); } };
  const handleUpdateTruck = async (e) => { e.preventDefault(); try { await api.put(`/vehicles/${currentVehicle.vehicleID}`, truckForm, { headers: { Authorization: `Bearer ${token}` } }); setShowEditTruckModal(false); fetchVehicles(); setFeedbackModal({ type: 'success', title: 'Updated', message: 'Success', onClose: () => setFeedbackModal(null) }); } catch (err) { alert('Failed'); } };
  const initiateDelete = (type, id, name) => { setFeedbackModal({ type: 'warning', title: `Delete ${type}`, message: `Delete ${name}?`, confirmLabel: "Delete", onConfirm: () => performDelete(type, id) }); };
  const performDelete = async (type, id) => { try { await api.delete(type === 'user' ? `/users/${id}` : `/vehicles/${id}`, { headers: { Authorization: `Bearer ${token}` } }); if(type==='user') fetchUsers(); else fetchVehicles(); setFeedbackModal({type:'success', title:'Deleted', onClose:()=>setFeedbackModal(null)}); } catch(err) { setFeedbackModal({type:'error', title:'Error', message:'Active shipment conflict', onClose:()=>setFeedbackModal(null)}); } };
  const initiateRestore = (type, id) => { setFeedbackModal({ type: 'restore', title: 'Restore?', confirmLabel: 'Restore', onConfirm: async () => { await api.put(type==='user'?`/users/${id}/restore`:`/vehicles/${id}/restore`, {}, {headers:{Authorization:`Bearer ${token}`}}); if(type==='user') fetchUsers(); else fetchVehicles(); setFeedbackModal({type:'success', title:'Restored', onClose:()=>setFeedbackModal(null)}); } }); };
  const toggleTruckStatus = async (v) => { try { await api.put(`/vehicles/${v.vehicleID}/status`, {status: v.status==='Working'?'Maintenance':'Working'}, {headers:{Authorization:`Bearer ${token}`}}); fetchVehicles(); } catch(err) { setFeedbackModal({type:'error', title:'Error', message:'Vehicle busy', onClose:()=>setFeedbackModal(null)}); } };

  // --- RENDER HELPERS ---
  const renderGhostRows = (currentCount, colSpan) => {
      const ghostsNeeded = rowsPerPage - currentCount;
      if (ghostsNeeded <= 0) return null;
      return Array.from({ length: ghostsNeeded }).map((_, idx) => ( <tr key={`ghost-${idx}`} className="ghost-row"><td colSpan={colSpan}>&nbsp;</td></tr> ));
  };

  const renderTruckView = () => {
      const filteredVehicles = vehicles.filter(v => truckFilter === 'All' || v.status === truckFilter);
      const paginatedTrucks = filteredVehicles.slice((truckPage - 1) * rowsPerPage, truckPage * rowsPerPage);
      
      return (
        <div className="user-mgmt-container">
          <div className="header-actions">
              <div className="filter-group-inline">
                  <label>Filter Status:</label>
                  <select value={truckFilter} onChange={e => {setTruckFilter(e.target.value); setTruckPage(1);}} className="role-filter-dropdown">
                    <option value="All">All Statuses</option><option value="Working">Working</option><option value="Maintenance">Maintenance</option>
                  </select>
                  <button className={`archive-toggle-btn ${showArchived ? 'active' : ''}`} onClick={() => { setShowArchived(!showArchived); setTruckPage(1); }}>
                    {showArchived ? '← Back to Active' : 'View Archived'}
                  </button>
                  <div className="count-badge">{filteredVehicles.length} Vehicles</div>                 
              </div>
              {!showArchived && <button className="create-user-btn" onClick={() => { setTruckForm({ plateNo: '', type: '6-Wheeler', status: 'Working' }); setShowTruckModal(true); }}> + Add Vehicle </button>}
          </div>
          <div className="table-wrapper">
            <table className="user-table">
              <thead><tr><th>Plate Number</th><th>Type</th><th>Status</th><th>Date Added</th><th style={{textAlign:'center'}}>Actions</th></tr></thead>
              <tbody>
                {paginatedTrucks.map(v => (
                  <tr key={v.vehicleID}>
                    <td style={{fontWeight:'700'}}>{v.plateNo}</td><td>{v.type}</td>
                    <td><span className="role-tag" style={{backgroundColor: v.status === 'Working' ? '#E8F5E9' : '#FFEBEE', color: v.status === 'Working' ? '#2E7D32' : '#C62828', cursor:'pointer'}} onClick={() => toggleTruckStatus(v)}>{v.status}</span></td>
                    <td>{new Date(v.dateCreated).toLocaleDateString()}</td>
                    <td className="action-cells">
                      {showArchived ? (<button className="icon-btn" onClick={() => initiateRestore('truck', v.vehicleID)}><Icons.Restore/></button>) : 
                      (<><button className="icon-btn" onClick={() => { setCurrentVehicle(v); setTruckForm(v); setShowEditTruckModal(true); }}><Icons.Edit/></button><button className="icon-btn" onClick={() => initiateDelete('truck', v.vehicleID, v.plateNo)}><Icons.Trash/></button></>)}
                    </td>
                  </tr>
                ))}
                {renderGhostRows(paginatedTrucks.length, 5)}
              </tbody>
            </table>
          </div>
          {/* ✅ Independent Pagination for Trucks */}
          <PaginationControls 
              currentPage={truckPage} 
              totalItems={filteredVehicles.length} 
              rowsPerPage={rowsPerPage} 
              onPageChange={setTruckPage} 
          />
        </div>
      );
  };

  const renderUserView = () => {
    const filteredUsers = users.filter(user => roleFilter === 'All' || user.role.toLowerCase() === roleFilter.toLowerCase());
    const paginatedUsers = filteredUsers.slice((userPage - 1) * rowsPerPage, userPage * rowsPerPage);
    return (
      <div className="user-mgmt-container">
        <div className="header-actions">
            <div className="filter-group-inline">
                <label>Filter by Role:</label>
                <select value={roleFilter} onChange={(e) => {setRoleFilter(e.target.value); setUserPage(1);}} className="role-filter-dropdown">
                    <option value="All">All Roles</option><option value="Admin">Admin</option><option value="Operations">Operations</option><option value="Driver">Driver</option><option value="Helper">Helper</option>
                </select>
                <button className={`archive-toggle-btn ${showArchived ? 'active' : ''}`} onClick={() => { setShowArchived(!showArchived); setUserPage(1); }}>
                    {showArchived ? '← Back to Active' : 'View Archived'}
                </button>
                <div className="count-badge">{filteredUsers.length} Users</div>
            </div>
            {!showArchived && <button className="create-user-btn" onClick={() => { setUserForm({ firstName: '', lastName: '', email: '', phone: '', dob: '', role: 'Admin', password: '', confirmPassword: '' }); setShowCreateModal(true); }}> + Create User </button>}
        </div>
        <div className="table-wrapper">
          <table className="user-table">
            <thead><tr><th>Employee ID</th><th>Name</th><th>Phone</th><th>Email</th><th>Role</th><th>Date</th><th style={{textAlign: 'center'}}>Actions</th></tr></thead>
            <tbody>
              {paginatedUsers.length > 0 ? paginatedUsers.map(u => (
                <tr key={u.userID}>
                  <td>{u.employeeID || 'N/A'}</td><td>{u.firstName} {u.lastName}</td><td>{u.phone || '-'}</td><td>{u.email || '-'}</td><td><span className={`role-tag ${u.role.toLowerCase()}`}>{u.role}</span></td><td>{new Date(u.dateCreated).toLocaleDateString()}</td>
                  <td className="action-cells">
                  {showArchived ? (
                      <button className="icon-btn" onClick={() => initiateRestore('user', u.userID)} title="Restore"><Icons.Restore/></button>
                   ) : (
                       <>
                         {/* ✅ NEW: Reset Password Button */}
                         <button className="icon-btn" onClick={() => initiateResetPassword(u)} title="Reset Password">
                            <Icons.Key size={18} />
                         </button>
                         
                         <button className="icon-btn" onClick={() => { setCurrentUser(u); setUserForm({ ...u, dob: u.dob ? new Date(u.dob).toISOString().split('T')[0] : '', password: '', confirmPassword: '' }); setShowEditModal(true); }}><Icons.Edit/></button>
                         <button className="icon-btn" onClick={() => initiateDelete('user', u.userID, `${u.firstName} ${u.lastName}`)}><Icons.Trash/></button>
                        </>
                      )}
                  </td>
                </tr>
              )) : <tr><td colSpan="7" className="empty-state">No users found</td></tr>}
              {renderGhostRows(paginatedUsers.length, 7)}
            </tbody>
          </table>
        </div>
        {/* ✅ Independent Pagination for Users */}
        <PaginationControls 
            currentPage={userPage} 
            totalItems={filteredUsers.length} 
            rowsPerPage={rowsPerPage} 
            onPageChange={setUserPage} 
        />
      </div>
    );
  };

  const renderLogsView = () => {
      // NOTE: Logs are server-paginated, so 'logs' IS the current page data.
      return (
        <div className="user-mgmt-container">
          <div className="header-actions">
              <div className="filter-group-inline" style={{gap: '12px'}}>
                  <label>Timeframe:</label>
                  <select value={logTimeframe} onChange={e => handleLogFilterChange(setLogTimeframe, e.target.value)} className="log-filter-select">
                      <option value="All">All Time</option><option value="Today">Today</option><option value="Week">Last 7 Days</option><option value="Month">This Month</option>
                  </select>

                  <label>Role:</label>
                  <select value={logRoleFilter} onChange={e => handleLogFilterChange(setLogRoleFilter, e.target.value)} className="log-filter-select">
                      <option value="All">All Roles</option><option value="Admin">Admin</option><option value="Operations">Operations</option><option value="Driver">Driver</option><option value="Helper">Helper</option><option value="System">System</option>
                  </select>

                  <label>Action:</label>
                  <select value={logFilter} onChange={e => handleLogFilterChange(setLogFilter, e.target.value)} className="log-filter-select">
                      {dynamicActionTypes.map(type => <option key={type} value={type}>{type}</option>)}
                  </select>

                  <div className="count-badge">{totalLogItems} Events</div>
              </div>
              <button 
                  className="btn-generate" 
                  onClick={fetchLogs} 
                  disabled={loadingLogs}
                  title="Refresh Logs"
              >
                  <Icons.Refresh size={18} className={loadingLogs ? "icon-spin" : ""} />
              </button>
          </div>
          
          <div className="table-wrapper">
            <table className="user-table">
              <thead><tr><th style={{width:'180px'}}>Date & Time</th><th style={{width:'150px'}}>User</th><th style={{width:'180px'}}>Action Type</th><th>Details</th></tr></thead>
              <tbody>
                {logs.length > 0 ? logs.map(log => (
                  <tr key={log.logID}>
                    <td style={{color: '#666', fontSize:'13px'}}>{new Date(log.timestamp).toLocaleDateString()} <span style={{color:'#999'}}>{new Date(log.timestamp).toLocaleTimeString()}</span></td>
                    <td><div style={{display:'flex', flexDirection:'column'}}><span style={{fontWeight:'600', fontSize:'13px'}}>{log.firstName} {log.lastName}</span><span style={{fontSize:'10px', color:'#999', textTransform:'uppercase'}}>{log.role || 'System'}</span></div></td>
                    <td><span className="role-tag" style={{background: '#F3F4F6', color: '#374151', border: '1px solid #E5E7EB'}}>{log.actionType}</span></td>
                    <td style={{color: '#333'}}>{log.details}</td>
                  </tr>
                )) : <tr><td colSpan="4" className="empty-state">No logs found.</td></tr>}
                {renderGhostRows(logs.length, 4)}
              </tbody>
            </table>
          </div>
          
          {/* ✅ Independent Pagination for Logs */}
          <PaginationControls 
              currentPage={logPage} 
              totalItems={totalLogItems} 
              rowsPerPage={rowsPerPage} 
              onPageChange={setLogPage} 
          />
        </div>
      );
  };

  return (
    <>
      {activeTab === 'trucks' ? renderTruckView() : activeTab === 'logs' ? renderLogsView() : renderUserView()}
      {feedbackModal && <FeedbackModal {...feedbackModal} onClose={() => setFeedbackModal(null)} />}
      
      {/* (MODALS - Keeping same JSX structure for modals as before) */}
      {showCreateModal && (<div className="modal-backdrop"><form className="modal-card" onSubmit={handleCreateSubmit}><h3>Create User</h3><div className="form-grid"><div className="form-group"><label>First Name</label><input type="text" name="firstName" value={userForm.firstName} onChange={handleUserInputChange} required /></div><div className="form-group"><label>Last Name</label><input type="text" name="lastName" value={userForm.lastName} onChange={handleUserInputChange} required /></div><div className="form-group"><label>Email</label><input type="email" name="email" value={userForm.email} onChange={handleUserInputChange} required /></div><div className="form-group"><label>Phone</label><input type="text" name="phone" value={userForm.phone} onChange={handleUserInputChange} required /></div><div className="form-group"><label>DOB</label><input type="date" name="dob" value={userForm.dob} onChange={handleUserInputChange} required /></div><div className="form-group"><label>Role</label><select name="role" value={userForm.role} onChange={handleUserInputChange}><option value="Admin">Admin</option><option value="Operations">Operations</option><option value="Driver">Driver</option><option value="Helper">Helper</option></select></div><div className="form-group"><label>Password</label><input type="password" name="password" value={userForm.password} onChange={handleUserInputChange} required /></div><div className="form-group"><label>Confirm</label><input type="password" name="confirmPassword" value={userForm.confirmPassword} onChange={handleUserInputChange} required /></div></div><div className="modal-footer"><button type="button" className="btn-cancel" onClick={() => setShowCreateModal(false)}>Cancel</button><button type="submit" className="btn-save">Save</button></div></form></div>)}
      {/* (Add Edit/Truck modals similarly or keep existing code) */}
      {showEditModal && (<div className="modal-backdrop"><form className="modal-card" onSubmit={handleUpdateSubmit}><h3>Edit User</h3><div className="form-grid"><div className="form-group"><label>First Name</label><input type="text" name="firstName" value={userForm.firstName} onChange={handleUserInputChange} required /></div><div className="form-group"><label>Last Name</label><input type="text" name="lastName" value={userForm.lastName} onChange={handleUserInputChange} required /></div><div className="form-group"><label>Email</label><input type="email" name="email" value={userForm.email} onChange={handleUserInputChange} required /></div><div className="form-group"><label>Phone</label><input type="text" name="phone" value={userForm.phone} onChange={handleUserInputChange} required /></div><div className="form-group"><label>DOB</label><input type="date" name="dob" value={userForm.dob} onChange={handleUserInputChange} required /></div><div className="form-group"><label>Role</label><select name="role" value={userForm.role} onChange={handleUserInputChange}><option value="Admin">Admin</option><option value="Operations">Operations</option><option value="Driver">Driver</option><option value="Helper">Helper</option></select></div></div><div className="modal-footer"><button type="button" className="btn-cancel" onClick={() => setShowEditModal(false)}>Cancel</button><button type="submit" className="btn-save">Update</button></div></form></div>)}
      {showTruckModal && (<div className="modal-backdrop"><form className="modal-card" onSubmit={handleTruckSubmit}><h3>Add Vehicle</h3><label>Plate</label><input value={truckForm.plateNo} onChange={e => setTruckForm({...truckForm, plateNo: e.target.value})} required /><label>Type</label><select value={truckForm.type} onChange={e => setTruckForm({...truckForm, type: e.target.value})}><option value="6WH">6-Wheeler</option><option value="10WH">10-Wheeler</option><option value="4WH">4-Wheeler</option><option value="AUV">AUV</option><option value="FWD">Forward</option><option value="H100">H100</option></select><div className="modal-footer"><button type="button" className="btn-cancel" onClick={() => setShowTruckModal(false)}>Cancel</button><button type="submit" className="btn-save">Save</button></div></form></div>)}
      {showEditTruckModal && (<div className="modal-backdrop"><form className="modal-card" onSubmit={handleUpdateTruck}><h3>Edit Vehicle</h3><label>Plate</label><input value={truckForm.plateNo} onChange={e => setTruckForm({...truckForm, plateNo: e.target.value})} required /><label>Type</label><select value={truckForm.type} onChange={e => setTruckForm({...truckForm, type: e.target.value})}><option value="6-Wheeler">6-Wheeler</option><option value="10-Wheeler">10-Wheeler</option><option value="L300">L300</option></select><label>Status</label><select value={truckForm.status} onChange={e => setTruckForm({...truckForm, status: e.target.value})}><option value="Working">Working</option><option value="Maintenance">Maintenance</option></select><div className="modal-footer"><button type="button" className="btn-cancel" onClick={() => setShowEditTruckModal(false)}>Cancel</button><button type="submit" className="btn-save">Update</button></div></form></div>)}
      {showResetModal && (
        <div className="modal-backdrop">
          <form className="modal-card" onSubmit={handleResetSubmit} style={{width:'400px'}}>
            <div className="modal-header" style={{marginBottom:'15px'}}>
                <h3 style={{margin:0, textAlign:'left'}}>Reset Password</h3>
                <button type="button" className="close-btn" onClick={() => setShowResetModal(false)}>×</button>
            </div>
            
            <p style={{fontSize:'13px', color:'#666', margin:'0 0 15px 0'}}>
                Enter a new password for <strong>{resetData.name}</strong>.
            </p>

            <div className="form-group">
                <label>New Password</label>
                <input 
                    type="text" 
                    value={resetData.newPassword} 
                    onChange={e => setResetData({...resetData, newPassword: e.target.value})} 
                    placeholder="Enter new password..." 
                    required 
                    autoFocus
                />
            </div>

            <div className="modal-footer">
                <button type="button" className="btn-cancel" onClick={() => setShowResetModal(false)}>Cancel</button>
                <button type="submit" className="btn-save" style={{backgroundColor:'#f39c12'}}>Reset Password</button>
            </div>
          </form>
        </div>
      )}
    </>
  );
}

export default UserManagement;