import Navbar from './components/Navbar';
import Hero from './components/Hero';
import Marquee from './components/Marquee';
import Services from './components/Services';
import WhyUs from './components/WhyUs';
import Locations from './components/Locations';
import Contact from './components/Contact';
import Footer from './components/Footer';
import Jadwal from './pages/Jadwal';

const isJadwal = window.location.pathname === '/jadwal-bimbel';

export default function App() {
  if (isJadwal) return <Jadwal />;

  return (
    <>
      <Navbar />
      <main>
        <Hero />
        <Marquee />
        <Services />
        <WhyUs />
        <Locations />
        <Contact />
      </main>
      <Footer />
    </>
  );
}
