import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { Prisma, PrismaClient } from '@prisma/client';
@Injectable() export class Db implements OnModuleDestroy {
 readonly runtime:PrismaClient;
 readonly identity:PrismaClient;
 readonly provisioning:PrismaClient;
 constructor(){
  const make=(url:string|undefined,name:string)=>{if(!url)throw new Error(`${name} is required`);return new PrismaClient({datasources:{db:{url}}});};
  this.runtime=make(process.env.DATABASE_URL,'DATABASE_URL');
  this.identity=make(process.env.IDENTITY_DATABASE_URL,'IDENTITY_DATABASE_URL');
  this.provisioning=make(process.env.PROVISIONING_DATABASE_URL,'PROVISIONING_DATABASE_URL');
 }
 async tenantTx<T>(tenantId:string,actorId:string,fn:(tx:Prisma.TransactionClient)=>Promise<T>):Promise<T>{
  return this.runtime.$transaction(async tx=>{
   await tx.$executeRaw`SELECT set_config('app.tenant_id', ${tenantId}, true)`;
   await tx.$executeRaw`SELECT set_config('app.actor_user_id', ${actorId}, true)`;
   return fn(tx);
  },{timeout:12000});
 }
 async onModuleDestroy(){await Promise.all([this.runtime.$disconnect(),this.identity.$disconnect(),this.provisioning.$disconnect()]);}
}
