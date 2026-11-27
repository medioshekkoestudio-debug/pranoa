import { NextRequest, NextResponse } from 'next/server';
import { consultarTasaBcv, sincronizarTasaBcvSiFalta } from '@/lib/tasaBcv';

export const dynamic = 'force-dynamic';

/** El cron (Vercel o externo) debe mandar la clave CRON_SECRET:
 *  - cabecera `Authorization: Bearer <CRON_SECRET>` (Vercel Cron la manda sola), o
 *  - parámetro `?clave=<CRON_SECRET>` (para servicios como cron-job.org). */
function cronAutorizado(req: NextRequest): boolean {
  const secreto = process.env.CRON_SECRET;
  if (!secreto) return false;
  const auth = req.headers.get('authorization');
  const clave = req.nextUrl.searchParams.get('clave');
  return auth === `Bearer ${secreto}` || clave === secreto;
}

// GET sin parámetros: solo consulta la tasa BCV (botón «Traer tasa oficial BCV» de la caja).
// GET ?sincronizar=1 con la clave del cron: consulta y GUARDA la tasa en Supabase.
export async function GET(req: NextRequest) {
  if (req.nextUrl.searchParams.get('sincronizar') === '1') {
    if (!cronAutorizado(req)) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }
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

// Al abrir la caja: guarda la tasa solo si la de hoy aún no existe (no fuerza, con freno de 15 min).
export async function POST() {
  const res = await sincronizarTasaBcvSiFalta(false);
  if (!res.valor) {
    return NextResponse.json({ error: 'No se pudo actualizar la tasa BCV automáticamente.' }, { status: 502 });
  }
  return NextResponse.json({ valor: res.valor, actualizada: res.actualizada });
}
