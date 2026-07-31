import {
  BadRequestException,
  HttpStatus,
  NotFoundException,
  ServiceUnavailableException,
  type ArgumentsHost,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Request, Response } from 'express';
import { Prisma } from '../../generated/prisma/client';
import { AllExceptionsFilter } from './all-exceptions.filter';

interface ResponseMock {
  status: jest.Mock;
  json: jest.Mock;
}

interface ContextMock {
  host: ArgumentsHost;
  response: ResponseMock;
  request: { id: string; method: string; originalUrl: string };
}

describe('AllExceptionsFilter', () => {
  let filter: AllExceptionsFilter;
  let configService: { get: jest.Mock };

  const createContext = (): ContextMock => {
    const json = jest.fn();
    const status = jest.fn(() => ({ json })) as unknown as jest.Mock;
    const request = {
      id: 'test-request-id',
      method: 'GET',
      originalUrl: '/api/v1/test',
    };
    const response = { status, json };
    const host = {
      switchToHttp: () => ({
        getRequest: () => request,
        getResponse: () => response,
      }),
    } as unknown as ArgumentsHost;

    return { host, response, request };
  };

  const getJsonPayload = (response: ResponseMock): unknown =>
    (response.json.mock.calls as unknown[][])[0]?.[0];

  beforeEach(() => {
    configService = { get: jest.fn() };
    filter = new AllExceptionsFilter(configService as unknown as ConfigService);
  });

  it('formats a BadRequestException with a default code', () => {
    configService.get.mockReturnValue('test');
    const exception = new BadRequestException('bad input');
    const { host, response } = createContext();

    filter.catch(exception, host);

    expect(response.status).toHaveBeenCalledWith(HttpStatus.BAD_REQUEST);
    expect(getJsonPayload(response)).toEqual({
      success: false,
      data: null,
      error: {
        code: 'BAD_REQUEST',
        message: 'bad input',
        details: null,
      },
    });
  });

  it('formats a validation error (array message) as VALIDATION_ERROR', () => {
    configService.get.mockReturnValue('test');
    const exception = new BadRequestException([
      'email must be an email',
      'password must be at least 8 characters',
    ]);
    const { host, response } = createContext();

    filter.catch(exception, host);

    expect(response.status).toHaveBeenCalledWith(HttpStatus.BAD_REQUEST);
    expect(getJsonPayload(response)).toEqual({
      success: false,
      data: null,
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Validation failed',
        details: [
          'email must be an email',
          'password must be at least 8 characters',
        ],
      },
    });
  });

  it('maps a NotFoundException to a NOT_FOUND code', () => {
    configService.get.mockReturnValue('test');
    const exception = new NotFoundException('Resource missing');
    const { host, response } = createContext();

    filter.catch(exception, host);

    expect(response.status).toHaveBeenCalledWith(HttpStatus.NOT_FOUND);
    expect(getJsonPayload(response)).toMatchObject({
      success: false,
      data: null,
      error: { code: 'NOT_FOUND', message: 'Resource missing' },
    });
  });

  it('honours a custom code provided in the exception body', () => {
    configService.get.mockReturnValue('test');
    const exception = new ServiceUnavailableException({
      code: 'SERVICE_UNAVAILABLE',
      message: 'Database is unreachable',
    });
    const { host, response } = createContext();

    filter.catch(exception, host);

    expect(response.status).toHaveBeenCalledWith(
      HttpStatus.SERVICE_UNAVAILABLE,
    );
    expect(getJsonPayload(response)).toMatchObject({
      error: {
        code: 'SERVICE_UNAVAILABLE',
        message: 'Database is unreachable',
      },
    });
  });

  it('maps a Prisma unique constraint error (P2002) to a 409', () => {
    configService.get.mockReturnValue('test');
    const exception = new Prisma.PrismaClientKnownRequestError(
      'Unique failed',
      {
        code: 'P2002',
        clientVersion: '7.9.1',
        meta: { target: ['email'] },
      },
    );
    const { host, response } = createContext();

    filter.catch(exception, host);

    expect(response.status).toHaveBeenCalledWith(HttpStatus.CONFLICT);
    expect(getJsonPayload(response)).toMatchObject({
      error: { code: 'UNIQUE_CONSTRAINT_VIOLATION' },
    });
  });

  it('maps a Prisma not-found error (P2025) to a 404', () => {
    configService.get.mockReturnValue('test');
    const exception = new Prisma.PrismaClientKnownRequestError('No record', {
      code: 'P2025',
      clientVersion: '7.9.1',
    });
    const { host, response } = createContext();

    filter.catch(exception, host);

    expect(response.status).toHaveBeenCalledWith(HttpStatus.NOT_FOUND);
    expect(getJsonPayload(response)).toMatchObject({
      error: { code: 'RECORD_NOT_FOUND' },
    });
  });

  it('does not leak internal details for unknown errors in production', () => {
    configService.get.mockReturnValue('production');
    const exception = new Error('secret internal detail');
    const { host, response } = createContext();

    filter.catch(exception, host);

    expect(response.status).toHaveBeenCalledWith(
      HttpStatus.INTERNAL_SERVER_ERROR,
    );
    expect(getJsonPayload(response)).toEqual({
      success: false,
      data: null,
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Internal server error',
        details: null,
      },
    });
  });

  it('exposes the error message for unknown errors in development', () => {
    configService.get.mockReturnValue('development');
    const exception = new Error('connection refused');
    const { host, response } = createContext();

    filter.catch(exception, host);

    expect(getJsonPayload(response)).toMatchObject({
      error: { message: 'connection refused' },
    });
  });
});
