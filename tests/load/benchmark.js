const autocannon = require('autocannon');
const { Server } = require('../../src/server');
const { bodyParser } = require('../../src/middleware/body-parser');

// Start a minimal server for benchmarking
const server = new Server();
server.use(bodyParser());

server.get('/', (req, res) => {
  res.json({ message: 'ok' });
});

server.get('/users/:id', (req, res) => {
  res.json({ id: req.params.id });
});

server.post('/echo', (req, res) => {
  res.json({ received: req.parsedBody });
});

server.listen(0, '127.0.0.1', () => {
  const addr = server._server.address();
  const url = `http://127.0.0.1:${addr.port}`;

  console.log(`\nLoad test server running on ${url}`);
  console.log('='.repeat(60));

  // Run benchmarks sequentially
  runBenchmark('GET /', url + '/')
    .then((r1) => {
      printResult('GET /', r1);
      return runBenchmark('GET /users/:id', url + '/users/42');
    })
    .then((r2) => {
      printResult('GET /users/:id', r2);
      return runBenchmark('POST /echo (JSON body)', url + '/echo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'test', value: 123 }),
      });
    })
    .then((r3) => {
      printResult('POST /echo (JSON body)', r3);
      console.log('\n' + '='.repeat(60));
      console.log('Load testing complete.');
      server.close(() => process.exit(0));
    })
    .catch((err) => {
      console.error('Benchmark error:', err);
      server.close(() => process.exit(1));
    });
});

function runBenchmark(name, url, opts = {}) {
  return new Promise((resolve, reject) => {
    console.log(`\nBenchmarking: ${name}`);
    console.log('-'.repeat(40));

    const instance = autocannon({
      url,
      connections: 100,
      duration: 5,
      ...opts,
    }, (err, result) => {
      if (err) return reject(err);
      resolve(result);
    });

    autocannon.track(instance, { renderProgressBar: true });
  });
}

function printResult(name, result) {
  console.log(`\n  Results for: ${name}`);
  console.log(`  Requests/sec:  ${result.requests.average}`);
  console.log(`  Latency avg:   ${result.latency.average} ms`);
  console.log(`  Latency p99:   ${result.latency.p99} ms`);
  console.log(`  Throughput:    ${(result.throughput.average / 1024 / 1024).toFixed(2)} MB/s`);
  console.log(`  Total reqs:    ${result.requests.total}`);
  console.log(`  Errors:        ${result.errors}`);
  console.log(`  Timeouts:      ${result.timeouts}`);
}
