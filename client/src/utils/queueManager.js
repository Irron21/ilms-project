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
            userID: item.userID
          });
        }
      } catch (err) {
        console.error('Sync failed, keeping in queue:', err);
        newQueue.push(item);
      }
    }
    localStorage.setItem(QUEUE_KEY, JSON.stringify(newQueue));
    return newQueue.length === 0;
  }
};