import { describe, expect, it } from 'vitest';
import {
  emailSchema,
  loginSchema,
  passwordSchema,
  registerSchema,
  resetPasswordSchema,
} from '@/lib/validators/auth';

describe('emailSchema', () => {
  it('accepts a trimmed valid email', () => {
    expect(emailSchema.parse('  ada@example.com  ')).toBe('ada@example.com');
  });

  it('rejects an empty or missing email', () => {
    expect(emailSchema.safeParse('').success).toBe(false);
  });

  it('rejects a malformed email', () => {
    expect(emailSchema.safeParse('not-an-email').success).toBe(false);
  });

  it('rejects an email over the max length', () => {
    const long = `${'a'.repeat(250)}@example.com`;
    expect(long.length).toBeGreaterThan(255);
    expect(emailSchema.safeParse(long).success).toBe(false);
  });
});

describe('passwordSchema', () => {
  it('accepts a valid policy password', () => {
    expect(passwordSchema.parse('correctHorse9')).toBe('correctHorse9');
  });

  it('rejects a password shorter than 8 characters', () => {
    expect(passwordSchema.safeParse('a1bc').success).toBe(false);
  });

  it('rejects a password without a letter', () => {
    expect(passwordSchema.safeParse('123456789').success).toBe(false);
  });

  it('rejects a password without a number', () => {
    expect(passwordSchema.safeParse('abcdefgh').success).toBe(false);
  });

  it('rejects a password over the max length', () => {
    const long = `A1${'a'.repeat(130)}`;
    expect(passwordSchema.safeParse(long).success).toBe(false);
  });
});

describe('loginSchema', () => {
  it('accepts valid credentials', () => {
    const input = loginSchema.parse({
      email: 'ada@example.com',
      password: 'whatever',
    });
    expect(input.email).toBe('ada@example.com');
  });

  it('rejects missing password', () => {
    expect(
      loginSchema.safeParse({ email: 'ada@example.com', password: '' }).success,
    ).toBe(false);
  });
});

describe('registerSchema', () => {
  it('accepts a valid registration with an optional name', () => {
    const input = registerSchema.parse({
      email: 'ada@example.com',
      password: 'correctHorse9',
      confirmPassword: 'correctHorse9',
    });
    expect(input.name).toBeUndefined();
  });

  it('rejects mismatched passwords on the confirmPassword field', () => {
    const result = registerSchema.safeParse({
      email: 'ada@example.com',
      password: 'correctHorse9',
      confirmPassword: 'different9',
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].path).toEqual(['confirmPassword']);
    }
  });

  it('rejects a password that violates the policy', () => {
    const result = registerSchema.safeParse({
      email: 'ada@example.com',
      password: 'short',
      confirmPassword: 'short',
    });
    expect(result.success).toBe(false);
  });
});

describe('resetPasswordSchema', () => {
  it('requires a token and matching passwords', () => {
    expect(
      resetPasswordSchema.safeParse({
        token: '',
        password: 'correctHorse9',
        confirmPassword: 'correctHorse9',
      }).success,
    ).toBe(false);

    expect(
      resetPasswordSchema.safeParse({
        token: 'tok-1',
        password: 'correctHorse9',
        confirmPassword: 'nope123',
      }).success,
    ).toBe(false);
  });
});
