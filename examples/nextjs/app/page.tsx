export default async function Home() {
  // Example query - replace with your actual Contentful content types
  // import { udl, gql } from 'universal-data-layer';
  // const entries = await udl.query(gql`{
  //   allContentfulBlogPost {
  //     title
  //     slug
  //   }
  // }`);

  return (
    <main style={{ padding: '2rem', fontFamily: 'system-ui, sans-serif' }}>
      <h1>UDL Next.js Example</h1>

      <section style={{ marginTop: '2rem' }}>
        <h2>Getting Started</h2>
        <ol style={{ lineHeight: 1.8 }}>
          <li>
            Copy <code>.env.example</code> to <code>.env.local</code>
          </li>
          <li>Add your Contentful credentials</li>
          <li>
            Update the query in <code>app/page.tsx</code> to match your content
            types
          </li>
          <li>
            Run <code>npm run dev</code> to start the development server
          </li>
        </ol>
      </section>

      <section style={{ marginTop: '2rem' }}>
        <h2>Example Query</h2>
        <pre
          style={{
            background: '#f5f5f5',
            padding: '1rem',
            borderRadius: '8px',
            overflow: 'auto',
          }}
        >
          {`import { udl, gql } from 'universal-data-layer';

const entries = await udl.query(gql\`{
  allContentfulBlogPost {
    title
    slug
  }
}\`);`}
        </pre>
      </section>
    </main>
  );
}
