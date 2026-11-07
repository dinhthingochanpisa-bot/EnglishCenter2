'use client';
import {useParams} from 'next/navigation';
import TenantConsole from '@/components/tenant-console';
export default function TenantSectionPage(){const {tenantId,section}=useParams<{tenantId:string;section:string}>();return <TenantConsole key={tenantId+section} tenantId={tenantId} section={section}/>}
