/** Guía de tallas americanas con equivalencias y medidas aproximadas. */
import { html, render } from '../core/dom.js';
import { sheet } from './sheet.js';
import { segmented } from './segmented.js';

const TABLES = {
  mujer: {
    label: 'Mujer',
    blocks: [
      {
        title: 'Vestidos, blusas, suéteres y abrigos',
        head: ['Talla EE. UU.', 'Numérica', 'México', 'Busto (cm)', 'Cintura (cm)', 'Cadera (cm)'],
        rows: [
          ['XS', '0–2', 'ECH', '81–84', '61–64', '86–89'],
          ['S', '4–6', 'CH', '86–89', '66–69', '91–94'],
          ['M', '8–10', 'M', '91–94', '71–74', '97–99'],
          ['L', '12–14', 'G', '98–102', '79–83', '104–108'],
          ['XL', '16–18', 'EG', '107–112', '88–93', '113–118'],
        ],
      },
      {
        title: 'Jeans y pantalones',
        head: ['Talla EE. UU.', 'Cintura (pulgadas)', 'Cintura (cm)', 'Cadera (cm)'],
        rows: [
          ['2', '25', '63–65', '88–90'],
          ['4', '26', '66–68', '91–93'],
          ['6', '27–28', '69–71', '94–96'],
          ['8', '29', '72–74', '97–99'],
          ['10', '30–31', '76–79', '101–104'],
          ['12', '32–33', '81–84', '106–109'],
        ],
      },
    ],
  },
  kids: {
    label: 'Niñas y niños',
    blocks: [
      {
        title: 'Tallas infantiles',
        head: ['Talla EE. UU.', 'Edad aprox.', 'Estatura (cm)', 'Peso (kg)'],
        rows: [
          ['2T', '2 años', '86–91', '12–13'],
          ['3T', '3 años', '94–99', '14–15'],
          ['4T', '4 años', '99–104', '16–17'],
          ['5', '5 años', '107–114', '18–20'],
          ['6', '6 años', '114–122', '20–23'],
          ['8', '7–8 años', '122–132', '23–29'],
          ['10', '9–10 años', '132–142', '29–36'],
          ['12', '11–12 años', '142–152', '36–43'],
        ],
      },
    ],
  },
  hombre: {
    label: 'Hombre',
    blocks: [
      {
        title: 'Camisas, polos, suéteres y chamarras',
        head: ['Talla EE. UU.', 'México', 'Pecho (cm)', 'Cintura (cm)', 'Cuello (cm)'],
        rows: [
          ['S', 'CH', '88–94', '73–79', '36–37'],
          ['M', 'M', '96–102', '81–86', '38–39'],
          ['L', 'G', '104–110', '89–94', '40–41'],
          ['XL', 'EG', '112–118', '97–102', '42–43'],
        ],
      },
      {
        title: 'Pantalones',
        head: ['Talla EE. UU.', 'Cintura (cm)', 'Cadera (cm)'],
        rows: [
          ['30', '76', '94–96'],
          ['32', '81', '99–101'],
          ['34', '86', '104–106'],
          ['36', '91', '109–111'],
        ],
      },
    ],
  },
};

let root, seg, current = 'mujer';

function paint() {
  const t = TABLES[current];
  root.querySelector('[data-size-tables]').innerHTML = t.blocks.map((b) => `
    <div class="stack" style="--stack:10px">
      <h3 class="h-4">${b.title}</h3>
      <div class="table-wrap">
        <table class="size-table">
          <thead><tr>${b.head.map((h) => `<th scope="col">${h}</th>`).join('')}</tr></thead>
          <tbody>${b.rows.map((r) => `<tr>${r.map((c) => `<td>${c}</td>`).join('')}</tr>`).join('')}</tbody>
        </table>
      </div>
    </div>`).join('');
}

export function openSizeGuide(department = 'mujer') {
  current = department === 'ninas' || department === 'ninos' ? 'kids' : department === 'hombre' ? 'hombre' : 'mujer';
  sheet('sizes')?.open();
  seg?.select(current, 'tab');
  requestAnimationFrame(() => seg?.refresh());
  paint();
}

export function initSizeGuide() {
  root = document.querySelector('[data-sizes]');
  if (!root) return;
  render(root, html`
    <div class="segmented glass pill" role="tablist" aria-label="Departamento" data-size-tabs>
      <span class="segmented__thumb" aria-hidden="true"></span>
      ${Object.entries(TABLES).map(([k, v], i) => html`<button class="segmented__btn" role="tab" aria-selected="${String(i === 0)}" data-tab="${k}">${v.label}</button>`)}
    </div>
    <div class="stack" style="--stack:22px" data-size-tables></div>
    <p class="sizes__note"><svg class="icon" aria-hidden="true"><use href="#i-info"></use></svg>Medidas aproximadas de referencia para tallas americanas. Cada marca puede variar un poco: pídenos por WhatsApp las medidas exactas de la prenda que te gusta.</p>
  `);
  seg = segmented(root.querySelector('[data-size-tabs]'), {
    onChange: (btn) => { current = btn.dataset.tab; paint(); },
  });
  paint();
}
