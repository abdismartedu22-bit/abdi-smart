import Navbar from '../../components/Navbar';
import Hero from '../../components/Hero';
import Marquee from '../../components/Marquee';
import Services from '../../components/Services';
import WhyUs from '../../components/WhyUs';
import Testimonials from '../../components/Testimonials';
import Locations from '../../components/Locations';
import Contact from '../../components/Contact';
import Footer from '../../components/Footer';

export default function Home() {
  return (
    <>
      <Navbar />
      <main>
        <Hero />
        <Marquee />
        <Services />
        <WhyUs />
        <Testimonials />
        <Locations />
        <Contact />
      </main>
      <Footer />
    </>
  );
}
