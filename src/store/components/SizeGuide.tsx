/** Guía de tallas americanas con equivalencias y medidas aproximadas. */
import { Icon } from './Icon';
import { Segmented } from './Segmented';

type Dept = 'mujer' | 'kids' | 'hombre';

const TABLES: Record<Dept, { label: string; blocks: { title: string; head: string[]; rows: string[][] }[] }> = {
  mujer: {
    label: 'Mujer',
    blocks: [
      {
        title: 'Vestidos, blusas, suéteres y abrigos',
        head: ['Talla EE. UU.', 'Numérica', 'Equivale a', 'Busto (cm)', 'Cintura (cm)', 'Cadera (cm)'],
        rows: [
          ['XS', '0–2', 'Extra chica', '81–84', '61–64', '86–89'],
          ['S', '4–6', 'Chica', '86–89', '66–69', '91–94'],
          ['M', '8–10', 'Mediana', '91–94', '71–74', '97–99'],
          ['L', '12–14', 'Grande', '98–102', '79–83', '104–108'],
          ['XL', '16–18', 'Extra grande', '107–112', '88–93', '113–118'],
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
        head: ['Talla EE. UU.', 'Equivale a', 'Pecho (cm)', 'Cintura (cm)', 'Cuello (cm)'],
        rows: [
          ['S', 'Chica', '88–94', '73–79', '36–37'],
          ['M', 'Mediana', '96–102', '81–86', '38–39'],
          ['L', 'Grande', '104–110', '89–94', '40–41'],
          ['XL', 'Extra grande', '112–118', '97–102', '42–43'],
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

export function SizeGuide({ dept, onDept }: { dept: Dept; onDept: (d: Dept) => void }) {
  const t = TABLES[dept];
  return (
    <>
      <Segmented
        label="Departamento"
        value={dept}
        onChange={(v) => onDept(v as Dept)}
        options={(Object.keys(TABLES) as Dept[]).map((k) => ({ value: k, label: TABLES[k].label }))}
      />
      <div className="stack" style={{ '--stack': '22px' }}>
        {t.blocks.map((b) => (
          <div key={b.title} className="stack" style={{ '--stack': '10px' }}>
            <h3 className="h-4">{b.title}</h3>
            <div className="table-wrap">
              <table className="size-table">
                <thead>
                  <tr>
                    {b.head.map((h) => (
                      <th key={h} scope="col">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {b.rows.map((r) => (
                    <tr key={r[0]}>
                      {r.map((c, i) => (
                        <td key={i}>{c}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ))}
      </div>
      <p className="sizes__note">
        <Icon name="info" />
        Medidas aproximadas de referencia para tallas americanas. Cada marca puede variar un poco: pídenos por WhatsApp
        las medidas exactas de la prenda que te gusta.
      </p>
    </>
  );
}
