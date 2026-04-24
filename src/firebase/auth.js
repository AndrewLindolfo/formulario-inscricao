import {
  onAuthStateChanged,
  signInWithPopup,
  signOut,
} from "firebase/auth";
import { auth, googleProvider } from "./config";

export const MASTER_ADMIN_EMAIL = "lindolfoandrew0@gmail.com";

export function signInAdminWithGoogle() {
  return signInWithPopup(auth, googleProvider);
}

export function logoutAdmin() {
  return signOut(auth);
}

export function watchAdminAuth(callback) {
  return onAuthStateChanged(auth, callback);
}

export function isMasterAdminEmail(email = "") {
  return String(email).trim().toLowerCase() === MASTER_ADMIN_EMAIL;
}
