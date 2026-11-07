import 'dotenv/config';
import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { Module, Controller, Get } from '@nestjs/common';
import { DocumentBuilder,SwaggerModule } from '@nestjs/swagger';
import { Db } from './prisma.service';
import { ApiErrorFilter } from './prisma-errors.filter';
import { AuthGuard } from './auth';
import { Authorization } from './authorization';
import { CoreService } from './tenant.service';
import { PlatformController,TenantController } from './controllers';
import { CrmController,CrmPublicController } from './crm.controllers';
import { CrmService } from './crm.service';
@Controller() class HealthController { @Get('health/live') live(){return {ok:true};} }
@Module({controllers:[HealthController,PlatformController,TenantController,CrmController,CrmPublicController],providers:[Db,AuthGuard,Authorization,CoreService,CrmService]})
export class AppModule{}
async function main(){
 const app=await NestFactory.create(AppModule,{bufferLogs:true});
 app.useGlobalFilters(new ApiErrorFilter());
 const config=new DocumentBuilder().setTitle('LMS + CRM SaaS Core API').setDescription('Stage 01A; OIDC + tenant-scoped RBAC').setVersion('1.0.0').addBearerAuth().build();
 const docs=SwaggerModule.createDocument(app,config);SwaggerModule.setup('docs',app,docs);
 app.enableShutdownHooks();
 await app.listen(Number(process.env.PORT||3001),'0.0.0.0');
}
main().catch(err=>{console.error(err);process.exitCode=1;});
