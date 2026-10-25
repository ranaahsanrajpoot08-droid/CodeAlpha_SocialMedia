const Loading = ({ text = 'Loading...' }) => (
  <div className="loading">
    <div className="spinner" />
    <p>{text}</p>
  </div>
);

export default Loading;
