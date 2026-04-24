import {
  collection,
  doc,
  getDoc,
  getDocs,
  serverTimestamp,
  setDoc,
} from "firebase/firestore";
import { db } from "./config";
import { isMasterAdminEmail } from "./auth";

const ADMINS_COLLECTION = "admins";
const INSCRITOS_COLLECTION = "inscritos";

export async function ensureAdminProfile(user) {
  if (!user?.uid || !user?.email) {
    throw new Error("Usuário inválido para cadastro de administrador.");
  }

  const adminRef = doc(db, ADMINS_COLLECTION, user.uid);
  const existing = await getDoc(adminRef);

  if (!existing.exists()) {
    await setDoc(adminRef, {
      uid: user.uid,
      email: user.email,
      nome: user.displayName || "",
      role: isMasterAdminEmail(user.email) ? "master" : "admin",
      canViewDashboard: true,
      canViewInscritos: true,
      canExportExcel: true,
      canExportPdf: true,
      canExportWord: true,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  }

  return getAdminProfile(user.uid);
}

export async function getAdminProfile(uid) {
  const adminRef = doc(db, ADMINS_COLLECTION, uid);
  const snapshot = await getDoc(adminRef);
  return snapshot.exists() ? snapshot.data() : null;
}

export async function listInscritos() {
  const inscritosRef = collection(db, INSCRITOS_COLLECTION);
  const snapshot = await getDocs(inscritosRef);

  return snapshot.docs.map((item) => ({
    id: item.id,
    ...item.data(),
  }));
}
