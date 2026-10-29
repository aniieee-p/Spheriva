import api from './api';

// Backend ready hone par false kar dena
const USE_MOCK = true;

let mockContacts = [];
const wait = (ms = 300) => new Promise((resolve) => setTimeout(resolve, ms));

// Mongo ka _id ho ya id, dono handle karo
const normalize = (contact) => ({
  id: contact._id || contact.id,
  name: contact.name,
  phone: contact.phone || contact.phoneNumber,
});

const extractList = (response) => {
  const list = response?.data || response?.contacts || response;
  return Array.isArray(list) ? list.map(normalize) : [];
};

export const contactsService = {
  async getContacts() {
    if (USE_MOCK) {
      await wait();
      return [...mockContacts];
    }
    const response = await api.get('/contacts');
    return extractList(response);
  },

  async addContact({ name, phone }) {
    if (USE_MOCK) {
      await wait();
      const created = { id: Date.now().toString(), name, phone };
      mockContacts = [...mockContacts, created];
      return created;
    }
    const response = await api.post('/contacts', { name, phone });
    return normalize(response?.data || response);
  },

  async updateContact(id, { name, phone }) {
    if (USE_MOCK) {
      await wait();
      mockContacts = mockContacts.map((c) =>
        c.id === id ? { ...c, name, phone } : c
      );
      return mockContacts.find((c) => c.id === id);
    }
    const response = await api.put(`/contacts/${id}`, { name, phone });
    return normalize(response?.data || response);
  },

  async deleteContact(id) {
    if (USE_MOCK) {
      await wait();
      mockContacts = mockContacts.filter((c) => c.id !== id);
      return;
    }
    await api.delete(`/contacts/${id}`);
  },
};