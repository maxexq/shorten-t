// Mock Redis before any modules are loaded
jest.mock('../src/config/redis', () => ({
  get: jest.fn(),
  set: jest.fn(),
  setEx: jest.fn(),
  incr: jest.fn(),
  keys: jest.fn(),
  connect: jest.fn(),
  on: jest.fn(),
}));
