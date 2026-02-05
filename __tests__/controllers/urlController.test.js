const urlService = require('../../src/services/urlService');

// Mock the service
jest.mock('../../src/services/urlService');

// Import controller after mock is set up
const urlController = require('../../src/controllers/urlController');

describe('UrlController', () => {
  let mockReq;
  let mockRes;
  let mockNext;

  beforeEach(() => {
    jest.clearAllMocks();

    mockReq = {
      body: {},
      params: {},
      query: {},
    };

    mockRes = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
      redirect: jest.fn().mockReturnThis(),
    };

    mockNext = jest.fn();
  });

  describe('createShortUrl', () => {
    it('should create short URL and return 201', async () => {
      const mockResult = {
        id: 'mock-id',
        originalUrl: 'https://example.com',
        shortUrl: 'http://localhost:3000/abc1234',
        shortCode: 'abc1234',
        createdAt: new Date(),
        expiresAt: null,
      };

      mockReq.body = { url: 'https://example.com' };
      urlService.createShortUrl.mockResolvedValue(mockResult);

      await urlController.createShortUrl(mockReq, mockRes, mockNext);

      expect(urlService.createShortUrl).toHaveBeenCalledWith(
        'https://example.com',
        undefined,
        undefined
      );
      expect(mockRes.status).toHaveBeenCalledWith(201);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: true,
        data: mockResult,
      });
    });

    it('should pass custom code and expiration to service', async () => {
      const expiresAt = '2026-12-31T23:59:59.000Z';
      mockReq.body = {
        url: 'https://example.com',
        customCode: 'mycode',
        expiresAt,
      };
      urlService.createShortUrl.mockResolvedValue({});

      await urlController.createShortUrl(mockReq, mockRes, mockNext);

      expect(urlService.createShortUrl).toHaveBeenCalledWith(
        'https://example.com',
        'mycode',
        expiresAt
      );
    });

    it('should call next with error on failure', async () => {
      const error = new Error('Service error');
      mockReq.body = { url: 'https://example.com' };
      urlService.createShortUrl.mockRejectedValue(error);

      await urlController.createShortUrl(mockReq, mockRes, mockNext);

      expect(mockNext).toHaveBeenCalledWith(error);
    });
  });

  describe('redirectToUrl', () => {
    it('should redirect with 301 status', async () => {
      mockReq.params = { shortCode: 'abc1234' };
      urlService.getOriginalUrl.mockResolvedValue('https://example.com');

      await urlController.redirectToUrl(mockReq, mockRes, mockNext);

      expect(urlService.getOriginalUrl).toHaveBeenCalledWith('abc1234');
      expect(mockRes.redirect).toHaveBeenCalledWith(301, 'https://example.com');
    });

    it('should call next with error on failure', async () => {
      const error = { status: 404, message: 'URL not found' };
      mockReq.params = { shortCode: 'notfound' };
      urlService.getOriginalUrl.mockRejectedValue(error);

      await urlController.redirectToUrl(mockReq, mockRes, mockNext);

      expect(mockNext).toHaveBeenCalledWith(error);
    });
  });

  describe('getUrlStats', () => {
    it('should return URL statistics', async () => {
      const mockStats = {
        id: 'mock-id',
        originalUrl: 'https://example.com',
        shortUrl: 'http://localhost:3000/abc1234',
        shortCode: 'abc1234',
        clicks: 42,
        createdAt: new Date(),
        expiresAt: null,
      };

      mockReq.params = { shortCode: 'abc1234' };
      urlService.getUrlStats.mockResolvedValue(mockStats);

      await urlController.getUrlStats(mockReq, mockRes, mockNext);

      expect(urlService.getUrlStats).toHaveBeenCalledWith('abc1234');
      expect(mockRes.json).toHaveBeenCalledWith({
        success: true,
        data: mockStats,
      });
    });

    it('should call next with error on failure', async () => {
      const error = { status: 404, message: 'URL not found' };
      mockReq.params = { shortCode: 'notfound' };
      urlService.getUrlStats.mockRejectedValue(error);

      await urlController.getUrlStats(mockReq, mockRes, mockNext);

      expect(mockNext).toHaveBeenCalledWith(error);
    });
  });

  describe('deleteUrl', () => {
    it('should delete URL and return success message', async () => {
      mockReq.params = { shortCode: 'abc1234' };
      urlService.deleteUrl.mockResolvedValue({ message: 'URL deleted successfully' });

      await urlController.deleteUrl(mockReq, mockRes, mockNext);

      expect(urlService.deleteUrl).toHaveBeenCalledWith('abc1234');
      expect(mockRes.json).toHaveBeenCalledWith({
        success: true,
        message: 'URL deleted successfully',
      });
    });

    it('should call next with error on failure', async () => {
      const error = { status: 404, message: 'URL not found' };
      mockReq.params = { shortCode: 'notfound' };
      urlService.deleteUrl.mockRejectedValue(error);

      await urlController.deleteUrl(mockReq, mockRes, mockNext);

      expect(mockNext).toHaveBeenCalledWith(error);
    });
  });

  describe('getAllUrls', () => {
    it('should return paginated URLs with default values', async () => {
      const mockResult = {
        urls: [],
        pagination: { currentPage: 1, totalPages: 0, totalItems: 0 },
      };

      urlService.getAllUrls.mockResolvedValue(mockResult);

      await urlController.getAllUrls(mockReq, mockRes, mockNext);

      expect(urlService.getAllUrls).toHaveBeenCalledWith(1, 10);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: true,
        ...mockResult,
      });
    });

    it('should parse page and limit from query params', async () => {
      mockReq.query = { page: '2', limit: '20' };
      urlService.getAllUrls.mockResolvedValue({ urls: [], pagination: {} });

      await urlController.getAllUrls(mockReq, mockRes, mockNext);

      expect(urlService.getAllUrls).toHaveBeenCalledWith(2, 20);
    });

    it('should call next with error on failure', async () => {
      const error = new Error('Database error');
      urlService.getAllUrls.mockRejectedValue(error);

      await urlController.getAllUrls(mockReq, mockRes, mockNext);

      expect(mockNext).toHaveBeenCalledWith(error);
    });
  });
});
