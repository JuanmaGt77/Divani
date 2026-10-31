/**
 * Hojas para crear o editar una categoría (con su foto de portada) y para editar un departamento.
 * Las usan la sección Categorías y el editor de productos («Nueva categoría»).
 */
import { useEffect, useState } from 'react';
import type { Category, Department } from '@/lib/types';
import { api } from '../api';
import { invalidate } from '../lib/query';
import { Button, SelectField, SwitchRow, TextField } from '../ui/controls';
import { MediaField } from '../ui/media';
import { Sheet, toast, toastError } from '../ui/overlays';

export type CategoryDraft = Partial<Category> & { department: string };

export function CategorySheet({
  cat,
  deps,
  hasProducts,
  onClose,
}: {
  cat: CategoryDraft | null;
  deps: Department[];
  hasProducts?: boolean;
  /** Recibe la categoría guardada (o null si se canceló). */
  onClose: (saved: Category | null) => void;
}) {
  const [d, setD] = useState<CategoryDraft>({ department: 'mujer' });
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (cat) setD(structuredClone(cat));
  }, [cat]);
  const set = (p: Partial<CategoryDraft>) => setD((x) => ({ ...x, ...p }));
  const depName = deps.find((x) => x.slug === d.department)?.name || '';
  const save = async () => {
    setBusy(true);
    try {
      const saved = await api.catalog.saveCategory({ ...d, image: d.image || '' });
      invalidate('taxonomy');
      toast({ title: d.slug ? 'Categoría actualizada' : 'Categoría creada', sub: saved.name });
      onClose(saved);
    } catch (err) {
      toastError(err, 'No se pudo guardar');
    } finally {
      setBusy(false);
    }
  };
  return (
    <Sheet
      open={!!cat}
      onClose={() => onClose(null)}
      title={d.slug ? d.name || 'Categoría' : 'Nueva categoría'}
      sub={depName ? `Departamento ${depName}` : undefined}
      size="lg"
      footer={
        <>
          <Button variant="ghost" onClick={() => onClose(null)}>
            Cancelar
          </Button>
          <Button variant="primary" loading={busy} onClick={() => void save()}>
            {d.slug ? 'Guardar cambios' : 'Crear categoría'}
          </Button>
        </>
      }
    >
      <div className="cat-editor">
        <MediaField
          label="Foto de portada"
          value={d.image}
          onChange={(v) => set({ image: v })}
          aspect="4 / 5"
          folder="divani/categorias"
          hint="Vertical, 1200 × 1500 px."
        />
        <div className="stack">
          <TextField
            label="Nombre"
            value={d.name}
            onValue={(v) => set({ name: v })}
            placeholder="Ej. Shorts"
            maxLength={60}
            data-autofocus={!d.slug || undefined}
          />
          <SelectField
            label="Departamento"
            value={d.department}
            onValue={(v) => set({ department: v })}
            options={deps.map((x) => ({ value: x.slug, label: x.name }))}
            disabled={hasProducts}
            hint={
              hasProducts ? 'Tiene productos: para cambiarla de departamento, mueve primero sus productos.' : undefined
            }
          />
          <TextField
            label="Descripción"
            optional
            multiline
            rows={3}
            value={d.description}
            onValue={(v) => set({ description: v })}
            placeholder="Frescos y cómodos para todos los días."
            hint="Se muestra debajo del título cuando la clienta abre la categoría."
            maxLength={200}
          />
          <div className="list card card--flat">
            <SwitchRow
              title="Mostrar en la tienda"
              sub={
                d.active !== false
                  ? `Aparece como filtro en la tienda${depName ? ` (${depName})` : ''}`
                  : 'Oculta: sus productos se siguen encontrando con el buscador'
              }
              checked={d.active !== false}
              onChange={(v) => set({ active: v })}
            />
          </div>
        </div>
      </div>
    </Sheet>
  );
}

export function DepartmentSheet({ dep, onClose }: { dep: Department | null; onClose: (saved: boolean) => void }) {
  const [d, setD] = useState<Partial<Department>>({});
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (dep) setD(structuredClone(dep));
  }, [dep]);
  const set = (p: Partial<Department>) => setD((x) => ({ ...x, ...p }));
  const save = async () => {
    setBusy(true);
    try {
      await api.catalog.saveDepartment(d);
      invalidate('taxonomy');
      toast({ title: 'Departamento actualizado' });
      onClose(true);
    } catch (err) {
      toastError(err, 'No se pudo guardar');
    } finally {
      setBusy(false);
    }
  };
  return (
    <Sheet
      open={!!dep}
      onClose={() => onClose(false)}
      title={d.name || 'Departamento'}
      sub="Departamento de la tienda"
      size="lg"
      footer={
        <>
          <Button variant="ghost" onClick={() => onClose(false)}>
            Cancelar
          </Button>
          <Button variant="primary" loading={busy} onClick={() => void save()}>
            Guardar cambios
          </Button>
        </>
      }
    >
      <div className="cat-editor">
        <MediaField
          label="Foto"
          value={d.image}
          onChange={(v) => set({ image: v })}
          aspect="4 / 5"
          folder="divani/categorias"
          hint="Vertical, 1200 × 1500 px."
        />
        <div className="stack">
          <TextField label="Nombre" value={d.name} onValue={(v) => set({ name: v })} maxLength={60} />
          <TextField
            label="Descripción"
            optional
            multiline
            rows={3}
            value={d.description}
            onValue={(v) => set({ description: v })}
            maxLength={200}
          />
          <div className="list card card--flat">
            <SwitchRow
              title="Mostrar en la tienda"
              sub="Apágalo si por ahora no manejas este departamento"
              checked={d.active !== false}
              onChange={(v) => set({ active: v })}
            />
          </div>
        </div>
      </div>
    </Sheet>
  );
}
