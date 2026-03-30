import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyDHq45UjSSeiv3hP_VqeSs-3XZA-VBcC3c",
  authDomain: "stanybarbershop.firebaseapp.com",
  projectId: "stanybarbershop",
  storageBucket: "stanybarbershop.firebasestorage.app",
  messagingSenderId: "124233276303",
  appId: "1:124233276303:web:9e65f36c818295530649fa",
  measurementId: "G-WD6BZTKVQZ"
};

const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);
const db = getFirestore(app);

export { db, analytics };
