const { generateShortCode } = require('../../src/utils/generateCode');

describe('generateShortCode', () => {
  it('should generate a code with default length of 7', () => {
    const code = generateShortCode();
    expect(code).toHaveLength(7);
  });

  it('should generate a code with custom length', () => {
    const code = generateShortCode(10);
    expect(code).toHaveLength(10);
  });

  it('should generate unique codes', () => {
    const codes = new Set();
    for (let i = 0; i < 100; i++) {
      codes.add(generateShortCode());
    }
    expect(codes.size).toBe(100);
  });

  it('should only contain URL-safe characters', () => {
    const code = generateShortCode();
    expect(code).toMatch(/^[A-Za-z0-9_-]+$/);
  });
});
