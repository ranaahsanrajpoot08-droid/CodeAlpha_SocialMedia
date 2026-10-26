import { imageUrl } from '../utils/helpers.js';

// Shows the profile picture, or a coloured circle with the first letter.
// Pass online={true/false} to show a small green "online" dot (leave it out to show no dot).
const Avatar = ({ user, size = 44, online }) => {
  const src = imageUrl(user?.profile_image);
  const style = { width: size, height: size, fontSize: size * 0.42 };

  let circle;
  if (src) {
    circle = <img className="avatar" style={style} src={src} alt={user?.username || 'avatar'} />;
  } else {
    const letter = (user?.name || user?.username || '?').charAt(0).toUpperCase();
    circle = (
      <div className="avatar avatar-fallback" style={style}>
        {letter}
      </div>
    );
  }

  if (online === undefined) return circle;

  return (
    <span className="avatar-wrap" style={{ width: size, height: size }}>
      {circle}
      {online && <span className="online-dot" title="Online" />}
    </span>
  );
};

export default Avatar;
