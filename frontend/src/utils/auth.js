export function getAuth() {
  return {
    token: localStorage.getItem('auth_token'),
    email: localStorage.getItem('auth_email'),
  };
}

export function setAuth(token, email) {
  localStorage.setItem('auth_token', token);
  localStorage.setItem('auth_email', email);
}

export function clearAuth() {
  localStorage.removeItem('auth_token');
  localStorage.removeItem('auth_email');
}