// Agent Authentication utility functions
export const getAgentAuthToken = (): string | null => {
  return localStorage.getItem('agentAuthToken');
};

export const setAgentAuthToken = (token: string): void => {
  localStorage.setItem('agentAuthToken', token);
};

export const removeAgentAuthToken = (): void => {
  localStorage.removeItem('agentAuthToken');
};

export const getAgentAuthHeaders = (): Record<string, string> => {
  const token = getAgentAuthToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
};

export const isAgentAuthenticated = (): boolean => {
  return !!getAgentAuthToken();
};

export const getAgentEmail = (): string | null => {
  return localStorage.getItem('agentEmail');
};

export const setAgentEmail = (email: string): void => {
  localStorage.setItem('agentEmail', email);
};

export const removeAgentEmail = (): void => {
  localStorage.removeItem('agentEmail');
};
