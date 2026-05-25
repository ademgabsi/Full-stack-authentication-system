import {
  AllExceptionsFilter,
} from './all-exceptions.filter';
import {
  HttpException,
  HttpStatus,
  InternalServerErrorException,
  BadRequestException,
} from '@nestjs/common';
import { ArgumentsHost } from '@nestjs/common';
import { Response } from 'express';

function createMockContext() {
  const response = {
    status: jest.fn().mockReturnThis(),
    json: jest.fn().mockReturnThis(),
  } as unknown as Response;

  return {
    switchToHttp: () => ({
      getResponse: () => response,
      getRequest: () => ({}),
      getNext: jest.fn(),
    }),
    getType: jest.fn(),
  } as unknown as ArgumentsHost;
}

describe('AllExceptionsFilter', () => {
  let filter: AllExceptionsFilter;

  beforeEach(() => {
    filter = new AllExceptionsFilter();
  });

  it('should format HttpException with string message', () => {
    const ctx = createMockContext();
    const exception = new HttpException('Test error', 400);

    filter.catch(exception, ctx);

    const response = ctx.switchToHttp().getResponse<Response>();
    expect(response.status).toHaveBeenCalledWith(400);
    expect(response.json).toHaveBeenCalledWith({
      statusCode: 400,
      message: 'Test error',
      timestamp: expect.any(String),
    });
  });

  it('should format HttpException with object response messages', () => {
    const ctx = createMockContext();
    const exception = new HttpException(
      { message: 'Validation error' },
      422,
    );

    filter.catch(exception, ctx);

    const response = ctx.switchToHttp().getResponse<Response>();
    expect(response.status).toHaveBeenCalledWith(422);
    expect(response.json).toHaveBeenCalledWith(
      expect.objectContaining({
        statusCode: 422,
        message: 'Validation error',
      }),
    );
  });

  it('should join array messages from validation errors', () => {
    const ctx = createMockContext();
    const exception = new BadRequestException([
      'email is required',
      'password is too short',
    ]);

    filter.catch(exception, ctx);

    const response = ctx.switchToHttp().getResponse<Response>();
    expect(response.json).toHaveBeenCalledWith(
      expect.objectContaining({
        message: 'email is required, password is too short',
      }),
    );
  });

  it('should handle HttpException without message in object response', () => {
    const ctx = createMockContext();
    const exception = new HttpException({}, 418);

    filter.catch(exception, ctx);

    const response = ctx.switchToHttp().getResponse<Response>();
    const callArg = (response.json as jest.Mock).mock.calls[0][0];
    expect(callArg.statusCode).toBe(418);
  });

  it('should return 500 for non-HttpException errors', () => {
    const ctx = createMockContext();
    const error = new Error('Unexpected crash');

    filter.catch(error, ctx);

    const response = ctx.switchToHttp().getResponse<Response>();
    expect(response.status).toHaveBeenCalledWith(500);
    expect(response.json).toHaveBeenCalledWith(
      expect.objectContaining({
        statusCode: 500,
        message: 'Internal server error',
      }),
    );
  });

  it('should include ISO timestamp in response', () => {
    const ctx = createMockContext();
    const exception = new HttpException('Error', 400);

    filter.catch(exception, ctx);

    const response = ctx.switchToHttp().getResponse<Response>();
    const callArg = (response.json as jest.Mock).mock.calls[0][0];
    expect(new Date(callArg.timestamp).toISOString()).toBe(callArg.timestamp);
  });
});
