import { validateEnv } from './env.validation.js';

const base = {
  DATABASE_URL: 'postgresql://tesla:tesla@localhost:5433/dhaka_tesla_pool',
  JWT_SECRET: 'dev-only-change-me',
};
const strongSecret = 'x'.repeat(48);

describe('validateEnv', () => {
  it('accepts the local development settings', () => {
    expect(() => validateEnv(base)).not.toThrow();
  });

  it('requires a database URL and a JWT secret', () => {
    expect(() => validateEnv({})).toThrow(
      /DATABASE_URL is required[\s\S]*JWT_SECRET is required/,
    );
    expect(() => validateEnv({ ...base, JWT_SECRET: '   ' })).toThrow(
      'JWT_SECRET is required',
    );
  });

  it('rejects a non-numeric port', () => {
    expect(() => validateEnv({ ...base, PORT: 'abc' })).toThrow(
      'PORT must be a number',
    );
  });

  it.each(['dev-only-change-me', 'ci-only-secret'])(
    'refuses the public secret %s in production',
    (secret) => {
      expect(() =>
        validateEnv({ ...base, NODE_ENV: 'production', JWT_SECRET: secret }),
      ).toThrow('JWT_SECRET is a public development value');
    },
  );

  it('refuses a short secret in production', () => {
    expect(() =>
      validateEnv({ ...base, NODE_ENV: 'production', JWT_SECRET: 'short-one' }),
    ).toThrow('at least 32 characters');
  });

  it('accepts a strong secret in production', () => {
    expect(() =>
      validateEnv({
        ...base,
        NODE_ENV: 'production',
        JWT_SECRET: strongSecret,
      }),
    ).not.toThrow();
  });
});
