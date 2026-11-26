import { NextRequest, NextResponse } from 'next/server';
import { consultarTasaBcv, sincronizarTasaBcvSiFalta } from '@/lib/tasaBcv';

export const dynamic = 'force-dynamic';

// Consulta la tasa oficial BCV. Si ?sincronizar=1 (o Vercel Cron), también la guarda en Supabase.
export async function GET(req: NextRequest) {
  const sincronizar = req.nextUrl.searchParams.get('sincronizar') === '1' || req.headers.get('x-vercel-cron') !== null;

  if (sincronizar) {
    const res = await sincronizarTasaBcvSiFalta(true);
    if (!res.valor) {
      return NextResponse.json({ error: 'No se pudo consultar la tasa del BCV.' }, { status: 502 });
    }
    return NextResponse.json({ valor: res.valor, sincronizada: res.actualizada });
  }

  const bcv = await consultarTasaBcv();
  if (!bcv) {
    return NextResponse.json({ error: 'No se pudo consultar la tasa del BCV. Escríbela a mano.' }, { status: 502 });
  }
  return NextResponse.json({ valor: bcv.valor, fecha: bcv.fecha });
}

// Actualiza automáticamente la tasa en Supabase si la del día aún no se ha sincronizado.
export async function POST() {
  const res = await sincronizarTasaBcvSiFalta(false);
  if (!res.valor) {
    return NextResponse.json({ error: 'No se pudo actualizar la tasa BCV automáticamente.' }, { status: 502 });
  }
  return NextResponse.json({ valor: res.valor, actualizada: res.actualizada });
}
