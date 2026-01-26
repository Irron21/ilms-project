import React, { useState, useEffect } from 'react';
import axios from 'axios';
import './UserManagement.css';

function UserManagement({ activeTab = "users" }) { 
  
  // --- SHARED PAGINATION STATE ---
  const [currentPage, setCurrentPage] = useState(1);
  const rowsPerPage = 10;

  // --- USER STATE ---
  const [users, setUsers] = useState([]);
  const [roleFilter, setRoleFilter] = useState('All');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [currentUser, setCurrentUser] = useState(null);
  const [userForm, setUserForm] = useState({
    firstName: '', lastName: '', email: '', phone: '', dob: '', role: 'Crew', password: '', confirmPassword: ''
  });
  const [errors, setErrors] = useState({ password: '', confirm: '', phone: '', email: '' });

  // --- TRUCK STATE ---
  const [vehicles, setVehicles] = useState([]);
  const [truckFilter, setTruckFilter] = useState('All');
  const [showTruckModal, setShowTruckModal] = useState(false);
  const [showEditTruckModal, setShowEditTruckModal] = useState(false);
  const [currentVehicle, setCurrentVehicle] = useState(null);
  const [truckForm, setTruckForm] = useState({ plateNo: '', type: '6-Wheeler', status: 'Working' });

  // --- DELETE / CONFLICT MODAL STATE ---
  const [deleteModal, setDeleteModal] = useState({ 
      show: false, 
      type: null, 
      id: null, 
      name: null,
      action: 'delete' // 'delete' or 'status_change'
  });
  const [conflictData, setConflictData] = useState([]);

  // --- NEW: SUCCESS MODAL STATE ---
  const [successModal, setSuccessModal] = useState({
      show: false,
      message: ''
  });

  const token = localStorage.getItem('token'); 

  // Reset page when switching tabs
  useEffect(() => { setCurrentPage(1); }, [activeTab, roleFilter, truckFilter]);

  // --- FETCH DATA ---
  useEffect(() => {
    if (activeTab === 'users') fetchUsers();
    else fetchVehicles();
  }, [activeTab]);

  const fetchUsers = async () => {
    try {
        const res = await axios.get('http://localhost:4000/api/users', { headers: { Authorization: `Bearer ${token}` } });
        setUsers(res.data);
    } catch (err) { console.error(err); }
  };
  
  const fetchVehicles = async () => {
    try {
        const res = await axios.get('http://localhost:4000/api/vehicles', { headers: { Authorization: `Bearer ${token}` } });
        setVehicles(res.data);
    } catch (err) { console.error(err); }
  };

  // --- RENDER HELPERS ---
  const renderPagination = (totalItems) => {
    const totalPages = Math.ceil(totalItems / rowsPerPage) || 1;
    return (
        <div className="pagination-footer">
            <button disabled={currentPage === 1} onClick={() => setCurrentPage(prev => prev - 1)}>Prev</button>
            {[...Array(totalPages)].map((_, i) => (
                <button key={i} className={currentPage === i + 1 ? 'active' : ''} onClick={() => setCurrentPage(i + 1)}>{i + 1}</button>
            ))}
            <button disabled={currentPage === totalPages} onClick={() => setCurrentPage(prev => prev + 1)}>Next</button>
        </div>
    );
  };

  const renderGhostRows = (currentCount, colSpan) => {
      const ghostsNeeded = rowsPerPage - currentCount;
      if (ghostsNeeded <= 0) return null;
      return Array.from({ length: ghostsNeeded }).map((_, idx) => (
          <tr key={`ghost-${idx}`} className="ghost-row"><td colSpan={colSpan}>&nbsp;</td></tr>
      ));
  };

  // --- DELETE / STATUS HANDLERS ---
  const initiateDelete = (type, id, name) => {
      setDeleteModal({ show: true, type, id, name, action: 'delete' });
      setConflictData([]);
  };

  const confirmDelete = async () => {
      try {
          const endpoint = deleteModal.type === 'user' 
              ? `http://localhost:4000/api/users/${deleteModal.id}`
              : `http://localhost:4000/api/vehicles/${deleteModal.id}`;

          await axios.delete(endpoint, { headers: { Authorization: `Bearer ${token}` } });
          
          // 1. Close Delete Modal
          setDeleteModal({ show: false, type: null, id: null, name: null, action: 'delete' });
          
          // 2. Open Success Modal
          setSuccessModal({
              show: true,
              message: `${deleteModal.type === 'user' ? 'User' : 'Vehicle'} has been deleted successfully.`
          });
          
          // 3. Refresh Data
          if (deleteModal.type === 'user') fetchUsers();
          else fetchVehicles();

      } catch (err) {
          if (err.response && err.response.status === 409) {
              setConflictData(err.response.data.activeShipments);
          } else {
              alert("An error occurred.");
          }
      }
  };

  const toggleTruckStatus = async (vehicle) => {
      const newStatus = vehicle.status === 'Working' ? 'Maintenance' : 'Working';
      try {
          await axios.put(`http://localhost:4000/api/vehicles/${vehicle.vehicleID}/status`, 
            { status: newStatus }, { headers: { Authorization: `Bearer ${token}` } }
          );
          fetchVehicles();
      } catch (err) { 
          if (err.response && err.response.status === 409) {
              setConflictData(err.response.data.activeShipments);
              setDeleteModal({
                  show: true, type: 'truck', id: vehicle.vehicleID, name: vehicle.plateNo,
                  action: 'status_change'
              });
          }
      }
  };

  // --- USER FORM HANDLERS ---
  const handleUserInputChange = (e) => {
    const { name, value } = e.target;
    if (name === 'phone' && (!/^\d*$/.test(value) || value.length > 11)) return;
    setUserForm(prev => ({ ...prev, [name]: value }));
  };

  const handleCreateSubmit = async () => {
    try {
        await axios.post('http://localhost:4000/api/users/create', userForm, { headers: { Authorization: `Bearer ${token}` } });
        setShowCreateModal(false);
        setSuccessModal({ show: true, message: "User created successfully!" }); // Added Success Modal here too!
        fetchUsers();
    } catch (err) { alert("Failed to create user."); }
  };

  const handleUpdateSubmit = async () => {
      try {
        await axios.put(`http://localhost:4000/api/users/${currentUser.userID}`, userForm, { headers: { Authorization: `Bearer ${token}` } });
        setShowEditModal(false);
        setSuccessModal({ show: true, message: "User details updated successfully!" });
        fetchUsers();
    } catch (err) { alert("Failed update"); }
  };
  
  const handleEditClick = (user) => {
    setCurrentUser(user);
    const formattedDob = user.dob ? new Date(user.dob).toISOString().split('T')[0] : '';
    setUserForm({
        firstName: user.firstName, lastName: user.lastName, email: user.email || '', phone: user.phone || '',
        dob: formattedDob, role: user.role, password: '', confirmPassword: ''
    });
    setShowEditModal(true);
  };

  // --- TRUCK FORM HANDLERS ---
  const handleTruckSubmit = async () => {
      if(!truckForm.plateNo) return alert("Plate Number is required");
      try {
          await axios.post('http://localhost:4000/api/vehicles/create', truckForm, { headers: { Authorization: `Bearer ${token}` } });
          setShowTruckModal(false);
          setSuccessModal({ show: true, message: "New vehicle added successfully!" });
          fetchVehicles();
      } catch (e) { alert("Error adding vehicle"); }
  };

  const handleUpdateTruck = async () => {
      try {
          await axios.put(`http://localhost:4000/api/vehicles/${currentVehicle.vehicleID}`, truckForm, { headers: { Authorization: `Bearer ${token}` } });
          setShowEditTruckModal(false);
          setSuccessModal({ show: true, message: "Vehicle updated successfully!" });
          fetchVehicles();
      } catch (e) { alert("Error updating vehicle"); }
  };

  const handleEditTruckClick = (vehicle) => {
      setCurrentVehicle(vehicle);
      setTruckForm({ plateNo: vehicle.plateNo, type: vehicle.type, status: vehicle.status });
      setShowEditTruckModal(true);
  };

  // =========================================
  // RENDER
  // =========================================
  const renderTruckView = () => {
      const filteredVehicles = vehicles.filter(v => truckFilter === 'All' || v.status === truckFilter);
      const paginatedTrucks = filteredVehicles.slice((currentPage - 1) * rowsPerPage, currentPage * rowsPerPage);
      return (
        <div className="user-mgmt-container">
          <div className="header-actions">
              <div className="filter-group-inline">
                  <label>Filter Status:</label>
                  <select value={truckFilter} onChange={e => setTruckFilter(e.target.value)} className="role-filter-dropdown">
                    <option value="All">All Statuses</option>
                    <option value="Working">Working</option>
                    <option value="Maintenance">Maintenance</option>
                  </select>
                  <div className="count-badge">{filteredVehicles.length} Vehicles</div>
              </div>
              <button className="create-user-btn" onClick={() => { setTruckForm({ plateNo: '', type: '6-Wheeler', status: 'Working' }); setShowTruckModal(true); }}>+ Add Vehicle</button>
          </div>
          <div className="table-wrapper">
            <table className="user-table">
              <thead><tr><th>Plate Number</th><th>Type</th><th>Status</th><th>Date Added</th><th style={{textAlign:'center'}}>Actions</th></tr></thead>
              <tbody>
                {paginatedTrucks.map(v => (
                  <tr key={v.vehicleID}>
                    <td style={{fontWeight:'700'}}>{v.plateNo || '-'}</td>
                    <td>{v.type}</td>
                    <td><span className="role-tag" style={{backgroundColor: v.status === 'Working' ? '#E8F5E9' : '#FFEBEE', color: v.status === 'Working' ? '#2E7D32' : '#C62828', cursor: 'pointer', border: '1px solid', borderColor: v.status === 'Working' ? '#A5D6A7' : '#EF9A9A'}} onClick={() => toggleTruckStatus(v)}>{v.status}</span></td>
                    <td>{new Date(v.dateCreated).toLocaleDateString()}</td>
                    <td className="action-cells">
                        <button className="icon-btn" onClick={() => handleEditTruckClick(v)}><svg viewBox="0 0 24 24" width="18" height="18"><path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34c-.39-.39-1.02-.39-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"/></svg></button>
                        <button className="icon-btn" onClick={() => initiateDelete('truck', v.vehicleID, v.plateNo)}><svg viewBox="0 0 24 24" width="18" height="18"><path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/></svg></button>
                    </td>
                  </tr>
                ))}
                {renderGhostRows(paginatedTrucks.length, 5)}
              </tbody>
            </table>
          </div>
          {renderPagination(filteredVehicles.length)}
        </div>
      );
  }

  const renderUserView = () => {
    const filteredUsers = users.filter(user => roleFilter === 'All' || user.role.toLowerCase() === roleFilter.toLowerCase());
    const paginatedUsers = filteredUsers.slice((currentPage - 1) * rowsPerPage, currentPage * rowsPerPage);
    return (
      <div className="user-mgmt-container">
        <div className="header-actions">
            <div className="filter-group-inline">
                <label>Filter by Role:</label>
                <select value={roleFilter} onChange={(e) => setRoleFilter(e.target.value)} className="role-filter-dropdown">
                    <option value="All">All Roles</option>
                    <option value="Admin">Admin</option>
                    <option value="Operations">Operations</option>
                    <option value="Driver">Driver</option>
                    <option value="Helper">Helper</option>
                </select>
                <div className="count-badge">{filteredUsers.length} User{filteredUsers.length !== 1 ? 's' : ''}</div>
            </div>
            <button className="create-user-btn" onClick={() => { setUserForm({ firstName: '', lastName: '', email: '', phone: '', dob: '', role: 'Crew', password: '', confirmPassword: '' }); setErrors({ password: '', confirm: '', phone: '', email: '' }); setShowCreateModal(true); }}> + Create User </button>
        </div>
        <div className="table-wrapper">
          <table className="user-table">
            <thead><tr><th>Employee ID</th><th>Name</th><th>Phone Number</th><th>Email</th><th>Role</th><th>Date Created</th><th style={{textAlign: 'center'}}>Actions</th></tr></thead>
            <tbody>
              {paginatedUsers.length > 0 ? (
                <>
                  {paginatedUsers.map(u => (
                    <tr key={u.userID}>
                      <td>{u.employeeID || 'N/A'}</td><td>{u.firstName} {u.lastName}</td><td>{u.phone || '-'}</td><td>{u.email || '-'}</td><td><span className={`role-tag ${u.role.toLowerCase()}`}>{u.role}</span></td><td>{new Date(u.dateCreated).toLocaleDateString()}</td>
                      <td className="action-cells">
                         <button className="icon-btn" onClick={() => handleEditClick(u)}><svg viewBox="0 0 24 24" width="18" height="18"><path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34c-.39-.39-1.02-.39-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"/></svg></button>
                         <button className="icon-btn" onClick={() => initiateDelete('user', u.userID, `${u.firstName} ${u.lastName}`)}><svg viewBox="0 0 24 24" width="18" height="18"><path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/></svg></button>
                      </td>
                    </tr>
                  ))}
                  {renderGhostRows(paginatedUsers.length, 7)}
                </>
              ) : (<tr><td colSpan="7" className="empty-state">No users found</td></tr>)}
            </tbody>
          </table>
        </div>
        {renderPagination(filteredUsers.length)}
      </div>
    );
  }

  return (
    <>
      {activeTab === 'trucks' ? renderTruckView() : renderUserView()}

      {/* --- MODALS SECTION --- */}
      
      {/* Create User Modal */}
      {showCreateModal && (
        <div className="modal-backdrop">
          <div className="modal-card">
            <h3>Create New User</h3>
            {/* ... (Inputs removed for brevity, they match previous code) ... */}
            <div className="row-inputs"><div className="col"><label>First Name</label><input type="text" name="firstName" value={userForm.firstName} onChange={handleUserInputChange} /></div><div className="col"><label>Last Name</label><input type="text" name="lastName" value={userForm.lastName} onChange={handleUserInputChange} /></div></div>
            <label>Email</label><input type="email" name="email" value={userForm.email} onChange={handleUserInputChange} />
            <label>Phone</label><input type="text" name="phone" value={userForm.phone} onChange={handleUserInputChange} />
            <div className="row-inputs"><div className="col"><label>DOB</label><input type="date" name="dob" value={userForm.dob} onChange={handleUserInputChange} /></div><div className="col"><label>Role</label><select name="role" value={userForm.role} onChange={handleUserInputChange}><option value="Admin">Admin</option><option value="Operations">Operations</option><option value="Driver">Driver</option><option value="Helper">Helper</option></select></div></div>
            <label>Password</label><input type="password" name="password" value={userForm.password} onChange={handleUserInputChange} />
            <label>Confirm</label><input type="password" name="confirmPassword" value={userForm.confirmPassword} onChange={handleUserInputChange} />
            <div className="modal-footer"><button className="btn-cancel" onClick={() => setShowCreateModal(false)}>Cancel</button><button className="btn-save" onClick={handleCreateSubmit}>Save</button></div>
          </div>
        </div>
      )}

      {/* Edit User Modal */}
      {showEditModal && (
        <div className="modal-backdrop">
          <div className="modal-card">
            <h3>Edit User</h3>
            <div className="row-inputs"><div className="col"><label>First Name</label><input type="text" name="firstName" value={userForm.firstName} onChange={handleUserInputChange} /></div><div className="col"><label>Last Name</label><input type="text" name="lastName" value={userForm.lastName} onChange={handleUserInputChange} /></div></div>
            <label>Email</label><input type="email" name="email" value={userForm.email} onChange={handleUserInputChange} />
            <label>Phone</label><input type="text" name="phone" value={userForm.phone} onChange={handleUserInputChange} />
            <div className="row-inputs"><div className="col"><label>DOB</label><input type="date" name="dob" value={userForm.dob} onChange={handleUserInputChange} /></div><div className="col"><label>Role</label><select name="role" value={userForm.role} onChange={handleUserInputChange}><option value="Admin">Admin</option><option value="Operations">Operations</option><option value="Driver">Driver</option><option value="Helper">Helper</option></select></div></div>
            <div className="modal-footer"><button className="btn-cancel" onClick={() => setShowEditModal(false)}>Cancel</button><button className="btn-save" onClick={handleUpdateSubmit}>Update</button></div>
          </div>
        </div>
      )}

      {/* Truck Modals */}
      {showTruckModal && (
        <div className="modal-backdrop">
          <div className="modal-card">
            <h3>Add Vehicle</h3>
            <label>Plate</label><input value={truckForm.plateNo} onChange={e => setTruckForm({...truckForm, plateNo: e.target.value})} />
            <label>Type</label><select value={truckForm.type} onChange={e => setTruckForm({...truckForm, type: e.target.value})}><option value="6-Wheeler">6-Wheeler</option><option value="10-Wheeler">10-Wheeler</option><option value="L300">L300</option></select>
            <div className="modal-footer"><button className="btn-cancel" onClick={() => setShowTruckModal(false)}>Cancel</button><button className="btn-save" onClick={handleTruckSubmit}>Save</button></div>
          </div>
        </div>
      )}
      
      {showEditTruckModal && (
        <div className="modal-backdrop">
          <div className="modal-card">
            <h3>Edit Vehicle</h3>
            <label>Plate</label><input value={truckForm.plateNo} onChange={e => setTruckForm({...truckForm, plateNo: e.target.value})} />
            <label>Type</label><select value={truckForm.type} onChange={e => setTruckForm({...truckForm, type: e.target.value})}><option value="6-Wheeler">6-Wheeler</option><option value="10-Wheeler">10-Wheeler</option><option value="L300">L300</option></select>
            <label>Status</label><select value={truckForm.status} onChange={e => setTruckForm({...truckForm, status: e.target.value})}><option value="Working">Working</option><option value="Maintenance">Maintenance</option></select>
            <div className="modal-footer"><button className="btn-cancel" onClick={() => setShowEditTruckModal(false)}>Cancel</button><button className="btn-save" onClick={handleUpdateTruck}>Update</button></div>
          </div>
        </div>
      )}

      {/* DELETE / STATUS BLOCK MODAL */}
      {deleteModal.show && (
        <div className="modal-backdrop">
          <div className="modal-card">
            <h3>{deleteModal.action === 'status_change' ? 'Cannot Update Status' : `Delete ${deleteModal.type === 'user' ? 'User' : 'Vehicle'}`}</h3>
            {conflictData.length > 0 ? (
                <div className="delete-blocked-content">
                    <div className="assignment-warning">
                        {deleteModal.action === 'status_change' 
                           ? <>Cannot set <strong>{deleteModal.name}</strong> to Maintenance. It is currently assigned to these active shipments:</>
                           : <>Cannot delete <strong>{deleteModal.name}</strong>. They are currently assigned to the following active shipments:</>
                        }
                    </div>
                    <div className="shipment-conflict-list">{conflictData.map(id => (<span key={id} className="conflict-tag">ID: {id}</span>))}</div>
                    <p className="instruction-text">Please complete or cancel these shipments first.</p>
                    <div className="modal-footer"><button className="btn-cancel" onClick={() => setDeleteModal({...deleteModal, show: false})}>Close</button></div>
                </div>
            ) : (
                <>
                    <p>Are you sure you want to delete <strong>{deleteModal.name}</strong>?</p>
                    <p style={{fontSize: '13px', color: '#666'}}>This action cannot be undone.</p>
                    <div className="modal-footer"><button className="btn-cancel" onClick={() => setDeleteModal({...deleteModal, show: false})}>Cancel</button><button className="btn-delete-confirm" onClick={confirmDelete}>Confirm Delete</button></div>
                </>
            )}
          </div>
        </div>
      )}

      {/* SUCCESS MODAL */}
      {successModal.show && (
        <div className="modal-backdrop">
          <div className="modal-card success">
            <div className="success-icon-container">
              <svg viewBox="0 0 24 24"><path d="M20 6L9 17l-5-5"></path></svg>
            </div>
            <div className="success-title">Success!</div>
            <div className="success-message">{successModal.message}</div>
            <button className="btn-success-close" onClick={() => setSuccessModal({ show: false, message: '' })}>Continue</button>
          </div>
        </div>
      )}
    </>
  );
}

export default UserManagement;