import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { useToast } from '../context/ToastContext.jsx';
import { updateProfile, fetchUser, getErrorMessage, getFieldErrors } from '../services/api.js';
import { imageUrl } from '../utils/helpers.js';
import Avatar from '../components/Avatar.jsx';
import Loading from '../components/Loading.jsx';

const EditProfile = () => {
  const { user, updateUser } = useAuth();
  const { showToast } = useToast();
  const navigate = useNavigate();

  const [form, setForm] = useState({ name: '', username: '', bio: '' });
  const [image, setImage] = useState(null);
  const [preview, setPreview] = useState(null);
  const [removeImage, setRemoveImage] = useState(false);
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // /auth/me does not include everything we need, so load the full profile.
  useEffect(() => {
    fetchUser(user.id)
      .then((data) => setForm({ name: data.user.name, username: data.user.username, bio: data.user.bio || '' }))
      .catch((err) => setFormError(getErrorMessage(err)))
      .finally(() => setLoading(false));
  }, [user.id]);

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
    setErrors({ ...errors, [e.target.name]: '' });
  };

  const handleImage = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      showToast('Image is too large (max 5MB)', 'error');
      return;
    }
    setImage(file);
    setPreview(URL.createObjectURL(file));
    setRemoveImage(false);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setFormError('');

    const clientErrors = {};
    if (!form.name.trim()) clientErrors.name = 'Name is required';
    if (!/^[a-zA-Z0-9_]{3,30}$/.test(form.username.trim())) clientErrors.username = 'Use 3-30 letters, numbers or underscore';
    if (form.bio.length > 300) clientErrors.bio = 'Bio must be 300 characters or less';
    if (Object.keys(clientErrors).length) return setErrors(clientErrors);

    const formData = new FormData();
    formData.append('name', form.name);
    formData.append('username', form.username);
    formData.append('bio', form.bio);
    if (image) formData.append('profile_image', image);
    if (removeImage) formData.append('remove_image', 'true');

    setSaving(true);
    try {
      const data = await updateProfile(user.id, formData);
      updateUser({
        name: data.user.name,
        username: data.user.username,
        bio: data.user.bio,
        profile_image: data.user.profile_image,
      });
      showToast('Profile updated!');
      navigate(`/profile/${user.id}`);
    } catch (error) {
      setErrors(getFieldErrors(error));
      setFormError(getErrorMessage(error));
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <Loading />;

  const shownUser = {
    ...user,
    name: form.name || user.name,
    profile_image: removeImage ? null : user.profile_image,
  };

  return (
    <div className="narrow">
      <form className="card form-card" onSubmit={handleSubmit} noValidate>
        <h2>Edit profile</h2>
        {formError && <div className="alert alert-error">{formError}</div>}

        <div className="avatar-edit">
          {preview ? (
            <img className="avatar" style={{ width: 96, height: 96 }} src={preview} alt="New profile" />
          ) : (
            <Avatar user={shownUser} size={96} />
          )}
          <div className="avatar-edit-buttons">
            <label className="btn btn-outline">
              Change picture
              <input type="file" accept="image/png,image/jpeg,image/gif,image/webp" hidden onChange={handleImage} />
            </label>
            {(user.profile_image || preview) && !removeImage && (
              <button
                type="button"
                className="btn btn-ghost"
                onClick={() => {
                  setRemoveImage(true);
                  setImage(null);
                  setPreview(null);
                }}
              >
                Remove
              </button>
            )}
          </div>
        </div>

        <label>
          Name
          <input name="name" value={form.name} onChange={handleChange} />
          {errors.name && <span className="field-error">{errors.name}</span>}
        </label>

        <label>
          Username
          <input name="username" value={form.username} onChange={handleChange} />
          {errors.username && <span className="field-error">{errors.username}</span>}
        </label>

        <label>
          Bio
          <textarea name="bio" rows={4} maxLength={300} value={form.bio} onChange={handleChange} placeholder="Tell people about yourself" />
          <span className="muted small">{form.bio.length}/300</span>
          {errors.bio && <span className="field-error">{errors.bio}</span>}
        </label>

        <div className="form-actions">
          <button type="button" className="btn btn-outline" onClick={() => navigate(`/profile/${user.id}`)}>Cancel</button>
          <button className="btn btn-primary" disabled={saving}>{saving ? 'Saving...' : 'Save changes'}</button>
        </div>
      </form>
    </div>
  );
};

export default EditProfile;
