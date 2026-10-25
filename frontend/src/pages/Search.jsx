import { useEffect, useState } from 'react';
import UserCard from '../components/UserCard.jsx';
import Loading from '../components/Loading.jsx';
import { searchUsers, getErrorMessage } from '../services/api.js';

const Search = () => {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [searched, setSearched] = useState(false);

  // Wait 400ms after the user stops typing, then search ("debounce").
  useEffect(() => {
    const q = query.trim();
    if (!q) {
      setResults([]);
      setSearched(false);
      setError('');
      return;
    }
    setLoading(true);
    const timer = setTimeout(async () => {
      try {
        const data = await searchUsers(q);
        setResults(data.users);
        setError('');
      } catch (err) {
        setError(getErrorMessage(err));
      } finally {
        setSearched(true);
        setLoading(false);
      }
    }, 400);
    return () => clearTimeout(timer);
  }, [query]);

  return (
    <div className="narrow">
      <div className="card">
        <h2>Search people</h2>
        <input
          className="search-input"
          type="search"
          placeholder="Search by name or username..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          autoFocus
        />
      </div>

      {loading && <Loading text="Searching..." />}
      {error && <div className="alert alert-error">{error}</div>}

      {!loading && searched && !error && results.length === 0 && (
        <div className="card empty">
          <h3>No users found</h3>
          <p className="muted">Try a different name or username.</p>
        </div>
      )}

      {!loading && results.length > 0 && (
        <div className="card">
          {results.map((u) => (
            <UserCard key={u.id} user={u} />
          ))}
        </div>
      )}

      {!query.trim() && <p className="muted center">Type a name or username to find people.</p>}
    </div>
  );
};

export default Search;
