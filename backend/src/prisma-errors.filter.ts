import { ArgumentsHost, Catch, ExceptionFilter, HttpException, HttpStatus } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { Response } from 'express';
@Catch()
export class ApiErrorFilter implements ExceptionFilter {
 catch(error: unknown, host:ArgumentsHost){
  const res=host.switchToHttp().getResponse<Response>();
  let status=HttpStatus.INTERNAL_SERVER_ERROR; let message='Internal server error';
  if(error instanceof HttpException){status=error.getStatus();const response=error.getResponse();message=typeof response==='string'?response:(response as {message?:string|string[]}).message?.toString()||message;}
  else if(error instanceof Prisma.PrismaClientKnownRequestError){
   if(error.code==='P2002'){status=409;message='A record with the same unique value already exists';}
   else if(error.code==='P2003'){status=409;message='Record is referenced by a related resource or violates a foreign key';}
   else if(error.code==='P2025'){status=404;message='Record not found';}
   else if(error.code==='P2014'){status=409;message='Invalid relation change';}
  }
  res.status(status).json({statusCode:status,message});
 }
}
