import '../styles.css';
export default function App({ Component, pageProps }) {
  return <Component {...pageProps} />;
}
// pages/_app.js

// ✅ Correct path (since styles.css is in project root)
import '../styles.css';

export default function App({ Component, pageProps }) {
  return <Component {...pageProps} />;
}
