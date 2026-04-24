import { auth, googleProvider, MASTER_EMAIL } from './firebase-config.js';
import { signInWithPopup, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/12.12.1/firebase-auth.js";

export async function loginWithGoogle() {
  const result = await signInWithPopup(auth, googleProvider);
  return result.user;
}

export async function logoutGoogle() {
  await signOut(auth);
}

export function watchAuth(callback) {
  return onAuthStateChanged(auth, callback);
}

export function isMasterEmail(user) {
  return !!user?.email && user.email.toLowerCase() === MASTER_EMAIL.toLowerCase();
}
