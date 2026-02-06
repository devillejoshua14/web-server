const postRepo = require('../db/repositories/post-repository');
const { sendDbError } = require('../db/errors');
const { authGuard } = require('../auth/auth-middleware');
const { sanitize } = require('../auth/validate');

/**
 * Register post CRUD routes on a server instance.
 * All mutating routes require authentication.
 *
 * Routes:
 *   GET    /api/posts          - List all posts (public)
 *   GET    /api/posts/:id      - Get a single post (public)
 *   POST   /api/posts          - Create a post (auth required)
 *   PUT    /api/posts/:id      - Update a post (auth required, owner only)
 *   DELETE /api/posts/:id      - Delete a post (auth required, owner only)
 *
 * @param {object} server - Server instance
 * @param {object} [options]
 * @param {string} [options.secret] - JWT secret for auth middleware
 */
function registerPostRoutes(server, options = {}) {
  const auth = authGuard(options);

  // GET /api/posts - list all posts
  server.get('/api/posts', (req, res) => {
    const userId = req.query.userId ? parseInt(req.query.userId, 10) : undefined;
    const limit = Math.min(parseInt(req.query.limit, 10) || 50, 100);
    const offset = parseInt(req.query.offset, 10) || 0;

    postRepo.findAll({ userId, limit, offset })
      .then((posts) => res.json({ posts }))
      .catch((err) => sendDbError(res, err));
  });

  // GET /api/posts/:id - get single post
  server.get('/api/posts/:id', (req, res) => {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) {
      return res.status(400).json({ error: 'Invalid post ID' });
    }

    postRepo.findById(id)
      .then((post) => {
        if (!post) return res.status(404).json({ error: 'Post not found' });
        res.json({ post });
      })
      .catch((err) => sendDbError(res, err));
  });

  // POST /api/posts - create post (auth required)
  server.post('/api/posts', [auth], (req, res) => {
    const body = req.parsedBody;
    if (!body || typeof body !== 'object') {
      return res.status(400).json({ error: 'Request body is required' });
    }

    const title = sanitize(body.title || '');
    const content = sanitize(body.content || '');

    if (!title) {
      return res.status(400).json({ error: 'Title is required' });
    }

    postRepo.createPost({ title, content, user_id: req.user.userId })
      .then((post) => res.status(201).json({ post }))
      .catch((err) => sendDbError(res, err));
  });

  // PUT /api/posts/:id - update post (auth required, owner only)
  server.put('/api/posts/:id', [auth], (req, res) => {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) {
      return res.status(400).json({ error: 'Invalid post ID' });
    }

    const body = req.parsedBody;
    if (!body || typeof body !== 'object') {
      return res.status(400).json({ error: 'Request body is required' });
    }

    postRepo.findById(id)
      .then((existing) => {
        if (!existing) return res.status(404).json({ error: 'Post not found' });
        if (existing.user_id !== req.user.userId) {
          return res.status(403).json({ error: 'You can only edit your own posts' });
        }

        const updates = {};
        if (body.title !== undefined) updates.title = sanitize(body.title);
        if (body.content !== undefined) updates.content = sanitize(body.content);

        return postRepo.updatePost(id, updates)
          .then((post) => res.json({ post }));
      })
      .catch((err) => sendDbError(res, err));
  });

  // DELETE /api/posts/:id - delete post (auth required, owner only)
  server.delete('/api/posts/:id', [auth], (req, res) => {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) {
      return res.status(400).json({ error: 'Invalid post ID' });
    }

    postRepo.findById(id)
      .then((existing) => {
        if (!existing) return res.status(404).json({ error: 'Post not found' });
        if (existing.user_id !== req.user.userId) {
          return res.status(403).json({ error: 'You can only delete your own posts' });
        }

        return postRepo.deletePost(id)
          .then(() => res.json({ message: 'Post deleted' }));
      })
      .catch((err) => sendDbError(res, err));
  });
}

module.exports = { registerPostRoutes };
