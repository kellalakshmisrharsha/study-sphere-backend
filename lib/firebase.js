// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
import { getAuth, GoogleAuthProvider } from "firebase/auth";
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apikey:process.env.firebaseConfig.apikey,
  authDomain:process.env.firebaseConfig.authDomain,
  projectId:process.env.firebaseConfig.projectId,
  storageBucket:process.env.firebaseConfig.storageBucket,
  messagingSenderId:process.env.firebaseConfig.messagingSenderId,
  appId:process.env.firebaseConfig.appId,
  measurementId:process.env.firebaseConfig.measurementId
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);
const auth = getAuth(app);
const provider = new GoogleAuthProvider();


export { auth, provider };