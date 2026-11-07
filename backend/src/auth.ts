import { CanActivate, ExecutionContext, ForbiddenException, Injectable, UnauthorizedException } from '@nestjs/common';
import { createRemoteJWKSet,jwtVerify } from 'jose';
import { Request } from 'express';
import { Db } from './prisma.service';
import { Actor } from './contracts';
export type AuthRequest = Request & {actor:Actor};
@Injectable() export class AuthGuard implements CanActivate {
 private readonly jwks;
 constructor(private readonly db:Db){
  const u=process.env.OIDC_JWKS_URL;
  if(!u || !process.env.OIDC_ISSUER || !process.env.OIDC_AUDIENCE)throw new Error('OIDC_JWKS_URL, OIDC_ISSUER, OIDC_AUDIENCE required');
  this.jwks=createRemoteJWKSet(new URL(u));
 }
 async canActivate(ctx:ExecutionContext):Promise<boolean>{
  const req=ctx.switchToHttp().getRequest<AuthRequest>();
  const token=/^Bearer (.+)$/i.exec(req.headers.authorization||'')?.[1];
  if(!token)throw new UnauthorizedException('Bearer token required');
  let sub:string;
  try { const {payload}=await jwtVerify(token,this.jwks,{issuer:process.env.OIDC_ISSUER,audience:process.env.OIDC_AUDIENCE,algorithms:['RS256','ES256']});if(!payload.sub)throw Error();sub=payload.sub; }
  catch {throw new UnauthorizedException('Invalid access token');}
  const user=await this.db.identity.platformUser.findUnique({where:{authSubject:sub},select:{id:true,status:true}});
  if(!user||user.status!=='ACTIVE')throw new ForbiddenException('User not provisioned or inactive');
  const admins=(process.env.PLATFORM_ADMIN_SUBJECTS||'').split(',').map(x=>x.trim()).filter(Boolean);
  req.actor={subject:sub,userId:user.id,platformAdmin:admins.includes(sub)};
  return true;
 }
}
