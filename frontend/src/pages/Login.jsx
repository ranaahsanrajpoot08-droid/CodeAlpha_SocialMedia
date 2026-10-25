import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { useToast } from '../context/ToastContext.jsx';
import { getErrorMessage, getFieldErrors } from '../services/api.js';

const Login = () => {
  const { login } = useAuth();
  const { showToast } = useToast();
  const navigate = useNavigate();

  const [form, setForm] = useState({ identifier: '', password: '' });
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
    setErrors({ ...errors, [e.target.name]: '' });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setFormError('');

    const clientErrors = {};
    if (!form.identifier.trim()) clientErrors.identifier = 'Email or username is required';
    if (!form.password) clientErrors.password = 'Password is required';
    if (Object.keys(clientErrors).length) return setErrors(clientErrors);

    setLoading(true);
    try {
      await login(form);
      showToast('Welcome back!');
      navigate('/');
    } catch (error) {
      setErrors(getFieldErrors(error));
      setFormError(getErrorMessage(error));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-page">
      <form className="auth-card" onSubmit={handleSubmit} noValidate>
        <h1 className="logo big">Social<span>Connect</span></h1>
        <p className="muted center">Log in to see what your friends are up to.</p>

        {formError && <div className="alert alert-error">{formError}</div>}

        <label>
          Email or username
          <input name="identifier" value={form.identifier} onChange={handleChange} placeholder="ali or ali@example.com" autoFocus />
          {errors.identifier && <span className="field-error">{errors.identifier}</span>}
        </label>

        <label>
          Password
          <input type="password" name="password" value={form.password} onChange={handleChange} placeholder="Your password" />
          {errors.password && <span className="field-error">{errors.password}</span>}
        </label>

        <button className="btn btn-primary btn-block" disabled={loading}>
          {loading ? 'Logging in...' : 'Log in'}
        </button>

        <p className="center muted">
          New here? <Link to="/register">Create an account</Link>
        </p>
        <p className="center muted small">Demo: <b>ali</b> / <b>password123</b></p>
      </form>
    </div>
  );
};

export default Login;
