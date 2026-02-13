import api from './api';

const QUEUE_KEY = 'offline_shipment_queue';

export const queueManager = {
  add: (action) => {
    const queue = JSON.parse(localStorage.getItem(QUEUE_KEY) || '[]');
    queue.push({ ...action, timestamp: Date.now() });
    localStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
  },

  process: async () => {
    if (!navigator.onLine) return;

    const queue = JSON.parse(localStorage.getItem(QUEUE_KEY) || '[]');
    if (queue.length === 0) return;

    const newQueue = [];
    for (const item of queue) {
      try {
        if (item.type === 'UPDATE_STATUS') {
          await api.put(`/shipments/${item.shipmentID}/status`, {
            status: item.status,
            userID: item.userID,
            clientTimestamp: item.timestamp,
            remarks: item.remarks || null // Pass remarks if present
          });
        }
      } catch (err) {
        const status = err.response?.status;
        // If it's a client error (4xx), the request is invalid/impossible. Drop it.
        // If it's a server error (5xx) or network error, keep it to retry.
        if (status && status >= 400 && status < 500) {
            console.warn(`Sync rejected (Status ${status}): Dropping item from queue.`, item);
            // Do NOT add to newQueue -> effectively deletes it
        } else {
            console.error('Sync failed, keeping in queue:', err.response?.data || err.message);
            newQueue.push(item);
        }
      }
    }
    localStorage.setItem(QUEUE_KEY, JSON.stringify(newQueue));
    return newQueue.length === 0;
  }
};
