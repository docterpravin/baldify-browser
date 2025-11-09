// pages/_app.js

// ✅ Correct import path (global CSS inside /styles)
import '../styles/global.css';

export default function App({ Component, pageProps }) {
  return <Component {...pageProps} />;
}
