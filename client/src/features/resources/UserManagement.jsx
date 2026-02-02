import { useState, useEffect, useRef } from 'react';
import api from '@utils/api';
import { Icons, FeedbackModal, PaginationControls } from '@shared';
import { MONTH_NAMES, getYearOptions } from '@constants';

function UserManagement({ activeTab = "users" }) { 
  const token = localStorage.getItem('token'); 
  const rowsPerPage = 10;

  // Pagination
  const [userPage, setUserPage] = useState(1);
  const [truckPage, setTruckPage] = useState(1);
  const [logPage, setLogPage] = useState(1);

  // Data
  const [users, setUsers] = useState([]);
  const [vehicles, setVehicles] = useState([]);
  const [logs, setLogs] = useState([]);
  const [totalLogItems, setTotalLogItems] = useState(0); 

  // Filters
  const [roleFilter, setRoleFilter] = useState('All');
  const [truckFilter, setTruckFilter] = useState('All');
  
  // LOGS FILTERS (Updated)
  const [logFilter, setLogFilter] = useState('All'); // Action Type
  const [logRoleFilter, setLogRoleFilter] = useState('All'); 
  const [logYear, setLogYear] = useState(new Date().getFullYear().toString());
  const [logMonth, setLogMonth] = useState('All');
  const [sortConfig, setSortConfig] = useState({ key: 'date', direction: 'desc' });
  const [dynamicActionTypes, setDynamicActionTypes] = useState([]);

  // UI States
  const [showArchived, setShowArchived] = useState(false);
  const [loadingLogs, setLoadingLogs] = useState(false); 
  const fetchRequestId = useRef(0);

  // Modals & Forms
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showTruckModal, setShowTruckModal] = useState(false);
  const [showEditTruckModal, setShowEditTruckModal] = useState(false);
  const [showResetModal, setShowResetModal] = useState(false); // Reset Password
  const [feedbackModal, setFeedbackModal] = useState(null); 
  const [currentUser, setCurrentUser] = useState(null);
  const [currentVehicle, setCurrentVehicle] = useState(null);
  
  const [userForm, setUserForm] = useState({ firstName: '', lastName: '', email: '', phone: '', dob: '', role: 'Admin', password: '', confirmPassword: '' });
  const [truckForm, setTruckForm] = useState({ plateNo: '', type: '6-Wheeler', status: 'Working' });
  const [resetData, setResetData] = useState({ userID: null, name: '', newPassword: '' });

  // --- DATA LOADING ---
  useEffect(() => {
    if (activeTab === 'users') fetchUsers();
    else if (activeTab === 'trucks') fetchVehicles();
    else if (activeTab === 'logs') {
        if (dynamicActionTypes.length === 0) fetchActionTypes();
    }
  }, [activeTab, showArchived]);

  useEffect(() => {
    if (activeTab === 'logs') fetchLogs();
  }, [activeTab, logPage, logFilter, logRoleFilter, logYear, logMonth, sortConfig]);

  const fetchUsers = async () => {
    try {
        const res = await api.get(`/users?archived=${showArchived}`, { headers: { Authorization: `Bearer ${token}` } });
        setUsers(res.data);
    } catch { return; }
  };
  
  const fetchVehicles = async () => {
    try {
        const res = await api.get(`/vehicles?archived=${showArchived}`, { headers: { Authorization: `Bearer ${token}` } });
        setVehicles(res.data);
    } catch { return; }
  };

  const fetchActionTypes = async () => {
      try {
          const res = await api.get('/logs/actions', { headers: { Authorization: `Bearer ${token}` } });
          setDynamicActionTypes(['All', ...res.data]);
      } catch { return; }
  };

  const fetchLogs = async () => {
      const currentRequestId = ++fetchRequestId.current;
      setLoadingLogs(true);
      
      try {
          await new Promise(resolve => setTimeout(resolve, 600));
          if (currentRequestId !== fetchRequestId.current) return;

          const params = new URLSearchParams({
              page: logPage, 
              limit: rowsPerPage,
              action: logFilter,
              role: logRoleFilter,
              year: logYear,
              month: logMonth === 'All' ? 'All' : (parseInt(logMonth, 10) + 1),
              order: sortConfig.direction
          });

          const res = await api.get(`/logs/history?${params.toString()}`, { 
              headers: { Authorization: `Bearer ${token}` } 
          });
          
          if (currentRequestId === fetchRequestId.current) {
              setLogs(res.data.data); 
              setTotalLogItems(res.data.pagination.totalItems); 
              setLoadingLogs(false); 
          }
      } catch { 
          if (currentRequestId === fetchRequestId.current) {
              setLoadingLogs(false);
          }
      }
  };

  const handleSort = (key) => {
      let direction = 'desc'; 
      // Toggle if same column clicked
      if (sortConfig.key === key && sortConfig.direction === 'desc') {
          direction = 'asc';
      }
      setSortConfig({ key, direction });
  };

  const renderSortArrow = () => {
      const isDesc = sortConfig.direction === 'desc';
      return (
          <span 
              className={`sort-icon-btn active ${isDesc ? 'desc' : ''}`} 
              style={{marginLeft: '5px'}}
              title="Sort"
          >
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 19V5" />
                  <path d="M5 12l7-7 7 7" />
              </svg>
          </span>
      );
  };

  // --- HANDLERS ---
  const handleLogFilterChange = (setter, value) => {
      setter(value);
      setLogPage(1); 
  };

  // --- PASSWORD VALIDATION ---
  const validatePassword = (password) => {
      return {
          hasStartCap: /^[A-Z]/.test(password),
          hasNumber: /\d/.test(password),
          hasLength: password.length >= 8
      };
  };

  const isPasswordValid = (password) => {
      const { hasStartCap, hasNumber, hasLength } = validatePassword(password);
      return hasStartCap && hasNumber && hasLength;
  };

  const renderPasswordFeedback = (password) => {
      const { hasStartCap, hasNumber, hasLength } = validatePassword(password);
      const style = { fontSize: '11px', marginTop: '6px', display: 'flex', flexDirection: 'column', gap: '4px' };
      const itemStyle = (isValid) => ({ color: isValid ? '#27ae60' : '#bdc3c7', display: 'flex', alignItems: 'center', gap: '6px', opacity: isValid ? 1 : 0.8 });
      
      return (
          <div style={style}>
              <span style={itemStyle(hasStartCap)}>
                  {hasStartCap ? <Icons.Check size={10} /> : <div style={{width:'4px', height:'4px', borderRadius:'50%', background:'currentColor'}}></div>} Start with Capital
              </span>
              <span style={itemStyle(hasNumber)}>
                  {hasNumber ? <Icons.Check size={10} /> : <div style={{width:'4px', height:'4px', borderRadius:'50%', background:'currentColor'}}></div>} Contains Number
              </span>
              <span style={itemStyle(hasLength)}>
                  {hasLength ? <Icons.Check size={10} /> : <div style={{width:'4px', height:'4px', borderRadius:'50%', background:'currentColor'}}></div>} 8+ Chars
              </span>
          </div>
      );
  };

  const handleUserInputChange = (e) => { const { name, value } = e.target; e.target.setCustomValidity(''); if (name === 'phone' && (!/^\d*$/.test(value) || value.length > 11)) return; setUserForm(prev => ({ ...prev, [name]: value })); };
  
  const handleCreateSubmit = async (e) => { 
      e.preventDefault(); 
      
      if (!isPasswordValid(userForm.password)) {
          setFeedbackModal({ type: 'error', title: 'Invalid Password', message: 'Please meet all password requirements.', onClose: () => setFeedbackModal(null) });
          return;
      }
      
      if (userForm.password !== userForm.confirmPassword) {
          setFeedbackModal({ type: 'error', title: 'Password Mismatch', message: 'Passwords do not match.', onClose: () => setFeedbackModal(null) });
          return;
      }

      try { 
          await api.post('/users/create', userForm, { headers: { Authorization: `Bearer ${token}` } }); 
          setShowCreateModal(false); 
          fetchUsers(); 
          setFeedbackModal({ type: 'success', title: 'User Created', message: 'Success', onClose: () => setFeedbackModal(null) }); 
      } catch (err) { 
          setFeedbackModal({ type: 'error', title: 'Error', message: 'Failed', onClose: () => setFeedbackModal(null) }); 
      } 
  };
  
  const handleUpdateSubmit = async (e) => { e.preventDefault(); try { await api.put(`/users/${currentUser.userID}`, userForm, { headers: { Authorization: `Bearer ${token}` } }); setShowEditModal(false); fetchUsers(); setFeedbackModal({ type: 'success', title: 'Updated', message: 'Success', onClose: () => setFeedbackModal(null) }); } catch (err) { alert('Failed'); } };
  const handleTruckSubmit = async (e) => { e.preventDefault(); try { await api.post('/vehicles/create', truckForm, { headers: { Authorization: `Bearer ${token}` } }); setShowTruckModal(false); fetchVehicles(); setFeedbackModal({ type: 'success', title: 'Vehicle Created', message: 'Success', onClose: () => setFeedbackModal(null) }); } catch (err) { alert('Failed'); } };
  const handleUpdateTruck = async (e) => { e.preventDefault(); try { await api.put(`/vehicles/${currentVehicle.vehicleID}`, truckForm, { headers: { Authorization: `Bearer ${token}` } }); setShowEditTruckModal(false); fetchVehicles(); setFeedbackModal({ type: 'success', title: 'Updated', message: 'Success', onClose: () => setFeedbackModal(null) }); } catch (err) { alert('Failed'); } };
  const initiateDelete = (type, id, name) => { setFeedbackModal({ type: 'warning', title: `Delete ${type}`, message: `Delete ${name}?`, confirmLabel: "Delete", onConfirm: () => performDelete(type, id) }); };
  const performDelete = async (type, id) => { try { await api.delete(type === 'user' ? `/users/${id}` : `/vehicles/${id}`, { headers: { Authorization: `Bearer ${token}` } }); if(type==='user') fetchUsers(); else fetchVehicles(); setFeedbackModal({type:'success', title:'Deleted', onClose:()=>setFeedbackModal(null)}); } catch(err) { setFeedbackModal({type:'error', title:'Error', message:'Active shipment conflict', onClose:()=>setFeedbackModal(null)}); } };
  const initiateRestore = (type, id) => { setFeedbackModal({ type: 'restore', title: 'Restore?', confirmLabel: 'Restore', onConfirm: async () => { await api.put(type==='user'?`/users/${id}/restore`:`/vehicles/${id}/restore`, {}, {headers:{Authorization:`Bearer ${token}`}}); if(type==='user') fetchUsers(); else fetchVehicles(); setFeedbackModal({type:'success', title:'Restored', onClose:()=>setFeedbackModal(null)}); } }); };
  const toggleTruckStatus = async (v) => { try { await api.put(`/vehicles/${v.vehicleID}/status`, {status: v.status==='Working'?'Maintenance':'Working'}, {headers:{Authorization:`Bearer ${token}`}}); fetchVehicles(); } catch(err) { setFeedbackModal({type:'error', title:'Error', message:'Vehicle busy', onClose:()=>setFeedbackModal(null)}); } };
  
  // Password Reset Handlers
  const initiateResetPassword = (user) => { setResetData({ userID: user.userID, name: `${user.firstName} ${user.lastName}`, newPassword: '' }); setShowResetModal(true); };
  
  const handleResetSubmit = async (e) => { 
      e.preventDefault(); 
      
      if (!isPasswordValid(resetData.newPassword)) {
          setFeedbackModal({ type: 'error', title: 'Invalid Password', message: 'Please meet all password requirements.', onClose: () => setFeedbackModal(null) });
          return;
      }

      try { 
          await api.put(`/users/${resetData.userID}/reset-password`, { newPassword: resetData.newPassword }, { headers: { Authorization: `Bearer ${token}` } }); 
          setShowResetModal(false); 
          setFeedbackModal({ type: 'success', title: 'Password Reset', message: `Password for ${resetData.name} updated.`, onClose: () => setFeedbackModal(null) }); 
      } catch (err) { 
          setFeedbackModal({ type: 'error', title: 'Reset Failed', message: err.response?.data?.error || "Error", onClose: () => setFeedbackModal(null) }); 
      } 
  };

  // --- RENDER HELPERS ---
  const renderGhostRows = (currentCount, colSpan) => {
      const ghostsNeeded = rowsPerPage - currentCount;
      if (ghostsNeeded <= 0) return null;
      return Array.from({ length: ghostsNeeded }).map((_, idx) => ( <tr key={`ghost-${idx}`} className="ghost-row"><td colSpan={colSpan}>&nbsp;</td></tr> ));
  };

  const renderTruckView = () => { 
    
      const filteredVehicles = vehicles.filter(v => truckFilter === 'All' || v.status === truckFilter);
      const sortedVehicles = [...filteredVehicles].sort((a, b) => {
          const dateA = new Date(a.dateCreated || 0);
          const dateB = new Date(b.dateCreated || 0);
          return sortConfig.direction === 'asc' ? dateA - dateB : dateB - dateA;
      });
      const paginatedTrucks = sortedVehicles.slice((truckPage - 1) * rowsPerPage, truckPage * rowsPerPage);
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
              <thead><tr><th>Plate Number</th><th>Type</th><th>Status</th>
              <th className="sortable-header">
                  <div onClick={() => handleSort('date')} className="th-content">Date Added {renderSortArrow()}</div>
              </th>
                      <th style={{textAlign:'center'}}>Actions</th></tr></thead>
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
          <PaginationControls currentPage={truckPage} totalItems={filteredVehicles.length} rowsPerPage={rowsPerPage} onPageChange={setTruckPage} />
        </div>
      );
  };

  const renderUserView = () => {
    const filteredUsers = users.filter(user => roleFilter === 'All' || user.role.toLowerCase() === roleFilter.toLowerCase());
    const sortedUsers = [...filteredUsers].sort((a, b) => {
        const dateA = new Date(a.dateCreated || 0);
        const dateB = new Date(b.dateCreated || 0);
        return sortConfig.direction === 'asc' ? dateA - dateB : dateB - dateA;
    });

    const paginatedUsers = sortedUsers.slice((userPage - 1) * rowsPerPage, userPage * rowsPerPage);
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
            <thead><tr><th>Employee ID</th><th>Name</th><th>Phone</th><th>Email</th><th>Role</th>
            <th className="sortable-header">
                <div onClick={() => handleSort('date')} className="th-content">Date Added {renderSortArrow()}</div>
            </th>
            <th style={{textAlign: 'center'}}>Actions</th></tr></thead>
            <tbody>
              {paginatedUsers.length > 0 ? paginatedUsers.map(u => (
                <tr key={u.userID}>
                  <td style={{fontWeight:'700', color:'#555'}}>{u.employeeID || 'N/A'}</td>
                  <td>{u.firstName} {u.lastName}</td><td>{u.phone || '-'}</td><td>{u.email || '-'}</td><td><span className={`role-tag ${u.role.toLowerCase()}`}>{u.role}</span></td><td>{new Date(u.dateCreated).toLocaleDateString()}</td>
                  <td className="action-cells">
                  {showArchived ? (<button className="icon-btn" onClick={() => initiateRestore('user', u.userID)} title="Restore"><Icons.Restore/></button>) : 
                  (<><button className="icon-btn" onClick={() => initiateResetPassword(u)} title="Reset Password"><Icons.Key size={18} /></button><button className="icon-btn" onClick={() => { setCurrentUser(u); setUserForm({ ...u, dob: u.dob ? new Date(u.dob).toISOString().split('T')[0] : '', password: '', confirmPassword: '' }); setShowEditModal(true); }}><Icons.Edit/></button><button className="icon-btn" onClick={() => initiateDelete('user', u.userID, `${u.firstName} ${u.lastName}`)}><Icons.Trash/></button></>)}
                  </td>
                </tr>
              )) : <tr><td colSpan="7" className="empty-state">No users found</td></tr>}
              {renderGhostRows(paginatedUsers.length, 7)}
            </tbody>
          </table>
        </div>
        <PaginationControls currentPage={userPage} totalItems={filteredUsers.length} rowsPerPage={rowsPerPage} onPageChange={setUserPage} />
      </div>
    );
  };

  const renderLogsView = () => {
      return (
        <div className="user-mgmt-container">
          <div className="header-actions">
              
              <div className="filter-group-inline" style={{ gap: '12px' }}>
                  <div className="filter-group-bordered">
                      <div style={{display:'flex', flexDirection:'column'}}>
                          <label style={{fontSize:'10px', fontWeight:'700', color:'#999', textTransform:'uppercase'}}>Year</label>
                          <select 
                              value={logYear} 
                              onChange={e => handleLogFilterChange(setLogYear, e.target.value)}
                              style={{border:'none', fontSize:'13px', outline:'none', background:'transparent', cursor:'pointer'}}
                          >
                              {getYearOptions().map(y => <option key={y} value={y}>{y}</option>)}
                          </select>
                      </div>
                      <div style={{width:'1px', height:'25px', background:'#eee'}}></div>
                      <div style={{display:'flex', flexDirection:'column'}}>
                          <label style={{fontSize:'10px', fontWeight:'700', color:'#999', textTransform:'uppercase'}}>Month</label>
                          <select 
                              value={logMonth} 
                              onChange={e => handleLogFilterChange(setLogMonth, e.target.value)}
                              style={{border:'none', fontSize:'13px', outline:'none', background:'transparent', cursor:'pointer', minWidth:'100px'}}
                          >
                              <option value="All">All Months</option>
                              {MONTH_NAMES.map((m, i) => <option key={i} value={i}>{m}</option>)}
                          </select>
                      </div>
                  </div>

                  <div style={{width:'1px', height:'35px', background:'#eee'}}></div>

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
              
              <button className="btn-generate" onClick={fetchLogs} disabled={loadingLogs} title="Refresh Logs">
                  <Icons.Refresh size={18} className={loadingLogs ? "icon-spin" : ""} />
              </button>
          </div>
          
          <div className="table-wrapper">
            <table className="user-table">
              <thead><tr>
              <th className="sortable-header" style={{width:'180px'}}>
                  <div onClick={() => handleSort('date')} className="th-content">Date & Time {renderSortArrow()}</div>
              </th>
              <th style={{width:'150px'}}>User</th><th style={{width:'250px'}}>Action Type</th><th>Details</th></tr></thead>
              <tbody>
                {logs.length > 0 ? logs.map(log => (
                  <tr key={log.logID}>
                    <td style={{color: '#666', fontSize:'13px'}}>{new Date(log.timestamp).toLocaleDateString()} <span style={{color:'#999'}}>{new Date(log.timestamp).toLocaleTimeString()}</span></td>
                    <td><div style={{display:'flex', flexDirection:'column'}}><span style={{fontWeight:'600', fontSize:'13px'}}>{log.firstName} {log.lastName}</span><span style={{fontSize:'10px', color:'#999', textTransform:'uppercase'}}>{log.role || 'System'}</span></div></td>
                    <td><span className="role-tag" style={{background: '#F3F4F6', color: '#374151', border: '1px solid #E5E7EB'}}>{log.actionType}</span></td>
                    <td style={{color: '#333'}}>{log.details}</td>
                  </tr>
                )) : <tr><td colSpan="4" className="empty-state">No logs found for selected period.</td></tr>}
                {renderGhostRows(logs.length, 4)}
              </tbody>
            </table>
          </div>
          
          <PaginationControls currentPage={logPage} totalItems={totalLogItems} rowsPerPage={rowsPerPage} onPageChange={setLogPage} />
        </div>
      );
  };

  return (
    <>
      {activeTab === 'trucks' ? renderTruckView() : activeTab === 'logs' ? renderLogsView() : renderUserView()}
      
      {feedbackModal && <FeedbackModal {...feedbackModal} onClose={() => setFeedbackModal(null)} />}
      {showCreateModal && (<div className="modal-backdrop"><form className="user-modal-card" onSubmit={handleCreateSubmit}>
        <div className="modal-header" style={{marginBottom:'15px'}}>
          <h3 style={{margin:0, textAlign:'left'}}>Create User</h3>
          <button type="button" className="close-btn" onClick={() => setShowCreateModal(false)}>×</button>
        </div>
        <div className="form-grid">
          <div className="form-group">
            <label>First Name</label>
            <input type="text" name="firstName" value={userForm.firstName} onChange={handleUserInputChange} required />
          </div>
          <div className="form-group">
            <label>Last Name</label>
            <input type="text" name="lastName" value={userForm.lastName} onChange={handleUserInputChange} required />
          </div>
          <div className="form-group">
            <label>Email</label>
            <input type="email" name="email" value={userForm.email} onChange={handleUserInputChange} required />
          </div>
          <div className="form-group">
            <label>Phone</label>
            <input type="text" name="phone" value={userForm.phone} onChange={handleUserInputChange} required />
          </div>
          <div className="form-group">
            <label>DOB</label>
            <input type="date" name="dob" value={userForm.dob} onChange={handleUserInputChange} required />
          </div>
          <div className="form-group">
            <label>Role</label>
            <select name="role" value={userForm.role} onChange={handleUserInputChange}>
              <option value="Admin">Admin</option><option value="Operations">Operations</option>
              <option value="Driver">Driver</option><option value="Helper">Helper</option>
            </select>
          </div>
          <div className="form-group">
            <label>Password</label>
            <input type="password" name="password" value={userForm.password} onChange={handleUserInputChange} required />
            {renderPasswordFeedback(userForm.password)}
          </div>
          <div className="form-group">
            <label>Confirm</label>
            <input type="password" name="confirmPassword" value={userForm.confirmPassword} onChange={handleUserInputChange} required />
          </div>
          </div>
          <div className="modal-footer">
            <button type="button" className="btn-cancel" onClick={() => setShowCreateModal(false)}>Cancel</button>
            <button type="submit" className="btn-save">Save</button>
          </div>
        </form>
      </div>
    )}
    
      {showEditModal && (<div className="modal-backdrop"><form className="user-modal-card" onSubmit={handleUpdateSubmit}><div className="modal-header" style={{marginBottom:'15px'}}>
          <h3 style={{margin:0, textAlign:'left'}}>Edit User</h3><button type="button" className="close-btn" onClick={() => setShowEditModal(false)}>×</button>
        </div><div className="form-grid"><div className="form-group"><label>First Name</label><input type="text" name="firstName" value={userForm.firstName} onChange={handleUserInputChange} required /></div><div className="form-group"><label>Last Name</label><input type="text" name="lastName" value={userForm.lastName} onChange={handleUserInputChange} required /></div><div className="form-group"><label>Email</label><input type="email" name="email" value={userForm.email} onChange={handleUserInputChange} required /></div><div className="form-group"><label>Phone</label><input type="text" name="phone" value={userForm.phone} onChange={handleUserInputChange} required /></div><div className="form-group"><label>DOB</label><input type="date" name="dob" value={userForm.dob} onChange={handleUserInputChange} required /></div><div className="form-group"><label>Role</label><select name="role" value={userForm.role} onChange={handleUserInputChange}><option value="Admin">Admin</option><option value="Operations">Operations</option><option value="Driver">Driver</option><option value="Helper">Helper</option></select></div></div><div className="modal-footer"><button type="button" className="btn-cancel" onClick={() => setShowEditModal(false)}>Cancel</button><button type="submit" className="btn-save">Update</button></div></form></div>)}
      {showTruckModal && (<div className="modal-backdrop"><form className="user-modal-card" style={{width: 350}} onSubmit={handleTruckSubmit}><div className="modal-header" style={{marginBottom:'15px'}}>
          <h3 style={{margin:0, textAlign:'left'}}>Add Vehicle</h3><button type="button" className="close-btn" onClick={() => setShowTruckModal(false)}>×</button>
        </div>
          <div className="form-group"><label>Plate</label><input value={truckForm.plateNo} onChange={e => setTruckForm({...truckForm, plateNo: e.target.value})} required /></div><div className="form-group"><label>Type</label><select value={truckForm.type} onChange={e => setTruckForm({...truckForm, type: e.target.value})}><option value="6-Wheeler">6-Wheeler</option><option value="10-Wheeler">10-Wheeler</option><option value="4-Wheeler">4-Wheeler</option><option value="AUV">AUV</option><option value="Forward">Forward</option><option value="H100">H100</option><option value="L300">L300</option></select></div><div className="form-group"><label>Status</label><select value={truckForm.status} onChange={e => setTruckForm({...truckForm, status: e.target.value})}><option value="Working">Working</option><option value="Maintenance">Maintenance</option></select></div><div className="modal-footer"><button type="button" className="btn-cancel" onClick={() => setShowTruckModal(false)}>Cancel</button><button type="submit" className="btn-save">Save</button></div></form></div>)}
      {showEditTruckModal && (<div className="modal-backdrop"><form className="user-modal-card" style={{width: 350}} onSubmit={handleUpdateTruck}><h3>Edit Vehicle</h3><div className="form-group"><label>Plate</label><input value={truckForm.plateNo} onChange={e => setTruckForm({...truckForm, plateNo: e.target.value})} required /></div><div className="form-group"><label>Type</label><select value={truckForm.type} onChange={e => setTruckForm({...truckForm, type: e.target.value})}><option value="6-Wheeler">6-Wheeler</option><option value="10-Wheeler">10-Wheeler</option><option value="4-Wheeler">4-Wheeler</option><option value="AUV">AUV</option><option value="Forward">Forward</option><option value="H100">H100</option><option value="L300">L300</option></select></div><div className="form-group"><label>Status</label><select value={truckForm.status} onChange={e => setTruckForm({...truckForm, status: e.target.value})}><option value="Working">Working</option><option value="Maintenance">Maintenance</option></select></div><div className="modal-footer"><button type="button" className="btn-cancel" onClick={() => setShowEditTruckModal(false)}>Cancel</button><button type="submit" className="btn-save">Update</button></div></form></div>)}
      {showResetModal && (<div className="modal-backdrop"><form className="user-modal-card" style={{width: 400}} onSubmit={handleResetSubmit}><div className="modal-header" style={{marginBottom:'15px'}}><h3 style={{margin:0, textAlign:'left'}}>Reset Password</h3><button type="button" className="close-btn" onClick={() => setShowResetModal(false)}>×</button></div><p style={{fontSize:'13px', color:'#666', margin:'0 0 15px 0'}}>Enter a new password for <strong>{resetData.name}</strong>.</p><div className="form-group"><label>New Password</label><input type="text" value={resetData.newPassword} onChange={e => setResetData({...resetData, newPassword: e.target.value})} placeholder="Enter new password..." required autoFocus />{renderPasswordFeedback(resetData.newPassword)}</div><div className="modal-footer"><button type="button" className="btn-cancel" onClick={() => setShowResetModal(false)}>Cancel</button><button type="submit" className="btn-save" style={{backgroundColor:'#f39c12'}}>Reset Password</button></div></form></div>)}
    </>
  );
}

export default UserManagement;
