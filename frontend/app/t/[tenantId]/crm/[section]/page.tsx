'use client';
import {useParams} from 'next/navigation';
import CrmConsole from '@/components/crm-console';
export default function CrmSectionPage(){const {tenantId,section}=useParams<{tenantId:string;section:string}>();return <CrmConsole key={tenantId+section} tenantId={tenantId} section={section}/>}
