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
import { detectDeviceProfile } from "./utils/deviceProfile";
import { getNextOrderIndex, recalculateOrderIndexes, sortThreadsByPinnedAndOrder } from "./utils/threadOrdering";
import BackgroundGlow from "./components/layout/BackgroundGlow";
import Footer from "./components/layout/Footer";
import NavBar from "./components/layout/NavBar";
import AuthModal from "./components/modals/AuthModal";
import CommunityPage from "./components/sections/CommunityPage";
import EventsPage from "./components/sections/EventsPage";
import ForumsPage from "./components/sections/ForumsPage";
import HomePage from "./components/sections/HomePage";
import LurkedTweaksPage from "./components/sections/LurkedTweaksPage";
import AdminPage from "./components/sections/AdminPage";
import BotDashboardPage from "./components/sections/BotDashboardPage";
import FeedbackPage from "./components/sections/FeedbackPage";
import SettingsPage from "./components/sections/SettingsPage";
import LurkedLogo from "../icons/Lurked-updated.png";
import DiscordLogo from "../icons/discord.png";
import LurkedBotLogo from "../icons/LurkedBot-logo.png";

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
  const [replyDiscordProfiles, setReplyDiscordProfiles] = useState({});
  const [replyingToId, setReplyingToId] = useState(null);
  const [replyingToAuthor, setReplyingToAuthor] = useState(null);

  // Discord profile cache to reduce Firestore reads
  const discordProfileCache = useRef({});
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
  const [movieRequests, setMovieRequests] = useState([]);
  const [movieRequestsLoading, setMovieRequestsLoading] = useState(false);
  const [discordProfile, setDiscordProfile] = useState(null);
  const [discordLinking, setDiscordLinking] = useState(false);
  const [customAvatarUrl, setCustomAvatarUrl] = useState(null);
  const [cachedAvatarUrl] = useState(() => {
    try { return localStorage.getItem("la_avatar_cache") || null; } catch { return null; }
  });
  const profileMenuRef = useRef(null);
  const mobileProfileMenuRef = useRef(null);

  // Bot Dashboard state
  const [botConfig, setBotConfig] = useState(null);
  const [botConfigLoading, setBotConfigLoading] = useState(false);
  const [botConfigChanges, setBotConfigChanges] = useState({});
  const [botConfigSaving, setBotConfigSaving] = useState(false);
  const [botConfigMessage, setBotConfigMessage] = useState("");
  const [botConfigMessageTone, setBotConfigMessageTone] = useState("success");
  const [botStats, setBotStats] = useState({});
  const [botStatsLoading, setBotStatsLoading] = useState(false);
  const [deviceProfile, setDeviceProfile] = useState(() => detectDeviceProfile());
  const isVerified = Boolean(currentUser?.emailVerified);
  const isAdmin = Boolean(
    currentUser?.email &&
      adminEmails.includes(currentUser.email.toLowerCase())
  );

  // Check if current page requires Discord linking
  const requiresDiscord = (page) => {
    return ["forums", "drops", "community"].includes(page) && !discordProfile;
  };

  useEffect(() => {
    const root = document.documentElement;
    const applyProfile = () => {
      const nextProfile = detectDeviceProfile();
      setDeviceProfile(nextProfile);
      root.dataset.deviceClass = nextProfile.isMobile ? "mobile" : "desktop";
      root.dataset.motionProfile = nextProfile.motionProfile;
      root.dataset.performanceTier = nextProfile.performanceTier;
    };

    applyProfile();

    window.addEventListener("resize", applyProfile);
    window.addEventListener("orientationchange", applyProfile);

    const reducedMotionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    const handleMotionChange = () => applyProfile();
    reducedMotionQuery.addEventListener?.("change", handleMotionChange);

    const connection = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
    connection?.addEventListener?.("change", applyProfile);

    return () => {
      window.removeEventListener("resize", applyProfile);
      window.removeEventListener("orientationchange", applyProfile);
      reducedMotionQuery.removeEventListener?.("change", handleMotionChange);
      connection?.removeEventListener?.("change", applyProfile);
    };
  }, []);

  useEffect(() => {
    const allPages = [...navItems, "admin", "botdash", "settings"];
    const getHash = () => {
      const next = window.location.hash.replace("#", "");
      return allPages.includes(next) ? next : "home";
    };
    setActivePage(getHash());

    const onHashChange = () => {
      setActivePage(getHash());
    };

    window.addEventListener("hashchange", onHashChange);
    return () => window.removeEventListener("hashchange", onHashChange);
  }, []);

  // Scroll to top whenever the active page changes
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [activePage]);

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

  // Fetch Lurked Tweaks file info
  const fileServerUrl = import.meta.env.VITE_FILE_SERVER_URL;

  const fetchLurkedTweaksInfo = async () => {
    try {
      const res = await fetch(`${fileServerUrl}/api/tweaks/info`);
      const data = await res.json();
      if (data.success && data.available) {
        setLurkedTweaksInfo(data);
        setLurkedTweaksUrl(`${fileServerUrl}/api/tweaks/download`);
      } else {
        setLurkedTweaksInfo(null);
        setLurkedTweaksUrl("");
      }
    } catch (error) {
      console.error("Failed to fetch Lurked Tweaks info:", error);
    }
  };

  useEffect(() => {
    fetchLurkedTweaksInfo();
  }, []);

  // Fetch Discord whitelist

  // Fetch Discord profile when user logs in
  useEffect(() => {
    if (!currentUser) {
      setDiscordProfile(null);
      try { localStorage.removeItem("la_avatar_cache"); } catch {}
      return;
    }

    const fetchDiscordProfile = async () => {
      try {
        const token = await currentUser.getIdToken();
        const response = await fetch(
          `${import.meta.env.VITE_FILE_SERVER_URL}/api/oauth/discord/profile`,
          {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          }
        );

        if (response.ok) {
          const data = await response.json();
          setDiscordProfile(data.profile);
          if (data.profile?.avatarUrl) {
            try { localStorage.setItem("la_avatar_cache", data.profile.avatarUrl); } catch {}
          }
        }
      } catch (error) {
        console.error("Failed to fetch Discord profile:", error);
      }
    };

    fetchDiscordProfile();
  }, [currentUser]);

  // Load custom avatar from Firestore when user logs in/out
  useEffect(() => {
    if (!currentUser) {
      setCustomAvatarUrl(null);
      return;
    }
    const fetchCustomAvatar = async () => {
      try {
        const userDoc = await getDoc(doc(db, "users", currentUser.uid));
        if (userDoc.exists()) {
          setCustomAvatarUrl(userDoc.data().avatarUrl || null);
        }
      } catch (error) {
        console.error("Failed to fetch custom avatar:", error);
      }
    };
    fetchCustomAvatar();
  }, [currentUser]);

  const handleAvatarSave = async (url) => {
    if (!currentUser) return;
    const trimmed = url.trim();
    try {
      await setDoc(
        doc(db, "users", currentUser.uid),
        { avatarUrl: trimmed || null },
        { merge: true }
      );
      setCustomAvatarUrl(trimmed || null);
    } catch (error) {
      console.error("Failed to save avatar:", error);
    }
  };

  // Handle Discord OAuth callback
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const discordLinked = params.get("discord_linked");
    const reason = params.get("reason");

    if (discordLinked === "success") {
      setProfileMessage("Discord account linked successfully!");

      // Refetch Discord profile
      if (currentUser) {
        currentUser.getIdToken().then((token) => {
          fetch(
            `${import.meta.env.VITE_FILE_SERVER_URL}/api/oauth/discord/profile`,
            {
              headers: {
                Authorization: `Bearer ${token}`,
              },
            }
          )
            .then((res) => res.json())
            .then((data) => setDiscordProfile(data.profile))
            .catch(console.error);
        });
      }

      // Clean up URL
      window.history.replaceState(
        {},
        document.title,
        window.location.pathname + window.location.hash
      );

      // Clear message after 5 seconds
      setTimeout(() => setProfileMessage(""), 5000);
    } else if (discordLinked === "error") {
      let errorMessage = "Failed to link Discord account";

      if (reason === "not_in_server") {
        errorMessage = "You must be a member of LurkedAccounts Discord server to link your account. Please join the server first, then try again.";
      } else if (reason === "user_denied") {
        errorMessage = "Discord authorization was denied";
      } else if (reason === "invalid_state") {
        errorMessage = "Invalid or expired session. Please try again.";
      }

      setProfileMessage(errorMessage);

      // Clean up URL
      window.history.replaceState(
        {},
        document.title,
        window.location.pathname + window.location.hash
      );

      setTimeout(() => setProfileMessage(""), 5000);
    }
  }, [currentUser]);

  useEffect(() => {
    if (activePage !== "admin" || !isAdmin) {
      return;
    }
    setAdminLogsLoading(true);
    const logsQuery = query(
      collection(db, "adminLogs"),
      orderBy("timestamp", "desc"),
      limit(100) // Increased limit for better pagination
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

      socket.on('eventLiveStatusChanged', (updatedEvent) => {
        console.log('🔴 Event live status changed:', updatedEvent);
        if (isActive) {
          setEvents((prevEvents) => {
            return prevEvents.map(event => {
              if (event.id === updatedEvent.id) {
                return {
                  ...event,
                  isLive: updatedEvent.isLive,
                  liveJoinUrl: updatedEvent.liveJoinUrl,
                  liveStartedAt: updatedEvent.liveStartedAt,
                  dateFormatted: updatedEvent.isLive ? 'Live Now' : (updatedEvent.dateFormatted || event.dateFormatted)
                };
              }
              return event;
            });
          });
        }
      });

      socket.on('movieRequestCreated', (newRequest) => {
        if (isActive) {
          setMovieRequests((prevRequests) => {
            if (prevRequests.some((request) => String(request.id) === String(newRequest.id))) {
              return prevRequests;
            }

            return [newRequest, ...prevRequests].sort(
              (a, b) => new Date(b.createdAt || b.created_at || 0) - new Date(a.createdAt || a.created_at || 0)
            );
          });
        }
      });

      socket.on('movieRequestReviewed', (updatedRequest) => {
        if (isActive) {
          setMovieRequests((prevRequests) =>
            prevRequests.map((request) =>
              String(request.id) === String(updatedRequest.id) ? { ...request, ...updatedRequest } : request
            )
          );
        }
      });

      socket.on('movieRequestsCleared', () => {
        if (isActive) {
          setMovieRequests([]);
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
    if (!isAdmin || !currentUser) {
      setMovieRequests([]);
      setMovieRequestsLoading(false);
      return;
    }

    let isActive = true;

    const loadMovieRequests = async () => {
      setMovieRequestsLoading(true);

      try {
        const idToken = await currentUser.getIdToken();
        const response = await fetch(`${fileServerUrl || 'http://localhost:3002'}/api/movie-requests`, {
          headers: {
            Authorization: `Bearer ${idToken}`
          }
        });

        const data = await response.json();

        if (!response.ok || !data.success) {
          throw new Error(data.error || "Failed to fetch movie requests");
        }

        if (isActive) {
          setMovieRequests(data.requests || []);
        }
      } catch (error) {
        console.error("Error loading movie requests:", error);
      } finally {
        if (isActive) {
          setMovieRequestsLoading(false);
        }
      }
    };

    loadMovieRequests();

    return () => {
      isActive = false;
    };
  }, [isAdmin, currentUser, fileServerUrl]);

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
      setReplyDiscordProfiles({});
      setReplyingToId(null);
      setReplyingToAuthor(null);
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
      async (snapshot) => {
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
            replyToId: data.replyToId || null,
            replyToAuthor: data.replyToAuthor || null,
          };
        });
        setReplies(items);
        setRepliesLoading(false);

        // Fetch Discord profiles for unique author IDs (with caching)
        const uniqueAuthorIds = [...new Set(items.map((item) => item.authorId).filter(Boolean))];
        if (uniqueAuthorIds.length > 0) {
          const profiles = {};
          const idsToFetch = [];

          // Check cache first
          uniqueAuthorIds.forEach(authorId => {
            if (discordProfileCache.current[authorId]) {
              // Extract profile without the _cachedAt metadata
              const { _cachedAt, ...profileData } = discordProfileCache.current[authorId];
              profiles[authorId] = profileData;
            } else {
              idsToFetch.push(authorId);
            }
          });

          // Fetch uncached profiles
          if (idsToFetch.length > 0) {
            console.log(`Fetching Discord profiles for ${idsToFetch.length} users...`);
            await Promise.all(
              idsToFetch.map(async (authorId) => {
                try {
                  const profileDoc = await getDoc(doc(db, "users", authorId, "discord", "profile"));
                  if (profileDoc.exists()) {
                    const profileData = profileDoc.data();
                    profiles[authorId] = profileData;
                    // Cache the profile for 5 minutes
                    discordProfileCache.current[authorId] = {
                      ...profileData,
                      _cachedAt: Date.now(),
                    };
                    console.log(`✓ Loaded Discord profile for user ${authorId}:`, profileData.username);
                  } else {
                    console.warn(`✗ No Discord profile found for user ${authorId} (user may not have linked Discord)`);
                  }
                } catch (error) {
                  // Silently fail - profile won't be shown if fetch fails
                  console.warn(`Failed to fetch Discord profile for ${authorId}:`, error);
                }
              })
            );
          }

          console.log(`Setting ${Object.keys(profiles).length} Discord profiles to state`, profiles);
          setReplyDiscordProfiles(profiles);
        } else {
          setReplyDiscordProfiles({});
        }

        // Clean up old cache entries (older than 5 minutes)
        const fiveMinutesAgo = Date.now() - 5 * 60 * 1000;
        Object.keys(discordProfileCache.current).forEach(key => {
          if (discordProfileCache.current[key]._cachedAt < fiveMinutesAgo) {
            delete discordProfileCache.current[key];
          }
        });
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
      const replyData = {
        body: trimmedReply,
        createdAt: serverTimestamp(),
        authorId: currentUser.uid,
        authorName,
      };

      // Add reply-to data if replying to another message
      if (replyingToId && replyingToAuthor) {
        replyData.replyToId = replyingToId;
        replyData.replyToAuthor = replyingToAuthor;
      }

      await addDoc(collection(db, "threads", activeThreadId, "replies"), replyData);
      await updateDoc(doc(db, "threads", activeThreadId), {
        replyCount: increment(1),
        updatedAt: serverTimestamp(),
      });
      setReplyDraft("");
      setReplyingToId(null);
      setReplyingToAuthor(null);
      setReplyMessage("Reply posted.");
    } catch (error) {
      setReplyMessageTone("error");
      setReplyMessage("Unable to post reply right now.");
    } finally {
      setReplyBusy(false);
    }
  };

  const handleReplyToMessage = (replyId, authorName) => {
    setReplyingToId(replyId);
    setReplyingToAuthor(authorName);
    // Focus the reply textarea if possible
    setTimeout(() => {
      const textarea = document.querySelector('textarea[placeholder="Share your thoughts..."]');
      if (textarea) {
        textarea.focus();
        textarea.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }, 100);
  };

  const handleCancelReplyTo = () => {
    setReplyingToId(null);
    setReplyingToAuthor(null);
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
      if (!profileMenuRef.current && !mobileProfileMenuRef.current) {
        return;
      }
      if (
        profileMenuRef.current?.contains(event.target) ||
        mobileProfileMenuRef.current?.contains(event.target)
      ) {
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

  const handleDiscordLink = async () => {
    if (!currentUser || discordLinking) {
      return;
    }

    setDiscordLinking(true);
    setProfileMessage("");

    try {
      const token = await currentUser.getIdToken();
      const response = await fetch(
        `${import.meta.env.VITE_FILE_SERVER_URL}/api/oauth/discord/authorize`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      if (response.ok) {
        const data = await response.json();
        // Redirect to Discord OAuth page
        window.location.href = data.authorizationUrl;
      } else {
        const error = await response.json();
        setProfileMessage(`Error: ${error.error || "Failed to link Discord"}`);
      }
    } catch (error) {
      console.error("Failed to initiate Discord linking:", error);
      setProfileMessage("Failed to connect to Discord. Please try again.");
    } finally {
      setDiscordLinking(false);
    }
  };

  const handleDiscordUnlink = async () => {
    if (!currentUser || profileBusy) {
      return;
    }

    const confirmed = window.confirm(
      "Are you sure you want to unlink your Discord account?\n\n" +
        "This will remove your Discord profile from your account and you will lose access to Discord-only features."
    );

    if (!confirmed) {
      return;
    }

    setProfileBusy(true);
    setProfileMessage("");

    try {
      const token = await currentUser.getIdToken();
      const response = await fetch(
        `${import.meta.env.VITE_FILE_SERVER_URL}/api/oauth/discord/unlink`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      if (response.ok) {
        setDiscordProfile(null);
        setProfileMessage("Discord account unlinked successfully");
        setTimeout(() => setProfileMessage(""), 3000);
      } else {
        const error = await response.json();
        setProfileMessage(`Error: ${error.error || "Failed to unlink Discord"}`);
      }
    } catch (error) {
      console.error("Failed to unlink Discord:", error);
      setProfileMessage("Failed to unlink Discord. Please try again.");
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

  const handleProfileClose = () => {
    setProfileOpen(false);
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

  // Lurked Tweaks state
  const [lurkedTweaksUrl, setLurkedTweaksUrl] = useState("");
  const [lurkedTweaksInfo, setLurkedTweaksInfo] = useState(null);
  const [lurkedTweaksFile, setLurkedTweaksFile] = useState(null);
  const [lurkedTweaksBusy, setLurkedTweaksBusy] = useState(false);
  const [lurkedTweaksMessage, setLurkedTweaksMessage] = useState("");
  const [lurkedTweaksMessageTone, setLurkedTweaksMessageTone] = useState("success");


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

  const handleToggleEventLive = async (eventId, eventTitle, setLive) => {
    if (!isAdmin || eventUploadBusy) return;

    if (setLive) {
      // Going live - prompt for URL
      const joinUrl = window.prompt(
        `Set "${eventTitle}" as LIVE\n\nEnter Discord invite link or custom URL:`,
        "https://discord.gg/"
      );

      if (!joinUrl) return; // User cancelled

      // Validate URL
      if (!joinUrl.startsWith('https://') && !joinUrl.includes('discord.gg/')) {
        setEventUploadMessageTone("error");
        setEventUploadMessage("Invalid URL. Must be HTTPS or Discord invite.");
        return;
      }

      await setEventLiveStatus(eventId, eventTitle, true, joinUrl);
    } else {
      // Going not live - confirm
      const confirmed = window.confirm(`Set "${eventTitle}" as no longer live?`);
      if (!confirmed) return;

      await setEventLiveStatus(eventId, eventTitle, false, null);
    }
  };

  const handleReviewMovieRequest = async (request, decision) => {
    if (!isAdmin || eventUploadBusy || !currentUser) {
      return;
    }

    let payload = { decision };

    if (decision === "accepted") {
      const eventTitle = window.prompt(
        `Event title for "${request.title}"`,
        request.title
      );

      if (!eventTitle) {
        return;
      }

      const eventDate = window.prompt(
        `Date/time for "${eventTitle}" in your local timezone.\nUse format: YYYY-MM-DDTHH:mm`,
        ""
      );

      if (!eventDate) {
        return;
      }

      const parsedEventDate = new Date(eventDate);
      if (Number.isNaN(parsedEventDate.getTime())) {
        setEventUploadMessageTone("error");
        setEventUploadMessage("Invalid date format. Use YYYY-MM-DDTHH:mm.");
        return;
      }

      const genre = window.prompt(
        `Genre for "${eventTitle}"`,
        request.genre || request.matchedMovie?.genres?.join(", ") || ""
      );

      const adminNote = window.prompt(
        `Optional note to DM to ${request.requesterTag || request.requesterName || "the requester"}`,
        ""
      );

      payload = {
        decision,
        eventTitle: eventTitle.trim(),
        eventDate: parsedEventDate.toISOString(),
        genre: genre?.trim() || null,
        adminNote: adminNote?.trim() || null,
      };
    } else {
      const adminNote = window.prompt(
        `Reason for denying "${request.title}"`,
        ""
      );

      payload = {
        decision,
        adminNote: adminNote?.trim() || null,
      };
    }

    setEventUploadBusy(true);
    setEventUploadMessage("");

    try {
      const idToken = await currentUser.getIdToken();
      const response = await fetch(`${fileServerUrl || 'http://localhost:3002'}/api/movie-requests/${request.id}/review`, {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${idToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error || "Failed to review movie request");
      }

      setMovieRequests((prevRequests) =>
        prevRequests.map((item) =>
          String(item.id) === String(request.id) ? { ...item, ...data.request } : item
        )
      );

      setEventUploadMessageTone("success");
      setEventUploadMessage(
        decision === "accepted"
          ? `Accepted "${request.title}" and pushed it to Events.`
          : `Denied "${request.title}".`
      );

      await logAdminAction(
        decision === "accepted" ? "Accepted movie request" : "Denied movie request",
        request.title
      );
    } catch (error) {
      console.error("Error reviewing movie request:", error);
      setEventUploadMessageTone("error");
      setEventUploadMessage(error.message || "Failed to review movie request.");
    } finally {
      setEventUploadBusy(false);
    }
  };

  const handleClearMovieRequests = async () => {
    if (!isAdmin || eventUploadBusy || !currentUser) return;
    if (!window.confirm("Clear all movie requests? Open requests will be auto-denied. This cannot be undone.")) return;

    setEventUploadBusy(true);
    setEventUploadMessage("");

    try {
      const idToken = await currentUser.getIdToken();
      const response = await fetch(`${fileServerUrl || "http://localhost:3002"}/api/movie-requests`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${idToken}` },
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error || "Failed to clear movie requests");
      }

      setMovieRequests([]);
      setEventUploadMessageTone("success");
      setEventUploadMessage(
        data.autoDeniedCount > 0
          ? `Cleared all requests. ${data.autoDeniedCount} open request(s) were auto-denied.`
          : "Cleared all movie requests."
      );
    } catch (error) {
      console.error("Error clearing movie requests:", error);
      setEventUploadMessageTone("error");
      setEventUploadMessage(error.message || "Failed to clear movie requests.");
    } finally {
      setEventUploadBusy(false);
    }
  };

  const setEventLiveStatus = async (eventId, eventTitle, isLive, joinUrl) => {
    setEventUploadBusy(true);
    setEventUploadMessage("");

    try {
      const idToken = await currentUser.getIdToken();
      const fileServerUrl = import.meta.env.VITE_FILE_SERVER_URL || 'http://localhost:3002';

      const response = await fetch(`${fileServerUrl}/api/events/${eventId}/live`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${idToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ isLive, liveJoinUrl: joinUrl })
      });

      const data = await response.json();

      if (data.success) {
        setEventUploadMessageTone("success");
        setEventUploadMessage(isLive ? `"${eventTitle}" is now LIVE!` : `"${eventTitle}" is no longer live.`);

        await logAdminAction(
          isLive ? "Set event live" : "Set event not live",
          eventTitle
        );
      } else {
        throw new Error(data.error || 'Failed to update live status');
      }
    } catch (error) {
      console.error('Error updating event live status:', error);
      setEventUploadMessageTone("error");
      setEventUploadMessage(error.message || "Failed to update live status.");
    } finally {
      setEventUploadBusy(false);
    }
  };

  // Lurked Tweaks Handlers
  const handleLurkedTweaksFileChange = (event) => {
    const file = event.target.files?.[0];
    if (file) {
      if (!file.name.toLowerCase().endsWith('.zip')) {
        setLurkedTweaksMessageTone("error");
        setLurkedTweaksMessage("Only .zip files are allowed.");
        setLurkedTweaksFile(null);
        return;
      }
      setLurkedTweaksMessage("");
      setLurkedTweaksFile(file);
    }
  };

  const handleUploadLurkedTweaks = async (e) => {
    e.preventDefault();
    if (!isAdmin || lurkedTweaksBusy || !lurkedTweaksFile) return;

    setLurkedTweaksBusy(true);
    setLurkedTweaksMessage("");
    try {
      const idToken = await currentUser.getIdToken();
      const formData = new FormData();
      formData.append("file", lurkedTweaksFile);

      const res = await fetch(`${fileServerUrl}/api/tweaks/upload`, {
        method: "POST",
        headers: { Authorization: `Bearer ${idToken}` },
        body: formData,
      });

      const data = await res.json();
      if (data.success) {
        setLurkedTweaksMessageTone("success");
        setLurkedTweaksMessage(`Uploaded ${data.filename} (${(data.size / 1024 / 1024).toFixed(2)} MB)`);
        setLurkedTweaksFile(null);
        // Reset the file input
        const fileInput = document.getElementById("tweaks-file-input");
        if (fileInput) fileInput.value = "";
        // Refresh info
        await fetchLurkedTweaksInfo();
        await logAdminAction("Uploaded Lurked Tweaks", data.filename);
      } else {
        throw new Error(data.error || "Upload failed");
      }
    } catch (error) {
      console.error("Failed to upload Lurked Tweaks:", error);
      setLurkedTweaksMessageTone("error");
      setLurkedTweaksMessage(error.message || "Failed to upload file.");
    } finally {
      setLurkedTweaksBusy(false);
    }
  };

  // Bot Dashboard Handlers

  // Fetch bot configuration
  const fetchBotConfig = async () => {
    if (!currentUser || !isAdmin) return;

    setBotConfigLoading(true);
    try {
      const token = await currentUser.getIdToken();
      const res = await fetch(`${import.meta.env.VITE_FILE_SERVER_URL}/api/bot/config`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const json = await res.json();

      if (json.success) {
        setBotConfig(json.config);
      } else {
        console.error("Failed to fetch bot config:", json.error);
      }
    } catch (error) {
      console.error("Error fetching bot config:", error);
    } finally {
      setBotConfigLoading(false);
    }
  };

  // Fetch bot statistics
  const fetchBotStats = async () => {
    if (!currentUser || !isAdmin) return;

    setBotStatsLoading(true);
    try {
      const token = await currentUser.getIdToken();
      const res = await fetch(`${import.meta.env.VITE_FILE_SERVER_URL}/api/bot/stats/overview`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const json = await res.json();

      if (json.success) {
        setBotStats(json.stats);
      } else {
        console.error("Failed to fetch bot stats:", json.error);
      }
    } catch (error) {
      console.error("Error fetching bot stats:", error);
    } finally {
      setBotStatsLoading(false);
    }
  };

  // Handle config change (staging)
  const handleBotConfigChange = (key, value) => {
    setBotConfigChanges((prev) => ({ ...prev, [key]: value }));
  };

  // Save config changes
  const handleSaveBotConfig = async () => {
    setBotConfigSaving(true);
    setBotConfigMessage("");

    try {
      const token = await currentUser.getIdToken();

      // Update general config section with all changes
      const res = await fetch(`${import.meta.env.VITE_FILE_SERVER_URL}/api/bot/config/general`, {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ data: { ...botConfig, ...botConfigChanges } }),
      });

      const json = await res.json();

      if (json.success) {
        setBotConfig((prev) => ({ ...prev, ...botConfigChanges }));
        setBotConfigChanges({});
        setBotConfigMessage("Configuration saved successfully");
        setBotConfigMessageTone("success");

        // Log admin action
        await logAdminAction(
          "Updated bot configuration",
          `${Object.keys(botConfigChanges).length} settings modified`
        );
      } else {
        setBotConfigMessage(json.error || "Failed to save configuration");
        setBotConfigMessageTone("error");
      }
    } catch (error) {
      console.error("Error saving bot config:", error);
      setBotConfigMessage("Failed to save configuration");
      setBotConfigMessageTone("error");
    } finally {
      setBotConfigSaving(false);
    }
  };

  // Cancel config changes
  const handleCancelBotConfig = () => {
    setBotConfigChanges({});
    setBotConfigMessage("Changes discarded");
    setBotConfigMessageTone("success");
    setTimeout(() => setBotConfigMessage(""), 2000);
  };

  // Reload config from disk
  const handleReloadConfig = async () => {
    if (!currentUser || !isAdmin) return;

    setBotConfigSaving(true);
    setBotConfigMessage("");

    try {
      const token = await currentUser.getIdToken();
      const res = await fetch(`${import.meta.env.VITE_FILE_SERVER_URL}/api/bot/reload-config`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });

      const json = await res.json();

      if (json.success) {
        setBotConfig(json.config);
        setBotConfigChanges({});
        setBotConfigMessage("Configuration reloaded from disk");
        setBotConfigMessageTone("success");

        await logAdminAction("Reloaded bot configuration", "Config refreshed from disk");
      } else {
        setBotConfigMessage(json.error || "Failed to reload configuration");
        setBotConfigMessageTone("error");
      }
    } catch (error) {
      console.error("Error reloading config:", error);
      setBotConfigMessage("Failed to reload configuration");
      setBotConfigMessageTone("error");
    } finally {
      setBotConfigSaving(false);
    }
  };

  // Fetch bot config and stats when on botdash page
  useEffect(() => {
    if (activePage === "botdash" && isAdmin && currentUser) {
      fetchBotConfig();
      fetchBotStats();

      // Refresh stats every 30 seconds
      const statsInterval = setInterval(fetchBotStats, 30000);

      return () => clearInterval(statsInterval);
    }
  }, [activePage, isAdmin, currentUser]);

  return (
    <>
      <BackgroundGlow profile={deviceProfile} />
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
        mobileProfileMenuRef={mobileProfileMenuRef}
        profileBusy={profileBusy}
        onProfileToggle={handleProfileToggle}
        onProfileClose={handleProfileClose}
        onSignOut={handleSignOut}
        discordProfile={discordProfile ?? (cachedAvatarUrl ? { avatarUrl: cachedAvatarUrl } : null)}
        onAuthOpen={openAuth}
        authButtonClass={authButtonClass}
        authPrimaryButtonClass={authPrimaryButtonClass}
        isAdmin={isAdmin}
        customAvatarUrl={customAvatarUrl}
        onAvatarSave={handleAvatarSave}
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
        discordProfile={discordProfile}
        onDiscordLink={handleDiscordLink}
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
        discordProfile={discordProfile}
        onDiscordLink={handleDiscordLink}
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
        replyDiscordProfiles={replyDiscordProfiles}
        replyingToId={replyingToId}
        replyingToAuthor={replyingToAuthor}
        onReplyToMessage={handleReplyToMessage}
        onCancelReplyTo={handleCancelReplyTo}
        onThreadSubmit={handleThreadSubmit}
        onThreadToggle={handleThreadToggle}
        onThreadPinToggle={handleThreadPinToggle}
        onThreadDelete={handleThreadDelete}
        onReplySubmit={handleReplySubmit}
        onReplyDelete={handleReplyDelete}
        onAuthOpen={openAuth}
        onThreadReorder={handleThreadReorder}
      />
      <LurkedTweaksPage activePage={activePage} lurkedTweaksUrl={lurkedTweaksUrl} />
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
        movieRequests={movieRequests}
        movieRequestsLoading={movieRequestsLoading}
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
        onToggleEventLive={handleToggleEventLive}
        onReviewMovieRequest={handleReviewMovieRequest}
        onClearMovieRequests={handleClearMovieRequests}
        lurkedTweaksInfo={lurkedTweaksInfo}
        lurkedTweaksFile={lurkedTweaksFile}
        lurkedTweaksBusy={lurkedTweaksBusy}
        lurkedTweaksMessage={lurkedTweaksMessage}
        lurkedTweaksMessageTone={lurkedTweaksMessageTone}
        onLurkedTweaksFileChange={handleLurkedTweaksFileChange}
        onUploadLurkedTweaks={handleUploadLurkedTweaks}
      />
      <BotDashboardPage
        activePage={activePage}
        isAdmin={isAdmin}
        currentUser={currentUser}
        botStats={botStats}
        botStatsLoading={botStatsLoading}
        onReloadConfig={handleReloadConfig}
        botConfig={botConfig}
        botConfigLoading={botConfigLoading}
        botConfigChanges={botConfigChanges}
        onBotConfigChange={handleBotConfigChange}
        onSaveBotConfig={handleSaveBotConfig}
        onCancelBotConfig={handleCancelBotConfig}
        botConfigSaving={botConfigSaving}
        botConfigMessage={botConfigMessage}
        botConfigMessageTone={botConfigMessageTone}
        LurkedBotLogo={LurkedBotLogo}
      />
      <FeedbackPage activePage={activePage} />
      <SettingsPage
        activePage={activePage}
        currentUser={currentUser}
        welcomeName={welcomeName}
        usernameInput={usernameInput}
        onUsernameInputChange={handleUsernameInputChange}
        onUsernameSave={handleUsernameSave}
        profileBusy={profileBusy}
        profileMessage={profileMessage}
        onVerifyEmail={handleVerifyEmail}
        onPasswordReset={handlePasswordReset}
        discordProfile={discordProfile}
        discordLinking={discordLinking}
        onDiscordLink={handleDiscordLink}
        onDiscordUnlink={handleDiscordUnlink}
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
