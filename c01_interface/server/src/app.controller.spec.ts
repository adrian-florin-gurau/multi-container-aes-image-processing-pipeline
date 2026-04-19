import { Test, TestingModule } from '@nestjs/testing';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { BadRequestException } from '@nestjs/common';

describe('AppController', () => {
  let controller: AppController;
  let service: AppService;

  // 1. Create a Mock for the AppService
  const mockAppService = {
    dispatchToPipeline: jest.fn().mockImplementation((file, body) => {
      return { jobId: 'test-job-uuid', status: 'QUEUED' };
    }),
  };

  // 2. Helper to create a dummy Multer file that satisfies the TS Interface
  const createMockFile = (name = 'test.bmp'): Express.Multer.File => ({
    fieldname: 'image',
    originalname: name,
    encoding: '7bit',
    mimetype: 'image/bmp',
    size: 1024,
    buffer: Buffer.from('fake-pixel-data'),
    stream: null as any,
    destination: '',
    filename: '',
    path: '',
  } as Express.Multer.File);

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AppController],
      providers: [
        {
          provide: AppService,
          useValue: mockAppService,
        },
      ],
    }).compile();

    controller = module.get<AppController>(AppController);
    service = module.get<AppService>(AppService);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('handleAESRequest', () => {
    
    it('should throw BadRequestException if file is missing', async () => {
      const body = { key: '1234567890123456', mode: 'ECB', action: 'ENCRYPT' };
      
      // We pass null as any to bypass TS checks but verify runtime logic
      await expect(controller.handleAESRequest(null as any, body))
        .rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException if key length is not 16, 24, or 32', async () => {
      const mockFile = createMockFile();
      const body = { key: 'short-key', mode: 'CBC', action: 'ENCRYPT' };

      await expect(controller.handleAESRequest(mockFile, body))
        .rejects.toThrow(BadRequestException);
    });

    it('should successfully delegate to AppService when inputs are valid', async () => {
      const mockFile = createMockFile();
      const body = { 
        key: '1234567890123456', // 16 bytes
        mode: 'CBC', 
        action: 'ENCRYPT',
        iv: 'initialvector123'
      };

      const result = await controller.handleAESRequest(mockFile, body);

      // Verify the service was called correctly
      expect(service.dispatchToPipeline).toHaveBeenCalledWith(mockFile, body);
      
      // Verify the controller returns what the service provides
      expect(result).toEqual({ 
        jobId: 'test-job-uuid', 
        status: 'QUEUED' 
      });
    });

    it('should handle different valid AES key sizes (e.g., 32 bytes)', async () => {
      const mockFile = createMockFile();
      const body = { 
        key: '12345678901234567890123456789012', // 32 bytes
        mode: 'CTR', 
        action: 'ENCRYPT' 
      };

      const result = await controller.handleAESRequest(mockFile, body);
      expect(result.status).toBe('QUEUED');
      expect(service.dispatchToPipeline).toHaveBeenCalled();
    });

  });
});