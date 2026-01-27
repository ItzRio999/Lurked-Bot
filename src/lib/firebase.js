import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyA-7OA62LY1yMzBcpI10ZZ11BebHHd6HQU",
  authDomain: "proxy-dicision.firebaseapp.com",
  projectId: "proxy-dicision",
  storageBucket: "proxy-dicision.firebasestorage.app",
  messagingSenderId: "959984062643",
  appId: "1:959984062643:web:f9839af656222d5ddaa0c6",
  measurementId: "G-8ZDTR7VX4J",
};

const app = initializeApp(firebaseConfig);

const analytics =
  typeof window !== "undefined" ? getAnalytics(app) : undefined;

const auth = getAuth(app);
const db = getFirestore(app);

export { app, analytics, auth, db };
