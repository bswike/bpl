import { Fragment, useEffect } from 'react';
import { NavLink, Route, Routes, useLocation } from 'react-router-dom';
import About from './About';
import Game from './Game';
import Player from './Player';
import Resume from './Resume';
import Team from './Team';
import { Control, Ratings } from './pages';
import './cfb.css';

const NAV = [
  ['/cfb', 'Ratings', true],
  ['/cfb/control', 'Game Control'],
  ['/cfb/resume', 'Resume Builder'],
  // ['/cfb/about', 'About'], hidden from the nav for now; the page still works at /cfb/about
];

export default function CfbApp() {
  const { pathname } = useLocation();

  // The rest of the site paints a dark body; this section is plain white.
  useEffect(() => {
    const prev = document.body.style.backgroundColor;
    document.body.style.backgroundColor = '#fff';
    return () => { document.body.style.backgroundColor = prev; };
  }, []);

  useEffect(() => {
    if (!pathname.startsWith('/cfb/team/') && !pathname.startsWith('/cfb/game/') && !pathname.startsWith('/cfb/player/')) document.title = 'CFB 2026 Team Metrics';
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
      </header>
      <main>
        <Routes>
          <Route index element={<Ratings />} />
          <Route path="control" element={<Control />} />
          <Route path="resume" element={<Resume />} />
          <Route path="team/:id" element={<Team />} />
          <Route path="game/:gameId" element={<Game />} />
          <Route path="player/:id" element={<Player />} />
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
