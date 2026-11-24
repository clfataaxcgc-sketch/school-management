import { useEffect, useState, useRef, useCallback } from "react";
import toast from "react-hot-toast";
import { FiSend, FiPlus, FiArrowLeft, FiMessageCircle } from "react-icons/fi";
import { useAuth } from "../../context/AuthContext.jsx";
import { useSocket } from "../../context/SocketContext.jsx";
import messageService from "../../services/messageService.js";
import Modal from "../../components/common/Modal.jsx";
import LoadingSpinner from "../../components/common/LoadingSpinner.jsx";

export default function Messages() {
  const { user } = useAuth();
  const { onNewMessage, isUserOnline } = useSocket();

  const [conversations, setConversations] = useState([]);
  const [loadingConversations, setLoadingConversations] = useState(true);
  const [activeId, setActiveId] = useState(null);

  const [messages, setMessages] = useState([]);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);

  const [contactPickerOpen, setContactPickerOpen] = useState(false);

  const scrollRef = useRef(null);
  const activeIdRef = useRef(null);
  activeIdRef.current = activeId;

  const loadConversations = useCallback(() => {
    messageService
      .getConversations()
      .then((res) => setConversations(res.conversations))
      .catch((err) => toast.error(err.message || "Failed to load conversations"))
      .finally(() => setLoadingConversations(false));
  }, []);

  useEffect(loadConversations, [loadConversations]);

  const openConversation = (id) => {
    setActiveId(id);
    setLoadingMessages(true);
    messageService
      .getMessages(id)
      .then((res) => setMessages(res.messages))
      .catch((err) => toast.error(err.message || "Failed to load messages"))
      .finally(() => setLoadingMessages(false));
    messageService.markRead(id).then(() => {
      setConversations((prev) => prev.map((c) => (c._id === id ? { ...c, unreadCount: 0 } : c)));
    });
  };

  // Real-time: append incoming messages for the open conversation, and
  // bump/refresh the conversation list either way.
  useEffect(() => {
    const unsubscribe = onNewMessage(({ conversationId, message }) => {
      if (conversationId === activeIdRef.current) {
        setMessages((prev) => [...prev, message]);
        messageService.markRead(conversationId).catch(() => {});
      }
      loadConversations();
    });
    return unsubscribe;
  }, [onNewMessage, loadConversations]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  const handleSend = async (e) => {
    e.preventDefault();
    if (!text.trim() || !activeId) return;
    setSending(true);
    try {
      const res = await messageService.sendMessage(activeId, text.trim());
      setMessages((prev) => [...prev, res.message]);
      setText("");
      loadConversations();
    } catch (err) {
      toast.error(err.message || "Failed to send message");
    } finally {
      setSending(false);
    }
  };

  const handleStartConversation = async (contactUserId) => {
    try {
      const res = await messageService.startConversation(contactUserId);
      setContactPickerOpen(false);
      loadConversations();
      openConversation(res.conversation._id);
    } catch (err) {
      toast.error(err.message || "Failed to start conversation");
    }
  };

  const activeConversation = conversations.find((c) => c._id === activeId);

  return (
    <div className="h-[calc(100vh-8rem)] lg:h-[calc(100vh-6rem)]">
      <div className="flex h-full border border-base-300 rounded-box overflow-hidden bg-base-100">
        {/* Conversation list */}
        <div className={`w-full lg:w-80 border-r border-base-300 flex-col ${activeId ? "hidden lg:flex" : "flex"}`}>
          <div className="p-3 border-b border-base-300 flex items-center justify-between">
            <h2 className="font-semibold">Messages</h2>
            <button className="btn btn-primary btn-xs" onClick={() => setContactPickerOpen(true)}>
              <FiPlus /> New
            </button>
          </div>
          <div className="flex-1 overflow-y-auto">
            {loadingConversations ? (
              <LoadingSpinner />
            ) : conversations.length === 0 ? (
              <p className="text-sm opacity-50 text-center p-6">No conversations yet.</p>
            ) : (
              conversations.map((c) => (
                <button
                  key={c._id}
                  className={`w-full text-left p-3 border-b border-base-200 hover:bg-base-200 flex items-center gap-2 ${
                    activeId === c._id ? "bg-base-200" : ""
                  }`}
                  onClick={() => openConversation(c._id)}
                >
                  <div className="avatar placeholder shrink-0">
                    <div className="bg-primary text-primary-content rounded-full w-9 relative">
                      <span className="text-xs">
                        {c.otherParticipant?.firstName?.[0]}
                        {c.otherParticipant?.lastName?.[0]}
                      </span>
                      {isUserOnline(c.otherParticipant?._id) && (
                        <span className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-success rounded-full border-2 border-base-100" />
                      )}
                    </div>
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex justify-between items-baseline">
                      <p className="font-medium text-sm truncate">
                        {c.otherParticipant?.firstName} {c.otherParticipant?.lastName}
                      </p>
                      {c.unreadCount > 0 && <span className="badge badge-primary badge-sm">{c.unreadCount}</span>}
                    </div>
                    <p className="text-xs opacity-60 truncate">{c.lastMessage?.text || "No messages yet"}</p>
                  </div>
                </button>
              ))
            )}
          </div>
        </div>

        {/* Active conversation */}
        <div className={`flex-1 flex-col ${activeId ? "flex" : "hidden lg:flex"}`}>
          {!activeId ? (
            <div className="flex-1 flex flex-col items-center justify-center opacity-40 gap-2">
              <FiMessageCircle size={40} />
              <p className="text-sm">Select a conversation</p>
            </div>
          ) : (
            <>
              <div className="p-3 border-b border-base-300 flex items-center gap-2">
                <button className="btn btn-ghost btn-sm btn-circle lg:hidden" onClick={() => setActiveId(null)}>
                  <FiArrowLeft />
                </button>
                <p className="font-medium">
                  {activeConversation?.otherParticipant?.firstName} {activeConversation?.otherParticipant?.lastName}
                </p>
                {isUserOnline(activeConversation?.otherParticipant?._id) && (
                  <span className="badge badge-success badge-xs">online</span>
                )}
              </div>

              <div ref={scrollRef} className="flex-1 overflow-y-auto p-3 space-y-2">
                {loadingMessages ? (
                  <LoadingSpinner />
                ) : (
                  messages.map((m) => {
                    const mine = m.sender === user._id || m.sender?._id === user._id;
                    return (
                      <div key={m._id} className={`chat ${mine ? "chat-end" : "chat-start"}`}>
                        <div className={`chat-bubble ${mine ? "chat-bubble-primary" : ""}`}>{m.text}</div>
                        <div className="chat-footer text-[10px] opacity-50">
                          {new Date(m.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>

              <form onSubmit={handleSend} className="p-3 border-t border-base-300 flex gap-2">
                <input
                  className="input input-bordered input-sm flex-1"
                  placeholder="Type a message..."
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                />
                <button type="submit" className="btn btn-primary btn-sm" disabled={sending || !text.trim()}>
                  <FiSend />
                </button>
              </form>
            </>
          )}
        </div>
      </div>

      <ContactPickerModal
        open={contactPickerOpen}
        onClose={() => setContactPickerOpen(false)}
        onPick={handleStartConversation}
      />
    </div>
  );
}

function ContactPickerModal({ open, onClose, onPick }) {
  const [contacts, setContacts] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    messageService
      .getContacts()
      .then((res) => setContacts(res.contacts))
      .catch((err) => toast.error(err.message || "Failed to load contacts"))
      .finally(() => setLoading(false));
  }, [open]);

  return (
    <Modal open={open} onClose={onClose} title="New Conversation">
      {loading ? (
        <LoadingSpinner />
      ) : contacts.length === 0 ? (
        <p className="text-sm opacity-50 py-6 text-center">No contacts available to message yet.</p>
      ) : (
        <ul className="space-y-1 max-h-80 overflow-y-auto">
          {contacts.map((c) => (
            <li key={c.userId}>
              <button
                className="w-full text-left p-2 rounded hover:bg-base-200 flex items-center gap-2"
                onClick={() => onPick(c.userId)}
              >
                <div className="avatar placeholder">
                  <div className="bg-primary text-primary-content rounded-full w-8">
                    <span className="text-xs">
                      {c.firstName?.[0]}
                      {c.lastName?.[0]}
                    </span>
                  </div>
                </div>
                <div>
                  <p className="text-sm font-medium">
                    {c.firstName} {c.lastName}
                  </p>
                  <p className="text-xs opacity-60 capitalize">{c.role}</p>
                </div>
                {c.online && <span className="badge badge-success badge-xs ml-auto">online</span>}
              </button>
            </li>
          ))}
        </ul>
      )}
    </Modal>
  );
}
