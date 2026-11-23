import { Fragment, useEffect } from 'react';
import { NavLink, Route, Routes, useLocation } from 'react-router-dom';
import About from './About';
import Team from './Team';
import { Control, Ratings, Splits } from './pages';
import { useCfb } from './data';
import { AsOf } from './ui';
import './cfb.css';

const NAV = [
  ['/cfb', 'Ratings', true],
  ['/cfb/control', 'Game Control'],
  ['/cfb/splits', 'Home/Away'],
  ['/cfb/about', 'About'],
];

export default function CfbApp() {
  const { data } = useCfb('meta');
  const { pathname } = useLocation();

  // The rest of the site paints a dark body; this section is plain white.
  useEffect(() => {
    const prev = document.body.style.backgroundColor;
    document.body.style.backgroundColor = '#fff';
    return () => { document.body.style.backgroundColor = prev; };
  }, []);

  useEffect(() => {
    if (!pathname.startsWith('/cfb/team/')) document.title = 'CFB 2026 Team Metrics';
  }, [pathname]);

  return (
    <div className="cfb">
      <header>
        <h1>
          <NavLink to="/cfb" end>CFB 2026 Team Metrics</NavLink>
        </h1>
        <nav className="links">
          {NAV.map(([to, label, end], i) => (
            <Fragment key={to}>
              {i > 0 && ' | '}
              <NavLink to={to} end={end} className={({ isActive }) => (isActive ? 'on' : undefined)}>
                {label}
              </NavLink>
            </Fragment>
          ))}
        </nav>
        <AsOf meta={data?.meta} />
      </header>
      <main>
        <Routes>
          <Route index element={<Ratings />} />
          <Route path="control" element={<Control />} />
          <Route path="splits" element={<Splits />} />
          <Route path="team/:id" element={<Team />} />
          <Route path="about" element={<About />} />
          <Route path="*" element={<Ratings />} />
        </Routes>
      </main>
      <footer>
        Data: ESPN via sportsdataverse cfbfastR · AP poll · CFP committee · 247Sports Team Talent Composite. Not affiliated
        with any of them.
      </footer>
    </div>
  );
}
