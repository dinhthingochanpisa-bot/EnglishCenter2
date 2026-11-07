import { Body,Controller,Get,Patch,Post,Param,Query,Req,UseGuards,ValidationPipe,ParseUUIDPipe } from '@nestjs/common';
import { ApiBearerAuth,ApiTags } from '@nestjs/swagger';
import { AuthGuard,AuthRequest } from './auth';
import { CrmService } from './crm.service';
import { CreatePersonDto,UpdatePersonDto,CreateSourceDto,CreateCampaignDto,CreateLeadDto,UpdateLeadDto,CreateActivityDto,CreateTouchDto,CreateCheckinDto,CompleteCheckinDto,CreateIntakeInviteDto,SubmitIntakeDto,ReviewIntakeDto } from './crm.dto';
const V=new ValidationPipe({whitelist:true,forbidNonWhitelisted:true,transform:true});
@ApiTags('CRM Stage 02') @ApiBearerAuth() @UseGuards(AuthGuard) @Controller('v1/tenants/:tenantId/crm')
export class CrmController {
 constructor(private readonly crm:CrmService){}
 @Get('persons') persons(@Req()r:AuthRequest,@Param('tenantId',ParseUUIDPipe)t:string,@Query('branchId')b?:string,@Query('search')q?:string){return this.crm.listPersons(t,r.actor,b,q)}
 @Post('persons') personCreate(@Req()r:AuthRequest,@Param('tenantId',ParseUUIDPipe)t:string,@Body(V)d:CreatePersonDto){return this.crm.createPerson(t,r.actor,d)}
 @Get('persons/:id') person(@Req()r:AuthRequest,@Param('tenantId',ParseUUIDPipe)t:string,@Param('id',ParseUUIDPipe)id:string,@Query('branchId')b:string){return this.crm.getPerson(t,id,r.actor,b)}
 @Patch('persons/:id') personUpdate(@Req()r:AuthRequest,@Param('tenantId',ParseUUIDPipe)t:string,@Param('id',ParseUUIDPipe)id:string,@Body(V)d:UpdatePersonDto){return this.crm.updatePerson(t,id,r.actor,d)}
 @Get('sources') sources(@Req()r:AuthRequest,@Param('tenantId',ParseUUIDPipe)t:string){return this.crm.listSources(t,r.actor)}
 @Post('sources') sourceCreate(@Req()r:AuthRequest,@Param('tenantId',ParseUUIDPipe)t:string,@Body(V)d:CreateSourceDto){return this.crm.createSource(t,r.actor,d)}
 @Get('campaigns') campaigns(@Req()r:AuthRequest,@Param('tenantId',ParseUUIDPipe)t:string){return this.crm.listCampaigns(t,r.actor)}
 @Post('campaigns') campaignCreate(@Req()r:AuthRequest,@Param('tenantId',ParseUUIDPipe)t:string,@Body(V)d:CreateCampaignDto){return this.crm.createCampaign(t,r.actor,d)}
 @Get('assignees') assignees(@Req()r:AuthRequest,@Param('tenantId',ParseUUIDPipe)t:string,@Query('branchId')b:string){return this.crm.listAssignees(t,r.actor,b)}
 @Get('leads') leads(@Req()r:AuthRequest,@Param('tenantId',ParseUUIDPipe)t:string,@Query('branchId')b?:string,@Query('search')q?:string,@Query('status')s?:string){return this.crm.listLeads(t,r.actor,b,q,s)}
 @Post('leads') leadCreate(@Req()r:AuthRequest,@Param('tenantId',ParseUUIDPipe)t:string,@Body(V)d:CreateLeadDto){return this.crm.createLead(t,r.actor,d)}
 @Get('leads/:id') lead(@Req()r:AuthRequest,@Param('tenantId',ParseUUIDPipe)t:string,@Param('id',ParseUUIDPipe)id:string){return this.crm.getLead(t,id,r.actor)}
 @Patch('leads/:id') leadUpdate(@Req()r:AuthRequest,@Param('tenantId',ParseUUIDPipe)t:string,@Param('id',ParseUUIDPipe)id:string,@Body(V)d:UpdateLeadDto){return this.crm.updateLead(t,id,r.actor,d)}
 @Post('leads/:id/activities') activity(@Req()r:AuthRequest,@Param('tenantId',ParseUUIDPipe)t:string,@Param('id',ParseUUIDPipe)id:string,@Body(V)d:CreateActivityDto){return this.crm.addActivity(t,id,r.actor,d)}
 @Post('leads/:id/touches') touch(@Req()r:AuthRequest,@Param('tenantId',ParseUUIDPipe)t:string,@Param('id',ParseUUIDPipe)id:string,@Body(V)d:CreateTouchDto){return this.crm.addTouch(t,id,r.actor,d)}
 @Get('checkins') checkins(@Req()r:AuthRequest,@Param('tenantId',ParseUUIDPipe)t:string,@Query('branchId')b?:string){return this.crm.listCheckins(t,r.actor,b)}
 @Post('checkins') checkinCreate(@Req()r:AuthRequest,@Param('tenantId',ParseUUIDPipe)t:string,@Body(V)d:CreateCheckinDto){return this.crm.createCheckin(t,r.actor,d)}
 @Post('checkins/:id/complete') checkinComplete(@Req()r:AuthRequest,@Param('tenantId',ParseUUIDPipe)t:string,@Param('id',ParseUUIDPipe)id:string,@Body(V)d:CompleteCheckinDto){return this.crm.completeCheckin(t,id,r.actor,d)}
 @Post('intake-invites') invite(@Req()r:AuthRequest,@Param('tenantId',ParseUUIDPipe)t:string,@Body(V)d:CreateIntakeInviteDto){return this.crm.createIntakeInvite(t,r.actor,d)}
 @Get('intake-submissions') submissions(@Req()r:AuthRequest,@Param('tenantId',ParseUUIDPipe)t:string,@Query('branchId')b:string){return this.crm.listIntakeSubmissions(t,r.actor,b)}
 @Post('intake-submissions/:id/review') review(@Req()r:AuthRequest,@Param('tenantId',ParseUUIDPipe)t:string,@Param('id',ParseUUIDPipe)id:string,@Body(V)d:ReviewIntakeDto){return this.crm.reviewIntake(t,id,r.actor,d)}
}
@ApiTags('Public CRM Intake') @Controller('v1/public/intake')
export class CrmPublicController {
 constructor(private readonly crm:CrmService){}
 @Post(':tenantId/:token') submit(@Param('tenantId',ParseUUIDPipe)t:string,@Param('token')token:string,@Body(V)d:SubmitIntakeDto){return this.crm.submitIntake(t,token,d)}
}
