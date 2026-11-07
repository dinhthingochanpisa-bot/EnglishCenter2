import revision from '@/lib/source-revision.json';
export function GET(){return Response.json(revision,{headers:{'Cache-Control':'no-store'}})}
