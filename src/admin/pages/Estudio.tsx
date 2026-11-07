/**
 * Estudio IA: con la foto de una prenda genera la foto en gancho, la foto con modelo y la ficha.
 * La generación corre en el servidor: aquí solo se suben las fotos y se consulta el avance, así que
 * se puede salir de la app o recargar y el trabajo sigue. Pensada para usarse desde el teléfono.
 */
import { useCallback, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import {
  AlertTriangle,
  Camera,
  Check,
  Copy,
  Download,
  FilePlus2,
  Images,
  Info,
  Minus,
  Plus,
  RotateCw,
  Sparkles,
  Star,
  Upload,
  X,
} from 'lucide-react';
import { cdn } from '@/lib/model';
import { MODELOS, modeloPorId } from '@/estudio/modelos';
import type { EstudioPublico, Ficha, NombrePaso, Trabajo } from '@/estudio/tipos';
import { api } from '../api';
import {
  fotoLista,
  fotosSinImportar,
  guardarTrabajo,
  nombreArchivo,
  pasoOcupado,
  prepararFoto,
  puedeImportar,
  tiempo,
  trabajoGuardado,
  urlJpg,
} from '../lib/estudio';
import { navigate } from '../lib/navigation';
import { useData } from '../lib/query';
import { Button, IconButton, cx } from '../ui/controls';
import { confirmDialog, toast, toastError } from '../ui/overlays';
import { Badge, Banner, Card, PageHeader } from '../ui/surfaces';

const CONSULTA_MS = 2500;
const MAX_FOTOS_DEFECTO = 4;

interface FotoLocal {
  id: string;
  blob?: Blob;
  url?: string;
  cargando: boolean;
}

const nuevoId = (): string => Math.random().toString(36).slice(2);

const esIOS = (): boolean =>
  /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
const esAndroid = (): boolean => /Android/i.test(navigator.userAgent);

/** Pide que la pantalla no se apague mientras se genera. */
function usePantallaEncendida(activa: boolean): void {
  useEffect(() => {
    if (!activa) return undefined;
    let lock: WakeLockSentinel | null = null;
    let cancelado = false;
    const pedir = async () => {
      try {
        if (document.visibilityState !== 'visible' || lock || !('wakeLock' in navigator)) return;
        const nuevo = await navigator.wakeLock.request('screen');
        if (cancelado) void nuevo.release();
        else {
          lock = nuevo;
          nuevo.addEventListener('release', () => {
            lock = null;
          });
        }
      } catch {
        /* el navegador no quiso; no pasa nada */
      }
    };
    void pedir();
    document.addEventListener('visibilitychange', pedir);
    return () => {
      cancelado = true;
      document.removeEventListener('visibilitychange', pedir);
      void lock?.release().catch(() => {});
    };
  }, [activa]);
}

/** Consulta el avance mientras haya algo generándose; retoma al volver a la app. */
function useTrabajo(id: string | null, alPerderse: (mensaje: string) => void) {
  const [trabajo, setTrabajo] = useState<Trabajo | null>(null);
  // Cambia cuando un trabajo ya terminado vuelve a generar algo: la consulta se reanuda
  const [pulso, setPulso] = useState(0);
  const perdido = useRef(alPerderse);
  perdido.current = alPerderse;

  const actualizar = useCallback((t: Trabajo) => {
    setTrabajo(t);
    if (!t.terminado) setPulso((p) => p + 1);
  }, []);

  const consultar = useCallback(async () => {
    if (!id) return null;
    const t = await api.estudio.estado(id);
    if (!t) {
      perdido.current('Ese trabajo ya no existe. Sube la prenda otra vez.');
      return null;
    }
    setTrabajo(t);
    return t;
  }, [id]);

  useEffect(() => {
    setTrabajo((t) => (t?.id === id ? t : null));
    if (!id) return undefined;
    let vivo = true;
    let consultando = false;
    let timer: ReturnType<typeof setTimeout>;
    const ciclo = async () => {
      if (consultando) return;
      consultando = true;
      clearTimeout(timer);
      let espera = CONSULTA_MS;
      try {
        const t = await consultar();
        if (!vivo || !t || t.terminado) return;
      } catch {
        espera = 5000; // sin conexión: se vuelve a intentar con calma
      } finally {
        consultando = false;
      }
      if (vivo) timer = setTimeout(() => void ciclo(), espera);
    };
    void ciclo();
    const alVolver = () => {
      if (document.visibilityState === 'visible') void ciclo();
    };
    document.addEventListener('visibilitychange', alVolver);
    return () => {
      vivo = false;
      clearTimeout(timer);
      document.removeEventListener('visibilitychange', alVolver);
    };
  }, [id, consultar, pulso]);

  return { trabajo, setTrabajo: actualizar };
}

export default function Estudio() {
  const { data: config } = useData(['estudio', 'config'], () => api.estudio.config());
  const [trabajoId, setTrabajoId] = useState<string | null>(() => trabajoGuardado());
  const [fotos, setFotos] = useState<FotoLocal[]>([]);

  const olvidar = useCallback(() => {
    guardarTrabajo(null);
    setTrabajoId(null);
  }, []);
  const { trabajo, setTrabajo } = useTrabajo(trabajoId, (mensaje) => {
    olvidar();
    toast({ tone: 'info', title: mensaje });
  });

  const empezar = (t: Trabajo) => {
    guardarTrabajo(t.id);
    setTrabajo(t);
    setTrabajoId(t.id);
  };

  const otraPrenda = async () => {
    if (trabajo && !trabajo.terminado) {
      const seguir = await confirmDialog({
        title: 'Esta prenda todavía se está generando',
        message: 'Si empiezas otra, ya no la verás aquí. ¿Continuar?',
        confirm: 'Continuar',
      });
      if (!seguir) return;
    }
    fotos.forEach((f) => f.url && URL.revokeObjectURL(f.url));
    setFotos([]);
    olvidar();
  };

  return (
    <main className="page estudio">
      <PageHeader
        back={{ to: '/productos', label: 'Productos' }}
        title={trabajoId ? 'Estudio IA' : 'Sube la prenda'}
        sub={
          trabajoId
            ? undefined
            : 'Tómale una foto con el celular, aunque esté arrugada. Si quieres, agrega otra de cerca de la etiqueta para que la ficha salga con el material y la talla.'
        }
        actions={config?.demo ? <Badge tone="amber">Demo</Badge> : undefined}
      />
      {config && !config.listo && (
        <Banner tone="danger" icon={AlertTriangle}>
          El servidor todavía no está listo para generar: falta configurar sus llaves (ver docs/CONEXION.md).
        </Banner>
      )}
      {trabajoId ? (
        <Resultados trabajo={trabajo} setTrabajo={setTrabajo} otraPrenda={() => void otraPrenda()} />
      ) : (
        <SubirFotos fotos={fotos} setFotos={setFotos} config={config} empezar={empezar} />
      )}
    </main>
  );
}

/* ---------- subir fotos ---------- */
function SubirFotos({
  fotos,
  setFotos,
  config,
  empezar,
}: {
  fotos: FotoLocal[];
  setFotos: (fn: (f: FotoLocal[]) => FotoLocal[]) => void;
  config: EstudioPublico | undefined;
  empezar: (t: Trabajo) => void;
}) {
  const camara = useRef<HTMLInputElement>(null);
  const galeria = useRef<HTMLInputElement>(null);
  const [error, setError] = useState('');
  const [subiendo, setSubiendo] = useState<string | null>(null);
  const max = config?.maxFotos || MAX_FOTOS_DEFECTO;

  const agregar = async (lista: FileList | null) => {
    setError('');
    const libres = max - fotos.length;
    const archivos = [...(lista || [])].filter((f) => !f.type || f.type.startsWith('image/'));
    if (archivos.length > libres) toast({ tone: 'info', title: `Máximo ${max} fotos por prenda.` });
    for (const archivo of archivos.slice(0, Math.max(0, libres))) {
      const id = nuevoId();
      setFotos((f) => [...f, { id, cargando: true }]);
      try {
        const blob = await prepararFoto(archivo);
        const url = URL.createObjectURL(blob);
        setFotos((f) => f.map((x) => (x.id === id ? { id, blob, url, cargando: false } : x)));
      } catch (e) {
        setFotos((f) => f.filter((x) => x.id !== id));
        setError((e as Error).message);
      }
    }
  };

  const quitar = (foto: FotoLocal) => {
    if (foto.url) URL.revokeObjectURL(foto.url);
    setFotos((f) => f.filter((x) => x.id !== foto.id));
  };

  const generar = async () => {
    setError('');
    try {
      const urls: string[] = [];
      for (const [i, foto] of fotos.entries()) {
        if (!foto.blob) continue;
        setSubiendo(fotos.length > 1 ? `Subiendo foto ${i + 1} de ${fotos.length}…` : 'Subiendo foto…');
        urls.push(await api.estudio.subirFoto(foto.blob));
      }
      setSubiendo('Empezando…');
      empezar(await api.estudio.crear(urls));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSubiendo(null);
    }
  };

  const hay = fotos.length > 0;
  return (
    <Card>
      {hay && (
        <div className="est-fotos">
          {fotos.map((f, i) => (
            <div key={f.id} className={cx('est-tile', f.cargando && 'est-tile--cargando')}>
              {f.url && <img src={f.url} alt={`Foto ${i + 1} de la prenda`} />}
              {i === 0 && (
                <span className="est-tile__badge">
                  <Star aria-hidden="true" />
                  Principal
                </span>
              )}
              <button
                type="button"
                className="est-tile__quitar"
                aria-label={`Quitar foto ${i + 1}`}
                onClick={() => quitar(f)}
              >
                <X aria-hidden="true" />
              </button>
            </div>
          ))}
          {fotos.length < max && (
            <button type="button" className="est-tile est-tile--agregar" onClick={() => galeria.current?.click()}>
              <Upload aria-hidden="true" />
              <strong>Agregar fotos</strong>
              <span>Etiqueta u otro ángulo</span>
            </button>
          )}
        </div>
      )}
      {!hay && (
        <div className="stack" style={{ '--gap': '10px' }}>
          <Button variant="primary" size="lg" block icon={Camera} onClick={() => camara.current?.click()}>
            Tomar foto
          </Button>
          <Button size="lg" block icon={Images} onClick={() => galeria.current?.click()}>
            Elegir de la galería
          </Button>
        </div>
      )}
      {hay && <p className="est-nota">La primera foto es la principal. Máximo {max}.</p>}
      {error && (
        <p className="est-error" role="alert">
          {error}
        </p>
      )}
      {hay && (
        <div className="est-generar">
          <Button
            variant="primary"
            size="xl"
            block
            icon={Sparkles}
            loading={!!subiendo}
            disabled={fotos.some((f) => f.cargando)}
            onClick={() => void generar()}
          >
            {subiendo || 'Generar fotos y ficha'}
          </Button>
        </div>
      )}
      <p className="est-nota est-nota--centro">
        Tarda de 1 a 3 minutos. Al terminar tendrás las 2 fotos y los textos listos para importar.
      </p>
      <input
        ref={galeria}
        type="file"
        accept="image/*"
        multiple
        hidden
        onChange={(e) => {
          void agregar(e.currentTarget.files);
          e.currentTarget.value = '';
        }}
      />
      <input
        ref={camara}
        type="file"
        accept="image/*"
        capture="environment"
        hidden
        onChange={(e) => {
          void agregar(e.currentTarget.files);
          e.currentTarget.value = '';
        }}
      />
    </Card>
  );
}

/* ---------- resultados ---------- */
function Resultados({
  trabajo,
  setTrabajo,
  otraPrenda,
}: {
  trabajo: Trabajo | null;
  setTrabajo: (t: Trabajo) => void;
  otraPrenda: () => void;
}) {
  const [pendiente, setPendiente] = useState<string | null>(null);
  const [ficha, setFicha] = useState<Ficha | null>(null);
  const [importando, setImportando] = useState(false);
  const fichaVersion = useRef<string | null>(null);
  usePantallaEncendida(!!trabajo && !trabajo.terminado);

  // La ficha se edita aquí; solo se reemplaza cuando llega una versión nueva
  useEffect(() => {
    if (!trabajo?.ficha) return;
    const clave = `${trabajo.id}:${trabajo.pasos.ficha.version}`;
    if (fichaVersion.current === clave) return;
    fichaVersion.current = clave;
    setFicha(trabajo.ficha);
  }, [trabajo]);

  if (!trabajo) {
    return (
      <div className="card card--pad est-cargando" role="status">
        <span className="spinner" />
        Retomando tu prenda…
      </div>
    );
  }

  const regenerar = async (tipo: NombrePaso, modeloId?: string) => {
    try {
      const t = await api.estudio.regenerar(trabajo.id, tipo, modeloId);
      setPendiente(null);
      setTrabajo(t);
      toast({ tone: 'info', title: tipo === 'ficha' ? 'Reescribiendo la ficha…' : 'Generando otra versión…' });
    } catch (e) {
      toastError(e);
    }
  };

  const guardarFicha = async () => {
    if (!ficha) return;
    const t = await api.estudio.guardarFicha(trabajo.id, ficha);
    setTrabajo(t);
  };

  const importar = async () => {
    setImportando(true);
    try {
      await guardarFicha();
      const faltan = fotosSinImportar(trabajo);
      if (faltan.length) toast({ tone: 'info', title: faltan.join(' ') });
      navigate(`/productos/nuevo?estudio=${trabajo.id}`);
    } catch (e) {
      toastError(e, 'No se pudo importar');
    } finally {
      setImportando(false);
    }
  };

  const faltan = fotosSinImportar(trabajo);
  return (
    <div className="stack est-resultados">
      <div className="est-resumen">
        <div className="est-resumen__fotos">
          {trabajo.fotos.slice(0, 3).map((f, i) => (
            <img key={`${f}-${i}`} src={cdn(f, { w: 120 })} alt="" />
          ))}
        </div>
        <div className="est-resumen__txt">
          <strong>{ficha?.nombre || 'Prenda en proceso'}</strong>
          <span>
            {trabajo.terminado
              ? 'Listo. Revisa las fotos y la información.'
              : 'Puedes salir de la app; el trabajo sigue.'}
          </span>
        </div>
      </div>

      <Progreso trabajo={trabajo} />

      <Card title="Foto con modelo" actions={<span className="badge badge--ink">Principal</span>}>
        <FotoGenerada trabajo={trabajo} tipo="modelo" nombre={ficha?.nombre} regenerar={regenerar} />
        <SelectorModelo trabajo={trabajo} pendiente={pendiente} setPendiente={setPendiente} regenerar={regenerar} />
      </Card>

      <Card title="Foto en gancho">
        <FotoGenerada trabajo={trabajo} tipo="prenda" nombre={ficha?.nombre} regenerar={regenerar} />
      </Card>

      <Card title="Información" icon={Info}>
        <FichaEditable
          trabajo={trabajo}
          ficha={ficha}
          setFicha={setFicha}
          guardar={() => void guardarFicha().catch(() => {})}
          regenerar={() => void regenerar('ficha')}
        />
      </Card>

      <div className="stack" style={{ '--gap': '10px' }}>
        <Button
          variant="primary"
          size="xl"
          block
          icon={FilePlus2}
          loading={importando}
          disabled={!puedeImportar(trabajo)}
          onClick={() => void importar()}
        >
          Importar al producto
        </Button>
        {puedeImportar(trabajo) && faltan.length > 0 && <p className="est-nota est-nota--centro">{faltan.join(' ')}</p>}
        <Button size="xl" block icon={Plus} onClick={otraPrenda}>
          Subir otra prenda
        </Button>
      </div>
    </div>
  );
}

/* ---------- progreso ---------- */
const PASOS: { paso: NombrePaso; texto: string }[] = [
  { paso: 'ficha', texto: 'Leyendo la prenda y escribiendo la ficha' },
  { paso: 'prenda', texto: 'Planchando y colgando la prenda' },
  { paso: 'modelo', texto: 'Vistiendo a la modelo' },
];

const TEXTO_PASO: Record<string, string> = { en_cola: 'En espera', omitido: 'Sin modelo', error: 'Falló' };

function Reloj({ desde }: { desde: number }) {
  const [extra, setExtra] = useState(0);
  useEffect(() => {
    setExtra(0);
    const inicio = Date.now();
    const timer = setInterval(() => setExtra(Math.floor((Date.now() - inicio) / 1000)), 1000);
    return () => clearInterval(timer);
  }, [desde]);
  return <>{tiempo(desde + extra)}</>;
}

function Progreso({ trabajo }: { trabajo: Trabajo }) {
  return (
    <div className="card est-progreso">
      <ol className="est-pasos">
        {PASOS.map(({ paso, texto }) => {
          const p = trabajo.pasos[paso];
          return (
            <li key={paso} className="est-paso" data-estado={p.estado}>
              <span className="est-paso__ico">
                {p.estado === 'listo' && <Check aria-hidden="true" />}
                {p.estado === 'error' && <X aria-hidden="true" />}
                {p.estado === 'omitido' && <Minus aria-hidden="true" />}
              </span>
              <span>{texto}</span>
              <span className="est-paso__t">
                {p.estado === 'listo' && tiempo(p.segundos)}
                {p.estado === 'trabajando' && <Reloj desde={p.segundos} />}
                {p.estado !== 'listo' && p.estado !== 'trabajando' && TEXTO_PASO[p.estado]}
              </span>
            </li>
          );
        })}
      </ol>
    </div>
  );
}

/* ---------- fotos ---------- */
function FotoGenerada({
  trabajo,
  tipo,
  nombre,
  regenerar,
}: {
  trabajo: Trabajo;
  tipo: 'modelo' | 'prenda';
  nombre: string | undefined;
  regenerar: (tipo: NombrePaso) => Promise<void>;
}) {
  const p = trabajo.pasos[tipo];
  const url = trabajo.imagenes[tipo];
  const ocupado = pasoOcupado(trabajo, tipo);
  const listo = !!fotoLista(trabajo, tipo);
  const modelo = modeloPorId(trabajo.modelo?.id);
  const archivo = useRef<{ url: string; file: File | null } | null>(null);

  // Se descarga por adelantado: en iPhone el menú de compartir solo abre si se llama de inmediato
  const preparar = useCallback(
    async (direccion: string) => {
      archivo.current = { url: direccion, file: null };
      try {
        const res = await fetch(urlJpg(direccion));
        const blob = await res.blob();
        if (archivo.current?.url !== direccion) return;
        archivo.current.file = new File([blob], nombreArchivo(nombre, tipo), { type: blob.type || 'image/jpeg' });
      } catch {
        /* se reintenta al tocar Guardar */
      }
    },
    [nombre, tipo],
  );

  useEffect(() => {
    if (url && listo) void preparar(url);
  }, [url, listo, preparar]);

  const descargar = (file: File) => {
    const enlace = URL.createObjectURL(file);
    const a = document.createElement('a');
    a.href = enlace;
    a.download = file.name;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(enlace), 5000);
  };

  const guardar = () => {
    const file = archivo.current?.file;
    if (!file) {
      if (url) void preparar(url);
      toast({ tone: 'info', title: 'La foto se está preparando, vuelve a tocar en un segundo.' });
      return;
    }
    // iPhone: menú de compartir → «Guardar imagen» la manda directo a Fotos.
    if (esIOS() && navigator.canShare?.({ files: [file] })) {
      navigator
        .share({ files: [file] })
        .then(() => toast({ title: 'Listo. Si elegiste «Guardar imagen», ya está en Fotos.' }))
        .catch((err: Error) => {
          if (err?.name !== 'AbortError') {
            descargar(file);
            toast({ tone: 'info', title: 'Descargada. Ábrela y toca compartir → Guardar imagen.' });
          }
        });
      return;
    }
    descargar(file);
    toast({ title: esAndroid() ? 'Guardada en Descargas. La encuentras en tu Galería.' : 'Foto descargada.' });
  };

  let espera = tipo === 'prenda' ? 'Planchando y colgando la prenda…' : 'Vistiendo a la modelo…';
  if (tipo === 'modelo' && modelo) espera = `Vistiendo a ${modelo.nombre}…`;
  if (tipo === 'modelo' && !modelo && p.estado === 'en_cola') espera = 'Eligiendo la modelo ideal…';

  return (
    <>
      <div className={cx('est-marco', !!url && (ocupado || p.estado === 'error') && 'est-marco--viejo')}>
        {url && (
          <img
            key={url}
            src={cdn(url, { w: 900 })}
            alt={tipo === 'modelo' ? 'Foto de la modelo con la prenda' : 'Foto de la prenda en gancho'}
          />
        )}
        {ocupado && (
          <div className="est-marco__espera">
            <span className="spinner" />
            {espera}
            <small>Suele tardar entre 1 y 2 minutos</small>
          </div>
        )}
        {p.estado === 'error' && (
          <div className="est-marco__error">
            <span>{p.error || 'No se pudo generar.'}</span>
            <Button variant="primary" icon={RotateCw} onClick={() => void regenerar(tipo)}>
              Intentar de nuevo
            </Button>
          </div>
        )}
        {p.estado === 'omitido' && (
          <div className="est-marco__info">
            <Info aria-hidden="true" />
            <span>{p.nota}</span>
          </div>
        )}
      </div>
      <div className="est-acciones">
        <Button variant="primary" size="lg" block icon={Download} disabled={!listo} onClick={guardar}>
          Guardar en el teléfono
        </Button>
        <IconButton
          className="est-acciones__otra"
          icon={RotateCw}
          label="Generar otra versión"
          disabled={p.estado !== 'listo' && p.estado !== 'error'}
          onClick={() => void regenerar(tipo)}
        />
      </div>
    </>
  );
}

function SelectorModelo({
  trabajo,
  pendiente,
  setPendiente,
  regenerar,
}: {
  trabajo: Trabajo;
  pendiente: string | null;
  setPendiente: (id: string | null) => void;
  regenerar: (tipo: NombrePaso, modeloId?: string) => Promise<void>;
}) {
  const ocupado = pasoOcupado(trabajo, 'modelo');
  const actual = trabajo.modelo?.id || null;
  const elegida = modeloPorId(pendiente);
  const nombreActual = modeloPorId(actual)?.nombre;
  let motivo = '';
  if (trabajo.modelo) {
    motivo = trabajo.modelo.porIA
      ? `Elegida por la IA${trabajo.modelo.motivo ? `: ${trabajo.modelo.motivo}` : '.'}`
      : `Elegiste a ${nombreActual}.`;
  } else if (trabajo.pasos.modelo.estado === 'omitido') {
    motivo = 'Toca una modelo si quieres la foto de todos modos.';
  }
  return (
    <div className="est-selector">
      <p className="est-selector__titulo">Modelo</p>
      <div className="est-selector__lista">
        {MODELOS.map((m) => (
          <button
            key={m.id}
            type="button"
            className="est-mod"
            aria-label={m.nombre}
            aria-pressed={m.id === actual}
            data-pendiente={m.id === pendiente}
            disabled={ocupado}
            onClick={() => setPendiente(m.id === actual ? null : m.id)}
          >
            <img src={m.miniatura} alt="" loading="lazy" />
            <span>{m.nombre.replace('Modelo ', '')}</span>
          </button>
        ))}
      </div>
      {motivo && <p className="est-selector__motivo">{motivo}</p>}
      {elegida && !ocupado && (
        <Button block onClick={() => void regenerar('modelo', elegida.id)}>
          Generar la foto con {elegida.nombre}
        </Button>
      )}
    </div>
  );
}

/* ---------- ficha ---------- */
function Campo({
  etiqueta,
  nota,
  valor,
  onValor,
  onSalir,
  soloLectura,
  children,
}: {
  etiqueta: string;
  nota?: string;
  valor: string;
  onValor?: (v: string) => void;
  onSalir?: () => void;
  soloLectura?: boolean;
  children?: ReactNode;
}) {
  const area = useRef<HTMLTextAreaElement>(null);
  const [copiado, setCopiado] = useState(false);

  useLayoutEffect(() => {
    const ta = area.current;
    if (!ta) return;
    ta.style.height = 'auto';
    ta.style.height = `${ta.scrollHeight + 2}px`;
  }, [valor]);

  const copiar = async () => {
    let ok = false;
    try {
      await navigator.clipboard.writeText(valor);
      ok = true;
    } catch {
      const ta = document.createElement('textarea');
      ta.value = valor;
      ta.setAttribute('readonly', '');
      ta.style.cssText = 'position:fixed;top:0;left:0;opacity:0;';
      document.body.appendChild(ta);
      ta.select();
      ta.setSelectionRange(0, valor.length);
      try {
        ok = document.execCommand('copy');
      } catch {
        /* sin permiso */
      }
      ta.remove();
    }
    if (!ok) {
      toast({ tone: 'info', title: 'No se pudo copiar. Mantén presionado el texto para copiarlo.' });
      return;
    }
    navigator.vibrate?.(12);
    setCopiado(true);
    setTimeout(() => setCopiado(false), 1600);
  };

  return (
    <div className="est-campo">
      <div className="est-campo__top">
        <label className="est-campo__label">
          {etiqueta}
          {nota && <small> {nota}</small>}
        </label>
        <Button
          size="sm"
          variant={copiado ? 'tinted' : 'secondary'}
          icon={copiado ? Check : Copy}
          onClick={() => void copiar()}
        >
          {copiado ? 'Copiado' : 'Copiar'}
        </Button>
      </div>
      <textarea
        ref={area}
        className="input est-campo__valor"
        rows={1}
        spellCheck
        aria-label={etiqueta}
        value={valor}
        readOnly={soloLectura}
        onChange={(e) => onValor?.(e.currentTarget.value)}
        onBlur={onSalir}
      />
      {children}
    </div>
  );
}

function PistaEtiqueta({ deEtiqueta }: { deEtiqueta: boolean }) {
  return deEtiqueta ? (
    <span className="est-pista est-pista--ok">
      <Check aria-hidden="true" />
      Leído de la etiqueta
    </span>
  ) : (
    <span className="est-pista">
      <AlertTriangle aria-hidden="true" />
      Estimado por la IA: confírmalo con la etiqueta
    </span>
  );
}

function FichaEditable({
  trabajo,
  ficha,
  setFicha,
  guardar,
  regenerar,
}: {
  trabajo: Trabajo;
  ficha: Ficha | null;
  setFicha: (fn: (f: Ficha | null) => Ficha | null) => void;
  guardar: () => void;
  regenerar: () => void;
}) {
  const p = trabajo.pasos.ficha;
  if (!ficha) {
    if (p.estado === 'error') {
      return (
        <div className="stack">
          <p className="est-error">{p.error || 'No se pudo escribir la ficha.'}</p>
          <Button variant="primary" block icon={RotateCw} onClick={regenerar}>
            Intentar de nuevo
          </Button>
        </div>
      );
    }
    return (
      <div className="est-ficha-espera" aria-label="Escribiendo la ficha">
        <span />
        <span />
        <span />
        <span />
      </div>
    );
  }

  const cambiar = (patch: Partial<Ficha>) => setFicha((f) => (f ? { ...f, ...patch } : f));
  const comun = { onSalir: guardar };
  return (
    <>
      {ficha.avisos.length > 0 && (
        <div className="est-avisos">
          <strong>
            <AlertTriangle aria-hidden="true" />
            Revisa antes de publicar
          </strong>
          <ul>
            {ficha.avisos.map((a, i) => (
              <li key={`${a}-${i}`}>{a}</li>
            ))}
          </ul>
        </div>
      )}
      <Campo etiqueta="Nombre" valor={ficha.nombre} onValor={(nombre) => cambiar({ nombre })} {...comun} />
      <Campo
        etiqueta="Descripción"
        valor={ficha.descripcion}
        onValor={(descripcion) => cambiar({ descripcion })}
        {...comun}
      />
      <Campo
        etiqueta="Detalles"
        nota="(uno por renglón)"
        valor={ficha.detalles.join('\n')}
        onValor={(v) => cambiar({ detalles: v.split('\n') })}
        {...comun}
      />
      <Campo etiqueta="Material" valor={ficha.material} onValor={(material) => cambiar({ material })} {...comun}>
        <PistaEtiqueta deEtiqueta={ficha.material_de_etiqueta} />
      </Campo>
      <Campo etiqueta="Cuidados" valor={ficha.cuidados} onValor={(cuidados) => cambiar({ cuidados })} {...comun}>
        <PistaEtiqueta deEtiqueta={ficha.cuidados_de_etiqueta} />
      </Campo>
      <Campo etiqueta="Origen" valor={ficha.origen} onValor={(origen) => cambiar({ origen })} {...comun} />
      <div className="est-extra">
        <p className="est-extra__titulo">También te puede servir</p>
        <div className="est-fila-2">
          <Campo etiqueta="Color" valor={ficha.color} onValor={(color) => cambiar({ color })} {...comun} />
          {ficha.categoria_nombre && <Campo etiqueta="Categoría" valor={ficha.categoria_nombre} soloLectura />}
          {ficha.talla && (
            <Campo etiqueta="Talla" valor={ficha.talla} onValor={(talla) => cambiar({ talla })} {...comun} />
          )}
          {ficha.marca_visible && (
            <Campo
              etiqueta="Marca"
              valor={ficha.marca_visible}
              onValor={(marca_visible) => cambiar({ marca_visible })}
              {...comun}
            />
          )}
        </div>
      </div>
      <div className="est-ficha-pie">
        <Button block icon={RotateCw} disabled={pasoOcupado(trabajo, 'ficha')} onClick={regenerar}>
          Reescribir la ficha
        </Button>
      </div>
    </>
  );
}
