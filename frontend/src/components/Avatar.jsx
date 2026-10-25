import { imageUrl } from '../utils/helpers.js';

// Shows the profile picture, or a coloured circle with the first letter.
const Avatar = ({ user, size = 44 }) => {
  const src = imageUrl(user?.profile_image);
  const style = { width: size, height: size, fontSize: size * 0.42 };

  if (src) return <img className="avatar" style={style} src={src} alt={user?.username || 'avatar'} />;

  const letter = (user?.name || user?.username || '?').charAt(0).toUpperCase();
  return (
    <div className="avatar avatar-fallback" style={style}>
      {letter}
    </div>
  );
};

export default Avatar;
