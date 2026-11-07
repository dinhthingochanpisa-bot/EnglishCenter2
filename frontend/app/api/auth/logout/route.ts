import { NextRequest, NextResponse } from 'next/server';
import { clearSession } from '@/lib/session';
import { origin, sameOrigin } from '@/lib/oidc';
export const runtime='nodejs';
export async function POST(req:NextRequest){
 if(!sameOrigin(req))return NextResponse.json({message:'Invalid origin'},{status:403});
 const response=NextResponse.json({ok:true});clearSession(response);return response;
}
