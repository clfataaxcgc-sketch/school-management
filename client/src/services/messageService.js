import api from "./api.js";

const messageService = {
  getContacts: () => api.get("/messages/contacts").then((res) => res.data),
  getConversations: () => api.get("/messages/conversations").then((res) => res.data),
  startConversation: (userId) =>
    api.post("/messages/conversations", { userId }).then((res) => res.data),
  getMessages: (conversationId) =>
    api.get(`/messages/conversations/${conversationId}/messages`).then((res) => res.data),
  sendMessage: (conversationId, text) =>
    api.post(`/messages/conversations/${conversationId}/messages`, { text }).then((res) => res.data),
  markRead: (conversationId) =>
    api.put(`/messages/conversations/${conversationId}/read`).then((res) => res.data),
};

export default messageService;
