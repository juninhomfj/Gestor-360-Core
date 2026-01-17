
importScripts('https://www.gstatic.com/firebasejs/9.0.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/9.0.0/firebase-messaging-compat.js');

if (self.location.hostname.includes("firebaseapp.com") || self.location.hostname.includes("web.app")) {
  importScripts('/__/firebase/init.js');
}

if (firebase.apps.length === 0) {
  firebase.initializeApp({
    apiKey: "AIzaSyAoHj36s8WBZlzjC1ekCa0evr4N7Eb8jhY",
    authDomain: "gestor360-app.firebaseapp.com",
    projectId: "gestor360-app",
    storageBucket: "gestor360-app.firebasestorage.app",
    messagingSenderId: "461678740958",
    appId: "1:461678740958:web:ecb53b055eddd70413494f"
  });
}

const messaging = firebase.messaging();

messaging.onBackgroundMessage((payload) => {
  console.log('[firebase-messaging-sw.js] Recebido em background: ', payload);
  
  const notificationTitle = payload.notification.title;
  const notificationOptions = {
    body: payload.notification.body,
    icon: '/favicon.ico'
  };

  self.registration.showNotification(notificationTitle, notificationOptions);
});
