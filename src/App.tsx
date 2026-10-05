import AdminDashboard from "./components/AdminDashboard";
import { useCallback, useState } from "react";
import Navbar from "./components/Navbar";
import Hero from "./components/Hero";
import About from "./components/About";
import Services from "./components/Services";
import Portfolio from "./components/Portfolio";
import EnquiryForm, { type Prefill } from "./components/EnquiryForm";
import Process from "./components/Process";
import Collaboration from "./components/Collaboration";
import Contact from "./components/Contact";
import Footer from "./components/Footer";

export default function App() {
  const [prefill, setPrefill] = useState<Prefill | null>(null);

  const goToEnquiry = useCallback((service = "", projectType = "") => {
    setPrefill({ service, projectType, nonce: Date.now() });
    // wait a frame so the modal has closed and focus is released
    window.setTimeout(() => {
      const el = document.getElementById("enquiry");
      el?.scrollIntoView({ behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" });
      document.getElementById(service ? "requirements" : "service")?.focus({ preventScroll: true });
    }, 60);
  }, []);

  if (window.location.pathname === "/admin") {
  return <AdminDashboard />;
}
  return (
    <>
      <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-50 focus:rounded-md focus:bg-white focus:px-4 focus:py-2">Skip to content</a>
      <Navbar />
      <main id="main">
        <Hero />
        <About />
        <Services onEnquire={goToEnquiry} />
        <Portfolio onEnquire={() => goToEnquiry()} />
        <Process />
        <Collaboration />
        <EnquiryForm prefill={prefill} />
        <Contact />
      </main>
      <Footer />
    </>
  );
}
