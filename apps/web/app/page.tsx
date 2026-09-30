import Link from 'next/link';

const modules = [
  ['01', 'Emisión de comprobantes', 'Facturas, notas de crédito, notas de débito y guías de remisión.'],
  ['02', 'Retenciones recibidas', 'Carga de XML y relación con tus facturas.'],
  ['03', 'Reportería', 'Ventas, documentos y consumo de tu empresa.'],
];

export default function Home() {
  return <main>
    <header><Link className="brand" href="/">Q<span>QuickFact</span></Link><span className="badge">EN DESARROLLO</span></header>
    <section className="hero">
      <p className="eyebrow">FACTURACIÓN ELECTRÓNICA · ECUADOR</p>
      <h1>Tu empresa.<br /><span>Tus cuentas claras.</span></h1>
      <p className="intro">Un espacio para emitir comprobantes, organizar retenciones y entender las ventas de tu empresa.</p>
      <div className="notice"><span className="dot" /><div><strong>Estamos preparando QuickFact</strong><p>El acceso y la emisión de comprobantes estarán disponibles cuando completemos las validaciones.</p></div></div>
    </section>
    <section className="modules" aria-label="Módulos previstos">{modules.map(([number, title, description]) =>
      <article key={number}><span className="number">{number}</span><h2>{title}</h2><p>{description}</p><span className="soon">Próximamente</span></article>
    )}</section>
    <footer><span>QuickFact</span><span>Una base para crecer con tu empresa.</span></footer>
  </main>;
}
