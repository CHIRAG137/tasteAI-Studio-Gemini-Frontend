export const API_BASE_URL = import.meta.env.VITE_BACKEND_URL

export const registerUser = async (data: any) => {
  const res = await fetch(`${API_BASE_URL}/api/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  return res.json();
};

export const loginUser = async (data: any) => {
  const res = await fetch(`${API_BASE_URL}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  return res.json();
};

export const logoutBotUser = async (token: string) => {
  const res = await fetch(`${API_BASE_URL}/api/auth/logout/bot`, {
    method: "POST",
    headers: { 
      "Content-Type": "application/json",
      "Authorization": `Bearer ${token}`
    },
  });
  return res.json();
};

export const logoutAgentUser = async (token: string) => {
  const res = await fetch(`${API_BASE_URL}/api/human-agent/logout`, {
    method: "POST",
    headers: { 
      "Content-Type": "application/json",
      "Authorization": `Bearer ${token}`
    },
  });
  return res.json();
};
