import Concept from "./Concept";

export default function Hero() {
  return (
    <section id="home" className="on-dark overflow-hidden bg-navy text-white" aria-labelledby="hero-title">
      <div className="container-x grid items-center gap-12 py-16 sm:py-24 lg:grid-cols-[1.15fr_1fr] lg:py-28">
        <div>
          <p className="hero-in text-sm font-medium text-pale" style={{ "--d": "0ms" } as React.CSSProperties}>MYRONIX INDUSTRIES &nbsp;|&nbsp; Technology • Digital • Creative</p>
          <h1 id="hero-title" className="hero-in mt-5 text-[3rem] font-semibold uppercase leading-[0.98] tracking-tight sm:text-7xl" style={{ "--d": "100ms" } as React.CSSProperties}>
            We design.<br />We build.<br />We create.
          </h1>
          <p className="hero-in mt-6 max-w-xl text-lg text-white/80" style={{ "--d": "200ms" } as React.CSSProperties}>
            MYRONIX combines creative design with digital technology: brand visuals, websites, applications and video, built as one consistent system.
          </p>
          <div className="hero-in mt-9 flex flex-col gap-3 sm:flex-row" style={{ "--d": "300ms" } as React.CSSProperties}>
            <a href="#enquiry" className="btn btn-primary">START A PROJECT</a>
            <a href="#services" className="btn btn-ghost-dark">VIEW SERVICES</a>
          </div>
        </div>
        <div className="hero-in relative mx-auto aspect-[4/3.4] w-full max-w-md lg:max-w-none" style={{ "--d": "250ms" } as React.CSSProperties} aria-hidden="true">
          <div className="float-a absolute left-0 top-0 w-[78%] overflow-hidden rounded-md shadow-2xl ring-1 ring-white/10"><Concept kind="browser" className="block h-auto w-full" /></div>
          <div className="float-b absolute bottom-0 right-[4%] w-[34%] overflow-hidden rounded-md shadow-2xl ring-1 ring-white/10"><Concept kind="phone" className="block h-auto w-full" /></div>
          <div className="float-b absolute bottom-[2%] left-[6%] w-[36%] overflow-hidden rounded-md shadow-2xl ring-1 ring-white/10"><Concept kind="poster" className="block h-auto w-full" /></div>
        </div>
      </div>
    </section>
  );
}
