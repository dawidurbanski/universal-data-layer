export default async function Home() {
  const response = await fetch('http://localhost:4000/graphql', {
    method: 'POST',
    body: '{"query":"{ version }"}',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
    },
  });

  const {
    data: { version },
  } = await response.json();

  return <div>Hello World {version}</div>;
}
