const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { signToken, verifyToken } = require('../../src/auth/jwt');
const { hashPassword, comparePassword } = require('../../src/auth/hash');
const { isValidEmail, validatePassword, sanitize } = require('../../src/auth/validate');

describe('JWT', () => {
  const secret = 'test-secret-key';

  it('signs and verifies a token', () => {
    const token = signToken({ userId: 1, email: 'a@b.com' }, { secret });
    const result = verifyToken(token, { secret });

    assert.equal(result.valid, true);
    assert.equal(result.decoded.userId, 1);
    assert.equal(result.decoded.email, 'a@b.com');
  });

  it('rejects an invalid token', () => {
    const result = verifyToken('invalid.token.here', { secret });
    assert.equal(result.valid, false);
    assert.ok(result.error);
  });

  it('rejects a token signed with a different secret', () => {
    const token = signToken({ userId: 1 }, { secret: 'secret-A' });
    const result = verifyToken(token, { secret: 'secret-B' });
    assert.equal(result.valid, false);
  });

  it('includes expiration in the token', () => {
    const token = signToken({ userId: 1 }, { secret, expiresIn: '2h' });
    const result = verifyToken(token, { secret });

    assert.equal(result.valid, true);
    assert.ok(result.decoded.exp);
    assert.ok(result.decoded.iat);
    // exp should be ~2 hours after iat
    const diff = result.decoded.exp - result.decoded.iat;
    assert.equal(diff, 7200);
  });
});

describe('Password hashing', () => {
  it('hashes a password and verifies it', async () => {
    const hash = await hashPassword('MyPassword123');
    assert.ok(hash);
    assert.notEqual(hash, 'MyPassword123');

    const match = await comparePassword('MyPassword123', hash);
    assert.equal(match, true);
  });

  it('rejects wrong password', async () => {
    const hash = await hashPassword('CorrectPassword1');
    const match = await comparePassword('WrongPassword1', hash);
    assert.equal(match, false);
  });

  it('produces different hashes for the same password', async () => {
    const hash1 = await hashPassword('SamePassword1');
    const hash2 = await hashPassword('SamePassword1');
    assert.notEqual(hash1, hash2); // bcrypt uses random salt
  });
});

describe('Input validation', () => {
  describe('isValidEmail', () => {
    it('accepts valid emails', () => {
      assert.equal(isValidEmail('user@example.com'), true);
      assert.equal(isValidEmail('first.last@domain.co'), true);
      assert.equal(isValidEmail('user+tag@gmail.com'), true);
    });

    it('rejects invalid emails', () => {
      assert.equal(isValidEmail(''), false);
      assert.equal(isValidEmail('notanemail'), false);
      assert.equal(isValidEmail('@no-user.com'), false);
      assert.equal(isValidEmail('no-domain@'), false);
      assert.equal(isValidEmail('spaces in@email.com'), false);
      assert.equal(isValidEmail(null), false);
      assert.equal(isValidEmail(123), false);
    });
  });

  describe('validatePassword', () => {
    it('accepts valid passwords', () => {
      assert.equal(validatePassword('Password1').valid, true);
      assert.equal(validatePassword('abcdefg8').valid, true);
      assert.equal(validatePassword('longPassword123!@#').valid, true);
    });

    it('rejects short passwords', () => {
      const result = validatePassword('Pass1');
      assert.equal(result.valid, false);
      assert.ok(result.reason.includes('8 characters'));
    });

    it('rejects passwords without letters', () => {
      const result = validatePassword('12345678');
      assert.equal(result.valid, false);
      assert.ok(result.reason.includes('letter'));
    });

    it('rejects passwords without digits', () => {
      const result = validatePassword('abcdefgh');
      assert.equal(result.valid, false);
      assert.ok(result.reason.includes('digit'));
    });

    it('rejects non-string passwords', () => {
      assert.equal(validatePassword(null).valid, false);
      assert.equal(validatePassword(12345678).valid, false);
    });
  });

  describe('sanitize', () => {
    it('trims whitespace', () => {
      assert.equal(sanitize('  hello  '), 'hello');
    });

    it('removes control characters', () => {
      assert.equal(sanitize('hello\x00world'), 'helloworld');
      assert.equal(sanitize('test\x07value'), 'testvalue');
    });

    it('returns empty string for non-string input', () => {
      assert.equal(sanitize(null), '');
      assert.equal(sanitize(123), '');
    });

    it('preserves normal text', () => {
      assert.equal(sanitize('Hello, World!'), 'Hello, World!');
    });
  });
});
