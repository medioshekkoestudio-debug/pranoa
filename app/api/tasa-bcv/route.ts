import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

// Tasa oficial BCV de referencia (dolarapi.com). La caja la revisa y la confirma antes de guardarla.
export async function GET() {
  try {
    const r = await fetch('https://ve.dolarapi.com/v1/dolares/oficial', { cache: 'no-store', headers: { Accept: 'application/json' } });
    if (!r.ok) throw new Error(String(r.status));
    const d = (await r.json()) as { promedio?: number; fechaActualizacion?: string };
    if (!d.promedio || d.promedio <= 0) throw new Error('sin valor');
    return NextResponse.json({ valor: d.promedio, fecha: d.fechaActualizacion || null });
  } catch {
    return NextResponse.json({ error: 'No se pudo consultar la tasa del BCV. Escríbela a mano.' }, { status: 502 });
  }
}
