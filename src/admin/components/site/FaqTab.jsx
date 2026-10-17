/** Preguntas frecuentes de la portada: escribir, ordenar y ocultar. */
import { useEffect, useState } from 'preact/hooks';
import { Plus, Pencil, Trash2, CircleHelp, EyeOff } from 'lucide-preact';
import { api } from '../../api/index.js';
import { invalidate } from '../../lib/query.js';
import { Button, TextField, SwitchRow, Switch, cx } from '../../ui/controls.jsx';
import { Card, Badge, Empty, SkeletonRows, Menu } from '../../ui/surfaces.jsx';
import { Sheet, toast, toastError, confirmDialog } from '../../ui/overlays.jsx';
import { useOrdered, MoveButtons } from './shared.jsx';

const NEW_FAQ = { question: '', answer: '', active: true };

export function FaqTab({ data, loading, onSaved }) {
  const [list, move] = useOrdered(data?.faq, (f) => f.id, (ids) => api.content.reorderFaq(ids));
  const [edit, setEdit] = useState(null);
  const visible = list.filter((f) => f.active !== false).length;

  const toggle = async (f, active) => {
    try {
      await api.content.saveFaq({ ...f, active });
      invalidate('content');
      onSaved?.();
    } catch (err) {
      toastError(err);
    }
  };
  const remove = async (f) => {
    const ok = await confirmDialog({ title: '¿Eliminar esta pregunta?', message: f.question, confirm: 'Eliminar', danger: true });
    if (!ok) return;
    try {
      await api.content.deleteFaq(f.id);
      invalidate('content');
      onSaved?.();
      toast({ title: 'Pregunta eliminada' });
    } catch (err) {
      toastError(err);
    }
  };

  return (
    <>
      <div class="tab-intro">
        <p class="muted">{list.length ? `${visible} de ${list.length} visibles. ` : ''}Responde aquí las dudas que más te hacen por WhatsApp: ahorras tiempo y das confianza.</p>
        <Button variant="primary" icon={Plus} onClick={() => setEdit({ ...NEW_FAQ })}>Nueva pregunta</Button>
      </div>
      <Card bodyClass={false}>
        {loading ? <SkeletonRows rows={5} thumb={false} /> : !list.length ? (
          <Empty icon={CircleHelp} title="Sin preguntas todavía" action={<Button variant="primary" icon={Plus} onClick={() => setEdit({ ...NEW_FAQ })}>Escribir la primera</Button>}>
            Por ejemplo: ¿cómo hago mi pedido?, ¿hacen envíos?, ¿qué formas de pago aceptan?
          </Empty>
        ) : (
          <div class="list">
            {list.map((f, i) => (
              <div class={cx('list__row faq-row', f.active === false && 'is-off')} style={{ '--inset': '58px' }}>
                <span class="faq-row__num">{i + 1}</span>
                <button type="button" class="faq-row__main" onClick={() => setEdit(f)}>
                  <span class="faq-row__q">{f.question} {f.active === false && <Badge icon={EyeOff}>Oculta</Badge>}</span>
                  <span class="faq-row__a">{f.answer}</span>
                </button>
                <MoveButtons i={i} n={list.length} onMove={move} label="pregunta" />
                <Switch checked={f.active !== false} onChange={(v) => toggle(f, v)} label="Mostrar en la tienda" />
                <Menu items={[
                  { label: 'Editar', icon: Pencil, onClick: () => setEdit(f) },
                  '-',
                  { label: 'Eliminar', icon: Trash2, danger: true, onClick: () => remove(f) },
                ]} />
              </div>
            ))}
          </div>
        )}
      </Card>
      <FaqSheet faq={edit} onClose={(saved) => { setEdit(null); if (saved) onSaved?.(); }} />
    </>
  );
}

function FaqSheet({ faq, onClose }) {
  const [d, setD] = useState(NEW_FAQ);
  const [busy, setBusy] = useState(false);
  useEffect(() => { if (faq) setD(structuredClone(faq)); }, [faq]);
  const set = (p) => setD((x) => ({ ...x, ...p }));
  const save = async () => {
    setBusy(true);
    try {
      await api.content.saveFaq(d);
      invalidate('content');
      toast({ title: d.id ? 'Pregunta actualizada' : 'Pregunta agregada' });
      onClose(true);
    } catch (err) {
      toastError(err, 'No se pudo guardar');
    } finally {
      setBusy(false);
    }
  };
  return (
    <Sheet
      open={!!faq}
      onClose={() => onClose(false)}
      title={d.id ? 'Editar pregunta' : 'Nueva pregunta'}
      footer={<><Button variant="ghost" onClick={() => onClose(false)}>Cancelar</Button><Button variant="primary" loading={busy} onClick={save}>{d.id ? 'Guardar cambios' : 'Agregar'}</Button></>}
    >
      <div class="stack">
        <TextField label="Pregunta" value={d.question} onValue={(v) => set({ question: v })} placeholder="¿Hacen envíos a todo el país?" maxLength={200} />
        <TextField label="Respuesta" multiline rows={6} value={d.answer} onValue={(v) => set({ answer: v })} maxLength={1500} hint="Clara y corta. Puedes usar varios renglones." />
        <div class="list card card--flat">
          <SwitchRow title="Mostrar en la tienda" checked={d.active !== false} onChange={(v) => set({ active: v })} />
        </div>
      </div>
    </Sheet>
  );
}
