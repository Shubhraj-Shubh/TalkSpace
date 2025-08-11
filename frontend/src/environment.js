let IS_PROD = true;
const server = IS_PROD
  ? "https://talkspace-ivm7.onrender.com"
  : "http://localhost:8000";

export default server;
