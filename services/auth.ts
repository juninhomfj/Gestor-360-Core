// services/auth.ts
import {
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  createUserWithEmailAndPassword,
  sendPasswordResetEmail,
  updatePassword,
  fetchSignInMethodsForEmail,
  getAuth,
} from "firebase/auth";

import { getApps, initializeApp } from "firebase/app";

import {
  doc,
  getDoc,
  setDoc,
  updateDoc,
  serverTimestamp,
  collection,
  getDocs,
} from "firebase/firestore";

import { dbPut, dbBulkPut, dbGetAll } from "../storage/db";
import { Logger } from "./logger";
import { runFirestoreSeedBootstrap } from "./seedBootstrap";
import { User, UserPermissions } from "../types";
import { firebaseConfig, auth as primaryAuth, db as primaryDb } from "./firebase";

const auth = primaryAuth;
const db = primaryDb;

const DEFAULT_PERMISSIONS: UserPermissions = {
  sales: true,
  finance: true,
  crm: true,

  settings: true,
  dev: false,
  chat: true,
  logs: true,
  users: false,
  profiles: false,

  receivables: true,
  distribution: true,
  imports: true,

  abc_analysis: true,
  ltv_details: true,
  manual_billing: true,
  audit_logs: true,
};

async function getProfileFromFirebase(fbUser: any): Promise<User | null> {
  try {
    const profileRef = doc(db, "profiles", fbUser.uid);
    let profileSnap = await getDoc(profileRef);

    const isRoot =
      fbUser.email === "eliezer.freitas27@gmail.com" ||
      fbUser.email === "admin@admin.com" ||
      fbUser.email === "dev@gestor360.com";

    if (!profileSnap.exists()) {
      const newProfile = {
        uid: fbUser.uid,
        username: fbUser.email?.split("@")[0] || "user",
        name: fbUser.displayName || "Novo Usuário",
        email: fbUser.email!,
        role: isRoot ? "DEV" : "USER",
        isActive: isRoot,
        userStatus: isRoot ? "ACTIVE" : "PENDING",
        modules: isRoot ? { ...DEFAULT_PERMISSIONS, dev: true } : DEFAULT_PERMISSIONS,
        permissions: isRoot ? { ...DEFAULT_PERMISSIONS, dev: true } : DEFAULT_PERMISSIONS,
        hiddenModules: {},
        salesTargets: { basic: 0, natal: 0 },
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        prefs: { defaultModule: "home" },
      };
      await setDoc(profileRef, newProfile);
      profileSnap = await getDoc(profileRef);
    }

    const data = profileSnap.data();
    let needsMigrationUpdate = false;
    const migratedPrefs = { ...(data?.prefs || {}) } as any;

    if (!migratedPrefs.defaultModule) {
      const legacyValue =
        data?.HomeModule ||
        data?.homeTab ||
        data?.moduleDefault ||
        data?.prefs?.HomeModule ||
        null;

      if (legacyValue) {
        migratedPrefs.defaultModule = legacyValue;
        needsMigrationUpdate = true;
        Logger.info(`[Migration] Migrando preferência legada "${legacyValue}" para defaultModule.`);
      } else {
        migratedPrefs.defaultModule = "home";
      }
    }

    const shouldActivate = data?.userStatus === "PENDING" || data?.isActive === false;

    if (
      needsMigrationUpdate ||
      (isRoot && (data?.role === "USER" || data?.isActive === false)) ||
      shouldActivate
    ) {
      await updateDoc(profileRef, {
        role: isRoot ? "DEV" : data?.role,
        isActive: isRoot ? true : shouldActivate ? true : data?.isActive,
        userStatus: isRoot ? "ACTIVE" : shouldActivate ? "ACTIVE" : data?.userStatus,
        prefs: migratedPrefs,
        updatedAt: serverTimestamp(),
      });
    }

    const user: User = {
      id: fbUser.uid,
      uid: fbUser.uid,
      username: data?.username || fbUser.email?.split("@")[0] || "user",
      name: data?.name || fbUser.displayName || "Usuário",
      email: data?.email || fbUser.email || "",
      role: data?.role || "USER",
      isActive: data?.isActive ?? true,
      theme: data?.theme || "glass",
      userStatus: data?.userStatus || "PENDING",
      createdAt: data?.createdAt?.toDate?.()?.toISOString() || new Date().toISOString(),
      updatedAt: data?.updatedAt?.toDate?.()?.toISOString() || new Date().toISOString(),
      permissions: { ...DEFAULT_PERMISSIONS, ...(data?.modules || data?.permissions || {}) },
      hiddenModules: data?.hiddenModules || {},
      salesTargets: data?.salesTargets || { basic: 0, natal: 0 },
      profilePhoto: data?.profilePhoto || "",
      tel: data?.tel || "",
      prefs: migratedPrefs,
    };

    await dbPut("users", user);
    localStorage.setItem("sys_session_v1", JSON.stringify(user));
    return user;
  } catch (e) {
    Logger.error("[Auth] Falha crítica na sincronia ou migração do perfil", e);
    return null;
  }
}

export const getSession = (): User | null => {
  const session = localStorage.getItem("sys_session_v1");
  return session ? (JSON.parse(session) as User) : null;
};

export const updateUser = async (userId: string, data: Partial<User>) => {
  const profileRef = doc(db, "profiles", userId);
  const updateData = { ...data, updatedAt: serverTimestamp() };
  await updateDoc(profileRef, updateData as any);

  const current = getSession();
  if (current?.id === userId) {
    const merged = { ...current, ...data } as User;
    localStorage.setItem("sys_session_v1", JSON.stringify(merged));
  }
};

/**
 * Salva APENAS as metas (salesTargets) do usuário no seu próprio perfil.
 * Update mínimo: somente o campo salesTargets + updatedAt.
 */
export const updateUserSalesTargets = async (userId: string, salesTargets: any) => {
  const profileRef = doc(db, "profiles", userId);
  const updateData = { salesTargets, updatedAt: serverTimestamp() };
  await updateDoc(profileRef, updateData as any);

  const current = getSession();
  if (current?.id === userId) {
    const merged = { ...current, salesTargets } as User;
    localStorage.setItem("sys_session_v1", JSON.stringify(merged));
  }
};

export const login = async (
  email: string,
  pass: string
): Promise<{ user: User | null; error: string | null }> => {
  try {
    const user = await loginWithEmail(email, pass);
    return { user, error: null };
  } catch (e: any) {
    return { user: null, error: e?.message || "Falha no login" };
  }
};

export const loginWithEmail = async (email: string, pass: string): Promise<User> => {
  const cred = await signInWithEmailAndPassword(auth, email.trim(), pass);
  const profile = await getProfileFromFirebase(cred.user);
  if (!profile) throw new Error("Perfil não encontrado no Firestore. Contate o administrador.");
  return profile;
};

export const listUsers = async (): Promise<User[]> => {
  try {
    const q = collection(db, "profiles");
    const snap = await getDocs(q);
    const users = snap.docs.map((d) => ({ ...d.data(), id: d.id } as User));
    if (users.length) {
      await dbBulkPut("users", users);
    }
    return users;
  } catch (e) {
    console.error("[Auth] listUsers error:", e);
    return await dbGetAll("users");
  }
};

export const createUser = async (adminId: string, userData: any): Promise<void> => {
  const { name, email, role, modules_config, hiddenModules, salesTargets } = userData;
  const trimmedEmail = String(email || "").trim().toLowerCase();
  if (!trimmedEmail) throw new Error("Email inválido.");

  const existingMethods = await fetchSignInMethodsForEmail(auth, trimmedEmail);
  if (existingMethods.length > 0) {
    throw new Error("Usuário já existe no Auth. Reenvie o convite ou solicite recuperação de senha.");
  }

  const secondaryAppName = "admin-user-create";
  const app =
    getApps().find((existing) => existing.name === secondaryAppName) ??
    initializeApp(firebaseConfig, secondaryAppName);
  const secondaryAuth = getAuth(app);

  const tempPassword = `${crypto.randomUUID().slice(0, 8)}!${Date.now().toString().slice(-4)}`;
  const cred = await createUserWithEmailAndPassword(secondaryAuth, trimmedEmail, tempPassword);
  const newUid = cred.user.uid;

  const profileRef = doc(db, "profiles", newUid);
  const newProfile = {
    id: newUid,
    uid: newUid,
    username: trimmedEmail.split("@")[0],
    displayName: name,
    name,
    email: trimmedEmail,
    emailLower: trimmedEmail,
    role,
    modules: modules_config,
    permissions: modules_config,
    hiddenModules: hiddenModules || {},
    salesTargets: salesTargets || { basic: 0, natal: 0 },
    isActive: true,
    userStatus: "PENDING",
    theme: "glass",
    themePreference: "glass",
    contactVisibility: "PRIVATE",
    profilePhoto: "",
    tel: "",
    prefs: {
      defaultModule: "home",
      homeModule: "home",
      reducedMotion: false,
      glass: true,
      theme: "dark",
      chat: { allowDM: true, enabled: true },
    },
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    createdBy: adminId,
  };

  await setDoc(profileRef, newProfile);
  await sendPasswordResetEmail(auth, trimmedEmail);
  await secondaryAuth.signOut();
};

export const resendInvitation = async (email: string): Promise<void> => {
  await sendPasswordResetEmail(auth, email);
};

export const deactivateUser = async (userId: string): Promise<void> => {
  await updateUser(userId, { isActive: false, userStatus: "INACTIVE" } as any);
};

export const changePassword = async (userId: string, newPass: string): Promise<void> => {
  if (auth.currentUser && auth.currentUser.uid === userId) {
    await updatePassword(auth.currentUser, newPass);
  } else {
    throw new Error("Usuário não autenticado ou ID divergente.");
  }
};

export const requestPasswordReset = async (email: string): Promise<void> => {
  await sendPasswordResetEmail(auth, email);
};

export const reloadSession = async (): Promise<User | null> => {
  const fbUser = auth.currentUser;
  if (!fbUser) return null;
  return await getProfileFromFirebase(fbUser);
};

export const logout = async () => {
  localStorage.removeItem("sys_session_v1");
  await signOut(auth);
};

export const watchAuthChanges = (cb: (u: User | null) => void) => {
  return onAuthStateChanged(auth, async (fbUser) => {
    if (!fbUser) {
      return cb(null);
    }

    const user = await getProfileFromFirebase(fbUser);

    if (user) {
      runFirestoreSeedBootstrap().catch((error) => {
        Logger.error("Firestore seed bootstrap failed:", error);
      });
    }

    cb(user);
  });
};
