import React, { useState, useEffect } from 'react';
import axios from 'axios';
import './UserManagement.css';
import FeedbackModal from '../FeedbackModal';
import { Icons } from '../Icons';

function UserManagement({ activeTab = "users" }) { 
  
  const token = localStorage.getItem('token'); 
  const [currentPage, setCurrentPage] = useState(1);
  const rowsPerPage = 10;

  // Data & Filters
  const [users, setUsers] = useState([]);
  const [vehicles, setVehicles] = useState([]);
  const [roleFilter, setRoleFilter] = useState('All');
  const [truckFilter, setTruckFilter] = useState('All');
  const [showArchived, setShowArchived] = useState(false);

  // Modal Visibility
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showTruckModal, setShowTruckModal] = useState(false);
  const [showEditTruckModal, setShowEditTruckModal] = useState(false);
  
  // Feedback
  const [feedbackModal, setFeedbackModal] = useState(null); 

  // Forms
  const [currentUser, setCurrentUser] = useState(null);
  const [currentVehicle, setCurrentVehicle] = useState(null);
  const [userForm, setUserForm] = useState({
    firstName: '', lastName: '', email: '', phone: '', dob: '', role: 'Admin', password: '', confirmPassword: ''
  });
  const [truckForm, setTruckForm] = useState({ 
    plateNo: '', type: '6-Wheeler', status: 'Working' 
  });

  useEffect(() => { setCurrentPage(1); }, [activeTab, roleFilter, truckFilter]);

  useEffect(() => {
    if (activeTab === 'users') fetchUsers();
    else fetchVehicles();
  }, [activeTab, showArchived]);

  const fetchUsers = async () => {
    try {
        const res = await axios.get(`http://localhost:4000/api/users?archived=${showArchived}`, { 
            headers: { Authorization: `Bearer ${token}` } 
        });
        setUsers(res.data);
    } catch (err) { console.error(err); }
  };
  
  const fetchVehicles = async () => {
    try {
        const res = await axios.get(`http://localhost:4000/api/vehicles?archived=${showArchived}`, { 
            headers: { Authorization: `Bearer ${token}` } 
        });
        setVehicles(res.data);
    } catch (err) { console.error(err); }
  };

  const handleUserInputChange = (e) => {
    const { name, value } = e.target;
    e.target.setCustomValidity(''); 
    if (name === 'phone' && (!/^\d*$/.test(value) || value.length > 11)) return;
    setUserForm(prev => ({ ...prev, [name]: value }));
  };

  const handleCreateSubmit = async (e) => {
    e.preventDefault(); 

    if (userForm.password !== userForm.confirmPassword) {
        const confirmInput = e.target.elements.confirmPassword;
        confirmInput.setCustomValidity("Passwords do not match");
        confirmInput.reportValidity(); 
        return;
    }

    try {
        await axios.post('http://localhost:4000/api/users/create', userForm, { headers: { Authorization: `Bearer ${token}` } });
        setShowCreateModal(false);
        fetchUsers();
        
        setFeedbackModal({
            type: 'success',
            title: 'User Created!',
            message: `${userForm.firstName} ${userForm.lastName} has been added successfully.`,
            onClose: () => setFeedbackModal(null)
        });
    } catch (err) { 
        setFeedbackModal({
            type: 'error',
            title: 'Error',
            message: err.response?.data?.error || "Failed to create user.",
            onClose: () => setFeedbackModal(null)
        });
    }
  };

  const handleUpdateSubmit = async (e) => {
      e.preventDefault();
      if (userForm.password && userForm.password !== userForm.confirmPassword) {
        const confirmInput = e.target.elements.confirmPassword;
        confirmInput.setCustomValidity("Passwords do not match");
        confirmInput.reportValidity();
        return;
      }

      try {
        await axios.put(`http://localhost:4000/api/users/${currentUser.userID}`, userForm, { headers: { Authorization: `Bearer ${token}` } });
        setShowEditModal(false);
        fetchUsers();
        
        setFeedbackModal({
            type: 'success',
            title: 'Updated!',
            message: 'User details updated successfully.',
            onClose: () => setFeedbackModal(null)
        });
    } catch (err) { alert("Failed update"); }
  };

  const handleTruckSubmit = async (e) => {
      e.preventDefault();
      try {
          await axios.post('http://localhost:4000/api/vehicles/create', truckForm, { headers: { Authorization: `Bearer ${token}` } });
          setShowTruckModal(false);
          fetchVehicles();
          
          setFeedbackModal({
            type: 'success',
            title: 'Vehicle Added!',
            message: `Plate ${truckForm.plateNo} added successfully.`,
            onClose: () => setFeedbackModal(null)
        });
      } catch (e) { alert("Error adding vehicle"); }
  };

  const handleUpdateTruck = async (e) => {
      e.preventDefault();
      try {
          await axios.put(`http://localhost:4000/api/vehicles/${currentVehicle.vehicleID}`, truckForm, { headers: { Authorization: `Bearer ${token}` } });
          setShowEditTruckModal(false);
          fetchVehicles();
          
          setFeedbackModal({
            type: 'success',
            title: 'Vehicle Updated!',
            message: `Plate ${truckForm.plateNo} updated successfully.`,
            onClose: () => setFeedbackModal(null)
        });
      } catch (e) { alert("Error updating vehicle"); }
  };

  // --- DELETE / RESTORE / STATUS ACTIONS  ---
  const initiateDelete = (type, id, name) => {
      setFeedbackModal({
          type: 'warning',
          title: `Delete ${type === 'user' ? 'User' : 'Vehicle'}?`,
          message: `Are you sure you want to delete ${name}?`,
          subMessage: "This action cannot be undone.",
          confirmLabel: "Confirm Delete",
          onConfirm: () => performDelete(type, id)
      });
  };

  const performDelete = async (type, id) => {
      try {
          const endpoint = type === 'user' ? `http://localhost:4000/api/users/${id}` : `http://localhost:4000/api/vehicles/${id}`;
          await axios.delete(endpoint, { headers: { Authorization: `Bearer ${token}` } });
          if (type === 'user') fetchUsers(); else fetchVehicles();

          setFeedbackModal({ type: 'success', title: 'Deleted!', message: 'Record removed successfully.', onClose: () => setFeedbackModal(null) });
      } catch (err) {
          if (err.response?.status === 409) {
             const conflictList = err.response.data.activeShipments || [];
             setFeedbackModal({
                 type: 'error',
                 title: 'Cannot Delete',
                 message: `This ${type} is assigned to active shipments (ID: ${conflictList.join(', ')}).`,
                 subMessage: "Please cancel or complete the shipments first.",
                 onClose: () => setFeedbackModal(null)
             });
          } else {
             setFeedbackModal({ type: 'error', title: 'Error', message: 'Failed to delete record.', onClose: () => setFeedbackModal(null) });
          }
      }
  };

  const initiateRestore = (type, id, name) => {
      setFeedbackModal({
          type: 'restore', // New Green Type
          title: 'Confirm Restore',
          message: `Are you sure you want to restore ${name}?`,
          subMessage: "They will become active immediately.",
          confirmLabel: "Restore",
          onConfirm: async () => {
              try {
                  const endpoint = type === 'user' 
                    ? `http://localhost:4000/api/users/${id}/restore` 
                    : `http://localhost:4000/api/vehicles/${id}/restore`;
                  
                  await axios.put(endpoint, {}, { headers: { Authorization: `Bearer ${token}` } });
                  
                  if (type === 'user') fetchUsers(); else fetchVehicles();

                  setFeedbackModal({ 
                      type: 'success', 
                      title: 'Restored!', 
                      message: 'Record is active again.', 
                      onClose: () => setFeedbackModal(null) 
                  });
              } catch (err) { alert("Failed to restore"); }
          }
      });
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
              const conflicts = err.response.data.activeShipments || [];
              setFeedbackModal({
                  type: 'error',
                  title: 'Cannot Change Status',
                  message: `Vehicle is assigned to active shipments.`,
                  subMessage: "Complete shipments before setting to Maintenance.",
                  onClose: () => setFeedbackModal(null)
              });
          }
      }
  };

  const renderPagination = (totalItems) => {
    const totalPages = Math.ceil(totalItems / rowsPerPage) || 1;
    return (
        <div className="pagination-footer">
            <button disabled={currentPage === 1} onClick={() => setCurrentPage(prev => prev - 1)}>Prev</button>
            {[...Array(totalPages)].map((_, i) => ( <button key={i} className={currentPage === i + 1 ? 'active' : ''} onClick={() => setCurrentPage(i + 1)}>{i + 1}</button> ))}
            <button disabled={currentPage === totalPages} onClick={() => setCurrentPage(prev => prev + 1)}>Next</button>
        </div>
    );
  };

  const renderGhostRows = (currentCount, colSpan) => {
      const ghostsNeeded = rowsPerPage - currentCount;
      if (ghostsNeeded <= 0) return null;
      return Array.from({ length: ghostsNeeded }).map((_, idx) => ( <tr key={`ghost-${idx}`} className="ghost-row"><td colSpan={colSpan}>&nbsp;</td></tr> ));
  };

  const renderTruckView = () => {
      const filteredVehicles = vehicles.filter(v => truckFilter === 'All' || v.status === truckFilter);
      const paginatedTrucks = filteredVehicles.slice((currentPage - 1) * rowsPerPage, currentPage * rowsPerPage);
      return (
        <div className="user-mgmt-container">
          <div className="header-actions">
              <div className="filter-group-inline">
                  <label>Filter Status:</label>
                  <select value={truckFilter} onChange={e => setTruckFilter(e.target.value)} className="role-filter-dropdown">
                    <option value="All">All Statuses</option><option value="Working">Working</option><option value="Maintenance">Maintenance</option>
                  </select>
                  <button onClick={() => { setShowArchived(!showArchived); setCurrentPage(1); }}
                    style={{ padding: '8px 15px', borderRadius: '20px', border: '1px solid #CCC', background: showArchived ? '#666' : 'white', color: showArchived ? 'white' : '#666', cursor: 'pointer', fontSize: '13px', fontWeight: '600' }}>
                    {showArchived ? '← Back to Active' : 'View Archived'}
                  </button>
                  <div className="count-badge">{filteredVehicles.length} Vehicles</div>                 
              </div>
              {!showArchived && (
                 <button className="create-user-btn" onClick={() => { setTruckForm({ plateNo: '', type: '6-Wheeler', status: 'Working' }); setShowTruckModal(true); }}> + Add Vehicle </button>
              )}
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
                      {showArchived ? (
                       <button className="icon-btn" onClick={() => initiateRestore('truck', v.vehicleID)} title="Restore"><Icons.Restore/></button>
                   ) : (
                       <>
                        <button className="icon-btn" onClick={() => { setCurrentVehicle(v); setTruckForm(v); setShowEditTruckModal(true); }}><Icons.Edit/></button>
                        <button className="icon-btn" onClick={() => initiateDelete('truck', v.vehicleID, v.plateNo)}><Icons.Trash/></button>
                        </>
                      )}
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
                    <option value="All">All Roles</option><option value="Admin">Admin</option><option value="Operations">Operations</option><option value="Driver">Driver</option><option value="Helper">Helper</option>
                </select>
                <button onClick={() => { setShowArchived(!showArchived); setCurrentPage(1); }}
                    style={{ padding: '8px 15px', borderRadius: '20px', border: '1px solid #CCC', background: showArchived ? '#666' : 'white', color: showArchived ? 'white' : '#666', cursor: 'pointer', fontSize: '13px', fontWeight: '600' }}>
                    {showArchived ? '← Back to Active' : 'View Archived'}
                </button>
                <div className="count-badge">{filteredUsers.length} Users</div>
            </div>
            {!showArchived && (
                 <button className="create-user-btn" onClick={() => { setUserForm({ firstName: '', lastName: '', email: '', phone: '', dob: '', role: 'Admin', password: '', confirmPassword: '' }); setShowCreateModal(true); }}> + Create User </button>
            )}          
        </div>
        <div className="table-wrapper">
          <table className="user-table">
            <thead><tr><th>Employee ID</th><th>Name</th><th>Phone</th><th>Email</th><th>Role</th><th>Date</th><th style={{textAlign: 'center'}}>Actions</th></tr></thead>
            <tbody>
              {paginatedUsers.length > 0 ? (
                <>
                  {paginatedUsers.map(u => (
                    <tr key={u.userID}>
                      <td>{u.employeeID || 'N/A'}</td><td>{u.firstName} {u.lastName}</td><td>{u.phone || '-'}</td><td>{u.email || '-'}</td><td><span className={`role-tag ${u.role.toLowerCase()}`}>{u.role}</span></td><td>{new Date(u.dateCreated).toLocaleDateString()}</td>
                      <td className="action-cells">
                      {showArchived ? (
                       <button className="icon-btn" onClick={() => initiateRestore('user', u.userID)} title="Restore"><Icons.Restore/></button>
                   ) : (
                       <>
                         <button className="icon-btn" onClick={() => { 
                             setCurrentUser(u); 
                             const dob = u.dob ? new Date(u.dob).toISOString().split('T')[0] : '';
                             setUserForm({ ...u, dob, password: '', confirmPassword: '' });
                             setShowEditModal(true); 
                         }}><Icons.Edit/></button>
                         <button className="icon-btn" onClick={() => initiateDelete('user', u.userID, `${u.firstName} ${u.lastName}`)}><Icons.Trash/></button>
                        </>
                      )}
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

      {feedbackModal && (
          <FeedbackModal {...feedbackModal} onClose={() => setFeedbackModal(null)} />
      )}

      {showCreateModal && (
        <div className="modal-backdrop">
          <form className="modal-card" onSubmit={handleCreateSubmit}>
            <h3>Create New User</h3>
            
            <div className="form-grid">
                {/* Row 1 */}
                <div className="form-group">
                    <label>First Name</label>
                    <input type="text" name="firstName" value={userForm.firstName} onChange={handleUserInputChange} required />
                </div>
                <div className="form-group">
                    <label>Last Name</label>
                    <input type="text" name="lastName" value={userForm.lastName} onChange={handleUserInputChange} required />
                </div>

                {/* Row 2 */}
                <div className="form-group">
                    <label>Email</label>
                    <input type="email" name="email" value={userForm.email} onChange={handleUserInputChange} required />
                </div>
                <div className="form-group">
                    <label>Phone</label>
                    <input type="text" name="phone" value={userForm.phone} onChange={handleUserInputChange} required placeholder="09123456789" />
                </div>

                {/* Row 3 */}
                <div className="form-group">
                    <label>DOB</label>
                    <input type="date" name="dob" value={userForm.dob} onChange={handleUserInputChange} required />
                </div>
                <div className="form-group">
                    <label>Role</label>
                    <select name="role" value={userForm.role} onChange={handleUserInputChange}>
                        <option value="Admin">Admin</option>
                        <option value="Operations">Operations</option>
                        <option value="Driver">Driver</option>
                        <option value="Helper">Helper</option>
                    </select>
                </div>

                {/* Row 4: Password */}
                <div className="form-group">
                    <label>Password</label>
                    <input type="password" name="password" value={userForm.password} onChange={handleUserInputChange} required />
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

      {/* EDIT USER MODAL */}
      {showEditModal && (
        <div className="modal-backdrop">
          <form className="modal-card" onSubmit={handleUpdateSubmit}>
            <h3>Edit User</h3>
            
            <div className="form-grid">
                {/* Row 1 */}
                <div className="form-group">
                    <label>First Name</label>
                    <input type="text" name="firstName" value={userForm.firstName} onChange={handleUserInputChange} required />
                </div>
                <div className="form-group">
                    <label>Last Name</label>
                    <input type="text" name="lastName" value={userForm.lastName} onChange={handleUserInputChange} required />
                </div>

                {/* Row 2: Fixed Email/Phone Alignment */}
                <div className="form-group">
                    <label>Email</label>
                    <input type="email" name="email" value={userForm.email} onChange={handleUserInputChange} required />
                </div>
                <div className="form-group">
                    <label>Phone</label>
                    <input type="text" name="phone" value={userForm.phone} onChange={handleUserInputChange} required />
                </div>

                {/* Row 3 */}
                <div className="form-group">
                    <label>DOB</label>
                    <input type="date" name="dob" value={userForm.dob} onChange={handleUserInputChange} required />
                </div>
                <div className="form-group">
                    <label>Role</label>
                    <select name="role" value={userForm.role} onChange={handleUserInputChange}>
                        <option value="Admin">Admin</option>
                        <option value="Operations">Operations</option>
                        <option value="Driver">Driver</option>
                        <option value="Helper">Helper</option>
                    </select>
                </div>
            </div>

            <div className="modal-footer">
                <button type="button" className="btn-cancel" onClick={() => setShowEditModal(false)}>Cancel</button>
                <button type="submit" className="btn-save">Update</button>
            </div>
          </form>
        </div>
      )}

      {/* ADD TRUCK MODAL (WRAPPED IN FORM) */}
      {showTruckModal && (
        <div className="modal-backdrop">
          <form className="modal-card" onSubmit={handleTruckSubmit}>
            <h3>Add Vehicle</h3>
            <label>Plate</label><input value={truckForm.plateNo} onChange={e => setTruckForm({...truckForm, plateNo: e.target.value})} required />
            <label>Type</label><select value={truckForm.type} onChange={e => setTruckForm({...truckForm, type: e.target.value})}><option value="6-Wheeler">6-Wheeler</option><option value="10-Wheeler">10-Wheeler</option><option value="Wing-Van">Wing-Van</option><option value="L300">L300</option><option value="Travis">Travis</option><option value="Forward">Forward</option></select>
            <div className="modal-footer">
                <button type="button" className="btn-cancel" onClick={() => setShowTruckModal(false)}>Cancel</button>
                <button type="submit" className="btn-save">Save</button>
            </div>
          </form>
        </div>
      )}
      
      {/* EDIT TRUCK MODAL (WRAPPED IN FORM) */}
      {showEditTruckModal && (
        <div className="modal-backdrop">
          <form className="modal-card" onSubmit={handleUpdateTruck}>
            <h3>Edit Vehicle</h3>
            <label>Plate</label><input value={truckForm.plateNo} onChange={e => setTruckForm({...truckForm, plateNo: e.target.value})} required />
            <label>Type</label><select value={truckForm.type} onChange={e => setTruckForm({...truckForm, type: e.target.value})}><option value="6-Wheeler">6-Wheeler</option><option value="10-Wheeler">10-Wheeler</option><option value="L300">L300</option></select>
            <label>Status</label><select value={truckForm.status} onChange={e => setTruckForm({...truckForm, status: e.target.value})}><option value="Working">Working</option><option value="Maintenance">Maintenance</option></select>
            <div className="modal-footer">
                <button type="button" className="btn-cancel" onClick={() => setShowEditTruckModal(false)}>Cancel</button>
                <button type="submit" className="btn-save">Update</button>
            </div>
          </form>
        </div>
      )}
    </>
  );
}

export default UserManagement;