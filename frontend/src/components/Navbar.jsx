import { useState } from 'react';
import { NavLink, Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { useSocket } from '../context/SocketContext.jsx';
import Avatar from './Avatar.jsx';

const Navbar = () => {
  const { user, logout } = useAuth();
  const { unreadCount } = useSocket();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false); // mobile menu

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const close = () => setOpen(false);

  return (
    <header className="navbar">
      <div className="navbar-inner">
        <Link to="/" className="logo" onClick={close}>
          Social<span>Connect</span>
        </Link>

        <button className="menu-toggle" onClick={() => setOpen(!open)} aria-label="Toggle menu">
          {open ? '✕' : '☰'}
        </button>

        <nav className={`nav-links ${open ? 'open' : ''}`}>
          <NavLink to="/" end onClick={close}>Home</NavLink>
          <NavLink to="/search" onClick={close}>Search</NavLink>
          <NavLink to="/messages" onClick={close}>
            💬 Messages
            {unreadCount > 0 && <span className="nav-badge">{unreadCount > 99 ? '99+' : unreadCount}</span>}
          </NavLink>
          <NavLink to={`/profile/${user.id}`} onClick={close} className="nav-profile">
            <Avatar user={user} size={26} /> Profile
          </NavLink>
          <button className="nav-logout" onClick={handleLogout}>Logout</button>
        </nav>
      </div>
    </header>
  );
};

export default Navbar;
