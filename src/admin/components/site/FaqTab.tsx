/** Preguntas frecuentes de la portada: escribir, ordenar y ocultar. */
import { useEffect, useState } from 'react';
import { CircleHelp, EyeOff, Pencil, Plus, Trash2 } from 'lucide-react';
import type { Faq } from '@/lib/types';
import { api } from '../../api';
import { invalidate } from '../../lib/query';
import { Button, Switch, SwitchRow, TextField, cx } from '../../ui/controls';
import { Sheet, confirmDialog, toast, toastError } from '../../ui/overlays';
import { Badge, Card, Empty, Menu, SkeletonRows } from '../../ui/surfaces';
import { MoveButtons, useOrdered } from './shared';

const NEW_FAQ: Faq = { question: '', answer: '', active: true };

export function FaqTab({
  data,
  loading,
  onSaved,
}: {
  data: { faq: Faq[] } | undefined;
  loading: boolean;
  onSaved?: () => void;
}) {
  const [list, move] = useOrdered(
    data?.faq,
    (f) => f.id || '',
    (ids) => api.content.reorderFaq(ids),
  );
  const [edit, setEdit] = useState<Faq | null>(null);
  const visible = list.filter((f) => f.active !== false).length;

  const toggle = async (f: Faq, active: boolean) => {
    try {
      await api.content.saveFaq({ ...f, active });
      invalidate('content');
      onSaved?.();
    } catch (err) {
      toastError(err);
    }
  };
  const remove = async (f: Faq) => {
    if (!f.id) return;
    const ok = await confirmDialog({
      title: '¿Eliminar esta pregunta?',
      message: f.question,
      confirm: 'Eliminar',
      danger: true,
    });
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
      <div className="tab-intro">
        <p className="muted">
          {list.length ? `${visible} de ${list.length} visibles. ` : ''}Responde aquí las dudas que más te hacen por
          WhatsApp: ahorras tiempo y das confianza.
        </p>
        <Button variant="primary" icon={Plus} onClick={() => setEdit({ ...NEW_FAQ })}>
          Nueva pregunta
        </Button>
      </div>
      <Card bodyClass={false}>
        {loading ? (
          <SkeletonRows rows={5} thumb={false} />
        ) : !list.length ? (
          <Empty
            icon={CircleHelp}
            title="Sin preguntas todavía"
            action={
              <Button variant="primary" icon={Plus} onClick={() => setEdit({ ...NEW_FAQ })}>
                Escribir la primera
              </Button>
            }
          >
            Por ejemplo: ¿cómo hago mi pedido?, ¿hacen envíos?, ¿qué formas de pago aceptan?
          </Empty>
        ) : (
          <div className="list">
            {list.map((f, i) => (
              <div
                key={f.id}
                className={cx('list__row faq-row', f.active === false && 'is-off')}
                style={{ '--inset': '58px' }}
              >
                <span className="faq-row__num">{i + 1}</span>
                <button type="button" className="faq-row__main" onClick={() => setEdit(f)}>
                  <span className="faq-row__q">
                    {f.question} {f.active === false && <Badge icon={EyeOff}>Oculta</Badge>}
                  </span>
                  <span className="faq-row__a">{f.answer}</span>
                </button>
                <MoveButtons i={i} n={list.length} onMove={(from, to) => void move(from, to)} label="pregunta" />
                <Switch checked={f.active !== false} onChange={(v) => void toggle(f, v)} label="Mostrar en la tienda" />
                <Menu
                  items={[
                    { label: 'Editar', icon: Pencil, onClick: () => setEdit(f) },
                    '-',
                    { label: 'Eliminar', icon: Trash2, danger: true, onClick: () => void remove(f) },
                  ]}
                />
              </div>
            ))}
          </div>
        )}
      </Card>
      <FaqSheet
        faq={edit}
        onClose={(saved) => {
          setEdit(null);
          if (saved) onSaved?.();
        }}
      />
    </>
  );
}

function FaqSheet({ faq, onClose }: { faq: Faq | null; onClose: (saved: boolean) => void }) {
  const [d, setD] = useState<Faq>(NEW_FAQ);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (faq) setD(structuredClone(faq));
  }, [faq]);
  const set = (p: Partial<Faq>) => setD((x) => ({ ...x, ...p }));
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
      footer={
        <>
          <Button variant="ghost" onClick={() => onClose(false)}>
            Cancelar
          </Button>
          <Button variant="primary" loading={busy} onClick={() => void save()}>
            {d.id ? 'Guardar cambios' : 'Agregar'}
          </Button>
        </>
      }
    >
      <div className="stack">
        <TextField
          label="Pregunta"
          value={d.question}
          onValue={(v) => set({ question: v })}
          placeholder="¿Hacen envíos a todo el país?"
          maxLength={200}
        />
        <TextField
          label="Respuesta"
          multiline
          rows={6}
          value={d.answer}
          onValue={(v) => set({ answer: v })}
          maxLength={1500}
          hint="Clara y corta. Puedes usar varios renglones."
        />
        <div className="list card card--flat">
          <SwitchRow title="Mostrar en la tienda" checked={d.active !== false} onChange={(v) => set({ active: v })} />
        </div>
      </div>
    </Sheet>
  );
}
