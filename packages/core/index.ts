import server from './src/server.js';

export default server;

// Only start server if this module is run directly
if (import.meta.url === `file://${process.argv[1]}`) {
  const port = process.env['PORT'] || 4000;
  server.listen(port);
  console.log(`Listening to port ${port}`);
}
