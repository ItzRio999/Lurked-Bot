import { useEffect, useMemo, useRef, useState } from "react";
import { io } from "socket.io-client";
import {
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  sendEmailVerification,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signOut,
  updateProfile,
} from "firebase/auth";
import {
  addDoc,
  arrayRemove,
  arrayUnion,
  collection,
  doc,
  deleteDoc,
  getDoc,
  getDocs,
  increment,
  limit,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  writeBatch,
} from "firebase/firestore";
import { auth, db } from "./lib/firebase";
import { adminEmails as defaultAdminEmails, forumCategories, navItems, pageLabels } from "./data/appData";
import { authButtonClass, authPrimaryButtonClass } from "./styles/buttonClasses";
import {
  isEmailValid,
  MAX_PASSWORD_LENGTH,
  MIN_PASSWORD_LENGTH,
  normalizeEmail,
  toFriendlyAuthError,
} from "./utils/auth";
import { getNextOrderIndex, recalculateOrderIndexes, sortThreadsByPinnedAndOrder } from "./utils/threadOrdering";
import BackgroundGlow from "./components/layout/BackgroundGlow";
import Footer from "./components/layout/Footer";
import NavBar from "./components/layout/NavBar";
import AuthModal from "./components/modals/AuthModal";
import CommunityPage from "./components/sections/CommunityPage";
import EventsPage from "./components/sections/EventsPage";
import ForumsPage from "./components/sections/ForumsPage";
import HomePage from "./components/sections/HomePage";
import RewardsPage from "./components/sections/RewardsPage";
import AdminPage from "./components/sections/AdminPage";
import LurkedLogo from "../icons/Lurked-updated.png";
import DiscordLogo from "../icons/discord.png";

export default function App() {
  const [activePage, setActivePage] = useState("home");
  const [authMode, setAuthMode] = useState(null);
  const [authEmail, setAuthEmail] = useState("");
  const [authPassword, setAuthPassword] = useState("");
  const [authError, setAuthError] = useState("");
  const [authNotice, setAuthNotice] = useState("");
  const [authBusy, setAuthBusy] = useState(false);
  const [currentUser, setCurrentUser] = useState(null);
  const [profileOpen, setProfileOpen] = useState(false);
  const [usernameInput, setUsernameInput] = useState("");
  const [profileMessage, setProfileMessage] = useState("");
  const [profileBusy, setProfileBusy] = useState(false);
  const [communityGateMessage, setCommunityGateMessage] = useState("");
  const [drops, setDrops] = useState([]);
  const [dropsLoading, setDropsLoading] = useState(false);
  const [dropsError, setDropsError] = useState("");
  const [dropTitle, setDropTitle] = useState("");
  const [dropDescription, setDropDescription] = useState("");
  const [dropType, setDropType] = useState("account");
  const [dropFile, setDropFile] = useState(null);
  const [dropBusy, setDropBusy] = useState(false);
  const [dropMessage, setDropMessage] = useState("");
  const [threads, setThreads] = useState([]);
  const [threadsLoading, setThreadsLoading] = useState(false);
  const [threadsError, setThreadsError] = useState("");
  const [threadTitle, setThreadTitle] = useState("");
  const [threadBody, setThreadBody] = useState("");
  const [threadCategory, setThreadCategory] = useState(
    forumCategories[0]?.label || "General"
  );
  const [threadBusy, setThreadBusy] = useState(false);
  const [threadMessage, setThreadMessage] = useState("");
  const [threadMessageTone, setThreadMessageTone] = useState("success");
  const [forumAdminMessage, setForumAdminMessage] = useState("");
  const [forumAdminTone, setForumAdminTone] = useState("success");
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [threadAdminBusyId, setThreadAdminBusyId] = useState(null);
  const [activeThreadId, setActiveThreadId] = useState(null);
  const [replies, setReplies] = useState([]);
  const [repliesLoading, setRepliesLoading] = useState(false);
  const [repliesError, setRepliesError] = useState("");
  const [replyDraft, setReplyDraft] = useState("");
  const [replyBusy, setReplyBusy] = useState(false);
  const [replyMessage, setReplyMessage] = useState("");
  const [replyMessageTone, setReplyMessageTone] = useState("success");
  const [replyAdminBusyId, setReplyAdminBusyId] = useState(null);
  const [adminEmails, setAdminEmails] = useState(defaultAdminEmails);
  const [adminEmailInput, setAdminEmailInput] = useState("");
  const [adminBusy, setAdminBusy] = useState(false);
  const [adminMessage, setAdminMessage] = useState("");
  const [adminMessageTone, setAdminMessageTone] = useState("success");
  const [adminLogs, setAdminLogs] = useState([]);
  const [adminLogsLoading, setAdminLogsLoading] = useState(false);
  const [adminStats, setAdminStats] = useState({
    totalThreads: 0,
    totalDrops: 0,
    totalAdmins: 0,
  });
  const [teamMembers, setTeamMembers] = useState([]);
  const [teamMembersLoading, setTeamMembersLoading] = useState(false);
  const [teamMembersError, setTeamMembersError] = useState("");
  const [events, setEvents] = useState([]);
  const [eventsLoading, setEventsLoading] = useState(false);
  const [eventsError, setEventsError] = useState("");
  const profileMenuRef = useRef(null);
  const isVerified = Boolean(currentUser?.emailVerified);
  const isAdmin = Boolean(
    currentUser?.email &&
      adminEmails.includes(currentUser.email.toLowerCase())
  );

  useEffect(() => {
    const getHash = () => {
      const next = window.location.hash.replace("#", "");
      return navItems.includes(next) ? next : "home";
    };
    setActivePage(getHash());

    const onHashChange = () => {
      setActivePage(getHash());
    };

    window.addEventListener("hashchange", onHashChange);
    return () => window.removeEventListener("hashchange", onHashChange);
  }, []);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setCurrentUser(user);
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!currentUser) {
      setAdminEmails(defaultAdminEmails);
      return;
    }

    const fetchAdminEmails = async () => {
      try {
        const adminDoc = await getDoc(doc(db, "settings", "admins"));
        if (adminDoc.exists()) {
          const data = adminDoc.data();
          if (Array.isArray(data.emails) && data.emails.length > 0) {
            setAdminEmails(data.emails.map((e) => e.toLowerCase()));
          }
        } else {
          await setDoc(doc(db, "settings", "admins"), {
            emails: defaultAdminEmails,
          });
        }
      } catch (error) {
        console.error("Failed to fetch admin emails:", error);
      }
    };
    fetchAdminEmails();
  }, [currentUser]);

  useEffect(() => {
    if (activePage !== "admin" || !isAdmin) {
      return;
    }
    setAdminLogsLoading(true);
    const logsQuery = query(
      collection(db, "adminLogs"),
      orderBy("timestamp", "desc"),
      limit(20)
    );
    const unsubscribe = onSnapshot(
      logsQuery,
      (snapshot) => {
        const items = snapshot.docs.map((doc) => {
          const data = doc.data();
          return {
            id: doc.id,
            action: data.action || "Unknown action",
            details: data.details || "",
            adminEmail: data.adminEmail || "Unknown",
            timestamp: data.timestamp?.toDate ? data.timestamp.toDate() : null,
          };
        });
        setAdminLogs(items);
        setAdminLogsLoading(false);
      },
      () => {
        setAdminLogsLoading(false);
      }
    );
    return () => unsubscribe();
  }, [activePage, isAdmin]);

  useEffect(() => {
    if (activePage !== "admin" || !isAdmin) {
      return;
    }
    const fetchStats = async () => {
      try {
        const fileServerUrl = import.meta.env.VITE_FILE_SERVER_URL || 'http://localhost:3002';

        const [threadsSnap, dropsResponse] = await Promise.all([
          getDocs(collection(db, "threads")),
          fetch(`${fileServerUrl}/api/drops`).then(res => res.json()),
        ]);

        setAdminStats({
          totalThreads: threadsSnap.size,
          totalDrops: dropsResponse.success ? dropsResponse.drops.length : 0,
          totalAdmins: adminEmails.length,
        });
      } catch (error) {
        console.error("Failed to fetch admin stats:", error);
      }
    };
    fetchStats();
  }, [activePage, isAdmin, adminEmails.length]);

  useEffect(() => {
    if (isVerified) {
      setCommunityGateMessage("");
    }
  }, [isVerified]);

  useEffect(() => {
    if (activePage !== "community") {
      return;
    }
    if (!isVerified) {
      setCommunityGateMessage(
        currentUser
          ? "Verify your email to unlock Drops."
          : "Sign in and verify your email to unlock Drops."
      );
    }
  }, [activePage, currentUser, isVerified]);

  useEffect(() => {
    let isActive = true;
    let socket = null;

    const loadDrops = async () => {
      if (!isVerified) {
        setDrops([]);
        setDropsError("");
        setDropsLoading(false);
        return;
      }
      setDropsLoading(true);
      setDropsError("");
      try {
        const fileServerUrl = import.meta.env.VITE_FILE_SERVER_URL || 'http://localhost:3002';
        const response = await fetch(`${fileServerUrl}/api/drops`);

        if (!response.ok) {
          throw new Error('Failed to fetch drops');
        }

        const data = await response.json();

        if (data.success) {
          const items = data.drops.map((drop) => ({
            id: drop.id,
            title: drop.title || "Untitled drop",
            description: drop.description || "",
            type: drop.type || "drop",
            fileName: drop.fileName || "download.txt",
            fileSize: drop.fileSize,
            createdAt: drop.createdAt ? new Date(drop.createdAt) : null,
            source: drop.source || "website"
          }));

          if (isActive) {
            setDrops(items);
          }
        }
      } catch (error) {
        console.error('Error loading drops:', error);
        if (isActive) {
          setDropsError("Unable to load drops right now.");
        }
      } finally {
        if (isActive) {
          setDropsLoading(false);
        }
      }
    };

    // Initialize WebSocket connection for real-time updates
    const initializeWebSocket = () => {
      if (!isVerified) return;

      const fileServerUrl = import.meta.env.VITE_FILE_SERVER_URL || 'http://localhost:3002';
      socket = io(fileServerUrl);

      socket.on('connect', () => {
        console.log('✅ WebSocket connected');
      });

      socket.on('dropAdded', (newDrop) => {
        console.log('🔔 New drop received:', newDrop);
        if (isActive) {
          setDrops((prevDrops) => {
            // Check if drop already exists
            if (prevDrops.some(d => d.id === newDrop.id)) {
              return prevDrops;
            }
            // Add new drop at the beginning
            return [{
              id: newDrop.id,
              title: newDrop.title || "Untitled drop",
              description: newDrop.description || "",
              type: newDrop.type || "drop",
              fileName: newDrop.fileName || "download.txt",
              fileSize: newDrop.fileSize,
              createdAt: newDrop.createdAt ? new Date(newDrop.createdAt) : null,
              source: newDrop.source || "website"
            }, ...prevDrops];
          });
        }
      });

      socket.on('dropDeleted', (data) => {
        console.log('🗑️ Drop deleted:', data.id);
        if (isActive) {
          setDrops((prevDrops) => prevDrops.filter(d => d.id !== data.id));
        }
      });

      socket.on('disconnect', () => {
        console.log('❌ WebSocket disconnected');
      });

      socket.on('connect_error', (error) => {
        console.error('WebSocket connection error:', error);
      });
    };

    // Load initial drops then set up WebSocket
    loadDrops().then(() => {
      if (isActive) {
        initializeWebSocket();
      }
    });

    return () => {
      isActive = false;
      if (socket) {
        socket.disconnect();
      }
    };
  }, [isVerified]);

  // Load team members from Discord API
  useEffect(() => {
    const loadTeamMembers = async () => {
      setTeamMembersLoading(true);
      setTeamMembersError("");
      try {
        const fileServerUrl = import.meta.env.VITE_FILE_SERVER_URL || 'http://localhost:3002';
        const response = await fetch(`${fileServerUrl}/api/team`);

        if (!response.ok) {
          throw new Error('Failed to fetch team members');
        }

        const data = await response.json();

        if (data.success) {
          setTeamMembers(data.members);
        }
      } catch (error) {
        console.error('Error loading team members:', error);
        setTeamMembersError("Unable to load team members right now.");
      } finally {
        setTeamMembersLoading(false);
      }
    };

    loadTeamMembers();
  }, []);

  // Load events from Discord API with WebSocket updates
  useEffect(() => {
    let isActive = true;
    let socket = null;

    const loadEvents = async () => {
      setEventsLoading(true);
      setEventsError("");
      try {
        const fileServerUrl = import.meta.env.VITE_FILE_SERVER_URL || 'http://localhost:3002';
        const response = await fetch(`${fileServerUrl}/api/events`);

        if (!response.ok) {
          throw new Error('Failed to fetch events');
        }

        const data = await response.json();

        if (data.success && isActive) {
          setEvents(data.events);
        }
      } catch (error) {
        console.error('Error loading events:', error);
        if (isActive) {
          setEventsError("Unable to load events right now.");
        }
      } finally {
        if (isActive) {
          setEventsLoading(false);
        }
      }
    };

    // Initialize WebSocket connection for real-time event updates
    const initializeWebSocket = () => {
      const fileServerUrl = import.meta.env.VITE_FILE_SERVER_URL || 'http://localhost:3002';
      socket = io(fileServerUrl);

      socket.on('connect', () => {
        console.log('✅ Events WebSocket connected');
      });

      socket.on('movieScheduleAdded', (newEvent) => {
        console.log('🔔 New movie scheduled:', newEvent);
        if (isActive) {
          setEvents((prevEvents) => {
            // Check if event already exists
            if (prevEvents.some(e => e.id === newEvent.id)) {
              return prevEvents;
            }
            // Add new event and re-sort by date
            const updatedEvents = [...prevEvents, newEvent];
            updatedEvents.sort((a, b) => new Date(a.date) - new Date(b.date));
            return updatedEvents;
          });
        }
      });

      socket.on('movieScheduleRemoved', (data) => {
        console.log('🗑️ Movie removed from schedule:', data.id);
        if (isActive) {
          setEvents((prevEvents) => prevEvents.filter(e => e.id !== data.id));
        }
      });

      socket.on('movieAnnounced', (newEvent) => {
        console.log('🎬 Movie announced:', newEvent);
        if (isActive) {
          setEvents((prevEvents) => {
            // Check if event already exists
            if (prevEvents.some(e => e.id === newEvent.id)) {
              return prevEvents;
            }
            // Add new event and re-sort by date
            const updatedEvents = [...prevEvents, newEvent];
            updatedEvents.sort((a, b) => new Date(a.date) - new Date(b.date));
            return updatedEvents;
          });
        }
      });

      socket.on('disconnect', () => {
        console.log('❌ Events WebSocket disconnected');
      });

      socket.on('connect_error', (error) => {
        console.error('Events WebSocket connection error:', error);
      });
    };

    // Load initial events then set up WebSocket
    loadEvents().then(() => {
      if (isActive) {
        initializeWebSocket();
      }
    });

    return () => {
      isActive = false;
      if (socket) {
        socket.disconnect();
      }
    };
  }, []);

  useEffect(() => {
    if (activePage !== "forums") {
      return;
    }
    setThreadsLoading(true);
    setThreadsError("");
    const threadsQuery = query(
      collection(db, "threads"),
      limit(8)
    );
    const unsubscribe = onSnapshot(
      threadsQuery,
      (snapshot) => {
        const items = snapshot.docs.map((doc) => {
          const data = doc.data();
          const createdAt = data.createdAt?.toDate
            ? data.createdAt.toDate()
            : null;
          const updatedAt = data.updatedAt?.toDate
            ? data.updatedAt.toDate()
            : createdAt;
          return {
            id: doc.id,
            title: data.title || "Untitled thread",
            body: data.body || "",
            category: data.category || "General",
            replyCount: Number.isFinite(data.replyCount)
              ? data.replyCount
              : 0,
            authorName: data.authorName || "Member",
            authorId: data.authorId || "",
            createdAt,
            updatedAt,
            pinned: Boolean(data.pinned),
            orderIndex: data.orderIndex,
          };
        });

        // Migration: Initialize orderIndex for threads that don't have it
        const threadsNeedingMigration = items.filter(
          (thread) => thread.orderIndex === null || thread.orderIndex === undefined
        );

        if (threadsNeedingMigration.length > 0) {
          // Batch update threads with missing orderIndex
          const batch = writeBatch(db);
          threadsNeedingMigration.forEach((thread, index) => {
            const orderIndex = thread.createdAt
              ? thread.createdAt.getTime()
              : Date.now() + index;
            batch.update(doc(db, "threads", thread.id), { orderIndex });
            // Update local copy
            thread.orderIndex = orderIndex;
          });

          // Fire and forget - don't block UI
          batch.commit().catch((error) => {
            console.error("Failed to migrate thread orderIndex:", error);
          });
        }

        // Sort threads by pinned status and orderIndex
        const sortedThreads = sortThreadsByPinnedAndOrder(items);
        setThreads(sortedThreads);
        setThreadsLoading(false);
      },
      () => {
        setThreadsError("Unable to load threads right now.");
        setThreadsLoading(false);
      }
    );
    return () => unsubscribe();
  }, [activePage]);

  useEffect(() => {
    if (!activeThreadId) {
      setReplies([]);
      setRepliesLoading(false);
      setRepliesError("");
      setReplyDraft("");
      setReplyMessage("");
      return;
    }
    setRepliesLoading(true);
    setRepliesError("");
    setReplyMessage("");
    const repliesQuery = query(
      collection(db, "threads", activeThreadId, "replies"),
      orderBy("createdAt", "asc"),
      limit(40)
    );
    const unsubscribe = onSnapshot(
      repliesQuery,
      (snapshot) => {
        const items = snapshot.docs.map((doc) => {
          const data = doc.data();
          const createdAt = data.createdAt?.toDate
            ? data.createdAt.toDate()
            : null;
          return {
            id: doc.id,
            body: data.body || "",
            authorName: data.authorName || "Member",
            authorId: data.authorId || "",
            createdAt,
          };
        });
        setReplies(items);
        setRepliesLoading(false);
      },
      () => {
        setRepliesError("Unable to load replies right now.");
        setRepliesLoading(false);
      }
    );
    return () => unsubscribe();
  }, [activeThreadId]);

  const handleDropSubmit = async (event) => {
    event.preventDefault();
    if (!isAdmin || dropBusy) {
      return;
    }
    const trimmedTitle = dropTitle.trim();
    if (!trimmedTitle) {
      setDropMessage("Title is required.");
      return;
    }
    if (!dropFile) {
      setDropMessage("Choose a file to upload.");
      return;
    }
    setDropBusy(true);
    setDropMessage("");
    try {
      // Get Firebase ID token for authentication
      const idToken = await currentUser.getIdToken();

      // Upload to Discord bot API
      const formData = new FormData();
      formData.append('file', dropFile);
      formData.append('title', trimmedTitle);
      formData.append('description', dropDescription.trim());
      formData.append('type', dropType.trim() || "account");

      const fileServerUrl = import.meta.env.VITE_FILE_SERVER_URL || 'http://localhost:3002';
      const uploadResponse = await fetch(`${fileServerUrl}/api/upload-drop`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${idToken}`
        },
        body: formData,
      });

      if (!uploadResponse.ok) {
        throw new Error('Upload failed');
      }

      const uploadData = await uploadResponse.json();

      if (uploadData.success) {
        setDropTitle("");
        setDropDescription("");
        setDropType("account");
        setDropFile(null);
        setDropMessage("Drop uploaded successfully!");
        await logAdminAction("Uploaded drop", trimmedTitle);
      } else {
        throw new Error(uploadData.error || 'Upload failed');
      }
    } catch (error) {
      console.error('Upload error:', error);
      setDropMessage(error.message || "Upload failed. Try again.");
    } finally {
      setDropBusy(false);
    }
  };

  const logAdminAction = async (action, details) => {
    try {
      await addDoc(collection(db, "adminLogs"), {
        action,
        details,
        adminEmail: currentUser?.email || "Unknown",
        timestamp: serverTimestamp(),
      });
    } catch (error) {
      console.error("Failed to log admin action:", error);
    }
  };

  const handleThreadSubmit = async (event) => {
    event.preventDefault();
    if (!currentUser || threadBusy) {
      return;
    }
    const trimmedTitle = threadTitle.trim();
    const trimmedBody = threadBody.trim();
    if (trimmedTitle.length < 3) {
      setThreadMessageTone("error");
      setThreadMessage("Title must be at least 3 characters.");
      return;
    }
    if (trimmedTitle.length > 120) {
      setThreadMessageTone("error");
      setThreadMessage("Title must be 120 characters or less.");
      return;
    }
    if (trimmedBody.length > 800) {
      setThreadMessageTone("error");
      setThreadMessage("Body must be 800 characters or less.");
      return;
    }
    setThreadBusy(true);
    setThreadMessageTone("success");
    setThreadMessage("");
    const authorName =
      currentUser.displayName?.trim() ||
      currentUser.email?.split("@")[0] ||
      "Member";
    try {
      await addDoc(collection(db, "threads"), {
        title: trimmedTitle,
        body: trimmedBody,
        category: threadCategory,
        replyCount: 0,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        authorId: currentUser.uid,
        authorName,
        orderIndex: getNextOrderIndex(threads),
      });
      setThreadTitle("");
      setThreadBody("");
      setThreadCategory(forumCategories[0]?.label || "General");
      setThreadMessageTone("success");
      setThreadMessage("Thread posted.");
    } catch (error) {
      setThreadMessageTone("error");
      setThreadMessage("Unable to post thread right now.");
    } finally {
      setThreadBusy(false);
    }
  };

  const handleReplySubmit = async (event) => {
    event.preventDefault();
    if (!currentUser || replyBusy || !activeThreadId) {
      return;
    }
    const trimmedReply = replyDraft.trim();
    if (!trimmedReply) {
      setReplyMessageTone("error");
      setReplyMessage("Reply cannot be empty.");
      return;
    }
    if (trimmedReply.length > 600) {
      setReplyMessageTone("error");
      setReplyMessage("Reply must be 600 characters or less.");
      return;
    }
    setReplyBusy(true);
    setReplyMessage("");
    setReplyMessageTone("success");
    const authorName =
      currentUser.displayName?.trim() ||
      currentUser.email?.split("@")[0] ||
      "Member";
    try {
      await addDoc(collection(db, "threads", activeThreadId, "replies"), {
        body: trimmedReply,
        createdAt: serverTimestamp(),
        authorId: currentUser.uid,
        authorName,
      });
      await updateDoc(doc(db, "threads", activeThreadId), {
        replyCount: increment(1),
        updatedAt: serverTimestamp(),
      });
      setReplyDraft("");
      setReplyMessage("Reply posted.");
    } catch (error) {
      setReplyMessageTone("error");
      setReplyMessage("Unable to post reply right now.");
    } finally {
      setReplyBusy(false);
    }
  };

  const deleteThreadWithReplies = async (threadId) => {
    const repliesRef = collection(db, "threads", threadId, "replies");
    const snapshot = await getDocs(repliesRef);
    let batch = writeBatch(db);
    let operationCount = 0;
    for (const replyDoc of snapshot.docs) {
      batch.delete(replyDoc.ref);
      operationCount += 1;
      if (operationCount >= 450) {
        await batch.commit();
        batch = writeBatch(db);
        operationCount = 0;
      }
    }
    if (operationCount > 0) {
      await batch.commit();
    }
    await deleteDoc(doc(db, "threads", threadId));
  };

  const handleThreadPinToggle = async (event, thread) => {
    event.stopPropagation();
    if (!isAdmin || threadAdminBusyId) {
      return;
    }
    setThreadAdminBusyId(thread.id);
    setForumAdminMessage("");
    try {
      await updateDoc(doc(db, "threads", thread.id), {
        pinned: !thread.pinned,
        updatedAt: serverTimestamp(),
      });
      setForumAdminTone("success");
      setForumAdminMessage(
        thread.pinned ? "Thread unpinned." : "Thread pinned."
      );
      await logAdminAction(
        thread.pinned ? "Unpinned thread" : "Pinned thread",
        thread.title
      );
    } catch (error) {
      setForumAdminTone("error");
      setForumAdminMessage("Unable to update thread right now.");
    } finally {
      setThreadAdminBusyId(null);
    }
  };

  const handleThreadDelete = async (event, thread) => {
    event.stopPropagation();
    if (!isAdmin || threadAdminBusyId) {
      return;
    }
    const confirmed = window.confirm(
      `Delete "${thread.title}"? This also removes replies.`
    );
    if (!confirmed) {
      return;
    }
    setThreadAdminBusyId(thread.id);
    setForumAdminMessage("");
    try {
      await deleteThreadWithReplies(thread.id);
      if (activeThreadId === thread.id) {
        setActiveThreadId(null);
      }
      setForumAdminTone("success");
      setForumAdminMessage("Thread deleted.");
      await logAdminAction("Deleted thread", thread.title);
    } catch (error) {
      setForumAdminTone("error");
      setForumAdminMessage("Unable to delete thread right now.");
    } finally {
      setThreadAdminBusyId(null);
    }
  };

  const handleReplyDelete = async (event, replyId) => {
    event.stopPropagation();
    if (!isAdmin || replyAdminBusyId || !activeThreadId) {
      return;
    }
    const confirmed = window.confirm("Delete this reply?");
    if (!confirmed) {
      return;
    }
    setReplyAdminBusyId(replyId);
    setReplyMessage("");
    try {
      await deleteDoc(doc(db, "threads", activeThreadId, "replies", replyId));
      await updateDoc(doc(db, "threads", activeThreadId), {
        replyCount: increment(-1),
        updatedAt: serverTimestamp(),
      });
      setReplyMessageTone("success");
      setReplyMessage("Reply deleted.");
      await logAdminAction("Deleted reply", `Reply ID: ${replyId}`);
    } catch (error) {
      setReplyMessageTone("error");
      setReplyMessage("Unable to delete reply right now.");
    } finally {
      setReplyAdminBusyId(null);
    }
  };

  const handleThreadReorder = async (oldIndex, newIndex) => {
    if (!isAdmin || threadAdminBusyId) {
      return;
    }

    // Optimistically update local state
    const currentThreads = [...threads];
    const reorderedThreads = recalculateOrderIndexes(
      currentThreads,
      oldIndex,
      newIndex
    );

    // Update UI immediately for smooth experience
    setThreads(reorderedThreads);

    // Prepare batch write to Firebase
    try {
      const batch = writeBatch(db);

      // Only update threads whose orderIndex changed
      reorderedThreads.forEach((thread, index) => {
        const originalThread = currentThreads[index];
        if (
          !originalThread ||
          originalThread.id !== thread.id ||
          originalThread.orderIndex !== thread.orderIndex
        ) {
          batch.update(doc(db, "threads", thread.id), {
            orderIndex: thread.orderIndex,
            updatedAt: serverTimestamp(),
          });
        }
      });

      await batch.commit();

      // Log the reorder action
      const movedThread = reorderedThreads[newIndex];
      await logAdminAction("Reordered thread", movedThread.title);
    } catch (error) {
      console.error("Failed to reorder threads:", error);
      // Revert to original state on error
      setThreads(currentThreads);
      setForumAdminTone("error");
      setForumAdminMessage("Unable to reorder threads right now.");
    }
  };

  useEffect(() => {
    if (!profileOpen) {
      return;
    }

    const handlePointerDown = (event) => {
      if (!profileMenuRef.current) {
        return;
      }
      if (profileMenuRef.current.contains(event.target)) {
        return;
      }
      setProfileOpen(false);
    };

    const handleKeyDown = (event) => {
      if (event.key === "Escape") {
        setProfileOpen(false);
      }
    };

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [profileOpen]);

  const handleNav = (target) => (event) => {
    if (event) {
      event.preventDefault();
    }
    if (!target) {
      return;
    }
    if (target === "community" && !isVerified) {
      setCommunityGateMessage(
        currentUser
          ? "Verify your email to unlock Drops."
          : "Sign in and verify your email to unlock Drops."
      );
      setActivePage("community");
      if (!currentUser) {
        openAuth("signin")();
      }
      return;
    }
    setCommunityGateMessage("");
    setActivePage(target);
    const nextHash = `#${target}`;
    if (window.location.hash !== nextHash) {
      window.location.hash = nextHash;
    }
  };

  const navLinkClass = (name) =>
    `nav-link text-sm transition-colors duration-200 ${
      activePage === name ? "active" : ""
    }`;

  const welcomeName = useMemo(() => {
    if (!currentUser) {
      return "";
    }
    const displayName = currentUser.displayName?.trim();
    if (displayName) {
      return displayName;
    }
    const email = currentUser.email || "";
    const local = email.split("@")[0];
    return local || "Friend";
  }, [currentUser]);

  const welcomeText = useMemo(
    () => (currentUser ? `WELCOME, ${welcomeName}` : ""),
    [currentUser, welcomeName]
  );

  const handleThreadToggle = (threadId) => {
    setActiveThreadId((prev) => (prev === threadId ? null : threadId));
  };

  const openAuth = (mode) => () => {
    setAuthMode(mode);
    setAuthEmail("");
    setAuthPassword("");
    setAuthError("");
    setAuthNotice("");
    setProfileOpen(false);
  };

  const closeAuth = () => {
    setAuthMode(null);
    setAuthError("");
    setAuthNotice("");
  };

  const handleAuthSubmit = async (event) => {
    event.preventDefault();
    if (authBusy) {
      return;
    }
    setAuthError("");
    setAuthNotice("");
    if (!authMode) {
      setAuthError("Choose sign in or sign up to continue.");
      return;
    }
    const trimmedEmail = normalizeEmail(authEmail);
    if (!isEmailValid(trimmedEmail)) {
      setAuthError("Enter a valid email address.");
      return;
    }
    const trimmedPassword = authPassword.trim();
    if (!trimmedPassword) {
      setAuthError("Password is required.");
      return;
    }
    if (trimmedPassword.length > MAX_PASSWORD_LENGTH) {
      setAuthError("Password is too long.");
      return;
    }
    if (authMode === "signup" && trimmedPassword.length < MIN_PASSWORD_LENGTH) {
      setAuthError("Password must be at least 8 characters.");
      return;
    }
    setAuthBusy(true);
    try {
      if (authMode === "signup") {
        await createUserWithEmailAndPassword(
          auth,
          trimmedEmail,
          trimmedPassword
        );
      } else {
        await signInWithEmailAndPassword(auth, trimmedEmail, trimmedPassword);
      }
      closeAuth();
    } catch (error) {
      setAuthError(toFriendlyAuthError(error));
    } finally {
      setAuthBusy(false);
    }
  };

  const handleSignOut = async () => {
    try {
      await signOut(auth);
      setProfileOpen(false);
    } catch (error) {
      setAuthError(toFriendlyAuthError(error));
    }
  };

  const handleAuthPasswordReset = async () => {
    if (authBusy) {
      return;
    }
    const trimmedEmail = normalizeEmail(authEmail);
    if (!isEmailValid(trimmedEmail)) {
      setAuthError("Enter a valid email to reset your password.");
      setAuthNotice("");
      return;
    }
    setAuthBusy(true);
    setAuthError("");
    setAuthNotice("");
    try {
      await sendPasswordResetEmail(auth, trimmedEmail);
      setAuthNotice("Password reset email sent.");
    } catch (error) {
      setAuthError(toFriendlyAuthError(error));
    } finally {
      setAuthBusy(false);
    }
  };

  const handleUsernameSave = async () => {
    if (!currentUser || profileBusy) {
      return;
    }
    const nextName = usernameInput.trim();
    if (nextName.length < 2) {
      setProfileMessage("Username must be at least 2 characters.");
      return;
    }
    if (nextName.length > 35) {
      setProfileMessage("Username must be 35 characters or less.");
      return;
    }
    setProfileBusy(true);
    setProfileMessage("");
    try {
      await updateProfile(currentUser, { displayName: nextName });
      setCurrentUser((prev) => (prev ? { ...prev, displayName: nextName } : prev));
      setProfileMessage("Username updated.");
    } catch (error) {
      setProfileMessage(toFriendlyAuthError(error));
    } finally {
      setProfileBusy(false);
    }
  };

  const handleVerifyEmail = async () => {
    if (!currentUser || profileBusy) {
      return;
    }
    if (currentUser.emailVerified) {
      setProfileMessage("Email already verified.");
      return;
    }
    setProfileBusy(true);
    setProfileMessage("");
    try {
      await sendEmailVerification(currentUser);
      setProfileMessage("Verification email sent.");
    } catch (error) {
      setProfileMessage(toFriendlyAuthError(error));
    } finally {
      setProfileBusy(false);
    }
  };

  const handlePasswordReset = async () => {
    if (!currentUser || profileBusy) {
      return;
    }
    if (!currentUser.email) {
      setProfileMessage("No email on this account.");
      return;
    }
    setProfileBusy(true);
    setProfileMessage("");
    try {
      await sendPasswordResetEmail(auth, currentUser.email);
      setProfileMessage("Password reset email sent.");
    } catch (error) {
      setProfileMessage(toFriendlyAuthError(error));
    } finally {
      setProfileBusy(false);
    }
  };

  const handleProfileToggle = () => {
    setProfileOpen((prev) => {
      const next = !prev;
      if (next) {
        setProfileMessage("");
        setUsernameInput(currentUser?.displayName || "");
      }
      return next;
    });
  };

  const handleUsernameInputChange = (event) => {
    setUsernameInput(event.target.value);
  };

  const handleDropTitleChange = (event) => {
    setDropTitle(event.target.value);
  };

  const handleDropTypeChange = (event) => {
    setDropType(event.target.value);
  };

  const handleDropDescriptionChange = (event) => {
    setDropDescription(event.target.value);
  };

  const handleDropFileChange = (event) => {
    setDropFile(event.target.files?.[0] || null);
  };

  const handleThreadTitleChange = (event) => {
    setThreadTitle(event.target.value);
  };

  const handleThreadBodyChange = (event) => {
    setThreadBody(event.target.value);
  };

  const handleThreadCategoryChange = (event) => {
    setThreadCategory(event.target.value);
  };

  const handleCategorySelect = (category) => {
    setSelectedCategory(category);
  };

  const handleReplyDraftChange = (event) => {
    setReplyDraft(event.target.value);
  };

  const handleAuthEmailChange = (event) => {
    setAuthEmail(event.target.value);
  };

  const handleAuthPasswordChange = (event) => {
    setAuthPassword(event.target.value);
  };

  const handleAdminEmailInputChange = (event) => {
    setAdminEmailInput(event.target.value);
  };

  const handleAddAdmin = async (event) => {
    event.preventDefault();
    if (!isAdmin || adminBusy) {
      return;
    }
    const email = adminEmailInput.trim().toLowerCase();
    if (!isEmailValid(email)) {
      setAdminMessageTone("error");
      setAdminMessage("Enter a valid email address.");
      return;
    }
    if (adminEmails.includes(email)) {
      setAdminMessageTone("error");
      setAdminMessage("This email is already an admin.");
      return;
    }
    setAdminBusy(true);
    setAdminMessage("");
    try {
      await updateDoc(doc(db, "settings", "admins"), {
        emails: arrayUnion(email),
      });
      setAdminEmails((prev) => [...prev, email]);
      setAdminEmailInput("");
      setAdminMessageTone("success");
      setAdminMessage("Admin added successfully.");
      await logAdminAction("Added admin", email);
    } catch (error) {
      setAdminMessageTone("error");
      setAdminMessage("Failed to add admin. Try again.");
    } finally {
      setAdminBusy(false);
    }
  };

  const handleRemoveAdmin = async (email) => {
    if (!isAdmin || adminBusy) {
      return;
    }
    if (adminEmails.length <= 1) {
      setAdminMessageTone("error");
      setAdminMessage("Cannot remove the last admin.");
      return;
    }
    const confirmed = window.confirm(`Remove admin privileges from ${email}?`);
    if (!confirmed) {
      return;
    }
    setAdminBusy(true);
    setAdminMessage("");
    try {
      await updateDoc(doc(db, "settings", "admins"), {
        emails: arrayRemove(email.toLowerCase()),
      });
      setAdminEmails((prev) => prev.filter((e) => e !== email.toLowerCase()));
      setAdminMessageTone("success");
      setAdminMessage("Admin removed successfully.");
      await logAdminAction("Removed admin", email);
    } catch (error) {
      setAdminMessageTone("error");
      setAdminMessage("Failed to remove admin. Try again.");
    } finally {
      setAdminBusy(false);
    }
  };

  const handleClearLogs = async () => {
    if (!isAdmin || adminBusy) {
      return;
    }
    const confirmed = window.confirm("Clear all admin logs? This cannot be undone.");
    if (!confirmed) {
      return;
    }
    setAdminBusy(true);
    setAdminMessage("");
    try {
      const logsSnap = await getDocs(collection(db, "adminLogs"));
      const batch = writeBatch(db);
      logsSnap.docs.forEach((doc) => {
        batch.delete(doc.ref);
      });
      await batch.commit();
      setAdminMessageTone("success");
      setAdminMessage("Logs cleared successfully.");
    } catch (error) {
      setAdminMessageTone("error");
      setAdminMessage("Failed to clear logs. Try again.");
    } finally {
      setAdminBusy(false);
    }
  };

  // Drop management handlers
  const [dropUploadFile, setDropUploadFile] = useState(null);
  const [dropUploadTitle, setDropUploadTitle] = useState("");
  const [dropUploadDescription, setDropUploadDescription] = useState("");
  const [dropUploadType, setDropUploadType] = useState("account");
  const [dropUploadBusy, setDropUploadBusy] = useState(false);
  const [dropUploadMessage, setDropUploadMessage] = useState("");
  const [dropUploadMessageTone, setDropUploadMessageTone] = useState("success");

  // Event management state
  const [eventUploadTitle, setEventUploadTitle] = useState("");
  const [eventUploadDate, setEventUploadDate] = useState("");
  const [eventUploadGenre, setEventUploadGenre] = useState("");
  const [eventUploadBusy, setEventUploadBusy] = useState(false);
  const [eventUploadMessage, setEventUploadMessage] = useState("");
  const [eventUploadMessageTone, setEventUploadMessageTone] = useState("success");

  const handleAdminDropFileChange = (event) => {
    const file = event.target.files?.[0];
    if (file) {
      if (!file.name.endsWith('.txt')) {
        setDropUploadMessageTone("error");
        setDropUploadMessage("Only .txt files are allowed.");
        event.target.value = '';
        return;
      }
      if (file.size > 50 * 1024 * 1024) {
        setDropUploadMessageTone("error");
        setDropUploadMessage("File must be smaller than 50MB.");
        event.target.value = '';
        return;
      }
      setDropUploadFile(file);
      setDropUploadMessage("");
      // Auto-fill title from filename
      if (!dropUploadTitle) {
        setDropUploadTitle(file.name.replace('.txt', ''));
      }
    }
  };

  const handleUploadDrop = async (event) => {
    event.preventDefault();
    if (!isAdmin || dropUploadBusy) {
      return;
    }
    if (!dropUploadFile) {
      setDropUploadMessageTone("error");
      setDropUploadMessage("Please select a file to upload.");
      return;
    }
    if (!dropUploadTitle.trim()) {
      setDropUploadMessageTone("error");
      setDropUploadMessage("Please enter a title.");
      return;
    }

    setDropUploadBusy(true);
    setDropUploadMessage("");

    try {
      // Get Firebase ID token for authentication
      const idToken = await currentUser.getIdToken();

      const fileServerUrl = import.meta.env.VITE_FILE_SERVER_URL || 'http://localhost:3002';
      const formData = new FormData();
      formData.append('file', dropUploadFile);
      formData.append('title', dropUploadTitle.trim());
      formData.append('description', dropUploadDescription.trim());
      formData.append('type', dropUploadType);

      const response = await fetch(`${fileServerUrl}/api/upload-drop`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${idToken}`
        },
        body: formData
      });

      const data = await response.json();

      if (data.success) {
        setDropUploadMessageTone("success");
        setDropUploadMessage("Drop uploaded successfully!");
        // Clear form
        setDropUploadFile(null);
        setDropUploadTitle("");
        setDropUploadDescription("");
        setDropUploadType("account");
        // Clear file input
        const fileInput = document.getElementById('drop-file-input');
        if (fileInput) fileInput.value = '';

        await logAdminAction("Uploaded drop", dropUploadTitle.trim());
      } else {
        throw new Error(data.error || 'Upload failed');
      }
    } catch (error) {
      console.error('Error uploading drop:', error);
      setDropUploadMessageTone("error");
      setDropUploadMessage(error.message || "Failed to upload drop. Try again.");
    } finally {
      setDropUploadBusy(false);
    }
  };

  const handleDeleteDrop = async (dropId, dropTitle) => {
    if (!isAdmin || adminBusy) {
      return;
    }

    const confirmed = window.confirm(`Delete "${dropTitle}"? This cannot be undone.`);
    if (!confirmed) {
      return;
    }

    setAdminBusy(true);
    setAdminMessage("");

    try {
      // Get Firebase ID token for authentication
      const idToken = await currentUser.getIdToken();

      const fileServerUrl = import.meta.env.VITE_FILE_SERVER_URL || 'http://localhost:3002';
      const response = await fetch(`${fileServerUrl}/api/drop/${dropId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${idToken}`
        }
      });

      const data = await response.json();

      if (data.success) {
        setAdminMessageTone("success");
        setAdminMessage("Drop deleted successfully!");
        await logAdminAction("Deleted drop", dropTitle);
      } else {
        throw new Error(data.error || 'Delete failed');
      }
    } catch (error) {
      console.error('Error deleting drop:', error);
      setAdminMessageTone("error");
      setAdminMessage(error.message || "Failed to delete drop. Try again.");
    } finally {
      setAdminBusy(false);
    }
  };

  // Event management handlers
  const handleUploadEvent = async () => {
    if (!isAdmin || eventUploadBusy) {
      return;
    }

    // Validate inputs
    const trimmedTitle = eventUploadTitle.trim();
    if (!trimmedTitle) {
      setEventUploadMessageTone("error");
      setEventUploadMessage("Event title is required.");
      return;
    }

    if (trimmedTitle.length < 3 || trimmedTitle.length > 100) {
      setEventUploadMessageTone("error");
      setEventUploadMessage("Title must be between 3 and 100 characters.");
      return;
    }

    if (!eventUploadDate) {
      setEventUploadMessageTone("error");
      setEventUploadMessage("Event date is required.");
      return;
    }

    // Validate date is in the future
    const selectedDate = new Date(eventUploadDate);
    if (isNaN(selectedDate.getTime())) {
      setEventUploadMessageTone("error");
      setEventUploadMessage("Invalid date format.");
      return;
    }

    if (selectedDate <= new Date()) {
      setEventUploadMessageTone("error");
      setEventUploadMessage("Event date must be in the future.");
      return;
    }

    setEventUploadBusy(true);
    setEventUploadMessage("");

    try {
      // Get Firebase ID token for authentication
      const idToken = await currentUser.getIdToken();

      const fileServerUrl = import.meta.env.VITE_FILE_SERVER_URL || 'http://localhost:3002';
      const response = await fetch(`${fileServerUrl}/api/events`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${idToken}`
        },
        body: JSON.stringify({
          title: trimmedTitle,
          date: selectedDate.toISOString(),
          genre: eventUploadGenre.trim() || null
        })
      });

      const data = await response.json();

      if (data.success) {
        setEventUploadMessageTone("success");
        setEventUploadMessage("Event scheduled successfully!");

        // Clear form
        setEventUploadTitle("");
        setEventUploadDate("");
        setEventUploadGenre("");

        // Log admin action
        await logAdminAction("Scheduled event", trimmedTitle);
      } else {
        throw new Error(data.error || 'Failed to schedule event');
      }
    } catch (error) {
      console.error('Error scheduling event:', error);
      setEventUploadMessageTone("error");
      setEventUploadMessage(error.message || "Failed to schedule event. Try again.");
    } finally {
      setEventUploadBusy(false);
    }
  };

  const handleDeleteEvent = async (eventId, eventTitle) => {
    if (!isAdmin || eventUploadBusy) {
      return;
    }

    const confirmed = window.confirm(`Delete "${eventTitle}"? This cannot be undone.`);
    if (!confirmed) {
      return;
    }

    setEventUploadBusy(true);
    setEventUploadMessage("");

    try {
      // Get Firebase ID token for authentication
      const idToken = await currentUser.getIdToken();

      const fileServerUrl = import.meta.env.VITE_FILE_SERVER_URL || 'http://localhost:3002';
      const response = await fetch(`${fileServerUrl}/api/events/${eventId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${idToken}`
        }
      });

      const data = await response.json();

      if (data.success) {
        setEventUploadMessageTone("success");
        setEventUploadMessage("Event deleted successfully!");
        await logAdminAction("Deleted event", eventTitle);
      } else {
        throw new Error(data.error || 'Delete failed');
      }
    } catch (error) {
      console.error('Error deleting event:', error);
      setEventUploadMessageTone("error");
      setEventUploadMessage(error.message || "Failed to delete event. Try again.");
    } finally {
      setEventUploadBusy(false);
    }
  };

  return (
    <>
      <BackgroundGlow />
      <NavBar
        LurkedLogo={LurkedLogo}
        DiscordLogo={DiscordLogo}
        navItems={navItems}
        pageLabels={pageLabels}
        navLinkClass={navLinkClass}
        onNav={handleNav}
        currentUser={currentUser}
        welcomeName={welcomeName}
        profileOpen={profileOpen}
        profileMenuRef={profileMenuRef}
        profileMessage={profileMessage}
        profileBusy={profileBusy}
        usernameInput={usernameInput}
        onUsernameInputChange={handleUsernameInputChange}
        onProfileToggle={handleProfileToggle}
        onVerifyEmail={handleVerifyEmail}
        onPasswordReset={handlePasswordReset}
        onUsernameSave={handleUsernameSave}
        onSignOut={handleSignOut}
        onAuthOpen={openAuth}
        authButtonClass={authButtonClass}
        authPrimaryButtonClass={authPrimaryButtonClass}
        isAdmin={isAdmin}
      />
      <HomePage
        activePage={activePage}
        currentUser={currentUser}
        welcomeText={welcomeText}
        onNav={handleNav}
        LurkedLogo={LurkedLogo}
        teamMembers={teamMembers}
        teamMembersLoading={teamMembersLoading}
        teamMembersError={teamMembersError}
      />
      <CommunityPage
        activePage={activePage}
        isVerified={isVerified}
        communityGateMessage={communityGateMessage}
        currentUser={currentUser}
        onAuthOpen={openAuth}
        authButtonClass={authButtonClass}
        authPrimaryButtonClass={authPrimaryButtonClass}
        onVerifyEmail={handleVerifyEmail}
        profileBusy={profileBusy}
        isAdmin={isAdmin}
        onDropSubmit={handleDropSubmit}
        dropTitle={dropTitle}
        onDropTitleChange={handleDropTitleChange}
        dropType={dropType}
        onDropTypeChange={handleDropTypeChange}
        onDropFileChange={handleDropFileChange}
        dropDescription={dropDescription}
        onDropDescriptionChange={handleDropDescriptionChange}
        dropMessage={dropMessage}
        dropBusy={dropBusy}
        dropsLoading={dropsLoading}
        dropsError={dropsError}
        drops={drops}
      />
      <ForumsPage
        activePage={activePage}
        currentUser={currentUser}
        isAdmin={isAdmin}
        threadsLoading={threadsLoading}
        threadsError={threadsError}
        threads={threads}
        selectedCategory={selectedCategory}
        onCategorySelect={handleCategorySelect}
        threadTitle={threadTitle}
        threadBody={threadBody}
        threadCategory={threadCategory}
        onThreadTitleChange={handleThreadTitleChange}
        onThreadBodyChange={handleThreadBodyChange}
        onThreadCategoryChange={handleThreadCategoryChange}
        threadBusy={threadBusy}
        threadMessage={threadMessage}
        threadMessageTone={threadMessageTone}
        forumAdminMessage={forumAdminMessage}
        forumAdminTone={forumAdminTone}
        threadAdminBusyId={threadAdminBusyId}
        activeThreadId={activeThreadId}
        replies={replies}
        repliesLoading={repliesLoading}
        repliesError={repliesError}
        replyDraft={replyDraft}
        onReplyDraftChange={handleReplyDraftChange}
        replyBusy={replyBusy}
        replyMessage={replyMessage}
        replyMessageTone={replyMessageTone}
        replyAdminBusyId={replyAdminBusyId}
        onThreadSubmit={handleThreadSubmit}
        onThreadToggle={handleThreadToggle}
        onThreadPinToggle={handleThreadPinToggle}
        onThreadDelete={handleThreadDelete}
        onReplySubmit={handleReplySubmit}
        onReplyDelete={handleReplyDelete}
        onAuthOpen={openAuth}
        onThreadReorder={handleThreadReorder}
      />
      <RewardsPage activePage={activePage} />
      <EventsPage
        activePage={activePage}
        events={events}
        eventsLoading={eventsLoading}
        eventsError={eventsError}
        isAdmin={isAdmin}
        onDeleteEvent={handleDeleteEvent}
      />
      <AdminPage
        activePage={activePage}
        isAdmin={isAdmin}
        adminEmails={adminEmails}
        adminEmailInput={adminEmailInput}
        onAdminEmailInputChange={handleAdminEmailInputChange}
        onAddAdmin={handleAddAdmin}
        onRemoveAdmin={handleRemoveAdmin}
        adminBusy={adminBusy}
        adminMessage={adminMessage}
        adminMessageTone={adminMessageTone}
        adminLogs={adminLogs}
        adminLogsLoading={adminLogsLoading}
        onClearLogs={handleClearLogs}
        adminStats={adminStats}
        drops={drops}
        dropsLoading={dropsLoading}
        dropUploadFile={dropUploadFile}
        dropUploadTitle={dropUploadTitle}
        dropUploadDescription={dropUploadDescription}
        dropUploadType={dropUploadType}
        dropUploadBusy={dropUploadBusy}
        dropUploadMessage={dropUploadMessage}
        dropUploadMessageTone={dropUploadMessageTone}
        onDropFileChange={handleAdminDropFileChange}
        onDropUploadTitleChange={(e) => setDropUploadTitle(e.target.value)}
        onDropUploadDescriptionChange={(e) => setDropUploadDescription(e.target.value)}
        onDropUploadTypeChange={(e) => setDropUploadType(e.target.value)}
        onUploadDrop={handleUploadDrop}
        onDeleteDrop={handleDeleteDrop}
        events={events}
        eventsLoading={eventsLoading}
        eventUploadTitle={eventUploadTitle}
        eventUploadDate={eventUploadDate}
        eventUploadGenre={eventUploadGenre}
        eventUploadBusy={eventUploadBusy}
        eventUploadMessage={eventUploadMessage}
        eventUploadMessageTone={eventUploadMessageTone}
        onEventUploadTitleChange={(e) => setEventUploadTitle(e.target.value)}
        onEventUploadDateChange={(e) => setEventUploadDate(e.target.value)}
        onEventUploadGenreChange={(e) => setEventUploadGenre(e.target.value)}
        onUploadEvent={handleUploadEvent}
        onDeleteEvent={handleDeleteEvent}
      />
      <Footer LurkedLogo={LurkedLogo} DiscordLogo={DiscordLogo} />
      <AuthModal
        authMode={authMode}
        authEmail={authEmail}
        onAuthEmailChange={handleAuthEmailChange}
        authPassword={authPassword}
        onAuthPasswordChange={handleAuthPasswordChange}
        authError={authError}
        authNotice={authNotice}
        authBusy={authBusy}
        onClose={closeAuth}
        onSubmit={handleAuthSubmit}
        onPasswordReset={handleAuthPasswordReset}
      />
    </>
  );
}
