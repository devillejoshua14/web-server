const { hashPassword, comparePassword } = require('./hash');
const { signToken } = require('./jwt');
const { isValidEmail, validatePassword, sanitize } = require('./validate');
const { sendDbError } = require('../db/errors');

/**
 * Register auth routes on a server instance.
 *
 * Supports two modes:
 *   - In-memory: pass options.userStore (Map) — used for testing / Phase 4
 *   - Database:  pass options.userRepo — used with PostgreSQL in Phase 5+
 *
 * @param {object} server - Server instance with .post() method
 * @param {object} [options]
 * @param {Map} [options.userStore] - In-memory user storage (fallback)
 * @param {object} [options.userRepo] - DB user repository { createUser, findByEmail }
 * @param {string} [options.secret] - JWT secret
 */
function registerAuthRoutes(server, options = {}) {
  const userStore = options.userStore || (options.userRepo ? null : new Map());
  const userRepo = options.userRepo || null;
  const jwtOptions = options.secret ? { secret: options.secret } : {};

  /**
   * POST /auth/register
   * Body: { email, password, name? }
   */
  server.post('/auth/register', (req, res) => {
    const body = req.parsedBody;

    if (!body || typeof body !== 'object') {
      return res.status(400).json({ error: 'Request body is required' });
    }

    const email = sanitize(body.email || '');
    const password = body.password || '';
    const name = sanitize(body.name || '');

    if (!isValidEmail(email)) {
      return res.status(400).json({ error: 'Invalid email address' });
    }

    const pwResult = validatePassword(password);
    if (!pwResult.valid) {
      return res.status(400).json({ error: pwResult.reason });
    }

    hashPassword(password).then(async (hashedPassword) => {
      if (userRepo) {
        // Database mode
        try {
          const user = await userRepo.createUser({ email, name, password: hashedPassword });
          res.status(201).json({
            message: 'User registered successfully',
            user: { id: user.id, email: user.email, name: user.name },
          });
        } catch (err) {
          sendDbError(res, err);
        }
      } else {
        // In-memory mode
        if (userStore.has(email)) {
          return res.status(409).json({ error: 'Email already registered' });
        }
        const userId = `user_${Date.now()}`;
        const user = { id: userId, email, name, password: hashedPassword };
        userStore.set(email, user);
        res.status(201).json({
          message: 'User registered successfully',
          user: { id: userId, email, name },
        });
      }
    }).catch((err) => {
      res.status(500).json({ error: 'Failed to register user' });
    });
  });

  /**
   * POST /auth/login
   * Body: { email, password }
   */
  server.post('/auth/login', (req, res) => {
    const body = req.parsedBody;

    if (!body || typeof body !== 'object') {
      return res.status(400).json({ error: 'Request body is required' });
    }

    const email = sanitize(body.email || '');
    const password = body.password || '';

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    (async () => {
      let user;
      if (userRepo) {
        user = await userRepo.findByEmail(email);
      } else {
        user = userStore.get(email);
      }

      if (!user) {
        return res.status(401).json({ error: 'Invalid email or password' });
      }

      const match = await comparePassword(password, user.password);
      if (!match) {
        return res.status(401).json({ error: 'Invalid email or password' });
      }

      const token = signToken(
        { userId: user.id, email: user.email },
        jwtOptions
      );

      res.json({
        token,
        user: { id: user.id, email: user.email, name: user.name },
      });
    })().catch((err) => {
      res.status(500).json({ error: 'Login failed' });
    });
  });

  return userStore;
}

module.exports = { registerAuthRoutes };
