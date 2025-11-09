import dynamic from 'next/dynamic';
import Head from 'next/head';
const Baldifier = dynamic(() => import('../components/Baldifier'), { ssr: false });

export default function Home() {
  return (
    <>
      <Head>
        <title>Baldify — 1-click deploy</title>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </Head>
      <main style={{ padding: 24 }}>
        <h1>Baldify — Convert your photo to a bald look (Client-side)</h1>
        <p>Upload a photo and the app will process it in your browser.</p>
        <Baldifier />
        <footer style={{ marginTop: 40, color: '#666' }}>
          Built with BodyPix + Next.js — Deploy on Vercel with one click.
        </footer>
      </main>
    </>
  );
}
