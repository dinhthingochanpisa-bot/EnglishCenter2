import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
export const runtime='nodejs';
export async function GET(request:NextRequest){
  const session=getSession(request);
  return NextResponse.json(session?{authenticated:true,user:session.user,expiresAt:session.expiresAt}:{authenticated:false},{headers:{'cache-control':'no-store'}});
}
