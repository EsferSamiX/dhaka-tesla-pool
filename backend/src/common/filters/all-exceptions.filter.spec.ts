import {
  ArgumentsHost,
  BadRequestException,
  ConflictException,
  Logger,
} from '@nestjs/common';
import { AllExceptionsFilter } from './all-exceptions.filter.js';

function mockHost() {
  const json = vi.fn();
  const status = vi.fn(() => ({ json }));
  const host = {
    switchToHttp: () => ({
      getRequest: () => ({ id: 'req-1', method: 'GET', originalUrl: '/api/x' }),
      getResponse: () => ({ status }),
    }),
  } as unknown as ArgumentsHost;
  return { host, status, json };
}

describe('AllExceptionsFilter', () => {
  const filter = new AllExceptionsFilter();

  beforeEach(() => {
    vi.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
  });

  it('keeps the status and message of HTTP errors', () => {
    const { host, status, json } = mockHost();
    filter.catch(new ConflictException('No seats left in this pool'), host);

    expect(status).toHaveBeenCalledWith(409);
    expect(json).toHaveBeenCalledWith({
      statusCode: 409,
      error: 'Conflict',
      message: 'No seats left in this pool',
      requestId: 'req-1',
    });
  });

  it('passes validation messages through as a list', () => {
    const { host, json } = mockHost();
    filter.catch(
      new BadRequestException(['seats must not be greater than 3']),
      host,
    );

    expect(json).toHaveBeenCalledWith(
      expect.objectContaining({
        statusCode: 400,
        message: ['seats must not be greater than 3'],
      }),
    );
  });

  it('hides the details of unexpected errors', () => {
    const { host, status, json } = mockHost();
    filter.catch(new Error('password=hunter2 leaked'), host);

    expect(status).toHaveBeenCalledWith(500);
    expect(json).toHaveBeenCalledWith({
      statusCode: 500,
      error: 'Internal Server Error',
      message: 'Internal server error',
      requestId: 'req-1',
    });
  });
});
