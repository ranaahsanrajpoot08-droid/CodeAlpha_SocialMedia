import { useRef, useState } from 'react';
import { createPost, getErrorMessage } from '../services/api.js';
import { useAuth } from '../context/AuthContext.jsx';
import { useToast } from '../context/ToastContext.jsx';
import Avatar from './Avatar.jsx';

const MAX = 1000;

// Text area + image upload + Post button.
const CreatePost = ({ onCreated }) => {
  const { user } = useAuth();
  const { showToast } = useToast();
  const [content, setContent] = useState('');
  const [image, setImage] = useState(null);
  const [preview, setPreview] = useState(null);
  const [posting, setPosting] = useState(false);
  const fileRef = useRef(null);

  const handleImage = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      showToast('Image is too large (max 5MB)', 'error');
      e.target.value = '';
      return;
    }
    setImage(file);
    setPreview(URL.createObjectURL(file));
  };

  const removeImage = () => {
    setImage(null);
    setPreview(null);
    if (fileRef.current) fileRef.current.value = '';
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!content.trim() && !image) {
      showToast('Write something or add an image first', 'error');
      return;
    }
    const formData = new FormData();
    formData.append('content', content);
    if (image) formData.append('image', image);

    setPosting(true);
    try {
      const data = await createPost(formData);
      onCreated(data.post);
      setContent('');
      removeImage();
      showToast('Post created!');
    } catch (error) {
      showToast(getErrorMessage(error), 'error');
    } finally {
      setPosting(false);
    }
  };

  return (
    <form className="card create-post" onSubmit={handleSubmit}>
      <div className="create-post-row">
        <Avatar user={user} size={44} />
        <textarea
          placeholder={`What's on your mind, ${user.name.split(' ')[0]}?`}
          value={content}
          maxLength={MAX}
          rows={3}
          onChange={(e) => setContent(e.target.value)}
        />
      </div>

      {preview && (
        <div className="image-preview">
          <img src={preview} alt="Preview" />
          <button type="button" className="remove-image" onClick={removeImage} aria-label="Remove image">✕</button>
        </div>
      )}

      <div className="create-post-actions">
        <label className="btn btn-ghost">
          📷 Photo
          <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/gif,image/webp" hidden onChange={handleImage} />
        </label>
        <span className="muted char-count">{content.length}/{MAX}</span>
        <button className="btn btn-primary" disabled={posting}>
          {posting ? 'Posting...' : 'Post'}
        </button>
      </div>
    </form>
  );
};

export default CreatePost;
