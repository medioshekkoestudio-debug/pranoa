import { supabaseServicio } from './supabase/servidor';
import { hoyVE } from './formato';
import type { Ajustes } from './tipos';

let ultimoIntentoMs = 0;

/** Consulta la tasa oficial BCV (ve.dolarapi.com con respaldo). */
export async function consultarTasaBcv(): Promise<{ valor: number; fecha: string | null } | null> {
  const fuentes = [
    async () => {
      const r = await fetch('https://ve.dolarapi.com/v1/dolares/oficial', {
        cache: 'no-store',
        headers: { Accept: 'application/json' },
        signal: AbortSignal.timeout(5000),
      });
      if (!r.ok) return null;
      const d = (await r.json()) as { promedio?: number; fechaActualizacion?: string };
      return d.promedio && d.promedio > 0 ? { valor: Number(d.promedio), fecha: d.fechaActualizacion || null } : null;
    },
    async () => {
      const r = await fetch('https://open.er-api.com/v6/latest/USD', {
        cache: 'no-store',
        signal: AbortSignal.timeout(5000),
      });
      if (!r.ok) return null;
      const d = (await r.json()) as { rates?: { VES?: number }; time_last_update_utc?: string };
      return d.rates?.VES && d.rates.VES > 0 ? { valor: Number(d.rates.VES), fecha: d.time_last_update_utc || null } : null;
    },
  ];

  for (const fn of fuentes) {
    try {
      const res = await fn();
      if (res && res.valor > 0) return res;
    } catch {
      // probar siguiente fuente
    }
  }
  return null;
}

function esDeHoyVE(iso: string | null): boolean {
  if (!iso) return false;
  const fechaIso = new Date(iso).toLocaleDateString('en-CA', { timeZone: 'America/Caracas' });
  return fechaIso === hoyVE();
}

/**
 * Si la tasa guardada en `ajustes` no corresponde al día de hoy (hora Venezuela),
 * consulta el BCV automáticamente y la guarda en Supabase.
 */
export async function sincronizarTasaBcvSiFalta(forzar = false, ajustesActuales?: Ajustes | null): Promise<{
  actualizada: boolean;
  valor: number | null;
  ajustes: Ajustes | null;
}> {
  const ahora = Date.now();
  const sb = supabaseServicio();

  let aj = ajustesActuales ?? null;
  if (!aj) {
    const { data } = await sb.from('ajustes').select('*').eq('id', 1).single();
    aj = data as Ajustes | null;
  }

  if (!forzar && aj && Number(aj.tasa_bs) > 0 && esDeHoyVE(aj.tasa_actualizada)) {
    return { actualizada: false, valor: Number(aj.tasa_bs), ajustes: aj };
  }

  // Evitar ráfagas si la API externa está caída
  if (!forzar && ahora - ultimoIntentoMs < 15 * 60 * 1000) {
    return { actualizada: false, valor: aj ? Number(aj.tasa_bs) : null, ajustes: aj };
  }
  ultimoIntentoMs = ahora;

  const bcv = await consultarTasaBcv();
  if (!bcv) {
    return { actualizada: false, valor: aj ? Number(aj.tasa_bs) : null, ajustes: aj };
  }

  const valorRedondeado = Math.round(bcv.valor * 10000) / 10000;
  const nowIso = new Date().toISOString();

  await Promise.all([
    sb.from('tasas').insert({ valor: valorRedondeado, fuente: 'BCV automático' }),
    sb
      .from('ajustes')
      .update({
        tasa_bs: valorRedondeado,
        tasa_fuente: 'BCV automático',
        tasa_actualizada: nowIso,
        updated_at: nowIso,
      })
      .eq('id', 1),
  ]);

  const nuevoAjuste = aj
    ? { ...aj, tasa_bs: valorRedondeado, tasa_fuente: 'BCV automático', tasa_actualizada: nowIso }
    : null;

  return { actualizada: true, valor: valorRedondeado, ajustes: nuevoAjuste };
}
